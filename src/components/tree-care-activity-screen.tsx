import { router } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { tokens } from '../constants/theme';
import { createCareActivity } from '../services/careActivityService';
import { getTreeDetail } from '../services/treeService';
import type { CareCategory, Tree } from '../types/domain';
import { formatCareCategory } from '../utils/displayFormat';
import { formatTreeDisplayCode, formatTreeLocation } from '../utils/treeFormat';
import { careCategoryOptions } from '../constants/careCategory';
import { useSnackbar } from './snackbar';
import { Button, Card, DateField, ErrorBanner, Field, FormSection, LoadingState, MetaRow, OptionGroup, Screen, TopAppBar } from './ui';

type CareFormErrors = { category?: string };

// Pencatatan perawatan inisiatif untuk SATU pohon: pohonnya ditentukan oleh
// konteks route (user masuk dari detail pohon tertentu), jadi tidak ada pemilih
// pohon di sini -- konteksnya sudah jelas dan memilih ulang justru rancu.
//
// Model datanya tetap many-to-many (care_activity_trees): dari jalur ini
// isinya selalu 1 baris. Pencatatan multi-pohon akan punya layar dan titik
// masuk sendiri, terpisah dari detail pohon.
//
// Tidak ada lampiran foto: foto sengaja dipangkas untuk catatan perawatan dan
// hanya disisakan di kondisi pohon serta bukti tugas.
export function TreeCareActivityScreen({
  basePath,
  treeId,
}: {
  basePath: '/owner/trees' | '/worker/trees';
  treeId?: string;
}) {
  const showSnackbar = useSnackbar();
  const [category, setCategory] = React.useState<CareCategory | ''>('');
  const [error, setError] = React.useState<string | null>(null);
  const [eventDate, setEventDate] = React.useState(formatDateInput(new Date()));
  const [fieldErrors, setFieldErrors] = React.useState<CareFormErrors>({});
  const [loading, setLoading] = React.useState(true);
  const [note, setNote] = React.useState('');
  const [produk, setProduk] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [tree, setTree] = React.useState<Tree | null>(null);

  React.useEffect(() => {
    let isMounted = true;

    async function loadTree() {
      if (!treeId) {
        setError('Data pohon tidak ditemukan.');
        setLoading(false);
        return;
      }

      setError(null);
      const result = await getTreeDetail({ treeId });

      if (!isMounted) {
        return;
      }

      if (result.error) {
        setError(result.error.message);
        setLoading(false);
        return;
      }

      if (basePath === '/worker/trees' && result.data.isArchived) {
        setError('Pohon yang diarsipkan tidak tersedia untuk pekerja.');
        setLoading(false);
        return;
      }

      setTree(result.data);
      setLoading(false);
    }

    loadTree();

    return () => {
      isMounted = false;
    };
  }, [basePath, treeId]);

  async function handleSubmit() {
    if (!tree) {
      setError('Data pohon tidak ditemukan.');
      return;
    }

    if (!category) {
      setFieldErrors({ category: 'Jenis perawatan wajib dipilih.' });
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    setError(null);

    const result = await createCareActivity({
      category,
      farmId: tree.farmId,
      note,
      performedAt: eventDate,
      produk,
      treeIds: [tree.id],
    });

    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    showSnackbar('Perawatan tercatat');
    router.replace(`${basePath}/${tree.id}`);
  }

  if (loading) {
    return <LoadingState message="Memuat pohon..." />;
  }

  return (
    <Screen
      header={<TopAppBar title="Catat perawatan" onBack={() => router.back()} />}
      stickyFooter={<Button title="Simpan" loading={submitting} onPress={handleSubmit} />}
    >
      <ErrorBanner message={error} />

      {tree ? (
        <Card variant="highlight">
          <Text selectable style={{ color: tokens.color.text.primary, ...tokens.type.subheading }}>
            Konteks Pohon
          </Text>
          <MetaRow label="Kode pohon" value={formatTreeDisplayCode(tree)} />
          <MetaRow label="Lokasi" value={formatTreeLocation(tree)} />
          <MetaRow label="Varietas" value={tree.variety ?? 'Belum diisi'} />
        </Card>
      ) : null}

      <FormSection title="Jenis perawatan" description="Catat aktivitas perawatan yang dilakukan tanpa jadwal tugas.">
        <View style={{ gap: tokens.space.sm }}>
          <DateField label="Tanggal perawatan *" onChangeDate={setEventDate} value={eventDate} />
          <OptionGroup
            error={fieldErrors.category}
            label="Jenis perawatan *"
            options={careCategoryOptions.map((option) => ({
              disabled: submitting,
              label: formatCareCategory(option),
              value: option,
            }))}
            value={category}
            onChange={(value) => {
              setFieldErrors((prev) => ({ ...prev, category: undefined }));
              setCategory(value as CareCategory);
            }}
          />
        </View>
      </FormSection>

      <FormSection title="Produk yang dipakai" description="Opsional. Merek pupuk atau pestisida yang digunakan.">
        <Field label="" onChangeText={setProduk} placeholder="Opsional" value={produk} />
      </FormSection>

      <FormSection title="Catatan perawatan">
        <Field label="" multiline onChangeText={setNote} placeholder="Opsional" value={note} />
      </FormSection>
    </Screen>
  );
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
