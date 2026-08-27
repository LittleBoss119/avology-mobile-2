import { router } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { GRADE_PANEN_LABELS } from '../constants/gradePanen';
import { colors, spacing, typography } from '../constants/theme';
import {
  getCareActivityDetail,
} from '../services/careActivityService';
import {
  getConditionReportDetail,
} from '../services/conditionReportService';
import {
  getGrowthPhaseRecordDetail,
} from '../services/growthPhaseService';
import {
  getHarvestRecordDetail,
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
  Tree,
  UUID,
} from '../types/domain';
import type { PhotoAttachmentEntityType, PhotoAttachmentPreviewItem } from '../types/media';
import {
  formatCareCategory,
  formatPersonDisplayName,
  formatProdukDenganTakaran,
} from '../utils/displayFormat';
import { formatGrowthPhase, formatTreeConditionStatus, formatTreeDisplayCode, formatTreeLocation } from '../utils/treeFormat';
import { PhotoAttachmentPreviewList } from './media';
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

// Catatan perawatan (care) punya layar detail READ-ONLY (US-14 / Iterasi C):
// bisa dibuka untuk dilihat, tetapi tetap tidak bisa diedit/dihapus (migrasi 027).
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

  if (loading) {
    return <LoadingState message="Memuat detail catatan..." />;
  }

  if (!detail || !normalizedType) {
    return (
      <Screen>
        <TopAppBar title="Detail catatan" onBack={() => router.back()} />
        <ErrorBanner message={error} />
        <EmptyState title="Catatan tidak ditemukan" subtitle="Catatan mungkin sudah dihapus atau akses tidak aktif." />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        detail.canEdit ? (
          <Button title="Edit catatan" onPress={() => router.push(`${basePath}/${treeId}/records/${normalizedType}/${recordId}/edit`)} />
        ) : undefined
      }
    >
      <TopAppBar title={detail.title} onBack={() => router.back()} />
      <ErrorBanner message={error} />

      {tree ? (
        <Card variant="highlight">
          <Text selectable style={{ color: colors.text, fontSize: typography.h3.fontSize, fontWeight: '700' }}>
            Konteks Pohon
          </Text>
          <MetaRow label="Kode pohon" value={formatTreeDisplayCode(tree)} />
          <MetaRow label="Lokasi" value={formatTreeLocation(tree)} />
          <MetaRow label="Varietas" value={tree.activePlanting?.variety ?? 'Belum diisi'} />
        </Card>
      ) : null}

      <Card>
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Badge label={detail.recordLabel} tone="info" />
            {detail.originLabel ? <Badge label={detail.originLabel} tone="muted" /> : null}
          </View>
          <MetaRow label={detail.eventLabel} value={formatEventDate(detail.eventAt)} />
          <MetaRow
            label={detail.authorVerb === 'harvested' ? 'Dipanen oleh' : 'Dicatat oleh'}
            value={formatActorDisplayName({
              actorId: detail.authorId,
              actorName: detail.authorName,
              actorRole: detail.authorRole,
              currentUserId: profile?.id,
            })}
          />
          {detail.createdAt ? <MetaRow label="Dibuat pada" value={formatDateTime(detail.createdAt)} /> : null}
          {shouldShowUpdatedAt(detail.createdAt, detail.updatedAt) ? (
            <MetaRow label="Terakhir diubah" value={formatDateTime(detail.updatedAt as string)} />
          ) : null}
          {detail.rows.map((row) => (
            <MetaRow key={row.label} label={row.label} value={row.value} />
          ))}
          <MetaRow label="Catatan" value={detail.note || '-'} />
          {!detail.canEdit && detail.supportsEdit !== false ? (
            <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
              Catatan ini hanya bisa diubah oleh pelapor.
            </Text>
          ) : null}
        </View>
      </Card>

      {detail.photoEntityType ? (
        <Card>
          <Text selectable style={{ color: colors.text, fontSize: typography.h3.fontSize, fontWeight: '700' }}>
            Foto catatan
          </Text>
          <PhotoAttachmentPreviewList emptyText="Tidak ada foto pada catatan ini." photos={photos} />
        </Card>
      ) : null}
    </Screen>
  );
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
