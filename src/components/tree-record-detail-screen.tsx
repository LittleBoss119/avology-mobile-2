import { router } from 'expo-router';
import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { GRADE_PANEN_LABELS } from '../constants/gradePanen';
import { colors, radius, spacing, typography } from '../constants/theme';
import {
  getCareActivityDetail,
  softDeleteCareActivity,
} from '../services/careActivityService';
import {
  getConditionReportDetail,
  softDeleteConditionReport,
} from '../services/conditionReportService';
import {
  getGrowthPhaseRecordDetail,
  softDeleteGrowthPhaseRecord,
} from '../services/growthPhaseService';
import {
  getHarvestRecordDetail,
  softDeleteHarvestRecord,
} from '../services/harvestService';
import { getFarmActorDisplayProfiles } from '../services/memberService';
import {
  getConditionRecordPhotos,
  getGrowthPhaseRecordPhotos,
  getHarvestRecordPhotos,
  getInitiativeCareProofPhotos,
} from '../services/photoAttachmentService';
import { getTreeDetail } from '../services/treeService';
import { useAuth } from '../context/auth-context';
import type {
  HarvestRecord,
  MemberRole,
  ServiceResult,
  SuccessData,
  Tree,
  UUID,
} from '../types/domain';
import type { PhotoAttachmentEntityType, PhotoAttachmentPreviewItem } from '../types/media';
import {
  formatCareCategory,
  formatPersonDisplayName,
  formatProdukDenganTakaran,
  sanitizeDisplayValue,
} from '../utils/displayFormat';
import { formatGrowthPhase, formatTreeConditionStatus, formatTreeContextLine } from '../utils/treeFormat';
import { setPendingFeedback } from '../lib/pendingFeedback';
import { ConfirmDialog } from './bottom-sheet';
import { PhotoAttachmentPreviewList, PhotoViewerModal } from './media';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  MetaRow,
  Screen,
  TopAppBar,
} from './ui';

// Catatan perawatan (care) TIDAK BISA DIEDIT siapa pun — care_activities
// append-only, tidak ada RPC update untuknya (migrasi 027). Sejak migrasi 067
// ia BISA DIHAPUS, tapi hanya yang berasal dari pencatatan INISIATIF; yang
// terjadwal dibatalkan lewat layar tugas, bukan dari sini.
export type TreeRecordRouteType = 'condition' | 'phase' | 'harvest' | 'care';

type TreeRecordDetailScreenProps = {
  basePath: '/owner/trees' | '/worker/trees';
  recordId?: string;
  recordType?: string;
  treeId?: string;
};

type DetailState = {
  authorId: UUID;
  authorName?: string | null;
  authorRole?: MemberRole | null;
  authorVerb: 'harvested' | 'recorded';
  canEdit: boolean;
  // SENGAJA TERPISAH dari canEdit, dan seringkali berbeda darinya: pemilik kebun
  // boleh menghapus catatan pekerjanya tapi tidak boleh mengubahnya. Keduanya
  // dihitung di service, bukan di sini — layar ini tidak tahu siapa pemilik
  // kebun dan tidak boleh menebaknya.
  canDelete: boolean;
  createdAt?: string | null;
  eventAt: string;
  eventLabel: string;
  farmId: UUID;
  note: string | null;
  recordLabel: string;
  // Badge sekunder (mis. asal perawatan Terjadwal/Inisiatif), tone muted. Opsional.
  originLabel?: string | null;
  // Jenis foto yang dimiliki catatan INI, bukan jenis catatannya.
  //
  // Perbedaannya nyata sejak migrasi 060: recordType 'care' menampung DUA jenis
  // baris, dan hanya yang inisiatif punya foto di layar ini. Yang terjadwal
  // fotonya 'task_proof' dan ditampilkan di layar tugas, bukan di sini -- kalau
  // ia ikut dinilai dari recordType saja, layar detail perawatan terjadwal akan
  // memunculkan kotak "Foto catatan" yang selamanya kosong.
  //
  // Fase & panen dulu punya masalah yang sama dan itulah yang B3d hapus: kotak
  // foto tanpa jalur unggah di baliknya. Sejak migrasi 061 keduanya PUNYA
  // jalur itu -- entity_type sendiri, policy sendiri, pemilih foto di layar
  // pencatatannya -- jadi keduanya diisi di sini dengan alasan yang membuat
  // B3d tidak berlaku lagi untuk mereka. Yang masih berlaku: JANGAN mengisi
  // medan ini untuk perawatan terjadwal.
  //
  // null/undefined = catatan ini tidak punya kotak foto sama sekali.
  photoEntityType?: PhotoAttachmentEntityType | null;
  rows: Array<{ label: string; value: string | null }>;
  // false untuk record read-only-by-design (perawatan): sembunyikan hint
  // "hanya bisa diubah oleh pelapor" yang tidak relevan. Default (undefined) = tampil.
  supportsEdit?: boolean;
  title: string;
  updatedAt?: string | null;
};

export function TreeRecordDetailScreen({
  basePath,
  recordId,
  recordType,
  treeId,
}: TreeRecordDetailScreenProps) {
  const { profile } = useAuth();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [detail, setDetail] = React.useState<DetailState | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [photos, setPhotos] = React.useState<PhotoAttachmentPreviewItem[]>([]);
  const [tree, setTree] = React.useState<Tree | null>(null);
  const normalizedType = normalizeRecordType(recordType);

  const loadDetail = React.useCallback(async () => {
    if (!treeId || !recordId || !normalizedType) {
      setError('Catatan tidak ditemukan.');
      setDetail(null);
      setTree(null);
      setPhotos([]);
      return;
    }

    setError(null);

    const [treeResult, detailResult] = await Promise.all([
      getTreeDetail({ treeId }),
      loadRecordDetail(normalizedType, recordId),
    ]);

    if (treeResult.error) {
      setError(treeResult.error.message);
      setTree(null);
    } else {
      setTree(treeResult.data);
    }

    if (detailResult.error) {
      setError(detailResult.error.message);
      setDetail(null);
      setPhotos([]);
      return;
    }

    setDetail(detailResult.data);
    const photoResult = await loadRecordPhotos(detailResult.data, recordId);
    setPhotos(photoResult.data ?? []);
  }, [normalizedType, recordId, treeId]);

  React.useEffect(() => {
    setLoading(true);
    loadDetail().finally(() => setLoading(false));
  }, [loadDetail]);

  // Menghapus catatan. Bentuknya sepadan dengan runEndPlanting di layar edit
  // pohon, dan karena alasan yang sama: SUKSES TIDAK MEMUAT ULANG LAYAR INI.
  //
  // Layar ini menampilkan catatan yang barusan dihapus. Memuatnya ulang berarti
  // memanggil kembali getConditionReportDetail dan kerabatnya — yang sejak
  // bagian B menyaring is_deleted, jadi jawabannya "tidak ditemukan". Pemakainya
  // akan melihat galat sebagai hasil dari tindakan yang BERHASIL. router.replace
  // membawanya ke detail pohon, tempat riwayatnya sudah tanpa catatan itu.
  //
  // replace, bukan push: layar ini sudah tidak sah dikunjungi lagi, jadi ia
  // tidak boleh tertinggal di back-stack menunggu ditekan kembali.
  //
  // Snackbar dititipkan lewat pendingFeedback karena layar yang seharusnya
  // menampilkannya sudah tidak ada saat pesannya jatuh tempo — layar detail
  // pohon membacanya di useFocusEffect miliknya.
  //
  // Dialog ditutup LEBIH DULU, sebelum RPC berjalan. Keadaan "sedang menghapus"
  // ditunjukkan tombol Hapus di footer (label berganti, terkunci), bukan
  // pemintal di dalam dialog — jadi kalau gagal, galatnya mendarat di layar yang
  // sudah terlihat, bukan di balik dialog yang menutupinya.
  async function runDelete() {
    if (!detail || !normalizedType || !recordId) {
      return;
    }

    setConfirmDeleteOpen(false);
    setDeleting(true);
    setError(null);

    const result = await softDeleteRecord(normalizedType, recordId);

    if (result.error) {
      setError(result.error.message);
      setDeleting(false);
      return;
    }

    setDeleting(false);
    setPendingFeedback('record_deleted');
    router.replace(`${basePath}/${treeId}`);
  }

  if (loading) {
    // Bar tanpa judul, sama dengan layar yang sudah selesai memuat. Dulu judul
    // di sini terpaksa statis "Detail catatan" karena detail.title baru ada
    // SETELAH catatannya terbaca. Persoalan itu hilang bersama judul barnya:
    // judul catatan kini berdiri di badan layar, tempat ia memang boleh muncul
    // belakangan. Idiomnya sama dengan tree-detail-screen.tsx.
    return (
      <LoadingState
        header={<TopAppBar onBack={() => router.back()} />}
        message="Memuat detail catatan..."
      />
    );
  }

  if (!detail || !normalizedType) {
    return (
      <Screen>
        <TopAppBar onBack={() => router.back()} />
        <ErrorBanner message={error} />
        <EmptyState title="Catatan tidak ditemukan" subtitle="Catatan mungkin sudah dihapus atau akses tidak aktif." />
      </Screen>
    );
  }

  // Lewat sanitizeDisplayValue, bukan sekadar trim(). Itu penapis yang sama yang
  // dipakai MetaRow sebelum perubahan ini, jadi catatan yang isinya UUID atau
  // pesan teknis tetap disembunyikan seperti dulu — yang berubah cuma bahwa
  // hasil kosongnya sekarang berarti "jangan render", bukan "cetak tanda hubung".
  const noteText = sanitizeDisplayValue(detail.note);

  return (
    <Screen
      // Footer muncul kalau ADA SALAH SATU aksi, bukan hanya saat bisa diubah.
      // Kombinasi "tidak bisa ubah, bisa hapus" bukan kasus tepi — itu keadaan
      // pemilik kebun yang membuka catatan pekerjanya, dan di sana tombol Hapus
      // berdiri sendirian.
      footer={
        detail.canEdit || detail.canDelete ? (
          <>
            {detail.canEdit ? (
              <Button
                title="Edit catatan"
                onPress={() => router.push(`${basePath}/${treeId}/records/${normalizedType}/${recordId}/edit`)}
              />
            ) : null}
            {detail.canDelete ? (
              /* loadingTitle, BUKAN pemintal: label berganti jadi teks biasa
                 sehingga lebar tombolnya tidak berubah saat diproses. Itu satu-
                 satunya jalur Button yang tidak memasang ActivityIndicator. */
              <Button
                title="Hapus"
                loading={deleting}
                loadingTitle="Menghapus…"
                variant="danger"
                onPress={() => setConfirmDeleteOpen(true)}
              />
            ) : null}
          </>
        ) : undefined
      }
    >
      <TopAppBar onBack={() => router.back()} />
      <ErrorBanner message={error} />

      {/* ConfirmDialog, BUKAN Alert.alert. Alert bawaan platform tidak bisa
          diberi gaya, judulnya tampil berbeda di Android dan iOS, dan seluruh
          konfirmasi merusak lain di app ini sudah memakai dialog yang sama. */}
      <ConfirmDialog
        confirmLabel="Hapus"
        cancelLabel="Batal"
        message="Catatan ini akan dihapus dan tidak muncul lagi di riwayat pohon."
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={runDelete}
        title="Hapus catatan?"
        tone="danger"
        visible={confirmDeleteOpen}
      />

      {/* HERO. Foto naik ke puncak layar, mendahului judul catatan.
          Syaratnya tetap detail.photoEntityType — jenis foto yang dimiliki
          catatan INI, bukan jenis catatannya (lihat catatan pada DetailState) —
          dan kini ditambah "memang ada fotonya". Tanpa foto, di posisi ini
          tidak dirender apa pun: kartu berjudul "Foto catatan" yang dulu berdiri
          di dasar layar dengan tulisan "Tidak ada foto pada catatan ini" sudah
          dicabut. Kalimat itu memberi tahu pembacanya ketiadaan, yang sudah
          terlihat dari tidak adanya foto. */}
      {detail.photoEntityType && photos.length > 0 ? <RecordPhotoHero photos={photos} /> : null}

      {/* Kepala: judul catatan, lalu tag, lalu dua baris keterangan.
          Satu blok ber-gap rapat, bukan kartu — seluruh layar ini kini satu
          aliran menurun dan tidak ada lagi kartu bertumpuk di dalamnya. */}
      <View style={{ gap: spacing.sm }}>
        <Text
          selectable
          style={{
            color: colors.text,
            fontSize: typography.h2.fontSize,
            fontWeight: '700',
            lineHeight: typography.h2.lineHeight,
          }}
        >
          {detail.title}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Badge label={detail.recordLabel} tone="info" />
          {detail.originLabel ? <Badge label={detail.originLabel} tone="muted" /> : null}
        </View>
        {/* Waktu dan pencatat jadi SATU baris. Sebagai dua MetaRow berlabel
            ("Tanggal catatan", "Dicatat oleh") keduanya memakan empat baris
            untuk dua fakta pendek yang selalu dibaca bersamaan. Label tanggalnya
            ikut hilang karena judul di atas sudah menyatakan ini catatan apa. */}
        <Text selectable style={secondaryLineStyle}>
          {`${formatEventDate(detail.eventAt)} · ${
            detail.authorVerb === 'harvested' ? 'Dipanen oleh' : 'Dicatat oleh'
          } ${formatActorDisplayName({
            actorId: detail.authorId,
            actorName: detail.authorName,
            actorRole: detail.authorRole,
            currentUserId: profile?.id,
          })}`}
        </Text>
        {/* Pengganti kartu "Konteks Pohon". Tiga fakta yang sama, satu baris. */}
        {tree ? (
          <Text selectable style={secondaryLineStyle}>
            {formatTreeContextLine(tree)}
          </Text>
        ) : null}
      </View>

      {detail.rows.length > 0 ? (
        <View style={{ gap: spacing.md }}>
          {detail.rows.map((row) => (
            <MetaRow key={row.label} label={row.label} value={row.value} />
          ))}
        </View>
      ) : null}

      {/* Catatan sebagai PARAGRAF, dan hanya kalau ada isinya. Dulu ia MetaRow
          yang mencetak tanda hubung saat kosong — sebuah baris yang hadir hanya
          untuk mengumumkan bahwa tidak ada yang perlu dibaca. */}
      {noteText ? (
        <View style={{ gap: spacing.xs }}>
          {/* colors.textMuted, BUKAN colors.muted: alias `muted` hanya hidup di
              peta warna lokal ui.tsx, bukan di token bersama. Nilainya sama. */}
          <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
            Catatan
          </Text>
          <Text selectable style={{ color: colors.text, fontSize: 16, lineHeight: 24 }}>
            {noteText}
          </Text>
        </View>
      ) : null}

      {/* Jejak audit dan keterangan izin duduk paling bawah: keduanya tentang
          catatannya, bukan isinya. */}
      {detail.createdAt || shouldShowUpdatedAt(detail.createdAt, detail.updatedAt) ? (
        <View style={{ gap: spacing.md }}>
          {detail.createdAt ? <MetaRow label="Dibuat pada" value={formatDateTime(detail.createdAt)} /> : null}
          {shouldShowUpdatedAt(detail.createdAt, detail.updatedAt) ? (
            <MetaRow label="Terakhir diubah" value={formatDateTime(detail.updatedAt as string)} />
          ) : null}
        </View>
      ) : null}

      {!detail.canEdit && detail.supportsEdit !== false ? (
        <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
          Catatan ini hanya bisa diubah oleh pelapor.
        </Text>
      ) : null}
    </Screen>
  );
}

// Gaya baris keterangan sekunder di kepala layar. Dipakai dua kali — baris
// waktu/pencatat dan baris konteks pohon — dan sengaja SATU nilai supaya
// keduanya tidak bisa menyimpang satu sama lain.
const secondaryLineStyle = {
  color: colors.textMuted,
  fontSize: typography.small.fontSize,
  lineHeight: typography.small.lineHeight,
} as const;

// Foto catatan sebagai HERO: gambar besar di puncak layar, sebelum judulnya.
//
// Bentuknya sepadan dengan foto pohon di layar detail pohon — tinggi 220, sudut
// kartu, dan ketukan membuka PhotoViewerModal yang sama. Dua layar yang
// bersebelahan dalam satu alur tidak boleh memperlakukan foto dengan dua cara.
//
// SENGAJA BUKAN PhotoAttachmentPreviewList. Komponen itu adalah DAFTAR yang bisa
// disunting: tiap foto duduk di dalam kotak berbingkai berpadding dengan tombol
// hapus opsional, gambarnya setinggi 156. Itu bentuk yang benar untuk layar yang
// MENGELOLA foto, dan bentuk yang salah untuk satu gambar yang seharusnya jadi
// hal pertama yang dilihat pembaca.
//
// Kegagalan muat ditangani per foto, sama seperti di PhotoAttachmentPreviewList
// dan dengan alasan yang sama: signed URL foto hanya berumur 10 menit, jadi
// layar yang dibiarkan terbuka akan menemui gambar yang sudah kedaluwarsa.
function RecordPhotoHero({ photos }: { photos: PhotoAttachmentPreviewItem[] }) {
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [failedUrls, setFailedUrls] = React.useState<string[]>([]);

  React.useEffect(() => {
    setFailedUrls([]);
  }, [photos]);

  function markFailed(url: string) {
    setFailedUrls((current) => (current.includes(url) ? current : [...current, url]));
  }

  return (
    <View style={{ gap: spacing.md }}>
      {photos.map((photo, index) => (
        <View key={photo.id ?? `${photo.url}-${index}`} style={{ gap: spacing.sm }}>
          {failedUrls.includes(photo.url) ? (
            <View
              style={{
                alignItems: 'center',
                backgroundColor: colors.photoPlaceholder,
                borderColor: colors.border,
                borderCurve: 'continuous',
                borderRadius: radius.imageCard,
                borderWidth: 1,
                height: 220,
                justifyContent: 'center',
                padding: spacing.lg,
              }}
            >
              <Text
                selectable
                style={{ color: colors.textMuted, lineHeight: typography.small.lineHeight, textAlign: 'center' }}
              >
                Foto belum dapat dimuat.
              </Text>
            </View>
          ) : (
            <Pressable
              accessibilityLabel="Lihat foto catatan ukuran penuh"
              accessibilityRole="imagebutton"
              onPress={() => setPreviewUrl(photo.url)}
            >
              <Image
                resizeMode="cover"
                source={{ uri: photo.url }}
                onError={() => markFailed(photo.url)}
                style={{ borderRadius: radius.imageCard, height: 220, width: '100%' }}
              />
            </Pressable>
          )}
          {photo.caption ? (
            <Text selectable style={secondaryLineStyle}>
              {photo.caption}
            </Text>
          ) : null}
        </View>
      ))}
      <PhotoViewerModal
        onClose={() => setPreviewUrl(null)}
        photoUrl={previewUrl}
        visible={Boolean(previewUrl)}
      />
    </View>
  );
}

// Pemetaan jenis catatan ke RPC hapusnya. Satu tempat, bukan empat cabang di
// dalam runDelete — bentuknya sepadan dengan loadRecordDetail di bawah.
//
// Penjaga eksahustifnya sama: kalau TreeRecordRouteType bertambah anggota tanpa
// fungsi ini ikut disesuaikan, compiler yang menemukannya, bukan pemakainya.
async function softDeleteRecord(
  recordType: TreeRecordRouteType,
  recordId: UUID
): Promise<ServiceResult<SuccessData>> {
  if (recordType === 'condition') {
    return softDeleteConditionReport({ recordId, reason: null });
  }

  if (recordType === 'phase') {
    return softDeleteGrowthPhaseRecord({ recordId, reason: null });
  }

  if (recordType === 'harvest') {
    return softDeleteHarvestRecord({ recordId, reason: null });
  }

  if (recordType === 'care') {
    return softDeleteCareActivity({ recordId, reason: null });
  }

  return unknownRecordType(recordType);
}

function normalizeRecordType(value?: string): TreeRecordRouteType | null {
  if (value === 'condition' || value === 'phase' || value === 'harvest' || value === 'care') {
    return value;
  }

  return null;
}

async function loadRecordDetail(
  recordType: TreeRecordRouteType,
  recordId: UUID
): Promise<ServiceResult<DetailState>> {
  if (recordType === 'condition') {
    const result = await getConditionReportDetail({ reportId: recordId });

    if (result.error) {
      return result;
    }

    const authorDisplay = await resolveRecordAuthor(result.data.farmId, result.data.reportedBy);

    return {
      data: {
        authorId: result.data.reportedBy,
        authorName: authorDisplay.fullName,
        authorRole: authorDisplay.role,
        authorVerb: 'recorded',
        canEdit: result.data.canEdit === true,
        canDelete: result.data.canDelete === true,
        createdAt: result.data.createdAt,
        eventAt: result.data.reportedAt,
        eventLabel: 'Tanggal catatan',
        farmId: result.data.farmId,
        note: result.data.note,
        photoEntityType: 'condition_record',
        recordLabel: 'Kondisi',
        rows: [{ label: 'Status kondisi', value: formatTreeConditionStatus(result.data.conditionStatus) }],
        title: 'Detail catatan kondisi',
        updatedAt: result.data.updatedAt,
      },
      error: null,
    };
  }

  if (recordType === 'phase') {
    const result = await getGrowthPhaseRecordDetail({ recordId });

    if (result.error) {
      return result;
    }

    const authorDisplay = await resolveRecordAuthor(result.data.farmId, result.data.recordedBy);

    return {
      data: {
        authorId: result.data.recordedBy,
        authorName: authorDisplay.fullName,
        authorRole: authorDisplay.role,
        authorVerb: 'recorded',
        canEdit: result.data.canEdit === true,
        canDelete: result.data.canDelete === true,
        createdAt: result.data.createdAt,
        eventAt: result.data.recordedAt,
        eventLabel: 'Tanggal catatan',
        farmId: result.data.farmId,
        note: result.data.note,
        photoEntityType: 'growth_phase_record',
        recordLabel: 'Fase',
        rows: [{ label: 'Fase pertumbuhan', value: formatGrowthPhase(result.data.phase) }],
        title: 'Detail catatan fase',
        updatedAt: result.data.updatedAt,
      },
      error: null,
    };
  }

  if (recordType === 'harvest') {
    const result = await getHarvestRecordDetail({ recordId });

    if (result.error) {
      return result;
    }

    const authorDisplay = await resolveRecordAuthor(result.data.farmId, result.data.harvestedBy);

    return {
      data: {
        authorId: result.data.harvestedBy,
        authorName: authorDisplay.fullName,
        authorRole: authorDisplay.role,
        authorVerb: 'harvested',
        canEdit: result.data.canEdit === true,
        canDelete: result.data.canDelete === true,
        createdAt: result.data.createdAt,
        eventAt: result.data.harvestedAt,
        eventLabel: 'Tanggal panen',
        farmId: result.data.farmId,
        note: result.data.note,
        photoEntityType: 'harvest_record',
        recordLabel: 'Panen',
        // Baris yang nilainya null TIDAK ditambahkan sama sekali, bukan
        // ditampilkan sebagai "-": sejak migrasi 045 panen boleh dicatat lewat
        // berat saja atau jumlah saja, dan baris kosong hanya jadi kebisingan.
        //
        // String(result.data.fruitCount) yang lama menghasilkan teks "null"
        // begitu kolomnya nullable — itu yang diperbaiki di sini.
        rows: buildHarvestRows(result.data),
        title: 'Detail catatan panen',
        updatedAt: result.data.updatedAt,
      },
      error: null,
    };
  }

  if (recordType === 'care') {
    const result = await getCareActivityDetail({ activityId: recordId });

    if (result.error) {
      return result;
    }

    const care = result.data;
    const authorDisplay = await resolveRecordAuthor(care.farmId, care.performedBy);

    const rows: Array<{ label: string; value: string | null }> = [];

    // Judul tugas induk hanya untuk terjadwal & bila keresolve (RLS worker bisa null).
    if (care.asal === 'terjadwal' && care.taskTitle) {
      rows.push({ label: 'Dari tugas', value: care.taskTitle });
    }

    if (care.category) {
      rows.push({ label: 'Kategori', value: formatCareCategory(care.category) });
    }

    // Utang dari Tahap D: baris ini dulu teks polos tanpa takaran, padahal tiga
    // layar hasil kerja lain sudah memakai formatter yang sama.
    const bahan = formatProdukDenganTakaran(care.produk, care.produkJumlah, care.produkSatuan);

    if (bahan) {
      rows.push({ label: 'Bahan', value: bahan });
    }

    // Status hanya informatif untuk terjadwal (inisiatif selalu completed).
    if (care.asal === 'terjadwal') {
      rows.push({ label: 'Status', value: care.status === 'completed' ? 'Selesai' : 'Ditunda' });
    }

    return {
      data: {
        authorId: care.performedBy,
        authorName: authorDisplay.fullName,
        authorRole: authorDisplay.role,
        authorVerb: 'recorded',
        canEdit: false,
        canDelete: care.canDelete === true,
        createdAt: null,
        eventAt: care.performedAt,
        eventLabel: 'Tanggal perawatan',
        farmId: care.farmId,
        note: care.note,
        originLabel: care.asal === 'terjadwal' ? 'Terjadwal' : 'Inisiatif',
        // Hanya yang inisiatif. Foto perawatan terjadwal adalah 'task_proof'
        // dan hidup di layar tugas; lihat catatan pada DetailState.
        photoEntityType: care.asal === 'inisiatif' ? 'initiative_care_proof' : null,
        recordLabel: 'Perawatan',
        rows,
        supportsEdit: false,
        title: 'Detail catatan perawatan',
        updatedAt: null,
      },
      error: null,
    };
  }

  return unknownRecordType(recordType);
}

async function resolveRecordAuthor(
  farmId: UUID,
  authorId: UUID
): Promise<{ fullName: string | null; role: MemberRole | null }> {
  const actorProfilesResult = await getFarmActorDisplayProfiles(farmId);

  if (actorProfilesResult.data) {
    const actor = actorProfilesResult.data.find((profile) => profile.userId === authorId);

    if (actor) {
      return {
        fullName: actor.fullName,
        role: actor.role,
      };
    }
  }

  return {
    fullName: null,
    role: null,
  };
}

// Dinilai dari JENIS FOTO yang dipegang catatan itu, bukan dari recordType --
// alasannya di catatan pada DetailState.photoEntityType.
//
// Sengaja TIDAK memakai guard eksahustif seperti loadRecordDetail: yang
// diperiksa di sini bukan union recordType melainkan union entity_type foto,
// dan dua dari enam anggotanya ('tree_main', 'task_proof') memang tidak pernah
// tampil di layar ini. Default "tidak ada foto" adalah jawaban yang benar untuk
// keduanya, bukan kasus yang terlewat.
async function loadRecordPhotos(
  detail: DetailState,
  recordId: UUID
): Promise<ServiceResult<PhotoAttachmentPreviewItem[]>> {
  if (detail.photoEntityType === 'condition_record') {
    const result = await getConditionRecordPhotos({ conditionRecordId: recordId, farmId: detail.farmId });
    return result.error ? result : { data: result.data.map((photo) => toPreviewPhoto(photo.attachment.id, photo.signedUrl)), error: null };
  }

  if (detail.photoEntityType === 'initiative_care_proof') {
    const result = await getInitiativeCareProofPhotos({ activityId: recordId, farmId: detail.farmId });
    return result.error ? result : { data: result.data.map((photo) => toPreviewPhoto(photo.attachment.id, photo.signedUrl)), error: null };
  }

  if (detail.photoEntityType === 'growth_phase_record') {
    const result = await getGrowthPhaseRecordPhotos({ farmId: detail.farmId, growthPhaseRecordId: recordId });
    return result.error ? result : { data: result.data.map((photo) => toPreviewPhoto(photo.attachment.id, photo.signedUrl)), error: null };
  }

  if (detail.photoEntityType === 'harvest_record') {
    const result = await getHarvestRecordPhotos({ farmId: detail.farmId, harvestRecordId: recordId });
    return result.error ? result : { data: result.data.map((photo) => toPreviewPhoto(photo.attachment.id, photo.signedUrl)), error: null };
  }

  // tree_main, task_proof, dan perawatan TERJADWAL: tidak punya kotak foto di
  // layar ini, jadi tidak ada yang perlu dimuat.
  return { data: [], error: null };
}

// Guard eksahustif: recordType sudah dipersempit ke never di titik ini, jadi
// cabang ini hanya tercapai bila union TreeRecordRouteType bertambah tanpa
// pemanggilnya ikut disesuaikan.
// Baris detail panen, hanya yang benar-benar ada isinya.
//
// Berat ditulis dengan locale id-ID supaya pemisah desimalnya koma, dan nol di
// belakang koma dibuang: 12.00 -> "12 kg", 0.50 -> "0,5 kg".
function buildHarvestRows(record: HarvestRecord): Array<{ label: string; value: string | null }> {
  const rows: Array<{ label: string; value: string | null }> = [];

  if (record.harvestWeightKg !== null) {
    const berat = record.harvestWeightKg.toLocaleString('id-ID', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    });

    rows.push({ label: 'Berat panen', value: `${berat} kg` });
  }

  if (record.fruitCount !== null) {
    rows.push({ label: 'Jumlah buah', value: String(record.fruitCount) });
  }

  // Grade lama yang belum dibersihkan sudah dipetakan jadi null oleh mapper di
  // harvestService, jadi barisnya cukup disembunyikan — bukan menampilkan teks
  // bebas yang sudah tidak berlaku.
  if (record.fruitCondition) {
    rows.push({ label: 'Grade', value: GRADE_PANEN_LABELS[record.fruitCondition] });
  }

  return rows;
}

function unknownRecordType(recordType: never): ServiceResult<never> {
  return {
    data: null,
    error: { message: `Jenis catatan tidak dikenal: ${String(recordType)}` },
  };
}

function toPreviewPhoto(id: UUID, url: string, caption?: string | null): PhotoAttachmentPreviewItem {
  return { caption, id, url };
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('id-ID', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatEventDate(value: string): string {
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

function formatActorDisplayName({
  actorId,
  actorName,
  actorRole,
  currentUserId,
}: {
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: MemberRole | null;
  currentUserId?: string | null;
}): string {
  if (actorId && currentUserId && actorId === currentUserId) {
    return 'Anda';
  }

  const displayName = formatPersonDisplayName(actorName, '');

  if (displayName) {
    return displayName;
  }

  if (actorRole === 'owner') {
    return 'Pemilik kebun';
  }

  if (actorRole === 'worker') {
    return 'Anggota kebun';
  }

  return 'Anggota kebun';
}

function shouldShowUpdatedAt(createdAt?: string | null, updatedAt?: string | null): boolean {
  if (!updatedAt) {
    return false;
  }

  if (!createdAt) {
    return true;
  }

  const createdTime = new Date(createdAt).getTime();
  const updatedTime = new Date(updatedAt).getTime();

  if (Number.isNaN(createdTime) || Number.isNaN(updatedTime)) {
    return updatedAt !== createdAt;
  }

  return Math.abs(updatedTime - createdTime) > 1000;
}
