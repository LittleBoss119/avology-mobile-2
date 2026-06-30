import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../constants/theme';
import { getTreeConditionReports } from '../services/conditionReportService';
import { getTreeHistory } from '../services/historyService';
import {
  deleteTreeMainPhoto,
  getGrowthPhaseRecordPhotos,
  getTreeMainPhoto,
  listConditionRecordPhotosForTree,
  uploadTreeMainPhoto,
} from '../services/photoAttachmentService';
import { archiveTree, getTreeDetail, restoreTree } from '../services/treeService';
import { useAuth } from '../context/auth-context';
import { pickImageFromGallery, takePhotoFromCamera } from '../lib/media';
import type { Tree, TreeConditionReport, TreeHistoryItem } from '../types/domain';
import type {
  ConditionRecordPhotoMap,
  GrowthPhaseRecordPhotoMap,
  PickedPhotoAsset,
  TreeMainPhoto,
} from '../types/media';
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
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  MetaRow,
  Screen,
  SectionHeader,
  TopAppBar,
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
  const [conditionPhotoMap, setConditionPhotoMap] = React.useState<ConditionRecordPhotoMap>({});
  const [growthPhasePhotoMap, setGrowthPhasePhotoMap] = React.useState<GrowthPhaseRecordPhotoMap>({});
  const [photoActionLoading, setPhotoActionLoading] = React.useState(false);
  const [photoSourceOpen, setPhotoSourceOpen] = React.useState(false);
  const [reports, setReports] = React.useState<TreeConditionReport[]>([]);
  const [tree, setTree] = React.useState<Tree | null>(null);
  const [treeMainPhoto, setTreeMainPhoto] = React.useState<TreeMainPhoto | null>(null);

  const loadDetail = React.useCallback(async () => {
    if (!treeId) {
      setError('Data pohon tidak ditemukan.');
      setTree(null);
      setTreeMainPhoto(null);
      setConditionPhotoMap({});
      setGrowthPhasePhotoMap({});
      setHistory([]);
      setReports([]);
      return;
    }

    setError(null);

    const treeResult = await getTreeDetail({ treeId });

    if (treeResult.error) {
      setError(treeResult.error.message);
      setTree(null);
      setTreeMainPhoto(null);
      setConditionPhotoMap({});
      setGrowthPhasePhotoMap({});
      setHistory([]);
      setReports([]);
      return;
    }

    if (mode === 'worker' && treeResult.data.isArchived) {
      setError('Pohon yang diarsipkan tidak tersedia untuk pekerja.');
      setTree(null);
      setTreeMainPhoto(null);
      setConditionPhotoMap({});
      setGrowthPhasePhotoMap({});
      setHistory([]);
      setReports([]);
      return;
    }

    setTree(treeResult.data);

    const [reportsResult, historyResult, photoResult] = await Promise.all([
      getTreeConditionReports({ treeId }),
      getTreeHistory({ treeId }),
      getTreeMainPhoto(treeResult.data.farmId, treeResult.data.id),
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
      setGrowthPhasePhotoMap({});
    } else {
      setHistory(historyResult.data);
      await loadGrowthPhasePhotos(treeResult.data.farmId, historyResult.data);
    }

    if (photoResult.error) {
      setTreeMainPhoto(null);
    } else {
      setTreeMainPhoto(photoResult.data);
    }

    if (reportsResult.data && reportsResult.data.length > 0) {
      const conditionPhotoResult = await listConditionRecordPhotosForTree({
        conditionRecordIds: reportsResult.data.map((report) => report.id),
        farmId: treeResult.data.farmId,
        treeId: treeResult.data.id,
      });

      setConditionPhotoMap(conditionPhotoResult.data ?? {});
    } else {
      setConditionPhotoMap({});
    }
  }, [mode, treeId]);

  async function loadGrowthPhasePhotos(farmId: string, historyItems: TreeHistoryItem[]) {
    const growthPhaseRecordIds = Array.from(
      new Set(
        historyItems
          .filter((item) => item.historyType === 'phase' && Boolean(item.sourceId))
          .map((item) => item.sourceId as string)
      )
    );

    if (growthPhaseRecordIds.length === 0) {
      setGrowthPhasePhotoMap({});
      return;
    }

    const entries = await Promise.all(
      growthPhaseRecordIds.map(async (growthPhaseRecordId) => {
        const result = await getGrowthPhaseRecordPhotos({
          farmId,
          growthPhaseRecordId,
        });

        if (result.error || result.data.length === 0) {
          return null;
        }

        return [growthPhaseRecordId, result.data] as const;
      })
    );

    setGrowthPhasePhotoMap(
      Object.fromEntries(
        entries.filter((entry): entry is [string, GrowthPhaseRecordPhotoMap[string]] => entry !== null)
      )
    );
  }

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
        <TopAppBar title="Detail Pohon" onBack={() => router.back()} />
        <ErrorBanner message={error} />
        <EmptyState title="Pohon tidak ditemukan" subtitle="Pohon mungkin sudah tidak tersedia atau akses ditolak." />
      </Screen>
    );
  }

  function handleOpenPhotoSource() {
    setMenuOpen(false);
    setPhotoSourceOpen(true);
  }

  async function handlePickPhotoFromGallery() {
    const result = await pickImageFromGallery();

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (!result.data) {
      setPhotoSourceOpen(false);
      return;
    }

    await runTreePhotoUpload(result.data);
  }

  async function handleTakePhotoFromCamera() {
    const result = await takePhotoFromCamera();

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (!result.data) {
      setPhotoSourceOpen(false);
      return;
    }

    await runTreePhotoUpload(result.data);
  }

  async function runTreePhotoUpload(asset: PickedPhotoAsset) {
    if (!tree) {
      return;
    }

    setPhotoActionLoading(true);
    setError(null);

    const result = await uploadTreeMainPhoto({
      base64: asset.base64,
      farmId: tree.farmId,
      fileName: asset.fileName,
      localUri: asset.uri,
      mimeType: asset.mimeType,
      treeId: tree.id,
    });

    if (result.error) {
      setError(result.error.message);
      setPhotoActionLoading(false);
      return;
    }

    setTreeMainPhoto(result.data);
    setPhotoSourceOpen(false);
    setPhotoActionLoading(false);
  }

  function handleDeletePhoto() {
    setMenuOpen(false);

    if (!treeMainPhoto || !tree) {
      return;
    }

    Alert.alert(
      'Hapus foto pohon?',
      'Foto utama pohon akan dihapus dari penyimpanan. Data pohon dan riwayat tetap tersimpan.',
      [
        {
          text: 'Batal',
          style: 'cancel',
        },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => {
            runDeletePhoto();
          },
        },
      ]
    );
  }

  async function runDeletePhoto() {
    if (!tree) {
      return;
    }

    setPhotoActionLoading(true);
    setError(null);

    const result = await deleteTreeMainPhoto({
      farmId: tree.farmId,
      treeId: tree.id,
    });

    if (result.error) {
      setError(result.error.message);
      setPhotoActionLoading(false);
      return;
    }

    setTreeMainPhoto(null);
    setPhotoActionLoading(false);
  }

  const displayCode = formatTreeDisplayCode(tree);

  return (
    <Screen>
      <TreeDetailTopBar mode={mode} onMenuPress={() => setMenuOpen(true)} />
      <ErrorBanner message={error} />

      <TreeDetailHero
        displayCode={displayCode}
        photoLoading={photoActionLoading}
        photoUrl={treeMainPhoto?.signedUrl}
        tree={tree}
      />
      {mode === 'owner' ? (
        <OwnerTreeMenu
          actionLoading={actionLoading || photoActionLoading}
          hasPhoto={Boolean(treeMainPhoto)}
          onArchiveToggle={() => {
            setMenuOpen(false);
            handleArchiveToggle();
          }}
          onClose={() => setMenuOpen(false)}
          onDeletePhoto={handleDeletePhoto}
          onEdit={() => {
            setMenuOpen(false);
            router.push(`${basePath}/${tree.id}/edit`);
          }}
          onPhotoChange={handleOpenPhotoSource}
          tree={tree}
          visible={menuOpen}
        />
      ) : null}
      <PhotoSourceSheet
        loading={photoActionLoading}
        onCameraPress={handleTakePhotoFromCamera}
        onClose={() => setPhotoSourceOpen(false)}
        onGalleryPress={handlePickPhotoFromGallery}
        visible={photoSourceOpen}
      />

      <InfoGrid mode={mode} tree={tree} />

      <ActionSection basePath={basePath} tree={tree} />

      <SectionTitle subtitle="Riwayat kondisi, fase tumbuh, dan aktivitas yang tercatat." title="Timeline Riwayat" />
      <TreeHistoryTimeline
        conditionPhotoMap={conditionPhotoMap}
        currentUserId={profile?.id}
        growthPhasePhotoMap={growthPhasePhotoMap}
        history={history}
        viewerMode={mode}
      />

      {history.length === 0 && reports.length > 0 ? (
        <>
          <SectionTitle subtitle="Laporan kondisi tampil sebagai cadangan jika timeline belum tersedia." title="Laporan Kondisi" />
          <ConditionReportList
            conditionPhotoMap={conditionPhotoMap}
            currentUserId={profile?.id}
            reports={reports}
            viewerMode={mode}
          />
        </>
      ) : null}
    </Screen>
  );
}

function TreeDetailTopBar({ mode, onMenuPress }: { mode: TreeDetailMode; onMenuPress: () => void }) {
  const right =
    mode === 'owner' ? (
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
          width: 44,
        }}
      >
        <Text selectable style={{ color: '#065F2E', fontSize: 22, fontWeight: '900', lineHeight: 24 }}>
          ...
        </Text>
      </Pressable>
    ) : undefined;

  return <TopAppBar right={right} title="Detail Pohon" onBack={() => router.back()} />;
}

function TreeDetailHero({
  displayCode,
  photoLoading,
  photoUrl,
  tree,
}: {
  displayCode: string;
  photoLoading?: boolean;
  photoUrl?: string | null;
  tree: Tree;
}) {
  return (
    <Card variant="highlight">
      <View>
        <TreeVisualPlaceholder condition={tree.currentCondition} photoUrl={photoUrl} />
        {photoLoading ? (
          <View
            style={{
              alignItems: 'center',
              backgroundColor: 'rgba(6,95,46,0.66)',
              borderRadius: radius.xl,
              bottom: 0,
              justifyContent: 'center',
              left: 0,
              position: 'absolute',
              right: 0,
              top: 0,
            }}
          >
            <ActivityIndicator color="#FFFFFF" />
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text selectable style={{ color: colors.primary, fontSize: 32, fontWeight: '900', lineHeight: 38 }}>
            {displayCode}
          </Text>
          <Text selectable style={{ color: colors.textMuted, fontSize: 16, lineHeight: 22 }}>
            {tree.variety || 'Varietas belum diisi'}
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
      <SectionHeader title="Informasi Pohon" description="Identitas dan kondisi utama pohon." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.lg }}>
        {items.map((item) => (
          <View key={item.label} style={{ flexBasis: '50%', gap: spacing.xs, paddingRight: spacing.md }}>
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
      <SectionHeader title="Aksi Pohon" description="Catat kondisi atau fase terbaru pohon ini." />
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <TreeActionButton
          label="Catat Kondisi"
          onPress={() => router.push(`${basePath}/${tree.id}/report`)}
          tone="primary"
        />
        <TreeActionButton label="Catat Fase" onPress={() => router.push(`${basePath}/${tree.id}/phase`)} />
      </View>
    </Card>
  );
}

function TreeActionButton({
  label,
  onPress,
  tone = 'secondary',
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary';
}) {
  const isPrimary = tone === 'primary';

  return (
    <Pressable
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: isPrimary ? colors.primary : colors.surface,
        borderColor: isPrimary ? colors.primary : colors.border,
        borderCurve: 'continuous',
        borderRadius: radius.lg,
        borderWidth: 1,
        flex: 1,
        justifyContent: 'center',
        minHeight: 50,
        paddingHorizontal: 10,
      }}
    >
      <Text selectable style={{ color: isPrimary ? colors.white : colors.primary, fontSize: 14, fontWeight: '900' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function OwnerTreeMenu({
  actionLoading,
  hasPhoto,
  onArchiveToggle,
  onClose,
  onDeletePhoto,
  onEdit,
  onPhotoChange,
  tree,
  visible,
}: {
  actionLoading: boolean;
  hasPhoto: boolean;
  onArchiveToggle: () => void;
  onClose: () => void;
  onDeletePhoto: () => void;
  onEdit: () => void;
  onPhotoChange: () => void;
  tree: Tree;
  visible: boolean;
}) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={{ backgroundColor: 'rgba(30,42,36,0.04)', flex: 1 }} onPress={onClose}>
        <View style={{ alignItems: 'flex-end', paddingRight: 20, paddingTop: 92 }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#DCE7D5',
              borderRadius: 14,
              borderWidth: 1,
              elevation: 5,
              minWidth: 210,
              overflow: 'hidden',
              shadowColor: '#1E2A24',
              shadowOffset: { height: 4, width: 0 },
              shadowOpacity: 0.14,
              shadowRadius: 14,
            }}
          >
            <MenuItem
              disabled={actionLoading}
              label={hasPhoto ? 'Ganti Foto Pohon' : 'Tambah Foto Pohon'}
              onPress={onPhotoChange}
            />
            {hasPhoto ? (
              <>
                <View style={{ backgroundColor: '#DCE7D5', height: 1 }} />
                <MenuItem danger disabled={actionLoading} label="Hapus Foto Pohon" onPress={onDeletePhoto} />
              </>
            ) : null}
            <View style={{ backgroundColor: '#DCE7D5', height: 1 }} />
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

function PhotoSourceSheet({
  loading,
  onCameraPress,
  onClose,
  onGalleryPress,
  visible,
}: {
  loading: boolean;
  onCameraPress: () => void;
  onClose: () => void;
  onGalleryPress: () => void;
  visible: boolean;
}) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={{ backgroundColor: 'rgba(30,42,36,0.12)', flex: 1 }} onPress={onClose} />
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          gap: 12,
          paddingBottom: 28,
          paddingHorizontal: 22,
          paddingTop: 12,
        }}
      >
        <View style={{ alignSelf: 'center', backgroundColor: '#DCE7D5', borderRadius: 999, height: 5, width: 48 }} />
        <Text selectable style={{ color: '#1E2A24', fontSize: 20, fontWeight: '900' }}>
          Foto Pohon
        </Text>
        <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
          Ambil foto baru atau pilih dari galeri.
        </Text>
        <MenuItem disabled={loading} label="Ambil Foto" onPress={onCameraPress} />
        <View style={{ backgroundColor: colors.divider, height: 1 }} />
        <MenuItem disabled={loading} label="Pilih dari Galeri" onPress={onGalleryPress} />
        <View style={{ backgroundColor: colors.divider, height: 1 }} />
        <MenuItem disabled={loading} label="Batal" onPress={onClose} />
      </View>
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
      <Text selectable style={{ color: danger ? colors.danger : colors.text, fontSize: 15, fontWeight: '800' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function SectionTitle({ subtitle, title }: { subtitle?: string; title: string }) {
  return (
    <View style={{ gap: spacing.xs, paddingTop: spacing.xs }}>
      <Text selectable style={{ color: colors.text, fontSize: typography.h2.fontSize, fontWeight: '800', lineHeight: typography.h2.lineHeight }}>
        {title}
      </Text>
      {subtitle ? (
        <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
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
