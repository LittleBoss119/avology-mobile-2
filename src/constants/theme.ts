import type { TextStyle, ViewStyle } from 'react-native';

export const colors = {
  primaryGreen: '#065F2E',
  primaryGreenDark: '#044722',
  primaryGreenSoft: '#E7F5EC',
  background: '#F7FAF3',
  surfaceSoft: '#F1F6EA',
  textPrimary: '#17231B',
  textSecondary: '#5B6B60',
  textMuted: '#8A978D',
  bg: '#F7FAF3',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F6EA',
  surfaceGreen: '#E7F5EC',
  primary: '#065F2E',
  primaryDark: '#044722',
  primarySoft: '#E7F5EC',
  primaryBorder: '#B7DFC0',
  text: '#17231B',
  textSoft: '#8A978D',
  border: '#DDE8D8',
  divider: '#E7EEE3',
  textMutedLegacy: '#647067',
  warning: '#B7791F',
  warningBg: '#FFF4D6',
  warningBorder: '#F3D78A',
  danger: '#C2410C',
  dangerBg: '#FDE7E7',
  dangerBorder: '#F2B8B5',
  success: '#16803C',
  successBg: '#E2F6E8',
  successBorder: '#B8E3C3',
  info: '#2563EB',
  infoBg: '#E8F1FF',
  infoBorder: '#BDD6FF',
  neutral: '#4B5563',
  neutralBg: '#F3F4F6',
  neutralBorder: '#E5E7EB',
  pending: '#6B5B00',
  pendingBg: '#FFF8D8',
  pendingBorder: '#EEE3A0',
  photoPlaceholder: '#EAF0E6',
  white: '#FFFFFF',
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
    brand:   { base: '#065F2E', dark: '#044722', soft: '#E7F5EC', border: '#B7DFC0', on: '#FFFFFF' },
    text:    { primary: '#17231B', secondary: '#5B6B60', tertiary: '#8A978D', onBrand: '#FFFFFF', onBrandMuted: '#DDEFE2' },
    surface: { canvas: '#F7FAF3', card: '#FFFFFF', subtle: '#F1F6EA' },
    line:    { card: '#DDE8D8', hairline: '#E7EEE3' },
    status: {
      success: { text: '#16803C', bg: '#E2F6E8', border: '#B8E3C3' },
      warning: { text: '#B7791F', bg: '#FFF4D6', border: '#F3D78A' },
      danger:  { text: '#C2410C', bg: '#FDE7E7', border: '#F2B8B5' },
      info:    { text: '#2563EB', bg: '#E8F1FF', border: '#BDD6FF' },
      neutral: { text: '#4B5563', bg: '#F3F4F6', border: '#E5E7EB' },
    },
    record: {
      condition: { text: '#7A5600', bg: '#FCEFC7', border: '#EBD9A0' },
      phase:     { text: '#065F2E', bg: '#E7F5EC', border: '#B7DFC0' },
      harvest:   { text: '#9A4C0A', bg: '#FDEBD9', border: '#F2C69B' },
      care:      { text: '#184E91', bg: '#E7EEF8', border: '#C2D4EC' },
    },
    overlay: { scrim: 'rgba(23,35,27,0.45)', scrimLight: 'rgba(23,35,27,0.12)' },
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
      shadowColor: '#17231B', shadowOpacity: 0.1, shadowRadius: 16,
      shadowOffset: { width: 0, height: 4 }, elevation: 6,
    },
  },
} as const;
