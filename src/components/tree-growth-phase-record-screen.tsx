import { router } from 'expo-router';
import React from 'react';
import { Text, TextInput, View } from 'react-native';

import { createGrowthPhaseRecord } from '../services/growthPhaseService';
import { getTreeDetail } from '../services/treeService';
import type { GrowthPhase, Tree } from '../types/domain';
import { formatGrowthPhase, formatTreeLocation } from '../utils/treeFormat';
import { Button, Card, ErrorBanner, LoadingState, MetaRow, PageIntro, Screen } from './ui';

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
        setError('Pohon yang diarsipkan tidak tersedia untuk worker.');
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
      treeId: tree.id,
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
          <Button title="Simpan Fase" loading={submitting} onPress={handleSubmit} />
          <Button title="Batal" variant="secondary" disabled={submitting} onPress={() => router.back()} />
        </>
      }
    >
      <PageIntro title="Catat Fase" subtitle="Pilih fase pertumbuhan pohon saat ini." />
      <ErrorBanner message={error} />

      {tree ? (
        <Card>
          <MetaRow label="Kode pohon" value={tree.treeCode} />
          <MetaRow label="Lokasi" value={formatTreeLocation(tree)} />
          <MetaRow label="Fase saat ini" value={formatGrowthPhase(tree.currentGrowthPhase)} />
        </Card>
      ) : null}

      <Card>
        <Text selectable style={{ color: '#1E2A24', fontSize: 16, fontWeight: '700' }}>
          Fase baru
        </Text>
        <View style={{ gap: 10 }}>
          {phaseOptions.map((option) => (
            <Button
              key={option}
              title={formatGrowthPhase(option)}
              variant={phase === option ? 'primary' : 'secondary'}
              onPress={() => setPhase(option)}
            />
          ))}
        </View>
      </Card>

      <TextArea label="Catatan" onChangeText={setNote} placeholder="Opsional" value={note} />
    </Screen>
  );
}

function TextArea({
  label,
  onChangeText,
  placeholder,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <View style={{ gap: 7 }}>
      <Text selectable style={{ color: '#1E2A24', fontSize: 14, fontWeight: '600' }}>
        {label}
      </Text>
      <TextInput
        multiline
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A098"
        style={{
          backgroundColor: '#FFFFFF',
          borderColor: '#DDE4DA',
          borderCurve: 'continuous',
          borderRadius: 8,
          borderWidth: 1,
          color: '#1E2A24',
          fontSize: 16,
          minHeight: 96,
          paddingHorizontal: 14,
          paddingTop: 12,
          textAlignVertical: 'top',
        }}
        value={value}
      />
    </View>
  );
}
