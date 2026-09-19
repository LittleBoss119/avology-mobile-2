import { View } from 'react-native';

import { colors as palette } from '../theme/tokens';

// Penanda bentuk untuk badge yang membawa STATUS.
//
// Dibangun murni dari <View>. Tanpa pustaka, tanpa ikon SVG, tanpa karakter
// teks — dan ketiganya sengaja ditolak, bukan kebetulan tidak dipakai:
//
//   - Karakter teks (●, ▲, ✕) dirender oleh font yang tersedia di perangkat.
//     Bentuk, berat, dan garis dasarnya berbeda antar Android, dan sebagian
//     jatuh ke glif pengganti. Penanda yang berubah bentuk antar perangkat
//     tidak bisa dipelajari, dan itu satu-satunya gunanya.
//   - Ikon SVG di icons.tsx digambar bergaya STROKE pada viewBox 24. Pada 11px
//     goresannya menjadi ~0,9 piksel dan hilang di layar yang kena silau —
//     kondisi tempat aplikasi ini dipakai.
//
// KENAPA BENTUK, bukan warna saja: penanda ini menempel pada status yang
// sebagian besarnya dibedakan warna merah/kuning. Bagi mata yang tidak
// membedakan keduanya, badge Hama dan badge Perhatian tinggal label. Bentuk
// membawa arti yang sama tanpa bergantung pada rona.

export type StatusMarkerShape =
  | 'circle-outline'
  | 'circle-filled'
  | 'square'
  | 'triangle-up'
  | 'triangle-down'
  | 'cross';

// 11, bukan 10. Spek menyebut rentang 10-11; ujung atasnya yang dipilih karena
// dua bentuk di sini adalah segitiga yang saling berlawanan arah, dan keduanya
// berdiri bersebelahan di legenda denah. Di bawah 11 orientasinya tidak
// terbaca dan keduanya melebur jadi "gumpalan runcing" yang sama.
const DEFAULT_SIZE = 11;

// Lantai KERAS untuk kedua segitiga, berlaku berapa pun yang dikirim pemanggil.
// Bentuk lain boleh mengecil; segitiga tidak, karena yang hilang bukan
// detailnya melainkan artinya.
const TRIANGLE_MIN_SIZE = 11;

// Setebal ini garis lingkaran kosong dan kedua palang silang. 1,5 pada
// lingkaran dan 2 pada palang BUKAN ketidakkonsistenan: palang silang dipotong
// diagonal sehingga terbaca lebih tipis daripada garis lengkung setebal sama.
const OUTLINE_WIDTH = 1.5;
const CROSS_BAR_THICKNESS = 2;

export function StatusMarker({
  color,
  shape,
  size = DEFAULT_SIZE,
}: {
  color: string;
  shape: StatusMarkerShape;
  size?: number;
}) {
  if (shape === 'triangle-up' || shape === 'triangle-down') {
    const side = Math.max(size, TRIANGLE_MIN_SIZE);
    const half = side / 2;
    const pointsUp = shape === 'triangle-up';

    return (
      <View
        // Trik borderWidth: kotak berukuran nol yang hanya punya border. Dua
        // border samping dibuat transparan, satu border tegak lurus diberi
        // warna, dan yang tersisa terlihat sebagai segitiga.
        //
        // borderStyle 'solid' ditulis eksplisit. Tanpa itu sebagian Android
        // mewarisi gaya border dari induknya dan segitiganya keluar bergerigi.
        style={{
          backgroundColor: 'transparent',
          borderBottomColor: pointsUp ? color : 'transparent',
          borderBottomWidth: pointsUp ? side : 0,
          borderLeftColor: 'transparent',
          borderLeftWidth: half,
          borderRightColor: 'transparent',
          borderRightWidth: half,
          borderStyle: 'solid',
          borderTopColor: pointsUp ? 'transparent' : color,
          borderTopWidth: pointsUp ? 0 : side,
          height: 0,
          width: 0,
        }}
      />
    );
  }

  if (shape === 'cross') {
    return (
      <View style={{ alignItems: 'center', height: size, justifyContent: 'center', width: size }}>
        {/* Dua palang yang dirotasi berlawanan. Lebarnya size, bukan diagonal
            size*√2 — palang sepanjang diagonal penuh akan menyembul keluar
            kotak dan menabrak teks badge di sebelahnya. */}
        <View
          style={{
            backgroundColor: color,
            borderRadius: 1,
            height: CROSS_BAR_THICKNESS,
            position: 'absolute',
            transform: [{ rotate: '45deg' }],
            width: size,
          }}
        />
        <View
          style={{
            backgroundColor: color,
            borderRadius: 1,
            height: CROSS_BAR_THICKNESS,
            position: 'absolute',
            transform: [{ rotate: '-45deg' }],
            width: size,
          }}
        />
      </View>
    );
  }

  const isOutline = shape === 'circle-outline';

  return (
    <View
      style={{
        // Kotak diberi borderRadius 1, bukan 0. Sudut benar-benar tajam pada
        // 11px terbaca sebagai cacat render, bukan sebagai pilihan bentuk;
        // satu piksel lengkung sudah cukup untuk membacanya sebagai kotak yang
        // disengaja tanpa mendekati lingkaran.
        backgroundColor: isOutline ? 'transparent' : color,
        borderColor: isOutline ? color : undefined,
        borderRadius: shape === 'square' ? 1 : 999,
        borderWidth: isOutline ? OUTLINE_WIDTH : 0,
        height: size,
        width: size,
      }}
    />
  );
}

// Tampilan badge untuk keenam kondisi pohon: latar, garis, warna teks, bentuk
// penanda, dan warna penanda — satu baris per kondisi, satu tempat.
//
// Terpisah dari komponennya supaya denah, legenda, dan badge tidak bisa berbeda
// pendapat soal bentuk mana milik siapa. Kuncinya sengaja string lebar, bukan
// TreeConditionStatus: berkas ini tidak mengimpor tipe domain, dan pengikatan
// ke tipe itu dilakukan di tree-components.tsx.
//
// WARNA PENANDA SENGAJA BEDA DARI WARNA TEKS, dan itu bukan kelalaian.
// Pasangan teks-di-atas-latar di sini sudah dihitung dan lolos AA justru karena
// memakai varian `-Ink` yang digelapkan. Penanda adalah BIDANG warna, bukan
// bentuk huruf setipis 1px, jadi ia memakai token dasarnya yang lebih terang
// dan tetap terbaca. Jangan menukar `-Ink` dengan token dasarnya untuk teks,
// dan jangan menyeragamkan keduanya jadi satu nilai.
export const CONDITION_BADGE = {
  // Satu-satunya yang BERGARIS dan tanpa latar. Sehat bukan masalah, jadi ia
  // tidak diberi bidang warna sama sekali — aturan warna yang mengikat:
  // warna hanya muncul bila ada masalah.
  healthy: {
    background: 'transparent',
    border: palette.borderStrong,
    text: palette.textPrimary,
    shape: 'circle-outline',
    markerColor: palette.neutralCell,
  },
  needs_attention: {
    background: palette.statusPerhatianBg,
    border: null,
    text: palette.statusPerhatianInk,
    shape: 'triangle-up',
    markerColor: palette.statusPerhatian,
  },
  pest_attacked: {
    background: palette.statusBurukBg,
    border: null,
    text: palette.statusBurukInk,
    shape: 'square',
    markerColor: palette.statusBuruk,
  },
  disease_indicated: {
    background: palette.statusBurukBg,
    border: null,
    text: palette.statusBurukInk,
    shape: 'circle-filled',
    markerColor: palette.statusBuruk,
  },
  // Segitiga menunjuk BAWAH, lawan arah dari 'Perlu perhatian'. Rusak ada di
  // keluarga "buruk" bersama Hama dan Sakit — warnanya statusBuruk, bukan
  // statusPerhatian — tapi ia butuh bentuknya sendiri, dan lima bentuk lain
  // sudah terpakai. Arah yang berlawanan juga membacanya dengan benar:
  // perhatian menunjuk naik sebagai peringatan, rusak menunjuk turun.
  //
  // Kondisi ini TIDAK ADA di tabel spek, yang hanya mendaftar lima. Aplikasi
  // punya enam (lihat TreeConditionStatus di types/domain.ts). Barisnya
  // ditetapkan terpisah; spek yang menyusul.
  damaged: {
    background: palette.statusBurukBg,
    border: null,
    text: palette.statusBurukInk,
    shape: 'triangle-down',
    markerColor: palette.statusBuruk,
  },
  // Mati memakai surfaceSunken, bukan statusBurukBg. Ia bukan masalah yang
  // menunggu ditindaklanjuti — ia keadaan akhir, dan sudah selesai.
  dead: {
    background: palette.surfaceSunken,
    border: null,
    text: palette.statusMati,
    shape: 'cross',
    markerColor: palette.statusMati,
  },
} as const satisfies Record<
  string,
  {
    background: string;
    border: string | null;
    text: string;
    shape: StatusMarkerShape;
    markerColor: string;
  }
>;
