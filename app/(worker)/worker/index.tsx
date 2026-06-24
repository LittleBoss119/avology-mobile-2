import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  appTheme,
  Badge,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  PageIntro,
  Screen,
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
      setError(result.error.message);
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
      <PageIntro title={`Halo, ${workerName}`} subtitle={farmName ?? 'Fokus pekerjaan lapangan hari ini.'} />
      <ErrorBanner message={error} />

      <WorkerHero farmName={farmName} status={formatMemberStatus(currentFarm?.status)} summary={summary} />

      {isEmpty ? (
        <EmptyState
          title="Belum ada tugas"
          subtitle="Tugas dari pemilik akan muncul di dashboard ini."
        />
      ) : null}

      <SectionTitle title="Ringkasan Tugas" />
      {summary ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {stats.map((stat) => (
            <WorkerStatCard key={stat.label} stat={stat} />
          ))}
        </View>
      ) : error ? (
        <EmptyState
          title="Dashboard belum dapat ditampilkan"
          subtitle="Buka kembali halaman ini setelah koneksi atau akses kebun tersedia."
        />
      ) : null}

      <SectionTitle title="Prioritas Berikutnya" />
      <NextTaskSummary summary={summary} />

      <SectionTitle title="Aksi Lapangan" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <DashboardActionButton label="Lihat Tugas" meta="Hari ini" onPress={() => router.push('/worker/tasks')} primary />
        <DashboardActionButton label="Lapor Kondisi" meta="Pohon" onPress={() => router.push('/worker/trees')} />
        <DashboardActionButton label="Buat Laporan" meta="Lapangan" onPress={() => router.push('/worker/reports/create')} />
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
    <View
      style={{
        backgroundColor: hasTodayTask ? appTheme.primary : appTheme.primarySoft,
        borderColor: hasTodayTask ? appTheme.primary : '#B8D8BF',
        borderRadius: 16,
        borderWidth: 1,
        gap: 14,
        padding: 18,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: 8 }}>
          <Text selectable style={{ color: hasTodayTask ? '#FFFFFF' : appTheme.text, fontSize: 20, fontWeight: '900' }}>
            Tugas Hari Ini
          </Text>
          <Text selectable style={{ color: hasTodayTask ? '#DDEFE2' : appTheme.muted, lineHeight: 21 }}>
            {hasTodayTask
              ? 'Ada pekerjaan yang perlu diprioritaskan hari ini.'
              : 'Tidak ada tugas jatuh tempo hari ini.'}
          </Text>
        </View>
        <Text selectable style={{ color: hasTodayTask ? '#FFFFFF' : appTheme.primary, fontSize: 52, fontVariant: ['tabular-nums'], fontWeight: '900' }}>
          {summary?.todayTasks ?? 0}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Badge label={farmName ?? 'Kebun aktif'} tone={hasTodayTask ? 'success' : 'muted'} />
        <Badge label={status} tone="success" />
      </View>
    </View>
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
      <Card>
        <Badge label="Hari ini" tone="warning" />
        <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '800' }}>
          {summary.todayTasks} tugas perlu dikerjakan
        </Text>
        <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
          Buka daftar tugas untuk melihat target dan instruksi pekerjaan.
        </Text>
      </Card>
    );
  }

  if (summary.unfinishedTasks > 0) {
    return (
      <Card>
        <Badge label="Belum selesai" tone="warning" />
        <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '800' }}>
          {summary.unfinishedTasks} tugas masih terbuka
        </Text>
        <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
          Cek daftar tugas untuk melanjutkan pekerjaan yang tertunda.
        </Text>
      </Card>
    );
  }

  return <EmptyState title="Belum ada tugas prioritas" subtitle="Tugas dari pemilik akan muncul saat ada pekerjaan baru." />;
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Text selectable style={{ color: '#1E2A24', fontSize: 19, fontWeight: '800', paddingTop: 4 }}>
      {title}
    </Text>
  );
}

function WorkerStatCard({ stat }: { stat: WorkerStat }) {
  const toneColor = stat.tone === 'muted' ? '#68746D' : '#2F6F4E';

  return (
    <View style={{ flexBasis: '30%', flexGrow: 1, minWidth: 100 }}>
      <Card>
        <View style={{ justifyContent: 'space-between', minHeight: 74 }}>
          <Text selectable numberOfLines={2} style={{ color: '#68746D', fontSize: 13, lineHeight: 18 }}>
            {stat.label}
          </Text>
          <Text
            selectable
            style={{
              color: toneColor,
              fontSize: 28,
              fontVariant: ['tabular-nums'],
              fontWeight: '800',
            }}
          >
            {stat.value}
          </Text>
        </View>
      </Card>
    </View>
  );
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
        backgroundColor: primary ? appTheme.primary : '#FFFFFF',
        borderColor: primary ? appTheme.primary : '#DCE7D5',
        borderRadius: 14,
        borderWidth: 1,
        flexBasis: '30%',
        flexGrow: 1,
        gap: 4,
        minHeight: 74,
        minWidth: 104,
        padding: 12,
      }}
    >
      <Text selectable style={{ color: primary ? '#DDEFE2' : '#68746D', fontSize: 12, fontWeight: '700' }}>
        {meta}
      </Text>
      <Text selectable style={{ color: primary ? '#FFFFFF' : '#1E2A24', fontSize: 14, fontWeight: '900', lineHeight: 18 }}>
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
