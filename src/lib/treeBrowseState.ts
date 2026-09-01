// Pencarian dan filter daftar pohon, ditahan di luar umur komponen.
//
// KENAPA MODUL, BUKAN CONTEXT. Yang dibutuhkan hanya "ingat dua nilai selama
// aplikasi hidup" — tidak ada satu pun konsumen yang perlu dirender ulang saat
// nilainya berubah dari tempat lain, karena satu-satunya penulis adalah layar
// yang sedang dipandang. Context akan menuntut Provider di kedua grup rute
// ((owner) dan (worker)) untuk keuntungan nol.
//
// KENAPA BUKAN SEKALI-PAKAI seperti pendingCareTrees.ts dan dua sekerabatnya.
// Itu perbedaan yang paling penting di berkas ini, jadi ditulis terang-terangan:
// kotak-kotak titipan itu DIHAPUS setelah dibaca, karena isinya perintah untuk
// satu langkah navigasi. Yang di sini KEBALIKANNYA — nilainya harus bertahan
// justru supaya pengguna yang pergi ke denah, ke detail pohon, lalu kembali,
// menemukan pencarian dan filternya masih utuh. Tidak ada consume-nya, dan itu
// disengaja. Jangan menambahkannya.
//
// KETERBATASAN, sama dengan seluruh modul di folder ini: nilainya hidup di
// memori proses. Ia tidak selamat dari muat ulang aplikasi. Itu diterima —
// yang dijaga cuma kenyamanan satu sesi, bukan preferensi yang dijanjikan.
import type { GrowthPhase, Tree, TreeConditionStatus } from '../types/domain';

export type TreeAgeRange = 'lt_1' | '1_3' | 'gt_3';

// 'unrecorded' BUKAN nilai enum growth_phase, dan sengaja tidak dibuat
// seolah-olah begitu. Kolom trees.current_growth_phase memang nullable tanpa
// default (migrasi 003), jadi "belum dicatat" adalah keadaan yang benar-benar
// ada di data dan pantas bisa disaring. Menyandikannya sebagai anggota union di
// sisi klien membuat compiler yang menjaga agar ia tidak pernah ikut terkirim ke
// database sebagai nilai enum.
export type TreePhaseFilter = GrowthPhase | 'unrecorded';

export type TreeFilterCriteria = {
  ageRanges: TreeAgeRange[];
  conditions: TreeConditionStatus[];
  // Posisi yang SEDANG ditanami tapi varietasnya kosong. Rumusnya ada di
  // isMissingVariety() di bawah, satu-satunya tempat ia ditulis.
  //
  // Ini dulunya sebuah banner kuning di layar denah yang berbunyi "N pohon belum
  // ada varietas. Lengkapi supaya jadwal perawatan bisa dibuat." Kalimat itu
  // SALAH — penjaga di database adalah filter_trees_with_active_planting (057),
  // yang memeriksa siklus tanam aktif dan tidak pernah menyentuh varietas, jadi
  // pohon tanpa varietas tetap bisa dijadwalkan. Bannernya dicabut; yang
  // menggantikannya adalah sumbu filter ini, yang tidak menjanjikan apa-apa dan
  // benar-benar bisa menemukan pohonnya satu per satu.
  onlyMissingVariety: boolean;
  phases: TreePhaseFilter[];
};

export const DEFAULT_TREE_FILTER_CRITERIA: TreeFilterCriteria = {
  ageRanges: [],
  conditions: [],
  onlyMissingVariety: false,
  phases: [],
};

// Tampilan yang sedang dipandang di route pohon. Sejak daftar dan denah menyatu
// jadi SATU route, ini bukan lagi soal navigasi melainkan soal keadaan — dan
// keadaan itu harus selamat dari kepergian ke detail pohon dan kembali lagi.
export type TreeBrowseView = 'list' | 'map';

let browseSearch = '';
let browseCriteria: TreeFilterCriteria = DEFAULT_TREE_FILTER_CRITERIA;
let browseView: TreeBrowseView = 'list';
// false = sel padat (48px), true = sel besar (70px).
//
// Disimpan di sini, bukan sebagai useState di dalam peta, karena peta kini
// DILEPAS setiap kali pengguna bertukar ke Daftar — render kondisional yang
// benar-benar unmount, bukan display:none. Tanpa modul ini, kembali ke Denah
// selalu mengembalikan perbesaran ke keadaan awal.
//
// Yang TIDAK diselamatkan: posisi gulung petak. Itu diterima apa adanya — ia
// hidup di dalam kedua Animated.ScrollView yang sengaja dipasang ulang lewat
// key={cellSize}, dan mengakalinya berarti menyentuh satu-satunya mekanisme
// yang menjaga kepala baris/kolom tetap sinkron.
let mapZoom = false;

// Dibaca di FASE RENDER, di dalam penginisialisasi useState. Bukan di effect:
// effect jalan setelah commit, jadi render pertama akan melukis daftar dengan
// filter kosong lalu menggantinya sekejap kemudian — kedipan yang terlihat
// persis pada layar yang isinya paling banyak.
export function peekTreeBrowseSearch(): string {
  return browseSearch;
}

export function peekTreeBrowseCriteria(): TreeFilterCriteria {
  return browseCriteria;
}

export function peekTreeBrowseView(): TreeBrowseView {
  return browseView;
}

export function setTreeBrowseView(view: TreeBrowseView): void {
  browseView = view;
}

export function peekMapZoom(): boolean {
  return mapZoom;
}

export function setMapZoom(zoomedIn: boolean): void {
  mapZoom = zoomedIn;
}

export function setTreeBrowseSearch(value: string): void {
  browseSearch = value;
}

// Disalin, bukan disimpan apa adanya: pemanggilnya memegang state React yang
// bisa berubah setelah ini. Polanya sama dengan setPendingCareTrees.
export function setTreeBrowseCriteria(criteria: TreeFilterCriteria): void {
  browseCriteria = {
    ageRanges: [...criteria.ageRanges],
    conditions: [...criteria.conditions],
    onlyMissingVariety: criteria.onlyMissingVariety,
    phases: [...criteria.phases],
  };
}

// Dipanggil saat kebun aktif BERGANTI. Wajib: kondisi, fase, dan umur memang
// berlaku di kebun mana pun, tapi pencarian kode posisi tidak — "12-C" di kebun
// lama menyaring habis kebun baru yang cuma punya sembilan baris, dan pengguna
// melihat daftar kosong tanpa satu pun petunjuk kenapa.
//
// browseView dan mapZoom SENGAJA TIDAK ikut direset, dan itu bukan kelalaian.
// Keduanya bukan pernyataan tentang isi kebun melainkan tentang cara pengguna
// suka memandangnya — "saya lebih suka denah, diperbesar" tetap benar di kebun
// mana pun. Mengembalikan keduanya ke keadaan awal akan melempar pengguna
// kembali ke Daftar tanpa satu pun sebab yang bisa ia lihat.
export function resetTreeBrowseState(): void {
  browseSearch = '';
  browseCriteria = DEFAULT_TREE_FILTER_CRITERIA;
}

// ---------------------------------------------------------------------------
// Pencocokan
//
// KENAPA DI SINI, BUKAN DI MASING-MASING LAYAR. Tiga layar menyaring pohon
// dengan criteria yang sama: daftar pohon pemilik, daftar pohon pekerja, dan
// denah kebun. Selama fungsinya ditulis ulang di tiap layar, "sehat" bisa
// berarti tiga hal yang sedikit berbeda tanpa satu pun dari ketiganya salah
// secara mencolok — dan yang paling mudah menyimpang justru cabang yang paling
// jarang diuji, yaitu fase kosong dan varietas kosong.
//
// Modul ini sudah memiliki TIPE criteria-nya, jadi ia tempat yang benar untuk
// memiliki PREDIKAT-nya juga. Yang TIDAK pindah ke sini: pencarian teks. Ia
// hanya ada di layar daftar (denah tidak lagi punya kolom pencarian), dan
// bentuknya beda — ia mencocokkan teks bebas, bukan criteria.
// ---------------------------------------------------------------------------

// Satu-satunya tempat rumus "varietas belum diisi" ditulis.
//
// Syarat activePlanting bukan null adalah BAGIAN dari rumusnya, bukan
// kehati-hatian tambahan: posisi yang siklus tanamnya sudah ditutup memang tidak
// punya varietas untuk dilengkapi, dan menghitungnya akan membuat filter ini
// menawarkan pekerjaan yang tidak ada.
export function isMissingVariety(tree: Tree): boolean {
  return tree.activePlanting !== null && !tree.activePlanting.variety?.trim();
}

// Ada filter yang benar-benar mempersempit? Dipakai denah untuk memutuskan
// apakah ADA sel yang perlu diredupkan sama sekali — tanpa filter aktif, seluruh
// sel digambar normal dan tidak ada yang ditegaskan.
export function hasActiveTreeFilter(criteria: TreeFilterCriteria): boolean {
  return (
    criteria.ageRanges.length > 0 ||
    criteria.conditions.length > 0 ||
    criteria.phases.length > 0 ||
    criteria.onlyMissingVariety
  );
}

// Antar kelompok bersifat DAN, di dalam kelompok bersifat ATAU: memilih "Hama"
// dan "Berbunga" menyisakan pohon yang kena hama SEKALIGUS sedang berbunga,
// bukan gabungan keduanya.
export function matchesTreeCriteria(tree: Tree, criteria: TreeFilterCriteria): boolean {
  if (criteria.conditions.length > 0 && !criteria.conditions.includes(tree.currentCondition)) {
    return false;
  }

  // Fase kosong dipetakan ke 'unrecorded' SEBELUM dicocokkan, bukan ditangani
  // sebagai cabang terpisah. Dengan begitu "belum dicatat" jadi anggota biasa
  // dari sumbu yang sama dan tidak butuh aturan keduanya sendiri.
  if (criteria.phases.length > 0 && !criteria.phases.includes(tree.currentGrowthPhase ?? 'unrecorded')) {
    return false;
  }

  if (criteria.onlyMissingVariety && !isMissingVariety(tree)) {
    return false;
  }

  return matchesAgeRanges(tree, criteria.ageRanges);
}

function matchesAgeRanges(tree: Tree, ageRanges: TreeAgeRange[]): boolean {
  if (ageRanges.length === 0) {
    return true;
  }

  const ageYears = getTreeAgeYears(tree.activePlanting?.plantedAt);

  // Tanpa tanggal tanam, umurnya tidak diketahui — dan yang tidak diketahui
  // tidak boleh lolos filter umur. Ia bukan "umur nol".
  if (ageYears === null) {
    return false;
  }

  return ageRanges.some((range) => matchesSingleAgeRange(ageYears, range));
}

function matchesSingleAgeRange(ageYears: number, range: TreeAgeRange): boolean {
  if (range === 'lt_1') {
    return ageYears < 1;
  }

  if (range === '1_3') {
    return ageYears >= 1 && ageYears <= 3;
  }

  return ageYears > 3;
}

function getTreeAgeYears(plantedAt?: string | null): number | null {
  if (!plantedAt) {
    return null;
  }

  const plantedDate = new Date(plantedAt);

  if (Number.isNaN(plantedDate.getTime())) {
    return null;
  }

  return (Date.now() - plantedDate.getTime()) / 31_536_000_000;
}
