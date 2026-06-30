import { router } from 'expo-router';
import React from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing, typography } from '../constants/theme';
import { createManualCareRecord } from '../services/manualCareService';
import { getTreeDetail } from '../services/treeService';
import type { CareCategory, Tree } from '../types/domain';
import type { PickedPhotoAsset } from '../types/media';
import { formatCareCategory } from '../utils/displayFormat';
import { formatTreeDisplayCode, formatTreeLocation } from '../utils/treeFormat';
import { careCategoryOptions } from './care-sop-components';
import { PhotoAttachmentPicker } from './media';
import { Button, Card, ErrorBanner, FormSection, LoadingState, MetaRow, Screen, TopAppBar } from './ui';

export function TreeManualCareRecordScreen({
  basePath,
  treeId,
}: {
  basePath: '/owner/trees' | '/worker/trees';
  treeId?: string;
}) {
  const [category, setCategory] = React.useState<CareCategory | ''>('');
  const [error, setError] = React.useState<string | null>(null);
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

    if (!category) {
      setError('Jenis perawatan wajib dipilih.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await createManualCareRecord({
      category,
      farmId: tree.farmId,
      note,
      photo: selectedPhoto
        ? {
            base64: selectedPhoto.base64,
            fileName: selectedPhoto.fileName,
            mimeType: selectedPhoto.mimeType,
            uri: selectedPhoto.uri,
          }
        : null,
      targetTreeId: tree.id,
      targetType: 'tree',
    });

    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);

    if (result.data.warningMessage) {
      Alert.alert('Catatan perawatan tersimpan', result.data.warningMessage, [
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
          <Button title="Simpan catatan perawatan" loading={submitting} onPress={handleSubmit} />
          <Button title="Batal" variant="secondary" disabled={submitting} onPress={() => router.back()} />
        </>
      }
    >
      <TopAppBar title="Catat perawatan" onBack={() => router.back()} />
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

      <FormSection title="Jenis perawatan" description="Catat aktivitas perawatan yang dilakukan tanpa jadwal tugas.">
        <View style={{ gap: spacing.sm }}>
          <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
            Jenis perawatan *
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {careCategoryOptions.map((option) => (
              <CategoryOption
                key={option}
                disabled={submitting}
                label={formatCareCategory(option)}
                selected={category === option}
                onPress={() => {
                  setError(null);
                  setCategory(option);
                }}
              />
            ))}
          </View>
        </View>
      </FormSection>

      <FormSection title="Catatan perawatan">
        <TextArea onChangeText={setNote} placeholder="Opsional" value={note} />
      </FormSection>

      <PhotoAttachmentPicker
        disabled={submitting}
        helperText="Opsional, simpan bukti aktivitas perawatan."
        label="Foto perawatan"
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

function CategoryOption({
  disabled,
  label,
  selected,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={{
        backgroundColor: selected ? colors.primary : colors.surface,
        borderColor: selected ? colors.primary : colors.border,
        borderCurve: 'continuous',
        borderRadius: radius.md,
        borderWidth: 1,
        opacity: disabled ? 0.6 : 1,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
      }}
    >
      <Text selectable style={{ color: selected ? colors.white : colors.text, fontSize: 14, fontWeight: '800' }}>
        {label}
      </Text>
    </Pressable>
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
