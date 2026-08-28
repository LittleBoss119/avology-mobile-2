import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens } from '../constants/theme';
import { useAuth } from '../context/auth-context';
import { setPendingCareTrees } from '../lib/pendingCareTrees';
import { setPendingNewTreePositions } from '../lib/pendingNewTreePositions';
import { setPendingScheduleTrees } from '../lib/pendingScheduleTrees';
import { getFarmDetail } from '../services/farmService';
import { getTrees } from '../services/treeService';
import type { Farm, GrowthPhase, Tree, TreeConditionStatus } from '../types/domain';
import { formatGrowthPhase, formatTreeCondition } from '../utils/displayFormat';
import { formatTreeDisplayCode } from '../utils/treeFormat';
import { BottomSheet } from './bottom-sheet';
import { Icon } from './icons';
import {
  Button,
  ChipButton,
  ErrorBanner,
  FilterChipsRow,
  LoadingState,
  SearchFilterRow,
  TopAppBar,
} from './ui';

// Peta denah kebun, baca-saja.
//
// KENAPA LAYAR INI TIDAK MEMAKAI <Screen>: Screen membungkus children-nya dalam
// satu ScrollView vertikal. Peta punya ScrollView-nya SENDIRI di kedua sumbu,
// dan menaruhnya di dalam ScrollView vertikal lain berarti dua penggulung
// vertikal berebut gestur yang sama. Jadi layar ini menyusun kerangkanya sendiri
// dari View flex:1 + TopAppBar, dan menerapkan padding tepi layar yang biasanya
// diberikan Screen.
//
// Pekerja dan pemilik memakai komponen yang SAMA, dengan TEPAT SATU cabang
// peran: banner "belum ada varietas" hanya untuk pemilik. Melengkapi varietas
// bukan pekerjaan pekerja, dan pesan yang tidak bisa ditindaklanjuti oleh
// pembacanya cuma menyita tinggi layar. Selebihnya — peta, pencarian, filter,
// keterangan — identik untuk keduanya; layar ini masih nol aksi tulis.
//
// basePath dipakai untuk dua hal: merakit route detail pohon, dan membedakan
// peran. Keduanya mengikuti pola tree-care-activity-screen dan enam komponen
// sekerabatnya, yang juga membaca basePath sebagai penanda peran.

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

// Sel yang tidak cocok pencarian/filter diredupkan, TIDAK disembunyikan: yang
// dicari orang bukan cuma "pohonnya mana", tapi "pohonnya di sudut mana kebun",
// dan itu hilang begitu tetangganya lenyap.
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
// Tiga kondisi berbagi satu tanda SEGITIGA dengan sengaja: di kotak 48px,
// membedakan hama dari penyakit dari kerusakan hanya lewat bentuk mustahil
// dilakukan tanpa membuat ketiganya sama-sama tidak terbaca. Bedanya terlihat
// setelah pohonnya dibuka.
//
// Bentuk tandanya berbeda satu sama lain, bukan hanya warnanya: kotak, segitiga,
// dan kotak-bersilang. Aplikasi ini dipakai orang yang mungkin sulit membedakan
// hijau dan merah, jadi warna tidak boleh jadi satu-satunya pembawa pesan.
// ---------------------------------------------------------------------------

type ConditionMarkShape = 'none' | 'square' | 'triangle' | 'crossed-square';

type ConditionVisual = {
  background: string;
  border: string;
  markColor: string;
  markShape: ConditionMarkShape;
  // Garis diagonal melintasi SELURUH sel. Hanya untuk 'dead'.
  struckThrough: boolean;
  text: string;
};

// Satu objek dipakai bertiga: hama, penyakit, dan rusak memang satu tampilan.
const PROBLEM_VISUAL: ConditionVisual = {
  background: tokens.color.status.danger.bg,
  border: tokens.color.status.danger.border,
  markColor: tokens.color.status.danger.text,
  markShape: 'triangle',
  struckThrough: false,
  text: tokens.color.text.primary,
};

const CONDITION_VISUALS: Record<TreeConditionStatus, ConditionVisual> = {
  // Sehat sengaja TIDAK diberi tanda apa pun dan latarnya permukaan biasa. Ini
  // mayoritas pohon; membiarkannya polos adalah inti desain ini, karena yang
  // menyimpanglah yang harus menonjol.
  healthy: {
    background: tokens.color.surface.card,
    border: tokens.color.line.card,
    markColor: tokens.color.text.tertiary,
    markShape: 'none',
    struckThrough: false,
    text: tokens.color.text.primary,
  },
  needs_attention: {
    background: tokens.color.status.warning.bg,
    border: tokens.color.status.warning.border,
    markColor: tokens.color.status.warning.text,
    markShape: 'square',
    struckThrough: false,
    text: tokens.color.text.primary,
  },
  pest_attacked: PROBLEM_VISUAL,
  disease_indicated: PROBLEM_VISUAL,
  damaged: PROBLEM_VISUAL,
  dead: {
    background: tokens.color.status.neutral.bg,
    border: tokens.color.status.neutral.border,
    markColor: tokens.color.status.neutral.text,
    markShape: 'crossed-square',
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
// BENTUK yang menanggung seluruh beban pembeda: bulat, belah ketupat, palang.
// Warna adalah saluran kedua, dan ia dipakai untuk mengelompokkan, bukan untuk
// menamai satu per satu.
//
// KENAPA BERBUNGA DAN BERBUAH SEWARNA. Sebelumnya berbuah diberi biru
// status.info semata-mata karena ia warna ketiga yang tersisa. Biru tidak
// berarti apa-apa di aplikasi ini, jadi tandanya harus dihafal tanpa petunjuk —
// itu bukan warna yang salah, itu warna yang kosong.
//
// Yang menggantikannya: hijau record.phase untuk berbunga DAN berbuah, oranye
// record.harvest hanya untuk panen. Dengan begitu warnanya menyatakan sesuatu
// yang benar — hijau berarti "masih tumbuh", oranye berarti "sudah bisa
// dipanen" — dan oranye tetap menjadi milik satu-satunya fase yang menuntut
// tindakan. Fase yang paling layak ditindaklanjuti pantas mendapat warna yang
// tidak dibagi dengan siapa pun.
//
// Harganya dibayar sadar: berbunga dan berbuah kini hanya dibedakan bentuknya.
// Itu masih dua saluran pembeda untuk pasangan itu (bulat vs belah ketupat),
// dan menukar satu hue yang tak bermakna dengan pengelompokan yang bermakna
// adalah pertukaran yang menguntungkan.
// ---------------------------------------------------------------------------

type PhaseMarkShape = 'none' | 'circle' | 'diamond' | 'bar';

type PhaseVisual = {
  color: string;
  shape: PhaseMarkShape;
};

const NO_PHASE_MARK: PhaseVisual = {
  color: tokens.color.text.tertiary,
  shape: 'none',
};

const PHASE_VISUALS: Record<GrowthPhase, PhaseVisual> = {
  initial_planting: NO_PHASE_MARK,
  vegetative: NO_PHASE_MARK,
  flowering: { color: tokens.color.record.phase.text, shape: 'circle' },
  fruiting: { color: tokens.color.record.phase.text, shape: 'diamond' },
  harvesting: { color: tokens.color.record.harvest.text, shape: 'bar' },
};

// ---------------------------------------------------------------------------
// Tanda-tanda kecil
//
// Semuanya View biasa, BUKAN SVG. Alasannya bukan selera: satu <Svg> membawa
// satu simpul rasterisasi tersendiri, dan peta bisa memuat ratusan sel bertanda
// sekaligus. Bentuk-bentuk di bawah semuanya bisa dicapai dengan border dan
// transform, jadi biaya tambahannya tidak dibayar.
//
// 'transparent' pada sisi segitiga bukan warna literal yang menghindari token —
// ia ketiadaan warna, dan pola yang sama sudah dipakai role-bottom-navigation.
// ---------------------------------------------------------------------------

function ConditionMark({ color, shape, size }: { color: string; shape: ConditionMarkShape; size: number }) {
  if (shape === 'none') {
    return null;
  }

  if (shape === 'square') {
    return <View style={{ backgroundColor: color, borderRadius: 2, height: size, width: size }} />;
  }

  if (shape === 'triangle') {
    return (
      <View
        style={{
          borderBottomColor: color,
          borderBottomWidth: size,
          borderLeftColor: 'transparent',
          borderLeftWidth: size / 2,
          borderRightColor: 'transparent',
          borderRightWidth: size / 2,
          borderStyle: 'solid',
          height: 0,
          width: 0,
        }}
      />
    );
  }

  // Kotak bersilang: bingkai kotak dengan dua palang menyilang di dalamnya.
  // Palangnya dibuat sepanjang diagonal kotak supaya ujungnya benar-benar
  // menyentuh sudut, bukan berhenti di tengah sisi.
  const barLength = size * 1.42;
  const barThickness = Math.max(1, Math.round(size / 8));

  return (
    <View
      style={{
        alignItems: 'center',
        borderColor: color,
        borderRadius: 2,
        borderWidth: 1,
        height: size,
        justifyContent: 'center',
        overflow: 'hidden',
        width: size,
      }}
    >
      <View
        style={{
          backgroundColor: color,
          height: barThickness,
          position: 'absolute',
          transform: [{ rotate: '45deg' }],
          width: barLength,
        }}
      />
      <View
        style={{
          backgroundColor: color,
          height: barThickness,
          position: 'absolute',
          transform: [{ rotate: '-45deg' }],
          width: barLength,
        }}
      />
    </View>
  );
}

// Tanda "terpilih": centang putih di dalam bulatan berwarna merek.
//
// Centangnya SATU View, bukan ikon SVG. Sebuah "L" — hanya tepi kanan dan tepi
// bawah yang digambar — yang diputar 45 derajat memang berbentuk centang. Ini
// penting bukan karena kerapian: pemilik boleh memilih SELURUH kebun, dan pada
// 196 sel terpilih setiap <Svg> tambahan adalah satu simpul rasterisasi lagi.
// Alasan yang sama membuat seluruh tanda lain di berkas ini juga View biasa.
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

function PhaseMark({ color, shape, size }: { color: string; shape: PhaseMarkShape; size: number }) {
  if (shape === 'none') {
    return null;
  }

  if (shape === 'circle') {
    return (
      <View
        style={{
          backgroundColor: color,
          borderRadius: tokens.radius.pill,
          height: size,
          width: size,
        }}
      />
    );
  }

  if (shape === 'diamond') {
    // Bujur sangkar yang diputar 45 derajat. Sisinya dikecilkan sedikit supaya
    // diagonalnya — yang jadi lebar terlihatnya — sepadan dengan bentuk lain.
    const side = Math.round(size * 0.76);

    return <View style={{ backgroundColor: color, height: side, transform: [{ rotate: '45deg' }], width: side }} />;
  }

  return (
    <View
      style={{
        backgroundColor: color,
        borderRadius: tokens.radius.pill,
        height: Math.max(2, Math.round(size / 2.5)),
        width: size,
      }}
    />
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
//             `emphasized` yang sudah ada untuk sel yang cocok pencarian.
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
  // Diredupkan karena tidak cocok pencarian/filter. TETAP bisa ditekan —
  // meredupkan adalah menurunkan penonjolan, bukan menonaktifkan.
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
  const markSize = Math.round(cellSize * 0.22);
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
          polos tetap menyeret dua View kosong yang tidak menggambar apa pun. */}
      {visual.markShape === 'none' ? null : (
        <View pointerEvents="none" style={{ left: markInset, position: 'absolute', top: markInset }}>
          <ConditionMark color={visual.markColor} shape={visual.markShape} size={markSize} />
        </View>
      )}
      {phase.shape === 'none' ? null : (
        <View pointerEvents="none" style={{ position: 'absolute', right: markInset, top: markInset }}>
          <PhaseMark color={phase.color} shape={phase.shape} size={markSize} />
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
// Pencarian dan filter
//
// Keduanya MEREDUPKAN, tidak menyembunyikan. Alasannya sama untuk dua-duanya:
// peta ini menjawab "di sebelah mana", bukan "yang mana". Sel yang tidak cocok
// dibuang berarti membuang jawaban atas pertanyaan yang justru dibawa orang ke
// layar ini.
//
// Seluruhnya dihitung di memori dari data yang sudah dimuat. Nol permintaan
// jaringan tambahan — sama seperti daftar pohon, yang juga menyaring di klien.
// ---------------------------------------------------------------------------

// Hanya tiga fase yang bisa disaring, karena hanya tiga itu yang DITANDAI di
// peta. Menyaring 'awal tanam' atau 'vegetatif' akan menyisakan sel-sel yang
// menonjol tanpa satu pun tanda yang menjelaskan kenapa — filter yang hasilnya
// tidak bisa dibaca lebih buruk daripada filter yang tidak ada.
const FILTERABLE_PHASES = ['flowering', 'fruiting', 'harvesting'] as const satisfies readonly GrowthPhase[];

type FilterablePhase = (typeof FILTERABLE_PHASES)[number];

// Penjaga waktu-kompilasi: memaksa daftar di bawah memuat SELURUH nilai enum.
// Kalau tree_condition_status kelak bertambah nilai, berkas ini gagal typecheck
// alih-alih diam-diam kehilangan satu chip filter.
function allConditions<T extends readonly TreeConditionStatus[]>(
  list: T & (TreeConditionStatus extends T[number] ? unknown : never)
): T {
  return list;
}

// KEENAM nilai kondisi bisa disaring terpisah, walau peta menggambar hama,
// penyakit, dan rusak dengan satu tanda yang sama. Bedanya nyata di data; yang
// tidak muat hanyalah membedakannya di kotak 48px. Menyatukan ketiganya di
// filter berarti menghapus perbedaan yang benar-benar ada.
//
// Ini daftar NILAI, bukan daftar label. Labelnya tetap diambil dari
// formatTreeCondition; tidak ada satu pun teks kondisi yang ditulis di berkas
// ini, dan peta tidak menjadi daftar label keenam di repo ini.
const FILTERABLE_CONDITIONS = allConditions([
  'healthy',
  'needs_attention',
  'pest_attacked',
  'disease_indicated',
  'damaged',
  'dead',
] as const);

type MapFilterCriteria = {
  conditions: readonly TreeConditionStatus[];
  phases: readonly FilterablePhase[];
};

const EMPTY_CRITERIA: MapFilterCriteria = { conditions: [], phases: [] };

function countActiveFilters(criteria: MapFilterCriteria): number {
  return criteria.conditions.length + criteria.phases.length;
}

function toggleValue<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

// Pencarian kode posisi. Substring, tanpa membedakan huruf besar-kecil, jadi
// "12-C", "12", dan "c" semuanya menjangkau 12-C.
//
// Kodenya sendiri dirakit dengan format yang sama di kedua sisi — sel berisi
// memakai tree_code dari database, sel kosong memakai kode yang disusun dari
// koordinatnya — jadi posisi kosong ikut tercari, bukan hanya pohon.
function matchesSearch(code: string, normalizedSearch: string): boolean {
  return normalizedSearch.length === 0 || code.toUpperCase().includes(normalizedSearch);
}

// Antar kelompok bersifat DAN, di dalam kelompok bersifat ATAU: memilih
// "Terserang Hama" dan "Berbunga" menyisakan pohon yang kena hama SEKALIGUS
// sedang berbunga, bukan gabungan keduanya.
function matchesFilter(tree: Tree, criteria: MapFilterCriteria): boolean {
  if (criteria.conditions.length > 0 && !criteria.conditions.includes(tree.currentCondition)) {
    return false;
  }

  if (criteria.phases.length > 0) {
    const phase = tree.currentGrowthPhase;

    if (!phase || !criteria.phases.includes(phase as FilterablePhase)) {
      return false;
    }
  }

  return true;
}

// Sel kosong tidak punya kondisi maupun fase, jadi ia TIDAK BISA memenuhi
// filter apa pun — begitu ada satu filter aktif, ia otomatis ikut diredupkan.
// Pencarian tetap menjangkaunya, karena kodenya ada.
function isCellMatched(
  code: string,
  tree: Tree | undefined,
  normalizedSearch: string,
  criteria: MapFilterCriteria,
  filterActive: boolean
): boolean {
  if (!matchesSearch(code, normalizedSearch)) {
    return false;
  }

  if (!filterActive) {
    return true;
  }

  return tree ? matchesFilter(tree, criteria) : false;
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
// Lembar keterangan
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

// Sel contoh seukuran sel terkecil, dipakai sebagai swatch keterangan supaya
// yang dilihat di lembar ini sama persis dengan yang dilihat di peta.
function LegendCell({ condition }: { condition: TreeConditionStatus }) {
  const visual = CONDITION_VISUALS[condition];
  const size = Math.round(CELL_SIZE_COMPACT * 0.72);
  const markSize = Math.round(size * 0.3);
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
      <View style={{ left: markInset, position: 'absolute', top: markInset }}>
        <ConditionMark color={visual.markColor} shape={visual.markShape} size={markSize} />
      </View>
    </View>
  );
}

function LegendSheet({ onClose, visible }: { onClose: () => void; visible: boolean }) {
  const size = Math.round(CELL_SIZE_COMPACT * 0.72);
  const phaseMarkSize = Math.round(size * 0.3);

  return (
    <BottomSheet
      onClose={onClose}
      subtitle="Kondisi ditandai di pojok kiri atas, fase pertumbuhan di pojok kanan atas."
      title="Keterangan peta"
      visible={visible}
    >
      <View>
        {/* Label kondisi diambil dari formatTreeCondition, bukan ditulis ulang
            di sini. Peta tidak boleh menjadi daftar label keenam di repo ini. */}
        <LegendRow
          description="Tidak diberi tanda apa pun."
          label={formatTreeCondition('healthy')}
          swatch={<LegendCell condition="healthy" />}
        />
        <LegendRow
          description="Tanda kotak."
          label={formatTreeCondition('needs_attention')}
          swatch={<LegendCell condition="needs_attention" />}
        />
        <LegendRow
          description="Tanda segitiga. Ketiganya satu tanda di peta; bedanya terlihat setelah pohon dibuka."
          label={[
            formatTreeCondition('pest_attacked'),
            formatTreeCondition('disease_indicated'),
            formatTreeCondition('damaged'),
          ].join(' · ')}
          swatch={<LegendCell condition="pest_attacked" />}
        />
        <LegendRow
          description="Tanda kotak bersilang, dan satu garis melintasi sel."
          label={formatTreeCondition('dead')}
          swatch={<LegendCell condition="dead" />}
        />
        <LegendRow
          description="Belum pernah ditanami. Tidak bisa ditekan."
          label="Posisi kosong"
          swatch={<EmptyMapCell cellSize={size} code="—" />}
        />

        <View style={{ backgroundColor: tokens.color.line.hairline, height: 1, marginVertical: tokens.space.sm }} />

        {/* Warnanya ikut dijelaskan, bukan hanya bentuknya: sejak berbuah tidak
            lagi biru, hijau dan oranye membawa arti sendiri — masih tumbuh
            lawan sudah bisa dipanen. Arti itu tidak bisa ditebak dari peta. */}
        <LegendRow
          description="Tanda bulat hijau di pojok kanan atas."
          label={formatGrowthPhase('flowering')}
          swatch={<PhaseMark {...PHASE_VISUALS.flowering} size={phaseMarkSize} />}
        />
        <LegendRow
          description="Tanda belah ketupat hijau. Hijau berarti pohon masih tumbuh."
          label={formatGrowthPhase('fruiting')}
          swatch={<PhaseMark {...PHASE_VISUALS.fruiting} size={phaseMarkSize} />}
        />
        <LegendRow
          description="Tanda palang oranye. Hanya fase ini yang berwarna oranye — pohonnya sudah bisa dipanen."
          label={formatGrowthPhase('harvesting')}
          swatch={<PhaseMark {...PHASE_VISUALS.harvesting} size={phaseMarkSize} />}
        />
      </View>
    </BottomSheet>
  );
}

// ---------------------------------------------------------------------------
// Lembar filter
// ---------------------------------------------------------------------------

function FilterGroup({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <View style={{ gap: tokens.space.sm, paddingBottom: tokens.space.lg }}>
      <Text selectable style={{ color: tokens.color.text.secondary, ...tokens.type.label }}>
        {title}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm }}>{children}</View>
    </View>
  );
}

function MapFilterSheet({
  draft,
  onApply,
  onClose,
  onDraftChange,
  visible,
}: {
  draft: MapFilterCriteria;
  onApply: () => void;
  onClose: () => void;
  onDraftChange: (next: MapFilterCriteria) => void;
  visible: boolean;
}) {
  const isEmpty = countActiveFilters(draft) === 0;

  return (
    <BottomSheet onClose={onClose} title="Filter peta" visible={visible}>
      <View>
        <View style={{ alignItems: 'flex-end', paddingBottom: tokens.space.sm }}>
          <Pressable
            accessibilityRole="button"
            disabled={isEmpty}
            hitSlop={{ bottom: 8, left: 8, right: 8, top: 8 }}
            onPress={() => onDraftChange(EMPTY_CRITERIA)}
          >
            <Text
              selectable={false}
              style={{
                color: isEmpty ? tokens.color.text.tertiary : tokens.color.brand.base,
                ...tokens.type.meta,
                fontWeight: '700',
              }}
            >
              Atur ulang
            </Text>
          </Pressable>
        </View>

        {/* Label dari formatTreeCondition dan formatGrowthPhase, bukan dari
            daftar baru. Yang ditulis di berkas ini hanya NILAI enumnya. */}
        <FilterGroup title="Kondisi">
          {FILTERABLE_CONDITIONS.map((condition) => (
            <ChipButton
              key={condition}
              active={draft.conditions.includes(condition)}
              label={formatTreeCondition(condition)}
              onPress={() =>
                onDraftChange({ ...draft, conditions: toggleValue(draft.conditions, condition) })
              }
            />
          ))}
        </FilterGroup>

        <FilterGroup title="Fase pertumbuhan">
          {FILTERABLE_PHASES.map((phase) => (
            <ChipButton
              key={phase}
              active={draft.phases.includes(phase)}
              label={formatGrowthPhase(phase)}
              onPress={() => onDraftChange({ ...draft, phases: toggleValue(draft.phases, phase) })}
            />
          ))}
        </FilterGroup>

        <Button onPress={onApply} title="Terapkan" variant="primary" />
      </View>
    </BottomSheet>
  );
}

// ---------------------------------------------------------------------------
// Chip filter aktif
//
// Bukan FilterChip dari ui.tsx: chip itu membawa glif chevron-down yang berarti
// "ketuk untuk membuka pilihan". Yang dibutuhkan di sini kebalikannya — ketuk
// untuk MEMBUANG — jadi glifnya silang, dan aksesibilitasnya menyebutkan itu.
// ---------------------------------------------------------------------------

function ActiveFilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Pressable
      accessibilityLabel={`Hapus filter ${label}`}
      accessibilityRole="button"
      onPress={onRemove}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: tokens.color.brand.soft,
        borderColor: tokens.color.brand.border,
        borderCurve: 'continuous',
        borderRadius: tokens.radius.pill,
        borderWidth: 1,
        flexDirection: 'row',
        gap: tokens.space.xs,
        minHeight: 36,
        opacity: pressed ? 0.82 : 1,
        paddingHorizontal: tokens.space.md,
      })}
    >
      <Text
        selectable={false}
        numberOfLines={1}
        style={{ color: tokens.color.brand.dark, ...tokens.type.meta, fontWeight: '700' }}
      >
        {label}
      </Text>
      <Icon name="x" size={tokens.icon.xs} color={tokens.color.brand.base} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Banner "belum ada varietas"
//
// HANYA untuk pemilik. Melengkapi varietas bukan pekerjaan pekerja, dan pesan
// yang tidak bisa ditindaklanjuti oleh yang membacanya cuma jadi gangguan yang
// menyita tinggi layar peta.
//
// Kalimatnya menyebut AKIBATNYA, bukan sekadar keadaannya: angka telanjang
// menyisakan pertanyaan "lalu kenapa", dan pertanyaan itu tidak dijawab siapa
// pun di layar ini.
// ---------------------------------------------------------------------------

function MissingVarietyBanner({ count, onPress }: { count: number; onPress: () => void }) {
  if (count === 0) {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor: tokens.color.status.warning.bg,
        borderColor: tokens.color.status.warning.border,
        borderCurve: 'continuous',
        borderRadius: tokens.radius.cardInner,
        borderWidth: 1,
        gap: tokens.space.sm,
        padding: tokens.space.md,
      }}
    >
      <Text selectable style={{ color: tokens.color.status.warning.text, ...tokens.type.bodySmall }}>
        {`${count} pohon belum ada varietas. Lengkapi supaya jadwal perawatan bisa dibuat.`}
      </Text>
      <Button onPress={onPress} size="small" title="Buka daftar pohon" variant="quiet" />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Pemberitahuan "tidak ada yang cocok"
//
// Peta TETAP digambar di bawahnya. Menggantinya dengan layar kosong akan
// membuang satu-satunya hal yang masih berguna saat pencarian meleset: gambaran
// kebun itu sendiri, dan bukti bahwa posisi yang dicari memang tidak ada di
// sana.
// ---------------------------------------------------------------------------

function NoMatchNotice({ onClear }: { onClear: () => void }) {
  return (
    <View
      style={{
        backgroundColor: tokens.color.surface.subtle,
        borderColor: tokens.color.line.card,
        borderCurve: 'continuous',
        borderRadius: tokens.radius.cardInner,
        borderWidth: 1,
        gap: tokens.space.sm,
        padding: tokens.space.md,
      }}
    >
      <Text selectable style={{ color: tokens.color.text.secondary, ...tokens.type.bodySmall }}>
        Tidak ada posisi yang cocok dengan pencarian dan filter ini.
      </Text>
      <Button onPress={onClear} size="small" title="Hapus pencarian dan filter" variant="quiet" />
    </View>
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
  const [compact, setCompact] = React.useState(true);
  const [criteria, setCriteria] = React.useState<MapFilterCriteria>(EMPTY_CRITERIA);
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [draft, setDraft] = React.useState<MapFilterCriteria>(EMPTY_CRITERIA);
  const [error, setError] = React.useState<string | null>(null);
  const [farm, setFarm] = React.useState<Farm | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = React.useState(false);
  const [legendOpen, setLegendOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [selectMode, setSelectMode] = React.useState(false);
  const [selection, setSelection] = React.useState<MapSelection>(NO_SELECTION);
  const [trees, setTrees] = React.useState<Tree[]>([]);

  const farmId = currentFarm?.farmId;
  const cellSize = compact ? CELL_SIZE_COMPACT : CELL_SIZE_LARGE;
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

      load().finally(() => setLoading(false));
    }, [load])
  );

  // Jeda 250ms, angka yang sama dengan daftar pohon. Bukan kerapian: setiap
  // ketikan yang lolos memicu render ulang SELURUH petak — 234 sel di kebun ini
  // — dan tanpa jeda, mengetik "12-C" berarti lima kali render penuh beruntun.
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim().toUpperCase()), 250);

    return () => clearTimeout(timer);
  }, [search]);

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

  const filterActive = countActiveFilters(criteria) > 0;
  const highlighting = filterActive || debouncedSearch.length > 0;

  // Kode posisi yang COCOK, dihitung satu kali untuk seluruh petak.
  //
  // null berarti tidak ada pencarian maupun filter yang aktif — dan itu keadaan
  // yang berbeda dari "himpunan kosong". null: jangan redupkan apa pun. Kosong:
  // redupkan semuanya, karena memang tidak ada yang cocok.
  //
  // Satu lintasan menghasilkan DUA jawaban sekaligus: apakah tiap sel cocok
  // (lewat .has di bawah) dan berapa yang cocok (lewat .size). Menghitungnya
  // dua kali akan berarti dua kali menyusuri petak untuk pertanyaan yang sama.
  const matchedCodes = React.useMemo(() => {
    if (!highlighting) {
      return null;
    }

    const codes = new Set<string>();

    for (const rowNumber of rowNumbers) {
      for (const columnNumber of columnNumbers) {
        const code = `${rowNumber}-${columnLetter(columnNumber)}`;

        if (isCellMatched(code, treeByPosition.get(code), debouncedSearch, criteria, filterActive)) {
          codes.add(code);
        }
      }
    }

    return codes;
  }, [columnNumbers, criteria, debouncedSearch, filterActive, highlighting, rowNumbers, treeByPosition]);

  // Posisi yang SEDANG ditanami tapi varietasnya kosong. Dihitung dari data
  // getTrees yang sudah dimuat — nol permintaan jaringan tambahan.
  //
  // Syaratnya activePlanting bukan null: posisi yang siklusnya sudah ditutup
  // memang tidak punya varietas untuk dilengkapi, dan menghitungnya akan
  // membesarkan angka dengan pekerjaan yang tidak ada.
  const missingVarietyCount = React.useMemo(
    () =>
      trees.filter((tree) => tree.activePlanting !== null && !tree.activePlanting.variety?.trim()).length,
    [trees]
  );

  const activeFilterChips = React.useMemo(
    () => [
      ...criteria.conditions.map((condition) => ({
        key: `condition:${condition}`,
        label: formatTreeCondition(condition),
        onRemove: () =>
          setCriteria((current) => ({
            ...current,
            conditions: current.conditions.filter((value) => value !== condition),
          })),
      })),
      ...criteria.phases.map((phase) => ({
        key: `phase:${phase}`,
        label: formatGrowthPhase(phase),
        onRemove: () =>
          setCriteria((current) => ({
            ...current,
            phases: current.phases.filter((value) => value !== phase),
          })),
      })),
    ],
    [criteria.conditions, criteria.phases]
  );

  function clearSearchAndFilters() {
    setCriteria(EMPTY_CRITERIA);
    setDraft(EMPTY_CRITERIA);
    setSearch('');
    // Dikosongkan langsung, tidak menunggu jeda 250ms: tombol "hapus" yang
    // hasilnya baru terlihat seperempat detik kemudian terasa seperti tidak
    // tertekan. Effect jeda tetap jalan dan menulis nilai yang sama.
    setDebouncedSearch('');
  }

  function openFilterSheet() {
    setDraft(criteria);
    setFilterSheetOpen(true);
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
      <View style={{ paddingHorizontal: tokens.layout.screenX }}>
        <TopAppBar onBack={() => router.back()} title="Denah Kebun" />
      </View>

      <View style={{ gap: tokens.space.sm, paddingBottom: tokens.space.md }}>
        <View style={{ paddingHorizontal: tokens.layout.screenX }}>
          <SearchFilterRow
            filterActive={filterActive}
            filterCount={countActiveFilters(criteria)}
            onChangeText={setSearch}
            onFilterPress={openFilterSheet}
            placeholder="Cari kode posisi, misal 12-C"
            value={search}
          />
        </View>

        {/* Deret chip hanya hadir kalau memang ada yang bisa dibuang. Baris
            kosong yang selalu ada cuma memakan tinggi yang dibutuhkan petak.
            paddingLeft, bukan paddingHorizontal: FilterChipsRow menggulung
            mendatar dan sudah menaruh padding kanannya sendiri. */}
        {activeFilterChips.length > 0 ? (
          <FilterChipsRow
            clearLabel="Hapus semua"
            hasActiveFilters
            onClear={() => setCriteria(EMPTY_CRITERIA)}
            style={{ paddingLeft: tokens.layout.screenX }}
          >
            {activeFilterChips.map((chip) => (
              <ActiveFilterChip key={chip.key} label={chip.label} onRemove={chip.onRemove} />
            ))}
          </FilterChipsRow>
        ) : null}

        <View
          style={{
            flexDirection: 'row',
            // Membungkus, karena barisnya kini bertiga untuk pemilik. Tanpa ini
            // ketiganya saling menekan di layar sempit dan judul tombol yang
            // numberOfLines={1} terpotong jadi "Keterang..." — tombol yang
            // labelnya terpotong berhenti menjelaskan apa yang akan terjadi.
            flexWrap: 'wrap',
            gap: tokens.space.sm,
            paddingHorizontal: tokens.layout.screenX,
          }}
        >
          {/* Label TINDAKAN, bukan keadaan: tombolnya memberi tahu apa yang akan
              terjadi kalau ditekan, bukan sedang di tingkat mana. */}
          <Button
            onPress={() => setCompact((current) => !current)}
            size="small"
            title={compact ? 'Perbesar' : 'Perkecil'}
            variant="secondary"
          />
          <Button onPress={() => setLegendOpen(true)} size="small" title="Keterangan" variant="secondary" />

          {/* HANYA pemilik. Peta pekerja tetap baca-saja — itu keputusan yang
              sudah diambil, bukan kelalaian, jadi tombolnya tidak dirender sama
              sekali alih-alih dirender lalu dinonaktifkan.

              Tombol adalah SATU-SATUNYA jalan masuk. Sengaja tanpa tekan-lama:
              peta digulung dua arah dengan jari mendarat di atas sel, jadi
              tekan-lama akan salah picu setiap kali orang menggulung pelan. */}
          {isOwner ? (
            <Button
              onPress={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
              size="small"
              title={selectMode ? 'Selesai' : 'Pilih'}
              variant="secondary"
            />
          ) : null}
        </View>

        <View style={{ gap: tokens.space.sm, paddingHorizontal: tokens.layout.screenX }}>
          <ErrorBanner message={error} />

          {isOwner ? (
            <MissingVarietyBanner
              count={missingVarietyCount}
              // Daftar pohon adalah layar tempat peta ini dibuka, jadi kembali
              // ke sana memang jalan yang benar. Idiomnya sama dengan
              // profile-screen: back kalau ada riwayat, kalau tidak baru pindah.
              // Pembuatan pohon massal belum ada, dan tahap ini tidak membuatnya.
              onPress={() => (router.canGoBack() ? router.back() : router.replace(basePath))}
            />
          ) : null}

          {matchedCodes !== null && matchedCodes.size === 0 ? (
            <NoMatchNotice onClear={clearSearchAndFilters} />
          ) : null}
        </View>
      </View>

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
                      // matchedCodes null = tidak ada pencarian/filter aktif, jadi
                      // tidak ada yang ditegaskan DAN tidak ada yang diredupkan.
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
                      // himpunan. Peredupan pencarian/filter tidak ikut
                      // menentukan: meredupkan adalah penunjuk perhatian, bukan
                      // larangan, jadi sel redup bersiklus aktif tetap bisa
                      // dipilih.
                      //
                      // Syarat kedua sejak tahap ini: himpunan yang sedang
                      // berjalan harus mengizinkan jenis 'tree'. Posisi
                      // bersiklus TERTUTUP tetap tidak bisa dipilih dalam
                      // keadaan apa pun — penanaman ulang massal bukan lingkup
                      // migrasi 062, dan jalur satu-per-satunya sudah ada di
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

      <MapFilterSheet
        draft={draft}
        onApply={() => {
          setCriteria(draft);
          setFilterSheetOpen(false);
        }}
        onClose={() => setFilterSheetOpen(false)}
        onDraftChange={setDraft}
        visible={filterSheetOpen}
      />

      <LegendSheet onClose={() => setLegendOpen(false)} visible={legendOpen} />
    </View>
  );
}
