import { supabase } from '../lib/supabase';
import type {
  CreateOperationalReportData,
  CreateOperationalReportInput,
  GetOperationalReportEditEligibilityInput,
  GetOperationalReportDetailInput,
  GetOperationalReportsInput,
  MemberRole,
  MemberStatus,
  OperationalReport,
  OperationalReportCategory,
  OperationalReportEditEligibility,
  OperationalReportStatus,
  ServiceResult,
  SuccessData,
  UpdateOwnOperationalReportData,
  UpdateOwnOperationalReportInput,
  UpdateOperationalReportStatusInput,
  UUID,
} from '../types/domain';
import { fail, ok } from '../utils/serviceResult';

const OPERATIONAL_REPORT_SELECT =
  'id, farm_id, reported_by, category, location_note, description, status, owner_response_note, responded_by, responded_at, created_at, updated_at';

const operationalReportCategories: OperationalReportCategory[] = [
  'land_damage',
  'broken_tool',
  'out_of_stock',
  'area_pest_disease',
  'disaster_weather',
  'worker_need',
  'other',
];

const operationalReportStatuses: OperationalReportStatus[] = [
  'new',
  'in_progress',
  'resolved',
  'rejected',
];

type OperationalReportRow = {
  id: string;
  farm_id: string;
  reported_by: string;
  category: OperationalReportCategory;
  location_note: string | null;
  description: string | null;
  status: OperationalReportStatus;
  owner_response_note?: string | null;
  responded_by?: string | null;
  responded_at?: string | null;
  created_at: string;
  updated_at?: string | null;
};

type MembershipRow = {
  role: MemberRole;
  status: MemberStatus;
};

type FollowUpTaskIdRow = {
  id: string;
};

export async function createOperationalReport(
  input: CreateOperationalReportInput
): Promise<ServiceResult<CreateOperationalReportData>> {
  const category = validateOperationalReportCategory(input.category);

  if (category instanceof Error) {
    return fail(category);
  }

  const locationNote = normalizeOptionalText(input.locationNote);
  const description = normalizeOptionalText(input.description);

  if (!locationNote && !description) {
    return fail(new Error('Isi lokasi atau deskripsi laporan operasional.'));
  }

  const accessResult = await ensureActiveWorker(input.farmId);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const userIdResult = await getCurrentUserId();

  if (userIdResult.error) {
    return fail(userIdResult.error);
  }

  const { data, error } = await supabase
    .from('operational_reports')
    .insert({
      category,
      description,
      farm_id: input.farmId,
      location_note: locationNote,
      reported_by: userIdResult.data,
    })
    .select('id')
    .single<{ id: string }>();

  if (error) {
    return fail(error, 'Gagal menyimpan laporan operasional.');
  }

  return ok({
    reportId: data.id,
  });
}

export async function getOperationalReports(
  input: GetOperationalReportsInput
): Promise<ServiceResult<OperationalReport[]>> {
  const accessResult = await ensureActiveFarmMember(input.farmId);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const status = normalizeStatusFilter(input.status);

  if (status instanceof Error) {
    return fail(status);
  }

  const category = normalizeCategoryFilter(input.category);

  if (category instanceof Error) {
    return fail(category);
  }

  let query = supabase
    .from('operational_reports')
    .select(OPERATIONAL_REPORT_SELECT)
    .eq('farm_id', input.farmId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  if (category) {
    query = query.eq('category', category);
  }

  if (input.reportedBy) {
    query = query.eq('reported_by', input.reportedBy);
  }

  const { data, error } = await query.returns<OperationalReportRow[]>();

  if (error) {
    return fail(error, 'Gagal memuat laporan operasional.');
  }

  return ok((data ?? []).map(mapOperationalReport));
}

export async function getOperationalReportDetail(
  input: GetOperationalReportDetailInput
): Promise<ServiceResult<OperationalReport>> {
  const reportId = normalizeRequiredText(
    input.operationalReportId,
    'Laporan operasional tidak ditemukan.'
  );

  if (reportId instanceof Error) {
    return fail(reportId);
  }

  const { data, error } = await supabase
    .from('operational_reports')
    .select(OPERATIONAL_REPORT_SELECT)
    .eq('id', reportId)
    .maybeSingle<OperationalReportRow>();

  if (error) {
    return fail(error, 'Gagal memuat detail laporan operasional.');
  }

  if (!data) {
    return fail(new Error('Laporan operasional tidak ditemukan atau tidak dapat diakses.'));
  }

  const accessResult = await ensureActiveFarmMember(data.farm_id);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  return ok(mapOperationalReport(data));
}

export async function updateOperationalReportStatus(
  input: UpdateOperationalReportStatusInput
): Promise<ServiceResult<SuccessData>> {
  const reportId = normalizeRequiredText(
    input.operationalReportId,
    'Laporan operasional tidak ditemukan.'
  );

  if (reportId instanceof Error) {
    return fail(reportId);
  }

  const status = validateOperationalReportStatus(input.status);

  if (status instanceof Error) {
    return fail(status);
  }

  const reportResult = await getOperationalReportDetail({
    operationalReportId: reportId,
  });

  if (reportResult.error) {
    return fail(reportResult.error);
  }

  const accessResult = await ensureActiveOwner(reportResult.data.farmId);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const { error } = await supabase.rpc('update_operational_report_status', {
    p_operational_report_id: reportId,
    p_owner_response_note: normalizeOptionalText(input.ownerResponseNote),
    p_status: status,
  });

  if (error) {
    return fail(new Error(mapOwnerOperationalReportActionError(error)));
  }

  return ok({
    success: true,
  });
}

export async function getOperationalReportEditEligibility(
  input: GetOperationalReportEditEligibilityInput
): Promise<ServiceResult<OperationalReportEditEligibility>> {
  const reportResult = await getOperationalReportDetail({
    operationalReportId: input.operationalReportId,
  });

  if (reportResult.error) {
    return fail(reportResult.error);
  }

  return getOperationalReportEditEligibilityFromReport(reportResult.data);
}

export async function updateOwnOperationalReport(
  input: UpdateOwnOperationalReportInput
): Promise<ServiceResult<UpdateOwnOperationalReportData>> {
  const reportId = normalizeRequiredText(
    input.operationalReportId,
    'Laporan operasional tidak ditemukan.'
  );

  if (reportId instanceof Error) {
    return fail(reportId);
  }

  const reportResult = await getOperationalReportDetail({
    operationalReportId: reportId,
  });

  if (reportResult.error) {
    return fail(reportResult.error);
  }

  const eligibilityResult = await getOperationalReportEditEligibilityFromReport(reportResult.data);

  if (eligibilityResult.error) {
    return fail(eligibilityResult.error);
  }

  if (!eligibilityResult.data.canEdit) {
    return fail(new Error(eligibilityResult.data.reason ?? 'Laporan ini tidak bisa diedit.'));
  }

  const category = validateOperationalReportCategory(input.category);

  if (category instanceof Error) {
    return fail(category);
  }

  const locationNote = normalizeOptionalText(input.locationNote);
  const description = normalizeOptionalText(input.description);

  if (!locationNote && !description) {
    return fail(new Error('Isi lokasi atau deskripsi laporan operasional.'));
  }

  const { error } = await supabase.rpc('update_own_operational_report', {
    p_category: category,
    p_description: description,
    p_location_note: locationNote,
    p_report_id: reportResult.data.id,
  });

  if (error) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn(
        '[operational-report-edit-failed]',
        `code=${error.code ?? 'unknown'}`,
        `message=${error.message}`
      );
    }

    return fail(new Error(mapUpdateOwnOperationalReportError(error)));
  }

  return ok({
    reportId: reportResult.data.id,
  });
}

async function getOperationalReportEditEligibilityFromReport(
  report: OperationalReport
): Promise<ServiceResult<OperationalReportEditEligibility>> {
  const accessResult = await ensureActiveWorker(report.farmId);

  if (accessResult.error) {
    return ok({
      canEdit: false,
      reason: 'Akses worker tidak aktif.',
    });
  }

  const userIdResult = await getCurrentUserId();

  if (userIdResult.error) {
    return fail(userIdResult.error);
  }

  if (report.reportedBy !== userIdResult.data) {
    return ok({
      canEdit: false,
      reason: 'Hanya pembuat laporan yang bisa mengedit laporan ini.',
    });
  }

  if (
    report.status !== 'new' ||
    Boolean(report.respondedAt) ||
    Boolean(report.respondedBy) ||
    Boolean(normalizeOptionalText(report.ownerResponseNote))
  ) {
    return ok({
      canEdit: false,
      reason: 'Laporan ini sudah ditindaklanjuti owner dan tidak bisa diedit.',
    });
  }

  const followUpTaskResult = await getOperationalReportFollowUpTaskExists(report.id);

  if (followUpTaskResult.error) {
    return fail(followUpTaskResult.error);
  }

  if (followUpTaskResult.data) {
    return ok({
      canEdit: false,
      reason: 'Laporan ini sudah memiliki tugas tindak lanjut dan tidak bisa diedit.',
    });
  }

  return ok({
    canEdit: true,
    reason: null,
  });
}

async function getOperationalReportFollowUpTaskExists(
  reportId: UUID
): Promise<ServiceResult<boolean>> {
  const { data, error } = await supabase
    .from('care_tasks')
    .select('id')
    .eq('operational_report_id', reportId)
    .limit(1)
    .returns<FollowUpTaskIdRow[]>();

  if (error) {
    return fail(error, 'Gagal memeriksa tugas tindak lanjut laporan.');
  }

  return ok((data ?? []).length > 0);
}

function mapUpdateOwnOperationalReportError(error: { code?: string; message?: string }): string {
  if (error.code === 'PGRST202') {
    return 'Fitur edit laporan belum tersambung ke database. Jalankan pembaruan database lalu coba lagi.';
  }

  const message = error.message?.toLowerCase() ?? '';

  if (message.includes('could not find the function')) {
    return 'Fitur edit laporan belum tersambung ke database. Jalankan pembaruan database lalu coba lagi.';
  }

  if (message.includes('location or description')) {
    return 'Isi lokasi atau deskripsi laporan operasional.';
  }

  if (message.includes('worker access is inactive')) {
    return 'Akses worker tidak aktif.';
  }

  if (message.includes('only report creator')) {
    return 'Hanya pembuat laporan yang bisa mengedit laporan ini.';
  }

  if (message.includes('already been responded')) {
    return 'Laporan ini sudah ditindaklanjuti owner dan tidak bisa diedit.';
  }

  if (message.includes('follow up task')) {
    return 'Laporan ini sudah memiliki tugas tindak lanjut dan tidak bisa diedit.';
  }

  if (message.includes('not found')) {
    return 'Laporan tidak ditemukan atau akses tidak aktif.';
  }

  if (message.includes('invalid input value') || message.includes('operational_report_category')) {
    return 'Kategori laporan tidak valid.';
  }

  return 'Perubahan laporan gagal disimpan. Coba lagi.';
}

function mapOwnerOperationalReportActionError(error: { code?: string; message?: string }): string {
  if (error.code === 'PGRST202') {
    return 'Fitur respons laporan belum tersambung ke database. Jalankan pembaruan database lalu coba lagi.';
  }

  const message = error.message?.toLowerCase() ?? '';

  if (message.includes('could not find the function')) {
    return 'Fitur respons laporan belum tersambung ke database. Jalankan pembaruan database lalu coba lagi.';
  }

  if (message.includes('only active owners')) {
    return 'Hanya owner aktif yang dapat mengubah status laporan.';
  }

  if (message.includes('not found')) {
    return 'Laporan tidak ditemukan atau akses tidak aktif.';
  }

  if (message.includes('invalid input value') || message.includes('operational_report_status')) {
    return 'Status laporan tidak valid.';
  }

  return 'Perubahan status laporan gagal disimpan. Coba lagi.';
}

async function ensureActiveFarmMember(farmId: UUID): Promise<ServiceResult<SuccessData>> {
  const membershipResult = await getCurrentUserMembership(farmId);

  if (membershipResult.error) {
    return fail(membershipResult.error);
  }

  if (membershipResult.data?.status !== 'active') {
    return fail(new Error('Hanya anggota kebun aktif yang dapat mengakses laporan operasional.'));
  }

  return ok({
    success: true,
  });
}

async function ensureActiveOwner(farmId: UUID): Promise<ServiceResult<SuccessData>> {
  const membershipResult = await getCurrentUserMembership(farmId);

  if (membershipResult.error) {
    return fail(membershipResult.error);
  }

  if (membershipResult.data?.role !== 'owner' || membershipResult.data.status !== 'active') {
    return fail(new Error('Hanya pemilik aktif yang dapat mengubah laporan operasional.'));
  }

  return ok({
    success: true,
  });
}

async function ensureActiveWorker(farmId: UUID): Promise<ServiceResult<SuccessData>> {
  const membershipResult = await getCurrentUserMembership(farmId);

  if (membershipResult.error) {
    return fail(membershipResult.error);
  }

  if (membershipResult.data?.role !== 'worker' || membershipResult.data.status !== 'active') {
    return fail(new Error('Hanya pekerja aktif yang dapat membuat laporan operasional.'));
  }

  return ok({
    success: true,
  });
}

async function getCurrentUserMembership(
  farmId: UUID
): Promise<ServiceResult<MembershipRow | null>> {
  const userIdResult = await getCurrentUserId();

  if (userIdResult.error) {
    return fail(userIdResult.error);
  }

  const { data, error } = await supabase
    .from('farm_members')
    .select('role, status')
    .eq('farm_id', farmId)
    .eq('user_id', userIdResult.data)
    .maybeSingle<MembershipRow>();

  if (error) {
    return fail(error, 'Gagal memeriksa akses kebun.');
  }

  return ok(data);
}

async function getCurrentUserId(): Promise<ServiceResult<UUID>> {
  const userResult = await supabase.auth.getUser();

  if (userResult.error) {
    if (isMissingSessionError(userResult.error)) {
      return fail(new Error('Silakan login terlebih dahulu.'));
    }

    return fail(userResult.error, 'Gagal memuat pengguna saat ini.');
  }

  const userId = userResult.data.user?.id;

  if (!userId) {
    return fail(new Error('Silakan login terlebih dahulu.'));
  }

  return ok(userId);
}

function validateOperationalReportCategory(
  category: OperationalReportCategory | undefined | null
): OperationalReportCategory | Error {
  if (!category) {
    return new Error('Kategori laporan operasional wajib dipilih.');
  }

  if (!operationalReportCategories.includes(category)) {
    return new Error('Kategori laporan operasional tidak valid.');
  }

  return category;
}

function validateOperationalReportStatus(
  status: OperationalReportStatus | undefined | null
): OperationalReportStatus | Error {
  if (!status) {
    return new Error('Status laporan operasional wajib dipilih.');
  }

  if (!operationalReportStatuses.includes(status)) {
    return new Error('Status laporan operasional tidak valid.');
  }

  return status;
}

function normalizeStatusFilter(
  status: OperationalReportStatus | 'all' | undefined
): OperationalReportStatus | null | Error {
  if (!status || status === 'all') {
    return null;
  }

  return validateOperationalReportStatus(status);
}

function normalizeCategoryFilter(
  category: OperationalReportCategory | 'all' | undefined
): OperationalReportCategory | null | Error {
  if (!category || category === 'all') {
    return null;
  }

  return validateOperationalReportCategory(category);
}

function mapOperationalReport(row: OperationalReportRow): OperationalReport {
  return {
    category: row.category,
    createdAt: row.created_at,
    description: row.description,
    farmId: row.farm_id,
    id: row.id,
    locationNote: row.location_note,
    ownerResponseNote: row.owner_response_note,
    reportedBy: row.reported_by,
    respondedAt: row.responded_at,
    respondedBy: row.responded_by,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function normalizeRequiredText(value: string, message: string): string | Error {
  const normalized = value.trim();
  return normalized ? normalized : new Error(message);
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function isMissingSessionError(error: { message?: string; name?: string }): boolean {
  return (
    error.name === 'AuthSessionMissingError' ||
    error.message?.toLowerCase().includes('auth session missing') === true
  );
}
