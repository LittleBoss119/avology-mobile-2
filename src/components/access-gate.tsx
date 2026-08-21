import React from 'react';
import { Animated, Easing, View } from 'react-native';

import { tokens } from '../constants/theme';
import { BrandMark } from './ui';

// Gerbang akses: SATU layar tunggu untuk semua titik verifikasi akses
// (app/index.tsx dan ketiga _layout grup). Sebelumnya tiap titik memakai
// <LoadingState> dengan kalimat status yang berbeda-beda — "Memeriksa akses...",
// "Mengarahkan...", "Memeriksa akses pemilik..." — sehingga satu kali cold start
// menampilkan empat layar berbeda berturut-turut. Empat layar itu yang terbaca
// sebagai kedipan, bukan lamanya menunggu.
//
// Tanpa teks status SENGAJA: teksnya berganti tiap tahap, dan pergantian teks
// itulah yang membuat layar terlihat berkedip meski logonya diam. Satu logo yang
// bernapas tenang menyampaikan "sedang jalan" tanpa menandai batas antar tahap.
//
// Murni JS/Animated bawaan React Native, bukan Reanimated dan bukan splash
// native — supaya perubahannya cukup lewat OTA update tanpa build APK baru.

// Satu arah napas. 900ms x 2 = siklus 1,8 detik: cukup lambat untuk terbaca
// sebagai tenang, cukup hidup untuk tidak terlihat seperti layar beku.
const BREATH_DURATION_MS = 900;

// Rentang sengaja sempit. Fade turun sampai 0 atau scale di bawah 0.9 membuat
// logo terlihat "berkedip" — persis gejala yang mau dihilangkan.
const REST_OPACITY = 0.55;
const REST_SCALE = 0.94;

export function AccessGate() {
  const breath = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          duration: BREATH_DURATION_MS,
          easing: Easing.inOut(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          duration: BREATH_DURATION_MS,
          easing: Easing.inOut(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    // Dihentikan saat unmount: gerbang ini dilepas tepat ketika layar tujuan
    // muncul, dan loop yang menggantung terus menahan frame callback.
    return () => loop.stop();
  }, [breath]);

  // opacity + transform keduanya didukung native driver, jadi animasinya tidak
  // ikut tersendat saat JS thread sibuk memproses hasil verifikasi akses —
  // justru di detik-detik itulah gerbang ini terlihat.
  const opacity = breath.interpolate({ inputRange: [0, 1], outputRange: [REST_OPACITY, 1] });
  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [REST_SCALE, 1] });

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: tokens.color.surface.canvas,
        flex: 1,
        justifyContent: 'center',
      }}
    >
      {/* BrandMark dipakai ulang, bukan kotak logo baru: bentuk, ukuran, radius,
          dan warnanya dijamin identik dengan logo di layar get-started, dan
          tidak ada satu pun nilai warna yang ditulis ulang di sini. */}
      <Animated.View style={{ opacity, transform: [{ scale }] }}>
        <BrandMark showWordmark={false} />
      </Animated.View>
    </View>
  );
}
