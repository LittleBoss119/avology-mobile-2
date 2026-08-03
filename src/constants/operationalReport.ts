// Satu-satunya sumber kebenaran status, kategori, dan resolusi laporan
// operasional di sisi TypeScript. Pasangannya di sisi database adalah enum
// `operational_report_status` / `operational_report_category` (migration 001)
// dan constraint `operational_reports_resolution_check` (migration 034).
// Dua sisi ini tidak bisa diturunkan otomatis, jadi harus dijaga sinkron manual.

export const OPERATIONAL_REPORT_STATUSES = [
  'new',
  'in_progress',
  'resolved',
  'rejected',
] as const;

export type OperationalReportStatus = (typeof OPERATIONAL_REPORT_STATUSES)[number];

// Sembilan kategori yang dipakai UI. Urutannya adalah urutan tampil chip:
// hama/penyakit dulu (paling sering), lalu kerusakan, lalu kondisi luar,
// dan 'other' selalu terakhir sebagai penampung.
export const OPERATIONAL_REPORT_CATEGORIES = [
  'pest',
  'disease',
  'land_damage',
  'broken_tool',
  'worker_need',
  'weather',
  'disaster',
  'out_of_stock',
  'other',
] as const;

export type OperationalReportCategory = (typeof OPERATIONAL_REPORT_CATEGORIES)[number];

// Nilai enum SQL yang masih ada di database tapi sengaja tidak dipakai UI.
// Keduanya punya nol baris, jadi tidak perlu ditampilkan atau bisa dipilih —
// tapi mapper baris DB tetap harus aman kalau suatu saat menemuinya.
export const LEGACY_OPERATIONAL_REPORT_CATEGORIES = [
  'area_pest_disease',
  'disaster_weather',
] as const;

export const FALLBACK_OPERATIONAL_REPORT_CATEGORY: OperationalReportCategory = 'other';

// Keputusan owner atas sebuah laporan:
//   task         -> dibuatkan tugas tindak lanjut untuk pekerja
//   self_handled -> owner mengurus sendiri, wajib meninggalkan catatan
//   already_ok   -> kondisi sudah beres, laporan ditutup tanpa tindakan
export const OPERATIONAL_REPORT_RESOLUTIONS = [
  'task',
  'self_handled',
  'already_ok',
] as const;

export type OperationalReportResolution = (typeof OPERATIONAL_REPORT_RESOLUTIONS)[number];

export function isOperationalReportStatus(value: unknown): value is OperationalReportStatus {
  return (
    typeof value === 'string' &&
    (OPERATIONAL_REPORT_STATUSES as readonly string[]).includes(value)
  );
}

export function isOperationalReportCategory(value: unknown): value is OperationalReportCategory {
  return (
    typeof value === 'string' &&
    (OPERATIONAL_REPORT_CATEGORIES as readonly string[]).includes(value)
  );
}

export function isOperationalReportResolution(
  value: unknown
): value is OperationalReportResolution {
  return (
    typeof value === 'string' &&
    (OPERATIONAL_REPORT_RESOLUTIONS as readonly string[]).includes(value)
  );
}

// Laporan yang sudah resolved/rejected tidak bisa ditindaklanjuti lagi.
// Cerminan guard RPC: `status not in ('new','in_progress') -> already closed`.
// Sebelumnya aturan ini ditulis dua kali (careTaskService + layar laporan).
export function canCreateTaskFromReportStatus(status: OperationalReportStatus): boolean {
  return status === 'new' || status === 'in_progress';
}

export function getClosedReportTaskMessage(status: OperationalReportStatus): string {
  if (status === 'resolved') {
    return 'Laporan yang sudah selesai tidak dapat dibuatkan tugas tindak lanjut.';
  }

  return 'Laporan yang ditolak tidak dapat dibuatkan tugas tindak lanjut.';
}

// Dipakai mapper baris DB. Kategori legacy (atau nilai enum baru yang belum
// dikenal aplikasi lama) tidak boleh membuat seluruh layar gagal render —
// cukup jatuhkan ke 'other' supaya laporannya tetap terbaca.
export function normalizeOperationalReportCategory(value: unknown): OperationalReportCategory {
  if (isOperationalReportCategory(value)) {
    return value;
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(
      '[operational-report-category-unknown]',
      `value=${String(value)}`,
      `fallback=${FALLBACK_OPERATIONAL_REPORT_CATEGORY}`
    );
  }

  return FALLBACK_OPERATIONAL_REPORT_CATEGORY;
}
