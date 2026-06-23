import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Alert, Modal, Pressable, Text, View } from 'react-native';

import { getTreeConditionReports } from '../services/conditionReportService';
import { getTreeHistory } from '../services/historyService';
import { archiveTree, getTreeDetail, restoreTree } from '../services/treeService';
import { useAuth } from '../context/auth-context';
import type { Tree, TreeConditionReport, TreeHistoryItem } from '../types/domain';
import {
  formatGrowthPhase,
  formatTreeAge,
  formatTreeArchiveStatusLabel,
  formatTreeDisplayCode,
  formatTreeLocation,
} from '../utils/treeFormat';
import {
  ConditionReportList,
  ConditionStatusBadge,
  TreeHistoryTimeline,
  TreeVisualPlaceholder,
} from './tree-components';
import {
  appTheme,
  Badge,
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
  const { profile } = useAuth();
  const [actionLoading, setActionLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [menuOpen, setMenuOpen] = React.useState(false);
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
    <Screen>
      <DetailHeader mode={mode} onMenuPress={() => setMenuOpen(true)} />
      <ErrorBanner message={error} />

      <TreeDetailHero displayCode={displayCode} tree={tree} />
      {mode === 'owner' ? (
        <OwnerTreeMenu
          actionLoading={actionLoading}
          onArchiveToggle={() => {
            setMenuOpen(false);
            handleArchiveToggle();
          }}
          onClose={() => setMenuOpen(false)}
          onEdit={() => {
            setMenuOpen(false);
            router.push(`${basePath}/${tree.id}/edit`);
          }}
          tree={tree}
          visible={menuOpen}
        />
      ) : null}

      <SectionTitle title="Informasi Pohon" />
      <InfoGrid mode={mode} tree={tree} />

      <SectionTitle title="Aksi Pohon" />
      <ActionSection basePath={basePath} tree={tree} />

      <SectionTitle title="Timeline Riwayat" />
      <TreeHistoryTimeline currentUserId={profile?.id} history={history} viewerMode={mode} />

      {history.length === 0 && reports.length > 0 ? (
        <>
          <SectionTitle title="Laporan Kondisi" />
          <ConditionReportList currentUserId={profile?.id} reports={reports} viewerMode={mode} />
        </>
      ) : null}
    </Screen>
  );
}

function DetailHeader({ mode, onMenuPress }: { mode: TreeDetailMode; onMenuPress: () => void }) {
  return (
    <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
      <View style={{ flex: 1 }}>
        <PageIntro title="Detail Pohon" subtitle="Kondisi, lokasi, dan riwayat operasional pohon." />
      </View>
      {mode === 'owner' ? (
        <Pressable
          onPress={onMenuPress}
          style={{
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            borderColor: '#DCE7D5',
            borderRadius: 999,
            borderWidth: 1,
            height: 44,
            justifyContent: 'center',
            marginTop: 10,
            width: 44,
          }}
        >
          <Text selectable style={{ color: '#065F2E', fontSize: 22, fontWeight: '900', lineHeight: 24 }}>
            ...
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function TreeDetailHero({ displayCode, tree }: { displayCode: string; tree: Tree }) {
  return (
    <Card>
      <TreeVisualPlaceholder condition={tree.currentCondition}>
        <ConditionStatusBadge status={tree.currentCondition} />
        {tree.isArchived ? <Badge label="Diarsipkan" tone="muted" /> : null}
      </TreeVisualPlaceholder>
      <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text selectable style={{ color: appTheme.primary, fontSize: 34, fontWeight: '900' }}>
            {displayCode}
          </Text>
          <Text selectable style={{ color: appTheme.muted, fontSize: 16, lineHeight: 22 }}>
            {`${tree.variety || 'Varietas belum diisi'} - ${formatGrowthPhase(tree.currentGrowthPhase)}`}
          </Text>
        </View>
        <View style={{ justifyContent: 'center' }}>
          <ConditionStatusBadge status={tree.currentCondition} />
        </View>
      </View>
    </Card>
  );
}

function InfoGrid({ mode, tree }: { mode: TreeDetailMode; tree: Tree }) {
  const items = [
    { label: 'Varietas', value: tree.variety || 'Belum diisi' },
    { label: 'Tanggal Tanam', value: formatFriendlyDate(tree.plantedAt) },
    { label: 'Umur Pohon', value: formatTreeAge(tree.plantedAt) },
    { label: 'Lokasi', value: formatTreeLocation(tree) },
    { label: 'Fase Tumbuh', value: formatGrowthPhase(tree.currentGrowthPhase) },
  ];

  if (mode === 'owner') {
    items.push({ label: 'Status Arsip', value: formatTreeArchiveStatusLabel(tree.isArchived) });
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 }}>
        {items.map((item) => (
          <View key={item.label} style={{ flexBasis: '50%', gap: 3, paddingRight: 12 }}>
            <MetaRow label={item.label} value={item.value} />
          </View>
        ))}
      </View>
    </Card>
  );
}

function ActionSection({
  basePath,
  tree,
}: {
  basePath: string;
  tree: Tree;
}) {
  return (
    <Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Button title="Catat Kondisi" size="small" onPress={() => router.push(`${basePath}/${tree.id}/report`)} />
        <Button title="Catat Fase" size="small" variant="secondary" onPress={() => router.push(`${basePath}/${tree.id}/phase`)} />
      </View>
    </Card>
  );
}

function OwnerTreeMenu({
  actionLoading,
  onArchiveToggle,
  onClose,
  onEdit,
  tree,
  visible,
}: {
  actionLoading: boolean;
  onArchiveToggle: () => void;
  onClose: () => void;
  onEdit: () => void;
  tree: Tree;
  visible: boolean;
}) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={{ backgroundColor: 'rgba(30,42,36,0.18)', flex: 1 }} onPress={onClose}>
        <View style={{ alignItems: 'flex-end', paddingRight: 20, paddingTop: 92 }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#DCE7D5',
              borderRadius: 14,
              borderWidth: 1,
              minWidth: 210,
              overflow: 'hidden',
            }}
          >
            <MenuItem label="Edit Pohon" onPress={onEdit} />
            <View style={{ backgroundColor: '#DCE7D5', height: 1 }} />
            <MenuItem
              danger={!tree.isArchived}
              disabled={actionLoading}
              label={tree.isArchived ? 'Pulihkan Pohon' : 'Arsipkan Pohon'}
              onPress={onArchiveToggle}
            />
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

function MenuItem({
  danger,
  disabled,
  label,
  onPress,
}: {
  danger?: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={{ opacity: disabled ? 0.6 : 1, padding: 14 }}>
      <Text selectable style={{ color: danger ? '#B42318' : '#1E2A24', fontSize: 15, fontWeight: '800' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Text selectable style={{ color: '#1E2A24', fontSize: 20, fontWeight: '800', paddingTop: 4 }}>
      {title}
    </Text>
  );
}

function formatFriendlyDate(value?: string | null): string {
  if (!value) {
    return 'Belum diisi';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
