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

  // Isian netral untuk keadaan SEHAT — bukan token khusus denah. Dipakai di sel
  // denah kebun dan di segmen sehat pada bilah proporsi: dua bentuk untuk hal
  // yang sama. Sehat bukan masalah, jadi ia tidak diberi warna status; nilainya
  // dinaikkan dari #C6BEB2 ke 3,55 terhadap surface justru supaya bidang netral
  // ini tetap terlihat sebagai bidang.
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
  // lineHeight EKSPLISIT, sekitar 1,1x ukuran huruf. Keempatnya sebelumnya
  // tanpa lineHeight sama sekali, dan itu bukan pilihan melainkan kelalaian
  // yang tidak terlihat di satu perangkat.
  //
  // Tanpa lineHeight, Android memakai metrik font apa adanya. Source Serif 4
  // pada 72 dan 80 punya ascender yang melewati kotak baris bawaan, dan
  // akibatnya angka di Beranda TERPOTONG di bagian atas — pada sebagian
  // perangkat saja, tergantung bagaimana pabrikannya menangani font padding.
  // Bug semacam ini tidak akan ketahuan dari satu HP uji.
  //
  // 1,1x, bukan 1,2x seperti teks tubuh: ini angka SATU BARIS yang tidak
  // pernah membungkus, jadi yang dibutuhkan hanya ruang untuk glifnya sendiri,
  // bukan jarak antarbaris. Nilai yang lebih besar akan menambah ruang kosong
  // di atas dan di bawah angka, dan pada 80px ruang itu terlihat sebagai
  // sapaan yang menggantung jauh dari angkanya.
  //
  // includeFontPadding SENGAJA tidak disentuh: ia prop <Text> per titik pakai,
  // bukan bagian dari skala tipografi, dan mematikannya di sini berarti
  // mengubah perilaku yang tidak bisa dilihat dari berkas token.
  stat36: { fontFamily: fonts.serif, fontSize: 36, lineHeight: 40 },
  stat40: { fontFamily: fonts.serif, fontSize: 40, lineHeight: 44 },
  stat72: { fontFamily: fonts.serif, fontSize: 72, lineHeight: 79 },
  stat80: { fontFamily: fonts.serif, fontSize: 80, lineHeight: 88 },
} as const satisfies Record<string, TextStyle>;

// Skala jarak. Enam langkah pertama — 4, 8, 12, 18, 22, 26 — adalah skala spek
// apa adanya.
//
// `xxxl: 32` adalah PERPANJANGAN DI LUAR SPEK, ditambahkan di batch 1b dengan
// persetujuan eksplisit. Jangan "mengoreksi"-nya kembali ke 26.
//
// Alasannya: skala spek berhenti di 26, sedangkan aplikasi punya enam titik
// yang butuh jarak lebih besar dari itu — ruang antarblok di layar Masuk dan
// Daftar, paddingBottom daftar denah, dan cadangan bawah <Screen> yang menjaga
// isi terakhir tidak tertutup bar aksi. Memampatkan semuanya ke 26 menyempitkan
// kelima tempat itu tanpa ada yang meminta.
//
// Rasionya sejalan dengan langkah sebelumnya: 22 -> 26 adalah 1,18; 26 -> 32
// adalah 1,23. Ia langkah ketujuh yang wajar, bukan angka yang diselundupkan.
export const space = { xs: 4, sm: 8, md: 12, lg: 18, xl: 22, xxl: 26, xxxl: 32 } as const;
export const screenPadding = 20;
// `cellFar` adalah radius sel denah pada ZOOM JAUH (16px), dan ia berdiri
// sendiri dari `cell` (8, radius sel pada zoom dekat). Bukan dua nama untuk
// satu hal: radius 8 pada kotak 16px memakan separuh sisinya dan mengubah sel
// jadi bulatan, sehingga petak 234 sel terbaca sebagai hamparan titik alih-alih
// kisi berpetak. 3 adalah lengkung terkecil yang masih membedakan sel berisi
// (membulat) dari posisi kosong (bersudut tajam) pada ukuran itu.
export const radius = { control: 10, pill: 999, cell: 8, cellFar: 3, sheet: 18 } as const;
export const touch = {
  min: 48,
  primaryButton: 56,
  secondaryButton: 52,
  field: 52,
  fieldTall: 56,
  row: 48,
} as const;
