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
import { getWorkerDashboardSummary } from '../../../src/services/dashboardService';
import type { WorkerDashboardSummary } from '../../../src/types/domain';
import { formatMemberStatus } from '../../../src/utils/displayFormat';

type WorkerStat = {
  label: string;
  value: number;
  tone?: 'muted' | 'primary';
};

export default function WorkerDashboardScreen() {
  const { currentFarm } = useAuth();
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

  return (
    <Screen>
      <PageIntro
        title="Dashboard Pekerja"
        subtitle={
          farmName
            ? `Fokus tugas hari ini dan laporan lapangan di ${farmName}.`
            : 'Fokus tugas hari ini dan laporan lapangan.'
        }
      />
      <ErrorBanner message={error} />

      <Card>
        <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
          <View style={{ flex: 1, gap: 8 }}>
            <Text selectable style={{ color: '#1E2A24', fontSize: 18, fontWeight: '800' }}>
              Tugas Hari Ini
            </Text>
            <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
              {summary && summary.todayTasks > 0
                ? 'Ada tugas yang perlu dikerjakan hari ini.'
                : 'Tidak ada tugas jatuh tempo hari ini.'}
            </Text>
          </View>
          <Text selectable style={{ color: '#2F6F4E', fontSize: 40, fontVariant: ['tabular-nums'], fontWeight: '900' }}>
            {summary?.todayTasks ?? 0}
          </Text>
        </View>
        <MetaRow label="Kebun" value={farmName} />
        <MetaRow label="Status akses" value={formatMemberStatus(currentFarm?.status)} />
      </Card>

      {isEmpty ? (
        <EmptyState
          title="Belum ada tugas"
          subtitle="Tugas dari pemilik akan muncul di dashboard ini."
        />
      ) : null}

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

      <SectionTitle title="Pekerjaan Hari Ini" />
      {summary && summary.todayTasks > 0 ? (
        <Card>
          <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '800' }}>
            {summary.todayTasks} tugas menunggu dikerjakan
          </Text>
          <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
            Buka daftar tugas untuk melihat detail target, tanggal, dan status pekerjaan.
          </Text>
        </Card>
      ) : (
        <EmptyState title="Belum ada tugas hari ini" subtitle="Tugas dari pemilik akan muncul saat ada pekerjaan baru." />
      )}

      <SectionTitle title="Aksi Lapangan" />
      <View style={{ gap: 10 }}>
        <Button title="Lihat Tugas" onPress={() => router.push('/worker/tasks')} />
        <Button title="Laporkan Kondisi Pohon" variant="secondary" onPress={() => router.push('/worker/trees')} />
        <Button title="Buat Laporan Operasional" variant="secondary" onPress={() => router.push('/worker/reports/create')} />
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

function WorkerStatCard({ stat }: { stat: WorkerStat }) {
  const toneColor = stat.tone === 'muted' ? '#68746D' : '#2F6F4E';

  return (
    <View style={{ flexBasis: '30%', flexGrow: 1, minWidth: 100 }}>
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

function buildStats(summary: WorkerDashboardSummary): WorkerStat[] {
  return [
    { label: 'Tugas Belum Selesai', value: summary.unfinishedTasks },
    { label: 'Tugas Selesai', tone: summary.completedTasks === 0 ? 'muted' : 'primary', value: summary.completedTasks },
  ];
}
