// Masukan angka desimal dari keyboard, untuk kolom numeric di database.
//
// SATU-SATUNYA implementasi di aplikasi ini. Dipakai takaran bahan di layar
// catat hasil kerja, dan berat panen di layar catat/edit panen. Sebelumnya
// bentuknya disalin di dua tempat dengan perilaku identik; salinan itu sudah
// dibuang.

// Banyak angka di belakang koma yang benar-benar tersimpan.
//
// Ini properti KOLOM, bukan properti takaran bahan maupun berat panen: seluruh
// kolom numeric yang dipakai fitur pencatatan berskala (10,2) —
// care_activities.produk_jumlah (migrasi 043) dan
// harvest_records.harvest_weight_kg (migrasi 045). Angka ketiga dan seterusnya
// dibulatkan diam-diam oleh Postgres, jadi lebih jujur memotongnya saat
// pengguna mengetik.
//
// Batas NILAI (MAX_TAKARAN_BAHAN, MAX_BERAT_PANEN_KG) sengaja TIDAK di sini —
// itu aturan domain masing-masing, dan tempatnya di konstanta domainnya.
export const MAX_ANGKA_DESIMAL = 2;

// Menyaring saat mengetik: hanya angka, SATU pemisah desimal, dan paling
// banyak `maxDecimals` angka di belakangnya.
//
// Tanda minus ikut tersaring, jadi angka negatif mustahil diketik.
//
// Digit desimal berlebih dipotong DI SINI, bukan ditolak saat simpan: kolom
// numeric(10,2) di database memang tidak akan pernah menyimpannya, dan
// menghukum pengguna karena mengetik terlalu teliti tidak masuk akal. Yang dia
// lihat di layar sejak awal sama dengan yang tersimpan.
export function sanitizeDecimalInput(value: string, maxDecimals: number): string {
  const digitsAndSeparators = value.replace(/[^0-9.,]/g, '');
  const firstSeparator = digitsAndSeparators.search(/[.,]/);

  if (firstSeparator === -1) {
    return digitsAndSeparators;
  }

  const head = digitsAndSeparators.slice(0, firstSeparator + 1);
  const tail = digitsAndSeparators
    .slice(firstSeparator + 1)
    .replace(/[.,]/g, '')
    .slice(0, maxDecimals);

  return `${head}${tail}`;
}

// Menerima koma maupun titik sebagai pemisah desimal. Pengguna mengetik "0,5"
// karena itu bentuk yang dia kenal (locale id-ID), sementara Number() hanya
// mengerti titik.
//
// Mengembalikan null untuk masukan kosong, tidak terbaca, atau tidak lebih dari
// nol — bukan NaN, yang akan lolos diam-diam sampai ke database.
export function parseDecimalInput(value: string): number | null {
  const normalized = value.trim().replace(',', '.');

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
