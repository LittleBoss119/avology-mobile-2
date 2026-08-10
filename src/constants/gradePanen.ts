// Satu-satunya sumber kebenaran grade kualitas panen di sisi TypeScript.
// Pasangannya di sisi database adalah check constraint
// `harvest_records_fruit_condition_grade_check` (migrasi 045):
//
//   check (fruit_condition is null or fruit_condition in ('A1', 'A2', 'A3'))
//
// Dua sisi ini tidak bisa diturunkan otomatis, jadi harus dijaga sinkron manual.
//
// KENAPA DIKUNCI JADI DAFTAR: kolom ini dulu teks bebas, dan 12 baris yang ada
// sudah terlanjur berisi "Bagus", "Baik", "Good", dan "Good test harvest" —
// empat nilai untuk satu maksud, dari satu orang. Data seperti itu tidak bisa
// dikelompokkan maupun dihitung.
//
// CATATAN soal data lama: constraint di database dipasang NOT VALID, sehingga
// 12 baris lama itu MASIH ADA dengan teks lamanya. Mapper di harvestService
// memperlakukan nilai di luar daftar ini sebagai null supaya layar tidak pecah
// sebelum data itu dibersihkan.
//
// Mengikuti pola membership.ts / operationalReport.ts / satuanBahan.ts: tuple
// `as const` dulu, tipenya diturunkan dari tuple, sehingga daftarnya bisa
// diiterasi saat runtime untuk chip pemilih dan divalidasi lewat type guard.

// Urutannya urutan mutu, dari terbaik. Ini klasifikasi milik kebun ini sendiri,
// bukan standar universal.
export const GRADE_PANEN = ['A1', 'A2', 'A3'] as const;

export type GradePanen = (typeof GRADE_PANEN)[number];

// Label sengaja memuat keterangan singkat: "A1" saja tidak berarti apa-apa buat
// pekerja yang baru pertama memakai aplikasi ini.
export const GRADE_PANEN_LABELS: Record<GradePanen, string> = {
  A1: 'A1 · Mutu terbaik',
  A2: 'A2 · Mutu sedang',
  A3: 'A3 · Mutu rendah',
};

export function isGradePanen(value: unknown): value is GradePanen {
  return typeof value === 'string' && (GRADE_PANEN as readonly string[]).includes(value);
}

// Batas atas berat panen. Cerminan constraint
// `harvest_records_harvest_weight_kg_check` (migrasi 045):
// harvest_weight_kg null ATAU (> 0 AND <= 100000).
//
// Wajib dijaga di klien, bukan cuma diserahkan ke database: pelanggaran
// constraint sampai ke klien sebagai "violates check constraint ...", dan
// isTechnicalMessage di serviceResult.ts mengubahnya jadi "Terjadi kendala saat
// memproses data. Periksa input lalu coba lagi." — kalimat yang tidak
// memberitahu apa pun tentang angka yang kebesaran.
export const MAX_BERAT_PANEN_KG = 100000;
