import { router } from 'expo-router';
import React from 'react';

import { Button, ErrorBanner, Field, PageIntro, Screen, TopAppBar } from '../../src/components/ui';
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
    <Screen footer={<Button title="Buat Kebun" loading={submitting} onPress={handleSubmit} />}>
      <TopAppBar title="Buat Kebun" onBack={() => router.back()} />
      <PageIntro
        title="Data Kebun"
        subtitle="Akses pemilik aktif akan dibuat otomatis setelah kebun berhasil tersimpan."
      />
      <ErrorBanner message={error} />
      <Field label="Nama kebun" value={name} onChangeText={setName} placeholder="MS Farm" />
      <Field label="Lokasi" value={location} onChangeText={setLocation} placeholder="Lokasi kebun" />
      <Field
        label="Luas kebun (meter persegi)"
        value={areaSize}
        onChangeText={setAreaSize}
        placeholder="Contoh: 1.25"
        keyboardType="decimal-pad"
      />
    </Screen>
  );
}
