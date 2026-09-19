import type { TextStyle, ViewStyle } from 'react-native';

import { colors as palette } from '../theme/tokens';

// LAPISAN ALIH. Berkas ini tidak lagi memuat nilai warna sendiri — semuanya
// merujuk ke src/theme/tokens.ts. Nama ekspor, bentuk objek, spacing, radius,
// typography, dan shadows sengaja TIDAK diubah supaya 53 berkas pemakai tidak
// perlu disentuh dan tata letak tidak bergeser sedikit pun.
//
// Token lama yang dulu melayani dua peran (latar dan teks) di sini dipetakan ke
// peran DOMINAN-nya. Titik pakai minoritas sudah dialihkan langsung ke token
// yang benar di berkas masing-masing — lihat catatan batch 0.
//
// Hijau tidak dipakai di antarmuka sama sekali. palette.brandGreen hanya untuk
// logo dan splash.

export const colors = {
  primaryGreen: palette.accentText,
  primaryGreenDark: palette.accentPressed,
  primaryGreenSoft: palette.surfaceSunken,
  background: palette.surface,
  surfaceSoft: palette.surfaceSunken,
  textPrimary: palette.textPrimary,
  textSecondary: palette.textMuted,
  textMuted: palette.textMuted,
  bg: palette.surface,
  surface: palette.surfaceRaised,
  surfaceMuted: palette.surfaceSunken,
  surfaceGreen: palette.surfaceSunken,
  primary: palette.accentText,
  primaryDark: palette.accentPressed,
  primarySoft: palette.surfaceSunken,
  primaryBorder: palette.border,
  text: palette.textPrimary,
  textSoft: palette.textMuted,
  border: palette.border,
  divider: palette.border,
  textMutedLegacy: palette.textMuted,
  warning: palette.statusPerhatianInk,
  warningBg: palette.statusPerhatianBg,
  warningBorder: palette.statusPerhatian,
  danger: palette.statusBurukInk,
  dangerBg: palette.statusBurukBg,
  dangerBorder: palette.statusBuruk,
  // success dan info sengaja netral, bukan hijau dan bukan biru. Aturan warna
  // yang mengikat: warna hanya muncul bila ada masalah. Keduanya bukan masalah,
  // jadi pembedanya bentuk dan teks, bukan rona. Badge bergaris untuk sukses
  // dibangun di batch 1.
  success: palette.textPrimary,
  successBg: palette.surfaceSunken,
  successBorder: palette.border,
  info: palette.textPrimary,
  infoBg: palette.surfaceSunken,
  infoBorder: palette.border,
  neutral: palette.textMuted,
  neutralBg: palette.surfaceSunken,
  neutralBorder: palette.border,
  // pending TETAP berwarna: ia keadaan yang menunggu tindakan.
  pending: palette.statusPerhatianInk,
  pendingBg: palette.statusPerhatianBg,
  pendingBorder: palette.statusPerhatian,
  photoPlaceholder: palette.photoPlaceholderA,
  white: palette.textOnAccent,
  // Satu-satunya warna literal yang tersisa di berkas ini, dan sejak batch 1a
  // ia TIDAK DIPAKAI sama sekali: shadows di bawah sudah dikosongkan, dan ia
  // hanya pernah menjadi shadowColor.
  //
  // Sengaja TIDAK dihapus. `colors` diimpor 53 berkas sebagai satu objek, dan
  // membuang anggotanya adalah penghapusan ekspor — persis yang dilarang
  // batasan keras batch ini. Biayanya satu baris mati; biaya salahnya adalah
  // kompilasi gagal di berkas yang belum sempat diperiksa.
  // TODO(batch 1b+): hapus setelah dipastikan nol pemakai.
  black: '#000000',
} as const;

// Diselaraskan ke skala spek di batch 1b: 4 - 8 - 12 - 18 - 22 - 26, dengan 32
// sebagai perpanjangan yang disetujui (lihat catatan pada `space` di
// src/theme/tokens.ts).
//
// xs, sm, dan md TIDAK bergerak — nilainya sudah ada di skala. Itu penting:
// keempat entri dengan pemakaian tertinggi (sm 72x, md 71x, dan padanannya di
// tokens.space) semuanya ada di kelompok yang tidak berubah, jadi perubahan
// terluas di batch ini justru tidak menyentuh titik pakai terbanyak.
//
// '4xl' (40) dibiarkan di luar skala: nol pemakaian, dan menebak langkah
// kedelapan untuk sesuatu yang tidak dipakai siapa pun adalah karangan.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 22,
  '2xl': 26,
  '3xl': 32,
  '4xl': 40,
  // 16 -> 20 (batch 1a). SATU-SATUNYA angka yang berubah di objek ini. Skala
  // umum xs..4xl sengaja dibiarkan utuh — itu pekerjaan batch 1b.
  //
  // Ia bukan bagian skala itu: ia padding tepi layar, dan spek menyebutnya
  // sebagai angka tersendiri. Mengubahnya di sini menggeser tepi kiri-kanan
  // setiap layar yang memakai Screen sekaligus, yang memang tujuannya.
  screenHorizontal: 20,
  sectionGap: 18,
  // 16 -> 18, ikut lg.
  cardPadding: 18,
  listGap: 12,
  // Tinggi, bukan jarak. Tidak ikut skala spacing. Nol pemakaian.
  buttonHeight: 52,
} as const;

// Batch 1a menyentuh DUA entri saja: input dan button, 14 -> 10.
//
// Sembilan entri sisanya — sm, md, lg, xl, 2xl, screenCard, imageCard, dan
// pasangannya tokens.radius.cardInner/card — semuanya radius KARTU, gambar, dan
// banner. Spek tidak memberi peran untuk itu, dan sebagian besar kartunya
// dibongkar di batch 3 dan 7. Menyetel radiusnya sekarang adalah kerja yang
// langsung terbuang, jadi dibiarkan apa adanya.
//
// Akibat yang diterima sadar: untuk sementara ada tombol radius 10 duduk di
// dalam kartu radius 14/16/20. Itu keadaan antara yang disengaja, bukan
// kelalaian — jangan "dirapikan" sebelum kartunya sendiri diputuskan.
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  round: 999,
  screenCard: 18,
  input: 10,
  button: 10,
  chip: 999,
  imageCard: 16,
} as const;

type FontWeight = TextStyle['fontWeight'];

export const typography = {
  display: { fontSize: 32, fontWeight: '700' as FontWeight, lineHeight: 38 },
  h1: { fontSize: 28, fontWeight: '700' as FontWeight, lineHeight: 34 },
  h2: { fontSize: 22, fontWeight: '700' as FontWeight, lineHeight: 28 },
  h3: { fontSize: 18, fontWeight: '600' as FontWeight, lineHeight: 24 },
  title: { fontSize: 30, fontWeight: '700' as FontWeight, lineHeight: 36 },
  screenTitle: { fontSize: 20, fontWeight: '700' as FontWeight, lineHeight: 26 },
  sectionTitle: { fontSize: 17, fontWeight: '600' as FontWeight, lineHeight: 23 },
  body: { fontSize: 16, fontWeight: '400' as FontWeight, lineHeight: 22 },
  bodyStrong: { fontSize: 16, fontWeight: '600' as FontWeight, lineHeight: 22 },
  small: { fontSize: 14, fontWeight: '400' as FontWeight, lineHeight: 20 },
  meta: { fontSize: 13, fontWeight: '400' as FontWeight, lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '600' as FontWeight, lineHeight: 16 },
  badge: { fontSize: 12, fontWeight: '600' as FontWeight, lineHeight: 16 },
  navLabel: { fontSize: 11, fontWeight: '600' as FontWeight, lineHeight: 14 },
} as const;

// DIKOSONGKAN di batch 1a. Spek: hierarki dibentuk garis 1px, beda bidang, dan
// ruang kosong — tidak ada bayangan di mana pun.
//
// Kedua entri sengaja TETAP ADA sebagai objek kosong, bukan dihapus. Menyebar
// `...shadows.card` ke sebuah style tetap sah dan sekarang tidak menambahkan
// apa-apa, jadi tidak satu pun pemanggil perlu disentuh. Keduanya kebetulan
// nol pemanggil saat ini, tapi bentuk ini yang membuat `tokens.elevation` di
// bawah — yang PUNYA dua pemanggil — bisa ikut dikosongkan dengan cara sama.
//
// Tidak ada yang kehilangan batas: setiap kartu yang dulu memakainya sudah
// punya garis 1px sendiri.
export const shadows = {
  card: {} satisfies ViewStyle,
  elevated: {} satisfies ViewStyle,
} as const;

export const statusColors = {
  success: {
    text: colors.success,
    background: colors.successBg,
    border: colors.successBorder,
  },
  warning: {
    text: colors.warning,
    background: colors.warningBg,
    border: colors.warningBorder,
  },
  danger: {
    text: colors.danger,
    background: colors.dangerBg,
    border: colors.dangerBorder,
  },
  pending: {
    text: colors.pending,
    background: colors.pendingBg,
    border: colors.pendingBorder,
  },
  info: {
    text: colors.info,
    background: colors.infoBg,
    border: colors.infoBorder,
  },
  neutral: {
    text: colors.neutral,
    background: colors.neutralBg,
    border: colors.neutralBorder,
  },
} as const;

export const theme = {
  colors,
  spacing,
  radius,
  typography,
  shadows,
  statusColors,
} as const;

export type StatusTone = keyof typeof statusColors;

export const tokens = {
  color: {
    brand:   { base: palette.accentText, dark: palette.accentPressed, soft: palette.surfaceSunken, border: palette.border, on: palette.textOnAccent },
    text:    { primary: palette.textPrimary, secondary: palette.textMuted, tertiary: palette.textMuted, onBrand: palette.textOnAccent, onBrandMuted: palette.textOnAccent },
    surface: { canvas: palette.surface, card: palette.surfaceRaised, subtle: palette.surfaceSunken },
    line:    { card: palette.border, hairline: palette.border },
    status: {
      success: { text: palette.textPrimary, bg: palette.surfaceSunken, border: palette.border },
      warning: { text: palette.statusPerhatianInk, bg: palette.statusPerhatianBg, border: palette.statusPerhatian },
      danger:  { text: palette.statusBurukInk, bg: palette.statusBurukBg, border: palette.statusBuruk },
      info:    { text: palette.textPrimary, bg: palette.surfaceSunken, border: palette.border },
      neutral: { text: palette.textMuted, bg: palette.surfaceSunken, border: palette.border },
    },
    // Ketiga badge record selain `condition` kini identik netral. Itu disengaja:
    // jenis catatan bukan masalah, jadi tidak diberi warna. Pembedanya label
    // jenis, dan mulai batch 1 ditambah penanda bentuk (belah ketupat, kotak,
    // lingkaran) sesuai bagian Timeline riwayat pohon. Nilai penanda itu aman
    // sebagai bentuk, bukan sebagai warna teks — sebagai teks 13px di atas
    // surfaceSunken kontrasnya ~4,1 dan gagal ambang AA.
    record: {
      condition: { text: palette.statusPerhatianInk, bg: palette.statusPerhatianBg, border: palette.statusPerhatian },
      phase:     { text: palette.textPrimary, bg: palette.surfaceSunken, border: palette.border },
      harvest:   { text: palette.textPrimary, bg: palette.surfaceSunken, border: palette.border },
      care:      { text: palette.textPrimary, bg: palette.surfaceSunken, border: palette.border },
    },
    // `viewer` SENGAJA bukan `scrim`, dan keduanya tidak boleh disatukan.
    // scrim menggelapkan layar di balik lembar/sheet yang isinya masih perlu
    // terbaca sebagian; viewer menggelapkan latar di balik SATU foto yang sedang
    // diperiksa, jadi ia lebih gelap dan lebih pekat supaya mata tidak terganggu
    // apa pun di sekitarnya. Opasitas ketiganya dipertahankan apa adanya dari
    // palet lama; yang berubah hanya rona.
    overlay: {
      scrim: palette.overlayScrim,
      scrimLight: palette.overlayScrimLight,
      viewer: palette.overlayViewer,
      // Entri keempat: selubung unggah foto. Perannya sendiri, bukan turunan
      // scrim — opasitasnya 0,28 dan tidak boleh disamakan dengan yang lain.
      upload: palette.overlayUpload,
    },
  },
  // Skala yang sama dengan `spacing` di atas, dan keduanya WAJIB tetap sama.
  // lg 16->18, xl 20->22, xxl 24->26 (batch 1b). xxxl 32 adalah perpanjangan
  // yang disetujui; xxxxl 40 dibiarkan di luar skala, nol pemakaian.
  space: { xs: 4, sm: 8, md: 12, lg: 18, xl: 22, xxl: 26, xxxl: 32, xxxxl: 40 },
  layout: {
    // screenX 16 -> 20 (batch 1a), sejalan dengan spacing.screenHorizontal.
    // Keduanya padding tepi layar; membiarkan salah satunya di 16 akan membuat
    // layar denah bertepi lebih rapat daripada seluruh layar lain.
    // screenTop 20->22, sectionGap 24->26, cardPadding 16->18 (batch 1b),
    // mengikuti skala spacing di atas.
    //
    // Empat entri terakhir adalah TINGGI, bukan jarak, jadi tidak ikut skala:
    // rowMinHeight dan tapTarget adalah target sentuh, controlHeight dan
    // fieldHeight adalah tinggi kontrol yang dikunci batch 1a.
    screenX: 20, screenTop: 22, sectionGap: 26, cardPadding: 18,
    listGap: 12, rowMinHeight: 48, controlHeight: 56, tapTarget: 44,
    // 54 -> 52 (batch 1a). Selisih 54 vs controlHeight 56 memang tidak
    // disengaja, dan rekonsiliasinya terjadi di sini: 52 adalah tinggi kolom
    // isian dan tombol sekunder, 56 tinggi tombol utama. Dua angka, dua peran.
    fieldHeight: 52,
  },
  // control 14 -> 10, sheet 28 -> 18, tile 12 -> 8 (batch 1a).
  //
  // `tile` adalah radius sel denah kebun ([farm-map-screen.tsx] sel peta dan
  // sel yang diperbesar), bukan radius ubin generik — namanya menyesatkan,
  // perannya tidak. cardInner dan card TIDAK disentuh; lihat catatan pada
  // `radius` di atas.
  radius: { control: 10, tile: 8, cardInner: 16, card: 20, sheet: 18, pill: 999 },
  type: {
    display:    { fontSize: 32, fontWeight: '700', lineHeight: 38 },
    title:      { fontSize: 24, fontWeight: '700', lineHeight: 30 },
    heading:    { fontSize: 20, fontWeight: '700', lineHeight: 26 },
    subheading: { fontSize: 17, fontWeight: '600', lineHeight: 23 },
    body:       { fontSize: 16, fontWeight: '400', lineHeight: 22 },
    bodySmall:  { fontSize: 14, fontWeight: '400', lineHeight: 20 },
    bodyStrong: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
    label:      { fontSize: 14, fontWeight: '500', lineHeight: 20 },
    meta:       { fontSize: 13, fontWeight: '400', lineHeight: 18 },
    caption:    { fontSize: 12, fontWeight: '600', lineHeight: 16 },
  },
  icon: { xs: 14, sm: 16, md: 20, lg: 24, stroke: 2 },
  // DIKOSONGKAN di batch 1a, bersama `shadows` di atas.
  //
  // Ini yang benar-benar menggerakkan sesuatu: dua pemanggilnya nyata —
  // panel di farm-map-screen.tsx dan snackbar.tsx, keduanya menyebar
  // `...tokens.elevation.overlay`. Sebaran objek kosong tetap sah, jadi tidak
  // ada berkas yang perlu disentuh; keduanya kehilangan bayangannya saja.
  //
  // Snackbar perlu diperiksa di perangkat: ia MELAYANG di atas isi layar dan
  // bayangan adalah satu-satunya yang memisahkannya dari latar. Kalau ia jadi
  // sulit dibedakan, jawabannya garis 1px, bukan bayangan yang dikembalikan.
  elevation: {
    overlay: {},
  },
} as const;
