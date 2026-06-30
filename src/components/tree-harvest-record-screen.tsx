import { router } from 'expo-router';
import React from 'react';
import { Alert, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing, typography } from '../constants/theme';
import { createHarvestRecord } from '../services/harvestService';
import { getTreeDetail } from '../services/treeService';
import type { Tree } from '../types/domain';
import type { PickedPhotoAsset } from '../types/media';
import { formatTreeDisplayCode, formatTreeLocation } from '../utils/treeFormat';
import { PhotoAttachmentPicker } from './media';
import { Button, Card, ErrorBanner, FormSection, LoadingState, MetaRow, Screen, TopAppBar } from './ui';

export function TreeHarvestRecordScreen({
  basePath,
  treeId,
}: {
  basePath: '/owner/trees' | '/worker/trees';
  treeId?: string;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [fruitCondition, setFruitCondition] = React.useState('');
  const [fruitCount, setFruitCount] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [note, setNote] = React.useState('');
  const [selectedPhoto, setSelectedPhoto] = React.useState<PickedPhotoAsset | null>(null);
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

    const parsedFruitCount = Number(fruitCount);

    if (!fruitCount.trim()) {
      setError('Jumlah buah dipanen wajib diisi.');
      return;
    }

    if (!Number.isInteger(parsedFruitCount) || parsedFruitCount <= 0) {
      setError('Jumlah buah harus lebih dari 0.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await createHarvestRecord({
      farmId: tree.farmId,
      fruitCondition,
      fruitCount: parsedFruitCount,
      note,
      photo: selectedPhoto
        ? {
            base64: selectedPhoto.base64,
            fileName: selectedPhoto.fileName,
            mimeType: selectedPhoto.mimeType,
            uri: selectedPhoto.uri,
          }
        : null,
      treeId: tree.id,
    });

    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);

    if (result.data.warningMessage) {
      Alert.alert('Catatan panen tersimpan', result.data.warningMessage, [
        {
          text: 'OK',
          onPress: () => router.replace(`${basePath}/${tree.id}`),
        },
      ]);
      return;
    }

    router.replace(`${basePath}/${tree.id}`);
  }

  if (loading) {
    return <LoadingState message="Memuat pohon..." />;
  }

  return (
    <Screen
      footer={
        <>
          <Button title="Simpan catatan panen" loading={submitting} onPress={handleSubmit} />
          <Button title="Batal" variant="secondary" disabled={submitting} onPress={() => router.back()} />
        </>
      }
    >
      <TopAppBar title="Catat panen" onBack={() => router.back()} />
      <ErrorBanner message={error} />

      {tree ? (
        <Card variant="highlight">
          <Text selectable style={{ color: colors.text, fontSize: typography.h3.fontSize, fontWeight: '800' }}>
            Konteks Pohon
          </Text>
          <MetaRow label="Kode pohon" value={formatTreeDisplayCode(tree)} />
          <MetaRow label="Lokasi" value={formatTreeLocation(tree)} />
          <MetaRow label="Varietas" value={tree.variety ?? 'Belum diisi'} />
        </Card>
      ) : null}

      <FormSection title="Hasil panen" description="Catat jumlah buah yang dipanen dari pohon ini.">
        <Field
          keyboardType="number-pad"
          label="Jumlah buah dipanen *"
          onChangeText={(value) => setFruitCount(value.replace(/[^0-9]/g, ''))}
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
        <TextArea onChangeText={setNote} placeholder="Opsional" value={note} />
      </FormSection>

      <PhotoAttachmentPicker
        disabled={submitting}
        helperText="Opsional, simpan bukti hasil panen dari pohon ini."
        label="Foto panen"
        selectedPhoto={selectedPhoto}
        onError={setError}
        onRemove={() => setSelectedPhoto(null)}
        onSelect={(asset) => {
          setError(null);
          setSelectedPhoto(asset);
        }}
      />
    </Screen>
  );
}

function Field({
  keyboardType,
  label,
  onChangeText,
  placeholder,
  value,
}: {
  keyboardType?: 'default' | 'number-pad';
  label: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
        {label}
      </Text>
      <TextInput
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSoft}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderCurve: 'continuous',
          borderRadius: radius.md,
          borderWidth: 1,
          color: colors.text,
          fontSize: 16,
          minHeight: 54,
          paddingHorizontal: spacing.lg,
        }}
        value={value}
      />
    </View>
  );
}

function TextArea({
  onChangeText,
  placeholder,
  value,
}: {
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <TextInput
        multiline
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSoft}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderCurve: 'continuous',
          borderRadius: radius.md,
          borderWidth: 1,
          color: colors.text,
          fontSize: 16,
          minHeight: 96,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          textAlignVertical: 'top',
        }}
        value={value}
      />
    </View>
  );
}
