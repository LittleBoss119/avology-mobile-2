import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import {
  Button,
  ErrorBanner,
  Field,
  InlineAuthLink,
  PageIntro,
  PasswordField,
  Screen,
  TopAppBar,
} from '../../src/components/ui';
import { tokens } from '../../src/constants/theme';
import { useAuth } from '../../src/context/auth-context';
import { loginUser } from '../../src/services/authService';

type LoginFieldErrors = {
  email?: string;
  password?: string;
};

export default function LoginScreen() {
  const { refresh } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  // Pola submitted + computeFieldErrors mengikuti account-password-screen.tsx:
  // error baru muncul setelah percobaan kirim pertama, lalu hilang sendiri
  // begitu field-nya dibetulkan. Kegagalan dari server TIDAK ikut ke sini —
  // "email atau password tidak sesuai" tidak bisa ditimpakan ke satu field
  // tertentu, jadi tempatnya di ErrorBanner.
  const fieldErrors: LoginFieldErrors = submitted ? computeFieldErrors(email, password) : {};

  async function handleSubmit() {
    setSubmitted(true);
    setError(null);

    if (Object.keys(computeFieldErrors(email, password)).length > 0) {
      return;
    }

    setSubmitting(true);

    const result = await loginUser({ email, password });

    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    await refresh();
    setSubmitting(false);
    router.replace('/');
  }

  return (
    <Screen autoScrollOnFocus header={<TopAppBar onBack={goBack} />}>
      {/* Satu anak tunggal, bukan deretan anak langsung Screen. Screen memberi gap
          seragam 18 antar anaknya, dan gap seragam itulah yang membuat judul
          rata-tengah dan isian rata-kiri terbaca sebagai ketidaksengajaan alih-alih
          hierarki. Dengan membungkusnya, jarak antar zona dikuasai layar ini:
          xxxl (32) memisahkan zona judul dari zona isian, jauh lebih longgar
          daripada jarak di dalam zona. Tidak ada kartu, garis, atau latar yang
          ditambahkan — pemisahnya murni jarak.

          flexGrow: 1, JANGAN diubah jadi flex: 1. Godaannya besar karena keduanya
          terlihat setara saat konten muat di layar, dan memang setara — tapi hanya
          di keadaan itu. `flex: 1` di RN berarti flexBasis 0 + flexShrink 1: anak
          menyumbang NOL ke tinggi natural induknya, dan boleh menyusut di bawah
          tinggi isinya karena Yoga tidak punya min-height auto. Begitu keyboard
          naik dan Screen menambahkan keyboardOverlap ke paddingBottom (ui.tsx
          ~:208), contentContainer tetap terpaku di tinggi viewport, ScrollView
          tidak punya apa pun untuk digulung, dan tombol Masuk terkubur di balik
          keyboard tanpa bisa dijangkau. Penjelasan penuh jebakan yang sama ada di
          ui.tsx ~:323-331, ditulis untuk pembungkus satu tingkat di atas ini.

          flexGrow: 1 sendirian meninggalkan flexShrink di bawaan RN (0, berbeda
          dari CSS) dan flexBasis di auto. Anak tumbuh mengisi dan terpusat saat
          ada ruang, dan TIDAK PERNAH menyusut di bawah isinya saat tidak ada —
          jadi konten melampaui viewport dan ScrollView menggulung seperti
          seharusnya. flexShrink sengaja tidak ditulis: menuliskannya 0 pun benar,
          tapi diam-diam mengundang orang mengubahnya. */}
      <View style={{ flexGrow: 1, gap: tokens.space.xxxl, justifyContent: 'center' }}>
        <PageIntro align="center" title="Masuk" subtitle="Lanjutkan mengelola kebun." />
        {/* Zona isian. xl (20) memisahkan sub-blok di dalamnya (banner, kelompok
            field, tombol, tautan); lg (16) di kelompok field adalah jarak antar
            field yang lama, sengaja TIDAK diubah. */}
        <View style={{ gap: tokens.space.xl }}>
          <ErrorBanner message={error} />
          <View style={{ gap: tokens.space.lg }}>
            <Field
              autoCapitalize="none"
              autoComplete="email"
              error={fieldErrors.email}
              keyboardType="email-address"
              label="Email"
              placeholder="Alamat email"
              value={email}
              onChangeText={setEmail}
            />
            <PasswordField
              autoComplete="current-password"
              error={fieldErrors.password}
              label="Password"
              placeholder="Password akun"
              textContentType="password"
              value={password}
              onChangeText={setPassword}
            />
          </View>
          <Button
            title="Masuk"
            loading={submitting}
            loadingTitle="Masuk…"
            onPress={handleSubmit}
          />
          {/* Dipindah dari slot footer Screen ke sini. Slot itu berada di luar
              pembungkus flexGrow:1, jadi tautannya menempel di dasar viewport —
              di HP besar terlalu jauh dari alur baca, dan terbaca terlepas dari
              form yang ia rujuk. Di sini ia duduk tepat di bawah tombol utama. */}
          <InlineAuthLink
            prefix="Belum punya akun?"
            actionLabel="Daftar"
            onPress={() => router.replace('/register')}
          />
        </View>
      </View>
    </Screen>
  );
}

// router.back() sendirian tidak cukup: layar ini bisa jadi entri PERTAMA di
// tumpukan lewat cold start atau deep link (scheme "avology"), dan
// shouldRedirectAccess tidak memantulkannya karena isAccessRouteSatisfied
// menganggap '/login' sudah memenuhi target '/get-started' (routeGuard.ts).
// Tanpa penjagaan, chevron di pojok kiri atas jadi tombol yang tidak melakukan
// apa-apa — dan itu satu-satunya jalan keluar yang terlihat di layar ini.
function goBack() {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace('/get-started');
}

function computeFieldErrors(email: string, password: string): LoginFieldErrors {
  const errors: LoginFieldErrors = {};
  const emailError = validateEmail(email.trim());

  if (emailError) {
    errors.email = emailError;
  }

  if (!password) {
    errors.password = 'Isi password';
  }

  return errors;
}

// Aturan penerimaan TIDAK berubah: EMAIL_PATTERN adalah regex yang sama persis
// dengan sebelumnya, dan ia diuji LEBIH DULU. Alamat yang lolos tetap lolos,
// alamat yang ditolak tetap ditolak — pemeriksaan di bawahnya hanya berjalan
// setelah pola itu gagal, dan tugasnya semata memilih kalimat yang lebih tepat.
// Urutan ini disengaja: kalau sub-pemeriksaan ditaruh di atas pola, ia akan jadi
// penentu penerimaan dan aturannya bisa melonggar tanpa terlihat.
//
// Disalin ke register.tsx, mengikuti isValidEmail lama yang juga tersalin di
// kedua layar. Menyatukannya berarti menambah modul bersama, di luar lingkup.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(value: string): string | undefined {
  if (!value) {
    return 'Isi email';
  }

  if (EMAIL_PATTERN.test(value)) {
    return undefined;
  }

  if (!value.includes('@')) {
    return 'Tambahkan @';
  }

  // Bagian sebelum @ kosong ("@gmail.com"). Dipisah supaya pesannya menunjuk sisi
  // yang benar — sebelumnya kasus ini ikut jatuh ke "Lengkapi setelah @", yang
  // menyuruh orang membetulkan bagian yang justru sudah terisi.
  //
  // indexOf, bukan split: yang diperiksa hanya @ PERTAMA. Untuk "@a@b.com" bagian
  // sebelum @ pertama memang kosong, dan itu memang keluhan yang benar.
  if (!value.slice(0, value.indexOf('@'))) {
    return 'Lengkapi sebelum @';
  }

  return 'Lengkapi setelah @';
}
