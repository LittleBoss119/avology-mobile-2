import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Alert, Text } from 'react-native';

import { getTreeConditionReports } from '../services/conditionReportService';
import { archiveTree, getTreeDetail, restoreTree } from '../services/treeService';
import type { Tree, TreeConditionReport } from '../types/domain';
import { formatTreeArchiveStatus } from '../utils/treeFormat';
import { ConditionReportList, ConditionStatusBadge } from './tree-components';
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
  const [refreshing, setRefreshing] = React.useState(false);
  const [reports, setReports] = React.useState<TreeConditionReport[]>([]);
  const [tree, setTree] = React.useState<Tree | null>(null);

  const loadDetail = React.useCallback(async () => {
    if (!treeId) {
      setError('Tree ID tidak ditemukan.');
      setTree(null);
      setReports([]);
      return;
    }

    setError(null);

    const treeResult = await getTreeDetail({ treeId });

    if (treeResult.error) {
      setError(treeResult.error.message);
      setTree(null);
      setReports([]);
      return;
    }

    if (mode === 'worker' && treeResult.data.isArchived) {
      setError('Pohon archived tidak tersedia untuk worker.');
      setTree(null);
      setReports([]);
      return;
    }

    setTree(treeResult.data);

    const reportsResult = await getTreeConditionReports({ treeId });

    if (reportsResult.error) {
      setError(reportsResult.error.message);
      setReports([]);
    } else {
      setReports(reportsResult.data);
    }
  }, [mode, treeId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadDetail().finally(() => setLoading(false));
    }, [loadDetail])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadDetail();
    setRefreshing(false);
  }

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
      <Screen footer={<Button title="Refresh" variant="secondary" loading={refreshing} onPress={handleRefresh} />}>
        <PageIntro title="Detail Pohon" subtitle="Data pohon tidak dapat dimuat." />
        <ErrorBanner message={error} />
        <EmptyState title="Pohon tidak ditemukan" subtitle="Pohon mungkin sudah tidak tersedia atau akses ditolak." />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        mode === 'owner' ? (
          <>
            <Button title="Catat Kondisi" onPress={() => router.push(`${basePath}/${tree.id}/report`)} />
            <Button title="Edit Tree" variant="secondary" onPress={() => router.push(`${basePath}/${tree.id}/edit`)} />
            <Button
              title={tree.isArchived ? 'Pulihkan' : 'Arsipkan'}
              variant={tree.isArchived ? 'secondary' : 'danger'}
              loading={actionLoading}
              onPress={handleArchiveToggle}
            />
            <Button title="Refresh" variant="secondary" loading={refreshing} onPress={handleRefresh} />
          </>
        ) : (
          <>
            <Button title="Catat Kondisi" onPress={() => router.push(`${basePath}/${tree.id}/report`)} />
            <Button title="Refresh" variant="secondary" loading={refreshing} onPress={handleRefresh} />
          </>
        )
      }
    >
      <PageIntro title={tree.treeCode} subtitle="Detail pohon dan riwayat laporan kondisi." />
      <ErrorBanner message={error} />

      <Card>
        <MetaRow label="Kode pohon" value={tree.treeCode} />
        <MetaRow label="Baris" value={tree.rowPosition} />
        <MetaRow label="Kolom" value={tree.columnPosition} />
        <MetaRow label="Varietas" value={tree.variety} />
        <MetaRow label="Tanggal tanam" value={tree.plantedAt} />
        <MetaRow label="Status arsip" value={formatTreeArchiveStatus(tree.isArchived)} />
        {tree.currentGrowthPhase ? (
          <MetaRow label="Fase saat ini" value={tree.currentGrowthPhase} />
        ) : null}
        <Text selectable style={{ color: '#68746D', fontSize: 13 }}>
          Kondisi saat ini
        </Text>
        <ConditionStatusBadge status={tree.currentCondition} />
      </Card>

      <Text selectable style={{ color: '#1E2A24', fontSize: 20, fontWeight: '700', paddingTop: 4 }}>
        Riwayat Kondisi
      </Text>
      <ConditionReportList reports={reports} />
    </Screen>
  );
}
