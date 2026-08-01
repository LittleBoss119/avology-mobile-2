import { router } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

import { tokens } from '../constants/theme';
import { createHarvestRecord } from '../services/harvestService';
import { getTreeDetail } from '../services/treeService';
import type { Tree } from '../types/domain';
import { formatTreeDisplayCode, formatTreeLocation } from '../utils/treeFormat';
import { useSnackbar } from './snackbar';
import { Button, Card, DateField, ErrorBanner, Field, FormSection, LoadingState, MetaRow, Screen, TopAppBar } from './ui';

type HarvestFormErrors = { fruitCount?: string };

export function TreeHarvestRecordScreen({
  basePath,
  treeId,
}: {
  basePath: '/owner/trees' | '/worker/trees';
  treeId?: string;
}) {
  const showSnackbar = useSnackbar();
  const [error, setError] = React.useState<string | null>(null);
  const [eventDate, setEventDate] = React.useState(formatDateInput(new Date()));
  const [fieldErrors, setFieldErrors] = React.useState<HarvestFormErrors>({});
  const [fruitCondition, setFruitCondition] = React.useState('');
  const [fruitCount, setFruitCount] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [note, setNote] = React.useState('');
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

    if (!fruitCount.trim()) {
      setFieldErrors({ fruitCount: 'Jumlah buah dipanen wajib diisi.' });
      return;
    }

    const parsedFruitCount = Number(fruitCount);

    if (!Number.isInteger(parsedFruitCount) || parsedFruitCount <= 0) {
      setFieldErrors({ fruitCount: 'Jumlah buah harus lebih dari 0.' });
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    setError(null);

    const result = await createHarvestRecord({
      farmId: tree.farmId,
      fruitCondition,
      fruitCount: parsedFruitCount,
      harvestedAt: eventDate,
      note,
      treeId: tree.id,
    });

    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    showSnackbar('Panen tercatat');
    router.replace(`${basePath}/${tree.id}`);
  }

  if (loading) {
    return <LoadingState message="Memuat pohon..." />;
  }

  return (
    <Screen
      footer={<Button title="Simpan" loading={submitting} onPress={handleSubmit} />}
      header={<TopAppBar title="Catat panen" onBack={() => router.back()} />}
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

      <FormSection title="Hasil panen" description="Catat jumlah buah yang dipanen dari pohon ini.">
        <DateField label="Tanggal panen *" onChangeDate={setEventDate} value={eventDate} />
        <Field
          error={fieldErrors.fruitCount}
          keyboardType="number-pad"
          label="Jumlah buah dipanen *"
          onChangeText={(value) => {
            setFruitCount(value.replace(/[^0-9]/g, ''));
            setFieldErrors((prev) => ({ ...prev, fruitCount: undefined }));
          }}
          placeholder="Contoh: 12"
          value={fruitCount}
        />
        <Field
          label="Kondisi buah"
          onChangeText={setFruitCondition}
          placeholder="Opsional"
          value={fruitCondition}
        />
      </FormSection>

      <FormSection title="Catatan tambahan">
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
