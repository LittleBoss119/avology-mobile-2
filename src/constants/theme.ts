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
  // Satu-satunya warna literal yang tersisa di berkas ini. Ia hanya dipakai
  // sebagai shadowColor. Spek melarang shadow sepenuhnya, tapi mencabut shadow
  // mengubah tampilan, dan itu bukan pekerjaan batch 0.
  // TODO(batch berikutnya): cabut shadows/elevation, lalu hapus token ini.
  black: '#000000',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  screenHorizontal: 16,
  sectionGap: 18,
  cardPadding: 16,
  listGap: 12,
  buttonHeight: 52,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  round: 999,
  screenCard: 18,
  input: 14,
  button: 14,
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

export const shadows = {
  card: {
    shadowColor: colors.black,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  } satisfies ViewStyle,
  elevated: {
    shadowColor: colors.black,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  } satisfies ViewStyle,
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
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, xxxxl: 40 },
  layout: {
    screenX: 16, screenTop: 20, sectionGap: 24, cardPadding: 16,
    listGap: 12, rowMinHeight: 48, controlHeight: 56, tapTarget: 44,
    // fieldHeight (54) adalah promosi literal lama di <Field>, nilainya sengaja
    // TIDAK diubah supaya pemakaian Field yang ada tidak bergeser. Selisih 54 vs
    // controlHeight 56 kemungkinan tidak disengaja; rekonsiliasinya dijadwalkan
    // sebagai pass tersendiri dengan verifikasi visual, bukan di sini.
    fieldHeight: 54,
  },
  radius: { control: 14, tile: 12, cardInner: 16, card: 20, sheet: 28, pill: 999 },
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
  elevation: {
    overlay: {
      // TODO(batch berikutnya): ikut tercabut bersama shadows di atas.
      shadowColor: '#17231B', shadowOpacity: 0.1, shadowRadius: 16,
      shadowOffset: { width: 0, height: 4 }, elevation: 6,
    },
  },
} as const;
