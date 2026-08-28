// Posisi KOSONG terpilih yang diserahkan peta denah ke layar Tambah Pohon.
//
// Sekerabat dengan pendingScheduleTrees.ts dan pendingCareTrees.ts, dengan
// bentuk dan alasan yang sama: modul-level, dibaca-lalu-dihapus, "tanpa query
// param yang menumpuk instance rute", dan tanpa batas panjang untuk daftar yang
// bisa memuat seluruh kebun.
//
// KENAPA MODUL SENDIRI, DAN KENAPA INI YANG PALING TIDAK BOLEH DITUMPANGKAN.
//
// Kedua kotak sekerabatnya berisi UUID baris trees. Kotak ini berisi KODE
// POSISI ('12-C'), dan itu bukan varian dari hal yang sama melainkan hal yang
// berbeda: posisi kosong belum punya baris trees, jadi ia belum punya UUID
// sama sekali. Itulah seluruh sebab kotak ini ada.
//
// Keduanya sama-sama `string` di mata TypeScript. Kalau isinya menumpang salah
// satu kotak yang ada, kode posisi akan sampai di create_care_activity atau
// create_manual_schedule sebagai uuid[] — dan untuk jalur catat perawatan
// akibatnya permanen, karena care_activity_trees tidak punya jalur DELETE
// (025:67). Pemisahan ini yang membuat percampuran itu tidak punya jalan masuk.
//
// Arahnya juga kebalikan dari kedua kotak itu: mereka menyerahkan pohon yang
// SUDAH ADA untuk diberi perlakuan; kotak ini menyerahkan posisi yang BELUM ADA
// untuk dilahirkan. Salah serah di sini berarti baris trees di posisi yang
// salah — dan baris trees tidak bisa dihapus (prevent_tree_delete_trigger,
// 006:416) maupun dibebaskan dengan diarsipkan (trees_unique_code_per_farm
// bukan constraint partial, 054:248).
//
// KETERBATASAN, sama dengan kedua modul sekerabatnya: nilainya hidup di memori
// proses. Ia TIDAK selamat dari muat ulang aplikasi maupun pemulihan state
// navigasi, jadi ia hanya sah untuk serah-terima satu langkah yang langsung
// menyusul navigasinya.
let pendingPositionCodes: readonly string[] | null = null;

export function setPendingNewTreePositions(positionCodes: readonly string[]): void {
  // Disalin, bukan disimpan apa adanya: pemanggilnya memegang state React yang
  // bisa berubah setelah ini, dan yang diserahkan harus himpunan pada saat
  // tombolnya ditekan.
  pendingPositionCodes = [...positionCodes];
}

// Dibaca saat render untuk menghitung isi awal daftar. SENGAJA tidak menghapus,
// sama seperti peekPendingCareTrees dan peekPendingScheduleTrees:
// penginisialisasi useState boleh dipanggil lebih dari sekali, dan versi yang
// menghapus akan mengosongkan daftarnya pada pemanggilan kedua.
export function peekPendingNewTreePositions(): readonly string[] | null {
  return pendingPositionCodes;
}

export function consumePendingNewTreePositions(): void {
  pendingPositionCodes = null;
}
