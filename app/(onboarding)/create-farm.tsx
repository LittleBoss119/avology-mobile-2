import { router } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { Button, ErrorBanner, Field, Screen, TopAppBar } from '../../src/components/ui';
import { colors, spacing } from '../../src/constants/theme';
import { useAuth } from '../../src/context/auth-context';
import { createFarm } from '../../src/services/farmService';

export default function CreateFarmScreen() {
  const { refresh } = useAuth();
  const [name, setName] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [areaSize, setAreaSize] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    const parsedAreaSize = areaSize.trim() ? Number(areaSize) : null;

    if (parsedAreaSize !== null && (!Number.isFinite(parsedAreaSize) || parsedAreaSize <= 0)) {
      setError('Luas kebun harus berupa angka lebih dari 0.');
      setSubmitting(false);
      return;
    }

    const result = await createFarm({
      name,
      location,
      areaSize: parsedAreaSize,
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
          <Button title="Simpan Kebun" loading={submitting} onPress={handleSubmit} />
          <Button title="Batal" variant="secondary" disabled={submitting} onPress={() => router.back()} />
        </>
      }
    >
      <TopAppBar title="Buat Kebun" onBack={() => router.back()} />
      <ErrorBanner message={error} />
      <View style={{ gap: spacing.lg }}>
        <Field label="Nama Kebun *" value={name} onChangeText={setName} placeholder="MS Farm" />
        <Field label="Lokasi *" value={location} onChangeText={setLocation} placeholder="Lokasi kebun" />
        <Field
          label="Luas Lahan (m²)"
          value={areaSize}
          onChangeText={setAreaSize}
          placeholder="Contoh: 6500 m²"
          keyboardType="decimal-pad"
        />
        <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
          Luas lahan boleh dikosongkan jika belum pasti.
        </Text>
      </View>
    </Screen>
  );
}
