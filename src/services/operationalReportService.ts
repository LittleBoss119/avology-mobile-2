import {
  isOperationalReportCategory,
  isOperationalReportResolution,
  normalizeOperationalReportCategory,
} from '../constants/operationalReport';
import { supabase } from '../lib/supabase';
import type {
  CloseReportInput,
  CreateOperationalReportData,
  CreateOperationalReportInput,
  DeleteOwnOperationalReportInput,
  GetOperationalReportEditEligibilityInput,
  GetOperationalReportDetailInput,
  GetOperationalReportsInput,
  HandleReportMyselfInput,
  MarkReportAlreadyResolvedInput,
  MemberRole,
  MemberStatus,
  OperationalReport,
  OperationalReportCategory,
  OperationalReportEditEligibility,
  OperationalReportResolution,
  OperationalReportStatus,
  RejectReportInput,
  ServiceResult,
  SuccessData,
  UpdateOwnOperationalReportData,
  UpdateOwnOperationalReportInput,
  UUID,
} from '../types/domain';
import { fail, ok } from '../utils/serviceResult';
import { deleteOperationalReportPhotoObjects } from './photoAttachmentService';

export { resolveReportWithTask } from './careTaskService';

const OPERATIONAL_REPORT_SELECT =
  'id, farm_id, reported_by, category, location_note, description, status, resolution, resolved_at, owner_response_note, responded_by, responded_at, created_at, updated_at';

type OperationalReportRow = {
  id: string;
  farm_id: string;
  reported_by: string;
  category: string;
  location_note: string | null;
  description: string | null;
  status: OperationalReportStatus;
  resolution?: string | null;
  resolved_at?: string | null;
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

  const description = normalizeOptionalText(input.description);

  if (!description) {
    return fail(new Error('Deskripsi laporan wajib diisi.'));
  }

  const locationNote = normalizeOptionalText(input.locationNote);

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

  let query = supabase
    .from('operational_reports')
    .select(OPERATIONAL_REPORT_SELECT)
    .eq('farm_id', input.farmId)
    .order('created_at', { ascending: false });

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

// ---------------------------------------------------------------------------
// Keputusan owner
// ---------------------------------------------------------------------------
// Empat aksi berbasis NIAT, bukan berbasis status. Semua guard transisi
// (laporan sudah tertutup, tidak boleh balik ke 'new', reject hanya dari 'new'
// dan hanya kalau belum ada tugas, catatan wajib untuk self_handled/reject,
// resolution 'task' hanya sah kalau tugasnya ada) DITEGAKKAN RPC — sengaja
// tidak diduplikasi di sini, cukup dipetakan pesan errornya.
//
// Keputusan "buat tugas" TIDAK ada di sini: itu resolveReportWithTask, yang
// di-re-export dari careTaskService karena RPC-nya sekaligus meng-insert tugas.

// Owner mengurus sendiri -> in_progress + self_handled. Catatan wajib.
export async function handleReportMyself(
  input: HandleReportMyselfInput
): Promise<ServiceResult<SuccessData>> {
  const note = normalizeOptionalText(input.note);

  // Dicegah di client: bisa diketahui tanpa round-trip, dan pesannya lebih
  // spesifik daripada balasan RPC. Sama perlakuannya dengan rejectReport.
  if (!note) {
    return fail(new Error('Catatan wajib diisi kalau Anda mengurus laporan ini sendiri.'));
  }

  return callUpdateOperationalReportStatus({
    operationalReportId: input.operationalReportId,
    ownerResponseNote: note,
    resolution: 'self_handled',
    status: 'in_progress',
  });
}

// Kondisi ternyata sudah beres -> langsung resolved + already_ok.
export async function markReportAlreadyResolved(
  input: MarkReportAlreadyResolvedInput
): Promise<ServiceResult<SuccessData>> {
  return callUpdateOperationalReportStatus({
    operationalReportId: input.operationalReportId,
    ownerResponseNote: toOwnerNoteInstruction(input.note),
    resolution: 'already_ok',
    status: 'resolved',
  });
}

// Tolak laporan -> rejected, resolution tetap null. Alasan wajib.
export async function rejectReport(
  input: RejectReportInput
): Promise<ServiceResult<SuccessData>> {
  const reason = normalizeOptionalText(input.reason);

  // Satu-satunya validasi client di alur keputusan: bisa dicegah tanpa
  // round-trip, dan pesannya lebih spesifik daripada balasan RPC.
  if (!reason) {
    return fail(new Error('Alasan penolakan wajib diisi.'));
  }

  return callUpdateOperationalReportStatus({
    operationalReportId: input.operationalReportId,
    ownerResponseNote: reason,
    resolution: null,
    status: 'rejected',
  });
}

// Tutup laporan yang sudah in_progress -> resolved, resolution DIPERTAHANKAN
// (RPC memakai resolution lama saat p_resolution null).
export async function closeReport(
  input: CloseReportInput
): Promise<ServiceResult<SuccessData>> {
  return callUpdateOperationalReportStatus({
    operationalReportId: input.operationalReportId,
    ownerResponseNote: toOwnerNoteInstruction(input.note),
    resolution: null,
    status: 'resolved',
  });
}

async function callUpdateOperationalReportStatus(input: {
  operationalReportId: UUID;
  // null = pertahankan catatan lama, '' = HAPUS catatan, teks = ganti catatan.
  ownerResponseNote: string | null;
  // null = pertahankan resolution lama.
  resolution: OperationalReportResolution | null;
  status: OperationalReportStatus;
}): Promise<ServiceResult<SuccessData>> {
  const reportId = normalizeRequiredText(
    input.operationalReportId,
    'Laporan operasional tidak ditemukan.'
  );

  if (reportId instanceof Error) {
    return fail(reportId);
  }

  const { error } = await supabase.rpc('update_operational_report_status', {
    p_operational_report_id: reportId,
    p_owner_response_note: input.ownerResponseNote,
    p_resolution: input.resolution,
    p_status: input.status,
  });

  if (error) {
    return fail(
      new Error(
        mapOperationalReportActionError(
          error,
          'Fitur respons laporan belum tersambung ke database. Jalankan pembaruan database lalu coba lagi.',
          'Perubahan status laporan gagal disimpan. Coba lagi.'
        )
      )
    );
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

  const category = validateOperationalReportCategory(input.category);

  if (category instanceof Error) {
    return fail(category);
  }

  const description = normalizeOptionalText(input.description);

  if (!description) {
    return fail(new Error('Deskripsi laporan wajib diisi.'));
  }

  const locationNote = normalizeOptionalText(input.locationNote);

  const { error } = await supabase.rpc('update_own_operational_report', {
    p_category: category,
    p_description: description,
    p_location_note: locationNote,
    p_report_id: reportId,
  });

  if (error) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn(
        '[operational-report-edit-failed]',
        `code=${error.code ?? 'unknown'}`,
        `message=${error.message}`
      );
    }

    return fail(
      new Error(
        mapOperationalReportActionError(
          error,
          'Fitur edit laporan belum tersambung ke database. Jalankan pembaruan database lalu coba lagi.',
          'Perubahan laporan gagal disimpan. Coba lagi.'
        )
      )
    );
  }

  return ok({
    reportId,
  });
}

// Hapus laporan sendiri, beserta foto lampirannya.
//
// URUTAN WAJIB — objek storage dulu, RPC belakangan.
// Policy DELETE di storage.objects memakai baris photo_attachments sebagai
// bukti kepemilikan (`pa.uploaded_by = auth.uid()`), dan jalur cadangannya
// memanggil can_upload_operational_report_photo() yang butuh baris laporan
// masih ada. RPC delete_own_operational_report menghapus KEDUANYA, jadi kalau
// RPC jalan duluan, file storage jadi yatim dan tidak bisa dihapus siapa pun
// selain owner aktif.
export async function deleteOwnOperationalReport(
  input: DeleteOwnOperationalReportInput
): Promise<ServiceResult<SuccessData>> {
  const reportId = normalizeRequiredText(
    input.operationalReportId,
    'Laporan operasional tidak ditemukan.'
  );

  if (reportId instanceof Error) {
    return fail(reportId);
  }

  const farmId = normalizeRequiredText(input.farmId, 'Kebun tidak valid.');

  if (farmId instanceof Error) {
    return fail(farmId);
  }

  // Gagal sebagian di sini tidak boleh membatalkan penghapusan laporan:
  // laporan yang tertinggal lebih mengganggu daripada file sisa.
  await deleteOperationalReportPhotoObjects({
    farmId,
    operationalReportId: reportId,
  });

  const { error } = await supabase.rpc('delete_own_operational_report', {
    p_report_id: reportId,
  });

  if (error) {
    return fail(
      new Error(
        mapOperationalReportActionError(
          error,
          'Fitur hapus laporan belum tersambung ke database. Jalankan pembaruan database lalu coba lagi.',
          'Laporan gagal dihapus. Coba lagi.'
        )
      )
    );
  }

  return ok({
    success: true,
  });
}

// Dipakai untuk menyembunyikan tombol edit/hapus SEBELUM round-trip. Bukan
// pengganti guard RPC update_own_operational_report / delete_own_operational_report
// — keduanya menegakkan aturan yang sama di sisi database. Di sini sengaja
// hanya dua sumber data: sesi lokal (siapa saya) + satu query tugas tindak
// lanjut. Sisanya sudah ada di baris laporan yang dipegang pemanggil.
async function getOperationalReportEditEligibilityFromReport(
  report: OperationalReport
): Promise<ServiceResult<OperationalReportEditEligibility>> {
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

// Semua pesan `raise exception` dari RPC laporan (status, edit, hapus) dipetakan
// di satu tabel supaya tidak ada cabang yang diam-diam jatuh ke fallback generik.
const operationalReportErrorMessages: Array<[string, string]> = [
  // --- akses & keberadaan ---
  ['operational report not found', 'Laporan tidak ditemukan atau akses tidak aktif.'],
  ['only active owners', 'Hanya owner aktif yang dapat mengubah status laporan.'],
  ['worker access is inactive', 'Akses pekerja tidak aktif.'],
  ['authentication required', 'Silakan login terlebih dahulu.'],

  // --- guard transisi status (migration 034) ---
  [
    'operational report is already closed',
    'Laporan ini sudah ditutup dan tidak bisa diubah lagi.',
  ],
  [
    'operational report cannot be moved back to new',
    'Laporan yang sudah direspons tidak bisa dikembalikan ke status menunggu.',
  ],
  [
    'only untouched operational reports can be rejected',
    'Hanya laporan yang belum ditindaklanjuti yang bisa ditolak.',
  ],
  [
    'operational report with follow up task cannot be rejected',
    'Laporan yang sudah punya tugas tindak lanjut tidak bisa ditolak.',
  ],
  ['rejection reason is required', 'Alasan penolakan wajib diisi.'],
  [
    'operational report resolution is required',
    'Pilih dulu tindak lanjut untuk laporan ini.',
  ],
  [
    'owner note is required when handling the report directly',
    'Catatan wajib diisi kalau Anda mengurus laporan ini sendiri.',
  ],
  [
    'operational report has no follow up task',
    'Laporan ini belum punya tugas tindak lanjut.',
  ],
  [
    'operational report already has an open follow up task',
    'Laporan ini masih punya tugas tindak lanjut yang berjalan.',
  ],

  // --- edit & hapus laporan sendiri ---
  ['only report creator can delete', 'Hanya pembuat laporan yang bisa menghapus laporan ini.'],
  ['only report creator', 'Hanya pembuat laporan yang bisa mengedit laporan ini.'],
  [
    'already been responded',
    'Laporan ini sudah ditindaklanjuti owner dan tidak bisa diubah.',
  ],
  [
    'already has follow up task',
    'Laporan ini sudah memiliki tugas tindak lanjut dan tidak bisa diubah.',
  ],
  ['location or description', 'Deskripsi laporan wajib diisi.'],

  // --- validasi nilai ---
  ['operational_report_category', 'Kategori laporan tidak valid.'],
  ['operational_report_status', 'Status laporan tidak valid.'],
  ['operational_reports_resolution', 'Tindak lanjut laporan tidak valid.'],
  ['invalid input value', 'Nilai yang dikirim tidak valid.'],
];

function mapOperationalReportActionError(
  error: { code?: string; message?: string },
  missingFunctionMessage: string,
  fallbackMessage: string
): string {
  const message = error.message?.toLowerCase() ?? '';

  if (error.code === 'PGRST202' || message.includes('could not find the function')) {
    return missingFunctionMessage;
  }

  const match = operationalReportErrorMessages.find(([raw]) => message.includes(raw));

  return match ? match[1] : fallbackMessage;
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

  if (!isOperationalReportCategory(category)) {
    return new Error('Kategori laporan operasional tidak valid.');
  }

  return category;
}

function mapOperationalReport(row: OperationalReportRow): OperationalReport {
  return {
    category: normalizeOperationalReportCategory(row.category),
    createdAt: row.created_at,
    description: row.description,
    farmId: row.farm_id,
    id: row.id,
    locationNote: row.location_note,
    ownerResponseNote: row.owner_response_note,
    reportedBy: row.reported_by,
    resolution: isOperationalReportResolution(row.resolution) ? row.resolution : null,
    resolvedAt: row.resolved_at ?? null,
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

// Beda dari normalizeOptionalText: string kosong DIPERTAHANKAN sebagai ''.
// Bagi RPC, '' berarti "hapus catatan" sedangkan null berarti "biarkan apa
// adanya" — dua hal yang berbeda, dan itulah yang memperbaiki bug lama di mana
// owner_response_note tidak pernah bisa dikosongkan.
function toOwnerNoteInstruction(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return value.trim();
}

function isMissingSessionError(error: { message?: string; name?: string }): boolean {
  return (
    error.name === 'AuthSessionMissingError' ||
    error.message?.toLowerCase().includes('auth session missing') === true
  );
}
