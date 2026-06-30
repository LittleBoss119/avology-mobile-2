import { supabase } from '../lib/supabase';
import type {
  CreateOperationalReportData,
  CreateOperationalReportInput,
  GetOperationalReportDetailInput,
  GetOperationalReportsInput,
  MemberRole,
  MemberStatus,
  OperationalReport,
  OperationalReportCategory,
  OperationalReportStatus,
  ServiceResult,
  SuccessData,
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
    p_status: status,
  });

  if (error) {
    return fail(error, 'Gagal memperbarui status laporan operasional.');
  }

  return ok({
    success: true,
  });
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
