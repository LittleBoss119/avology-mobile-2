import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Alert, Text } from 'react-native';

import { getTreeConditionReports } from '../services/conditionReportService';
import { getTreeHistory } from '../services/historyService';
import { archiveTree, getTreeDetail, restoreTree } from '../services/treeService';
import type { Tree, TreeConditionReport, TreeHistoryItem } from '../types/domain';
import {
  formatGrowthPhase,
  formatTreeAge,
  formatTreeArchiveStatusLabel,
  formatTreeDisplayCode,
} from '../utils/treeFormat';
import {
  ConditionReportList,
  ConditionStatusBadge,
  GrowthPhaseBadge,
  TreeHistoryTimeline,
} from './tree-components';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  MetaRow,
  PageIntro,
  Screen,
} from './ui';

type TreeDetailMode = 'owner' | 'worker';

export function TreeDetailScreen({
  mode,
  treeId,
}: {
  mode: TreeDetailMode;
  treeId?: string;
}) {
  const [actionLoading, setActionLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [history, setHistory] = React.useState<TreeHistoryItem[]>([]);
  const [reports, setReports] = React.useState<TreeConditionReport[]>([]);
  const [tree, setTree] = React.useState<Tree | null>(null);

  const loadDetail = React.useCallback(async () => {
    if (!treeId) {
      setError('Data pohon tidak ditemukan.');
      setTree(null);
      setHistory([]);
      setReports([]);
      return;
    }

    setError(null);

    const treeResult = await getTreeDetail({ treeId });

    if (treeResult.error) {
      setError(treeResult.error.message);
      setTree(null);
      setHistory([]);
      setReports([]);
      return;
    }

    if (mode === 'worker' && treeResult.data.isArchived) {
      setError('Pohon yang diarsipkan tidak tersedia untuk pekerja.');
      setTree(null);
      setHistory([]);
      setReports([]);
      return;
    }

    setTree(treeResult.data);

    const [reportsResult, historyResult] = await Promise.all([
      getTreeConditionReports({ treeId }),
      getTreeHistory({ treeId }),
    ]);

    if (reportsResult.error) {
      setError(reportsResult.error.message);
      setReports([]);
    } else {
      setReports(reportsResult.data);
    }

    if (historyResult.error) {
      setError(historyResult.error.message);
      setHistory([]);
    } else {
      setHistory(historyResult.data);
    }
  }, [mode, treeId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadDetail().finally(() => setLoading(false));
    }, [loadDetail])
  );

  async function handleArchiveToggle() {
    if (!tree) {
      return;
    }

    const nextArchived = !tree.isArchived;
    const title = nextArchived ? 'Arsipkan pohon?' : 'Pulihkan pohon?';
    const message = nextArchived
      ? 'Pohon akan disembunyikan dari daftar aktif, tetapi riwayatnya tetap tersimpan.'
      : 'Pohon akan kembali muncul di daftar aktif.';

    Alert.alert(title, message, [
      {
        text: 'Batal',
        style: 'cancel',
      },
      {
        text: nextArchived ? 'Arsipkan' : 'Pulihkan',
        style: nextArchived ? 'destructive' : 'default',
        onPress: () => {
          runArchiveToggle();
        },
      },
    ]);
  }

  async function runArchiveToggle() {
    if (!tree) {
      return;
    }

    setActionLoading(true);
    setError(null);

    const result = tree.isArchived
      ? await restoreTree({ treeId: tree.id })
      : await archiveTree({ treeId: tree.id });

    if (result.error) {
      setError(result.error.message);
      setActionLoading(false);
      return;
    }

    await loadDetail();
    setActionLoading(false);
  }

  if (loading) {
    return <LoadingState message="Memuat detail pohon..." />;
  }

  const basePath = mode === 'owner' ? '/owner/trees' : '/worker/trees';

  if (!tree) {
    return (
      <Screen>
        <PageIntro title="Detail Pohon" subtitle="Data pohon tidak dapat dimuat." />
        <ErrorBanner message={error} />
        <EmptyState title="Pohon tidak ditemukan" subtitle="Pohon mungkin sudah tidak tersedia atau akses ditolak." />
      </Screen>
    );
  }

  const displayCode = formatTreeDisplayCode(tree);

  return (
    <Screen
      footer={
        mode === 'owner' ? (
          <>
            <Button title="Catat Kondisi" onPress={() => router.push(`${basePath}/${tree.id}/report`)} />
            <Button title="Catat Fase" variant="secondary" onPress={() => router.push(`${basePath}/${tree.id}/phase`)} />
            <Button title="Edit Pohon" variant="secondary" onPress={() => router.push(`${basePath}/${tree.id}/edit`)} />
            <Button
              title={tree.isArchived ? 'Pulihkan' : 'Arsipkan'}
              variant={tree.isArchived ? 'secondary' : 'danger'}
              loading={actionLoading}
              onPress={handleArchiveToggle}
            />
          </>
        ) : (
          <>
            <Button title="Catat Kondisi" onPress={() => router.push(`${basePath}/${tree.id}/report`)} />
            <Button title="Catat Fase" variant="secondary" onPress={() => router.push(`${basePath}/${tree.id}/phase`)} />
          </>
        )
      }
    >
      <PageIntro title={displayCode} subtitle="Detail pohon, fase terbaru, dan riwayat pohon." />
      <ErrorBanner message={error} />

      <Card>
        <MetaRow label="Kode pohon" value={displayCode} />
        <MetaRow label="Baris" value={tree.rowPosition} />
        <MetaRow label="Kolom" value={tree.columnPosition} />
        <MetaRow label="Varietas" value={tree.variety} />
        <MetaRow label="Tanggal tanam" value={tree.plantedAt} />
        <MetaRow label="Umur pohon" value={formatTreeAge(tree.plantedAt)} />
        <MetaRow label="Status arsip" value={formatTreeArchiveStatusLabel(tree.isArchived)} />
        <Text selectable style={{ color: '#68746D', fontSize: 13 }}>
          Fase saat ini
        </Text>
        {tree.currentGrowthPhase ? (
          <GrowthPhaseBadge phase={tree.currentGrowthPhase} />
        ) : (
          <Text selectable style={{ color: '#1E2A24', fontSize: 16, fontWeight: '600' }}>
            {formatGrowthPhase(tree.currentGrowthPhase)}
          </Text>
        )}
        <Text selectable style={{ color: '#68746D', fontSize: 13 }}>
          Kondisi saat ini
        </Text>
        <ConditionStatusBadge status={tree.currentCondition} />
      </Card>

      <Text selectable style={{ color: '#1E2A24', fontSize: 20, fontWeight: '700', paddingTop: 4 }}>
        Timeline Riwayat
      </Text>
      <TreeHistoryTimeline history={history} />

      <Text selectable style={{ color: '#1E2A24', fontSize: 20, fontWeight: '700', paddingTop: 4 }}>
        Riwayat Kondisi
      </Text>
      <ConditionReportList reports={reports} />
    </Screen>
  );
}
