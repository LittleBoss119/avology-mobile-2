import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens } from '../constants/theme';
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
import type { Farm, GrowthPhase, Tree, TreeConditionStatus } from '../types/domain';
import { formatGrowthPhase, formatTreeCondition } from '../utils/displayFormat';
import { formatTreeDisplayCode } from '../utils/treeFormat';
import { BottomSheet } from './bottom-sheet';
import { Icon, type IconName } from './icons';
import { Button, ErrorBanner, LoadingState } from './ui';

// Peta denah kebun, baca-saja.
//
// BUKAN LAYAR, melainkan salah satu dari dua TAMPILAN di dalam route pohon.
// Induknya — app/(owner)/owner/trees/index.tsx dan kembarannya di sisi pekerja —
// yang memiliki header, segmented, dan keputusan tampilan mana yang dirender.
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
// Dua tingkat perbesaran, tidak lebih. 48 adalah tokens.layout.rowMinHeight,
// yang di aplikasi ini memang berarti "sasaran sentuh terkecil yang masih
// layak" — kebetulan yang berguna, bukan angka yang dipilih terpisah.
//
// 70, lebar kolom nomor baris, dan tinggi baris huruf kolom TIDAK punya token.
// Ketiganya ditulis sebagai konstanta bernama di sini alih-alih ditebar sebagai
// angka telanjang di dalam JSX, dan dilaporkan apa adanya.
// ---------------------------------------------------------------------------

const CELL_SIZE_COMPACT = tokens.layout.rowMinHeight;
const CELL_SIZE_LARGE = 70;
const CELL_GAP = tokens.space.xs;
const ROW_HEADER_WIDTH = 32;
const COLUMN_HEADER_HEIGHT = 24;

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

// Urutan tampil kanonis, dipakai keterangan dan strip legenda supaya keduanya
// tidak pernah menyebut hal yang sama dalam urutan berbeda. Ini daftar NILAI,
// bukan daftar label — labelnya tetap milik formatTreeCondition dan
// formatGrowthPhase di utils/displayFormat.ts.
const CONDITION_ORDER = [
  'healthy',
  'needs_attention',
  'pest_attacked',
  'disease_indicated',
  'damaged',
  'dead',
] as const satisfies readonly TreeConditionStatus[];

const PHASE_ORDER = [
  'initial_planting',
  'vegetative',
  'flowering',
  'fruiting',
  'harvesting',
] as const satisfies readonly GrowthPhase[];

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
  // Sehat sengaja TIDAK diberi tanda apa pun dan latarnya permukaan biasa. Ini
  // mayoritas pohon; membiarkannya polos adalah inti desain ini, karena yang
  // menyimpanglah yang harus menonjol.
  //
  // Ia juga yang menjaga ongkos glif tetap murah: sel tanpa markIcon tidak
  // merender satu pun <Svg>. Lihat catatan CellGlyph di bawah.
  healthy: {
    background: tokens.color.surface.card,
    border: tokens.color.line.card,
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
// Rupa tanda fase
//
// Hanya tiga fase yang ditandai. initial_planting dan vegetative adalah keadaan
// tenang — menandainya berarti hampir setiap sel punya tanda, dan tanda yang
// ada di mana-mana berhenti menjadi tanda.
//
// Tempatnya POJOK KANAN ATAS, terpisah dari kondisi di pojok kiri atas, supaya
// keduanya tidak pernah berebut ruang di sel yang sama.
//
// GLIF yang menanggung beban pembeda: bunga, buah, buah berbiji. Warna adalah
// saluran kedua, dan ia dipakai untuk mengelompokkan, bukan untuk menamai satu
// per satu — hijau record.phase berarti "masih tumbuh" (berbunga dan berbuah),
// oranye record.harvest berarti "sudah bisa dipanen" (panen saja). Fase yang
// paling layak ditindaklanjuti pantas mendapat warna yang tidak dibagi dengan
// siapa pun.
//
// Berbunga dan berbuah kini dibedakan glifnya, bukan lagi bulat lawan belah
// ketupat. Buah berbiji dan buah polos berbagi siluet dengan sengaja — keduanya
// memang buah — dan bedanya biji di tengah; lihat catatan di icons.tsx.
// ---------------------------------------------------------------------------

type PhaseVisual = {
  color: string;
  // null berarti fase ini tidak ditandai di peta.
  icon: IconName | null;
};

const NO_PHASE_MARK: PhaseVisual = {
  color: tokens.color.text.tertiary,
  icon: null,
};

const PHASE_VISUALS: Record<GrowthPhase, PhaseVisual> = {
  initial_planting: NO_PHASE_MARK,
  vegetative: NO_PHASE_MARK,
  flowering: { color: tokens.color.record.phase.text, icon: 'cell-flower' },
  fruiting: { color: tokens.color.record.phase.text, icon: 'cell-fruit' },
  harvesting: { color: tokens.color.record.harvest.text, icon: 'cell-fruit-seed' },
};

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
        backgroundColor: tokens.color.brand.base,
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
}: {
  cellSize: number;
  code: string;
  dimmed?: boolean;
  matched?: boolean;
  onPress?: () => void;
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
        backgroundColor: tokens.color.surface.canvas,
        borderColor: emphasized ? tokens.color.brand.base : tokens.color.line.card,
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

      {/* Pojok yang SAMA dengan sel berisi. Tidak perlu overflow:'hidden' di
          sini seperti di FilledMapCell — tanpa lengkung, tidak ada yang bisa
          menyembul keluar sudut. */}
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
  dimmed = false,
  matched = false,
  onPress,
  selectable = true,
  selected = false,
  tree,
}: {
  cellSize: number;
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
  const phase = tree.currentGrowthPhase ? PHASE_VISUALS[tree.currentGrowthPhase] : NO_PHASE_MARK;
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
        borderColor: emphasized ? tokens.color.brand.base : visual.border,
        borderCurve: 'continuous',
        borderRadius: tokens.radius.tile,
        borderWidth: emphasized ? MATCHED_CELL_BORDER_WIDTH : CELL_BORDER_WIDTH,
        height: cellSize,
        justifyContent: 'center',
        opacity: dimmed ? DIMMED_OPACITY : 1,
        // Menjaga garis coret dan tanda sudut tetap di dalam lengkung sel.
        overflow: 'hidden',
        width: cellSize,
      }}
    >
      {visual.struckThrough ? (
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

      <Text
        selectable={false}
        numberOfLines={1}
        style={{
          color: visual.text,
          fontSize: cellCodeFontSize(cellSize),
          fontWeight: '700',
        }}
      >
        {formatTreeDisplayCode(tree)}
      </Text>

      {/* Pembungkus posisi hanya dibuat kalau memang ada tanda yang dipasang.
          Bukan penghematan spekulatif: sehat-tanpa-fase-bertanda adalah KEADAAN
          MAYORITAS menurut desain layar ini, dan tanpa penjaga ini setiap sel
          polos tetap menyeret dua View kosong yang tidak menggambar apa pun.
          Sejak tandanya jadi <Icon>, penjaga ini juga yang menahan jumlah
          simpul <Svg> tetap nol untuk kebun yang sehat. */}
      {visual.markIcon === null ? null : (
        <View pointerEvents="none" style={{ left: markInset, position: 'absolute', top: markInset }}>
          <CellGlyph color={visual.markColor} name={visual.markIcon} size={markSize} />
        </View>
      )}
      {phase.icon === null ? null : (
        <View pointerEvents="none" style={{ position: 'absolute', right: markInset, top: markInset }}>
          <CellGlyph color={phase.color} name={phase.icon} size={markSize} />
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

function cellCodeFontSize(cellSize: number): number {
  return cellSize >= CELL_SIZE_LARGE ? tokens.type.bodySmall.fontSize : tokens.type.caption.fontSize;
}

// Kalimat untuk pembaca layar. Dirangkai dari formatter yang sudah ada, bukan
// dari daftar label baru.
function describeCell(tree: Tree): string {
  const parts = [
    `Posisi ${formatTreeDisplayCode(tree)}`,
    formatTreeCondition(tree.currentCondition),
  ];

  if (tree.currentGrowthPhase) {
    parts.push(formatGrowthPhase(tree.currentGrowthPhase));
  }

  return parts.join(', ');
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
// Keterangan
//
// DUA BENTUK, dan keduanya perlu:
//
//   LEMBAR    dibuka lewat tombol "Keterangan". Lengkap: setiap tanda yang bisa
//             muncul, termasuk yang tidak sedang ada di kebun ini. Ia jawaban
//             atas "apa saja yang mungkin".
//   STRIP     melekat di dasar layar, tanpa dibuka. Hanya tanda yang BENAR-BENAR
//             sedang tampil. Ia jawaban atas "yang di layar saya ini apa" — dan
//             itu pertanyaan yang jauh lebih sering, tapi selama ini menuntut
//             membuka lembar penuh untuk dijawab.
//
// Strip tidak menggantikan lembar: ia tidak muat memuat keterangan, hanya nama.
// Lembar tidak menggantikan strip: ia menutupi peta yang sedang dibaca.
// ---------------------------------------------------------------------------

function LegendSwatch({ children }: { children: React.ReactNode }) {
  return <View style={{ alignItems: 'center', justifyContent: 'center', width: CELL_SIZE_COMPACT }}>{children}</View>;
}

function LegendRow({ description, label, swatch }: { description: string; label: string; swatch: React.ReactNode }) {
  return (
    <View
      style={{
        alignItems: 'center',
        flexDirection: 'row',
        gap: tokens.space.md,
        paddingVertical: tokens.space.sm,
      }}
    >
      <LegendSwatch>{swatch}</LegendSwatch>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          selectable
          style={{ color: tokens.color.text.primary, ...tokens.type.bodyStrong }}
        >
          {label}
        </Text>
        <Text selectable style={{ color: tokens.color.text.secondary, ...tokens.type.meta }}>
          {description}
        </Text>
      </View>
    </View>
  );
}

function LegendGroupTitle({ title }: { title: string }) {
  return (
    <Text
      selectable
      style={{
        color: tokens.color.text.secondary,
        ...tokens.type.label,
        paddingBottom: tokens.space.xs,
        paddingTop: tokens.space.md,
      }}
    >
      {title}
    </Text>
  );
}

// Sel contoh seukuran sel terkecil, dipakai sebagai swatch keterangan supaya
// yang dilihat di lembar ini sama persis dengan yang dilihat di peta.
function LegendCell({ condition }: { condition: TreeConditionStatus }) {
  const visual = CONDITION_VISUALS[condition];
  const size = Math.round(CELL_SIZE_COMPACT * 0.72);
  const markSize = Math.round(size * MARK_SIZE_RATIO * 1.3);
  const markInset = Math.round(size * 0.1);

  return (
    <View
      style={{
        // alignItems/justifyContent center, PERSIS seperti sel di peta: garis
        // coret di bawah tidak punya inset sendiri, jadi yang menengahkannya
        // adalah perataan induknya. Tanpa keduanya ia menempel ke kiri-atas dan
        // diagonalnya meleset dari sudut ke sudut.
        alignItems: 'center',
        backgroundColor: visual.background,
        borderColor: visual.border,
        borderCurve: 'continuous',
        borderRadius: tokens.radius.tile,
        borderWidth: 1,
        height: size,
        justifyContent: 'center',
        overflow: 'hidden',
        width: size,
      }}
    >
      {visual.struckThrough ? (
        <View
          style={{
            backgroundColor: visual.markColor,
            height: 1,
            position: 'absolute',
            transform: [{ rotate: '-45deg' }],
            width: Math.round(size * 1.42),
          }}
        />
      ) : null}
      {visual.markIcon === null ? null : (
        <View style={{ left: markInset, position: 'absolute', top: markInset }}>
          <CellGlyph color={visual.markColor} name={visual.markIcon} size={markSize} />
        </View>
      )}
    </View>
  );
}

const CONDITION_LEGEND_DESCRIPTIONS: Record<TreeConditionStatus, string> = {
  healthy: 'Tidak diberi tanda apa pun. Latar putih polos.',
  needs_attention: 'Segitiga seru di pojok kiri atas, latar kuning.',
  pest_attacked: 'Serangga di pojok kiri atas, latar merah muda.',
  disease_indicated: 'Daun berbercak di pojok kiri atas, latar merah muda.',
  damaged: 'Ranting patah di pojok kiri atas, latar merah muda.',
  dead: 'Silang di pojok kiri atas, dan satu garis melintasi sel.',
};

const PHASE_LEGEND_DESCRIPTIONS: Record<GrowthPhase, string> = {
  initial_planting: 'Tidak ditandai di peta.',
  vegetative: 'Tidak ditandai di peta.',
  flowering: 'Bunga hijau di pojok kanan atas. Hijau berarti pohon masih tumbuh.',
  fruiting: 'Buah hijau di pojok kanan atas. Hijau berarti pohon masih tumbuh.',
  harvesting: 'Buah berbiji, oranye. Hanya fase ini yang oranye — pohonnya sudah bisa dipanen.',
};

function LegendSheet({ onClose, visible }: { onClose: () => void; visible: boolean }) {
  const size = Math.round(CELL_SIZE_COMPACT * 0.72);
  const phaseMarkSize = Math.round(size * MARK_SIZE_RATIO * 1.3);

  return (
    <BottomSheet
      onClose={onClose}
      subtitle="Kondisi ditandai di pojok kiri atas, fase pertumbuhan di pojok kanan atas."
      title="Keterangan peta"
      visible={visible}
    >
      <View>
        {/* Label kondisi dan fase diambil dari formatTreeCondition dan
            formatGrowthPhase, bukan ditulis ulang di sini. Peta tidak boleh
            menjadi daftar label keenam di repo ini. */}
        <LegendGroupTitle title="Kondisi" />
        {CONDITION_ORDER.map((condition) => (
          <LegendRow
            key={condition}
            description={CONDITION_LEGEND_DESCRIPTIONS[condition]}
            label={formatTreeCondition(condition)}
            swatch={<LegendCell condition={condition} />}
          />
        ))}

        <LegendGroupTitle title="Fase pertumbuhan" />
        {PHASE_ORDER.map((phase) => {
          const visual = PHASE_VISUALS[phase];

          return (
            <LegendRow
              key={phase}
              description={PHASE_LEGEND_DESCRIPTIONS[phase]}
              label={formatGrowthPhase(phase)}
              swatch={
                visual.icon === null ? null : (
                  <CellGlyph color={visual.color} name={visual.icon} size={phaseMarkSize} />
                )
              }
            />
          );
        })}

        <LegendGroupTitle title="Lainnya" />
        <LegendRow
          description="Belum pernah ditanami. Sudut tajam dan garis putus-putus."
          label="Posisi kosong"
          swatch={<EmptyMapCell cellSize={size} code="—" />}
        />
        <LegendRow
          description="Cocok dengan filter yang sedang aktif. Filternya disetel di tab Daftar."
          label="Tepi tebal hijau"
          swatch={<LegendCell condition="healthy" />}
        />
        <LegendRow
          description="Tidak cocok dengan filter yang sedang aktif. Tetap bisa ditekan."
          label="Sel yang diredupkan"
          swatch={
            <View style={{ opacity: DIMMED_OPACITY }}>
              <LegendCell condition="healthy" />
            </View>
          }
        />
      </View>
    </BottomSheet>
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
// Tombol perbesaran melayang
//
// IKON SAJA, dan itu PENGECUALIAN SADAR atas aturan "tidak ada tombol ikon-saja"
// yang berlaku di seluruh repo ini. Dua hal yang membuatnya bisa dipertanggung-
// jawabkan, dan keduanya harus tetap benar kalau tombol ini diubah:
//
//   1. SALAH TEKAN TIDAK MERUSAK APA PUN. Ia mengubah ukuran gambar, sekali
//      ketuk lagi kembali. Bandingkan dengan "Catat perawatan", yang menulis
//      baris care_activity_trees tanpa jalur hapus.
//   2. IKONNYA KONVENSIONAL. Kaca pembesar berplus/berminus adalah salah satu
//      dari sedikit glif yang artinya tidak perlu dipelajari.
//
// JANGAN JADIKAN PRESEDEN. Tombol lain di aplikasi ini tetap wajib berteks.
//
// Yang menggantikan teksnya adalah accessibilityLabel yang BERGANTI mengikuti
// keadaan — pembaca layar tetap mendengar kalimat penuh, dan kalimatnya
// menyebut apa yang AKAN terjadi, bukan sedang di tingkat mana.
//
// Latar solid plus bayangan, bukan transparan: tombol ini melayang di atas sel
// yang latarnya berubah-ubah (putih, kuning, merah muda, abu), dan tanpa alas
// sendiri ia hilang di salah satu dari empat itu.
// ---------------------------------------------------------------------------

const ZOOM_BUTTON_SIZE = tokens.layout.rowMinHeight;

function MapZoomButton({ onPress, zoomedIn }: { onPress: () => void; zoomedIn: boolean }) {
  return (
    <Pressable
      accessibilityLabel={zoomedIn ? 'Perkecil denah' : 'Perbesar denah'}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: tokens.color.surface.card,
        borderColor: tokens.color.line.card,
        borderCurve: 'continuous',
        borderRadius: tokens.radius.cardInner,
        borderWidth: 1,
        bottom: tokens.space.md,
        height: ZOOM_BUTTON_SIZE,
        justifyContent: 'center',
        left: tokens.space.md,
        opacity: pressed ? 0.82 : 1,
        position: 'absolute',
        width: ZOOM_BUTTON_SIZE,
        ...tokens.elevation.overlay,
      })}
    >
      <Icon
        color={tokens.color.brand.base}
        name={zoomedIn ? 'zoom-out' : 'zoom-in'}
        size={tokens.icon.lg}
      />
    </Pressable>
  );
}

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

function SelectionActionPanel({
  onAddTrees,
  onCancel,
  onCreateSchedule,
  onRecordCare,
  selection,
}: {
  onAddTrees: () => void;
  onCancel: () => void;
  onCreateSchedule: () => void;
  onRecordCare: () => void;
  selection: MapSelection;
}) {
  const insets = useSafeAreaInsets();
  const count = selectionSize(selection);

  return (
    <View
      style={{
        backgroundColor: tokens.color.surface.card,
        borderTopColor: tokens.color.line.card,
        borderTopWidth: 1,
        gap: tokens.space.sm,
        paddingBottom: Math.max(insets.bottom, tokens.space.md),
        paddingHorizontal: tokens.layout.screenX,
        paddingTop: tokens.space.md,
      }}
    >
      {/* Kalimat penuh saat nol, bukan "0 pohon dipilih". Angka nol di awal
          kalimat terbaca sebagai hasil hitungan yang gagal, bukan sebagai
          keadaan awal yang wajar.

          Saat nol, kalimatnya menyebut KEDUANYA. Itu bukan sekadar informasi:
          pada keadaan inilah kedua jenis sel memang boleh ditekan, dan pemilik
          tidak punya cara lain mengetahuinya. */}
      <Text selectable style={{ color: tokens.color.text.secondary, ...tokens.type.bodySmall }}>
        {selection.kind === 'none'
          ? 'Pilih pohon, atau pilih posisi kosong'
          : selection.kind === 'tree'
            ? `${count} pohon dipilih`
            : `${count} posisi kosong dipilih`}
      </Text>

      {/* Bertumpuk vertikal, bukan berdampingan: label "Buat jadwal perawatan"
          tidak muat setengah lebar layar tanpa dipotong, dan tombol yang
          labelnya terpotong berhenti menjelaskan apa yang akan terjadi.
          Button ukuran regular sudah minHeight 56 dan melebar penuh.

          Cabang 'none' menampilkan kedua tombol pohon dalam keadaan mati,
          PERSIS seperti sebelum tahap ini: panel yang berganti tinggi begitu
          sel pertama ditekan akan menggeser petak di atasnya tepat saat
          pemilik sedang membidik sel berikutnya. */}
      {selection.kind === 'position' ? (
        <Button onPress={onAddTrees} title="Tambah pohon di posisi terpilih" variant="primary" />
      ) : (
        <>
          <Button
            disabled={count === 0}
            onPress={onCreateSchedule}
            title="Buat jadwal perawatan"
            variant="primary"
          />
          {/* Menjadwalkan lebih dulu, mencatat di bawahnya. Urutannya disengaja:
              menjadwalkan bisa dibatalkan, mencatat tidak — dan tindakan yang tidak
              bisa ditarik kembali tidak pantas jadi tombol pertama yang disenggol
              ibu jari. */}
          <Button
            disabled={count === 0}
            onPress={onRecordCare}
            title="Catat perawatan"
            variant="secondary"
          />
        </>
      )}
      <Button onPress={onCancel} title="Batal" variant="ghost" />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Layar
// ---------------------------------------------------------------------------

export function FarmMapScreen({ basePath }: { basePath: '/owner/trees' | '/worker/trees' }) {
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
  const [legendOpen, setLegendOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [selectMode, setSelectMode] = React.useState(false);
  const [selection, setSelection] = React.useState<MapSelection>(NO_SELECTION);
  const [trees, setTrees] = React.useState<Tree[]>([]);

  const farmId = currentFarm?.farmId;
  const cellSize = zoomedIn ? CELL_SIZE_LARGE : CELL_SIZE_COMPACT;
  const isOwner = basePath === '/owner/trees';

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
    return <LoadingState message="Memuat denah kebun..." />;
  }

  return (
    <View style={{ backgroundColor: tokens.color.surface.canvas, flex: 1 }}>
      {/* TANPA TopAppBar dan tanpa segmented. Keduanya kini milik route induk
          (app/(owner)/owner/trees/index.tsx dan kembarannya di sisi pekerja),
          yang merender header sekali di luar percabangan tampilan — jadi
          bertukar Daftar/Denah tidak lagi mengganti judul, memunculkan tombol
          back, atau merender ulang kepala layar.

          Komponen ini karena itu mulai LANGSUNG dari baris kontrolnya. Ia tetap
          memuat datanya sendiri (getFarmDetail + getTrees); yang pindah hanya
          chrome-nya, bukan tanggung jawabnya atas data. */}
      <View style={{ gap: tokens.space.sm, paddingBottom: tokens.space.md }}>
        {/* DUA tombol, bukan tiga. Zoom keluar dari baris ini dan jadi tombol
            melayang di pojok kiri bawah petak — tempat yang bisa dijangkau ibu
            jari tanpa memindahkan pandangan dari sel yang sedang dibaca, dan
            yang tidak membayar tinggi baris kontrol sepanjang waktu.

            Pekerja tidak punya tombol "Pilih", jadi barisnya menyusut jadi satu
            anak. space-between dengan satu anak menaruhnya di kiri — persis
            tempat "Keterangan" memang seharusnya berada — jadi tidak ada
            pengganti kosong yang perlu dirender. */}
        <View
          style={{
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: tokens.layout.screenX,
          }}
        >
          <Button onPress={() => setLegendOpen(true)} size="small" title="Keterangan" variant="secondary" />

          {/* HANYA pemilik. Peta pekerja tetap baca-saja — itu keputusan yang
              sudah diambil, bukan kelalaian, jadi tombolnya tidak dirender sama
              sekali alih-alih dirender lalu dinonaktifkan.

              Tombol adalah SATU-SATUNYA jalan masuk. Sengaja tanpa tekan-lama:
              peta digulung dua arah dengan jari mendarat di atas sel, jadi
              tekan-lama akan salah picu setiap kali orang menggulung pelan.

              Keadaan aktifnya dibawa DUA saluran: labelnya berganti jadi
              "Selesai", dan variannya jadi primary — terisi penuh, bukan
              sekadar berganti warna teks. */}
          {isOwner ? (
            <Button
              onPress={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
              size="small"
              title={selectMode ? 'Selesai' : 'Pilih'}
              variant={selectMode ? 'primary' : 'secondary'}
            />
          ) : null}
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
                  gap: CELL_GAP,
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
                  gap: CELL_GAP,
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
              contentContainerStyle={{ paddingBottom: tokens.space.xxxl }}
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
                <View style={{ gap: CELL_GAP }}>
                  {rowNumbers.map((rowNumber) => (
                    <View key={rowNumber} style={{ flexDirection: 'row', gap: CELL_GAP }}>
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
                          return (
                            <EmptyMapCell
                              key={code}
                              cellSize={cellSize}
                              code={code}
                              dimmed={dimmed}
                              matched={matched}
                              onPress={() => toggleSelectedPosition(code)}
                              selectable={selectMode && selectionAllows(selection, 'position')}
                              selected={
                                selectMode &&
                                selection.kind === 'position' &&
                                selection.positionCodes.has(code)
                              }
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
                            dimmed={dimmed}
                            matched={matched}
                            // Perilaku tekan berganti TOTAL selama mode pilih.
                            // Di luar mode itu, sel berisi tetap membuka detail
                            // pohon persis seperti sebelumnya.
                            onPress={
                              selectMode
                                ? () => toggleSelectedTree(tree.id)
                                : () => router.push(`${basePath}/${tree.id}`)
                            }
                            selectable={selectMode ? selectableNow : true}
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
        {/* Dipadamkan selama mode pilih: panel tindakan naik dari dasar layar
            dan tombol ini akan melayang tepat di atasnya. */}
        {selectMode ? null : <MapZoomButton onPress={toggleZoom} zoomedIn={zoomedIn} />}
      </View>

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
          onCancel={exitSelectMode}
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

      <LegendSheet onClose={() => setLegendOpen(false)} visible={legendOpen} />
    </View>
  );
}
