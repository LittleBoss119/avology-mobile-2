import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tokens } from '../../../src/constants/theme';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  MainTabHeader,
  Screen,
  SectionHeader,
} from '../../../src/components/ui';
import { Icon } from '../../../src/components/icons';
import { useAuth } from '../../../src/context/auth-context';
import { getOwnerDashboardSummary } from '../../../src/services/dashboardService';
import type { OwnerDashboardSummary } from '../../../src/types/domain';
import { formatPersonDisplayName } from '../../../src/utils/displayFormat';

type ActionRowItem = {
  key: string;
  title: string;
  subtitle?: string;
  value: number;
  valueColor: string;
  route: string;
};

export default function OwnerDashboardScreen() {
  const { currentFarm, profile } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [summary, setSummary] = React.useState<OwnerDashboardSummary | null>(null);

  const farmId = currentFarm?.farmId;

  const loadDashboard = React.useCallback(async () => {
    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setSummary(null);
      return;
    }

    setError(null);

    const result = await getOwnerDashboardSummary({ farmId });

    if (result.error) {
      setError('Data beranda belum bisa dimuat.');
      setSummary(null);
      return;
    }

    setSummary(result.data);
  }, [farmId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadDashboard().finally(() => setLoading(false));
    }, [loadDashboard])
  );

  if (loading) {
    return <LoadingState message="Memuat dashboard pemilik..." />;
  }

  const farmName = currentFarm?.farm?.name;
  const ownerName = formatPersonDisplayName(profile?.fullName, 'Pemilik kebun');

  return (
    <Screen
      header={
        <MainTabHeader
          title="Beranda"
          roleLabel="Pemilik"
          onProfilePress={() => router.push('/owner/profile')}
        />
      }
    >
      <Text
        selectable
        style={{
          color: tokens.color.text.tertiary,
          fontSize: tokens.type.body.fontSize,
          lineHeight: tokens.type.body.lineHeight,
        }}
      >
        {farmName ? `Halo, ${ownerName}. Pantau ${farmName} hari ini.` : `Halo, ${ownerName}. Pantau kebun hari ini.`}
      </Text>
      <ErrorBanner message={error} />

      {summary === null ? null : summary.totalTrees === 0 ? (
        <View style={styles.emptyGroup}>
          <EmptyState
            title="Belum ada pohon di kebun ini"
            subtitle="Tambahkan pohon pertama untuk mulai memantau kondisi kebun."
          />
          <Button title="Tambah Pohon" onPress={() => router.push('/owner/trees/create')} />
        </View>
      ) : (
        <View style={styles.sections}>
          <TreeConditionCard summary={summary} />
          <View style={styles.section}>
            <SectionHeader title="Perlu tindakan" />
            <ActionList summary={summary} />
          </View>
          <View style={styles.section}>
            <SectionHeader title="Pantauan" />
            <MonitorList summary={summary} />
          </View>
        </View>
      )}
    </Screen>
  );
}

function TreeConditionCard({ summary }: { summary: OwnerDashboardSummary }) {
  return (
    <Pressable onPress={() => router.push('/owner/trees')}>
      <Card padding={tokens.layout.cardPadding}>
        <View style={styles.treeCardHeader}>
          <Text selectable style={styles.treeCardTitle}>
            Kondisi pohon
          </Text>
          <Icon name="chevron-right" size={tokens.icon.sm} color={tokens.color.text.tertiary} />
        </View>
        <View style={styles.treeCardMetrics}>
          <TreeMetric label="Total" value={summary.totalTrees} color={tokens.color.text.primary} />
          <TreeMetric label="Sehat" value={summary.healthyTrees} color={tokens.color.status.success.text} />
          <TreeMetric
            label="Perhatian"
            value={summary.problemTrees}
            color={summary.problemTrees > 0 ? tokens.color.status.warning.text : tokens.color.text.primary}
          />
        </View>
      </Card>
    </Pressable>
  );
}

function TreeMetric({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <View style={styles.treeMetricCol}>
      <Text selectable style={[styles.treeMetricValue, { color }]}>
        {value}
      </Text>
      <Text selectable style={styles.treeMetricLabel}>
        {label}
      </Text>
    </View>
  );
}

function ActionList({ summary }: { summary: OwnerDashboardSummary }) {
  const rows = buildActionRows(summary);

  return (
    <Card padding={0} style={styles.listCard}>
      {rows.length > 0 ? (
        rows.map((row, index) => (
          <React.Fragment key={row.key}>
            {index > 0 ? <View style={styles.divider} /> : null}
            <ActionRow row={row} />
          </React.Fragment>
        ))
      ) : (
        <View style={styles.emptyRow}>
          <Text selectable style={styles.emptyRowText}>
            Tidak ada yang perlu ditindaklanjuti
          </Text>
        </View>
      )}
    </Card>
  );
}

function ActionRow({ row }: { row: ActionRowItem }) {
  return (
    <Pressable onPress={() => router.push(row.route)} style={styles.row}>
      <View style={styles.rowMain}>
        <Text selectable style={styles.rowTitle}>
          {row.title}
        </Text>
        {row.subtitle ? (
          <Text selectable style={styles.rowSubtitle}>
            {row.subtitle}
          </Text>
        ) : null}
      </View>
      <Text selectable style={[styles.rowValue, { color: row.valueColor }]}>
        {row.value}
      </Text>
      <Icon name="chevron-right" size={tokens.icon.sm} color={tokens.color.text.tertiary} />
    </Pressable>
  );
}

function MonitorList({ summary }: { summary: OwnerDashboardSummary }) {
  const items = [
    { key: 'flowering', label: 'Pohon berbunga', value: summary.floweringTrees },
    { key: 'fruiting', label: 'Pohon berbuah', value: summary.fruitingTrees },
    { key: 'today', label: 'Tugas hari ini', value: summary.todayTasks },
  ];

  return (
    <Card padding={0} style={styles.listCard}>
      {items.map((item, index) => (
        <React.Fragment key={item.key}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <View style={styles.row}>
            <Text selectable style={styles.monitorLabel}>
              {item.label}
            </Text>
            <Text selectable style={styles.monitorValue}>
              {item.value}
            </Text>
          </View>
        </React.Fragment>
      ))}
    </Card>
  );
}

function buildActionRows(summary: OwnerDashboardSummary): ActionRowItem[] {
  const rows: ActionRowItem[] = [];

  if (summary.unfinishedTasks > 0) {
    rows.push({
      key: 'unfinished',
      title: 'Tugas belum selesai',
      subtitle: summary.overdueTasks > 0 ? `${summary.overdueTasks} sudah lewat tenggat` : undefined,
      value: summary.unfinishedTasks,
      valueColor: tokens.color.text.primary,
      route: '/owner/schedules',
    });
  }

  if (summary.pendingWorkers > 0) {
    rows.push({
      key: 'workers',
      title: 'Pengajuan pekerja',
      value: summary.pendingWorkers,
      valueColor: tokens.color.status.warning.text,
      route: '/owner/farm',
    });
  }

  if (summary.newOperationalReports > 0) {
    rows.push({
      key: 'reports',
      title: 'Laporan belum ditinjau',
      value: summary.newOperationalReports,
      valueColor: tokens.color.text.primary,
      route: '/owner/reports',
    });
  }

  return rows;
}

const styles = StyleSheet.create({
  emptyGroup: { gap: tokens.space.lg },
  sections: { gap: tokens.layout.sectionGap },
  section: { gap: tokens.space.md },

  treeCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  treeCardTitle: { ...tokens.type.label, color: tokens.color.text.secondary },
  treeCardMetrics: { flexDirection: 'row', gap: tokens.space.md },
  treeMetricCol: { flex: 1 },
  treeMetricValue: { ...tokens.type.title, lineHeight: tokens.type.title.lineHeight },
  treeMetricLabel: { ...tokens.type.meta, color: tokens.color.text.secondary, marginTop: tokens.space.xs },

  listCard: { gap: 0 },
  divider: {
    backgroundColor: tokens.color.line.hairline,
    height: StyleSheet.hairlineWidth,
    marginHorizontal: tokens.space.lg,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.space.md,
    minHeight: tokens.layout.rowMinHeight,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
  },
  rowMain: { flex: 1 },
  rowTitle: { ...tokens.type.body, color: tokens.color.text.primary },
  rowSubtitle: { ...tokens.type.meta, color: tokens.color.status.danger.text },
  rowValue: { ...tokens.type.subheading },
  emptyRow: {
    justifyContent: 'center',
    minHeight: tokens.layout.rowMinHeight,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
  },
  emptyRowText: { ...tokens.type.body, color: tokens.color.text.secondary },
  monitorLabel: { ...tokens.type.body, color: tokens.color.text.secondary, flex: 1 },
  monitorValue: { ...tokens.type.bodyStrong, color: tokens.color.text.primary },
});
