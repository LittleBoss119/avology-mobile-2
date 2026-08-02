import React from 'react';
import { Image, Modal, Pressable, Text, View } from 'react-native';

import type {
  CareCategory,
  GrowthPhase,
  MemberRole,
  Tree,
  TreeConditionReport,
  TreeConditionStatus,
  CareActivityOrigin,
  TreeHistoryItem,
  TreeHistoryType,
} from '../types/domain';
import type {
  ConditionRecordPhotoMap,
  PickedPhotoAsset,
} from '../types/media';
import { colors, radius, spacing, tokens, typography } from '../constants/theme';
import { formatCareCategory, formatPersonDisplayName } from '../utils/displayFormat';
import {
  buildTreeDisplayCode,
  formatGrowthPhase,
  formatTreeAge,
  formatTreeDisplayCode,
} from '../utils/treeFormat';
import { Badge, Button, Card, DateField, EmptyState, Field, MetaRow, PhotoPickerCard } from './ui';
import { AlertTriangleIcon, BasketIcon, ChevronRightIcon, FlowerIcon, Icon, SprayIcon } from './icons';

export type TreeFormValues = {
  rowPosition: string;
  columnPosition: string;
  variety: string;
  plantedAt: Date | null;
};

export type TreeCardProps = {
  tree: Tree;
  children?: React.ReactNode;
  photoUrl?: string | null;
  onPress?: () => void;
};

export type TreeFormErrors = {
  columnPosition?: string;
  plantedAt?: string;
  rowPosition?: string;
  variety?: string;
};

export type TreeFormProps = {
  errors?: TreeFormErrors;
  values: TreeFormValues;
  onChange: (values: TreeFormValues) => void;
};

export type TreeMainPhotoFormSectionProps = {
  currentPhotoUrl?: string | null;
  deleteRequested?: boolean;
  disabled: boolean;
  photo: PickedPhotoAsset | null;
  onCameraPress: () => void;
  onDeleteExisting?: () => void;
  onGalleryPress: () => void;
  onRemoveSelected: () => void;
  onRestoreExisting?: () => void;
};

export type ConditionStatusBadgeProps = {
  status: TreeConditionStatus;
};

export type GrowthPhaseBadgeProps = {
  phase: GrowthPhase;
};

export type ConditionReportListItem = Omit<TreeConditionReport, 'reportedBy'> & {
  reportedBy?: string | null;
  reportedByName?: string | null;
  reportedByRole?: MemberRole | null;
};

export type ConditionReportItemProps = {
  report: ConditionReportListItem;
};

export type ConditionReportListProps = {
  reports: ConditionReportListItem[];
  conditionPhotoMap?: ConditionRecordPhotoMap;
  emptyTitle?: string;
  emptySubtitle?: string;
  currentUserId?: string | null;
  viewerMode?: TreeHistoryViewerMode;
};

export type TreeHistoryTimelineProps = {
  currentUserId?: string | null;
  history: TreeHistoryItem[];
  onRecordPress?: (item: TreeHistoryItem, recordType: TreeHistoryRouteRecordType) => void;
  viewerMode?: TreeHistoryViewerMode;
};

type TreeHistoryViewerMode = 'owner' | 'worker';
export type TreeHistoryRouteRecordType = 'condition' | 'phase' | 'harvest' | 'care';

export function TreeCard({ children, onPress, photoUrl, tree }: TreeCardProps) {
  const displayCode = formatTreeDisplayCode(tree);
  const isInactive = tree.isArchived || tree.currentCondition === 'dead';
  const phaseText = tree.currentGrowthPhase ? formatGrowthPhase(tree.currentGrowthPhase) : 'Fase -';
  const ageText = tree.plantedAt ? formatTreeAge(tree.plantedAt) : null;
  const metaText = ageText ? `${phaseText} · ${ageText}` : phaseText;

  const content = (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderCurve: 'continuous',
        borderRadius: radius.xl,
        borderWidth: 1,
        opacity: isInactive ? 0.62 : 1,
        overflow: 'hidden',
      }}
    >
      <View style={{ aspectRatio: 4 / 3, width: '100%' }}>
        <TreeVisualPlaceholder inactive={isInactive} photoUrl={photoUrl} />
        <View style={{ left: 8, position: 'absolute', top: 8 }}>
          {tree.isArchived ? <Badge label="Arsip" tone="muted" /> : <ConditionStatusBadge status={tree.currentCondition} />}
        </View>
      </View>

      <View style={{ gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 1 }}>
        <Text selectable numberOfLines={1} style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
          {displayCode}
        </Text>
        <Text selectable numberOfLines={1} style={{ color: colors.text, fontSize: 13 }}>
          {tree.variety ?? '—'}
        </Text>
        <Text selectable numberOfLines={1} style={{ color: colors.textMuted, fontSize: 12 }}>
          {metaText}
        </Text>
        {children}
      </View>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return <Pressable onPress={onPress}>{content}</Pressable>;
}

export function TreeVisualPlaceholder({
  inactive = false,
  photoUrl,
}: {
  inactive?: boolean;
  photoUrl?: string | null;
}) {
  const [imageFailed, setImageFailed] = React.useState(false);
  const shouldShowImage = Boolean(photoUrl && !imageFailed);

  React.useEffect(() => {
    setImageFailed(false);
  }, [photoUrl]);

  if (shouldShowImage) {
    return (
      <Image
        onError={() => setImageFailed(true)}
        resizeMode="cover"
        source={{ uri: photoUrl ?? undefined }}
        style={{ height: '100%', opacity: inactive ? 0.85 : 1, width: '100%' }}
      />
    );
  }

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: colors.photoPlaceholder,
        height: '100%',
        justifyContent: 'center',
        width: '100%',
      }}
    >
      <Icon name="tree" size={28} color={colors.textMuted} />
    </View>
  );
}

export function TreeForm({ errors, onChange, values }: TreeFormProps) {
  const previewCode = buildTreeDisplayCode(values);

  function updateTextValue(field: 'rowPosition' | 'columnPosition' | 'variety', value: string) {
    onChange({
      ...values,
      [field]: value,
    });
  }

  function updateDateValue(value: Date | null) {
    onChange({
      ...values,
      plantedAt: value,
    });
  }

  return (
    <View style={{ gap: spacing['2xl'] }}>
      <TreeFormSection
        title="Identitas Pohon"
        description="Kode pohon otomatis dari baris dan kolom."
      >
        <View
          style={{
            backgroundColor: colors.primarySoft,
            borderColor: colors.primaryBorder,
            borderCurve: 'continuous',
            borderRadius: radius.lg,
            borderWidth: 1,
            gap: spacing.xs,
            padding: spacing.md,
          }}
        >
          <Text selectable style={{ color: colors.textMuted, fontSize: tokens.type.meta.fontSize, fontWeight: '700' }}>
            Kode pohon otomatis
          </Text>
          <Text
            selectable
            style={{
              color: previewCode ? colors.primary : colors.textSoft,
              fontSize: tokens.type.title.fontSize,
              fontWeight: '700',
            }}
          >
            {previewCode ?? 'Lengkapi baris & kolom'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Field
              error={errors?.rowPosition}
              label="Baris *"
              onChangeText={(value) => updateTextValue('rowPosition', value)}
              placeholder="A"
              value={values.rowPosition}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              error={errors?.columnPosition}
              label="Kolom *"
              onChangeText={(value) => updateTextValue('columnPosition', value)}
              placeholder="1"
              value={values.columnPosition}
            />
          </View>
        </View>
        <Field
          error={errors?.variety}
          label="Varietas *"
          onChangeText={(value) => updateTextValue('variety', value)}
          placeholder="Contoh: Alpukat mentega"
          value={values.variety}
        />
      </TreeFormSection>

      <DateField
        error={errors?.plantedAt}
        label="Tanggal tanam *"
        value={formatDateForDb(values.plantedAt)}
        onChangeDate={(value) => updateDateValue(parseDbDate(value))}
      />
    </View>
  );
}

// Validasi bersama create & edit: tandai semua field wajib yang kosong sekaligus.
export function validateTreeForm(values: TreeFormValues): TreeFormErrors {
  const errors: TreeFormErrors = {};

  if (!values.rowPosition.trim()) {
    errors.rowPosition = 'Baris wajib diisi.';
  }

  if (!values.columnPosition.trim()) {
    errors.columnPosition = 'Kolom wajib diisi.';
  }

  if (!values.variety.trim()) {
    errors.variety = 'Varietas wajib diisi.';
  }

  if (!values.plantedAt) {
    errors.plantedAt = 'Tanggal tanam wajib dipilih.';
  }

  return errors;
}

export function hasTreeFormErrors(errors: TreeFormErrors): boolean {
  return Boolean(errors.rowPosition || errors.columnPosition || errors.variety || errors.plantedAt);
}

// Hapus error field yang sudah terisi (dipakai saat nilai berubah); tak pernah
// menambah error baru supaya pesan tidak muncul sambil mengetik.
export function clearResolvedTreeFormErrors(
  errors: TreeFormErrors,
  values: TreeFormValues
): TreeFormErrors {
  if (!hasTreeFormErrors(errors)) {
    return errors;
  }

  return {
    columnPosition: values.columnPosition.trim() ? undefined : errors.columnPosition,
    plantedAt: values.plantedAt ? undefined : errors.plantedAt,
    rowPosition: values.rowPosition.trim() ? undefined : errors.rowPosition,
    variety: values.variety.trim() ? undefined : errors.variety,
  };
}

export function TreeMainPhotoFormSection({
  currentPhotoUrl,
  deleteRequested = false,
  disabled,
  onCameraPress,
  onDeleteExisting,
  onGalleryPress,
  onRemoveSelected,
  onRestoreExisting,
  photo,
}: TreeMainPhotoFormSectionProps) {
  const previewUri = photo?.uri ?? (deleteRequested ? null : currentPhotoUrl);
  const hasExistingPhoto = Boolean(currentPhotoUrl);
  const canRemove = Boolean(photo || (hasExistingPhoto && !deleteRequested));

  function handleRemovePress() {
    if (photo) {
      onRemoveSelected();
      return;
    }

    onDeleteExisting?.();
  }

  return (
    <View style={{ gap: spacing.md }}>
      <PhotoPickerCard
        choosePhotoLabel="Pilih Galeri"
        emptyLabel="Tambah foto pohon"
        imageUri={previewUri}
        loading={disabled}
        removeLabel="Hapus Foto"
        takePhotoLabel="Ambil Foto"
        title="Foto pohon"
        onChoosePhoto={onGalleryPress}
        onRemovePhoto={canRemove ? handleRemovePress : undefined}
        onTakePhoto={onCameraPress}
      />

      {deleteRequested && !photo ? (
        <Text selectable style={{ color: colors.textMuted, lineHeight: tokens.type.bodySmall.lineHeight }}>
          Foto pohon saat ini akan dihapus setelah perubahan disimpan.
        </Text>
      ) : null}

      {deleteRequested && !photo && onRestoreExisting ? (
        <Button disabled={disabled} title="Batalkan Hapus Foto" variant="secondary" onPress={onRestoreExisting} />
      ) : null}
    </View>
  );
}

function TreeFormSection({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: spacing.xs }}>
        <Text
          selectable
          style={{
            color: colors.text,
            fontSize: tokens.type.subheading.fontSize,
            fontWeight: '700',
            lineHeight: tokens.type.subheading.lineHeight,
          }}
        >
          {title}
        </Text>
        {description ? (
          <Text
            selectable
            style={{
              color: colors.textMuted,
              fontSize: tokens.type.meta.fontSize,
              lineHeight: tokens.type.meta.lineHeight,
            }}
          >
            {description}
          </Text>
        ) : null}
      </View>
      <View style={{ gap: spacing.md }}>{children}</View>
    </View>
  );
}

export function ConditionStatusBadge({ status }: ConditionStatusBadgeProps) {
  const tone = getConditionTone(status);

  return <Badge label={formatCompactConditionStatus(status)} maxWidth={180} tone={tone} />;
}

export function GrowthPhaseBadge({ phase }: GrowthPhaseBadgeProps) {
  const tone = getGrowthPhaseTone(phase);

  return <Badge label={formatCompactGrowthPhase(phase)} maxWidth={180} tone={tone} />;
}

export function ConditionReportList({
  conditionPhotoMap = {},
  currentUserId,
  emptySubtitle = 'Laporan kondisi yang dibuat pemilik atau pekerja aktif akan muncul di sini.',
  emptyTitle = 'Belum ada laporan kondisi',
  reports,
  viewerMode = 'owner',
}: ConditionReportListProps) {
  if (reports.length === 0) {
    return <EmptyState title={emptyTitle} subtitle={emptySubtitle} />;
  }

  return (
    <View style={{ gap: 12 }}>
      {reports.map((report) => (
        <ConditionReportItem
          key={report.id}
          photoUrl={conditionPhotoMap[report.id]?.signedUrl}
          currentUserId={currentUserId}
          report={report}
          viewerMode={viewerMode}
        />
      ))}
    </View>
  );
}

export function TreeHistoryTimeline({
  currentUserId,
  history,
  onRecordPress,
  viewerMode = 'owner',
}: TreeHistoryTimelineProps) {
  if (history.length === 0) {
    return (
      <EmptyState
        title="Belum ada riwayat"
        subtitle="Catatan kondisi, fase, hasil panen, dan perawatan akan muncul di sini."
      />
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      {history.map((item, index) => (
        <TreeHistoryTimelineItem
          key={buildHistoryItemKey(item, index)}
          currentUserId={currentUserId}
          item={item}
          onRecordPress={onRecordPress}
          viewerMode={viewerMode}
        />
      ))}
    </View>
  );
}

export function ConditionReportItem({
  currentUserId,
  photoUrl,
  report,
  viewerMode = 'owner',
}: ConditionReportItemProps & {
  currentUserId?: string | null;
  photoUrl?: string | null;
  viewerMode?: TreeHistoryViewerMode;
}) {
  const reporterName = formatActorDisplayName({
    actorId: report.reportedBy ?? null,
    actorName: report.reportedByName,
    actorRole: report.reportedByRole,
    currentUserId,
    viewerMode,
  });

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
        <ConditionStatusBadge status={report.conditionStatus} />
        <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
          {formatEventDate(report.reportedAt)}
        </Text>
      </View>
      <MetaRow label="Catatan" value={report.note || '-'} />
      {photoUrl ? <PhotoThumbnail photoUrl={photoUrl} /> : null}
      <MetaRow label="Dilaporkan oleh" value={reporterName} />
    </Card>
  );
}

function TreeHistoryTimelineItem({
  currentUserId,
  item,
  onRecordPress,
  viewerMode,
}: {
  currentUserId?: string | null;
  item: TreeHistoryItem;
  onRecordPress?: (item: TreeHistoryItem, recordType: TreeHistoryRouteRecordType) => void;
  viewerMode: TreeHistoryViewerMode;
}) {
  const careOriginLabel = item.historyType === 'care' ? formatCareOrigin(item.asal) : null;
  const routeRecordType = getRouteRecordType(item);
  const canOpenRecord = Boolean(item.sourceId && routeRecordType && onRecordPress);
  const content = (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      <View
        style={{
          alignItems: 'center',
          backgroundColor: getTimelineDotColor(item.historyType),
          borderRadius: 999,
          height: 34,
          justifyContent: 'center',
          marginTop: spacing.xs,
          width: 34,
        }}
      >
        {getTimelineIcon(item.historyType, getTimelineTextColor(item.historyType))}
      </View>
      <View style={{ flex: 1 }}>
        <View
          style={{
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderColor: canOpenRecord ? colors.primaryBorder : colors.border,
            borderCurve: 'continuous',
            borderRadius: radius.xl,
            borderWidth: 1,
            flexDirection: 'row',
            gap: spacing.sm,
            padding: spacing.md,
          }}
        >
          <View style={{ flex: 1, gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flexDirection: 'row', flexShrink: 1, gap: spacing.sm }}>
                <Badge label={formatHistoryType(item.historyType)} tone={getHistoryTone(item.historyType)} />
                {careOriginLabel ? <Badge label={careOriginLabel} tone="muted" /> : null}
              </View>
              <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
                {formatEventDate(item.happenedAt)}
              </Text>
            </View>
            <Text selectable style={{ color: colors.text, fontSize: typography.bodyStrong.fontSize, fontWeight: '700', lineHeight: typography.bodyStrong.lineHeight }}>
              {formatHistoryTitle(item)}
            </Text>
            {formatHistoryDescription(item) ? (
              <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
                {formatHistoryDescription(item)}
              </Text>
            ) : null}
            <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
              {getHistoryActorPrefix(item.historyType)}{' '}
              {formatActorDisplayName({
                actorId: item.actorId,
                actorName: item.actorName,
                actorRole: item.actorRole,
                currentUserId,
                viewerMode,
              })}
            </Text>
          </View>
          {canOpenRecord ? <ChevronRightIcon color={colors.textSoft} size={20} /> : null}
        </View>
      </View>
    </View>
  );

  if (canOpenRecord && routeRecordType) {
    return (
      <Pressable accessibilityRole="button" onPress={() => onRecordPress?.(item, routeRecordType)}>
        {content}
      </Pressable>
    );
  }

  return content;
}

function PhotoThumbnailRow({ photoUrls }: { photoUrls: string[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {photoUrls.map((photoUrl) => (
        <PhotoThumbnail key={photoUrl} photoUrl={photoUrl} />
      ))}
    </View>
  );
}

function PhotoThumbnail({ photoUrl }: { photoUrl: string }) {
  const [imageFailed, setImageFailed] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  React.useEffect(() => {
    setImageFailed(false);
  }, [photoUrl]);

  if (imageFailed) {
    return null;
  }

  return (
    <>
      <Pressable
        accessibilityRole="imagebutton"
        onPress={() => setPreviewOpen(true)}
        style={{
          alignSelf: 'flex-start',
          borderColor: colors.border,
          borderCurve: 'continuous',
          borderRadius: radius.md,
          borderWidth: 1,
          overflow: 'hidden',
        }}
      >
        <Image
          onError={() => setImageFailed(true)}
          resizeMode="cover"
          source={{ uri: photoUrl }}
          style={{ height: 84, width: 112 }}
        />
      </Pressable>
      <Modal animationType="fade" transparent visible={previewOpen} onRequestClose={() => setPreviewOpen(false)}>
        <Pressable
          onPress={() => setPreviewOpen(false)}
          style={{
            alignItems: 'center',
            backgroundColor: 'rgba(30,42,36,0.72)',
            flex: 1,
            justifyContent: 'center',
            padding: 22,
          }}
        >
          <Image
            resizeMode="contain"
            source={{ uri: photoUrl }}
            style={{ borderRadius: 14, height: '78%', width: '100%' }}
          />
          <Text selectable style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginTop: 14 }}>
            Tutup
          </Text>
        </Pressable>
      </Modal>
    </>
  );
}

function getTimelineDotColor(type: TreeHistoryType): string {
  if (type === 'condition') {
    return '#FCEFC7';
  }

  if (type === 'phase') {
    return '#E7F6EC';
  }

  if (type === 'harvest') {
    return '#FFF4D6';
  }

  return '#E7EEF8';
}

function getTimelineTextColor(type: TreeHistoryType): string {
  if (type === 'condition') {
    return '#7A5600';
  }

  if (type === 'phase') {
    return '#065F2E';
  }

  if (type === 'harvest') {
    return '#8A5B00';
  }

  return '#184E91';
}

function getTimelineIcon(type: TreeHistoryType, color: string) {
  if (type === 'condition') {
    return <AlertTriangleIcon color={color} size={18} />;
  }

  if (type === 'phase') {
    return <FlowerIcon color={color} size={18} />;
  }

  if (type === 'harvest') {
    return <BasketIcon color={color} size={18} />;
  }

  return <SprayIcon color={color} size={18} />;
}

type BadgeTone = 'danger' | 'muted' | 'success' | 'warning';

function formatActorDisplayName({
  actorId,
  actorName,
  actorRole,
  currentUserId,
  viewerMode,
}: {
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: MemberRole | null;
  currentUserId?: string | null;
  viewerMode: TreeHistoryViewerMode;
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

  void viewerMode;
  return 'Anggota kebun';
}

function getConditionTone(status: TreeConditionStatus): BadgeTone {
  if (status === 'healthy') {
    return 'success';
  }

  if (status === 'needs_attention') {
    return 'warning';
  }

  if (status === 'dead') {
    return 'muted';
  }

  return 'danger';
}

function getGrowthPhaseTone(phase: GrowthPhase): BadgeTone {
  if (phase === 'flowering') {
    return 'warning';
  }

  if (phase === 'fruiting') {
    return 'success';
  }

  return 'muted';
}

function getHistoryTone(type: TreeHistoryType): BadgeTone {
  if (type === 'condition') {
    return 'warning';
  }

  if (type === 'phase' || type === 'harvest') {
    return 'success';
  }

  return 'muted';
}

function getRouteRecordType(item: TreeHistoryItem): TreeHistoryRouteRecordType | null {
  if (item.historyType === 'condition') {
    return 'condition';
  }

  if (item.historyType === 'phase') {
    return 'phase';
  }

  if (item.historyType === 'harvest') {
    return 'harvest';
  }

  // 'care' punya layar detail READ-ONLY (US-14 / Iterasi C): bisa dibuka untuk
  // dilihat, tapi tetap tidak bisa diedit/dihapus (lihat migrasi 027).
  if (item.historyType === 'care') {
    return 'care';
  }

  return null;
}

function buildHistoryItemKey(item: TreeHistoryItem, index: number): string {
  const stableId = item.sourceId ?? item.happenedAt ?? item.title;
  return `${item.historyType}-${stableId}-${index}`;
}

function getHistoryActorPrefix(type: TreeHistoryType): string {
  if (type === 'harvest') {
    return 'Dipanen oleh';
  }

  return 'Dicatat oleh';
}

function formatHistoryType(type: TreeHistoryType): string {
  if (type === 'condition') {
    return 'Kondisi';
  }

  if (type === 'phase') {
    return 'Fase';
  }

  if (type === 'harvest') {
    return 'Panen';
  }

  return 'Perawatan';
}

function formatCareOrigin(asal?: CareActivityOrigin | null): string | null {
  if (asal === 'terjadwal') {
    return 'Terjadwal';
  }

  if (asal === 'inisiatif') {
    return 'Inisiatif';
  }

  return null;
}

function formatHistoryTitle(item: TreeHistoryItem): string {
  if (item.historyType === 'condition' && isTreeConditionStatus(item.title)) {
    return formatCompactConditionStatus(item.title);
  }

  if (item.historyType === 'phase' && isGrowthPhase(item.title)) {
    return formatGrowthPhase(item.title);
  }

  return item.title;
}

function formatHistoryDescription(item: TreeHistoryItem): string | null {
  if (item.historyType !== 'care') {
    return item.description;
  }

  // Catatan inisiatif tanpa note jatuh ke kategori mentah dari view
  // (mis. 'watering'), jadi diterjemahkan ke label Indonesia di sini.
  const base = isCareCategory(item.description)
    ? formatCareCategory(item.description)
    : item.description;

  // RF-12: produk/merek tampil inline di baris deskripsi, mis. "Semprot · Decis 25 EC".
  // Tanpa produk cukup tampilkan base; jangan sampai ada pemisah menggantung/"null".
  const produk = item.produk?.trim() ? item.produk.trim() : null;

  if (base && produk) {
    return `${base} · ${produk}`;
  }

  return base ?? produk;
}

function isCareCategory(value?: string | null): value is CareCategory {
  return (
    value === 'watering' ||
    value === 'fertilizing' ||
    value === 'spraying' ||
    value === 'weeding' ||
    value === 'other'
  );
}

function formatCompactConditionStatus(status: TreeConditionStatus): string {
  const labels: Record<TreeConditionStatus, string> = {
    damaged: 'Rusak',
    dead: 'Mati',
    disease_indicated: 'Penyakit',
    healthy: 'Sehat',
    needs_attention: 'Perhatian',
    pest_attacked: 'Hama',
  };

  return labels[status];
}

function formatCompactGrowthPhase(phase: GrowthPhase): string {
  const labels: Record<GrowthPhase, string> = {
    flowering: 'Berbunga',
    fruiting: 'Berbuah',
    harvesting: 'Panen',
    initial_planting: 'Awal',
    vegetative: 'Vegetatif',
  };

  return labels[phase];
}

function isTreeConditionStatus(value: string): value is TreeConditionStatus {
  return [
    'healthy',
    'needs_attention',
    'pest_attacked',
    'disease_indicated',
    'damaged',
    'dead',
  ].includes(value);
}

function isGrowthPhase(value: string): value is GrowthPhase {
  return [
    'initial_planting',
    'vegetative',
    'flowering',
    'fruiting',
    'harvesting',
  ].includes(value);
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

export function formatDateForDb(date: Date | null): string {
  if (!date) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDbDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, monthIndex, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}
