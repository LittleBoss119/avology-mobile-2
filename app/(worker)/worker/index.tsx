import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

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

type Shortcut = {
  title: string;
  subtitle: string;
  onPress: () => void;
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
  const isEmpty = summary ? stats.every((stat) => stat.value === 0) : false;

  return (
    <Screen
      footer={
        <>
          <Button title="Profil" variant="secondary" onPress={() => router.push('/worker/profile')} />
        </>
      }
    >
      <PageIntro title="Dashboard Pekerja" subtitle="Tugas dan laporan lapangan." />
      <ErrorBanner message={error} />

      <Card>
        <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '700' }}>
          Kebun aktif
        </Text>
        <MetaRow label="Nama kebun" value={currentFarm?.farm?.name} />
        <MetaRow label="Status" value={formatMemberStatus(currentFarm?.status)} />
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
          subtitle="Muat ulang halaman setelah koneksi atau akses kebun kembali tersedia."
        />
      ) : null}

      <View style={{ gap: 10 }}>
        {buildShortcuts().map((shortcut) => (
          <ShortcutCard key={shortcut.title} shortcut={shortcut} />
        ))}
      </View>
    </Screen>
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

function ShortcutCard({ shortcut }: { shortcut: Shortcut }) {
  return (
    <Pressable
      onPress={shortcut.onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? '#EEF3EA' : '#FFFFFF',
        borderColor: '#DDE4DA',
        borderCurve: 'continuous',
        borderRadius: 8,
        borderWidth: 1,
        gap: 5,
        minHeight: 72,
        justifyContent: 'center',
        padding: 16,
      })}
    >
      <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '800' }}>
        {shortcut.title}
      </Text>
      <Text selectable style={{ color: '#68746D', lineHeight: 20 }}>
        {shortcut.subtitle}
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

function buildShortcuts(): Shortcut[] {
  return [
    {
      title: 'Lihat Tugas',
      subtitle: 'Buka daftar tugas.',
      onPress: () => router.push('/worker/tasks'),
    },
    {
      title: 'Catat Kondisi Pohon',
      subtitle: 'Pilih pohon lalu catat kondisi.',
      onPress: () => router.push('/worker/trees'),
    },
    {
      title: 'Catat Fase Pertumbuhan',
      subtitle: 'Pilih pohon lalu catat fase.',
      onPress: () => router.push('/worker/trees'),
    },
    {
      title: 'Buat Laporan Operasional',
      subtitle: 'Laporkan kejadian lapangan.',
      onPress: () => router.push('/worker/reports/create'),
    },
    {
      title: 'Lihat Pohon',
      subtitle: 'Buka daftar pohon.',
      onPress: () => router.push('/worker/trees'),
    },
  ];
}
