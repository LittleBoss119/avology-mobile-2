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
import {
  archiveTree,
  endTreePlanting,
  getTreeDetail,
  listTreePlantings,
  restoreTree,
  startTreePlanting,
} from '../services/treeService';
import { useAuth } from '../context/auth-context';
import { PHOTO_PROCESSING_MESSAGE, pickImageFromGallery, takePhotoFromCamera } from '../lib/media';
import type {
  Tree,
  TreeConditionReport,
  TreeHistoryItem,
  TreePlanting,
} from '../types/domain';
import type {
  ConditionRecordPhotoMap,
  PickedPhotoAsset,
  TreeMainPhoto,
} from '../types/media';
import { findLastEndedPlanting, formatPlantingEndSummary } from '../utils/treeCycle';
import { formatTreeAge, formatTreeDisplayCode, formatTreeLocation } from '../utils/treeFormat';
import {
  ConditionReportList,
  ConditionStatusBadge,
  GrowthPhaseBadge,
  TreeHistoryTimeline,
  type TreeHistoryRouteRecordType,
} from './tree-components';
import { BottomSheet, PhotoSourceSheet, SheetActionRow } from './bottom-sheet';
import {
  EndTreePlantingSheet,
  StartTreePlantingSheet,
  type EndTreePlantingFormValues,
  type StartTreePlantingFormValues,
} from './tree-planting-sheets';
import { FloweringAgeMarker } from './flowering-marker';
import { Icon } from './icons';
import { useSnackbar } from './snackbar';
import {
  Badge,
  Button,
  Card,
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
  const showSnackbar = useSnackbar();
  const [actionLoading, setActionLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [recordSheetOpen, setRecordSheetOpen] = React.useState(false);
  const [history, setHistory] = React.useState<TreeHistoryItem[]>([]);
  const [plantings, setPlantings] = React.useState<TreePlanting[]>([]);
  // Galat siklus tanam dipisahkan dari `error` layar supaya ia tampil DI DALAM
  // sheet yang gagal, tepat di atas tombolnya — bukan di balik sheet, di tempat
  // yang tidak terlihat selama sheet-nya masih terbuka.
  const [cycleError, setCycleError] = React.useState<string | null>(null);
  const [cycleLoading, setCycleLoading] = React.useState(false);
  const [endSheetOpen, setEndSheetOpen] = React.useState(false);
  const [startSheetOpen, setStartSheetOpen] = React.useState(false);
  const [conditionPhotoMap, setConditionPhotoMap] = React.useState<ConditionRecordPhotoMap>({});
  const [photoActionLoading, setPhotoActionLoading] = React.useState(false);
  const [photoActionLabel, setPhotoActionLabel] = React.useState<string | null>(null);
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
      setPlantings([]);
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
      setPlantings([]);
      setReports([]);
      return;
    }

    if (mode === 'worker' && treeResult.data.isArchived) {
      setError('Pohon yang diarsipkan tidak tersedia untuk pekerja.');
      setTree(null);
      setTreeMainPhoto(null);
      setConditionPhotoMap({});
      setHistory([]);
      setPlantings([]);
      setReports([]);
      return;
    }

    setTree(treeResult.data);

    const [reportsResult, historyResult, photoResult, plantingsResult] = await Promise.all([
      getTreeConditionReports({ treeId }),
      getTreeHistory({ treeId }),
      getTreeMainPhoto(treeResult.data.farmId, treeResult.data.id),
      listTreePlantings({ treeId }),
    ]);

    // Siklus tanam TIDAK menaikkan `error` layar. Ia hanya bahan tambahan —
    // pembatas di riwayat dan keterangan posisi kosong. Kalau pengambilannya
    // gagal, layarnya tetap utuh dengan riwayat datar tanpa pembatas; memerahkan
    // seluruh layar demi hiasan riwayat menukar hal kecil dengan hal besar.
    setPlantings(plantingsResult.data ?? []);

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

  // Kedua aksi siklus di bawah menutup sheet-nya DULU, baru memuat ulang.
  //
  // Bukan urutan bebas: sheet adalah konfirmasinya, jadi pemuatan ulang hanya
  // boleh berjalan setelah pemilik menekan tombolnya, dan tidak boleh berjalan
  // di belakang sheet yang masih terbuka. Sheet yang GAGAL sengaja tetap
  // terbuka — galatnya tampil di dalamnya dan isian pemilik tidak hilang.
  async function runEndPlanting(values: EndTreePlantingFormValues) {
    if (!tree) {
      return;
    }

    setCycleLoading(true);
    setCycleError(null);

    const result = await endTreePlanting({
      endReason: values.endReason,
      endedAt: values.endedAt,
      treeId: tree.id,
    });

    if (result.error) {
      setCycleError(result.error.message);
      setCycleLoading(false);
      return;
    }

    setCycleLoading(false);
    setEndSheetOpen(false);
    await loadDetail();
    showSnackbar('Pohon ditandai sudah tidak ada');
  }

  async function runStartPlanting(values: StartTreePlantingFormValues) {
    if (!tree) {
      return;
    }

    setCycleLoading(true);
    setCycleError(null);

    const result = await startTreePlanting({
      plantedAt: values.plantedAt,
      treeId: tree.id,
      variety: values.variety,
    });

    if (result.error) {
      setCycleError(result.error.message);
      setCycleLoading(false);
      return;
    }

    setCycleLoading(false);
    setStartSheetOpen(false);
    await loadDetail();
    showSnackbar('Pohon baru ditanam');
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

  // Layar ini mengunggah LANGSUNG setelah memilih, jadi keadaan sibuknya
  // menyelimuti dua tahap berturut-turut: perkecil, lalu unggah. Hanya tahap
  // pertama yang diberi keterangan; tahap unggah tetap seperti sebelumnya,
  // pemintal tanpa teks.
  async function handlePickPhotoFromGallery() {
    setPhotoActionLoading(true);
    setPhotoActionLabel(PHOTO_PROCESSING_MESSAGE);

    try {
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
    } finally {
      setPhotoActionLoading(false);
      setPhotoActionLabel(null);
    }
  }

  async function handleTakePhotoFromCamera() {
    setPhotoActionLoading(true);
    setPhotoActionLabel(PHOTO_PROCESSING_MESSAGE);

    try {
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
    } finally {
      setPhotoActionLoading(false);
      setPhotoActionLabel(null);
    }
  }

  async function runTreePhotoUpload(asset: PickedPhotoAsset) {
    if (!tree) {
      return;
    }

    setPhotoActionLoading(true);
    setPhotoActionLabel(null);
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

  // SATU-SATUNYA pembeda dua keadaan layar ini.
  //
  // activePlanting null berarti siklus terakhir posisi ini sudah ditutup: tidak
  // ada varietas, tidak ada tanggal tanam, dan layar edit akan ditolak RPC.
  // Bukan is_archived — arsip menyembunyikan posisinya dari daftar, sedangkan
  // ini soal ada atau tidaknya pohon di posisi yang tetap ditampilkan.
  const activePlanting = tree.activePlanting;
  const lastEndedPlanting = findLastEndedPlanting(plantings);

  return (
    <Screen
      header={
        <TreeDetailTopBar
          mode={mode}
          onMenuPress={() => setMenuOpen(true)}
          title={activePlanting ? 'Detail Pohon' : 'Detail Posisi'}
        />
      }
    >
      <ErrorBanner message={error} />

      {/* Foto disembunyikan saat posisinya kosong: foto itu milik pohon yang
          sudah tidak ada, dan menampilkannya di atas tulisan "Belum ditanami"
          membuat layar membantah dirinya sendiri. Berkasnya tidak dihapus. */}
      {activePlanting ? (
        <TreeDetailHero
          displayCode={displayCode}
          mode={mode}
          onPhotoPress={handleOpenPhotoSource}
          photoLoading={photoActionLoading}
          photoLoadingLabel={photoActionLabel}
          photoUrl={treeMainPhoto?.signedUrl}
          tree={tree}
        />
      ) : (
        <EmptyPositionHeader displayCode={displayCode} tree={tree} />
      )}
      {mode === 'owner' ? (
        <OwnerTreeMenu
          onArchiveToggle={() => {
            setMenuOpen(false);
            handleArchiveToggle();
          }}
          onClose={() => setMenuOpen(false)}
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

      {activePlanting ? (
        <>
          <CurrentPlantingCard planting={activePlanting} />

          <FloweringAgeMarker currentGrowthPhase={tree.currentGrowthPhase} lastFloweringAt={lastFloweringAt} />

          {/* Tiga tombol lebar berlabel, menurun sesuai seberapa sering
              dipakai: mencatat aktivitas berkali-kali sehari, mengoreksi data
              sesekali, menutup siklus mungkin sekali seumur pohon. */}
          <View style={{ gap: spacing.md }}>
            <Button title="Catat aktivitas" onPress={() => setRecordSheetOpen(true)} />
            {mode === 'owner' ? (
              <>
                <Button
                  title="Ubah data pohon"
                  variant="secondary"
                  onPress={() => router.push(`${basePath}/${tree.id}/edit`)}
                />
                {/* Nada 'danger' di sini adalah merah LEMBUT (latar
                    status.danger.bg, teks status.danger.text), bukan tombol
                    merah pekat — satu-satunya nada peringatan yang sudah punya
                    varian tombol di proyek ini. */}
                <Button
                  title="Tandai pohon sudah tidak ada"
                  variant="danger"
                  onPress={() => {
                    setCycleError(null);
                    setEndSheetOpen(true);
                  }}
                />
              </>
            ) : null}
          </View>
        </>
      ) : (
        <>
          <EmptyPositionNotice planting={lastEndedPlanting} />

          {mode === 'owner' ? (
            <Button
              title="Tanam pohon di sini"
              onPress={() => {
                setCycleError(null);
                setStartSheetOpen(true);
              }}
            />
          ) : null}
        </>
      )}

      <RecordActivitySheet
        basePath={basePath}
        onClose={() => setRecordSheetOpen(false)}
        treeId={tree.id}
        visible={recordSheetOpen}
      />
      <EndTreePlantingSheet
        error={cycleError}
        loading={cycleLoading}
        onClose={() => setEndSheetOpen(false)}
        onSubmit={runEndPlanting}
        visible={endSheetOpen}
      />
      <StartTreePlantingSheet
        displayCode={displayCode}
        error={cycleError}
        loading={cycleLoading}
        onClose={() => setStartSheetOpen(false)}
        onSubmit={runStartPlanting}
        visible={startSheetOpen}
      />

      <SectionTitle subtitle="Riwayat kondisi, fase tumbuh, hasil panen, perawatan, dan aktivitas yang tercatat." title="Riwayat pohon" />
      <TreeHistoryTimeline
        currentUserId={profile?.id}
        history={history}
        onRecordPress={handleOpenHistoryRecord}
        plantings={plantings}
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

function TreeDetailTopBar({
  mode,
  onMenuPress,
  title,
}: {
  mode: TreeDetailMode;
  onMenuPress: () => void;
  title: string;
}) {
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

  return <TopAppBar right={right} title={title} onBack={() => router.back()} />;
}

function TreeDetailHero({
  displayCode,
  mode,
  onPhotoPress,
  photoLoading,
  photoLoadingLabel,
  photoUrl,
  tree,
}: {
  displayCode: string;
  mode: TreeDetailMode;
  onPhotoPress: () => void;
  photoLoading?: boolean;
  photoLoadingLabel?: string | null;
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
              gap: spacing.sm,
              justifyContent: 'center',
              left: 0,
              padding: spacing.lg,
              position: 'absolute',
              right: 0,
              top: 0,
            }}
          >
            <ActivityIndicator color={tokens.color.brand.on} />
            {photoLoadingLabel ? (
              <Text
                selectable={false}
                style={{
                  color: tokens.color.text.onBrand,
                  textAlign: 'center',
                  ...tokens.type.bodySmall,
                }}
              >
                {photoLoadingLabel}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      <View style={{ gap: spacing.md }}>
        <View style={{ gap: spacing.xs }}>
          <Text selectable style={{ color: colors.primary, fontSize: 32, fontWeight: '700', lineHeight: 38 }}>
            {displayCode}
          </Text>
          <Text selectable style={{ color: colors.textMuted, fontSize: 15, lineHeight: 21 }}>
            {formatTreeLocation(tree)}
          </Text>
        </View>
        {/* Kondisi dan fase berdampingan di BAWAH kode, bukan di sebelahnya.
            Berdampingan dengan kode, keduanya harus berbagi lebar dengan teks
            32pt dan salah satunya pasti terpotong; sebaris sendiri, keduanya
            muat utuh dan terbaca sebagai sepasang. */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <ConditionStatusBadge status={tree.currentCondition} />
          {tree.currentGrowthPhase ? <GrowthPhaseBadge phase={tree.currentGrowthPhase} /> : null}
        </View>
      </View>
    </View>
  );
}

// Kepala Keadaan B. Sepadan dengan kepala pohon aktif — kode besar, keterangan
// posisi, lalu tagnya — supaya berpindah keadaan tidak terasa seperti berpindah
// layar. Yang hilang cuma fotonya, dan tagnya tinggal satu.
function EmptyPositionHeader({ displayCode, tree }: { displayCode: string; tree: Tree }) {
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: spacing.xs }}>
        <Text selectable style={{ color: colors.primary, fontSize: 32, fontWeight: '700', lineHeight: 38 }}>
          {displayCode}
        </Text>
        <Text selectable style={{ color: colors.textMuted, fontSize: 15, lineHeight: 21 }}>
          {formatTreeLocation(tree)}
        </Text>
      </View>
      <View style={{ flexDirection: 'row' }}>
        <Badge label="Belum ditanami" maxWidth={200} tone="neutral" />
      </View>
    </View>
  );
}

// Kotak keterangan Keadaan B: kapan dan kenapa pohon sebelumnya berakhir.
//
// Kalimat kedua BOLEH menjanjikan berhentinya jadwal perawatan sejak migrasi
// 057: create_manual_schedule dan create_successor_schedule sama-sama menolak
// posisi tanpa siklus tanam aktif, dan pemilih pohon di layar buat maupun
// sunting jadwal tidak lagi menampilkannya.
//
// SATU CABANG BELUM TERTUTUP: jadwal bertarget SELURUH KEBUN masih menautkan
// posisi ini lewat complete_task, yang menyaring is_archived tapi bukan siklus
// tanam. Diperbaiki di migrasi 058.
function EmptyPositionNotice({ planting }: { planting: TreePlanting | null }) {
  return (
    <Card variant="warning">
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Icon name="alert-triangle" size={tokens.icon.md} color={tokens.color.status.warning.text} />
        <Text selectable style={{ color: tokens.color.status.warning.text, flex: 1, lineHeight: 21 }}>
          {formatPlantingEndSummary(planting)} Posisi ini tidak mendapat jadwal perawatan sampai ditanami lagi.
          Riwayat pohon sebelumnya tetap tersimpan di bawah.
        </Text>
      </View>
    </Card>
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

// Kartu "Pohon yang ditanam sekarang" — pengganti InfoGrid yang dulu berdiri
// tanpa judul.
//
// Judulnya bukan hiasan: seluruh isi kartu ini milik SIKLUS TANAM yang sedang
// berjalan (migrasi 055), bukan milik posisinya. Sebuah posisi bisa ditanami
// berkali-kali, dan tanpa judul itu pembacanya wajar mengira varietas dan
// tanggal tanam adalah sifat tetap posisi tersebut.
//
// Fase tumbuh sengaja TIDAK di sini. Ia milik trees, bukan siklus, dan sudah
// tampil sebagai tag di kepala layar. Tempatnya digantikan penanaman ke berapa,
// satu-satunya angka yang memberi tahu bahwa posisi ini pernah ditanami
// sebelumnya.
function CurrentPlantingCard({ planting }: { planting: TreePlanting }) {
  const items = [
    { label: 'Varietas', value: planting.variety || 'Belum diisi' },
    { label: 'Tanggal tanam', value: formatFriendlyDate(planting.plantedAt) },
    { label: 'Umur pohon', value: formatTreeAge(planting.plantedAt) },
    { label: 'Penanaman ke', value: `${planting.cycleNo}` },
  ];

  return (
    <Card>
      <Text selectable style={{ ...tokens.type.subheading, color: colors.text }}>
        Pohon yang ditanam sekarang
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.lg }}>
        {items.map((item) => (
          <View key={item.label} style={{ flexBasis: '50%', paddingRight: spacing.md }}>
            <InfoCell label={item.label} value={item.value} />
          </View>
        ))}
      </View>
    </Card>
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

// Tinggal arsip. "Edit Pohon" DIPINDAH keluar dari sini menjadi tombol lebar
// "Ubah data pohon" di badan layar; menyisakan salinannya di menu berarti dua
// jalan berbeda ke layar yang sama, dan pembaca yang harus menebak apakah
// keduanya melakukan hal yang berbeda.
//
// Arsip tidak ikut naik jadi tombol: ia bukan bagian dari siklus tanam, jarang
// dipakai, dan menaikkannya akan menambah tombol keempat yang menyaingi tiga
// tombol yang benar-benar dipakai.
function OwnerTreeMenu({
  onArchiveToggle,
  onClose,
  tree,
  visible,
}: {
  onArchiveToggle: () => void;
  onClose: () => void;
  tree: Tree;
  visible: boolean;
}) {
  return (
    <BottomSheet onClose={onClose} title="Kelola data pohon" visible={visible}>
      <View style={{ gap: tokens.space.sm }}>
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
