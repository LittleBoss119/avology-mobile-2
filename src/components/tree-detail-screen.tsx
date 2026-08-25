import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from 'react-native';

import { colors, spacing, tokens, typography } from '../constants/theme';
import { getTreeConditionReports } from '../services/conditionReportService';
import { getTreeHistory } from '../services/historyService';
import {
  deleteTreeMainPhoto,
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
  PickedPhotoAsset,
  TreeMainPhoto,
} from '../types/media';
import {
  formatGrowthPhase,
  formatTreeAge,
  formatTreeDisplayCode,
  formatTreeLocation,
} from '../utils/treeFormat';
import {
  ConditionReportList,
  ConditionStatusBadge,
  TreeHistoryTimeline,
  type TreeHistoryRouteRecordType,
} from './tree-components';
import { BottomSheet, PhotoSourceSheet, SheetActionRow } from './bottom-sheet';
import { FloweringAgeMarker } from './flowering-marker';
import { Icon } from './icons';
import {
  Button,
  EmptyState,
  ErrorBanner,
  LoadingState,
  Screen,
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
  const [recordSheetOpen, setRecordSheetOpen] = React.useState(false);
  const [history, setHistory] = React.useState<TreeHistoryItem[]>([]);
  const [conditionPhotoMap, setConditionPhotoMap] = React.useState<ConditionRecordPhotoMap>({});
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
      setHistory([]);
      setReports([]);
      return;
    }

    if (mode === 'worker' && treeResult.data.isArchived) {
      setError('Pohon yang diarsipkan tidak tersedia untuk pekerja.');
      setTree(null);
      setTreeMainPhoto(null);
      setConditionPhotoMap({});
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
    } else {
      setHistory(historyResult.data);
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
      <Screen header={<TopAppBar title="Detail Pohon" onBack={() => router.back()} />}>
        <ErrorBanner message={error} />
        {error ? (
          <EmptyState title="Gagal memuat detail pohon" subtitle="Periksa koneksi lalu coba lagi." />
        ) : (
          <EmptyState title="Pohon tidak ditemukan" subtitle="Pohon mungkin sudah tidak tersedia atau akses ditolak." />
        )}
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

  function handleOpenHistoryRecord(item: TreeHistoryItem, recordType: TreeHistoryRouteRecordType) {
    if (!item.sourceId || !tree) {
      return;
    }

    router.push(`${basePath}/${tree.id}/records/${recordType}/${item.sourceId}`);
  }

  // RF-11a: tanggal fase 'flowering' TERAKHIR diturunkan dari history yang sudah
  // dimuat (item 'phase' membawa title enum mentah + happenedAt=recorded_at, sudah
  // terurut desc & terfilter is_deleted). Tidak perlu query/service tambahan.
  const lastFloweringAt =
    history.find((item) => item.historyType === 'phase' && item.title === 'flowering')?.happenedAt ?? null;

  const displayCode = formatTreeDisplayCode(tree);

  return (
    <Screen header={<TreeDetailTopBar mode={mode} onMenuPress={() => setMenuOpen(true)} />}>
      <ErrorBanner message={error} />

      <TreeDetailHero
        displayCode={displayCode}
        mode={mode}
        onPhotoPress={handleOpenPhotoSource}
        photoLoading={photoActionLoading}
        photoUrl={treeMainPhoto?.signedUrl}
        tree={tree}
      />
      {mode === 'owner' ? (
        <OwnerTreeMenu
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
      <PhotoSourceSheet
        hasPhoto={Boolean(treeMainPhoto)}
        onCameraPress={handleTakePhotoFromCamera}
        onClose={() => setPhotoSourceOpen(false)}
        onDeletePhoto={() => {
          setPhotoSourceOpen(false);
          handleDeletePhoto();
        }}
        onGalleryPress={handlePickPhotoFromGallery}
        visible={photoSourceOpen}
      />

      <InfoGrid tree={tree} />

      <FloweringAgeMarker currentGrowthPhase={tree.currentGrowthPhase} lastFloweringAt={lastFloweringAt} />

      <Button title="Catat aktivitas" onPress={() => setRecordSheetOpen(true)} />
      <RecordActivitySheet
        basePath={basePath}
        onClose={() => setRecordSheetOpen(false)}
        treeId={tree.id}
        visible={recordSheetOpen}
      />

      <SectionTitle subtitle="Riwayat kondisi, fase tumbuh, hasil panen, perawatan, dan aktivitas yang tercatat." title="Riwayat pohon" />
      <TreeHistoryTimeline
        currentUserId={profile?.id}
        history={history}
        onRecordPress={handleOpenHistoryRecord}
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
        hitSlop={{ bottom: 8, left: 8, right: 8, top: 8 }}
        onPress={onMenuPress}
        style={{
          alignItems: 'center',
          backgroundColor: tokens.color.surface.card,
          borderColor: colors.border,
          borderCurve: 'continuous',
          borderRadius: 11,
          borderWidth: 1,
          height: 32,
          justifyContent: 'center',
          width: 32,
        }}
      >
        <Icon name="dots" size={20} color={tokens.color.brand.base} />
      </Pressable>
    ) : undefined;

  return <TopAppBar right={right} title="Detail Pohon" onBack={() => router.back()} />;
}

function TreeDetailHero({
  displayCode,
  mode,
  onPhotoPress,
  photoLoading,
  photoUrl,
  tree,
}: {
  displayCode: string;
  mode: TreeDetailMode;
  onPhotoPress: () => void;
  photoLoading?: boolean;
  photoUrl?: string | null;
  tree: Tree;
}) {
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ borderRadius: tokens.radius.card, minHeight: 220, overflow: 'hidden' }}>
        <TreePhotoArea mode={mode} onPhotoPress={onPhotoPress} photoUrl={photoUrl} />
        {photoLoading ? (
          <View
            style={{
              alignItems: 'center',
              backgroundColor: tokens.color.overlay.scrim,
              bottom: 0,
              justifyContent: 'center',
              left: 0,
              position: 'absolute',
              right: 0,
              top: 0,
            }}
          >
            <ActivityIndicator color={tokens.color.brand.on} />
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text selectable style={{ color: colors.primary, fontSize: 32, fontWeight: '700', lineHeight: 38 }}>
            {displayCode}
          </Text>
          <Text selectable style={{ color: colors.textMuted, fontSize: 15, lineHeight: 21 }}>
            {formatTreeLocation(tree)}
          </Text>
        </View>
        <View style={{ justifyContent: 'center' }}>
          <ConditionStatusBadge status={tree.currentCondition} />
        </View>
      </View>
    </View>
  );
}

function TreePhotoArea({
  mode,
  onPhotoPress,
  photoUrl,
}: {
  mode: TreeDetailMode;
  onPhotoPress: () => void;
  photoUrl?: string | null;
}) {
  if (photoUrl) {
    return (
      <>
        <Image
          resizeMode="cover"
          source={{ uri: photoUrl }}
          style={{ bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 }}
        />
        {mode === 'owner' ? (
          <Pressable
            accessibilityLabel="Ubah foto pohon"
            accessibilityRole="button"
            onPress={onPhotoPress}
            style={{
              alignItems: 'center',
              backgroundColor: tokens.color.brand.base,
              borderRadius: tokens.radius.pill,
              bottom: tokens.space.md,
              height: 40,
              justifyContent: 'center',
              position: 'absolute',
              right: tokens.space.md,
              width: 40,
            }}
          >
            <Icon name="camera" size={tokens.icon.md} color={tokens.color.brand.on} />
          </Pressable>
        ) : null}
      </>
    );
  }

  if (mode === 'owner') {
    return (
      <Pressable
        accessibilityLabel="Tambah foto pohon"
        accessibilityRole="button"
        onPress={onPhotoPress}
        style={{
          alignItems: 'center',
          backgroundColor: tokens.color.surface.subtle,
          borderColor: tokens.color.line.card,
          borderStyle: 'dashed',
          borderWidth: 1,
          justifyContent: 'center',
          minHeight: 220,
        }}
      >
        <View
          style={{
            alignItems: 'center',
            backgroundColor: tokens.color.brand.soft,
            borderRadius: tokens.radius.pill,
            height: 48,
            justifyContent: 'center',
            width: 48,
          }}
        >
          <Icon name="camera" size={24} color={tokens.color.brand.base} />
        </View>
        <Text
          selectable
          style={{ ...tokens.type.bodyStrong, color: tokens.color.text.secondary, marginTop: tokens.space.sm }}
        >
          Tambah foto
        </Text>
      </Pressable>
    );
  }

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: tokens.color.surface.subtle,
        borderColor: tokens.color.line.card,
        borderStyle: 'solid',
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 220,
      }}
    >
      <Text selectable style={{ ...tokens.type.bodySmall, color: tokens.color.text.tertiary }}>
        Belum ada foto
      </Text>
    </View>
  );
}

function InfoGrid({ tree }: { tree: Tree }) {
  const items = [
    // Ketiganya milik SIKLUS TANAM yang sedang berjalan, bukan posisinya
    // (migrasi 055). Posisi yang siklusnya sudah ditutup tidak punya varietas
    // maupun tanggal tanam — di situ activePlanting bernilai null.
    { label: 'Varietas', value: tree.activePlanting?.variety || 'Belum diisi' },
    { label: 'Tanggal tanam', value: formatFriendlyDate(tree.activePlanting?.plantedAt ?? null) },
    { label: 'Umur pohon', value: formatTreeAge(tree.activePlanting?.plantedAt ?? null) },
    { label: 'Fase tumbuh', value: formatGrowthPhase(tree.currentGrowthPhase) },
  ];

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.lg }}>
      {items.map((item) => (
        <View key={item.label} style={{ flexBasis: '50%', paddingRight: spacing.md }}>
          <InfoCell label={item.label} value={item.value} />
        </View>
      ))}
    </View>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 3 }}>
      <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
        {label}
      </Text>
      <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
        {value}
      </Text>
    </View>
  );
}

function RecordActivitySheet({
  basePath,
  onClose,
  treeId,
  visible,
}: {
  basePath: string;
  onClose: () => void;
  treeId: string;
  visible: boolean;
}) {
  function goTo(path: string) {
    onClose();
    router.push(path);
  }

  return (
    <BottomSheet onClose={onClose} title="Catat aktivitas" visible={visible}>
      <View style={{ gap: tokens.space.sm }}>
        <SheetActionRow
          icon="alert-triangle"
          iconTone="condition"
          title="Catat kondisi"
          onPress={() => goTo(`${basePath}/${treeId}/report`)}
        />
        <SheetActionRow
          icon="flower"
          iconTone="phase"
          title="Catat fase"
          onPress={() => goTo(`${basePath}/${treeId}/phase`)}
        />
        <SheetActionRow
          icon="basket"
          iconTone="harvest"
          title="Catat panen"
          onPress={() => goTo(`${basePath}/${treeId}/harvest`)}
        />
        <SheetActionRow
          icon="spray"
          iconTone="care"
          title="Catat perawatan"
          onPress={() => goTo(`${basePath}/${treeId}/care`)}
        />
      </View>
    </BottomSheet>
  );
}

function OwnerTreeMenu({
  onArchiveToggle,
  onClose,
  onEdit,
  tree,
  visible,
}: {
  onArchiveToggle: () => void;
  onClose: () => void;
  onEdit: () => void;
  tree: Tree;
  visible: boolean;
}) {
  return (
    <BottomSheet onClose={onClose} title="Kelola data pohon" visible={visible}>
      <View style={{ gap: tokens.space.sm }}>
        <SheetActionRow icon="file-text" iconTone="neutral" title="Edit Pohon" onPress={onEdit} />
        <SheetActionRow
          icon="building-warehouse"
          iconTone="neutral"
          title={tree.isArchived ? 'Pulihkan Pohon' : 'Arsipkan Pohon'}
          onPress={onArchiveToggle}
        />
      </View>
    </BottomSheet>
  );
}

function SectionTitle({ subtitle, title }: { subtitle?: string; title: string }) {
  return (
    <View style={{ gap: spacing.xs, paddingTop: spacing.xs }}>
      <Text selectable style={{ color: colors.text, fontSize: typography.h2.fontSize, fontWeight: '700', lineHeight: typography.h2.lineHeight }}>
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
