import { router } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { tokens } from '../constants/theme';
import { createGrowthPhaseRecord } from '../services/growthPhaseService';
import { getTreeDetail } from '../services/treeService';
import type { GrowthPhase, Tree } from '../types/domain';
import { formatGrowthPhase, formatTreeDisplayCode, formatTreeLocation } from '../utils/treeFormat';
import { GrowthPhaseBadge } from './tree-components';
import { useSnackbar } from './snackbar';
import { Button, Card, DateField, ErrorBanner, Field, FormSection, LoadingState, MetaRow, OptionGroup, Screen, TopAppBar } from './ui';

type PhaseFormErrors = { phase?: string };

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
  const showSnackbar = useSnackbar();
  const [error, setError] = React.useState<string | null>(null);
  const [eventDate, setEventDate] = React.useState(formatDateInput(new Date()));
  const [fieldErrors, setFieldErrors] = React.useState<PhaseFormErrors>({});
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
      setFieldErrors({ phase: 'Fase wajib dipilih.' });
      return;
    }

    setFieldErrors({});
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
    showSnackbar('Fase pertumbuhan tercatat');
    router.replace(`${basePath}/${tree.id}`);
  }

  if (loading) {
    return <LoadingState message="Memuat pohon..." />;
  }

  return (
    <Screen
      header={<TopAppBar title="Catat Fase" onBack={() => router.back()} />}
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
          <View style={{ gap: tokens.space.xs }}>
            <Text selectable style={{ color: tokens.color.text.tertiary, ...tokens.type.meta }}>
              Fase saat ini
            </Text>
            {tree.currentGrowthPhase ? (
              <GrowthPhaseBadge phase={tree.currentGrowthPhase} />
            ) : (
              <Text selectable style={{ color: tokens.color.text.primary, ...tokens.type.bodyStrong }}>
                {formatGrowthPhase(tree.currentGrowthPhase)}
              </Text>
            )}
          </View>
        </Card>
      ) : null}

      <FormSection title="Fase baru" description="Pilih fase pertumbuhan terbaru yang terlihat di pohon.">
        <View style={{ gap: tokens.space.sm }}>
          <DateField label="Tanggal catatan *" onChangeDate={setEventDate} value={eventDate} />
          <OptionGroup
            error={fieldErrors.phase}
            options={phaseOptions.map((option) => ({
              disabled: submitting,
              label: formatPhaseOption(option),
              value: option,
            }))}
            value={phase}
            onChange={(value) => {
              setFieldErrors((prev) => ({ ...prev, phase: undefined }));
              setPhase(value as GrowthPhase);
            }}
          />
        </View>
      </FormSection>

      <FormSection title="Catatan" description="Catat tanda pertumbuhan yang terlihat di pohon.">
        <Field label="" multiline onChangeText={setNote} placeholder="Opsional" value={note} />
      </FormSection>
    </Screen>
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
