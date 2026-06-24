import React from 'react';
import { Pressable, Text, View } from 'react-native';

import type {
  GrowthPhase,
  MemberRole,
  Tree,
  TreeConditionReport,
  TreeConditionStatus,
  TreeHistoryItem,
  TreeHistoryType,
} from '../types/domain';
import { formatPersonDisplayName } from '../utils/displayFormat';
import {
  buildTreeDisplayCode,
  formatGrowthPhase,
  formatTreeDisplayCode,
} from '../utils/treeFormat';
import { appTheme, Badge, Card, EmptyState, Field, MetaRow } from './ui';

export type TreeFormValues = {
  rowPosition: string;
  columnPosition: string;
  variety: string;
  plantedAt: string;
};

export type TreeCardProps = {
  tree: Tree;
  children?: React.ReactNode;
  onPress?: () => void;
};

export type TreeFormProps = {
  values: TreeFormValues;
  onChange: (values: TreeFormValues) => void;
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
  emptyTitle?: string;
  emptySubtitle?: string;
  currentUserId?: string | null;
  viewerMode?: TreeHistoryViewerMode;
};

export type TreeHistoryTimelineProps = {
  currentUserId?: string | null;
  history: TreeHistoryItem[];
  viewerMode?: TreeHistoryViewerMode;
};

type TreeHistoryViewerMode = 'owner' | 'worker';

export function TreeCard({ children, onPress, tree }: TreeCardProps) {
  const displayCode = formatTreeDisplayCode(tree);

  const content = (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderColor: '#DCE7D5',
        borderRadius: 12,
        borderWidth: 1,
        gap: 9,
        minHeight: 178,
        padding: 9,
      }}
    >
      <TreeVisualPlaceholder condition={tree.currentCondition} size="compact">
        {tree.isArchived ? <Badge label="Arsip" tone="muted" /> : <ConditionStatusBadge status={tree.currentCondition} />}
      </TreeVisualPlaceholder>

      <View style={{ gap: 3 }}>
        <Text selectable style={{ color: appTheme.primary, fontSize: 21, fontWeight: '900' }}>
          {displayCode}
        </Text>
        <Text
          selectable
          numberOfLines={1}
          style={{ color: appTheme.text, fontSize: 14, fontWeight: '700', lineHeight: 18 }}
        >
          {tree.variety || 'Varietas belum diisi'}
        </Text>
        <Text
          selectable
          numberOfLines={1}
          style={{
            color: tree.currentGrowthPhase ? appTheme.muted : '#94A098',
            fontSize: 13,
            lineHeight: 18,
          }}
        >
          {tree.currentGrowthPhase ? formatCompactGrowthPhase(tree.currentGrowthPhase) : 'Belum dicatat'}
        </Text>
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
  size = 'regular',
}: {
  children?: React.ReactNode;
  condition?: TreeConditionStatus;
  size?: 'compact' | 'regular';
}) {
  const accent = getVisualAccent(condition);
  const isCompact = size === 'compact';

  return (
    <View
      style={{
        backgroundColor: accent.background,
        borderColor: accent.border,
        borderRadius: 12,
        borderWidth: 1,
        minHeight: isCompact ? 92 : 188,
        overflow: 'hidden',
        padding: isCompact ? 8 : 14,
      }}
    >
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
      <View style={{ alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ gap: isCompact ? 4 : 8, paddingTop: isCompact ? 16 : 42 }}>
          <View
            style={{
              backgroundColor: accent.leaf,
              borderRadius: 999,
              height: isCompact ? 26 : 52,
              transform: [{ rotate: '-22deg' }],
              width: isCompact ? 62 : 112,
            }}
          />
          <View
            style={{
              backgroundColor: accent.fruit,
              borderRadius: 999,
              height: isCompact ? 36 : 64,
              marginLeft: isCompact ? 38 : 72,
              marginTop: isCompact ? -8 : -12,
              width: isCompact ? 28 : 50,
            }}
          />
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6, zIndex: 1 }}>{children}</View>
      </View>
    </View>
  );
}

export function TreeForm({ onChange, values }: TreeFormProps) {
  const previewCode = buildTreeDisplayCode(values);

  function updateValue(field: keyof TreeFormValues, value: string) {
    onChange({
      ...values,
      [field]: value,
    });
  }

  return (
    <View style={{ gap: 14 }}>
      <MetaRow label="Kode pohon" value={previewCode ?? 'Lokasi belum lengkap'} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Field
            label="Baris"
            onChangeText={(value) => updateValue('rowPosition', value)}
            placeholder="A"
            value={values.rowPosition}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Kolom"
            onChangeText={(value) => updateValue('columnPosition', value)}
            placeholder="1"
            value={values.columnPosition}
          />
        </View>
      </View>
      <Field
        label="Varietas"
        onChangeText={(value) => updateValue('variety', value)}
        placeholder="Contoh: Alpukat mentega"
        value={values.variety}
      />
      <Field
        label="Tanggal tanam"
        onChangeText={(value) => updateValue('plantedAt', value)}
        placeholder="Contoh: 2026-06-24"
        value={values.plantedAt}
      />
      <View style={{ alignItems: 'flex-start', gap: 8 }}>
        <Text selectable style={{ color: '#68746D', fontSize: 13, lineHeight: 19 }}>
          Gunakan format tahun-bulan-tanggal. Kosongkan jika tanggal tanam belum diketahui.
        </Text>
        <Pressable
          onPress={() => updateValue('plantedAt', formatTodayDate())}
          style={{
            backgroundColor: '#E7F3EA',
            borderColor: '#B8D8BF',
            borderRadius: 999,
            borderWidth: 1,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Text selectable style={{ color: '#065F2E', fontSize: 13, fontWeight: '800' }}>
            Gunakan hari ini
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function ConditionStatusBadge({ status }: ConditionStatusBadgeProps) {
  const tone = getConditionTone(status);

  return <Badge label={formatCompactConditionStatus(status)} tone={tone} />;
}

export function GrowthPhaseBadge({ phase }: GrowthPhaseBadgeProps) {
  const tone = getGrowthPhaseTone(phase);

  return <Badge label={formatCompactGrowthPhase(phase)} tone={tone} />;
}

export function ConditionReportList({
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
  viewerMode = 'owner',
}: TreeHistoryTimelineProps) {
  if (history.length === 0) {
    return (
      <EmptyState
        title="Belum ada riwayat pohon"
        subtitle="Riwayat kondisi, fase pertumbuhan, dan aktivitas perawatan pohon akan muncul di sini."
      />
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {history.map((item) => (
        <TreeHistoryTimelineItem
          key={`${item.historyType}-${item.happenedAt}-${item.title}`}
          currentUserId={currentUserId}
          item={item}
          viewerMode={viewerMode}
        />
      ))}
    </View>
  );
}

export function ConditionReportItem({
  currentUserId,
  report,
  viewerMode = 'owner',
}: ConditionReportItemProps & {
  currentUserId?: string | null;
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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <ConditionStatusBadge status={report.conditionStatus} />
        <Text selectable style={{ color: '#68746D', fontSize: 13 }}>
          {formatDateTime(report.reportedAt)}
        </Text>
      </View>
      <MetaRow label="Catatan" value={report.note || '-'} />
      <MetaRow label="Dilaporkan oleh" value={reporterName} />
    </Card>
  );
}

function TreeHistoryTimelineItem({
  currentUserId,
  item,
  viewerMode,
}: {
  currentUserId?: string | null;
  item: TreeHistoryItem;
  viewerMode: TreeHistoryViewerMode;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View style={{ alignItems: 'center', paddingTop: 6 }}>
        <View
          style={{
            alignItems: 'center',
            backgroundColor: getTimelineDotColor(item.historyType),
            borderRadius: 999,
            height: 24,
            justifyContent: 'center',
            width: 24,
          }}
        >
          <Text selectable style={{ color: getTimelineTextColor(item.historyType), fontSize: 11, fontWeight: '900' }}>
            {getTimelineMarker(item.historyType)}
          </Text>
        </View>
        <View style={{ backgroundColor: '#DCE7D5', flex: 1, marginTop: 6, width: 1 }} />
      </View>
      <View style={{ flex: 1 }}>
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderColor: '#DCE7D5',
            borderRadius: 12,
            borderWidth: 1,
            gap: 8,
            padding: 12,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <Badge label={formatHistoryType(item.historyType)} tone={getHistoryTone(item.historyType)} />
            <Text selectable style={{ color: '#68746D', fontSize: 13 }}>
              {formatDateTime(item.happenedAt)}
            </Text>
          </View>
          <Text selectable style={{ color: '#1E2A24', fontSize: 16, fontWeight: '800', lineHeight: 22 }}>
            {formatHistoryTitle(item)}
          </Text>
          {item.description ? (
            <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
              {item.description}
            </Text>
          ) : null}
          <Text selectable style={{ color: '#68746D', fontSize: 13 }}>
            Dicatat oleh{' '}
            {formatActorDisplayName({
              actorId: item.actorId,
              actorName: item.actorName,
              actorRole: item.actorRole,
              currentUserId,
              viewerMode,
            })}
          </Text>
        </View>
      </View>
    </View>
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

  return '#E7EEF8';
}

function getTimelineTextColor(type: TreeHistoryType): string {
  if (type === 'condition') {
    return '#7A5600';
  }

  if (type === 'phase') {
    return '#065F2E';
  }

  return '#184E91';
}

function getTimelineMarker(type: TreeHistoryType): string {
  if (type === 'condition') {
    return '!';
  }

  if (type === 'phase') {
    return '+';
  }

  return '✓';
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
    return 'Pekerja kebun';
  }

  return viewerMode === 'worker' ? 'Anggota kebun' : 'Pengguna tidak tersedia';
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

  if (type === 'phase') {
    return 'success';
  }

  return 'muted';
}

function formatHistoryType(type: TreeHistoryType): string {
  if (type === 'condition') {
    return 'Kondisi';
  }

  if (type === 'phase') {
    return 'Fase';
  }

  return 'Perawatan';
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

function formatCompactConditionStatus(status: TreeConditionStatus): string {
  const labels: Record<TreeConditionStatus, string> = {
    damaged: 'Rusak',
    dead: 'Mati',
    disease_indicated: 'Penyakit',
    healthy: 'Sehat',
    needs_attention: 'Perlu dicek',
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

function formatTodayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
