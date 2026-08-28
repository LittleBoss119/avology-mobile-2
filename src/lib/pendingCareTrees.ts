// Pohon terpilih yang diserahkan peta denah ke layar Catat Perawatan.
//
// Sekerabat dengan pendingScheduleTrees.ts, pendingFeedback.ts, dan
// pendingAccessRoute.ts, dengan bentuk dan alasan yang sama: modul-level,
// dibaca-lalu-dihapus, "tanpa query param yang menumpuk instance rute", dan
// tanpa batas panjang untuk daftar yang bisa memuat seluruh kebun.
//
// KENAPA MODUL SENDIRI, BUKAN MENUMPANG pendingScheduleTrees.
//
// Keduanya kebetulan berisi bentuk data yang sama — sederet id pohon — dan itu
// satu-satunya kesamaannya. Tujuannya berbeda, dan kotak titipan yang dipakai
// dua tujuan akan menyerahkan isi yang salah persis pada keadaan yang paling
// sulit ditelusuri: pemilik menekan "Buat jadwal perawatan", membatalkannya
// dari layar jadwal, lalu menekan "Catat perawatan" dengan pilihan berbeda.
// Satu kotak berarti dua penulis dan dua pembaca yang tidak saling tahu.
//
// Taruhannya juga tidak sama. Salah menyerahkan daftar ke layar jadwal
// menghasilkan jadwal yang bisa dibatalkan; salah menyerahkannya ke layar ini
// menghasilkan baris care_activity_trees yang TIDAK PUNYA jalur hapus sama
// sekali. Pemisahan ini murah, dan yang dijaganya tidak bisa dikembalikan.
let pendingTreeIds: readonly string[] | null = null;

export function setPendingCareTrees(treeIds: readonly string[]): void {
  // Disalin, bukan disimpan apa adanya: pemanggilnya memegang state React yang
  // bisa berubah setelah ini, dan yang diserahkan harus himpunan pada saat
  // tombolnya ditekan.
  pendingTreeIds = [...treeIds];
}

// Dibaca saat render untuk menghitung isi awal daftar. SENGAJA tidak menghapus,
// sama seperti peekPendingAccessRoute dan peekPendingScheduleTrees:
// penginisialisasi useState boleh dipanggil lebih dari sekali, dan versi yang
// menghapus akan mengosongkan daftarnya pada pemanggilan kedua.
export function peekPendingCareTrees(): readonly string[] | null {
  return pendingTreeIds;
}

export function consumePendingCareTrees(): void {
  pendingTreeIds = null;
}
