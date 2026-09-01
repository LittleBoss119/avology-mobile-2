import type { GrowthPhase, Tree, TreeConditionStatus } from '../types/domain';
import {
  formatGrowthPhase as formatDisplayGrowthPhase,
  formatTreeCondition,
} from './displayFormat';

// treeConditionStatusLabels dan growthPhaseLabels DICABUT: keduanya konstanta
// bentuk panjang dengan nol pemanggil, dan membiarkannya berdiri berarti
// menyimpan daftar label keenam yang bisa menyimpang lagi. Satu-satunya daftar
// sekarang ada di displayFormat.ts, dan kedua fungsi di bawah meneruskan ke
// sana.

export function formatTreeConditionStatus(status: TreeConditionStatus): string {
  return formatTreeCondition(status);
}

export function formatGrowthPhase(phase?: GrowthPhase | null): string {
  return formatDisplayGrowthPhase(phase);
}

export function formatTreeLocation({
  columnPosition,
  rowPosition,
}: {
  columnPosition?: string | null;
  rowPosition?: TreeRowInput;
}): string {
  const row = normalizeTreeRow(rowPosition);
  const column = normalizeTreeColumn(columnPosition);

  if (row && column) {
    return `Baris ${row} \u00B7 Kolom ${column}`;
  }

  if (row) {
    return `Baris ${row}`;
  }

  if (column) {
    return `Kolom ${column}`;
  }

  return 'Lokasi belum diisi';
}

// Baris boleh datang sebagai angka (dari database — row_position kini smallint,
// dan PostgREST mengirimnya sebagai number) maupun sebagai teks (dari field
// form, yang selalu string). Keduanya diterima di satu tipe supaya pemanggil
// tidak perlu mengonversi lebih dulu.
export type TreeRowInput = string | number | null | undefined;

// HANYA untuk tampilan. Sejak migrasi 054, tree_code adalah kolom GENERATED di
// database (`row_position::text || '-' || column_position`) dan TIDAK BISA
// ditulis — fungsi ini tidak lagi membentuk nilai yang disimpan.
//
// Gunanya tinggal dua: pratinjau kode di form sebelum baris tersimpan, dan
// merangkai kode dari nilai form yang belum sempat dikirim.
export function buildTreeDisplayCode({
  columnPosition,
  rowPosition,
}: {
  columnPosition?: string | null;
  rowPosition?: TreeRowInput;
}): string | null {
  const row = normalizeTreeRow(rowPosition);
  const column = normalizeTreeColumn(columnPosition);

  if (!row || !column) {
    return null;
  }

  return `${row}-${column}`;
}

// Kode yang tersimpan didahulukan. tree_code kini dijamin database selalu ada
// dan selalu sepadan dengan posisinya, jadi ia sumber yang paling benar;
// perakitan dari row/column hanya cadangan untuk objek yang belum tersimpan.
export function formatTreeDisplayCode(tree: Pick<Tree, 'columnPosition' | 'rowPosition' | 'treeCode'>): string {
  const storedCode = normalizeOptionalText(tree.treeCode);

  if (storedCode) {
    return storedCode;
  }

  return buildTreeDisplayCode(tree) ?? 'Lokasi belum lengkap';
}

// Baris konteks pohon: '1-A · Baris 1 · Kolom A · Alpukat Mentega'.
//
// Pengganti kartu "Konteks Pohon" yang dulu berdiri paling atas di layar detail
// catatan dan layar edit catatan — masing-masing dengan judul sendiri dan tiga
// MetaRow berlabel. Isinya tiga fakta pendek yang cuma menjawab "ini catatan
// pohon yang mana", pertanyaan yang sudah terjawab sebelum pembacanya sampai ke
// sana karena satu-satunya jalan masuk ke kedua layar itu adalah riwayat di
// detail pohon itu sendiri. Tujuh baris untuk pengingat itu terlalu mahal.
//
// TINGGAL DI SINI, bukan di salah satu layar, justru karena DUA layar memakainya
// dan keduanya wajib menghasilkan baris yang sama persis. Satu salinan di layar
// detail dan satu lagi di layar edit adalah cara paling pasti agar keduanya
// menyimpang diam-diam — pola yang sudah terjadi berkali-kali di basis kode ini
// (enam salinan formatDateInput, tiga salinan formatDateTime).
//
// Bagian yang kosong DILEWATI, bukan diisi 'Belum diisi'. Posisi yang siklus
// tanamnya sudah ditutup tidak punya activePlanting sama sekali, dan mencetak
// 'Belum diisi' sebagai segmen ketiga membuatnya terbaca seolah varietas itu
// sebuah nilai. formatTreeLocation punya cadangannya sendiri untuk lokasi yang
// tidak lengkap, jadi ia tidak pernah kosong dan tidak perlu ditapis.
//
// CATATAN PEMISAH: formatTreeLocation sendiri sudah menyisipkan titik tengah
// ('Baris 1 · Kolom A'), jadi baris jadinya punya empat segmen bertitik, bukan
// tiga. Formatter itu dipakai apa adanya dan TIDAK disalin ulang di sini —
// menyalinnya demi satu pemisah berarti menambah formatter lokasi kedua.
export function formatTreeContextLine(
  tree: Pick<Tree, 'activePlanting' | 'columnPosition' | 'rowPosition' | 'treeCode'>
): string {
  const variety = tree.activePlanting?.variety?.trim();

  return [formatTreeDisplayCode(tree), formatTreeLocation(tree), variety || null]
    .filter((part): part is string => Boolean(part))
    .join(' · ');
}

export function formatTreeAge(plantedAt?: string | null): string {
  const normalized = normalizeOptionalText(plantedAt);

  if (!normalized) {
    return 'Tanggal tanam belum diisi';
  }

  const plantedDate = new Date(normalized);

  if (Number.isNaN(plantedDate.getTime())) {
    return 'Tanggal tanam tidak valid';
  }

  const today = new Date();
  const diffMs = today.getTime() - plantedDate.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / 86_400_000));
  const monthDiff = getFullMonthDiff(plantedDate, today);

  if (monthDiff < 1) {
    return `${diffDays} hari`;
  }

  if (monthDiff < 12) {
    return `${monthDiff} bulan`;
  }

  return `${Math.floor(monthDiff / 12)} tahun`;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

// Baris adalah ANGKA sejak migrasi 054. `.toUpperCase()` dibuang dari sini —
// dulu ia ada karena baris dilambangkan huruf, dan konvensinya kini terbalik:
// baris = angka, kolom = huruf, menghasilkan '1-A'.
//
// Angka dari database dilewatkan apa adanya lewat String(); teks dari form
// hanya di-trim. Yang MEMVALIDASI bentuknya adalah validateTreeForm di sisi
// form dan CHECK constraint di sisi database, bukan fungsi ini.
function normalizeTreeRow(value: TreeRowInput): string | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }

  return normalizeOptionalText(value);
}

// Kolom adalah HURUF sejak migrasi 054. Di-uppercase supaya 'a' yang diketik
// pekerja tampil sama dengan 'A' yang tersimpan — CHECK di database hanya
// menerima huruf kapital.
function normalizeTreeColumn(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalText(value);
  return normalized ? normalized.toUpperCase() : null;
}

function getFullMonthDiff(startDate: Date, endDate: Date): number {
  let months =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    endDate.getMonth() -
    startDate.getMonth();

  if (endDate.getDate() < startDate.getDate()) {
    months -= 1;
  }

  return Math.max(0, months);
}
