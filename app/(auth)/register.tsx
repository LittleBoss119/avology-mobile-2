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
      header={<TopAppBar onBack={() => router.back()} />}
      footer={
        <InlineAuthLink
          prefix="Sudah punya akun?"
          actionLabel="Masuk"
          onPress={() => router.replace('/login')}
        />
      }
    >
      <PageIntro title="Buat akun" subtitle="Mulai perjalanan mengelola kebun anda!" />
      <ErrorBanner message={error} />
      <View style={{ gap: tokens.space.lg }}>
        <Field
          autoCapitalize="words"
          error={fieldErrors.fullName}
          label="Nama lengkap"
          placeholder="Nama lengkap"
          value={fullName}
          onChangeText={setFullName}
        />
        <Field
          error={fieldErrors.phone}
          keyboardType="phone-pad"
          label="Nomor HP"
          placeholder="Nomor aktif"
          value={phone}
          onChangeText={setPhone}
        />
        <Field
          autoCapitalize="none"
          autoComplete="email"
          error={fieldErrors.email}
          keyboardType="email-address"
          label="Email"
          placeholder="Email aktif"
          value={email}
          onChangeText={setEmail}
        />
        <PasswordField
          error={fieldErrors.password}
          helperText={`Minimal ${MIN_PASSWORD_LENGTH} karakter.`}
          label="Password"
          textContentType="newPassword"
          value={password}
          onChangeText={setPassword}
        />
      </View>
      <Button title="Buat akun" loading={submitting} onPress={handleSubmit} />
    </Screen>
  );
}

function computeFieldErrors(
  fullName: string,
  phone: string,
  email: string,
  password: string
): RegisterFieldErrors {
  const errors: RegisterFieldErrors = {};
  const normalizedPhone = normalizePhone(phone);
  const trimmedEmail = email.trim();

  if (!fullName.trim()) {
    errors.fullName = 'Nama lengkap wajib diisi.';
  }

  if (!normalizedPhone) {
    errors.phone = 'Nomor HP wajib diisi.';
  } else if (!isValidPhone(normalizedPhone)) {
    errors.phone = 'Nomor HP belum valid.';
  }

  if (!trimmedEmail) {
    errors.email = 'Email wajib diisi.';
  } else if (!isValidEmail(trimmedEmail)) {
    errors.email = 'Format email belum benar.';
  }

  if (!password) {
    errors.password = 'Password wajib diisi.';
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = 'Password minimal 6 karakter.';
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

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
