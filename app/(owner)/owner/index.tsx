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

  return (
    <Screen
      footer={
        <>
          <Button title="Pohon" onPress={() => router.push('/owner/trees')} />
          <Button title="Jadwal/Tugas" onPress={() => router.push('/owner/schedules')} />
          <Button title="Tugas Pekerja" variant="secondary" onPress={() => router.push('/owner/tasks')} />
          <Button title="Laporan Operasional" onPress={() => router.push('/owner/reports')} />
          <Button title="Manajemen Pekerja" onPress={() => router.push('/owner/workers')} />
          <Button title="SOP Perawatan" onPress={() => router.push('/owner/sops')} />
          <Button title="Monitoring Fase" onPress={() => router.push('/owner/growth-monitoring')} />
          <Button title="Profil" variant="secondary" onPress={() => router.push('/owner/profile')} />
        </>
      }
    >
      <PageIntro
        title="Dashboard Pemilik"
        subtitle="Ringkasan kondisi kebun dan pekerjaan yang perlu diperhatikan."
      />
      <ErrorBanner message={error} />

      <Card>
        <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '700' }}>
          Kebun aktif
        </Text>
        <MetaRow label="Nama kebun" value={currentFarm?.farm?.name} />
        <MetaRow label="Join code" value={currentFarm?.farm?.joinCode} />
      </Card>

      {isEmpty ? (
        <EmptyState
          title="Belum ada data operasional"
          subtitle="Ringkasan akan terisi setelah pohon, tugas, laporan, pekerja, atau SOP dibuat."
        />
      ) : null}

      {summary ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {stats.map((stat) => (
            <DashboardStatCard key={stat.label} stat={stat} />
          ))}
        </View>
      ) : error ? (
        <EmptyState
          title="Dashboard belum dapat ditampilkan"
          subtitle="Muat ulang halaman setelah koneksi atau akses kebun kembali tersedia."
        />
      ) : null}
    </Screen>
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
