import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Animated, BackHandler, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens } from '../constants/theme';
import { colors as palette, touch } from '../theme/tokens';
import { useAuth } from '../context/auth-context';
import { setPendingCareTrees } from '../lib/pendingCareTrees';
import { setPendingNewTreePositions } from '../lib/pendingNewTreePositions';
import { setPendingScheduleTrees } from '../lib/pendingScheduleTrees';
import {
  hasActiveTreeFilter,
  matchesTreeCriteria,
  peekMapZoom,
  peekTreeBrowseCriteria,
  setMapZoom,
  type TreeFilterCriteria,
} from '../lib/treeBrowseState';
import { getFarmDetail } from '../services/farmService';
import { getTrees } from '../services/treeService';
import type { Farm, Tree, TreeConditionStatus } from '../types/domain';
import { formatTreeCondition } from '../utils/displayFormat';
import { formatTreeDisplayCode } from '../utils/treeFormat';
import { fonts } from '../theme/tokens';
import { Icon, type IconName } from './icons';
import { Button, ErrorBanner, SkeletonBlock } from './ui';

// Peta denah kebun, baca-saja.
//
// BUKAN LAYAR, melainkan salah satu dari dua TAMPILAN di dalam route pohon.
// Induknya — app/(owner)/owner/trees/index.tsx dan kembarannya di sisi pekerja —
// yang memiliki header, tab Daftar/Denah, dan keputusan tampilan mana yang
// dirender.
// Komponen ini mulai langsung dari baris kontrolnya.
//
// KENAPA IA TIDAK BOLEH DIBUNGKUS <Screen>: Screen membungkus children-nya dalam
// satu ScrollView vertikal. Peta punya ScrollView-nya SENDIRI di kedua sumbu,
// dan menaruhnya di dalam ScrollView vertikal lain berarti dua penggulung
// vertikal berebut gestur yang sama — dan lebih buruk lagi, anak flex:1 di dalam
// ScrollView tidak pernah mendapat tinggi terbatas, jadi petaknya kolaps. Jadi
// komponen ini menyusun kerangkanya sendiri dari View flex:1 dan menerapkan
// padding tepi layar yang biasanya diberikan Screen. JANGAN membungkusnya
// belakangan, dan jangan menaruhnya di cabang yang memakai Screen.
//
// Pekerja dan pemilik memakai komponen yang SAMA, dengan TEPAT SATU cabang
// peran: tombol "Pilih" hanya untuk pemilik. Selebihnya — peta, filter,
// keterangan — identik untuk keduanya; komponen ini masih nol aksi tulis.
//
// DATANYA TETAP MILIKNYA SENDIRI. Ia memanggil getFarmDetail dan getTrees, bukan
// menerima keduanya lewat prop. Itu disengaja: daftar dan denah butuh bentuk
// data yang berbeda — daftar butuh foto utama tiap pohon, denah butuh dimensi
// petak dan justru SENGAJA tidak mengambil foto — jadi satu sumber bersama akan
// memaksa salah satunya membayar permintaan yang tidak dipakainya.
//
// basePath dipakai untuk dua hal: merakit route detail pohon, dan membedakan
// peran. Keduanya mengikuti pola tree-care-activity-screen dan enam komponen
// sekerabatnya, yang juga membaca basePath sebagai penanda peran.
//
// ---------------------------------------------------------------------------
// APA YANG DICABUT DARI LAYAR INI, DAN KE MANA PERGINYA
//
// Kolom pencarian, deret chip filter aktif, dan lembar filter denah sudah tidak
// ada di sini. Ketiganya kembar dari kontrol yang sama di layar daftar pohon,
// dan dua salinan berarti pemilik yang menyaring di satu layar menemukan layar
// satunya masih memperlihatkan seluruh kebun. Sekarang filternya SATU, disimpan
// di src/lib/treeBrowseState.ts, disetel di layar daftar, dan dibaca di sini.
//
// Banner kuning "N pohon belum ada varietas" juga dicabut. Bukan karena
// menghemat tinggi, walau ia memang memakan sekitar 100px: KALIMATNYA SALAH. Ia
// berbunyi "Lengkapi supaya jadwal perawatan bisa dibuat", padahal penjaga di
// database adalah filter_trees_with_active_planting (migrasi 057) yang memeriksa
// SIKLUS TANAM AKTIF dan tidak pernah menyentuh varietas — pohon tanpa varietas
// selalu bisa dijadwalkan. Penggantinya sudah ada dan tidak menjanjikan apa pun:
// badge filter "Varietas belum diisi" di layar daftar.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Ukuran
//
// DUA TINGKAT PERBESARAN YANG MENJAWAB DUA PERTANYAAN BERBEDA, dan itu yang
// menentukan seluruh angka di bawah.
//
//   ZOOM JAUH  menjawab "bagaimana keadaan kebun saya".
//              Seluruh 234 posisi harus terlihat SEKALIGUS, tanpa gulir. Yang
//              dibaca bukan satu sel melainkan POLA — di sudut mana masalahnya
//              mengelompok. Sel karena itu tidak bertulisan dan tidak bertanda:
//              pada 16px tidak ada teks yang terbaca, dan glif yang tidak
//              terbaca cuma menjadi kotoran yang mengaburkan polanya.
//
//   ZOOM DEKAT menjawab "pohon yang mana".
//              Di sinilah kode posisi terbaca dan sel bisa ditekan.
//
// SEL ZOOM JAUH BUKAN TARGET SENTUH, DAN INI TIDAK BOLEH DIUBAH. 16px berada
// jauh di bawah ambang 48; ketukan yang mendarat di tetangganya lebih buruk
// daripada ketukan yang tidak terjadi, karena pemilik akan membuka pohon yang
// salah dan mempercayai apa yang dibacanya di sana. Jalan ke satu pohon selalu
// lewat perbesar dulu.
//
// ARITMETIKA "MUAT SATU LAYAR", kebun acuan 26 baris x 9 kolom. DIHITUNG,
// BUKAN DIUKUR DI PERANGKAT — angka di bawah berasal dari nilai token dan
// tinggi komponen yang dibaca dari kodenya, dan belum satu pun diuji di HP.
//
//   lebar  petak = 9 x 16 + 8 x 2 (celah) + 32 (gutter) + 40 (tepi layar) = 232
//   tinggi petak = 26 x 16 + 25 x 2 (celah) + 8 (ruang bawah)             = 474
//
//   chrome di atas petak:
//     paddingTop layar (22) + inset status bar (24)        =  46
//     judul "Pohon" 26, jumlah pohon rata kanan sebaris    =  30
//     jarak headerWrap                                     =  12
//     tab bergaris bawah (20 + 8 + garis 2)                =  30
//     paddingBottom tab                                    =   8
//     bar atas peta (48) + paddingBottom (12)              =  60
//     kepala kolom                                         =  24
//   chrome di bawah petak:
//     strip legenda, 2 baris item                          =  61
//     bottom tab                                           =  64
//                                                          -----
//                                                            335
//
// Tinggi layar yang dibutuhkan = 335 + 474 = 809.
//
// LEBARNYA TIDAK PERNAH JADI SYARAT: 232 muat di layar tersempit mana pun.
//
// PERJALANAN ANGKA INI. Sebelum tiga perbaikan lanjutan batch 4a, chrome-nya
// 379 dan ambangnya 853. Yang dikembalikan:
//
//   SegmentedControl berpil (46) -> tab bergaris bawah (30)   -16
//   paddingBottom pengalih 12 -> 8                             -4
//   tombol "Keterangan" dicabut                                 0  (bar tetap 48)
//   tombol zoom pindah ke bar atas                              0  (ia melayang)
//   judul + jumlah dilebur jadi satu baris (batch 4b)          -26
//                                                            ----
//                                                             -44
//
// Dua yang terakhir TIDAK mengembalikan tinggi sama sekali, dan itu memang
// bukan gunanya: yang pertama menghapus keterangan kedua atas satu gambar,
// yang kedua menghapus tombol yang menimpa sudut petak sekaligus tombol
// ikon-saja terakhir di aplikasi ini.
//
// ARTINYA: pada kebun acuan, 234 sel muat tanpa gulir di perangkat bertinggi
// logis 809 ke atas. Itu mencakup hampir seluruh HP yang beredar — Pixel 7
// (~892), iPhone 14 Pro (~852), dan iPhone SE generasi ketiga (~667) adalah
// pengecualiannya. Perangkat 800-812 KINI MUAT; yang masih perlu digulir
// tinggal layar di bawah 809, dan di sana gulirnya sekitar satu baris sel.
//
// GULIR ITU DITERIMA, dan selnya TIDAK dikecilkan di bawah 16. Pengguna yang
// jadi alasan seluruh aturan ini ada tidak bisa membaca sel yang lebih kecil,
// dan peta yang tidak terbaca jauh lebih mahal daripada gulir satu baris.
//
// KALAU SALAH SATU ANGKA DI ATAS DINAIKKAN, hitung ulang penjumlahannya —
// bukan "kira-kira masih muat".
//
// CELAH BERBEDA PER TINGKAT, dan itu bukan kesembronoan. Pada zoom dekat celah
// 4 memisahkan sel yang masing-masing bertulisan; pada zoom jauh celah 4 akan
// menghabiskan 100px tinggi untuk memisahkan kotak yang sudah terpisah oleh
// warnanya sendiri, dan 100px itulah beda antara muat dan tidak muat.
//
// ROW_HEADER_WIDTH dan COLUMN_HEADER_HEIGHT tidak punya token dan tidak
// selayaknya punya: keduanya ukuran gutter petak, bukan jarak yang berulang di
// layar lain. Ditulis sebagai konstanta bernama, dan dilaporkan apa adanya.
// ---------------------------------------------------------------------------

const CELL_SIZE_FAR = 16;
const CELL_SIZE_NEAR = 74;
const CELL_GAP_FAR = 2;
const CELL_GAP_NEAR = tokens.space.xs;
const ROW_HEADER_WIDTH = 32;
const COLUMN_HEADER_HEIGHT = 24;

// Lebar penyeimbang di sisi kanan bar mode pilih. Ia TIDAK punya isi dan itu
// memang tugasnya: ia satu-satunya yang membuat "N dipilih" duduk di tengah
// layar dan bukan di tengah sisa ruang setelah tombol Batal. Nilainya kira-kira
// selebar tombol kecil berlabel "Batal"; melesetnya beberapa piksel tidak
// merusak apa pun, tapi menghapusnya membuat angkanya menempel ke tombol.
const SELECT_BAR_BALANCE = 64;

// Ukuran glif sudut, sebagai pecahan dari sisi sel: 13px pada sel compact (48),
// 20px pada sel besar (70).
//
// NAIK dari 0.22 (11px) sejak tanda sudut berubah dari bangun geometri jadi glif
// bergaris. Bangun padat seperti segitiga atau kotak masih terbaca pada 11px
// karena seluruh bidangnya berwarna; glif bergaris tidak — yang terbaca hanya
// goresannya, dan pada 11px celah antar goresan turun di bawah satu piksel.
//
// TIDAK menyentuh tata letak petak. Glifnya position:absolute di dalam sel yang
// ber-overflow hidden, jadi ia tidak bisa menggeser satu piksel pun jarak antar
// sel — syarat mutlak, karena kepala baris dan kolom yang beku bersandar pada
// jarak itu.
const MARK_SIZE_RATIO = 0.28;

// Tebal goresan glif sel, dalam satuan viewBox 24. Lebih tebal dari
// tokens.icon.stroke (2) karena glif ini dibaca pada 13px di bawah matahari,
// bukan pada 20px di dalam ruangan. Lihat catatan prop strokeWidth di icons.tsx.
const CELL_GLYPH_STROKE = 2.6;

// Sel yang tidak cocok filter diredupkan, TIDAK disembunyikan: yang dicari orang
// bukan cuma "pohonnya mana", tapi "pohonnya di sudut mana kebun", dan itu
// hilang begitu tetangganya lenyap.
//
// Angka, bukan warna — jadi tidak ada token yang dilanggar dan tidak ada warna
// baru yang lahir. Sistem token di repo ini memang belum punya skala opasitas;
// nilainya dilaporkan apa adanya, sama seperti ketiga ukuran di atas.
const DIMMED_OPACITY = 0.32;

// Tebal tepi sel yang COCOK. Lebar dan tinggi sel di RN sudah termasuk border
// (border-box), jadi menaikkannya dari 1 ke 2 TIDAK menggeser satu piksel pun
// tata letak petak — syarat mutlak, karena kepala baris dan kolom yang beku
// bersandar pada jarak antar sel yang tetap.
const CELL_BORDER_WIDTH = 1;
const MATCHED_CELL_BORDER_WIDTH = 2;

// 'A' ada di posisi 65 tabel ASCII. Perhitungan yang sama dipakai
// validate_tree_position() di migrasi 054, dan sengaja ditulis dengan cara yang
// sama supaya keduanya terbaca sebagai aturan yang satu.
const COLUMN_LETTER_OFFSET = 64;

function columnLetter(columnNumber: number): string {
  return String.fromCharCode(COLUMN_LETTER_OFFSET + columnNumber);
}

function columnNumberOf(columnPosition: string | null | undefined): number {
  const letter = columnPosition?.trim().toUpperCase();

  if (!letter || letter.length !== 1) {
    return 0;
  }

  const columnNumber = letter.charCodeAt(0) - COLUMN_LETTER_OFFSET;

  return columnNumber >= 1 && columnNumber <= 26 ? columnNumber : 0;
}

// Urutan tampil kanonis strip legenda. Ini daftar NILAI, bukan daftar label —
// labelnya tetap milik formatTreeCondition di utils/displayFormat.ts, dan peta
// tidak boleh jadi daftar label keenam di repo ini.
const CONDITION_ORDER = [
  'healthy',
  'needs_attention',
  'pest_attacked',
  'disease_indicated',
  'damaged',
  'dead',
] as const satisfies readonly TreeConditionStatus[];

// ---------------------------------------------------------------------------
// Rupa sel menurut kondisi
//
// Record atas SELURUH nilai enum, bukan objek biasa — kalau tree_condition_status
// bertambah nilai, berkas ini gagal typecheck alih-alih diam-diam merender sel
// tanpa warna.
//
// Ini pemetaan RUPA, bukan daftar label. Labelnya tetap milik formatTreeCondition
// di utils/displayFormat.ts; tidak ada satu pun teks kondisi yang ditulis di
// berkas ini.
//
// SATU GLIF PER KONDISI — dan itu perubahan dari keadaan sebelumnya, jadi
// alasannya ditulis penuh.
//
// Sebelum ini hama, penyakit, dan rusak berbagi SATU tanda segitiga, dengan
// alasan bahwa membedakan ketiganya lewat bentuk mustahil di kotak 48px tanpa
// membuat ketiganya sama-sama tidak terbaca. Alasan itu benar untuk bangun
// geometri polos — segitiga, kotak, dan kotak-bersilang memang kehabisan
// perbedaan yang bisa dibaca. Ia TIDAK benar untuk glif bergambar: serangga,
// daun berbercak, dan ranting patah punya siluet yang berbeda jauh sebelum
// detailnya terbaca, dan siluet itulah yang dipindai mata pada ukuran kecil.
//
// Yang membuat penyatuan itu mahal: di sel petak TIDAK ADA TEKS yang
// membedakan ketiganya. Di baris daftar pohon ada — label kondisi tertulis di
// sebelah ikonnya — jadi di sana ikon yang sama masih boleh dipakai bertiga.
// Di sini ikon adalah satu-satunya pembeda selain warna, dan warna ketiganya
// memang sengaja sama.
//
// Bentuknya berbeda satu sama lain, bukan hanya warnanya. Aplikasi ini dipakai
// orang yang mungkin sulit membedakan hijau dan merah, jadi warna tidak boleh
// jadi satu-satunya pembawa pesan. Latar sel TETAP berwarna kondisi seperti
// sebelumnya — glif adalah saluran KEDUA, bukan pengganti warna.
// ---------------------------------------------------------------------------

type ConditionVisual = {
  background: string;
  border: string;
  markColor: string;
  // null berarti sel tidak diberi tanda apa pun. Hanya 'healthy'.
  markIcon: IconName | null;
  // Garis diagonal melintasi SELURUH sel. Hanya untuk 'dead'.
  struckThrough: boolean;
  text: string;
};

const CONDITION_VISUALS: Record<TreeConditionStatus, ConditionVisual> = {
  // Sehat sengaja TIDAK diberi tanda apa pun. Ini mayoritas pohon; membiarkannya
  // polos adalah inti desain ini, karena yang menyimpanglah yang harus menonjol.
  //
  // Ia juga yang menjaga ongkos glif tetap murah: sel tanpa markIcon tidak
  // merender satu pun <Svg>. Lihat catatan CellGlyph di bawah.
  //
  // LATARNYA neutralCell, BUKAN surface.card (batch 4a). Aturan "sehat tidak
  // diberi warna" TIDAK dilanggar oleh ini: neutralCell bukan warna status, ia
  // isian NETRAL — token yang sama yang dipakai segmen sehat pada bilah
  // proporsi, dua bentuk untuk hal yang sama.
  //
  // Yang diperbaiki: selama sehat berlatar surfaceRaised (#FFFDFA), sel sehat
  // dan POSISI KOSONG hanya berbeda oleh garis putus-putusnya — dan pada zoom
  // jauh 16px garis itu tidak terbaca sama sekali, sehingga kebun yang setengah
  // kosong tampak seperti kebun yang penuh. Bidang netral yang benar-benar
  // BIDANG adalah satu-satunya yang membedakan "ada pohonnya" dari "tidak ada
  // apa-apa" pada ukuran itu.
  //
  // text tetap textPrimary: #211D18 di atas #8F8676 berkontras 4,67:1 dan lolos
  // AA. JANGAN menukarnya ke textOnAccent/putih — putih di atas neutralCell
  // hanya 3,5:1 dan gagal.
  healthy: {
    background: palette.neutralCell,
    border: palette.neutralCell,
    markColor: tokens.color.text.tertiary,
    markIcon: null,
    struckThrough: false,
    text: tokens.color.text.primary,
  },
  needs_attention: {
    background: tokens.color.status.warning.bg,
    border: tokens.color.status.warning.border,
    markColor: tokens.color.status.warning.text,
    markIcon: 'alert-triangle',
    struckThrough: false,
    text: tokens.color.text.primary,
  },
  // Ketiganya berbagi WARNA danger — itu memang benar, ketiganya sama-sama
  // masalah yang menuntut kunjungan — tapi tidak lagi berbagi glif.
  pest_attacked: {
    background: tokens.color.status.danger.bg,
    border: tokens.color.status.danger.border,
    markColor: tokens.color.status.danger.text,
    markIcon: 'cell-insect',
    struckThrough: false,
    text: tokens.color.text.primary,
  },
  disease_indicated: {
    background: tokens.color.status.danger.bg,
    border: tokens.color.status.danger.border,
    markColor: tokens.color.status.danger.text,
    markIcon: 'cell-leaf-spot',
    struckThrough: false,
    text: tokens.color.text.primary,
  },
  damaged: {
    background: tokens.color.status.danger.bg,
    border: tokens.color.status.danger.border,
    markColor: tokens.color.status.danger.text,
    markIcon: 'cell-broken-twig',
    struckThrough: false,
    text: tokens.color.text.primary,
  },
  // Garis coretnya DIPERTAHANKAN di samping glif silang. Keduanya tidak
  // berlebihan: silang di sudut menyatakan "kondisi: mati", garis melintas
  // menyatakan "sel ini sudah selesai" dan terbaca dari jarak pandang yang lebih
  // jauh — pada petak 234 sel, itu yang membuat blok mati terlihat sebagai blok.
  dead: {
    background: tokens.color.status.neutral.bg,
    border: tokens.color.status.neutral.border,
    markColor: tokens.color.status.neutral.text,
    markIcon: 'x',
    struckThrough: true,
    text: tokens.color.status.neutral.text,
  },
};

// ---------------------------------------------------------------------------
// TANDA FASE DICABUT SELURUHNYA DARI SEL DENAH.
//
// Aturan spek berbunyi: warna sel mewakili kondisi pohon, SATU HAL SAJA. Tanda
// fase di pojok kanan atas memang memakai saluran yang berbeda dari warna isian
// — glif, bukan rona — tapi ia tetap menambahkan dimensi kedua pada benda yang
// sama. Sel yang menjawab dua pertanyaan sekaligus memaksa pembacanya memilih
// pertanyaan mana yang sedang ia tanyakan, tiap kali, untuk 234 sel.
//
// Denah menjawab satu pertanyaan: POHON MANA YANG BERMASALAH. Fase punya
// layarnya sendiri (#17, batch 7), dan sampai layar itu ada, fase tetap terbaca
// di baris daftar pohon dan di detail tiap pohon.
//
// Yang ikut terbawa pergi: PHASE_ORDER, PhaseVisual, NO_PHASE_MARK,
// PHASE_VISUALS, PHASE_LEGEND_DESCRIPTIONS, dan sebutan fase di label pembaca
// layar tiap sel. Tidak ada satu pun yang disisakan "untuk berjaga-jaga" —
// tabel rupa yang tidak dirender siapa pun adalah tabel yang akan menyimpang
// dari kenyataan tanpa ada yang tahu.
//
// Ketiga glif fase di icons.tsx (cell-flower, cell-fruit, cell-fruit-seed)
// TIDAK dihapus: menghapus entri dari IconName adalah pencabutan API bersama,
// dan layar fase di batch 7 kemungkinan besar memakainya lagi.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Glif sudut
//
// SATU pintu untuk kedua sudut — kondisi maupun fase — supaya tebal goresan dan
// ukuran tidak bisa berbeda antara keduanya.
//
// ONGKOSNYA, dan kenapa ia diterima. Catatan lama di tempat ini berbunyi: semua
// tanda adalah View biasa, BUKAN SVG, karena satu <Svg> membawa satu simpul
// rasterisasi tersendiri dan peta bisa memuat ratusan sel bertanda. Itu masih
// benar, dan pindah ke <Icon> memang membayarnya. Yang membuatnya sepadan:
//
//   * Sel SEHAT dan fase tenang tidak merender apa pun (markIcon/icon null).
//     Menurut desain layar ini, itu keadaan MAYORITAS — kebun yang sehat
//     membayar nol.
//   * Yang dibeli bukan kerapian melainkan informasi yang sebelumnya tidak ada:
//     hama, penyakit, dan rusak dulu tidak bisa dibedakan di peta sama sekali.
//
// Batas atasnya jujur: kebun 234 posisi yang seluruhnya bermasalah SEKALIGUS
// berbuah merender 468 <Svg>. Itu keadaan yang tidak pernah terjadi di kebun
// sungguhan, tapi ia bukan nol, dan kalau peta kelak terasa berat di ponsel
// kelas bawah, DI SINI tempat pertama yang harus dicurigai.
// ---------------------------------------------------------------------------

function CellGlyph({ color, name, size }: { color: string; name: IconName; size: number }) {
  return <Icon color={color} name={name} size={size} strokeWidth={CELL_GLYPH_STROKE} />;
}

// Tanda "terpilih": centang putih di dalam bulatan berwarna merek.
//
// Centangnya SATU View, bukan ikon SVG. Sebuah "L" — hanya tepi kanan dan tepi
// bawah yang digambar — yang diputar 45 derajat memang berbentuk centang. Ini
// penting bukan karena kerapian: pemilik boleh memilih SELURUH kebun, dan pada
// 196 sel terpilih setiap <Svg> tambahan adalah satu simpul rasterisasi lagi.
// Tanda ini justru yang paling banyak muncul sekaligus, jadi ia TIDAK ikut
// pindah ke <Icon> bersama glif sudut.
//
// Bulatannya perlu karena latar sel berubah-ubah — putih, kuning, merah muda,
// abu — dan centang tanpa alas akan hilang di salah satu dari empat itu.
//
// BENTUK, bukan warna, yang menyatakan "terpilih". Tepi penegas menyertainya
// sebagai saluran kedua.
function SelectedMark({ size }: { size: number }) {
  const strokeThickness = Math.max(2, Math.round(size / 8));

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: palette.accent,
        borderRadius: tokens.radius.pill,
        height: size,
        justifyContent: 'center',
        width: size,
      }}
    >
      <View
        style={{
          borderBottomColor: tokens.color.brand.on,
          borderBottomWidth: strokeThickness,
          borderRightColor: tokens.color.brand.on,
          borderRightWidth: strokeThickness,
          height: Math.round(size * 0.46),
          // Digeser sedikit ke atas: memutar 45 derajat menurunkan titik berat
          // bentuknya, dan tanpa koreksi ini centangnya duduk terlalu rendah di
          // dalam bulatan.
          marginTop: -Math.round(size * 0.08),
          transform: [{ rotate: '45deg' }],
          width: Math.round(size * 0.24),
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Satu sel
// ---------------------------------------------------------------------------

// Posisi yang TIDAK punya baris trees: belum pernah ditanami. Kodenya tetap
// dicetak — supaya posisi kosong pun bisa disebutkan lewat telepon.
//
// DI LUAR MODE PILIH IA TETAP TIDAK MENANGGAPI TEKANAN: tidak ada pohon untuk
// dibuka. Yang berubah hanya selama mode pilih, tempat ia menjadi calon anggota
// himpunan "tambah pohon". Mekanismenya SAMA PERSIS dengan FilledMapCell —
// prop `selectable` yang menutup `disabled` — supaya tidak ada dua cara berbeda
// di berkas ini untuk menyatakan "sel ini tidak boleh ditekan sekarang".
//
// SUDUTNYA TAJAM, DAN ITU BUKAN SELERA. Android menggambar borderStyle 'dashed'
// sebagai garis PENUH begitu borderRadius lebih dari nol — terbukti di
// perangkat, bukan dugaan. Akibatnya sel kosong dan sel sehat hanya berbeda
// nuansa latar, dan di kebun yang hampir penuh membedakan posisi yang bisa
// ditanami ulang dari pohon sehat justru salah satu guna utama peta ini.
//
// borderRadius 0 memulihkan DUA pembeda sekaligus: sudut tajam melawan sudut
// membulat milik sel berisi, dan garis putus-putus yang akhirnya benar-benar
// tergambar. Yang pertama berlaku bahkan seandainya yang kedua tetap gagal.
//
// KARENA ITU "TERPILIH" DI SINI TIDAK BOLEH MENYENTUH RADIUS. Yang dipakai
// sebagai gantinya persis dua saluran yang sudah dipakai sel berisi, dan
// tidak satu pun dari keduanya menuntut sudut membulat:
//
//   BENTUK  — SelectedMark yang sama, di pojok yang sama (kanan bawah).
//   TEPI    — menebal ke MATCHED_CELL_BORDER_WIDTH dan berwarna merek, jalur
//             `emphasized` yang sudah ada untuk sel yang cocok filter.
//
// Latarnya SENGAJA tidak ikut berubah. Mengganti canvas dengan brand.soft akan
// membuat sel kosong terlihat berisi — persis yang dilarang catatan
// "penegasan tidak boleh mengubah sel kosong jadi terlihat berisi" di bawah.
function EmptyMapCell({
  cellSize,
  code,
  dimmed = false,
  matched = false,
  onPress,
  selectable = false,
  selected = false,
  showCode = true,
}: {
  cellSize: number;
  code: string;
  dimmed?: boolean;
  matched?: boolean;
  onPress?: () => void;
  /** false pada zoom jauh: 16px tidak memuat teks yang terbaca. */
  showCode?: boolean;
  // false di luar mode pilih, dan juga selama mode pilih kalau himpunan yang
  // sedang berjalan berisi pohon — lihat aturan homogen di selectionAllows().
  selectable?: boolean;
  selected?: boolean;
}) {
  const markInset = Math.round(cellSize * 0.09);
  const emphasized = matched || selected;

  return (
    <Pressable
      accessibilityLabel={`Posisi ${code}, belum ditanami`}
      accessibilityRole="button"
      accessibilityState={{ disabled: !selectable, selected }}
      disabled={!selectable}
      onPress={onPress}
      style={{
        alignItems: 'center',
        // TRANSPARAN, bukan surface.canvas (batch 4a). Keduanya tampak sama di
        // atas latar halaman, tapi artinya berbeda dan bedanya penting: posisi
        // kosong adalah KETIADAAN, bukan keadaan. Isian — walau isian yang
        // kebetulan sewarna latar — menyatakan "ada sesuatu di sini yang
        // warnanya begini", dan itu yang membuat sel kosong dulu terbaca
        // sebagai sel abu-abu terisi begitu latar halamannya berubah.
        backgroundColor: 'transparent',
        // emptyCellBorder, bukan line.card. line.card (#E2DCD2) di atas surface
        // berkontras 1,15:1 — garis yang secara praktis tidak ada, dan pada
        // petak inilah satu-satunya yang menandai posisi yang bisa ditanami.
        borderColor: emphasized ? palette.accent : palette.emptyCellBorder,
        borderRadius: 0,
        // Tetap putus-putus walau sedang cocok atau terpilih: penegasan tidak
        // boleh mengubah sel kosong jadi terlihat berisi.
        borderStyle: 'dashed',
        borderWidth: emphasized ? MATCHED_CELL_BORDER_WIDTH : CELL_BORDER_WIDTH,
        height: cellSize,
        justifyContent: 'center',
        opacity: dimmed ? DIMMED_OPACITY : 1,
        width: cellSize,
      }}
    >
      {/* Kode TIDAK dicetak pada zoom jauh. Pada 16px tidak ada ukuran huruf
          yang terbaca, dan teks yang tidak terbaca bukan netral — ia noda yang
          mengaburkan pola yang justru jadi seluruh guna tingkat ini. */}
      {showCode ? (
        <Text
          selectable={false}
          numberOfLines={1}
          style={{
            color: tokens.color.text.tertiary,
            fontSize: cellCodeFontSize(cellSize),
            fontWeight: '400',
          }}
        >
          {code}
        </Text>
      ) : null}

      {/* Pojok yang SAMA dengan sel berisi. Tidak perlu overflow:'hidden' di
          sini seperti di FilledMapCell — tanpa lengkung, tidak ada yang bisa
          menyembul keluar sudut.

          Pada zoom jauh centang ini tidak pernah dirender, karena mode pilih
          sendiri hanya hidup di zoom dekat — lihat penjaga di layar. */}
      {selected ? (
        <View pointerEvents="none" style={{ bottom: markInset, position: 'absolute', right: markInset }}>
          <SelectedMark size={Math.round(cellSize * 0.3)} />
        </View>
      ) : null}
    </Pressable>
  );
}

// Posisi yang PUNYA baris trees. Termasuk posisi yang siklus tanamnya sudah
// ditutup: itu bukan sel kosong. Posisinya pernah dan masih dikenal kebun,
// kondisi terakhirnya masih fakta tersimpan, dan riwayatnya masih bisa dibuka —
// jadi ia digambar penuh dan tetap bisa ditekan.
function FilledMapCell({
  cellSize,
  detailed = true,
  dimmed = false,
  matched = false,
  onPress,
  selectable = true,
  selected = false,
  tree,
}: {
  cellSize: number;
  /**
   * false pada ZOOM JAUH. Mematikan kode posisi, kedua glif sudut, dan garis
   * coret sekaligus — bukan tiga penjaga terpisah, karena ketiganya gagal oleh
   * sebab yang sama: pada 16px goresan glif turun di bawah satu piksel dan
   * huruf tidak terbaca sama sekali.
   *
   * Yang TERSISA pada zoom jauh adalah warna isian dan tepinya, dan itu
   * cukup — tingkat ini dibaca sebagai pola, bukan sebagai sel per sel.
   */
  detailed?: boolean;
  // Diredupkan karena tidak cocok filter. TETAP bisa ditekan — meredupkan adalah
  // menurunkan penonjolan, bukan menonaktifkan.
  dimmed?: boolean;
  matched?: boolean;
  onPress: () => void;
  // false HANYA selama mode pilih, untuk posisi tanpa siklus tanam aktif.
  // Di luar mode pilih setiap sel berisi selalu bisa ditekan untuk dibuka.
  selectable?: boolean;
  selected?: boolean;
  tree: Tree;
}) {
  const visual = CONDITION_VISUALS[tree.currentCondition];
  const markSize = Math.round(cellSize * MARK_SIZE_RATIO);
  const markInset = Math.round(cellSize * 0.09);
  // Panjang diagonal sebuah bujur sangkar adalah sisinya dikali akar dua. Tanpa
  // ini, palang selebar sel yang diputar 45 derajat berhenti jauh sebelum sudut.
  const strikeLength = Math.round(cellSize * 1.42);
  // Terpilih maupun cocok sama-sama memakai tepi penegas. Itu disengaja: pada
  // sel yang kedua-duanya, satu tepi memang cukup, dan yang membedakan
  // "terpilih" dari sekadar "cocok" adalah centangnya — bentuk, bukan warna.
  const emphasized = matched || selected;

  return (
    <Pressable
      accessibilityLabel={describeCell(tree)}
      accessibilityRole="button"
      accessibilityState={{ disabled: !selectable, selected }}
      // Posisi tanpa siklus tanam aktif TIDAK MENANGGAPI tekanan selama mode
      // pilih. Bukan kosmetik: create_manual_schedule menolaknya di database,
      // dan penyaringan saat himpunan DIPILIH adalah keputusan yang dikunci
      // migrasi 058. Di layar ini, "saat dipilih" berarti di sini.
      disabled={!selectable}
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: visual.background,
        borderColor: emphasized ? palette.accent : visual.border,
        borderCurve: 'continuous',
        borderWidth: emphasized ? MATCHED_CELL_BORDER_WIDTH : CELL_BORDER_WIDTH,
        // tileFar (3) pada zoom jauh: lihat catatan token di theme/tokens.ts.
        borderRadius: detailed ? tokens.radius.tile : tokens.radius.tileFar,
        height: cellSize,
        justifyContent: 'center',
        opacity: dimmed ? DIMMED_OPACITY : 1,
        // Menjaga garis coret dan tanda sudut tetap di dalam lengkung sel.
        overflow: 'hidden',
        width: cellSize,
      }}
    >
      {detailed && visual.struckThrough ? (
        <View
          pointerEvents="none"
          style={{
            backgroundColor: visual.markColor,
            height: 1,
            position: 'absolute',
            transform: [{ rotate: '-45deg' }],
            width: strikeLength,
          }}
        />
      ) : null}

      {detailed ? (
        <Text
          selectable={false}
          numberOfLines={1}
          style={{
            color: visual.text,
            // 17/600 lewat keluarga huruf, bukan fontWeight — Android tidak
            // mensintesis berat untuk font kustom. Naik dari 14/700: kode
            // posisi adalah satu-satunya teks di sel, dibaca di kebun, dan sel
            // 74px punya ruang untuknya.
            fontFamily: fonts.sansSemiBold,
            fontSize: cellCodeFontSize(cellSize),
          }}
        >
          {formatTreeDisplayCode(tree)}
        </Text>
      ) : null}

      {/* Pembungkus posisi hanya dibuat kalau memang ada tanda yang dipasang.
          Bukan penghematan spekulatif: sel SEHAT adalah keadaan MAYORITAS
          menurut desain layar ini, dan tanpa penjaga ini setiap sel polos tetap
          menyeret satu View kosong yang tidak menggambar apa pun. Sejak
          tandanya jadi <Icon>, penjaga ini juga yang menahan jumlah simpul
          <Svg> tetap nol untuk kebun yang sehat.

          SATU pojok yang tersisa, turun dari dua: tanda fase di pojok kanan
          atas dicabut seluruhnya. Lihat catatan di atas. */}
      {!detailed || visual.markIcon === null ? null : (
        <View pointerEvents="none" style={{ left: markInset, position: 'absolute', top: markInset }}>
          <CellGlyph color={visual.markColor} name={visual.markIcon} size={markSize} />
        </View>
      )}

      {/* Pojok KANAN BAWAH: dua pojok atas sudah dipegang kondisi dan fase, dan
          centang yang menimpa salah satunya akan menyembunyikan keterangan yang
          justru dibutuhkan pemilik saat memutuskan pohon mana yang dijadwalkan. */}
      {selected ? (
        <View pointerEvents="none" style={{ bottom: markInset, position: 'absolute', right: markInset }}>
          <SelectedMark size={Math.round(cellSize * 0.3)} />
        </View>
      ) : null}
    </Pressable>
  );
}

// 17 pada zoom dekat. Cabang keduanya tinggal jaring pengaman: teks hanya
// dirender saat detailed === true, yang hanya benar pada zoom dekat.
function cellCodeFontSize(cellSize: number): number {
  return cellSize >= CELL_SIZE_NEAR ? tokens.type.subheading.fontSize : tokens.type.caption.fontSize;
}

// Kalimat untuk pembaca layar. Dirangkai dari formatter yang sudah ada, bukan
// dari daftar label baru.
// FASE TIDAK DISEBUT, sejalan dengan selnya yang tidak lagi menggambarkannya.
// Label pembaca layar yang menyebutkan hal yang tidak ada di layar membuat dua
// orang yang memandang sel yang sama menerima keterangan yang berbeda — dan
// yang memakai pembaca layar tidak punya cara memeriksa mana yang benar.
function describeCell(tree: Tree): string {
  return `Posisi ${formatTreeDisplayCode(tree)}, ${formatTreeCondition(tree.currentCondition)}`;
}

// ---------------------------------------------------------------------------
// Filter
//
// MEREDUPKAN, tidak menyembunyikan. Peta ini menjawab "di sebelah mana", bukan
// "yang mana". Sel yang tidak cocok dibuang berarti membuang jawaban atas
// pertanyaan yang justru dibawa orang ke layar ini.
//
// Seluruhnya dihitung di memori dari data yang sudah dimuat. Nol permintaan
// jaringan tambahan.
//
// CRITERIA-nya BUKAN MILIK LAYAR INI. Ia dibaca dari treeBrowseState, disetel di
// layar daftar pohon, dan denah tidak pernah menulisnya. Itu yang membuat kedua
// tampilan tidak bisa memperlihatkan himpunan yang berbeda untuk pertanyaan yang
// sama — dan pencocokannya pun fungsi yang SAMA (matchesTreeCriteria), bukan
// salinan yang kebetulan berbunyi mirip.
//
// KEEMPAT SUMBU berlaku di sini, termasuk fase 'awal tanam' dan 'vegetatif' yang
// TIDAK punya tanda di sel. Catatan lama menolak keduanya dengan alasan "filter
// yang hasilnya tidak bisa dibaca lebih buruk daripada filter yang tidak ada".
// Alasan itu berlaku ketika satu-satunya isyarat adalah tanda sudut; sejak sel
// yang cocok mendapat TEPI PENEGAS dan yang tidak cocok diredupkan, hasilnya
// terbaca dari sel itu sendiri tanpa perlu tanda. Sama untuk umur dan varietas
// kosong, yang memang tidak pernah punya tanda.
// ---------------------------------------------------------------------------

// Sel kosong tidak punya kondisi, fase, umur, maupun varietas, jadi ia TIDAK
// BISA memenuhi filter apa pun — begitu ada satu filter aktif, ia ikut
// diredupkan. Tanpa filter aktif, tidak ada yang diredupkan sama sekali.
function isCellMatched(tree: Tree | undefined, criteria: TreeFilterCriteria): boolean {
  return tree ? matchesTreeCriteria(tree, criteria) : false;
}

// ---------------------------------------------------------------------------
// Kepala baris dan kolom
// ---------------------------------------------------------------------------

function AxisLabel({ height, label, width }: { height: number; label: string; width: number }) {
  return (
    <View style={{ alignItems: 'center', height, justifyContent: 'center', width }}>
      <Text
        selectable={false}
        numberOfLines={1}
        style={{
          color: tokens.color.text.secondary,
          fontSize: tokens.type.caption.fontSize,
          fontWeight: tokens.type.caption.fontWeight,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// KETERANGAN: SATU BENTUK, bukan dua.
//
// Lembar "Keterangan peta" DICABUT SELURUHNYA, beserta tombol yang membukanya,
// LegendRow, LegendSwatch, LegendGroupTitle, LegendCell, dan kedua tabel
// deskripsinya.
//
// Alasannya bukan penghematan tinggi — lembar itu melayang di atas peta dan
// tidak menempati satu piksel pun tata letak. Alasannya DUA TEMPAT UNTUK SATU
// INFORMASI: strip di bawah peta sudah memajang petak warna, nama kondisi, dan
// jumlahnya per kondisi, yaitu persis isi yang akan dibacakan lembar itu. Dua
// keterangan atas satu gambar adalah dua keterangan yang akan menyimpang —
// dan yang satunya, karena harus dibuka dulu, adalah yang paling jarang
// diperiksa saat rupa selnya berubah.
//
// Yang HILANG bersamanya, dan itu diterima dengan sadar: kalimat penjelas tiap
// tanda ("Serangga di pojok kiri atas, latar merah muda"), dan daftar kondisi
// yang TIDAK sedang ada di kebun ini. Yang pertama menjelaskan gambar yang
// sudah ada di depan mata; yang kedua menjawab "apa saja yang mungkin", dan
// itu pertanyaan yang tidak dibawa siapa pun ke layar ini.
//
// Adendum §4.1 menyebut "tombol Pilih di samping Keterangan". Itu deskripsi
// tata letak saat itu ditulis, bukan keharusan bahwa Keterangan ada.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Strip legenda yang MELEKAT di bawah peta
//
// Menjawab "yang di layar saya ini apa", pertanyaan yang jauh lebih sering
// daripada "apa saja yang mungkin" — dan yang selama ini menuntut membuka
// lembar penuh yang justru menutupi peta yang sedang dibaca.
//
// ATURAN YANG MENGIKAT: isinya dihitung dari SEL YANG DIGAMBAR, bukan dari
// daftar pohon dan bukan dari ringkasan mana pun. Kondisi yang tidak muncul di
// peta tidak muncul di strip; kondisi yang muncul satu kali muncul dengan
// angka 1. Kalau keduanya boleh berbeda, strip berhenti jadi keterangan dan
// jadi klaim tersendiri yang harus dipercaya begitu saja.
//
// Penghitungannya hidup di `buildLegendCounts` di bawah, yang menyusuri petak
// yang sama persis — rowNumbers x columnNumbers — yang dipakai merendernya.
//
// POSISI KOSONG IKUT DIHITUNG, dan ia bukan kondisi ketujuh. Ia baris
// tersendiri di ujung, karena "berapa yang masih bisa ditanami" adalah
// pertanyaan yang orang bawa ke peta ini sama seringnya dengan "berapa yang
// bermasalah".
// ---------------------------------------------------------------------------

type LegendCount = {
  condition: TreeConditionStatus;
  count: number;
};

function buildLegendCounts(
  rowNumbers: number[],
  columnNumbers: number[],
  treeByPosition: Map<string, Tree>
): { counts: LegendCount[]; emptyCount: number } {
  const tally = new Map<TreeConditionStatus, number>();
  let emptyCount = 0;

  for (const rowNumber of rowNumbers) {
    for (const columnNumber of columnNumbers) {
      const tree = treeByPosition.get(`${rowNumber}-${columnLetter(columnNumber)}`);

      if (!tree) {
        emptyCount += 1;
        continue;
      }

      tally.set(tree.currentCondition, (tally.get(tree.currentCondition) ?? 0) + 1);
    }
  }

  // Urutan CONDITION_ORDER, bukan urutan kemunculan maupun urutan besar-kecil.
  // Strip ini dibaca berulang kali oleh orang yang sama; daftar yang berubah
  // urutan tiap kali kebunnya berubah harus dibaca ulang dari awal tiap kali.
  return {
    counts: CONDITION_ORDER.filter((condition) => (tally.get(condition) ?? 0) > 0).map(
      (condition) => ({ condition, count: tally.get(condition) ?? 0 })
    ),
    emptyCount,
  };
}

// TANPA tombol "Keterangan lengkap" di dalam strip, dan itu bukan kelalaian:
// bar atas sudah punya tombol "Keterangan" yang membuka lembar yang sama, dan
// dua pintu ke satu lembar di layar yang sama membuat pembacanya berhenti
// menimbang mana yang benar.
//
// Yang dibeli dengan pencabutan itu TINGGI, dan tinggi adalah mata uang layar
// ini: 44px (tombol + jarak) adalah selisih antara 234 sel yang muat satu layar
// dan 234 sel yang menuntut digulung. Lihat aritmetika di kepala berkas.
function MapLegendStrip({
  counts,
  emptyCount,
}: {
  counts: LegendCount[];
  emptyCount: number;
}) {
  return (
    <View
      style={{
        borderTopColor: palette.borderStrong,
        borderTopWidth: 1,
        gap: tokens.space.sm,
        paddingHorizontal: tokens.layout.screenX,
        paddingTop: tokens.space.md,
      }}
    >
      {/* Membungkus ke bawah, bukan menggulung ke samping. Gulungan mendatar
          menyembunyikan sebagian keterangan di luar layar, dan keterangan yang
          harus dicari dulu bukan lagi keterangan. Paling banyak tujuh baris
          (enam kondisi + posisi kosong), dan itu muat dua baris di layar
          tersempit. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.md }}>
        {counts.map(({ condition, count }) => (
          <LegendStripItem
            key={condition}
            count={count}
            label={formatTreeCondition(condition)}
            swatch={<LegendStripSwatch condition={condition} />}
          />
        ))}
        {emptyCount > 0 ? (
          <LegendStripItem
            count={emptyCount}
            label="Kosong"
            swatch={
              <View
                style={{
                  // Bentuknya sama persis dengan sel kosong di peta: tanpa
                  // isian, sudut tajam, garis putus-putus. Swatch yang tidak
                  // menyerupai benda yang diterangkannya adalah keterangan
                  // tentang sesuatu yang lain.
                  backgroundColor: 'transparent',
                  borderColor: palette.emptyCellBorder,
                  borderRadius: 0,
                  borderStyle: 'dashed',
                  borderWidth: 1,
                  height: LEGEND_STRIP_SWATCH,
                  width: LEGEND_STRIP_SWATCH,
                }}
              />
            }
          />
        ) : null}
      </View>

    </View>
  );
}

const LEGEND_STRIP_SWATCH = 14;

function LegendStripSwatch({ condition }: { condition: TreeConditionStatus }) {
  const visual = CONDITION_VISUALS[condition];

  return (
    <View
      style={{
        backgroundColor: visual.background,
        borderColor: visual.border,
        borderRadius: tokens.radius.tileFar,
        borderWidth: 1,
        height: LEGEND_STRIP_SWATCH,
        width: LEGEND_STRIP_SWATCH,
      }}
    />
  );
}

function LegendStripItem({
  count,
  label,
  swatch,
}: {
  count: number;
  label: string;
  swatch: React.ReactNode;
}) {
  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: tokens.space.xs }}>
      {swatch}
      <Text selectable style={{ color: tokens.color.text.secondary, ...tokens.type.meta }}>
        {`${label} ${count}`}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Pemberitahuan "tidak ada yang cocok"
//
// Peta TETAP digambar di bawahnya. Menggantinya dengan layar kosong akan
// membuang satu-satunya hal yang masih berguna saat filter meleset: gambaran
// kebun itu sendiri.
//
// TANPA TOMBOL, tidak seperti sebelumnya. Layar ini tidak lagi memiliki
// filternya — ia hanya membacanya — jadi tombol "hapus filter" di sini akan
// mengubah keadaan yang dimiliki layar lain. Yang menggantikannya kalimat yang
// menyebutkan di mana filternya bisa diubah.
// ---------------------------------------------------------------------------

function NoMatchNotice() {
  return (
    <View
      style={{
        backgroundColor: tokens.color.surface.subtle,
        borderColor: tokens.color.line.card,
        borderCurve: 'continuous',
        borderRadius: tokens.radius.cardInner,
        borderWidth: 1,
        padding: tokens.space.md,
      }}
    >
      <Text selectable style={{ color: tokens.color.text.secondary, ...tokens.type.bodySmall }}>
        Tidak ada posisi yang cocok dengan filter yang sedang aktif. Ubah filternya di tab Daftar.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// TOMBOL PERBESARAN MELAYANG DICABUT.
//
// Ia diganti tombol berlabel teks di bar atas — "Perbesar" saat sedang jauh,
// "Perkecil" saat sedang dekat. Dua masalah selesai sekaligus:
//
//   1. Ia MENIMPA SUDUT PETAK. Melayang di pojok kiri bawah dengan latar solid,
//      ia menutupi sel-sel di baris terakhir kolom pertama — dan pada zoom jauh,
//      tempat seluruh kebun justru sedang dipandang sekaligus, yang tertutup
//      itu sudut kebun yang nyata.
//   2. Ia SATU-SATUNYA TOMBOL IKON-SAJA yang tersisa di aplikasi ini. Catatan
//      lama di tempat ini membelanya sebagai "pengecualian sadar" dengan dua
//      alasan yang masih benar — salah tekan tidak merusak apa pun, dan kaca
//      pembesar adalah glif konvensional. Tapi pembelaan itu berdiri di atas
//      anggapan bahwa tidak ada tempat untuk teksnya. Begitu tombol
//      "Keterangan" dicabut, tempat itu ada.
//
// Labelnya menyebut APA YANG AKAN TERJADI, bukan tingkat yang sedang berlaku —
// sama dengan accessibilityLabel yang dulu dibawa tombol ikon itu.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Himpunan pilihan
//
// DUA JENIS ANGGOTA YANG TIDAK BISA DICAMPUR, dan alasannya bukan kerapian:
//
//   pohon bersiklus aktif   dikenali UUID baris trees
//   posisi belum ditanami   dikenali KODE POSISI ('12-C'), karena barisnya
//                           memang belum ada dan karenanya tidak punya UUID
//
// Keduanya kebetulan `string`. Kalau himpunannya tetap satu Set<string>, tidak
// ada satu pun hal di sisi tipe yang mencegah kode posisi ikut terserah ke
// setPendingScheduleTrees / setPendingCareTrees, yang meneruskannya ke RPC
// bertipe uuid[]. Yang sampai di database bukan galat tipe melainkan galat
// runtime Postgres, dan untuk jalur "Catat perawatan" akibatnya permanen:
// care_activity_trees tidak punya jalur hapus sama sekali (025:67).
//
// KARENA ITU JENISNYA DIBAWA OLEH TIPE, BUKAN OLEH PEMERIKSAAN. Union
// bertanda di bawah tidak punya satu pun field yang bisa memuat keduanya:
// varian 'tree' hanya punya treeIds, varian 'position' hanya punya
// positionCodes. Untuk membaca UUID, pemanggil WAJIB menyempitkan ke
// kind === 'tree' lebih dulu, dan di cabang itu positionCodes tidak ada.
// Percampuran tidak bisa terjadi karena tidak ada tempat untuk menampungnya.
//
// 'none' adalah keadaan awal DAN keadaan setelah anggota terakhir dibatalkan.
// Ia bukan "himpunan pohon yang kebetulan kosong": justru karena ia jenisnya
// sendiri, kedua jenis sel boleh dipilih lagi tanpa satu pun cabang khusus.
// ---------------------------------------------------------------------------

type MapSelection =
  | { kind: 'none' }
  | { kind: 'tree'; treeIds: ReadonlySet<string> }
  | { kind: 'position'; positionCodes: ReadonlySet<string> };

// Himpunan pohon yang SUDAH tersempitkan. Kedua fungsi serah-terima di layar
// bawah menerima tipe ini, bukan array telanjang -- itu yang membuat
// penyerahan kode posisi ke kotak titipan uuid[] ditolak compiler, bukan
// dicegah kebiasaan.
type TreeSelection = Extract<MapSelection, { kind: 'tree' }>;

// Kembarannya untuk posisi kosong. Serah-terimanya menuju kotak titipan yang
// berisi KODE POSISI, dan penyempitan ini yang menutup arah sebaliknya: UUID
// pohon tidak assignable ke sini.
type PositionSelection = Extract<MapSelection, { kind: 'position' }>;

const NO_SELECTION: MapSelection = { kind: 'none' };

function selectionSize(selection: MapSelection): number {
  if (selection.kind === 'tree') {
    return selection.treeIds.size;
  }

  if (selection.kind === 'position') {
    return selection.positionCodes.size;
  }

  return 0;
}

// ATURAN HIMPUNAN HOMOGEN, satu tempat, satu kalimat.
//
// Ketukan pertama menentukan jenis himpunan untuk sisa sesi mode pilih itu.
// Selama himpunannya 'none', kedua jenis boleh dipilih.
function selectionAllows(selection: MapSelection, kind: 'tree' | 'position'): boolean {
  return selection.kind === 'none' || selection.kind === kind;
}

// Menambah/membuang satu anggota. Membuang anggota TERAKHIR mengembalikan
// himpunan ke 'none', dan itu yang membuka kembali kedua jenis sel tanpa
// tombol "ganti jenis" yang harus dijelaskan ke pengguna.
function toggleSelectionMember(
  selection: MapSelection,
  kind: 'tree' | 'position',
  value: string
): MapSelection {
  const current =
    selection.kind === 'tree'
      ? selection.treeIds
      : selection.kind === 'position'
        ? selection.positionCodes
        : null;

  // Penjaga terakhir kalau pemanggil melewatkan selectionAllows. Sel yang
  // jenisnya salah memang sudah `disabled`, jadi baris ini tidak seharusnya
  // pernah tercapai -- tapi kalau ia tercapai, mendiamkannya jauh lebih baik
  // daripada melahirkan himpunan campuran.
  if (current !== null && selection.kind !== kind) {
    return selection;
  }

  const next = new Set(current ?? []);

  if (!next.delete(value)) {
    next.add(value);
  }

  if (next.size === 0) {
    return NO_SELECTION;
  }

  return kind === 'tree' ? { kind: 'tree', treeIds: next } : { kind: 'position', positionCodes: next };
}

// ---------------------------------------------------------------------------
// Panel tindakan mode pilih
//
// Sibling TERAKHIR di kolom layar, bukan lapisan position:absolute. Dengan
// begitu petak di atasnya menyusut sendiri (flex:1) alih-alih tertutup panel,
// dan baris paling bawah kebun tidak pernah tersembunyi di belakangnya.
//
// Inset bawah diterapkan di sini karena layar ini tidak memakai <Screen>, jadi
// tidak ada siapa pun lain yang mengurusnya.
//
// TOMBOLNYA MENGIKUTI JENIS HIMPUNAN. Cabangnya dibaca dari selection.kind,
// bukan dari sebuah flag terpisah: dengan begitu tidak ada keadaan di mana
// tombol "Buat jadwal perawatan" muncul di atas himpunan kode posisi.
// ---------------------------------------------------------------------------

// PANEL SETINGGI ISINYA, di ketiga keadaan (pasca-batch 7):
//
//   nol terpilih           -> hanya kalimat petunjuk
//   posisi kosong terpilih -> satu tombol
//   pohon terpilih         -> dua tombol
//
// PENCADANGAN TINGGI TETAP DICABUT. Ia sempat dipasang dengan alasan yang masuk
// akal — petak tidak boleh bergeser tepat saat jari menyentuh sel pertama —
// tapi di perangkat ia menghasilkan dua masalah yang lebih besar daripada
// pergeseran yang dicegahnya: ruang kosong besar di bawah satu baris kalimat
// saat nol sel terpilih, dan ruang setinggi dua tombol di bawah SATU tombol
// saat yang terpilih posisi kosong. Pergeseran kecil saat beralih keadaan
// diterima sebagai harganya.
function SelectionActionPanel({
  onAddTrees,
  onCreateSchedule,
  onRecordCare,
  selection,
}: {
  onAddTrees: () => void;
  onCreateSchedule: () => void;
  onRecordCare: () => void;
  // 'none' IKUT diterima: panel dirender sejak mode pilih menyala, dan pada
  // keadaan itu isinya kalimat petunjuk.
  selection: MapSelection;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        // Latar halaman + garis atas borderStrong, sama dengan bar aksi di
        // <Screen> dan bottom tab sejak batch 3. Layar ini tidak memakai
        // <Screen>, jadi bar aksinya dirakit di sini — tapi ia harus terbaca
        // sebagai benda yang sama dengan bar aksi di layar lain.
        backgroundColor: tokens.color.surface.canvas,
        borderTopColor: palette.borderStrong,
        borderTopWidth: 1,
        paddingBottom: Math.max(insets.bottom, tokens.space.md),
        paddingHorizontal: tokens.layout.screenX,
        paddingTop: tokens.space.md,
      }}
    >
      {/* Tinggi mengikuti isi — lihat catatan di atas fungsi ini. */}
      <View style={{ gap: tokens.space.sm }}>
        {selection.kind === 'none' ? (
          // Satu-satunya yang memberi tahu bahwa PADA KEADAAN INI kedua jenis
          // sel boleh ditekan — begitu sel pertama dipilih, jenis yang
          // berlawanan diredupkan dan tidak bisa ditekan lagi.
          <Text selectable style={{ color: tokens.color.text.secondary, ...tokens.type.bodySmall }}>
            Pilih pohon, atau pilih posisi kosong.
          </Text>
        ) : selection.kind === 'position' ? (
          // Label spek: "Tambah pohon di sini". "Di sini" benar — sel yang
          // dimaksud sedang bertanda centang di layar yang sama.
          <Button onPress={onAddTrees} title="Tambah pohon di sini" variant="primary" />
        ) : (
          <>
            <Button onPress={onCreateSchedule} title="Buat jadwal" variant="primary" />
            {/* Menjadwalkan lebih dulu, mencatat di bawahnya. Urutannya
                disengaja: menjadwalkan bisa dibatalkan, mencatat tidak — dan
                tindakan yang tidak bisa ditarik kembali tidak pantas jadi
                tombol pertama yang disenggol ibu jari. */}
            <Button onPress={onRecordCare} title="Catat perawatan" variant="secondary" />
          </>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Kerangka memuat
//
// MENGGANTIKAN <LoadingState>, dan bukan demi kerapian. Bertukar Daftar/Denah
// benar-benar MELEPAS cabang yang ditinggalkan, jadi selama peta memuat, layar
// sebelumnya menampilkan satu pemutar di tengah yang tidak berbentuk seperti
// apa pun — dan itulah lag yang dikeluhkan. Bukan kecepatannya yang berubah di
// sini; yang berubah adalah apakah selama detik itu layarnya terlihat sedang
// bekerja atau terlihat membeku.
//
// Bentuknya meniru petak yang akan datang, termasuk gutter dan kepala kolom,
// dan ia ikut TINGKAT PERBESARAN yang sedang berlaku — kerangka bersel besar
// yang digantikan petak bersel kecil melompat justru lebih keras daripada tanpa
// kerangka sama sekali.
//
// Jumlah barisnya dipatok, bukan dibaca dari ukuran kebun: ukuran kebun datang
// bersama getFarmDetail, yaitu permintaan yang sedang ditunggu kerangka ini.
// ---------------------------------------------------------------------------

const SKELETON_ROWS_NEAR = 5;
const SKELETON_ROWS_FAR = 18;
const SKELETON_COLUMNS = 9;

function MapSkeleton({ zoomedIn }: { zoomedIn: boolean }) {
  const cellSize = zoomedIn ? CELL_SIZE_NEAR : CELL_SIZE_FAR;
  const cellGap = zoomedIn ? CELL_GAP_NEAR : CELL_GAP_FAR;
  const rows = zoomedIn ? SKELETON_ROWS_NEAR : SKELETON_ROWS_FAR;

  return (
    <View
      accessible
      accessibilityLabel="Memuat denah kebun"
      accessibilityRole="progressbar"
      style={{
        backgroundColor: tokens.color.surface.canvas,
        flex: 1,
        gap: tokens.space.md,
        paddingHorizontal: tokens.layout.screenX,
        paddingTop: tokens.space.sm,
      }}
    >
      {/* Baris kontrol: satu bidang selebar tombol "Keterangan". */}
      <SkeletonBlock height={tokens.layout.rowMinHeight} width="38%" />

      <View style={{ flexDirection: 'row', gap: cellGap }}>
        {/* Sudut tempat kedua kepala bertemu — kosong di petak sungguhan, dan
            kosong di sini juga. */}
        <View style={{ width: ROW_HEADER_WIDTH }} />
        <View style={{ flexDirection: 'row', gap: cellGap }}>
          {Array.from({ length: SKELETON_COLUMNS }, (_unused, index) => (
            <SkeletonBlock key={index} height={COLUMN_HEADER_HEIGHT} width={cellSize} />
          ))}
        </View>
      </View>

      <View style={{ gap: cellGap }}>
        {Array.from({ length: rows }, (_unused, rowIndex) => (
          <View key={rowIndex} style={{ flexDirection: 'row', gap: cellGap }}>
            <SkeletonBlock height={cellSize} width={ROW_HEADER_WIDTH} />
            {Array.from({ length: SKELETON_COLUMNS }, (_unused2, columnIndex) => (
              <SkeletonBlock
                key={columnIndex}
                height={cellSize}
                radius={zoomedIn ? tokens.radius.tile : tokens.radius.tileFar}
                width={cellSize}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Layar
// ---------------------------------------------------------------------------

export function FarmMapScreen({
  basePath,
  onTreeCountChange,
}: {
  basePath: '/owner/trees' | '/worker/trees';
  /**
   * Dilaporkan ke route induk supaya judul layar "Pohon" bisa membawa jumlahnya
   * tanpa induk memuat data sendiri.
   *
   * Peta memang SUDAH memanggil getTrees untuk dirinya sendiri; ini hanya
   * meneruskan panjang daftar yang sudah ada. Tidak ada permintaan tambahan,
   * dan daftar pohon melaporkan angka yang sama lewat prop yang sama namanya —
   * jadi judulnya tidak berubah saat pengguna bertukar tab.
   */
  onTreeCountChange?: (count: number) => void;
}) {
  const { currentFarm } = useAuth();
  // Perbesaran DIPULIHKAN dari modul di fase render, bukan dimulai dari nilai
  // tetap. Peta ini dilepas setiap kali pengguna bertukar ke Daftar, jadi tanpa
  // pemulihan ini setiap kepulangan mengembalikannya ke sel padat.
  const [zoomedIn, setZoomedIn] = React.useState(peekMapZoom);
  // Filter DIBACA di fase render, di dalam penginisialisasi useState — bukan di
  // effect. Kalau dibaca di effect, petak dilukis sekali tanpa peredupan lalu
  // dilukis ulang dengan peredupan satu frame kemudian, dan pada 234 sel
  // kedipannya terlihat jelas.
  //
  // SEKALI, bukan berlangganan. Layar ini tidak pernah menulis criteria, dan
  // satu-satunya jalan mengubahnya adalah pergi ke tab Daftar — yang berarti
  // meninggalkan layar ini. useFocusEffect di bawah membacanya lagi saat
  // kembali, jadi perubahan dari sana selalu terbawa.
  const [criteria, setCriteria] = React.useState<TreeFilterCriteria>(peekTreeBrowseCriteria);
  const [error, setError] = React.useState<string | null>(null);
  const [farm, setFarm] = React.useState<Farm | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selectMode, setSelectMode] = React.useState(false);
  const [selection, setSelection] = React.useState<MapSelection>(NO_SELECTION);
  const [trees, setTrees] = React.useState<Tree[]>([]);

  const farmId = currentFarm?.farmId;
  const cellSize = zoomedIn ? CELL_SIZE_NEAR : CELL_SIZE_FAR;
  const cellGap = zoomedIn ? CELL_GAP_NEAR : CELL_GAP_FAR;
  const isOwner = basePath === '/owner/trees';
  const selectionCount = selectionSize(selection);

  const load = React.useCallback(async () => {
    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setFarm(null);
      setTrees([]);
      return;
    }

    setError(null);

    // Dimensi kebun dan daftar posisi diambil berbarengan: keduanya tidak saling
    // bergantung, dan peta tidak bisa digambar tanpa dua-duanya.
    //
    // SENGAJA TIDAK memanggil listTreeMainPhotosForFarm. Fungsi itu membuat satu
    // permintaan storage per pohon berfoto, dan di kebun 234 posisi itu berarti
    // ratusan permintaan sekaligus. Peta tidak menampilkan foto di sel.
    const [farmResult, treesResult] = await Promise.all([
      getFarmDetail(farmId),
      // archived: false, sama dengan seluruh pemanggil getTrees lain. Sejak UI
      // arsip dicabut tidak ada lagi jalan membuat baris berarsip baru dari
      // aplikasi; yang lama tetap tidak terbawa ke peta, dan itu memang yang
      // diinginkan — posisinya toh masih terhitung terisi oleh
      // create_trees_at_positions (062), jadi ia tidak bisa ditanami ulang.
      getTrees({ archived: false, farmId }),
    ]);

    if (farmResult.error) {
      setError(farmResult.error.message);
      setFarm(null);
      setTrees([]);
      return;
    }

    if (treesResult.error) {
      setError(treesResult.error.message);
      setFarm(null);
      setTrees([]);
      return;
    }

    setFarm(farmResult.data);
    setTrees(treesResult.data);
    onTreeCountChange?.(treesResult.data.length);
    // onTreeCountChange sengaja TIDAK jadi dependensi: induk mengopernya
    // sebagai fungsi baru tiap render, dan memasukkannya ke sini akan membuat
    // load() berubah identitas tiap render — yang berarti useFocusEffect
    // memuat ulang seluruh peta tanpa henti.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId]);

  useFocusEffect(
    React.useCallback(() => {
      // Setiap kali peta kembali dipandang, mode pilih padam dan tandanya
      // bersih. Ini yang memenuhi "jangan tinggalkan pilihan menggantung"
      // setelah pemilik kembali dari layar jadwal — dan ia berlaku baik saat ia
      // menyimpan jadwalnya maupun saat ia menekan kembali tanpa menyimpan.
      //
      // Ditaruh bersama pemuatan ulang dengan sengaja: data pohon baru saja
      // diambil ulang, jadi himpunan id lama bisa saja memuat posisi yang
      // siklusnya sudah ditutup orang lain. Membuangnya lebih jujur daripada
      // menyimpan pilihan yang belum tentu masih sah.
      setSelectMode(false);
      setSelection(NO_SELECTION);

      // Filter ikut dibaca ulang di sini, dan ini SATU-SATUNYA jalan perubahan
      // dari tab Daftar sampai ke peta. Cukup karena mengubah filter menuntut
      // meninggalkan layar ini, jadi tidak ada perubahan yang bisa terjadi
      // selagi peta dipandang.
      setCriteria(peekTreeBrowseCriteria());

      load().finally(() => setLoading(false));
    }, [load])
  );

  // TOMBOL KEMBALI PERANGKAT MEMBATALKAN MODE PILIH.
  //
  // Bug yang diperbaiki di batch 4a: tanpa langganan ini, menekan kembali saat
  // mode pilih aktif akan mem-pop route pohon dari tumpukan — dan karena tab
  // root adalah entri paling bawah, Android menutup aplikasinya. Pemilik yang
  // sudah memilih dua puluh sel kehilangan seluruhnya beserta aplikasinya.
  //
  // useFocusEffect, BUKAN useEffect, dan itu wajib: BackHandler memanggil
  // listener dari yang TERAKHIR mendaftar lalu berhenti pada `true` pertama.
  // Dengan useEffect, peta ini tetap terlanggan saat tertutup layar detail
  // pohon atau layar buat jadwal di atasnya, dan akan menelan tombol kembali
  // milik layar itu. Polanya sama persis dengan useUnsavedChangesGuard.
  //
  // Langganan hanya dipasang SAAT mode pilih menyala. Di luar mode itu tidak
  // ada yang perlu dicegat, dan listener yang selalu terpasang lalu selalu
  // mengembalikan false hanya menambah satu simpul di rantai untuk setiap
  // tekanan kembali di seluruh aplikasi.
  //
  // Mengembalikan `true` berarti "sudah ditangani": navigasi tidak diteruskan.
  // Dengan selectMode padam, effect ini tidak terpasang sama sekali, jadi
  // tekanan berikutnya jatuh ke perilaku bawaan — itu yang membuat jalur
  // "kembali setelah menekan Batal" berperilaku seperti tanpa mode pilih.
  useFocusEffect(
    React.useCallback(() => {
      if (!selectMode) {
        return;
      }

      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        // exitSelectMode, bukan sekadar setSelectMode(false): keluar dari mode
        // pilih SELALU mengosongkan tandanya. Berlaku sama untuk nol sel
        // terpilih maupun dua puluh — tidak ada cabang yang membedakan
        // keduanya, jadi tidak ada cabang yang bisa salah.
        exitSelectMode();
        return true;
      });

      return () => subscription.remove();
      // exitSelectMode stabil sepanjang umur komponen (hanya memanggil dua
      // setter), jadi tidak perlu ikut dependensi.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectMode])
  );

  // Pohon menurut posisinya. Kuncinya dirakit dari row_position dan
  // column_position, BUKAN dari tree_code, supaya sisi kiri dan sisi kanan
  // pencocokan berasal dari sumber yang sama. tree_code tetap yang DICETAK di
  // sel — ia nilai resmi dari database.
  const treeByPosition = React.useMemo(() => {
    const map = new Map<string, Tree>();

    for (const tree of trees) {
      map.set(`${tree.rowPosition}-${tree.columnPosition}`, tree);
    }

    return map;
  }, [trees]);

  // UKURAN PETAK YANG DIGAMBAR: yang terbesar antara ukuran kebun dan posisi
  // pohon yang benar-benar ada.
  //
  // Bukan kehati-hatian berlebihan. Ukuran kebun bisa berubah lewat jalur di
  // luar aplikasi, dan trigger validate_tree_position hanya berbunyi saat baris
  // trees ditulis — bukan saat ukuran kebunnya berubah di bawahnya. Kalau peta
  // hanya menggambar grid_rows x grid_columns, pohon di luar rentang akan hilang
  // dari pandangan tanpa satu pun peringatan. Dengan aturan ini petaknya melebar
  // menampungnya, dan tidak ada satu pun galat yang perlu ditangani.
  const { columnCount, rowCount } = React.useMemo(() => {
    let rows = farm?.gridRows ?? 0;
    let columns = farm?.gridColumns ?? 0;

    for (const tree of trees) {
      rows = Math.max(rows, tree.rowPosition ?? 0);
      columns = Math.max(columns, columnNumberOf(tree.columnPosition));
    }

    return { columnCount: columns, rowCount: rows };
  }, [farm?.gridColumns, farm?.gridRows, trees]);

  const rowNumbers = React.useMemo(
    () => Array.from({ length: rowCount }, (_unused, index) => index + 1),
    [rowCount]
  );
  const columnNumbers = React.useMemo(
    () => Array.from({ length: columnCount }, (_unused, index) => index + 1),
    [columnCount]
  );

  // Dihitung dari petak yang DIGAMBAR — rowNumbers x columnNumbers, bukan dari
  // `trees` mentah. Bedanya nyata: kalau ukuran kebun disusutkan sementara
  // barisnya masih ada di database, pohon di luar rentang tetap digambar
  // (lihat aturan pelebaran petak di atas) dan karena itu HARUS ikut terhitung;
  // sebaliknya, tidak ada satu pun yang terhitung tanpa digambar.
  const legend = React.useMemo(
    () => buildLegendCounts(rowNumbers, columnNumbers, treeByPosition),
    [columnNumbers, rowNumbers, treeByPosition]
  );

  const filterActive = hasActiveTreeFilter(criteria);

  // Kode posisi yang COCOK, dihitung satu kali untuk seluruh petak.
  //
  // null berarti tidak ada filter aktif — dan itu keadaan yang berbeda dari
  // "himpunan kosong". null: jangan redupkan apa pun, jangan tegaskan apa pun.
  // Kosong: redupkan semuanya, karena memang tidak ada yang cocok.
  //
  // Satu lintasan menghasilkan DUA jawaban sekaligus: apakah tiap sel cocok
  // (lewat .has di bawah) dan berapa yang cocok (lewat .size). Menghitungnya
  // dua kali akan berarti dua kali menyusuri petak untuk pertanyaan yang sama.
  const matchedCodes = React.useMemo(() => {
    if (!filterActive) {
      return null;
    }

    const codes = new Set<string>();

    for (const rowNumber of rowNumbers) {
      for (const columnNumber of columnNumbers) {
        const code = `${rowNumber}-${columnLetter(columnNumber)}`;

        if (isCellMatched(treeByPosition.get(code), criteria)) {
          codes.add(code);
        }
      }
    }

    return codes;
  }, [columnNumbers, criteria, filterActive, rowNumbers, treeByPosition]);

  // SATU pintu untuk perbesaran: state React dan modul penyimpan ditulis
  // berbarengan, jadi tidak ada jalur yang mengubah salah satunya saja. Polanya
  // sama dengan applyCriteria di layar daftar.
  function toggleZoom() {
    const next = !zoomedIn;

    setZoomedIn(next);
    setMapZoom(next);
  }

  // Keluar dari mode pilih SELALU mengosongkan tanda. Pilihan yang bertahan
  // diam-diam di balik mode yang sudah padam adalah pilihan yang akan dipakai
  // orang tanpa melihatnya lagi.
  function exitSelectMode() {
    setSelectMode(false);
    setSelection(NO_SELECTION);
  }

  function toggleSelectedTree(treeId: string) {
    setSelection((current) => toggleSelectionMember(current, 'tree', treeId));
  }

  function toggleSelectedPosition(code: string) {
    setSelection((current) => toggleSelectionMember(current, 'position', code));
  }

  // Menyerahkan himpunan ke layar Buat Jadwal yang SUDAH ADA, lewat modul
  // serah-terima sekali-pakai. Peta tidak membuat jadwal sendiri dan tidak tahu
  // apa pun tentang care_schedule_trees.
  //
  // Mode pilih TIDAK dipadamkan di sini: memadamkannya sekarang membuat petak
  // di belakang berkedip kembali ke keadaan biasa selama animasi dorong layar.
  // Yang memadamkannya adalah useFocusEffect saat pemilik kembali.
  //
  // PARAMETERNYA TreeSelection, BUKAN array. Itu yang menutup jalur bagi kode
  // posisi masuk ke kotak titipan bertipe uuid[]: satu-satunya nilai yang bisa
  // dioper ke sini adalah himpunan yang sudah tersempitkan ke kind === 'tree',
  // dan himpunan kode posisi tidak assignable ke sana.
  function handleCreateSchedule(treeSelection: TreeSelection) {
    setPendingScheduleTrees([...treeSelection.treeIds]);
    router.push('/owner/schedules/create');
  }

  // Kotak titipan yang BERBEDA dari milik jadwal, walau isinya sebentuk. Dua
  // tujuan yang berbagi satu kotak akan menyerahkan daftar yang salah persis
  // saat pemilik membatalkan satu jalur lalu menempuh jalur lain — dan di sini
  // salah serah berarti tautan care_activity_trees yang permanen.
  //
  // Penjagaan tipe yang sama dengan handleCreateSchedule, dan di sini ia paling
  // penting: baris care_activity_trees tidak punya jalur hapus sama sekali.
  function handleRecordCare(treeSelection: TreeSelection) {
    setPendingCareTrees([...treeSelection.treeIds]);
    router.push('/owner/trees/record-care');
  }

  // Kotak titipan KETIGA, dan satu-satunya yang berisi KODE POSISI, bukan UUID.
  // Posisi kosong belum punya baris trees, jadi ia belum punya id — itu seluruh
  // sebab kotaknya terpisah.
  //
  // Parameternya PositionSelection, sepasang dengan kedua fungsi di atas: kalau
  // himpunan pohon dioper ke sini, compiler yang menolaknya, bukan pembaca kode
  // yang harus menyadarinya.
  function handleAddTrees(positionSelection: PositionSelection) {
    setPendingNewTreePositions([...positionSelection.positionCodes]);
    router.push('/owner/trees/add-trees');
  }

  // Posisi gulung kedua sumbu, dipakai untuk MENGGESER lapisan kepala.
  //
  // Dibuat ulang setiap kali cellSize berubah, dan penggulungnya ikut dipasang
  // ulang lewat `key` di bawah. Keduanya karena itu selalu mulai dari nol
  // bersamaan — kepala tidak mungkin tertinggal di koordinat lama saat petaknya
  // berganti ukuran. Harganya: perbesaran mengembalikan pandangan ke sudut kiri
  // atas. Itu ditukar dengan sesuatu yang tidak boleh gagal.
  const scroll = React.useMemo(
    () => {
      const x = new Animated.Value(0);
      const y = new Animated.Value(0);

      return {
        // useNativeDriver: true — INI intinya. Dengan begitu perpindahan kepala
        // dihitung di thread UI, sepenuhnya lepas dari thread JS. Lihat catatan
        // panjang di bawah pada penggulungnya.
        onScrollX: Animated.event([{ nativeEvent: { contentOffset: { x } } }], { useNativeDriver: true }),
        onScrollY: Animated.event([{ nativeEvent: { contentOffset: { y } } }], { useNativeDriver: true }),
        x,
        y,
      };
    },
    // cellSize TIDAK dibaca di dalam badan useMemo di atas, dan itu disengaja:
    // yang dibutuhkan bukan nilainya, melainkan identitas objek yang BARU setiap
    // kali ukuran sel berganti. Jangan "rapikan" dengan membuang dependensi ini
    // — tanpa dia, nilai Animated lama bertahan sementara penggulungnya dipasang
    // ulang dari nol, dan kepala baris/kolom langsung meleset.
    [cellSize]
  );

  if (loading) {
    return <MapSkeleton zoomedIn={zoomedIn} />;
  }

  return (
    <View style={{ backgroundColor: tokens.color.surface.canvas, flex: 1 }}>
      {/* TANPA TopAppBar dan tanpa tab Daftar/Denah. Keduanya milik route induk
          (app/(owner)/owner/trees/index.tsx dan kembarannya di sisi pekerja),
          yang merender header sekali di luar percabangan tampilan — jadi
          bertukar Daftar/Denah tidak lagi mengganti judul, memunculkan tombol
          back, atau merender ulang kepala layar.

          Komponen ini karena itu mulai LANGSUNG dari baris kontrolnya. Ia tetap
          memuat datanya sendiri (getFarmDetail + getTrees); yang pindah hanya
          chrome-nya, bukan tanggung jawabnya atas data. */}
      <View style={{ gap: tokens.space.sm, paddingBottom: tokens.space.md }}>
        {/* BAR ATAS BERGANTI TOTAL SAAT MODE PILIH MENYALA.

            Di luar mode pilih: "Perbesar"/"Perkecil" di kiri, "Pilih" di kanan.
            Di dalam mode pilih: "Batal" di kiri, "N dipilih" di tengah.

            Tombol "Keterangan" DICABUT: strip di bawah peta sudah memajang
            petak warna, nama, dan jumlah per kondisi. Lihat catatan panjang di
            tempat lembar keterangan dulu berdiri.

            Kenapa berganti, bukan menambah: mode pilih adalah MODE — sebuah
            keadaan yang mengubah arti setiap ketukan di layar ini, dan
            satu-satunya cara memberi tahu orang bahwa ia sedang berada di
            dalamnya adalah membuat layarnya terlihat berbeda. Bar yang hanya
            menukar label satu tombol dari "Pilih" jadi "Selesai" — bentuk
            sebelumnya — menyisakan layar yang nyaris identik dengan layar
            biasa, dan pemilik yang menekan sel mengharap detail pohon justru
            menambahkannya ke himpunan tanpa tahu.

            "Batal", bukan "Selesai". Keduanya sama-sama mengakhiri mode, tapi
            "Selesai" menjanjikan bahwa sesuatu akan DIKERJAKAN pada yang sudah
            dipilih — padahal yang mengerjakannya tombol di bar bawah. Kata
            yang menjanjikan hasil pada tombol yang membuang hasil adalah
            kesalahan yang baru ketahuan setelah pilihannya hilang.

            "N dipilih" di TENGAH, dan ia satu-satunya angka di layar ini. Ia
            di tengah supaya tidak terbaca sebagai label tombol Batal di
            sebelahnya. */}
        <View
          style={{
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
            // Tinggi dikunci supaya petak di bawahnya tidak bergeser satu
            // piksel pun saat bar berganti isi. Tanpa ini, baris "N dipilih"
            // yang lebih pendek dari tombol akan menaikkan seluruh petak tepat
            // pada saat pemilik sedang membidik sel berikutnya.
            minHeight: tokens.layout.rowMinHeight,
            paddingHorizontal: tokens.layout.screenX,
          }}
        >
          {selectMode ? (
            <>
              <Button onPress={exitSelectMode} size="small" title="Batal" variant="secondary" />
              <Text
                selectable={false}
                style={{ color: tokens.color.text.primary, ...tokens.type.bodyStrong }}
              >
                {`${selectionCount} dipilih`}
              </Text>
              {/* Penyeimbang kosong: tanpa dia, "N dipilih" duduk di tengah
                  SISA ruang setelah tombol Batal, bukan di tengah layar. Sama
                  persis dengan slot kanan kosong di TopAppBar. */}
              <View style={{ width: SELECT_BAR_BALANCE }} />
            </>
          ) : (
            <>
              {/* Zoom, BERLABEL TEKS. Labelnya menyebut apa yang AKAN terjadi
                  — "Perbesar" saat sedang di tingkat jauh — bukan tingkat yang
                  sedang berlaku. Tombol yang menamai keadaan sekarang menuntut
                  pembacanya menebak apakah menekannya akan mempertahankan
                  keadaan itu atau membalikkannya. */}
              <Button
                onPress={toggleZoom}
                size="small"
                title={zoomedIn ? 'Perkecil' : 'Perbesar'}
                variant="secondary"
              />

              {/* HANYA pemilik. Peta pekerja tetap baca-saja — keputusan yang
                  sudah diambil, jadi tombolnya tidak dirender sama sekali
                  alih-alih dirender lalu dinonaktifkan.

                  BERLABEL TEKS, dan tanpa tekan-lama. Tekan-lama tidak bisa
                  ditemukan siapa pun yang belum diberi tahu, dan di layar yang
                  digulung dua arah dengan jari mendarat di atas sel ia salah
                  picu setiap kali orang menggulung pelan. Tombol ini SATU-
                  SATUNYA jalan masuk ke mode pilih.

                  DITAMPILKAN DI KEDUA TINGKAT PERBESARAN, dan pada zoom jauh ia
                  MEMPERBESAR DULU lalu menyalakan modenya.

                  Ini keputusan yang perlu ditulis alasannya. Sel zoom jauh
                  bukan target sentuh (16px, jauh di bawah ambang 48), jadi mode
                  pilih memang tidak bisa dikerjakan di sana. Dua jalan keluar
                  yang ditolak:

                    * MENYEMBUNYIKAN tombolnya pada zoom jauh. Peta terbuka di
                      zoom jauh secara bawaan, jadi pemilik yang mencari "Pilih"
                      tidak akan menemukannya — dan tidak ada apa pun di layar
                      yang memberi tahu bahwa ia harus memperbesar dulu. Itu
                      mengubur satu-satunya jalan ke tiga fungsi.
                    * MENONAKTIFKAN tombolnya. Tombol mati tidak mengajarkan
                      syaratnya; ia hanya terbaca sebagai aplikasi yang rusak.

                  Yang dipilih: "Pilih" SELALU berarti "mulai memilih", dan
                  karena memilih menuntut sel yang cukup besar untuk ditekan, ia
                  membawa pemiliknya ke tingkat itu. Satu ketukan, satu akibat
                  yang seluruhnya terlihat — petak membesar dan bar atas
                  berganti di frame yang sama. Tidak ada yang tersembunyi. */}
              {isOwner ? (
                <Button
                  onPress={() => {
                    if (!zoomedIn) {
                      setZoomedIn(true);
                      setMapZoom(true);
                    }

                    setSelectMode(true);
                  }}
                  size="small"
                  title="Pilih"
                  variant="secondary"
                />
              ) : null}
            </>
          )}
        </View>

        {(error || (matchedCodes !== null && matchedCodes.size === 0)) ? (
          <View style={{ gap: tokens.space.sm, paddingHorizontal: tokens.layout.screenX }}>
            <ErrorBanner message={error} />
            {matchedCodes !== null && matchedCodes.size === 0 ? <NoMatchNotice /> : null}
          </View>
        ) : null}
      </View>

      {/* Pembungkus TAMBAHAN, dan ia punya satu tugas: jadi kerangka acuan
          tombol perbesaran yang melayang. Tanpa dia, tombol itu harus duduk di
          dalam petak yang ber-paddingLeft 16, dan `left: 12` di sana berarti 28
          dari tepi layar — bukan 12 seperti yang dimaksud.

          Ia TIDAK menyentuh apa pun di dalamnya: tetap flex:1, tetap satu anak
          yang mengisi penuh, jadi tinggi yang diterima kedua penggulung sama
          persis seperti sebelum pembungkus ini ada. */}
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingLeft: tokens.layout.screenX }}>
          {/* ------------------------------------------------------------------
              KEPALA BARIS DAN KOLOM YANG DIBEKUKAN

              Huruf kolom di atas dan nomor baris di kiri BUKAN bagian dari isi
              yang digulung. Keduanya lapisan tersendiri yang duduk di dalam wadah
              ber-overflow hidden, dan digeser lewat transform sebesar posisi
              gulung petaknya — negatif, karena mereka bergerak berlawanan arah.

              KENAPA transform BERPENGGERAK NATIF, BUKAN onScroll lalu scrollTo:

              scrollTo pada setiap kejadian gulung berarti setiap frame menempuh
              jalan pulang-pergi ke thread JS — kejadian naik, JS menghitung, lalu
              perintah gulung turun lagi. Di ponsel kelas bawah, thread JS itulah
              yang paling sering sibuk, dan akibatnya bukan sekadar kurang halus:
              kepala TERTINGGAL di belakang petaknya, kadang beberapa sel penuh.
              Untuk layar yang seluruh gunanya adalah membaca "12-C" dengan benar,
              kepala yang meleset satu baris lebih buruk daripada tidak ada kepala
              sama sekali.

              Animated.event dengan useNativeDriver memasang jalurnya SEKALI di
              sisi natif. Setelah itu posisi gulung menggerakkan transform langsung
              di thread UI; tidak ada satu pun frame yang menunggu JS. Kepala dan
              petak bergerak sebagai satu benda karena memang digerakkan oleh satu
              nilai yang sama.
              ------------------------------------------------------------------ */}

          <View style={{ flexDirection: 'row' }}>
            {/* Sudut kosong tempat kedua kepala bertemu. */}
            <View style={{ height: COLUMN_HEADER_HEIGHT, width: ROW_HEADER_WIDTH }} />
            <View style={{ flex: 1, height: COLUMN_HEADER_HEIGHT, overflow: 'hidden' }}>
              <Animated.View
                style={{
                  flexDirection: 'row',
                  // gap yang SAMA PERSIS dengan petaknya, dan lebar tiap label
                  // yang sama persis dengan sisi selnya. Itu seluruh cara
                  // kepala kolom tetap sejajar: tidak ada margin yang dihitung
                  // manual, tidak ada offset yang harus dijaga sendiri.
                  gap: cellGap,
                  transform: [{ translateX: Animated.multiply(scroll.x, -1) }],
                }}
              >
                {columnNumbers.map((columnNumber) => (
                  <AxisLabel
                    key={columnNumber}
                    height={COLUMN_HEADER_HEIGHT}
                    label={columnLetter(columnNumber)}
                    width={cellSize}
                  />
                ))}
              </Animated.View>
            </View>
          </View>

          <View style={{ flex: 1, flexDirection: 'row' }}>
            <View style={{ overflow: 'hidden', width: ROW_HEADER_WIDTH }}>
              <Animated.View
                style={{
                  // Gutter nomor baris memakai TINGGI BARIS yang sama persis
                  // dengan petaknya — `height={cellSize}` per label plus gap
                  // yang sama. Jarak antarbaris TIDAK dihitung ulang dengan
                  // margin di sini: satu angka yang dipelihara di dua tempat
                  // adalah dua angka yang akan berbeda, dan begitu berbeda,
                  // nomor baris menunjuk baris yang salah.
                  gap: cellGap,
                  transform: [{ translateY: Animated.multiply(scroll.y, -1) }],
                }}
              >
                {rowNumbers.map((rowNumber) => (
                  <AxisLabel key={rowNumber} height={cellSize} label={String(rowNumber)} width={ROW_HEADER_WIDTH} />
                ))}
              </Animated.View>
            </View>

            {/* Dua penggulung bersarang dengan arah berbeda: yang luar menangani
                atas-bawah, yang dalam kiri-kanan. Pada perbesaran terkecil pun
                sembilan kolom lebih lebar dari layar, jadi kedua arah memang
                dibutuhkan.

                key={cellSize} memasang ulang keduanya saat perbesaran berganti,
                sehingga posisi gulungnya kembali nol bersamaan dengan nilai
                Animated yang baru. Tanpa itu, posisi lama dalam piksel akan
                menunjuk sel yang berbeda pada petak berukuran baru.

                paddingRight dan paddingBottom hanya MEMANJANGKAN isi, tidak
                menggeser titik nolnya — jadi keduanya aman bagi pencocokan
                kepala. paddingTop dan paddingLeft akan menggesernya, dan karena
                itu tidak dipakai. */}
            <Animated.ScrollView
              key={cellSize}
              // Ruang bawah mengikuti tingkat perbesaran. xxxl (32) memberi
              // napas di bawah baris terakhir saat petaknya memang panjang.
              //
              // Zoom jauh NAIK dari space.sm (8) ke space.lg (18) pasca-batch 7.
              // Pada 8px baris terakhir petak menempel ke garis panel mode pilih
              // dan ke garis bottom tab, sehingga sel paling bawah terbaca
              // terpotong. Petaknya memang sedang diusahakan muat pada zoom ini,
              // dan 10px tambahan itu harganya; napas di bawah baris terakhir
              // lebih penting daripada menghemat satu baris gulir.
              contentContainerStyle={{
                paddingBottom: zoomedIn ? tokens.space.xxxl : tokens.space.lg,
              }}
              onScroll={scroll.onScrollY}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              style={{ flex: 1 }}
            >
              <Animated.ScrollView
                contentContainerStyle={{ paddingRight: tokens.layout.screenX }}
                horizontal
                onScroll={scroll.onScrollX}
                scrollEventThrottle={16}
                showsHorizontalScrollIndicator={false}
              >
                <View style={{ gap: cellGap }}>
                  {rowNumbers.map((rowNumber) => (
                    <View key={rowNumber} style={{ flexDirection: 'row', gap: cellGap }}>
                      {columnNumbers.map((columnNumber) => {
                        const letter = columnLetter(columnNumber);
                        const code = `${rowNumber}-${letter}`;
                        const tree = treeByPosition.get(code);
                        // matchedCodes null = tidak ada filter aktif, jadi tidak
                        // ada yang ditegaskan DAN tidak ada yang diredupkan.
                        // `matched` sudah false dengan sendirinya saat null.
                        const matched = matchedCodes?.has(code) ?? false;
                        const dimmed = matchedCodes !== null && !matched;

                        if (!tree) {
                          // Posisi kosong hanya bisa ditekan SELAMA mode pilih,
                          // dan hanya kalau himpunan yang sedang berjalan bukan
                          // himpunan pohon. Di luar mode pilih ia tetap inert
                          // seperti sebelumnya: tidak ada pohon untuk dibuka.
                          const positionSelectable =
                            selectMode && selectionAllows(selection, 'position');

                          return (
                            <EmptyMapCell
                              key={code}
                              cellSize={cellSize}
                              code={code}
                              // DUA sebab peredupan, dan keduanya bermuara ke
                              // satu prop karena keduanya berarti hal yang
                              // sama bagi mata: "bukan ini yang sedang
                              // relevan".
                              //
                              // Yang kedua adalah aturan himpunan homogen:
                              // begitu sel pertama dipilih, jenis yang
                              // berlawanan diredupkan DAN tidak bisa ditekan.
                              // Sebelum batch 4a ia hanya tidak bisa ditekan —
                              // dan sel yang diam tanpa alasan yang terlihat
                              // terbaca sebagai aplikasi yang rusak, bukan
                              // sebagai aturan.
                              dimmed={dimmed || (selectMode && !positionSelectable)}
                              matched={matched}
                              onPress={() => toggleSelectedPosition(code)}
                              selectable={positionSelectable}
                              selected={
                                selectMode &&
                                selection.kind === 'position' &&
                                selection.positionCodes.has(code)
                              }
                              showCode={zoomedIn}
                            />
                          );
                        }

                        // Hanya posisi yang SEDANG ditanami yang boleh masuk
                        // himpunan. Peredupan filter tidak ikut menentukan:
                        // meredupkan adalah penunjuk perhatian, bukan larangan,
                        // jadi sel redup bersiklus aktif tetap bisa dipilih.
                        //
                        // Syarat kedua: himpunan yang sedang berjalan harus
                        // mengizinkan jenis 'tree'. Posisi bersiklus TERTUTUP
                        // tetap tidak bisa dipilih dalam keadaan apa pun —
                        // penanaman ulang massal bukan lingkup migrasi 062, dan
                        // jalur satu-per-satunya sudah ada di
                        // StartTreePlantingSheet.
                        const selectableNow =
                          tree.activePlanting !== null && selectionAllows(selection, 'tree');

                        return (
                          <FilledMapCell
                            key={code}
                            cellSize={cellSize}
                            detailed={zoomedIn}
                            // Aturan himpunan homogen terlihat di sini juga:
                            // begitu himpunan berisi posisi kosong, seluruh
                            // sel berisi diredupkan dan diam. Lihat catatan
                            // kembarannya di cabang sel kosong di atas.
                            dimmed={dimmed || (selectMode && !selectableNow)}
                            matched={matched}
                            // Perilaku tekan berganti TOTAL selama mode pilih.
                            // Di luar mode itu, sel berisi membuka detail pohon
                            // persis seperti sebelumnya — TAPI HANYA PADA ZOOM
                            // DEKAT.
                            onPress={
                              selectMode
                                ? () => toggleSelectedTree(tree.id)
                                : () => router.push(`${basePath}/${tree.id}`)
                            }
                            // SEL ZOOM JAUH BUKAN TARGET SENTUH. 16px berada
                            // jauh di bawah ambang 48, dan ketukan yang meleset
                            // ke tetangganya membuka pohon yang salah — lalu
                            // dipercaya, karena tidak ada apa pun di layar
                            // detail yang memberi tahu bahwa yang dibuka bukan
                            // yang dimaksud. Jalan ke satu pohon selalu lewat
                            // perbesar dulu.
                            //
                            // `disabled`, bukan sekadar onPress kosong:
                            // accessibilityState ikut menyatakannya, jadi
                            // pembaca layar tidak mengumumkan 234 tombol yang
                            // tidak satu pun bisa ditekan.
                            selectable={zoomedIn && (selectMode ? selectableNow : true)}
                            selected={
                              selectMode && selection.kind === 'tree' && selection.treeIds.has(tree.id)
                            }
                            tree={tree}
                          />
                        );
                      })}
                    </View>
                  ))}
                </View>
              </Animated.ScrollView>
            </Animated.ScrollView>
          </View>
        </View>
      </View>

      {/* Strip legenda, MELEKAT di bawah peta. Dipadamkan selama mode pilih:
          di sana yang perlu dibaca adalah berapa yang sudah dipilih, bukan
          berapa yang sakit, dan dua pita bertumpuk di dasar layar akan menyita
          tinggi petak yang justru sedang dipakai memilih. */}
      {selectMode ? null : (
        <MapLegendStrip counts={legend.counts} emptyCount={legend.emptyCount} />
      )}

      {/* Dirender SEJAK mode pilih menyala, bukan sejak ada yang terpilih —
          itu seluruh sebab tingginya bisa dicadangkan. Lihat catatan di
          SelectionActionPanel. */}
      {selectMode ? (
        <SelectionActionPanel
          // Ketiga penyerahan menerima himpunan yang SUDAH tersempitkan di
          // sini, di satu-satunya tempat compiler bisa membuktikan jenisnya.
          // Panel tidak pernah memegang himpunan yang belum tersempitkan, jadi
          // ia tidak bisa keliru menyerahkan kode posisi ke jalur pohon.
          onAddTrees={() => {
            if (selection.kind === 'position') {
              handleAddTrees(selection);
            }
          }}
          onCreateSchedule={() => {
            if (selection.kind === 'tree') {
              handleCreateSchedule(selection);
            }
          }}
          onRecordCare={() => {
            if (selection.kind === 'tree') {
              handleRecordCare(selection);
            }
          }}
          selection={selection}
        />
      ) : null}
    </View>
  );
}
