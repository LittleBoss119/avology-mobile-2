import { router } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

import { BrandMark, Button, Card, ErrorBanner, Field, PageIntro, Screen } from '../../src/components/ui';
import { colors } from '../../src/constants/theme';
import { useAuth } from '../../src/context/auth-context';
import { loginUser } from '../../src/services/authService';

export default function LoginScreen() {
  const { refresh } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

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
      footer={
        <>
          <Button title="Masuk" loading={submitting} onPress={handleSubmit} />
          <Button title="Belum punya akun? Daftar" variant="secondary" onPress={() => router.replace('/register')} />
        </>
      }
    >
      <BrandMark compact />
      <PageIntro title="Masuk" subtitle="Masuk untuk melanjutkan ke area pemilik atau pekerja." />
      <ErrorBanner message={error} />
      <Card>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="nama@email.com"
          keyboardType="email-address"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
        />
        <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
          Gunakan email dan password yang sudah terdaftar untuk membuka kebun aktif.
        </Text>
      </Card>
    </Screen>
  );
}
