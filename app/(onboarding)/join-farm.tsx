import { router } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { Button, ErrorBanner, Field, Screen, TopAppBar } from '../../src/components/ui';
import { colors, spacing } from '../../src/constants/theme';
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
      <ErrorBanner message={error} />
      <View style={{ gap: spacing.lg }}>
        <Field label="Kode Kebun *" value={joinCode} onChangeText={setJoinCode} placeholder="Contoh: AVOL-ABC123" />
        <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
          Masukkan kode dari pemilik kebun.
        </Text>
      </View>
    </Screen>
  );
}
