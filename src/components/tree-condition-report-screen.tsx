import { router } from 'expo-router';
import React from 'react';
import { Text, TextInput, View } from 'react-native';

import { createTreeConditionReport } from '../services/conditionReportService';
import { getTreeDetail } from '../services/treeService';
import type { Tree, TreeConditionStatus } from '../types/domain';
import { formatTreeConditionStatus, formatTreeLocation } from '../utils/treeFormat';
import { ConditionStatusBadge } from './tree-components';
import { Button, Card, ErrorBanner, LoadingState, MetaRow, PageIntro, Screen } from './ui';

const conditionOptions: TreeConditionStatus[] = [
  'healthy',
  'needs_attention',
  'pest_attacked',
  'disease_indicated',
  'damaged',
  'dead',
];

export function TreeConditionReportScreen({
  basePath,
  treeId,
}: {
  basePath: '/owner/trees' | '/worker/trees';
  treeId?: string;
}) {
  const [conditionStatus, setConditionStatus] = React.useState<TreeConditionStatus | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [note, setNote] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [tree, setTree] = React.useState<Tree | null>(null);

  React.useEffect(() => {
    let isMounted = true;

    async function loadTree() {
      if (!treeId) {
        setError('Tree ID tidak ditemukan.');
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
        setError('Pohon archived tidak tersedia untuk worker.');
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

    if (!conditionStatus) {
      setError('Kondisi pohon wajib dipilih.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await createTreeConditionReport({
      conditionStatus,
      farmId: tree.farmId,
      note,
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
          <Button title="Simpan Kondisi" loading={submitting} onPress={handleSubmit} />
          <Button title="Batal" variant="secondary" disabled={submitting} onPress={() => router.back()} />
        </>
      }
    >
      <PageIntro title="Catat Kondisi" subtitle="Pilih kondisi pohon saat ini." />
      <ErrorBanner message={error} />

      {tree ? (
        <Card>
          <MetaRow label="Kode pohon" value={tree.treeCode} />
          <MetaRow label="Lokasi" value={formatTreeLocation(tree)} />
          <MetaRow label="Varietas" value={tree.variety} />
          <Text selectable style={{ color: '#68746D', fontSize: 13 }}>
            Kondisi terakhir
          </Text>
          <ConditionStatusBadge status={tree.currentCondition} />
        </Card>
      ) : null}

      <Card>
        <Text selectable style={{ color: '#1E2A24', fontSize: 16, fontWeight: '700' }}>
          Kondisi baru
        </Text>
        <View style={{ gap: 10 }}>
          {conditionOptions.map((status) => (
            <Button
              key={status}
              title={formatTreeConditionStatus(status)}
              variant={conditionStatus === status ? 'primary' : 'secondary'}
              onPress={() => setConditionStatus(status)}
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
