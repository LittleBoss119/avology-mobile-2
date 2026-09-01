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
  getTreeDetail,
  listTreePlantings,
  startTreePlanting,
} from '../services/treeService';
import { useAuth } from '../context/auth-context';
import { PHOTO_PROCESSING_MESSAGE, pickImageFromGallery, takePhotoFromCamera } from '../lib/media';
import { consumePendingFeedback } from '../lib/pendingFeedback';
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
import { daysSinceLocal } from '../utils/dateDiff';
// cycleStartKey dan isOnOrAfterCycleStart TIDAK LAGI DIPAKAI DI SINI: keduanya
// dulu dipakai untuk mencari sendiri tanggal fase di daftar riwayat, dan itu
// sudah digantikan kolom trees.current_growth_phase_since. Keduanya tetap
// diekspor treeCycle.ts — lihat catatan di sana.
import { findLastEndedPlanting, formatPlantingEndSummary } from '../utils/treeCycle';
import { formatTreeAge, formatTreeDisplayCode, formatTreeLocation } from '../utils/treeFormat';
import { PhotoViewerModal } from './media';
import {
  ConditionReportList,
  ConditionStatusBadge,
  GrowthPhaseBadge,
  TreeHistoryTimeline,
  type TreeHistoryRouteRecordType,
} from './tree-components';
import { BottomSheet, PhotoSourceSheet, SheetActionRow } from './bottom-sheet';
import {
  StartTreePlantingSheet,
  type StartTreePlantingFormValues,
} from './tree-planting-sheets';
// FloweringAgeMarker TIDAK LAGI DIPAKAI DI SINI. Chip fase sudah membawa umur
// fasenya, dan pita terpisah di bawahnya mengulang angka yang sama satu layar
// lebih rendah. Komponennya TETAP ADA di repo — layar monitoring fase
// memakainya, dan bentuk pita di sana masih pada tempatnya.
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

// Pesan yang dititipkan layar lain lewat pendingFeedback. Peta, bukan
// perbandingan string di tempat pemakaian, mengikuti profile-screen.tsx:17 —
// kunci yang tidak dikenal menghasilkan undefined dan tidak menampilkan apa pun.
const PENDING_FEEDBACK_MESSAGES: Record<string, string | undefined> = {
  planting_ended: 'Pohon ditandai sudah tidak ada',
  // Dititipkan layar detail catatan, yang menghapus lalu langsung pergi ke sini
  // — layar itu sudah tidak ada saat pesannya jatuh tempo.
  record_deleted: 'Catatan dihapus',
};

export function TreeDetailScreen({
  mode,
  treeId,
}: {
  mode: TreeDetailMode;
  treeId?: string;
}) {
  const { profile } = useAuth();
  const showSnackbar = useSnackbar();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [recordSheetOpen, setRecordSheetOpen] = React.useState(false);
  const [history, setHistory] = React.useState<TreeHistoryItem[]>([]);
  const [plantings, setPlantings] = React.useState<TreePlanting[]>([]);
  // Galat siklus tanam dipisahkan dari `error` layar supaya ia tampil DI DALAM
  // sheet yang gagal, tepat di atas tombolnya — bukan di balik sheet, di tempat
  // yang tidak terlihat selama sheet-nya masih terbuka.
  //
  // TETAP DI SINI walau EndTreePlantingSheet sudah pindah ke layar Ubah:
  // StartTreePlantingSheet ("Tanam") masih tinggal di layar ini dan memakai
  // kedua state ini. Yang ikut pergi bersama sheet-nya hanya endSheetOpen.
  const [cycleError, setCycleError] = React.useState<string | null>(null);
  const [cycleLoading, setCycleLoading] = React.useState(false);
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

    // Siklus aktif dibaca dari getTreeDetail, yang sudah membawanya sebagai
    // embedded resource — tidak perlu query tambahan, dan nilainya sudah ada
    // sebelum kedua pengambilan foto di bawah berjalan. null = posisi kosong.
    const activePlantingId = treeResult.data.activePlanting?.id ?? null;

    const [reportsResult, historyResult, photoResult, plantingsResult] = await Promise.all([
      getTreeConditionReports({ treeId }),
      getTreeHistory({ treeId }),
      getTreeMainPhoto(treeResult.data.farmId, treeResult.data.id, activePlantingId),
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
        activePlantingId,
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
      // Konfirmasi dari layar Ubah, dibaca-sekaligus-dihapus. Layar itu menutup
      // siklus tanam lalu LANGSUNG pergi ke sini — snackbar-nya tidak bisa
      // ditampilkan di layar asalnya karena layar itu sudah tidak ada lagi saat
      // pesannya jatuh tempo. Polanya sama dengan profile-screen.tsx:35.
      const message = PENDING_FEEDBACK_MESSAGES[consumePendingFeedback() ?? ''];

      if (message) {
        showSnackbar(message);
      }

      setLoading(true);
      loadDetail().finally(() => setLoading(false));
    }, [loadDetail, showSnackbar])
  );

  // Menutup sheet-nya DULU, baru memuat ulang.
  //
  // Bukan urutan bebas: sheet adalah konfirmasinya, jadi pemuatan ulang hanya
  // boleh berjalan setelah pemilik menekan tombolnya, dan tidak boleh berjalan
  // di belakang sheet yang masih terbuka. Sheet yang GAGAL sengaja tetap
  // terbuka — galatnya tampil di dalamnya dan isian pemilik tidak hilang.
  //
  // runEndPlanting yang dulu berpasangan dengan fungsi ini sudah pindah ke layar
  // Ubah, dan di sana bentuknya BERBEDA: ia tidak memuat ulang layarnya sendiri
  // melainkan langsung pergi ke layar ini. Alasannya ada di layar itu.
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
    // Tanpa judul, sama dengan layar yang sudah selesai memuat. Dulu judulnya
    // statis "Detail Pohon" justru untuk menghindari kedipan: judul sebenarnya
    // ("Detail Pohon" lawan "Detail Posisi") baru bisa ditentukan setelah
    // siklus tanamnya terbaca. Persoalan itu hilang bersama judulnya — kode
    // pohon di badan layar yang sekarang menjadi judulnya, dan ia memang baru
    // muncul setelah datanya datang.
    return (
      <LoadingState
        header={<TopAppBar onBack={() => router.back()} />}
        message="Memuat detail pohon..."
      />
    );
  }

  const basePath = mode === 'owner' ? '/owner/trees' : '/worker/trees';

  if (!tree) {
    return (
      <Screen header={<TopAppBar onBack={() => router.back()} />}>
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

  const displayCode = formatTreeDisplayCode(tree);

  // SATU-SATUNYA pembeda dua keadaan layar ini.
  //
  // activePlanting null berarti siklus terakhir posisi ini sudah ditutup: tidak
  // ada varietas, tidak ada tanggal tanam, dan layar edit akan ditolak RPC.
  // Bukan is_archived — arsip menyembunyikan posisinya dari daftar, sedangkan
  // ini soal ada atau tidaknya pohon di posisi yang tetap ditampilkan.
  const activePlanting = tree.activePlanting;
  const lastEndedPlanting = findLastEndedPlanting(plantings);

  // Umur fase yang sedang berjalan, dalam hari — angka pada chip 'Berbunga · 96 hari'.
  //
  // SATU PENGURANGAN, TITIK. Tanggalnya datang jadi dari database
  // (trees.current_growth_phase_since, migrasi 066), bukan dicari sendiri di
  // daftar riwayat.
  //
  // Versi sebelumnya menyapu `history` untuk menemukan catatan fase yang
  // menetapkan fase sekarang, dan karena itu harus MENGULANG penyaringan siklus
  // yang sudah ada di database — awal siklus, arah cast WIB, perbandingan
  // tanggal. Dua tempat yang harus sepakat selamanya, dan yang di klien memang
  // sempat tidak: ia pernah menghitung dari catatan pohon siklus SEBELUMNYA
  // sementara database sudah menyaringnya dengan benar.
  //
  // Kolom baru itu ditulis recalculate_tree_current_growth_phase dari BARIS
  // catatan yang sama yang menetapkan currentGrowthPhase, dalam SELECT yang
  // sama. Keduanya karena itu tidak bisa bercerita berbeda, dan tidak ada lagi
  // aturan siklus yang hidup di sisi klien.
  //
  // null berarti tanggalnya tidak diketahui — chip menampilkan nama fase saja,
  // BUKAN '0 hari'. Nol adalah angka yang benar hanya untuk fase yang dicatat
  // HARI INI, dan daysSinceLocal memang mengembalikan 0 untuk itu.
  //
  // NON-PREDIKTIF: angka ini menyatakan sudah berapa lama fasenya berjalan, dan
  // tidak pernah kapan buahnya siap dipetik (keputusan desain v4).
  const currentPhaseAgeDays = tree.currentGrowthPhaseSince
    ? daysSinceLocal(tree.currentGrowthPhaseSince)
    : null;

  return (
    <Screen header={<TreeDetailTopBar />}>
      <ErrorBanner message={error} />

      {/* Foto disembunyikan saat posisinya kosong: foto itu milik pohon yang
          sudah tidak ada, dan menampilkannya di atas tulisan "Belum ditanami"
          membuat layar membantah dirinya sendiri. Berkasnya tidak dihapus. */}
      {activePlanting ? (
        <TreeDetailHero
          displayCode={displayCode}
          mode={mode}
          onPhotoPress={handleOpenPhotoSource}
          phaseAgeDays={currentPhaseAgeDays}
          photoLoading={photoActionLoading}
          photoLoadingLabel={photoActionLabel}
          photoUrl={treeMainPhoto?.signedUrl}
          planting={activePlanting}
          tree={tree}
        />
      ) : (
        <EmptyPositionHeader displayCode={displayCode} tree={tree} />
      )}
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
        /* DUA tombol, bukan tiga.
           "Tandai pohon sudah tidak ada" pindah ke layar Ubah, dan pemindahannya
           bukan sekadar perapian: aksi itu MEMBATALKAN kemampuan layar Ubah
           menyimpan apa pun (update_tree_with_planting menolak posisi tanpa
           siklus aktif), jadi tempatnya memang di layar yang ia matikan, bukan
           di layar yang cuma menampilkan.
           Labelnya juga dipendekkan jadi satu kata. Keduanya berdiri
           berdampingan tanpa kata lain di sekitarnya, dan "Catat aktivitas"
           lawan "Ubah data pohon" mengulang kata yang sudah jelas dari
           layarnya. */
        <View style={{ gap: spacing.md }}>
          <Button title="Catat" onPress={() => setRecordSheetOpen(true)} />
          {mode === 'owner' ? (
            <Button
              title="Ubah"
              variant="secondary"
              onPress={() => router.push(`${basePath}/${tree.id}/edit`)}
            />
          ) : null}
        </View>
      ) : (
        <>
          <EmptyPositionNotice planting={lastEndedPlanting} />

          {mode === 'owner' ? (
            <Button
              title="Tanam"
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
      {/* EndTreePlantingSheet TIDAK LAGI DI SINI — ia pindah ke layar Ubah
          bersama tombolnya. cycleError dan cycleLoading TETAP TINGGAL: keduanya
          juga melayani StartTreePlantingSheet di bawah, yang tidak ikut pindah. */}
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

// Bar ini kini HANYA tombol back — tanpa judul, tanpa slot kanan.
//
// Slot kanan dulu berisi tombol titik-tiga milik pemilik, dan menu di baliknya
// cuma punya satu baris: arsip. Begitu arsip dicabut, menunya tidak punya isi,
// jadi tombolnya ikut pergi. Prop `mode` hilang bersamanya.
//
// Judulnya menyusul pergi karena kode pohon berukuran 32pt di badan layar sudah
// menjadi judul yang sesungguhnya, dan mengulanginya sebagai "Detail Pohon" di
// bar hanya menambah baris yang tidak memberi tahu pembacanya hal baru.
// TopAppBar menerima `title` sebagai opsional dan tingginya tidak bergantung
// padanya (minHeight 56 eksplisit), jadi bar tidak menyusut tanpa judul.
function TreeDetailTopBar() {
  return <TopAppBar onBack={() => router.back()} />;
}

function TreeDetailHero({
  displayCode,
  mode,
  onPhotoPress,
  phaseAgeDays,
  photoLoading,
  photoLoadingLabel,
  photoUrl,
  planting,
  tree,
}: {
  displayCode: string;
  mode: TreeDetailMode;
  onPhotoPress: () => void;
  phaseAgeDays: number | null;
  photoLoading?: boolean;
  photoLoadingLabel?: string | null;
  photoUrl?: string | null;
  // Siklus AKTIF, dioper terpisah walau ada di dalam `tree`. Pemanggil hanya
  // merender komponen ini ketika siklusnya ada, dan prop tersendiri membuat
  // jaminan itu terbaca compiler alih-alih hanya diketahui pemanggilnya.
  planting: TreePlanting;
  tree: Tree;
}) {
  // Pembungkus foto TIDAK dirender sama sekali kalau tidak ada yang bisa
  // ditaruh di dalamnya. Ia menetapkan minHeight 220, jadi membiarkannya berdiri
  // dengan TreePhotoArea yang mengembalikan null akan menyisakan kotak kosong
  // setinggi 220 — persis ruang menganggur yang seharusnya hilang.
  //
  // Pemilik selalu punya isi: fotonya, atau pemicu "Tambah foto". Pekerja hanya
  // punya isi kalau fotonya memang ada.
  const showPhotoArea = Boolean(photoUrl) || mode === 'owner';

  return (
    <View style={{ gap: spacing.md }}>
      {showPhotoArea ? (
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
      ) : null}
      <View style={{ gap: spacing.md }}>
        <View style={{ gap: spacing.xs }}>
          <Text selectable style={{ color: colors.primary, fontSize: 32, fontWeight: '700', lineHeight: 38 }}>
            {displayCode}
          </Text>
          <Text selectable style={{ color: colors.textMuted, fontSize: 15, lineHeight: 21 }}>
            {formatTreeLocation(tree)}
          </Text>
        </View>
        {/* Chip berdampingan di BAWAH kode, bukan di sebelahnya. Berdampingan
            dengan kode, semuanya harus berbagi lebar dengan teks 32pt dan salah
            satunya pasti terpotong; sebaris sendiri, semuanya muat utuh.
            flexWrap membiarkan chip ketiga turun sendiri saat tidak muat. */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <ConditionStatusBadge status={tree.currentCondition} />
          {tree.currentGrowthPhase ? (
            <GrowthPhaseBadge ageDays={phaseAgeDays} phase={tree.currentGrowthPhase} />
          ) : (
            /* Fase belum pernah dicatat. Chip netral, BUKAN chip yang hilang:
               ketiadaan fase adalah keadaan yang perlu diketahui pemilik — ia
               yang memberi tahu bahwa pohon ini belum pernah dicatat sama
               sekali — dan chip yang absen tidak memberi tahu apa pun. */
            <Badge label="Belum ada fase" maxWidth={220} tone="muted" />
          )}
          {/* Penanaman ke berapa. HANYA kalau lebih dari satu, dan itu justru
              alasan chip ini ada: pada posisi yang baru sekali ditanami — hampir
              semua pohon — angkanya selalu 1 dan tidak memberi tahu apa pun.
              Pada posisi yang pernah ditanami ulang, ia satu-satunya isyarat di
              bagian atas layar bahwa pohon SEBELUMNYA pernah ada di sini.
              Pembatas siklus di riwayat membawa kabar yang sama, tapi ia jauh
              di bawah lipatan. */}
          {planting.cycleNo > 1 ? (
            <Badge label={`Tanam ke-${planting.cycleNo}`} maxWidth={140} tone="neutral" />
          ) : null}
        </View>
        {/* Pengganti kartu "Pohon yang ditanam sekarang".
            Kartu itu memberi judul, bingkai, dan empat sel InfoGrid kepada empat
            fakta yang masing-masing cuma beberapa kata — hampir sepertiga layar
            pertama untuk keterangan yang jarang jadi alasan seseorang membuka
            detail pohon. Sebagai satu baris di bawah chip, keempatnya tetap ada
            (penanaman ke-berapa naik jadi chip di atas) dan ruangnya kembali ke
            foto, chip, dan riwayat. */}
        <Text selectable style={{ color: colors.textMuted, fontSize: 14, lineHeight: 20 }}>
          {formatPlantingMetaLine(planting)}
        </Text>
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
  const [previewOpen, setPreviewOpen] = React.useState(false);

  // Foto utama bisa diganti atau dihapus tanpa meninggalkan layar ini. Kalau
  // fotonya berganti selagi viewer terbuka, viewer harus ikut tutup -- bukan
  // diam-diam memperlihatkan foto yang sudah tidak ada lagi.
  React.useEffect(() => {
    setPreviewOpen(false);
  }, [photoUrl]);

  if (photoUrl) {
    return (
      <>
        {/*
          Foto utama pohon kini dibuka lewat viewer bersama yang sama dengan
          foto catatan, foto bukti kerja, dan foto kondisi. Sebelumnya ia
          satu-satunya foto di aplikasi yang tidak bisa dicubit sama sekali,
          padahal justru foto ini yang paling sering dibuka pemilik.

          Tombol kamera di bawah SENGAJA dibiarkan utuh sebagai kontrol
          terpisah: mengetuk fotonya berarti "lihat lebih besar", mengetuk
          tombol kamera berarti "ganti atau hapus". Keduanya tidak pernah
          bertukar arti, dan tombol kamera dirender setelah Pressable ini
          sehingga tetap berada di atas dan tetap menerima tekanannya sendiri.
        */}
        <Pressable
          accessibilityLabel="Lihat foto pohon ukuran penuh"
          accessibilityRole="imagebutton"
          onPress={() => setPreviewOpen(true)}
          style={{ bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 }}
        >
          <Image
            resizeMode="cover"
            source={{ uri: photoUrl }}
            style={{ height: '100%', width: '100%' }}
          />
        </Pressable>
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
        <PhotoViewerModal
          onClose={() => setPreviewOpen(false)}
          photoUrl={photoUrl}
          visible={previewOpen}
        />
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

  // Pekerja tanpa foto: TIDAK ADA APA-APA.
  //
  // Di sini dulu berdiri kotak setinggi 220 bertuliskan "Belum ada foto". Kotak
  // itu memberi tahu pekerja sesuatu yang tidak bisa ia tindak lanjuti — hanya
  // pemilik yang boleh mengunggah foto pohon — sambil mendorong seluruh isi
  // layar yang berguna turun satu layar penuh. Pemberitahuan tanpa jalan keluar
  // yang menghabiskan ruang paling mahal di layar adalah pertukaran yang buruk.
  //
  // Pemanggilnya (TreeDetailHero) tidak boleh sekadar mengandalkan null di sini:
  // pembungkusnya sendiri menetapkan minHeight 220, jadi ia ikut memeriksa
  // kondisi yang sama dan tidak merender pembungkusnya sama sekali.
  return null;
}

// Baris meta siklus tanam: 'Miki · ditanam 25 Agu 2026 · 6 hari'.
//
// Pengganti kartu "Pohon yang ditanam sekarang" beserta keempat InfoCell-nya.
// Isinya milik SIKLUS TANAM yang sedang berjalan (migrasi 055), bukan milik
// posisinya — sebuah posisi bisa ditanami berkali-kali. Judul kartu yang dulu
// menjelaskan itu ikut hilang; yang menggantikannya adalah chip 'Tanam ke-N'
// di atas baris ini, yang mengatakan hal yang sama dengan satu kata lebih
// sedikit dan hanya muncul saat memang ada yang perlu dikatakan.
//
// Kata 'ditanam' dipertahankan di depan tanggalnya. Tanpa label apa pun, tiga
// ruas berturut-turut — varietas, sebuah tanggal, sebuah durasi — membuat
// tanggal dan durasi mudah tertukar artinya. Umurnya sendiri tidak perlu label:
// formatTreeAge sudah menghasilkan bentuk yang tidak mungkin salah baca
// ('6 hari', '3 th 2 bln').
//
// Ruas yang kosong DILEWATI, bukan diisi 'Belum diisi'. Varietas boleh NULL
// (start_tree_planting menerimanya, 055:357) dan begitu pula tanggal tanam;
// mencetak 'Belum diisi' di tengah baris bertitik membuatnya terbaca seolah
// sebuah nilai.
function formatPlantingMetaLine(planting: TreePlanting): string {
  const parts: string[] = [];
  const variety = planting.variety?.trim();

  if (variety) {
    parts.push(variety);
  }

  if (planting.plantedAt) {
    parts.push(`ditanam ${formatFriendlyDate(planting.plantedAt)}`);
    parts.push(formatTreeAge(planting.plantedAt));
  }

  // Siklus tanpa varietas MAUPUN tanggal tanam benar-benar bisa ada. Barisnya
  // tidak boleh jadi string kosong yang menyisakan ruang menganggur di bawah
  // chip, jadi ia mengatakan apa adanya.
  return parts.length > 0 ? parts.join(' · ') : 'Data penanaman belum dilengkapi';
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

// OwnerTreeMenu ("Kelola data pohon") DICABUT bersama fitur arsip.
//
// Ia sempat berisi dua baris; "Edit Pohon" lebih dulu pindah keluar menjadi
// tombol lebar "Ubah data pohon" di badan layar, menyisakan arsip sendirian.
// Begitu arsip pergi, menunya kosong — jadi menu, tombol titik-tiga yang
// membukanya, dan state menuOpen ikut dicabut sekaligus. Semua aksi yang
// tersisa di layar ini sudah punya tempatnya sendiri di badan layar.

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
