import { router } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

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
} from '../services/photoAttachmentService';
import { getTreeDetail } from '../services/treeService';
import { useAuth } from '../context/auth-context';
import type {
  MemberRole,
  ServiceResult,
  Tree,
  UUID,
} from '../types/domain';
import type { PhotoAttachmentPreviewItem } from '../types/media';
import { formatCareCategory, formatPersonDisplayName } from '../utils/displayFormat';
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
    const photoResult = await loadRecordPhotos(normalizedType, detailResult.data.farmId, recordId);
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
          <MetaRow label="Varietas" value={tree.variety ?? 'Belum diisi'} />
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

      {recordTypeHasPhotos(normalizedType) ? (
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

// Hanya condition_record yang masih menyimpan foto. Foto untuk phase & harvest
// dihapus di B3a/B3b, sehingga section "Foto catatan" disembunyikan untuk kedua
// tipe itu (bukan dirender kosong). task_proof & operational report punya foto
// tapi ditangani layar lain, bukan di sini.
function recordTypeHasPhotos(recordType: TreeRecordRouteType | null): boolean {
  return recordType === 'condition';
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
        recordLabel: 'Panen',
        rows: [
          { label: 'Jumlah buah', value: String(result.data.fruitCount) },
          { label: 'Kondisi buah', value: result.data.fruitCondition },
        ],
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

    if (care.produk && care.produk.trim()) {
      rows.push({ label: 'Produk', value: care.produk });
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

async function loadRecordPhotos(
  recordType: TreeRecordRouteType,
  farmId: UUID,
  recordId: UUID
): Promise<ServiceResult<PhotoAttachmentPreviewItem[]>> {
  if (recordType === 'condition') {
    const result = await getConditionRecordPhotos({ conditionRecordId: recordId, farmId });
    return result.error ? result : { data: result.data.map((photo) => toPreviewPhoto(photo.attachment.id, photo.signedUrl)), error: null };
  }

  if (recordType === 'phase') {
    return { data: [], error: null };
  }

  if (recordType === 'harvest') {
    return { data: [], error: null };
  }

  if (recordType === 'care') {
    return { data: [], error: null };
  }

  return unknownRecordType(recordType);
}

// Guard eksahustif: recordType sudah dipersempit ke never di titik ini, jadi
// cabang ini hanya tercapai bila union TreeRecordRouteType bertambah tanpa
// pemanggilnya ikut disesuaikan.
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
