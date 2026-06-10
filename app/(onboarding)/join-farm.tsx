import { router } from 'expo-router';
import React from 'react';

import { Button, ErrorBanner, Field, PageIntro, Screen } from '../../src/components/ui';
import { useAuth } from '../../src/context/auth-context';
import { requestJoinFarm } from '../../src/services/memberService';

export default function JoinFarmScreen() {
  const { refresh } = useAuth();
  const [joinCode, setJoinCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    const result = await requestJoinFarm({ joinCode });

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
    <Screen footer={<Button title="Ajukan Bergabung" loading={submitting} onPress={handleSubmit} />}>
      <PageIntro
        title="Gabung Kebun"
        subtitle="Masukkan kode kebun dari owner. Akses operasional menunggu approval."
      />
      <ErrorBanner message={error} />
      <Field label="Kode kebun" value={joinCode} onChangeText={setJoinCode} placeholder="Contoh: A1B2C3D4" />
    </Screen>
  );
}
