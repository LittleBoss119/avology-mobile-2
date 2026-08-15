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
    <Screen
      header={<TopAppBar onBack={() => router.back()} />}
      footer={
        <InlineAuthLink
          prefix="Belum punya akun?"
          actionLabel="Daftar"
          onPress={() => router.replace('/register')}
        />
      }
    >
      <PageIntro title="Masuk" subtitle="Lanjutkan mengelola kebun anda" />
      <ErrorBanner message={error} />
      <View style={{ gap: tokens.space.lg }}>
        <Field
          autoCapitalize="none"
          autoComplete="email"
          error={fieldErrors.email}
          keyboardType="email-address"
          label="Email"
          placeholder="nama@email.com"
          value={email}
          onChangeText={setEmail}
        />
        <PasswordField
          error={fieldErrors.password}
          label="Password"
          textContentType="password"
          value={password}
          onChangeText={setPassword}
        />
      </View>
      <Button title="Masuk" loading={submitting} onPress={handleSubmit} />
    </Screen>
  );
}

function computeFieldErrors(email: string, password: string): LoginFieldErrors {
  const errors: LoginFieldErrors = {};
  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    errors.email = 'Email wajib diisi.';
  } else if (!isValidEmail(trimmedEmail)) {
    errors.email = 'Format email belum benar.';
  }

  if (!password) {
    errors.password = 'Password wajib diisi.';
  }

  return errors;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
