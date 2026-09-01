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
import { registerUser } from '../../src/services/authService';

type RegisterFieldErrors = {
  email?: string;
  fullName?: string;
  password?: string;
  phone?: string;
};

const MIN_PASSWORD_LENGTH = 6;

export default function RegisterScreen() {
  const { refresh } = useAuth();
  const [fullName, setFullName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  // Pola submitted + computeFieldErrors sama dengan login.tsx: error baru muncul
  // setelah percobaan kirim pertama, lalu hilang sendiri begitu field-nya
  // dibetulkan. Kegagalan dari server tetap di ErrorBanner — "email sudah
  // terdaftar" pun tidak ditimpakan ke field supaya perlakuannya seragam.
  const fieldErrors: RegisterFieldErrors = submitted
    ? computeFieldErrors(fullName, phone, email, password)
    : {};

  async function handleSubmit() {
    setSubmitted(true);
    setError(null);

    if (Object.keys(computeFieldErrors(fullName, phone, email, password)).length > 0) {
      return;
    }

    setSubmitting(true);

    const result = await registerUser({
      email,
      password,
      fullName,
      // Yang dikirim adalah nomor yang sudah dibersihkan, bukan apa yang diketik.
      // Awalan +62 sengaja TIDAK ditulis ulang jadi 0 — itu keputusan penyimpanan
      // data, bukan urusan layar ini.
      phone: normalizePhone(phone),
    });

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
    <Screen
      autoScrollOnFocus
      header={<TopAppBar onBack={goBack} />}
    >
      {/* Struktur zona yang sama persis dengan login.tsx, TANPA pemusatan
          vertikal: konten layar ini empat field panjang, jadi ia tetap rata atas.
          xxxl (32) memisahkan zona judul dari zona isian; gap seragam 18 milik
          Screen tidak lagi berlaku karena seluruh isi kini satu anak tunggal. */}
      <View style={{ gap: tokens.space.xxxl }}>
        <PageIntro align="center" title="Buat akun" subtitle="Setelah ini Anda memilih kebun." />
        <View style={{ gap: tokens.space.xl }}>
          <ErrorBanner message={error} />
          <View style={{ gap: tokens.space.lg }}>
            <Field
              autoCapitalize="words"
              autoComplete="name"
              error={fieldErrors.fullName}
              label="Nama lengkap"
              // Contoh, bukan pengulangan label. Sejak placeholder email diganti
              // jadi "Alamat email", form ini tidak lagi punya satu pun contoh
              // bentuk isian; contoh nama juga menegaskan yang diminta nama
              // lengkap, bukan panggilan.
              placeholder="Contoh: Budi Santoso"
              value={fullName}
              onChangeText={setFullName}
            />
            <Field
              autoComplete="tel"
              error={fieldErrors.phone}
              keyboardType="phone-pad"
              label="Nomor HP"
              placeholder="Nomor HP aktif"
              value={phone}
              onChangeText={setPhone}
            />
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
            {/* Tanpa helperText. Dulu ia berbunyi "Minimal 6 karakter." sementara
                pesan errornya "Minimal 6 karakter" — error mengalahkan helper
                (ui.tsx), jadi yang dilihat pengguna hanya kalimat yang sama
                berkedip antara dua bentuk tanda baca saat ia melewati batas 6.
                Aturannya kini disampaikan pesan error saja, tepat saat dibutuhkan. */}
            <PasswordField
              autoComplete="new-password"
              error={fieldErrors.password}
              label="Password"
              placeholder="Password baru"
              textContentType="newPassword"
              value={password}
              onChangeText={setPassword}
            />
          </View>
          {/* "Lanjut", bukan "Buat akun": alur belum selesai di layar ini. Setelah
              registrasi berhasil, router.replace('/') menyerahkan tujuan ke
              resolveAccessRoute, dan akun baru yang belum punya membership selalu
              mendarat di /onboarding untuk memilih buat kebun atau gabung kebun.
              Tombol berbunyi "Buat akun" yang disusul layar pemilihan membuat orang
              mengira prosesnya sudah selesai. */}
          <Button
            title="Lanjut"
            loading={submitting}
            loadingTitle="Memproses…"
            onPress={handleSubmit}
          />
          {/* Dipindah dari slot footer Screen, alasannya sama dengan login.tsx. */}
          <InlineAuthLink
            prefix="Sudah punya akun?"
            actionLabel="Masuk"
            onPress={() => router.replace('/login')}
          />
        </View>
      </View>
    </Screen>
  );
}

// Alasannya sama persis dengan goBack() di login.tsx: layar ini bisa jadi entri
// PERTAMA di tumpukan lewat cold start atau deep link, dan routeGuard tidak
// memantulkannya karena '/register' sudah dianggap memenuhi '/get-started'.
function goBack() {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace('/get-started');
}

function computeFieldErrors(
  fullName: string,
  phone: string,
  email: string,
  password: string
): RegisterFieldErrors {
  const errors: RegisterFieldErrors = {};
  const normalizedPhone = normalizePhone(phone);
  const emailError = validateEmail(email.trim());

  if (!fullName.trim()) {
    errors.fullName = 'Isi nama lengkap';
  }

  if (!normalizedPhone) {
    errors.phone = 'Isi nomor HP';
  } else if (!isValidPhone(normalizedPhone)) {
    // Contoh nomor, bukan penjelasan aturan. "Nomor HP belum valid" tidak memberi
    // tahu apa yang harus dibetulkan; satu contoh yang benar menunjukkannya.
    errors.phone = 'Contoh: 081234567890';
  }

  if (emailError) {
    errors.email = emailError;
  }

  if (!password) {
    errors.password = 'Isi password';
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Minimal ${MIN_PASSWORD_LENGTH} karakter`;
  }

  return errors;
}

// Pemisah yang lazim diketik orang (spasi, strip, kurung) dibuang dulu supaya
// "0812-3456-7890" dan "0812 3456 7890" tidak ditolak hanya karena format tulis.
function normalizePhone(value: string): string {
  return value.replace(/[\s\-()]/g, '');
}

function isValidPhone(value: string): boolean {
  return /^08\d{8,11}$/.test(value) || /^\+?628\d{7,10}$/.test(value);
}

// Salinan dari login.tsx — lihat catatan lengkap di sana. Aturan penerimaan tidak
// berubah: EMAIL_PATTERN sama persis dengan isValidEmail lama dan diuji lebih
// dulu, sub-pemeriksaan di bawahnya hanya memilih kalimat.
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

  // Lihat catatan di login.tsx: bagian sebelum @ kosong dipisah supaya pesannya
  // menunjuk sisi yang benar.
  if (!value.slice(0, value.indexOf('@'))) {
    return 'Lengkapi sebelum @';
  }

  return 'Lengkapi setelah @';
}
