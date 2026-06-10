import { router } from 'expo-router';
import React from 'react';

import { Button, ErrorBanner, Field, PageIntro, Screen } from '../../src/components/ui';
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
          <Button title="Login" loading={submitting} onPress={handleSubmit} />
          <Button title="Buat akun baru" variant="secondary" onPress={() => router.replace('/register')} />
        </>
      }
    >
      <PageIntro title="Login" subtitle="Masuk untuk melanjutkan ke area owner atau worker." />
      <ErrorBanner message={error} />
      <Field label="Email" value={email} onChangeText={setEmail} placeholder="nama@email.com" keyboardType="email-address" />
      <Field label="Password" value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
    </Screen>
  );
}
