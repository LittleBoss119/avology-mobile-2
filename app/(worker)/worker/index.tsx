import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tokens } from '../../../src/constants/theme';
import {
  Button,
  Card,
  ErrorBanner,
  LoadingState,
  MainTabHeader,
  Screen,
  SectionHeader,
} from '../../../src/components/ui';
import { Icon } from '../../../src/components/icons';
import { useAuth } from '../../../src/context/auth-context';
import { getWorkerDashboardSummary } from '../../../src/services/dashboardService';
import type { WorkerDashboardSummary } from '../../../src/types/domain';
import { formatPersonDisplayName } from '../../../src/utils/displayFormat';

export default function WorkerDashboardScreen() {
  const { currentFarm, profile } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [summary, setSummary] = React.useState<WorkerDashboardSummary | null>(null);

  const farmId = currentFarm?.farmId;
  const userId = currentFarm?.userId;

  const loadDashboard = React.useCallback(async () => {
    if (!farmId || !userId) {
      setError('Data pekerja aktif tidak ditemukan.');
      setSummary(null);
      return;
    }

    setError(null);

    const result = await getWorkerDashboardSummary({
      farmId,
      userId,
    });

    if (result.error) {
      setError('Data beranda belum bisa dimuat.');
      setSummary(null);
      return;
    }

    setSummary(result.data);
  }, [farmId, userId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadDashboard().finally(() => setLoading(false));
    }, [loadDashboard])
  );

  if (loading) {
    return <LoadingState message="Memuat dashboard pekerja..." />;
  }

  const farmName = currentFarm?.farm?.name;
  const workerName = formatPersonDisplayName(profile?.fullName, 'Pekerja kebun');

  return (
    <Screen
      header={
        <MainTabHeader
          title="Beranda"
          roleLabel="Pekerja"
          roleTone="neutral"
          onProfilePress={() => router.push('/worker/profile')}
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
        {farmName ? `Halo, ${workerName}. Tugas kamu di ${farmName} hari ini.` : `Halo, ${workerName}. Tugas kamu hari ini.`}
      </Text>
      <ErrorBanner message={error} />

      {summary === null ? null : (
        <View style={styles.sections}>
          <TodayTaskCard summary={summary} />
          <View style={styles.section}>
            <SectionHeader title="Ringkasan kerja" />
            <WorkSummaryList summary={summary} />
          </View>
          <Button title="Buat Laporan" variant="secondary" onPress={() => router.push('/worker/reports/create')} />
        </View>
      )}
    </Screen>
  );
}

function TodayTaskCard({ summary }: { summary: WorkerDashboardSummary }) {
  const aktif = summary.todayTasks > 0;
  const caption =
    summary.todayTasks > 0
      ? 'Ketuk untuk mulai mengerjakan.'
      : summary.unfinishedTasks > 0
        ? `Masih ada ${summary.unfinishedTasks} tugas terbuka dari hari lain.`
        : 'Belum ada tugas yang perlu dikerjakan.';

  return (
    <Pressable onPress={() => router.push('/worker/tasks')}>
      <Card variant={aktif ? 'softGreen' : 'default'} style={styles.taskCard}>
        <View style={styles.cardHeader}>
          <Text selectable style={aktif ? styles.cardTitleActive : styles.cardTitleIdle}>
            Tugas hari ini
          </Text>
          <Icon
            name="chevron-right"
            size={tokens.icon.sm}
            color={aktif ? tokens.color.brand.base : tokens.color.text.tertiary}
          />
        </View>
        <Text selectable style={aktif ? styles.cardNumberActive : styles.cardNumberIdle}>
          {summary.todayTasks}
        </Text>
        <Text selectable style={styles.cardCaption}>
          {caption}
        </Text>
      </Card>
    </Pressable>
  );
}

function WorkSummaryList({ summary }: { summary: WorkerDashboardSummary }) {
  const items = [
    { key: 'unfinished', label: 'Belum selesai', value: summary.unfinishedTasks },
    { key: 'completed', label: 'Sudah selesai', value: summary.completedTasks },
  ];

  return (
    <Card padding={0} style={styles.listCard}>
      {items.map((item, index) => (
        <React.Fragment key={item.key}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <View style={styles.row}>
            <Text selectable style={styles.rowLabel}>
              {item.label}
            </Text>
            <Text selectable style={styles.rowValue}>
              {item.value}
            </Text>
          </View>
        </React.Fragment>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  sections: { gap: tokens.layout.sectionGap },
  section: { gap: tokens.space.md },

  taskCard: { gap: 0 },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: tokens.space.sm,
  },
  cardTitleActive: { ...tokens.type.label, color: tokens.color.brand.base },
  cardTitleIdle: { ...tokens.type.label, color: tokens.color.text.secondary },
  cardNumberActive: { ...tokens.type.display, color: tokens.color.brand.base },
  cardNumberIdle: { ...tokens.type.display, color: tokens.color.text.tertiary },
  cardCaption: { ...tokens.type.bodySmall, color: tokens.color.text.secondary, marginTop: tokens.space.xs },

  listCard: { gap: 0 },
  divider: {
    backgroundColor: tokens.color.line.hairline,
    height: StyleSheet.hairlineWidth,
    marginHorizontal: tokens.space.lg,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: tokens.layout.rowMinHeight,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
  },
  rowLabel: { ...tokens.type.body, color: tokens.color.text.secondary },
  rowValue: { ...tokens.type.bodyStrong, color: tokens.color.text.primary },
});
