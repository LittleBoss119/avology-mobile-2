import type { TextStyle } from 'react-native';

// Sumber tunggal token visual Avology. Berkas ini TIDAK diimpor langsung oleh
// layar. src/constants/theme.ts adalah lapisan alih yang merujuk ke sini, dan
// itulah yang diimpor 53 berkas. Susunan begitu supaya nilai warna berganti
// serentak tanpa satu pun berkas layar disentuh, jadi tata letak tidak bergeser.
//
// Mode gelap tidak ada. Tidak ada shadow dan tidak ada elevation di mana pun,
// jadi tidak disediakan tokennya.

// accent dipakai dua kali dengan arti berbeda (latar aksen, dan penanda panen di
// timeline). Diikat lewat satu const supaya keduanya tidak bisa berpisah diam-diam.
const accent = '#B4552E';

export const colors = {
  surface: '#F7F4EF',
  surfaceRaised: '#FFFDFA',
  surfaceSunken: '#EFEAE2',

  textPrimary: '#211D18',
  textMuted: '#6B6155',
  textOnAccent: '#FFFFFF',

  border: '#E2DCD2',
  // Empat token di bawah sengaja BERBEDA dari tabel token spek desain
  // (borderStrong #C9C0B3, neutralCell #C6BEB2, emptyCellBorder #A79C8C,
  // tabInactive #C6BEB2). Nilai spek gagal uji kontras dan sudah dikoreksi.
  // Jangan dikembalikan ke nilai spek.
  borderStrong: '#9A9081',

  accent,
  // accentPressed tidak ada di spek. Ditetapkan di sini sebagai pengganti
  // primaryPressed pada palet lama.
  accentPressed: '#98431F',
  accentText: '#A84D26',

  statusPerhatian: '#B07A16',
  statusPerhatianKuat: '#8F6310',
  statusPerhatianBg: '#F7ECD4',
  statusPerhatianInk: '#8A5D0A',

  statusBuruk: '#A8331F',
  statusBurukBg: '#F7E0DB',
  statusBurukInk: '#8C2A19',

  statusMati: '#4A4238',

  neutralCell: '#8F8676',
  emptyCellBorder: '#8F8676',
  tabInactive: '#6B6155',

  photoPlaceholderA: '#E7E2D9',
  photoPlaceholderB: '#EFEAE2',
  photoFailBg: '#F0E7E4',

  // HANYA untuk logo dan splash. Antarmuka tidak memakai hijau sama sekali.
  brandGreen: '#1E5134',

  // Penanda timeline riwayat pohon. markerPerawatan sengaja bernilai sama
  // dengan statusMati: dua nama, satu nilai, arti berbeda. Jangan digabung.
  markerFase: '#7A705F',
  markerPerawatan: '#4A4238',
  markerPanen: accent,

  // Penggelap latar. Tiga nilai, bukan satu: scrim menggelapkan layar di balik
  // sheet yang isinya masih perlu terbaca sebagian; viewer menggelapkan latar di
  // balik SATU foto yang sedang diperiksa, jadi lebih pekat supaya mata tidak
  // terganggu apa pun di sekitarnya. Jangan disatukan.
  //
  // Opasitas asli dari palet lama dipertahankan apa adanya; yang berubah hanya
  // rona, dari hitam kehijauan ke hitam hangat turunan textPrimary.
  overlayScrim: 'rgba(33, 29, 24, 0.45)',
  overlayScrimLight: 'rgba(33, 29, 24, 0.12)',
  overlayViewer: 'rgba(33, 29, 24, 0.78)',
  // Selubung "sedang mengunggah" di atas thumbnail foto. Opasitasnya sengaja di
  // antara scrimLight dan scrim: cukup pekat supaya keadaan memuat terbaca,
  // cukup tipis supaya foto yang sedang diunggah masih dikenali.
  overlayUpload: 'rgba(33, 29, 24, 0.28)',
} as const;

// Di Android, React Native TIDAK mensintesis berat untuk font kustom. Berat
// diatur lewat fontFamily, bukan fontWeight. Jangan pasangkan fontWeight pada
// style yang sudah memakai fonts.sansSemiBold.
export const fonts = {
  sans: 'IBMPlexSans_400Regular',
  sansSemiBold: 'IBMPlexSans_600SemiBold',
  serif: 'SourceSerif4_600SemiBold',
} as const;

// Skala tipografi, siap pakai sebagai style. Teks tubuh minimum 16; tidak ada
// entri di bawah 14.
export const text = {
  screenTitle: { fontFamily: fonts.sansSemiBold, fontSize: 26, textAlign: 'left' },
  screenTitleCentered: { fontFamily: fonts.sansSemiBold, fontSize: 17, textAlign: 'center' },
  rowTitle: { fontFamily: fonts.sansSemiBold, fontSize: 17 },
  rowTitleLarge: { fontFamily: fonts.sansSemiBold, fontSize: 21 },
  body: { fontFamily: fonts.sans, fontSize: 16 },
  meta: { fontFamily: fonts.sans, fontSize: 14 },
  metaLarge: { fontFamily: fonts.sans, fontSize: 15 },
  sectionLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  stat36: { fontFamily: fonts.serif, fontSize: 36 },
  stat40: { fontFamily: fonts.serif, fontSize: 40 },
  stat72: { fontFamily: fonts.serif, fontSize: 72 },
  stat80: { fontFamily: fonts.serif, fontSize: 80 },
} as const satisfies Record<string, TextStyle>;

export const space = { xs: 4, sm: 8, md: 12, lg: 18, xl: 22, xxl: 26 } as const;
export const screenPadding = 20;
export const radius = { control: 10, pill: 999, cell: 8, sheet: 18 } as const;
export const touch = {
  min: 48,
  primaryButton: 56,
  secondaryButton: 52,
  field: 52,
  fieldTall: 56,
  row: 48,
} as const;
