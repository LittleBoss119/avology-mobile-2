import { router } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

import { Button, Card, ErrorBanner, Field, FormSection, PageIntro, Screen, TopAppBar } from '../../src/components/ui';
import { colors } from '../../src/constants/theme';
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
    <Screen
      footer={
        <>
          <Button title="Ajukan Gabung" loading={submitting} onPress={handleSubmit} />
          <Button title="Batal" variant="secondary" disabled={submitting} onPress={() => router.back()} />
        </>
      }
    >
      <TopAppBar title="Gabung Kebun" onBack={() => router.back()} />
      <PageIntro
        title="Masukkan kode dari pemilik"
        subtitle="Ajukan akses ke kebun, lalu tunggu persetujuan pemilik."
      />
      <ErrorBanner message={error} />
      <FormSection title="Kode Kebun" description="Kode diberikan oleh pemilik kebun.">
        <Field label="Kode Kebun *" value={joinCode} onChangeText={setJoinCode} placeholder="Contoh: AVOL-ABC123" />
        <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
          Pastikan kode sesuai sebelum mengirim pengajuan.
        </Text>
      </FormSection>
      <Card variant="info">
        <Text selectable style={{ color: colors.info, fontWeight: '800' }}>
          Setelah pengajuan dikirim, akses kebun baru tersedia setelah disetujui pemilik.
        </Text>
      </Card>
    </Screen>
  );
}
