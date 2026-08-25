// Satu-satunya sumber kebenaran satuan takaran bahan perawatan di sisi
// TypeScript. Pasangannya di sisi database adalah check constraint
// `care_activities_produk_satuan_check` (migrasi 043):
//
//   check (produk_satuan is null
//          or produk_satuan in ('kg', 'gram', 'liter', 'ml', 'karung', 'tangki'))
//
// Dua sisi ini tidak bisa diturunkan otomatis, jadi harus dijaga sinkron
// manual. Kalau daftar di bawah bertambah tanpa migrasi pasangannya, insert
// akan ditolak database — bukan gagal senyap, tapi tetap saja pesan errornya
// tidak enak dibaca pekerja.
//
// Mengikuti pola membership.ts: tuple `as const` dulu,
// tipenya diturunkan dari tuple. Dengan begitu daftarnya bisa diiterasi saat
// runtime (untuk chip pemilih di Tahap C) dan divalidasi lewat type guard,
// bukan sekadar union tipe telanjang yang hilang setelah kompilasi.

// Urutannya adalah urutan tampil, dari yang paling sering dipakai kebun:
// bobot dulu (pupuk), lalu volume (pestisida cair), lalu wadah (satuan kasar
// yang dipakai pekerja di lapangan saat tidak menimbang).
export const SATUAN_BAHAN = ['kg', 'gram', 'liter', 'ml', 'karung', 'tangki'] as const;

export type SatuanBahan = (typeof SATUAN_BAHAN)[number];

// Label tampil. 'kg' dan 'ml' dibiarkan huruf kecil karena itu bentuk baku
// simbol satuannya; sisanya kata biasa berbahasa Indonesia.
export const SATUAN_BAHAN_LABELS: Record<SatuanBahan, string> = {
  gram: 'gram',
  karung: 'karung',
  kg: 'kg',
  liter: 'liter',
  ml: 'ml',
  tangki: 'tangki',
};

export function isSatuanBahan(value: unknown): value is SatuanBahan {
  return typeof value === 'string' && (SATUAN_BAHAN as readonly string[]).includes(value);
}

// Batas atas takaran. Cerminan constraint `care_activities_produk_jumlah_check`
// (migrasi 043): produk_jumlah null ATAU (> 0 AND <= 100000).
//
// Wajib dijaga di klien, bukan cuma diserahkan ke database: pelanggaran
// constraint sampai ke klien sebagai "violates check constraint ...", dan
// isTechnicalMessage di serviceResult.ts mengubahnya jadi "Terjadi kendala saat
// memproses data. Periksa input lalu coba lagi." — kalimat yang tidak
// memberitahu apa pun tentang angka yang kebesaran.
export const MAX_TAKARAN_BAHAN = 100000;

// Batas jumlah angka di belakang koma TIDAK ada di sini. Angka itu properti
// kolom numeric(10,2), bukan properti takaran bahan — kolom berat panen punya
// skala yang sama tanpa ada hubungannya dengan bahan. Tempatnya sekarang
// MAX_ANGKA_DESIMAL di src/utils/decimalInput.ts.
