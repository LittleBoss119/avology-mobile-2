import React from 'react';
import DateTimePicker, { type DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { Image, Modal, Platform, Pressable, Text, View } from 'react-native';

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
import { colors, radius, spacing, typography } from '../constants/theme';
import { formatCareCategory, formatPersonDisplayName } from '../utils/displayFormat';
import {
  buildTreeDisplayCode,
  formatGrowthPhase,
  formatTreeDisplayCode,
} from '../utils/treeFormat';
import { appTheme, Badge, Button, Card, EmptyState, Field, MetaRow, PhotoPickerCard } from './ui';
import { AlertTriangleIcon, BasketIcon, ChevronRightIcon, FlowerIcon, SprayIcon } from './icons';

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

export type TreeFormProps = {
  dateSectionDescription?: string;
  dateSectionTitle?: string;
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
export type TreeHistoryRouteRecordType = 'condition' | 'phase' | 'harvest';

export function TreeCard({ children, onPress, photoUrl, tree }: TreeCardProps) {
  const displayCode = formatTreeDisplayCode(tree);

  const content = (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderCurve: 'continuous',
        borderRadius: radius.xl,
        borderWidth: 1,
        gap: spacing.sm,
        minHeight: 206,
        overflow: 'hidden',
        padding: spacing.sm,
      }}
    >
      <TreeVisualPlaceholder condition={tree.currentCondition} photoUrl={photoUrl} size="compact">
        {tree.isArchived ? <Badge label="Arsip" tone="muted" /> : <ConditionStatusBadge status={tree.currentCondition} />}
      </TreeVisualPlaceholder>

      <View style={{ gap: spacing.xs, paddingHorizontal: spacing.xs, paddingBottom: spacing.xs }}>
        <Text selectable numberOfLines={1} style={{ color: colors.primary, fontSize: 22, fontWeight: '900' }}>
          {displayCode}
        </Text>
        <View style={{ alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {tree.currentGrowthPhase ? <GrowthPhaseBadge phase={tree.currentGrowthPhase} /> : <Badge label="Fase -" tone="neutral" />}
        </View>
        {tree.variety ? (
          <Text selectable numberOfLines={1} style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700', lineHeight: 17 }}>
            {tree.variety}
          </Text>
        ) : null}
      </View>

      {children}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return <Pressable onPress={onPress}>{content}</Pressable>;
}

export function TreeVisualPlaceholder({
  children,
  condition,
  photoUrl,
  size = 'regular',
}: {
  children?: React.ReactNode;
  condition?: TreeConditionStatus;
  photoUrl?: string | null;
  size?: 'compact' | 'regular';
}) {
  const accent = getVisualAccent(condition);
  const isCompact = size === 'compact';
  const [imageFailed, setImageFailed] = React.useState(false);
  const shouldShowImage = Boolean(photoUrl && !imageFailed);

  React.useEffect(() => {
    setImageFailed(false);
  }, [photoUrl]);

  return (
    <View
      style={{
        backgroundColor: accent.background,
        borderColor: accent.border,
        borderCurve: 'continuous',
        borderRadius: isCompact ? radius.lg : radius.xl,
        borderWidth: 1,
        minHeight: isCompact ? 118 : 220,
        overflow: 'hidden',
        padding: isCompact ? spacing.sm : spacing.lg,
      }}
    >
      {shouldShowImage ? (
        <Image
          onError={() => setImageFailed(true)}
          resizeMode="cover"
          source={{ uri: photoUrl ?? undefined }}
          style={{
            bottom: 0,
            left: 0,
            position: 'absolute',
            right: 0,
            top: 0,
          }}
        />
      ) : (
        <>
          <View
            style={{
              backgroundColor: accent.haze,
              borderRadius: 999,
              height: isCompact ? 86 : 180,
              position: 'absolute',
              right: isCompact ? -18 : -30,
              top: isCompact ? -20 : -26,
              width: isCompact ? 118 : 220,
            }}
          />
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.34)',
              borderRadius: 999,
              bottom: isCompact ? -16 : -34,
              height: isCompact ? 58 : 112,
              left: isCompact ? -22 : -30,
              position: 'absolute',
              width: isCompact ? 86 : 160,
            }}
          />
        </>
      )}
      <View style={{ alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' }}>
        {shouldShowImage ? (
          <View style={{ flex: 1 }} />
        ) : (
          <View style={{ gap: isCompact ? 4 : 8, paddingTop: isCompact ? 16 : 42 }}>
            <View
              style={{
                backgroundColor: accent.leaf,
                borderRadius: 999,
                height: isCompact ? 34 : 52,
                transform: [{ rotate: '-22deg' }],
                width: isCompact ? 72 : 112,
              }}
            />
            <View
              style={{
                backgroundColor: accent.fruit,
                borderRadius: 999,
                height: isCompact ? 42 : 64,
                marginLeft: isCompact ? 44 : 72,
                marginTop: isCompact ? -8 : -12,
                width: isCompact ? 32 : 50,
              }}
            />
          </View>
        )}
        <View style={{ alignItems: 'flex-end', gap: 6, zIndex: 1 }}>{children}</View>
      </View>
    </View>
  );
}

export function TreeForm({
  dateSectionDescription = 'Tanggal tanam boleh dikosongkan jika belum diketahui.',
  dateSectionTitle = 'Tanggal Tanam',
  onChange,
  values,
}: TreeFormProps) {
  const previewCode = buildTreeDisplayCode(values);
  const [datePickerOpen, setDatePickerOpen] = React.useState(false);

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

  function handleDateValueChange(_event: DateTimePickerChangeEvent, selectedDate: Date) {
    if (Platform.OS === 'android') {
      setDatePickerOpen(false);
    }

    updateDateValue(selectedDate);
  }

  function handleDateDismiss() {
    setDatePickerOpen(false);
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
          <Text selectable style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
            Kode pohon otomatis
          </Text>
          <Text selectable style={{ color: colors.primary, fontSize: 24, fontWeight: '900' }}>
            {previewCode ?? 'Lokasi belum lengkap'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Field
              label="Baris *"
              onChangeText={(value) => updateTextValue('rowPosition', value)}
              placeholder="A"
              value={values.rowPosition}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Kolom *"
              onChangeText={(value) => updateTextValue('columnPosition', value)}
              placeholder="1"
              value={values.columnPosition}
            />
          </View>
        </View>
        <Field
          label="Varietas *"
          onChangeText={(value) => updateTextValue('variety', value)}
          placeholder="Contoh: Alpukat mentega"
          value={values.variety}
        />
      </TreeFormSection>

      <TreeFormSection
        title={dateSectionTitle}
        description={dateSectionDescription}
      >
        <View style={{ gap: spacing.sm }}>
          <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
            Tanggal Tanam
          </Text>
          <Pressable
            accessibilityLabel="Pilih tanggal tanam"
            accessibilityRole="button"
            onPress={() => setDatePickerOpen(true)}
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderCurve: 'continuous',
              borderRadius: radius.md,
              borderWidth: 1,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
            }}
          >
            <Text selectable style={{ color: values.plantedAt ? colors.text : colors.textSoft, fontSize: 16, fontWeight: '800' }}>
              {formatDateForDisplay(values.plantedAt)}
            </Text>
          </Pressable>
          {datePickerOpen ? (
            <DateTimePicker
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              mode="date"
              onDismiss={handleDateDismiss}
              onNeutralButtonPress={handleDateDismiss}
              onValueChange={handleDateValueChange}
              value={values.plantedAt ?? new Date()}
            />
          ) : null}
          <Text selectable style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19 }}>
            Kosongkan jika tanggal tanam belum diketahui.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <DateActionButton label="Gunakan hari ini" onPress={() => updateDateValue(new Date())} />
            {values.plantedAt ? <DateActionButton label="Kosongkan" muted onPress={() => updateDateValue(null)} /> : null}
          </View>
        </View>
      </TreeFormSection>
    </View>
  );
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
        description="Opsional, digunakan sebagai identitas visual pohon."
        emptyLabel="Tambah foto pohon"
        imageUri={previewUri}
        loading={disabled}
        removeLabel="Hapus Foto"
        takePhotoLabel="Ambil Foto"
        title="Foto Pohon"
        onChoosePhoto={onGalleryPress}
        onRemovePhoto={canRemove ? handleRemovePress : undefined}
        onTakePhoto={onCameraPress}
      />

      {deleteRequested && !photo ? (
        <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
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
        <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
          {title}
        </Text>
        {description ? (
          <Text selectable style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19 }}>
            {description}
          </Text>
        ) : null}
      </View>
      <View style={{ gap: spacing.md }}>{children}</View>
    </View>
  );
}

function DateActionButton({
  label,
  muted,
  onPress,
}: {
  label: string;
  muted?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: muted ? colors.surface : colors.primarySoft,
        borderColor: muted ? colors.border : colors.primaryBorder,
        borderRadius: radius.round,
        borderWidth: 1,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
      }}
    >
      <Text selectable style={{ color: muted ? colors.textMuted : colors.primary, fontSize: 13, fontWeight: '800' }}>
        {label}
      </Text>
    </Pressable>
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
            <Text selectable style={{ color: colors.text, fontSize: typography.bodyStrong.fontSize, fontWeight: '800', lineHeight: typography.bodyStrong.lineHeight }}>
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
          <Text selectable style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800', marginTop: 14 }}>
            Tutup
          </Text>
        </Pressable>
      </Modal>
    </>
  );
}

function getVisualAccent(status?: TreeConditionStatus): {
  background: string;
  border: string;
  fruit: string;
  haze: string;
  leaf: string;
} {
  if (status && status !== 'healthy') {
    return {
      background: '#FFF8E8',
      border: '#F6D77A',
      fruit: '#C49A25',
      haze: '#F6D77A',
      leaf: '#8A9A31',
    };
  }

  return {
    background: '#DCEFE3',
    border: '#B8D8BF',
    fruit: '#5C8A45',
    haze: '#B8D8BF',
    leaf: appTheme.primary,
  };
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

  // 'care' tidak punya layar detail/edit: catatan perawatan sengaja tidak
  // dapat diedit atau dihapus (lihat migrasi 027).
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

export function formatDateForDisplay(date: Date | null): string {
  if (!date) {
    return 'Pilih tanggal tanam';
  }

  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
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
