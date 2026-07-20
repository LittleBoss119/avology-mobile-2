import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing, typography } from '../constants/theme';
import { createGrowthPhaseRecord } from '../services/growthPhaseService';
import { getTreeDetail } from '../services/treeService';
import type { GrowthPhase, Tree } from '../types/domain';
import { formatGrowthPhase, formatTreeDisplayCode, formatTreeLocation } from '../utils/treeFormat';
import { GrowthPhaseBadge } from './tree-components';
import { Button, Card, DateField, ErrorBanner, FormSection, LoadingState, MetaRow, Screen, TopAppBar } from './ui';

const phaseOptions: GrowthPhase[] = [
  'initial_planting',
  'vegetative',
  'flowering',
  'fruiting',
  'harvesting',
];

export function TreeGrowthPhaseRecordScreen({
  basePath,
  treeId,
}: {
  basePath: '/owner/trees' | '/worker/trees';
  treeId?: string;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [eventDate, setEventDate] = React.useState(formatDateInput(new Date()));
  const [loading, setLoading] = React.useState(true);
  const [note, setNote] = React.useState('');
  const [phase, setPhase] = React.useState<GrowthPhase | null>(null);
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

    if (!phase) {
      setError('Fase pertumbuhan wajib dipilih.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await createGrowthPhaseRecord({
      farmId: tree.farmId,
      note,
      phase,
      recordedAt: eventDate,
      treeId: tree.id,
    });

    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    finishGrowthPhaseRecord();
  }

  function finishGrowthPhaseRecord() {
    if (!tree) {
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
          <Button title="Simpan Fase" loading={submitting} onPress={handleSubmit} />
          <Button title="Batal" variant="secondary" disabled={submitting} onPress={() => router.back()} />
        </>
      }
    >
      <TopAppBar title="Catat Fase" onBack={() => router.back()} />
      <ErrorBanner message={error} />

      {tree ? (
        <Card variant="highlight">
          <Text selectable style={{ color: colors.text, fontSize: typography.h3.fontSize, fontWeight: '800' }}>
            Konteks Pohon
          </Text>
          <MetaRow label="Kode pohon" value={formatTreeDisplayCode(tree)} />
          <MetaRow label="Lokasi" value={formatTreeLocation(tree)} />
          <View style={{ gap: spacing.xs }}>
            <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
              Fase saat ini
            </Text>
            {tree.currentGrowthPhase ? (
              <GrowthPhaseBadge phase={tree.currentGrowthPhase} />
            ) : (
              <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
                {formatGrowthPhase(tree.currentGrowthPhase)}
              </Text>
            )}
          </View>
        </Card>
      ) : null}

      <FormSection title="Fase Baru" description="Pilih fase pertumbuhan terbaru yang terlihat di pohon.">
        <View style={{ gap: spacing.sm }}>
          <DateField label="Tanggal catatan *" onChangeDate={setEventDate} value={eventDate} />
          {phaseOptions.map((option) => (
            <SelectableOption
              key={option}
              active={phase === option}
              disabled={submitting}
              label={formatPhaseOption(option)}
              onPress={() => setPhase(option)}
            />
          ))}
        </View>
      </FormSection>

      <FormSection title="Catatan" description="Catat tanda pertumbuhan yang terlihat di pohon.">
        <TextArea disabled={submitting} onChangeText={setNote} placeholder="Opsional" value={note} />
      </FormSection>
    </Screen>
  );
}

function SelectableOption({
  active,
  disabled,
  label,
  onPress,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={{
        backgroundColor: active ? colors.primarySoft : colors.surface,
        borderColor: active ? colors.primary : colors.border,
        borderCurve: 'continuous',
        borderRadius: radius.lg,
        borderWidth: 1,
        opacity: disabled ? 0.6 : 1,
        padding: spacing.md,
      }}
    >
      <Text selectable style={{ color: active ? colors.primary : colors.text, fontSize: 15, fontWeight: '800' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function TextArea({
  disabled,
  onChangeText,
  placeholder,
  value,
}: {
  disabled?: boolean;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <TextInput
        editable={!disabled}
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
          opacity: disabled ? 0.6 : 1,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          textAlignVertical: 'top',
        }}
        value={value}
      />
    </View>
  );
}

function formatPhaseOption(phase: GrowthPhase): string {
  return phase === 'harvesting' ? 'Siap Panen / Panen' : formatGrowthPhase(phase);
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
