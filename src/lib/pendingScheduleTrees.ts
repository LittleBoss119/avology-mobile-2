// Pohon terpilih yang diserahkan peta denah ke layar Buat Jadwal.
//
// Modul-level, dibaca-lalu-dihapus, mengikuti pola src/lib/pendingFeedback.ts
// dan src/lib/pendingAccessRoute.ts — termasuk alasannya: "tanpa query param
// yang menumpuk instance rute".
//
// KENAPA BUKAN PARAMETER ROUTE. Di sini alasannya lebih keras daripada di dua
// modul itu. Pemilik boleh memilih SELURUH kebun sekaligus, dan 196 uuid adalah
// kira-kira 7.250 karakter. Sebagai parameter rute, string sepanjang itu ikut
// diserialisasi ke dalam state navigasi dan URL internal expo-router, dilewatkan
// setiap kali rutenya dihitung ulang, dan ikut terbawa saat state navigasi
// dipulihkan. Tidak ada satu pun dari itu yang dibutuhkan: yang menerima
// daftarnya adalah layar berikutnya, sekali, di proses yang sama.
//
// Lewat modul ini, yang berpindah cuma satu referensi array. Tidak ada batas
// panjang, tidak ada penyandian, tidak ada penguraian.
//
// KETERBATASAN, supaya tidak disalahpakai: nilainya hidup di memori proses.
// Ia TIDAK selamat dari muat ulang aplikasi maupun pemulihan state navigasi,
// jadi ia hanya sah untuk serah-terima satu langkah yang langsung menyusul
// navigasinya — persis seperti kedua modul sekerabatnya.
let pendingTreeIds: readonly string[] | null = null;

export function setPendingScheduleTrees(treeIds: readonly string[]): void {
  // Disalin, bukan disimpan apa adanya: pemanggilnya memegang state React yang
  // bisa berubah setelah ini, dan yang diserahkan harus himpunan pada saat
  // tombolnya ditekan.
  pendingTreeIds = [...treeIds];
}

// Dibaca saat render untuk menghitung nilai awal form. SENGAJA tidak menghapus,
// sama seperti peekPendingAccessRoute: penginisialisasi useState boleh dipanggil
// lebih dari sekali, dan versi yang menghapus akan mengosongkan pilihan pada
// pemanggilan kedua. Penghapusannya dilakukan terpisah lewat consume di bawah.
export function peekPendingScheduleTrees(): readonly string[] | null {
  return pendingTreeIds;
}

export function consumePendingScheduleTrees(): void {
  pendingTreeIds = null;
}
