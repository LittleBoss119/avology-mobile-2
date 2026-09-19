import React from 'react';
import { Text, View } from 'react-native';

import { colors as palette, fonts, radius as shapeRadius, space } from '../theme/tokens';

// Kerangka memuat: bidang diam berbentuk isi yang akan datang.
//
// MENGGANTIKAN pemutar-di-tengah-layar. Pemutar memberi tahu "sesuatu sedang
// terjadi" dan tidak lebih; kerangka memberi tahu BENTUK apa yang sedang
// datang, jadi mata sudah tahu ke mana harus melihat sebelum datanya tiba, dan
// layar tidak melompat saat pemutar digantikan daftar.
//
// TANPA ANIMASI KILAU, dan itu keputusan yang dikunci, bukan pekerjaan yang
// belum sempat dilakukan. Kilau adalah gerakan yang berjalan terus-menerus di
// seluruh layar; pada perangkat kelas bawah — yang justru paling sering menunggu
// lama — ia memakan frame yang sedang dipakai mengurai respons, sehingga
// pemuatannya benar-benar jadi lebih lambat. Ia juga menarik perhatian ke
// sesuatu yang tidak bisa ditindaklanjuti siapa pun.

// Ambang "ini lebih lama dari biasanya". Layanan backend menerapkan idle
// timeout, jadi permintaan pertama setelah tidak aktif memang lebih lama dari
// permintaan berikutnya — baris penjelas yang muncul setelah ambang ini
// menjelaskan keterlambatan yang NYATA, bukan menghias yang biasa.
const SLOW_LOAD_THRESHOLD_MS = 5000;

const DEFAULT_SLOW_MESSAGE = 'Sedang menyiapkan data.';

/**
 * Satu bidang kerangka. Dipakai langsung kalau bentuk yang ditiru bukan daftar
 * baris seragam — misalnya satu blok judul atau satu kotak foto.
 */
export function SkeletonBlock({
  height,
  radius = shapeRadius.control,
  width = '100%',
}: {
  height: number;
  radius?: number;
  width?: number | `${number}%`;
}) {
  return (
    <View
      style={{
        backgroundColor: palette.surfaceSunken,
        borderRadius: radius,
        height,
        width,
      }}
    />
  );
}

/**
 * Deret baris kerangka.
 *
 * `rows` dan `rowHeight` sengaja jadi prop, bukan angka tetap: batch 2-7 meniru
 * bentuk isi layarnya masing-masing, dan daftar pohon (baris 48) tidak sama
 * dengan daftar jadwal berkartu (baris ~96). Kerangka yang bentuknya meleset
 * dari isi yang datang justru membuat lompatannya lebih terasa, bukan kurang.
 */
export function SkeletonList({
  gap = space.md,
  rowHeight = 48,
  rows = 4,
}: {
  gap?: number;
  rowHeight?: number;
  rows?: number;
}) {
  return (
    <View
      // Kerangka tidak membawa informasi dan tidak bisa ditindaklanjuti; bagi
      // pembaca layar ia kebisingan. Yang dibacakan adalah `accessibilityLabel`
      // di sini, sekali, bukan setiap bidangnya.
      accessible
      accessibilityLabel="Memuat"
      accessibilityRole="progressbar"
      style={{ gap }}
    >
      {Array.from({ length: rows }, (_, index) => (
        <SkeletonBlock key={index} height={rowHeight} />
      ))}
    </View>
  );
}

/**
 * Baris penjelas yang muncul HANYA setelah pemuatan melewati 5 detik.
 *
 * Dipisah jadi komponennya sendiri supaya penghitung waktunya hidup dan mati
 * bersama kerangka yang menampilkannya — begitu pemuatan selesai dan kerangka
 * dilepas, timer-nya ikut dibersihkan tanpa ada yang perlu mengingatnya.
 */
export function SlowLoadNotice({ message }: { message?: string }) {
  const [isSlow, setIsSlow] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setIsSlow(true), SLOW_LOAD_THRESHOLD_MS);

    return () => clearTimeout(timer);
  }, []);

  if (!isSlow) {
    return null;
  }

  return (
    <Text
      selectable
      style={{
        color: palette.textMuted,
        fontFamily: fonts.sans,
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
      }}
    >
      {message ?? DEFAULT_SLOW_MESSAGE}
    </Text>
  );
}
