import { router } from 'expo-router';
import React from 'react';

import { registerUser } from '../../src/services/authService';
import { Button, ErrorBanner, Field, PageIntro, Screen } from '../../src/components/ui';
import { useAuth } from '../../src/context/auth-context';

export default function RegisterScreen() {
  const { refresh } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    const result = await registerUser({
      email,
      password,
      fullName,
      phone,
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
      footer={
        <>
          <Button title="Daftar" loading={submitting} onPress={handleSubmit} />
          <Button title="Sudah punya akun" variant="secondary" onPress={() => router.replace('/login')} />
        </>
      }
    >
      <PageIntro title="Buat Akun" subtitle="Daftarkan akun sebelum membuat atau bergabung ke kebun." />
      <ErrorBanner message={error} />
      <Field label="Nama lengkap" value={fullName} onChangeText={setFullName} placeholder="Nama pengguna" />
      <Field label="Nomor HP" value={phone} onChangeText={setPhone} placeholder="08..." keyboardType="phone-pad" />
      <Field label="Email" value={email} onChangeText={setEmail} placeholder="nama@email.com" keyboardType="email-address" />
      <Field label="Password" value={password} onChangeText={setPassword} placeholder="Minimal 6 karakter" secureTextEntry />
    </Screen>
  );
}
