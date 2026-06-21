import type { ServiceError, ServiceResult } from '../types/domain';

type ErrorLike = {
  code?: string;
  message?: string;
  name?: string;
};

const friendlyMessages: Array<[string, string]> = [
  ['Invalid login credentials', 'Email atau password tidak sesuai.'],
  ['Email not confirmed', 'Email belum dikonfirmasi. Periksa inbox Anda terlebih dahulu.'],
  ['User already registered', 'Email ini sudah terdaftar. Silakan login.'],
  ['User is not authenticated', 'Silakan login terlebih dahulu.'],
  ['Profile must exist before creating a farm', 'Profil pengguna belum lengkap. Silakan lengkapi profil terlebih dahulu.'],
  ['Profile must exist before joining a farm', 'Profil pengguna belum lengkap. Silakan lengkapi profil terlebih dahulu.'],
  ['Join code is invalid', 'Kode kebun tidak ditemukan. Periksa kembali kode yang dimasukkan.'],
  ['User already has a pending or active membership', 'Anda sudah memiliki pengajuan atau keanggotaan aktif di kebun ini.'],
  ['Pending worker not found', 'Pengajuan pekerja tidak ditemukan atau sudah diproses.'],
  ['Active worker not found', 'Pekerja aktif tidak ditemukan.'],
  ['Only active owners can approve workers', 'Hanya pemilik aktif yang dapat menyetujui pekerja.'],
  ['Only active owners can reject workers', 'Hanya pemilik aktif yang dapat menolak pekerja.'],
  ['Only active owners can remove workers', 'Hanya pemilik aktif yang dapat mengeluarkan pekerja.'],
  ['Only active owners can view pending workers', 'Hanya pemilik aktif yang dapat melihat pengajuan pekerja.'],
  ['Only active owners can view active workers', 'Hanya pemilik aktif yang dapat melihat pekerja aktif.'],
  ['trees_unique_code_per_farm', 'Kode pohon sudah digunakan di kebun ini.'],
  ['Tree condition report tree must belong to the same farm', 'Pohon tidak terdaftar pada kebun yang dipilih.'],
  ['Only active farm members can create tree condition reports', 'Hanya anggota kebun aktif yang dapat membuat laporan kondisi pohon.'],
  ['Growth phase record tree must belong to the same farm', 'Pohon tidak terdaftar pada kebun yang dipilih.'],
  ['Only active farm members can create growth phase records', 'Hanya pemilik atau pekerja aktif yang dapat mencatat fase pertumbuhan.'],
  ['Hanya owner aktif yang dapat mengakses monitoring fase.', 'Hanya pemilik aktif yang dapat mengakses monitoring fase.'],
  ['Only active owners can manage care SOPs', 'Hanya pemilik aktif yang dapat mengelola SOP perawatan.'],
  ['SOP default target tree must belong to the same farm', 'Pohon target SOP tidak terdaftar pada kebun yang dipilih.'],
  ['care_sops_interval_days_check', 'Interval hari SOP harus lebih dari 0.'],
  ['care_sops_default_target_check', 'Target default SOP tidak valid.'],
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
  ['Report follow-up tasks can only be assigned to active workers', 'Tugas tindak lanjut hanya dapat diberikan kepada pekerja aktif.'],
  ['Care task operational report must belong to the same farm', 'Laporan operasional tidak terdaftar pada kebun tugas.'],
  ['Task not found', 'Tugas tidak ditemukan atau tidak dapat diakses.'],
  ['Only the assigned worker can complete this task', 'Hanya pekerja yang ditugaskan yang dapat menyelesaikan tugas ini.'],
  ['Only active workers can complete tasks', 'Hanya pekerja aktif yang dapat menyelesaikan tugas.'],
  ['Only the assigned worker can postpone this task', 'Hanya pekerja yang ditugaskan yang dapat menunda tugas ini.'],
  ['Only active workers can postpone tasks', 'Hanya pekerja aktif yang dapat menunda tugas.'],
  ['Postpone note is required', 'Catatan penundaan wajib diisi.'],
  ['duplicate key value violates unique constraint', 'Data dengan kode yang sama sudah ada.'],
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
  return {
    data: null,
    error: toServiceError(error, fallbackMessage),
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

  return match?.[1] ?? message;
}
