import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing, typography } from '../constants/theme';
import { createCareActivity } from '../services/careActivityService';
import { getTreeDetail } from '../services/treeService';
import type { CareCategory, Tree } from '../types/domain';
import { formatCareCategory } from '../utils/displayFormat';
import { formatTreeDisplayCode, formatTreeLocation } from '../utils/treeFormat';
import { careCategoryOptions } from './care-sop-components';
import { Button, Card, DateField, ErrorBanner, FormSection, LoadingState, MetaRow, Screen, TopAppBar } from './ui';

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
  const [category, setCategory] = React.useState<CareCategory | ''>('');
  const [error, setError] = React.useState<string | null>(null);
  const [eventDate, setEventDate] = React.useState(formatDateInput(new Date()));
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
      setError('Jenis perawatan wajib dipilih.');
      return;
    }

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
          <DateField label="Tanggal perawatan *" onChangeDate={setEventDate} value={eventDate} />
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

      <FormSection title="Produk yang dipakai" description="Opsional. Merek pupuk atau pestisida yang digunakan.">
        <TextInput
          onChangeText={setProduk}
          placeholder="Opsional"
          placeholderTextColor={colors.textSoft}
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderCurve: 'continuous',
            borderRadius: radius.md,
            borderWidth: 1,
            color: colors.text,
            fontSize: 16,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
          }}
          value={produk}
        />
      </FormSection>

      <FormSection title="Catatan perawatan">
        <TextArea onChangeText={setNote} placeholder="Opsional" value={note} />
      </FormSection>
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

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
