import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  MetaRow,
  PageIntro,
  Screen,
} from '../../../src/components/ui';
import { useAuth } from '../../../src/context/auth-context';
import { getOwnerDashboardSummary } from '../../../src/services/dashboardService';
import type { OwnerDashboardSummary } from '../../../src/types/domain';

type DashboardStat = {
  label: string;
  value: number;
  tone?: 'danger' | 'muted' | 'primary';
};

type PriorityInsight = {
  title: string;
  description: string;
  value: number;
  tone?: 'danger' | 'warning';
};

export default function OwnerDashboardScreen() {
  const { currentFarm } = useAuth();
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
      setError(result.error.message);
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

  const stats = summary ? buildStats(summary) : [];
  const isEmpty = summary ? stats.every((stat) => stat.value === 0) : false;
  const priorities = summary ? buildPriorities(summary) : [];
  const farmName = currentFarm?.farm?.name;

  return (
    <Screen>
      <PageIntro
        title="Dashboard Pemilik"
        subtitle={
          farmName
            ? `Pantau kondisi ${farmName} dan pekerjaan yang perlu diperhatikan hari ini.`
            : 'Pantau kondisi kebun dan pekerjaan yang perlu diperhatikan hari ini.'
        }
      />
      <ErrorBanner message={error} />

      <Card>
        <View style={{ gap: 8 }}>
          <Text selectable style={{ color: '#1E2A24', fontSize: 18, fontWeight: '800' }}>
            Kondisi Pohon
          </Text>
          <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
            {summary && summary.problemTrees > 0
              ? 'Ada pohon yang perlu diperiksa lebih lanjut.'
              : 'Kondisi pohon terlihat stabil.'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <MiniMetric label="Total" value={summary?.totalTrees ?? 0} />
          <MiniMetric label="Sehat" value={summary?.healthyTrees ?? 0} tone="primary" />
          <MiniMetric
            label="Bermasalah"
            value={summary?.problemTrees ?? 0}
            tone={summary && summary.problemTrees > 0 ? 'danger' : 'muted'}
          />
        </View>
        <MetaRow label="Kebun" value={farmName} />
        {currentFarm?.farm?.joinCode ? (
          <Text selectable style={{ color: '#68746D', fontSize: 12, lineHeight: 18 }}>
            Kode gabung: {currentFarm.farm.joinCode}
          </Text>
        ) : null}
      </Card>

      {isEmpty ? (
        <EmptyState
          title="Belum ada data operasional"
          subtitle="Ringkasan akan terisi setelah pohon, tugas, laporan, pekerja, atau SOP dibuat."
        />
      ) : null}

      <SectionTitle title="Perlu Perhatian" />
      {priorities.length > 0 ? (
        <View style={{ gap: 10 }}>
          {priorities.map((priority) => (
            <PriorityCard key={priority.title} priority={priority} />
          ))}
        </View>
      ) : summary ? (
        <EmptyState title="Belum ada hal mendesak hari ini" subtitle="Pantau kembali setelah ada laporan, tugas, atau kondisi pohon baru." />
      ) : error ? (
        <EmptyState
          title="Dashboard belum dapat ditampilkan"
          subtitle="Buka kembali halaman ini setelah koneksi atau akses kebun tersedia."
        />
      ) : null}

      <SectionTitle title="Monitoring Kebun" />
      {summary ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {buildMonitoringStats(summary).map((stat) => (
            <DashboardStatCard key={stat.label} stat={stat} />
          ))}
        </View>
      ) : null}

      <SectionTitle title="Aksi Cepat" />
      <View style={{ gap: 10 }}>
        <Button title="Tambah Pohon" onPress={() => router.push('/owner/trees/create')} />
        <Button title="Buat Jadwal" variant="secondary" onPress={() => router.push('/owner/schedules/create')} />
        <Button title="Lihat Laporan" variant="secondary" onPress={() => router.push('/owner/reports')} />
      </View>
    </Screen>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Text selectable style={{ color: '#1E2A24', fontSize: 19, fontWeight: '800', paddingTop: 4 }}>
      {title}
    </Text>
  );
}

function MiniMetric({ label, tone = 'muted', value }: DashboardStat) {
  const toneColor = tone === 'danger' ? '#B42318' : tone === 'primary' ? '#2F6F4E' : '#68746D';

  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text selectable style={{ color: toneColor, fontSize: 22, fontVariant: ['tabular-nums'], fontWeight: '900' }}>
        {value}
      </Text>
      <Text selectable style={{ color: '#68746D', fontSize: 12, fontWeight: '700' }}>
        {label}
      </Text>
    </View>
  );
}

function PriorityCard({ priority }: { priority: PriorityInsight }) {
  const toneColor = priority.tone === 'danger' ? '#B42318' : '#7A5600';

  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: 5 }}>
          <Text selectable style={{ color: '#1E2A24', fontSize: 16, fontWeight: '800' }}>
            {priority.title}
          </Text>
          <Text selectable style={{ color: '#68746D', lineHeight: 20 }}>
            {priority.description}
          </Text>
        </View>
        <Text selectable style={{ color: toneColor, fontSize: 24, fontVariant: ['tabular-nums'], fontWeight: '900' }}>
          {priority.value}
        </Text>
      </View>
    </Card>
  );
}

function DashboardStatCard({ stat }: { stat: DashboardStat }) {
  const toneColor =
    stat.tone === 'danger' ? '#B42318' : stat.tone === 'muted' ? '#68746D' : '#2F6F4E';

  return (
    <View style={{ flexBasis: '47%', flexGrow: 1, minWidth: 140 }}>
      <Card>
        <Text selectable style={{ color: '#68746D', fontSize: 13, lineHeight: 18 }}>
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
      </Card>
    </View>
  );
}

function buildStats(summary: OwnerDashboardSummary): DashboardStat[] {
  return [
    { label: 'Total Pohon', value: summary.totalTrees },
    { label: 'Pohon Sehat', value: summary.healthyTrees },
    { label: 'Pohon Bermasalah', tone: summary.problemTrees > 0 ? 'danger' : 'muted', value: summary.problemTrees },
    { label: 'Tugas Hari Ini', value: summary.todayTasks },
    {
      label: 'Tugas Belum Selesai',
      tone: summary.unfinishedTasks > 0 ? 'danger' : 'muted',
      value: summary.unfinishedTasks,
    },
    {
      label: 'Laporan Operasional Baru',
      tone: summary.newOperationalReports > 0 ? 'danger' : 'muted',
      value: summary.newOperationalReports,
    },
    {
      label: 'Pengajuan Pekerja Menunggu',
      tone: summary.pendingWorkers > 0 ? 'danger' : 'muted',
      value: summary.pendingWorkers,
    },
    { label: 'Pohon Berbunga', value: summary.floweringTrees },
    { label: 'Pohon Berbuah', value: summary.fruitingTrees },
    {
      label: 'SOP Jatuh Tempo/Terlambat',
      tone: summary.dueOrOverdueSops > 0 ? 'danger' : 'muted',
      value: summary.dueOrOverdueSops,
    },
  ];
}

function buildMonitoringStats(summary: OwnerDashboardSummary): DashboardStat[] {
  return [
    { label: 'Pohon Berbunga', value: summary.floweringTrees },
    { label: 'Pohon Berbuah', value: summary.fruitingTrees },
    { label: 'Tugas Hari Ini', value: summary.todayTasks },
  ];
}

function buildPriorities(summary: OwnerDashboardSummary): PriorityInsight[] {
  const priorities: PriorityInsight[] = [
    {
      title: 'Pohon perlu perhatian',
      description: 'Cek kondisi pohon yang tidak sehat.',
      tone: 'danger',
      value: summary.problemTrees,
    },
    {
      title: 'Tugas belum selesai',
      description: 'Pantau pekerjaan perawatan yang masih terbuka.',
      tone: 'danger',
      value: summary.unfinishedTasks,
    },
    {
      title: 'Laporan operasional baru',
      description: 'Tinjau laporan lapangan dari pekerja.',
      tone: 'danger',
      value: summary.newOperationalReports,
    },
    {
      title: 'Pengajuan pekerja',
      description: 'Ada pengajuan akses yang menunggu keputusan.',
      tone: 'warning',
      value: summary.pendingWorkers,
    },
    {
      title: 'SOP jatuh tempo',
      description: 'Jadwal perawatan perlu dibuat atau ditindaklanjuti.',
      tone: 'warning',
      value: summary.dueOrOverdueSops,
    },
  ];

  return priorities.filter((priority) => priority.value > 0);
}
