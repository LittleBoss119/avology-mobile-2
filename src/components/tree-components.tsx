import React from 'react';
import { Pressable, Text, View } from 'react-native';

import type { Tree, TreeConditionReport, TreeConditionStatus } from '../types/domain';
import { formatTreeConditionStatus, formatTreeLocation } from '../utils/treeFormat';
import { Card, EmptyState, Field, MetaRow } from './ui';

export type TreeFormValues = {
  treeCode: string;
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

export type ConditionReportListItem = Omit<TreeConditionReport, 'reportedBy'> & {
  reportedBy?: string | null;
};

export type ConditionReportItemProps = {
  report: ConditionReportListItem;
};

export type ConditionReportListProps = {
  reports: ConditionReportListItem[];
  emptyTitle?: string;
  emptySubtitle?: string;
};

export function TreeCard({ children, onPress, tree }: TreeCardProps) {
  const content = (
    <Card>
      <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: 5 }}>
          <Text selectable style={{ color: '#1E2A24', fontSize: 18, fontWeight: '700' }}>
            {tree.treeCode}
          </Text>
          <Text selectable style={{ color: '#68746D', lineHeight: 20 }}>
            {formatTreeLocation(tree)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <ConditionStatusBadge status={tree.currentCondition} />
          {tree.isArchived ? <SmallBadge label="Archived" tone="muted" /> : null}
        </View>
      </View>

      <MetaRow label="Varietas" value={tree.variety} />
      {tree.currentGrowthPhase ? (
        <MetaRow label="Fase saat ini" value={tree.currentGrowthPhase} />
      ) : null}
      {children}
    </Card>
  );

  if (!onPress) {
    return content;
  }

  return <Pressable onPress={onPress}>{content}</Pressable>;
}

export function TreeForm({ onChange, values }: TreeFormProps) {
  function updateValue(field: keyof TreeFormValues, value: string) {
    onChange({
      ...values,
      [field]: value,
    });
  }

  return (
    <View style={{ gap: 14 }}>
      <Field
        label="Kode pohon *"
        onChangeText={(value) => updateValue('treeCode', value)}
        placeholder="Contoh: P-001"
        value={values.treeCode}
      />
      <Field
        label="Baris"
        onChangeText={(value) => updateValue('rowPosition', value)}
        placeholder="Contoh: A"
        value={values.rowPosition}
      />
      <Field
        label="Kolom"
        onChangeText={(value) => updateValue('columnPosition', value)}
        placeholder="Contoh: 1"
        value={values.columnPosition}
      />
      <Field
        label="Varietas"
        onChangeText={(value) => updateValue('variety', value)}
        placeholder="Contoh: Alpukat mentega"
        value={values.variety}
      />
      <Field
        label="Tanggal tanam"
        onChangeText={(value) => updateValue('plantedAt', value)}
        placeholder="YYYY-MM-DD"
        value={values.plantedAt}
      />
    </View>
  );
}

export function ConditionStatusBadge({ status }: ConditionStatusBadgeProps) {
  const tone = getConditionTone(status);

  return <SmallBadge label={formatTreeConditionStatus(status)} tone={tone} />;
}

export function ConditionReportList({
  emptySubtitle = 'Laporan kondisi yang dibuat owner atau worker aktif akan muncul di sini.',
  emptyTitle = 'Belum ada laporan kondisi',
  reports,
}: ConditionReportListProps) {
  if (reports.length === 0) {
    return <EmptyState title={emptyTitle} subtitle={emptySubtitle} />;
  }

  return (
    <View style={{ gap: 12 }}>
      {reports.map((report) => (
        <ConditionReportItem key={report.id} report={report} />
      ))}
    </View>
  );
}

export function ConditionReportItem({ report }: ConditionReportItemProps) {
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <ConditionStatusBadge status={report.conditionStatus} />
        <Text selectable style={{ color: '#68746D', fontSize: 13 }}>
          {formatDateTime(report.reportedAt)}
        </Text>
      </View>
      <MetaRow label="Catatan" value={report.note || 'Catatan belum diisi'} />
      {report.reportedBy ? <MetaRow label="Dilaporkan oleh" value={report.reportedBy} /> : null}
    </Card>
  );
}

function SmallBadge({ label, tone }: { label: string; tone: BadgeTone }) {
  const colors = badgeColors[tone];

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: colors.background,
        borderColor: colors.border,
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 5,
      }}
    >
      <Text selectable style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>
        {label}
      </Text>
    </View>
  );
}

type BadgeTone = 'danger' | 'muted' | 'success' | 'warning';

const badgeColors: Record<BadgeTone, { background: string; border: string; text: string }> = {
  danger: {
    background: '#FEE4E2',
    border: '#FDA29B',
    text: '#B42318',
  },
  muted: {
    background: '#F2F4F7',
    border: '#D0D5DD',
    text: '#475467',
  },
  success: {
    background: '#E8F5EE',
    border: '#B7DEC9',
    text: '#2F6F4E',
  },
  warning: {
    background: '#FFF4D6',
    border: '#F6D77A',
    text: '#7A5600',
  },
};

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
