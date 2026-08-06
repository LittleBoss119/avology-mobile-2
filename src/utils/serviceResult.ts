import type { ServiceError, ServiceResult } from '../types/domain';

type ErrorLike = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
  name?: string;
  status?: number;
};

const uuidPattern = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;

const friendlyMessages: Array<[string, string]> = [
  ['Invalid login credentials', 'Email atau password tidak sesuai.'],
  ['Email not confirmed', 'Email belum dikonfirmasi. Periksa inbox Anda terlebih dahulu.'],
  ['User already registered', 'Email ini sudah terdaftar. Silakan login.'],
  ['Password should be at least 6 characters', 'Password minimal 6 karakter.'],
  // Hanya kegagalan PARSING format yang dipetakan. email_address_invalid
  // ("Email address ... is invalid") sengaja TIDAK dipetakan ke sini: itu muncul
  // saat GoTrue menolak alamatnya (domain, disposable), bukan saat formatnya
  // salah — menyuruh user membetulkan format alamat yang formatnya sudah benar.
  ['Unable to validate email address', 'Format email belum benar.'],
  ['User is not authenticated', 'Silakan login terlebih dahulu.'],
  ['Profile must exist before creating a farm', 'Profil pengguna belum lengkap. Silakan lengkapi profil terlebih dahulu.'],
  ['Profile must exist before joining a farm', 'Profil pengguna belum lengkap. Silakan lengkapi profil terlebih dahulu.'],
  ['Join code is invalid', 'Kode kebun tidak ditemukan. Periksa kembali kode yang dimasukkan.'],
  // Guard di request_join_farm sudah GLOBAL sejak migration 036 — ia menolak
  // pemanggil yang punya relasi pending/active di kebun MANA PUN, bukan cuma di
  // kebun tujuan. preview_farm_by_join_code (migration 037) melempar pesan yang
  // sama persis, jadi satu pemetaan ini melayani kedua jalur.
  ['User already has a pending or active membership', 'Kamu masih terhubung ke kebun lain. Keluar dari kebun itu dulu sebelum mengajukan gabung.'],
  ['Cannot join a farm you own', 'Ini kebun kamu sendiri.'],
  ['Pending join request not found', 'Tidak ada pengajuan yang bisa dibatalkan.'],
  ['Access notice not found', 'Tidak ada pemberitahuan akses yang perlu ditutup.'],
  ['Only active owners can view farm access events', 'Hanya pemilik aktif yang dapat melihat riwayat akses kebun.'],
  ['Pending worker not found', 'Pengajuan pekerja tidak ditemukan atau sudah diproses.'],
  ['Active worker not found', 'Pekerja aktif tidak ditemukan.'],
  ['Only active owners can approve workers', 'Hanya pemilik aktif yang dapat menyetujui pekerja.'],
  ['Only active owners can reject workers', 'Hanya pemilik aktif yang dapat menolak pekerja.'],
  ['Only active owners can remove workers', 'Hanya pemilik aktif yang dapat mengeluarkan pekerja.'],
  ['Only active owners can view pending workers', 'Hanya pemilik aktif yang dapat melihat pengajuan pekerja.'],
  ['Only active owners can view active workers', 'Hanya pemilik aktif yang dapat melihat pekerja aktif.'],
  ['trees_unique_code_per_farm', 'Lokasi pohon ini sudah digunakan. Periksa baris dan kolom.'],
  ['Tree condition report tree must belong to the same farm', 'Pohon tidak terdaftar pada kebun yang dipilih.'],
  ['Only active farm members can create tree condition reports', 'Hanya anggota kebun aktif yang dapat membuat laporan kondisi pohon.'],
  ['Growth phase record tree must belong to the same farm', 'Pohon tidak terdaftar pada kebun yang dipilih.'],
  ['Only active farm members can create growth phase records', 'Hanya pemilik atau pekerja aktif yang dapat mencatat fase pertumbuhan.'],
  ['Hanya owner aktif yang dapat mengakses monitoring fase.', 'Hanya pemilik aktif yang dapat mengakses monitoring fase.'],
  ['Only active owners can manage care SOPs', 'Hanya pemilik aktif yang dapat mengelola SOP perawatan.'],
  ['SOP default target tree must belong to the same farm', 'Pohon target SOP tidak terdaftar pada kebun yang dipilih.'],
  ['care_sops_interval_days_check', 'Interval perawatan SOP harus lebih dari 0 hari.'],
  ['care_sops_default_target_check', 'Target bawaan SOP tidak valid.'],
  ['Only active owners can create schedules from SOP', 'Hanya pemilik aktif yang dapat membuat jadwal dari SOP.'],
  ['Only active owners can create manual schedules', 'Hanya pemilik aktif yang dapat membuat jadwal manual.'],
  ['Active SOP not found for farm', 'SOP aktif tidak ditemukan pada kebun ini.'],
  ['SOP schedules cannot use custom target', 'Jadwal dari SOP tidak boleh memakai target khusus.'],
  ['Schedule tasks can only be assigned to active workers', 'Tugas hanya dapat diberikan kepada pekerja aktif.'],
  ['Care schedule target tree must belong to the same farm', 'Pohon target jadwal tidak terdaftar pada kebun yang dipilih.'],
  ['Care tasks can only be assigned to active workers', 'Tugas hanya dapat diberikan kepada pekerja aktif.'],
  ['Operational report not found', 'Laporan operasional tidak ditemukan atau tidak dapat diakses.'],
  ['Only active workers can create operational reports', 'Hanya pekerja aktif yang dapat membuat laporan operasional.'],
  ['Only active owners can update operational report status', 'Hanya pemilik aktif yang dapat mengubah status laporan operasional.'],
  ['Only active owners can create task from operational report', 'Hanya pemilik aktif yang dapat membuat tindak lanjut laporan operasional.'],
  // Dua guard dari migration 034 yang bisa muncul lewat
  // create_task_from_operational_report. Jalur itu memakai fail() biasa, bukan
  // mapper di operationalReportService, jadi padanannya harus ada di sini juga.
  ['Operational report is already closed', 'Laporan ini sudah ditutup dan tidak bisa diubah lagi.'],
  ['Operational report already has an open follow up task', 'Laporan ini masih punya tugas tindak lanjut yang berjalan.'],
  ['Report follow-up tasks can only be assigned to active workers', 'Tugas tindak lanjut hanya dapat diberikan kepada pekerja aktif.'],
  ['Care task operational report must belong to the same farm', 'Laporan operasional tidak terdaftar pada kebun tugas.'],
  ['Task not found', 'Tugas tidak ditemukan atau tidak dapat diakses.'],
  ['Only the assigned worker can complete this task', 'Hanya pekerja yang ditugaskan yang dapat menyelesaikan tugas ini.'],
  ['Only active workers can complete tasks', 'Hanya pekerja aktif yang dapat menyelesaikan tugas.'],
  ['Only the assigned worker can postpone this task', 'Hanya pekerja yang ditugaskan yang dapat menunda tugas ini.'],
  ['Only active workers can postpone tasks', 'Hanya pekerja aktif yang dapat menunda tugas.'],
  ['Postpone note is required', 'Catatan penundaan wajib diisi.'],
  ['duplicate key value violates unique constraint', 'Data dengan kode yang sama sudah ada.'],
  // PGRST202/PGRST205: PostgREST belum memuat ulang cache skemanya, biasanya
  // beberapa detik setelah migration di-push. Tanpa entri ini pesannya jatuh ke
  // isTechnicalMessage dan berbunyi "Periksa input lalu coba lagi" — saran yang
  // salah, karena tidak ada input yang bisa diperbaiki user. Dulu galat ini
  // tidak pernah terlihat karena getCurrentUserFarm menelannya lewat jalur
  // cadangan; jalur itu sudah dihapus, jadi sekarang ia sampai ke layar.
  ['schema cache', 'Aplikasi belum tersambung penuh ke server. Tunggu sebentar lalu coba lagi.'],
  ['Failed to fetch', 'Gagal memuat data. Periksa koneksi internet Anda.'],
  ['Network request failed', 'Gagal memuat data. Periksa koneksi internet Anda.'],
];

export function ok<T>(data: T): ServiceResult<T> {
  return {
    data,
    error: null,
  };
}

export function fail<T>(
  error: unknown,
  fallbackMessage = 'Terjadi kesalahan. Silakan coba lagi.'
): ServiceResult<T> {
  const serviceError = toServiceError(error, fallbackMessage);

  logDevelopmentServiceError(error, serviceError);

  return {
    data: null,
    error: serviceError,
  };
}

export function toServiceError(
  error: unknown,
  fallbackMessage = 'Terjadi kesalahan. Silakan coba lagi.'
): ServiceError {
  const errorLike = error as ErrorLike | null | undefined;
  const rawMessage = errorLike?.message;
  const message = rawMessage ? toFriendlyMessage(rawMessage) : fallbackMessage;

  return {
    message,
    code: errorLike?.code ?? errorLike?.name,
    rawMessage,
  };
}

function toFriendlyMessage(message: string): string {
  const match = friendlyMessages.find(([raw]) =>
    message.toLowerCase().includes(raw.toLowerCase())
  );

  if (match) {
    return match[1];
  }

  if (isTechnicalMessage(message)) {
    return 'Terjadi kendala saat memproses data. Periksa input lalu coba lagi.';
  }

  return message;
}

function isTechnicalMessage(message: string): boolean {
  const normalized = message.toLowerCase();

  return (
    uuidPattern.test(message) ||
    normalized.includes('violates row-level security') ||
    normalized.includes('violates foreign key constraint') ||
    normalized.includes('violates check constraint') ||
    normalized.includes('violates not-null constraint') ||
    normalized.includes('duplicate key value violates unique constraint') ||
    normalized.includes('invalid input syntax') ||
    normalized.includes('schema cache') ||
    normalized.includes('postgresterror') ||
    normalized.includes('sqlstate') ||
    normalized.includes('permission denied for table') ||
    normalized.includes('relation "') ||
    normalized.includes('column "') ||
    normalized.includes('rpc ') ||
    normalized.includes('stack trace')
  );
}

function logDevelopmentServiceError(error: unknown, serviceError: ServiceError): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  const errorLike = error as ErrorLike | null | undefined;
  const rawMessage = errorLike?.message ?? serviceError.rawMessage;
  const shouldLog =
    Boolean(errorLike?.code || errorLike?.details || errorLike?.hint || errorLike?.status)
    || (rawMessage ? isTechnicalMessage(rawMessage) : false);

  if (!shouldLog) {
    return;
  }

  console.debug('[service-error]', {
    code: errorLike?.code ?? serviceError.code ?? null,
    details: sanitizeDebugText(errorLike?.details),
    hint: sanitizeDebugText(errorLike?.hint),
    message: sanitizeDebugText(rawMessage),
    name: errorLike?.name ?? null,
    status: errorLike?.status ?? null,
    userMessage: serviceError.message,
  });
}

function sanitizeDebugText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.replace(uuidPattern, '[uuid]');
}
