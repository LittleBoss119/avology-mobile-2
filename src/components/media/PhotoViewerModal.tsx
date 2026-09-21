import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { spacing, tokens } from '../../constants/theme';
import { colors as palette } from '../../theme/tokens';
import { Icon } from '../icons';

// Slot sentuh tombol kembali. 48, pedoman Android — sama dengan slot kembali di
// <TopAppBar>, dan dengan alasan yang sama.
const BACK_SLOT_SIZE = 48;

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
  const insets = useSafeAreaInsets();
  // Ukuran kotak gambar DIUKUR lewat onLayout, bukan dihitung dari jendela.
  // Sejak penampil jadi layar penuh dan statusBarTranslucent, useWindowDimensions
  // di Android tidak lagi sama dengan bidang yang benar-benar ditempati — ia
  // mengecualikan status bar yang kini justru ikut tertutup. Batas geser di bawah
  // harus memakai ukuran bidang yang sebenarnya, atau tepi foto yang diperbesar
  // bisa ditarik masuk melewati tepi layar.
  const [box, setBox] = React.useState({ height: 0, width: 0 });
  const boxWidth = box.width;
  const boxHeight = box.height;

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

  // PENAMPIL LAYAR PENUH (pasca-batch 7), berlaku untuk foto pohon, foto
  // catatan, dan foto bukti hasil kerja — ketiganya lewat komponen ini.
  //
  //   * Latar HITAM PENUH, termasuk di bawah status bar (statusBarTranslucent).
  //     Tidak ada sepotong pun antarmuka aplikasi yang terlihat di belakangnya.
  //   * Foto dipaskan ke layar (resizeMode contain di bidang penuh), tanpa kotak
  //     bersudut membulat dan tanpa padding.
  //   * TOMBOL KEMBALI DI KIRI ATAS, menggantikan tombol "Tutup" di bawah foto.
  //     Arah dan letaknya sama dengan panah kembali di setiap layar aplikasi,
  //     jadi tidak ada kosakata baru yang harus dipelajari untuk keluar dari
  //     sini.
  //   * Tombol kembali perangkat menutup penampil lewat onRequestClose — itu
  //     sudah benar sejak awal dan tidak berubah.
  //
  // Tap pada gambar SENGAJA tetap tidak menutup penampil: tap adalah bagian dari
  // gerakan mencubit, dan penampil yang menutup sendiri di tengah zoom tidak
  // bisa dipakai.
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      {/*
        GestureHandlerRootView KEDUA, selain yang ada di app/_layout.tsx.
        Bukan duplikasi yang bisa dihapus: <Modal> bawaan React Native membuat
        native window terpisah di Android, dan akar gesture di pohon utama tidak
        menjangkau ke dalamnya. Tanpa pembungkus ini cubit-zoom di bawah akan
        diam di Android sementara di iOS tampak baik-baik saja -- persis jenis bug
        yang lolos dari pengujian di satu platform.
      */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ backgroundColor: palette.photoViewerBg, flex: 1 }}>
          {photoUrl ? (
            <GestureDetector gesture={gesture}>
              {/*
                Pengapit selebar layar dengan overflow:'hidden'. Ia yang diukur
                untuk batas geser, dan ia yang menahan gambar pada skala 4
                supaya tidak meluber keluar bidangnya sendiri.
              */}
              <View
                onLayout={(event) => {
                  const { height, width } = event.nativeEvent.layout;
                  setBox((current) =>
                    current.height === height && current.width === width ? current : { height, width }
                  );
                }}
                style={{ flex: 1, overflow: 'hidden' }}
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
            Tombol kembali MELAYANG di atas foto, di kiri atas, dan SIBLING dari
            GestureDetector — bukan anaknya — jadi tidak pernah ada gesture yang
            berebut tekanan dengannya. Dirender sesudah gambar sehingga berada di
            atas dalam urutan tumpuk: foto yang diperbesar tidak bisa
            menutupinya.

            Panah, bukan silang, dan di KIRI: penampil ini dibuka dari sebuah
            layar dan kembali ke layar itu, jadi yang dilakukan tombol ini adalah
            "kembali", sama persis dengan panah di TopAppBar. Warnanya putih
            (textOnAccent) karena ia duduk di atas hitam.
          */}
          <Pressable
            accessibilityLabel="Kembali"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => ({
              alignItems: 'center',
              height: BACK_SLOT_SIZE,
              justifyContent: 'center',
              left: spacing.screenHorizontal - (BACK_SLOT_SIZE - tokens.icon.lg) / 2,
              opacity: pressed ? 0.6 : 1,
              position: 'absolute',
              top: Math.max(insets.top, spacing.sm),
              width: BACK_SLOT_SIZE,
            })}
          >
            <Icon name="arrow-left" size={tokens.icon.lg} color={palette.textOnAccent} />
          </Pressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
