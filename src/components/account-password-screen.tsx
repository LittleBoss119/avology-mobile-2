import { router } from 'expo-router';
import React from 'react';

import { updatePassword } from '../services/authService';
import {
  Button,
  ErrorBanner,
  Field,
  FormSection,
  Screen,
  SuccessBanner,
  TopAppBar,
} from './ui';

export function AccountPasswordScreen() {
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [newPassword, setNewPassword] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  async function handleSubmit() {
    const validation = validatePasswords(newPassword, confirmPassword);

    if (validation) {
      setError(validation);
      setSuccessMessage(null);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    const result = await updatePassword({
      newPassword,
    });

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setNewPassword('');
    setConfirmPassword('');
    setSaving(false);
    router.back();
  }

  return (
    <Screen>
      <TopAppBar title="Ubah password" onBack={() => router.back()} />
      <ErrorBanner message={error} />
      <SuccessBanner message={successMessage} />

      <FormSection title="Ubah password" description="Gunakan password baru untuk login berikutnya.">
        <Field
          label="Password baru"
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="Minimal 6 karakter"
          secureTextEntry
        />
        <Field
          label="Konfirmasi password baru"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Ulangi password baru"
          secureTextEntry
        />
        <Button title="Simpan password" loading={saving} onPress={handleSubmit} />
      </FormSection>
    </Screen>
  );
}

function validatePasswords(newPassword: string, confirmPassword: string): string | null {
  if (!newPassword) {
    return 'Password baru wajib diisi.';
  }

  if (newPassword.length < 6) {
    return 'Password minimal 6 karakter.';
  }

  if (!confirmPassword) {
    return 'Konfirmasi password baru wajib diisi.';
  }

  if (newPassword !== confirmPassword) {
    return 'Konfirmasi password baru tidak sama.';
  }

  return null;
}
