import React from 'react';
import { Modal, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { radius, spacing, tokens } from '../../constants/theme';
import { Button } from '../ui';

// Tinggi gambar sebagai PERSEN dari kotak berlatar gelap, bukan dari layar.
//
// Disimpan sebagai angka, bukan string '82%', supaya gaya tampilan dan
// perhitungan batas geser memakai SATU sumber. Kalau angka ini bergeser, kotak
// gambar dan batas pan bergeser bersamaan; menuliskannya dua kali adalah cara
// paling gampang membuat keduanya diam-diam berbeda.
const VIEWER_IMAGE_HEIGHT_PERCENT = 82;

// Skala saat gambar duduk tenang. Pan dimatikan tepat di angka ini.
const MIN_SCALE = 1;

// Batas perbesaran. Foto disimpan pada sisi terpanjang 1600 px (lihat
// MAX_PHOTO_DIMENSION_PX di src/lib/media.ts) sementara lebar layar HP sasaran
// sekitar 1080 px dan kotak viewer lebih sempit lagi. Di sekitar 4x, satu piksel
// berkas kira-kira sudah menempati satu piksel layar -- lebih jauh dari itu yang
// membesar hanyalah buburnya, bukan keterbacaan bercak pada daun.
const MAX_SCALE = 4;

// Batas bawah SELAMA jari masih menempel. Sengaja di bawah MIN_SCALE supaya
// cubitan mengecil terasa punya per, lalu dipantulkan kembali ke 1 saat dilepas.
const PINCH_FLOOR_SCALE = 0.5;

// Sasaran ketuk-dua-kali dari keadaan diam. Cukup dekat untuk membaca bercak
// tanpa langsung membuang konteks seluruh daun.
const DOUBLE_TAP_SCALE = 2.5;

const TIMING = { duration: 200 } as const;

// Sejauh mana gambar boleh digeser dari tengah pada skala tertentu.
//
// Pada skala s, gambar selebar `size` menjadi `size * s`, jadi bagian yang
// menjuntai keluar kotak di SATU sisi adalah setengah dari selisihnya. Membatasi
// geseran tepat sebesar itu berarti tepi gambar tidak pernah bisa ditarik masuk
// melewati tepi kotak: kotaknya selalu penuh terisi gambar, tidak pernah ada
// bidang kosong. Pada skala 1 hasilnya 0 -- itulah yang mengunci pan saat gambar
// belum dizoom.
function maxTranslate(size: number, currentScale: number): number {
  'worklet';

  return Math.max(0, (size * currentScale - size) / 2);
}

export type PhotoViewerModalProps = {
  onClose: () => void;
  photoUrl: string | null;
  visible: boolean;
};

// Viewer foto ukuran penuh yang dipakai bersama oleh SELURUH titik tampil foto.
//
// Sebelumnya ada tiga Modal yang hampir kembar dan sudah mulai menyimpang satu
// sama lain. Menyatukannya bukan sekadar merapikan: cubit-zoom di bawah ditulis
// sekali di sini, bukan tiga kali di tiga berkas.
//
// TIDAK menampilkan galeri. Satu foto per pemanggilan, sama seperti perilaku
// ketiga viewer yang digantikannya.
//
// Ini SATU-SATUNYA berkas di repo yang memakai Reanimated. Aturan proyek
// "Animated bawaan, bukan Reanimated" berlaku untuk animasi dekoratif seperti
// shimmer; zoom adalah gesture berkelanjutan yang nilainya harus diperbarui tiap
// bingkai di UI thread, dan Animated bawaan tidak bisa melakukannya tanpa
// tersendat. Jangan jadikan berkas ini alasan memakai Reanimated di tempat lain.
export function PhotoViewerModal({ onClose, photoUrl, visible }: PhotoViewerModalProps) {
  // Ukuran diambil dari jendela, BUKAN dari parent: <Modal> transparan tidak
  // memberi konteks layout seluruh layar secara otomatis, jadi mengandalkan
  // parent akan menghasilkan batas geser yang salah.
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  const boxWidth = Math.max(0, windowWidth - spacing.xl * 2);
  const boxHeight = Math.max(
    0,
    ((windowHeight - spacing.xl * 2) * VIEWER_IMAGE_HEIGHT_PERCENT) / 100
  );

  // Nilai hidup yang dibaca setiap bingkai di UI thread.
  const scale = useSharedValue(MIN_SCALE);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // Titik pijak gerakan berikutnya: nilai saat sebuah gesture DIMULAI. Tanpa ini
  // setiap cubitan atau geseran akan menumpuk dari nol dan gambar meloncat.
  const savedScale = useSharedValue(MIN_SCALE);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Kembalikan gambar ke keadaan diam. Dipanggil dari JS thread saja -- lewat
  // efek di bawah -- tidak pernah dari jalur gerakan.
  const resetTransform = React.useCallback(() => {
    scale.value = MIN_SCALE;
    savedScale.value = MIN_SCALE;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [savedScale, savedTranslateX, savedTranslateY, scale, translateX, translateY]);

  // WAJIB. Komponen ini hidup terus di pohon React meski Modal sedang tertutup,
  // dan satu instansnya dipakai ulang untuk foto yang berbeda-beda (lihat
  // PhotoAttachmentPreviewList yang menampilkan banyak foto lewat satu viewer).
  // Tanpa reset ini, foto berikutnya terbuka dalam keadaan sudah dizoom dan
  // tergeser ke posisi milik foto sebelumnya.
  React.useEffect(() => {
    resetTransform();
  }, [photoUrl, resetTransform, visible]);

  const pinch = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = clamp(savedScale.value * event.scale, PINCH_FLOOR_SCALE, MAX_SCALE);
    })
    .onEnd(() => {
      // Turun di bawah skala diam: pantulkan kembali ke 1 sekaligus ke tengah.
      if (scale.value < MIN_SCALE) {
        scale.value = withTiming(MIN_SCALE, TIMING);
        translateX.value = withTiming(0, TIMING);
        translateY.value = withTiming(0, TIMING);
        savedScale.value = MIN_SCALE;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        return;
      }

      savedScale.value = scale.value;

      // Mengecil sambil tetap di atas 1 menyempitkan ruang geser, jadi posisi
      // yang tadinya sah bisa jadi terlalu jauh. Tarik kembali ke dalam batas
      // yang baru, dengan animasi supaya tidak terlihat sebagai patahan.
      const maxX = maxTranslate(boxWidth, scale.value);
      const maxY = maxTranslate(boxHeight, scale.value);
      const nextX = clamp(translateX.value, -maxX, maxX);
      const nextY = clamp(translateY.value, -maxY, maxY);

      savedTranslateX.value = nextX;
      savedTranslateY.value = nextY;
      translateX.value = withTiming(nextX, TIMING);
      translateY.value = withTiming(nextY, TIMING);
    });

  const pan = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      // Pan hanya hidup saat gambar sedang dizoom. Pada skala 1 maxTranslate()
      // di bawah sudah menghasilkan 0, tapi penjaga ini membuat maksudnya
      // eksplisit dan menghentikan kerja sebelum sempat dimulai.
      if (scale.value <= MIN_SCALE) {
        return;
      }

      const maxX = maxTranslate(boxWidth, scale.value);
      const maxY = maxTranslate(boxHeight, scale.value);

      translateX.value = clamp(savedTranslateX.value + event.translationX, -maxX, maxX);
      translateY.value = clamp(savedTranslateY.value + event.translationY, -maxY, maxY);
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((_event, success) => {
      if (!success) {
        return;
      }

      // Sudah dizoom berapa pun: kembali ke diam dan ke tengah.
      if (scale.value > MIN_SCALE) {
        scale.value = withTiming(MIN_SCALE, TIMING);
        translateX.value = withTiming(0, TIMING);
        translateY.value = withTiming(0, TIMING);
        savedScale.value = MIN_SCALE;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        return;
      }

      // Dari keadaan diam: perbesar dari tengah. Posisi tidak perlu disentuh
      // karena gambar memang sedang berada di tengah.
      scale.value = withTiming(DOUBLE_TAP_SCALE, TIMING);
      savedScale.value = DOUBLE_TAP_SCALE;
    });

  // Cubit dan geser SIMULTAN: saat dua jari menempel, keduanya memang harus
  // jalan bersamaan supaya gambar bisa diperbesar sambil digeser dalam satu
  // gerakan. Kalau dipaksa saling meniadakan, salah satunya akan mati di tengah
  // gerakan dan terasa sebagai gesture yang patah.
  //
  // Ketuk-dua-kali EXCLUSIVE terhadap pasangan itu, dan ditulis lebih dulu
  // supaya ia yang menang lebih dulu. Pan mengaktif hanya setelah jari bergerak
  // melewati ambang, jadi ketukan diam tidak pernah tertelan pan; sebaliknya
  // begitu jari benar-benar menggeser, ketukan gagal dan pan langsung mengambil
  // alih tanpa jeda yang terasa.
  const gesture = Gesture.Exclusive(doubleTap, Gesture.Simultaneous(pinch, pan));

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      // Urutannya penting: geser dulu, baru skala. Dengan urutan ini nilai
      // translate tetap dalam satuan layar yang tidak ikut terskala, dan itulah
      // satuan yang dipakai maxTranslate().
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      {/*
        GestureHandlerRootView KEDUA, selain yang ada di app/_layout.tsx.
        Bukan duplikasi yang bisa dihapus: <Modal> bawaan React Native membuat
        native window terpisah di Android, dan akar gesture di pohon utama tidak
        menjangkau ke dalamnya. Tanpa pembungkus ini cubit-zoom di bawah akan
        diam di Android sementara di iOS tampak baik-baik saja -- persis jenis bug
        yang lolos dari pengujian di satu platform.
      */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View
          style={{
            backgroundColor: tokens.color.overlay.viewer,
            flex: 1,
            gap: spacing.lg,
            justifyContent: 'center',
            padding: spacing.xl,
          }}
        >
          {photoUrl ? (
            <GestureDetector gesture={gesture}>
              {/*
                Pengapit dengan overflow:'hidden' menahan gambar yang diperbesar
                tetap di dalam kotaknya. Tanpa ini gambar pada skala 4 tumpah ke
                seluruh layar, termasuk menutupi tombol Tutup di bawahnya.
              */}
              <View
                style={{
                  borderCurve: 'continuous',
                  borderRadius: radius.lg,
                  height: `${VIEWER_IMAGE_HEIGHT_PERCENT}%`,
                  overflow: 'hidden',
                  width: '100%',
                }}
              >
                <Animated.Image
                  resizeMode="contain"
                  source={{ uri: photoUrl }}
                  style={[{ height: '100%', width: '100%' }, imageStyle]}
                />
              </View>
            </GestureDetector>
          ) : null}
          {/*
            Tombol ini SIBLING dari GestureDetector, bukan anaknya, jadi tidak
            pernah ada gesture yang perlu berebut tekanan dengannya. Ia juga
            dirender setelah gambar sehingga berada di atas dalam urutan tumpuk;
            gambar yang diperbesar tidak bisa menutupinya.

            Tap pada gambar SENGAJA tidak menutup viewer. Tombol ini dan tombol
            back Android adalah satu-satunya jalan keluar, karena tap adalah
            bagian dari gerakan mencubit dan viewer yang menutup sendiri di
            tengah zoom tidak bisa dipakai.
          */}
          <Button onPress={onClose} title="Tutup" variant="primary" />
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
