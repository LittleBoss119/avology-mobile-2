import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { colors, radius, spacing } from '../../../src/constants/theme';
import {
  Badge,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  MainTabHeader,
  MetricCard,
  Screen,
  SectionHeader,
} from '../../../src/components/ui';
import { useAuth } from '../../../src/context/auth-context';
import { getWorkerDashboardSummary } from '../../../src/services/dashboardService';
import type { WorkerDashboardSummary } from '../../../src/types/domain';
import { formatMemberStatus, formatPersonDisplayName } from '../../../src/utils/displayFormat';

type WorkerStat = {
  label: string;
  value: number;
  tone?: 'muted' | 'primary';
};

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

  const stats = summary ? buildStats(summary) : [];
  const isEmpty = summary
    ? summary.todayTasks === 0 && summary.unfinishedTasks === 0 && summary.completedTasks === 0
    : false;
  const farmName = currentFarm?.farm?.name;
  const workerName = formatPersonDisplayName(profile?.fullName, 'Pekerja kebun');

  return (
    <Screen>
      <MainTabHeader
        title="Beranda"
        roleLabel="Pekerja"
        roleTone="neutral"
        subtitle={farmName ? `Halo, ${workerName}. Tugas kamu di ${farmName} hari ini.` : `Halo, ${workerName}. Tugas kamu hari ini.`}
        onProfilePress={() => router.push('/worker/profile')}
      />
      <ErrorBanner message={error} />

      <WorkerHero farmName={farmName} status={formatMemberStatus(currentFarm?.status)} summary={summary} />

      {isEmpty ? (
        <EmptyState
          title="Tidak ada tugas hari ini"
          subtitle="Tugas baru akan muncul jika pemilik membuat jadwal."
        />
      ) : null}

      <SectionHeader title="Ringkasan Tugas" description="Ringkasan tugas yang tersedia dari data saat ini." />
      {summary ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {stats.map((stat) => (
            <WorkerStatCard key={stat.label} stat={stat} />
          ))}
        </View>
      ) : error ? (
        <EmptyState
          title="Data beranda belum bisa dimuat"
          subtitle="Buka kembali halaman ini setelah koneksi atau akses kebun tersedia."
        />
      ) : null}

      <SectionHeader title="Prioritas Tugas" />
      <NextTaskSummary summary={summary} />

      <SectionHeader title="Laporan Terakhir" />
      <Pressable onPress={() => router.push('/worker/reports')}>
        <Card>
          <Badge label="Laporan" tone="info" />
          <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
            Pantau laporan operasional kamu
          </Text>
          <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
            Detail laporan terakhir belum tersedia di ringkasan beranda. Buka daftar laporan untuk melihat status terbaru.
          </Text>
        </Card>
      </Pressable>

      <SectionHeader title="Aksi Cepat" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <DashboardActionButton label="Lihat Tugas" meta="Hari ini" onPress={() => router.push('/worker/tasks')} primary />
        <DashboardActionButton label="Buat Laporan" meta="Lapangan" onPress={() => router.push('/worker/reports/create')} />
        <DashboardActionButton label="Lihat Pohon" meta="Pohon" onPress={() => router.push('/worker/trees')} />
      </View>
    </Screen>
  );
}

function WorkerHero({
  farmName,
  status,
  summary,
}: {
  farmName?: string;
  status: string;
  summary: WorkerDashboardSummary | null;
}) {
  const hasTodayTask = Boolean(summary && summary.todayTasks > 0);

  return (
    <Card variant={hasTodayTask ? 'heroGreen' : 'softGreen'}>
      <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: 8 }}>
          <Text selectable style={{ color: hasTodayTask ? colors.surface : colors.text, fontSize: 20, fontWeight: '900' }}>
            Tugas Hari Ini
          </Text>
          <Text selectable style={{ color: hasTodayTask ? colors.primarySoft : colors.textMuted, lineHeight: 21 }}>
            {hasTodayTask
              ? 'Ada pekerjaan yang perlu diprioritaskan hari ini.'
              : 'Tidak ada tugas jatuh tempo hari ini.'}
          </Text>
        </View>
        <Text selectable style={{ color: hasTodayTask ? colors.surface : colors.primary, fontSize: 52, fontVariant: ['tabular-nums'], fontWeight: '900' }}>
          {summary?.todayTasks ?? 0}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Badge label={farmName ?? 'Kebun aktif'} tone={hasTodayTask ? 'success' : 'muted'} />
        <Badge label={status} tone="success" />
        <Badge label={`${summary?.unfinishedTasks ?? 0} belum`} tone={(summary?.unfinishedTasks ?? 0) > 0 ? 'warning' : 'muted'} />
        <Badge label={`${summary?.completedTasks ?? 0} selesai`} tone={(summary?.completedTasks ?? 0) > 0 ? 'success' : 'muted'} />
      </View>
    </Card>
  );
}

function NextTaskSummary({ summary }: { summary: WorkerDashboardSummary | null }) {
  if (!summary) {
    return (
      <EmptyState
        title="Prioritas belum dapat ditampilkan"
        subtitle="Buka kembali halaman ini setelah koneksi atau akses kebun tersedia."
      />
    );
  }

  if (summary.todayTasks > 0) {
    return (
      <Pressable onPress={() => router.push('/worker/tasks')}>
        <Card variant="warning">
          <Badge label="Hari ini" tone="warning" />
          <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
            {summary.todayTasks} tugas perlu dikerjakan
          </Text>
          <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
            Buka daftar tugas untuk melihat target dan instruksi pekerjaan.
          </Text>
        </Card>
      </Pressable>
    );
  }

  if (summary.unfinishedTasks > 0) {
    return (
      <Pressable onPress={() => router.push('/worker/tasks')}>
        <Card variant="warning">
          <Badge label="Belum" tone="warning" />
          <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
            {summary.unfinishedTasks} tugas masih terbuka
          </Text>
          <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
            Cek daftar tugas untuk melanjutkan pekerjaan yang tertunda.
          </Text>
        </Card>
      </Pressable>
    );
  }

  return (
    <EmptyState
      title="Tidak ada tugas hari ini"
      subtitle="Tugas baru akan muncul jika pemilik membuat jadwal."
    />
  );
}

function WorkerStatCard({ stat }: { stat: WorkerStat }) {
  const tone = stat.tone === 'muted' ? 'muted' : 'primary';

  return <MetricCard label={stat.label} tone={tone} value={stat.value} />;
}

function DashboardActionButton({
  label,
  meta,
  onPress,
  primary,
}: {
  label: string;
  meta: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: primary ? colors.primary : colors.surface,
        borderColor: primary ? colors.primary : colors.border,
        borderCurve: 'continuous',
        borderRadius: radius.lg,
        borderWidth: 1,
        flexBasis: '30%',
        flexGrow: 1,
        gap: spacing.xs,
        minHeight: 74,
        minWidth: 104,
        padding: spacing.md,
      }}
    >
      <Text selectable style={{ color: primary ? colors.primarySoft : colors.textMuted, fontSize: 12, fontWeight: '700' }}>
        {meta}
      </Text>
      <Text selectable style={{ color: primary ? colors.surface : colors.text, fontSize: 14, fontWeight: '900', lineHeight: 18 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function buildStats(summary: WorkerDashboardSummary): WorkerStat[] {
  return [
    { label: 'Tugas Hari Ini', value: summary.todayTasks },
    { label: 'Tugas Belum Selesai', value: summary.unfinishedTasks },
    { label: 'Tugas Selesai', tone: summary.completedTasks === 0 ? 'muted' : 'primary', value: summary.completedTasks },
  ];
}
