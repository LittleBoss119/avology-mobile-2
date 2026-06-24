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
  Screen,
} from '../../../src/components/ui';
import { useAuth } from '../../../src/context/auth-context';
import { getOwnerDashboardSummary } from '../../../src/services/dashboardService';
import type { OwnerDashboardSummary } from '../../../src/types/domain';
import { formatPersonDisplayName } from '../../../src/utils/displayFormat';

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
  const healthyPercent =
    summary && summary.totalTrees > 0 ? Math.round((summary.healthyTrees / summary.totalTrees) * 100) : 0;
  const ownerName = formatPersonDisplayName(profile?.fullName, 'Pemilik kebun');

  return (
    <Screen>
      <DashboardIntro farmName={farmName} name={ownerName} roleLabel="Pemilik" />
      <ErrorBanner message={error} />

      <OwnerHero summary={summary} healthyPercent={healthyPercent} farmName={farmName} />

      {isEmpty ? (
        <EmptyState
          title="Belum ada data operasional"
          subtitle="Ringkasan akan terisi setelah pohon, tugas, laporan, pekerja, atau SOP dibuat."
        />
      ) : null}

      <SectionTitle title="Insight Kebun" />
      {summary ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {stats.map((stat) => (
            <DashboardStatCard key={stat.label} stat={stat} />
          ))}
        </View>
      ) : null}

      <SectionTitle title="Prioritas" />
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

      <SectionTitle title="Aksi Cepat" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <DashboardActionButton label="Tambah Pohon" meta="Data kebun" onPress={() => router.push('/owner/trees/create')} primary />
        <DashboardActionButton label="Buat Jadwal" meta="Perawatan" onPress={() => router.push('/owner/schedules/create')} />
        <DashboardActionButton label="Lihat Laporan" meta="Lapangan" onPress={() => router.push('/owner/reports')} />
      </View>
    </Screen>
  );
}

function DashboardIntro({
  farmName,
  name,
  roleLabel,
}: {
  farmName?: string;
  name: string;
  roleLabel: string;
}) {
  return (
    <View style={{ gap: 9, paddingTop: 8 }}>
      <Badge label={roleLabel} tone="success" />
      <View style={{ gap: 4 }}>
        <Text selectable style={{ color: '#1E2A24', fontSize: 30, fontWeight: '900', letterSpacing: 0 }}>
          Halo, {name}
        </Text>
        <Text selectable style={{ color: '#68746D', fontSize: 16, lineHeight: 23 }}>
          {farmName ? `Pantau ${farmName} dari ringkasan hari ini.` : 'Pantau kebun aktif Anda hari ini.'}
        </Text>
      </View>
    </View>
  );
}

function OwnerHero({
  farmName,
  healthyPercent,
  summary,
}: {
  farmName?: string;
  healthyPercent: number;
  summary: OwnerDashboardSummary | null;
}) {
  return (
    <View
      style={{
        backgroundColor: appTheme.primary,
        borderRadius: 16,
        gap: 18,
        overflow: 'hidden',
        padding: 18,
      }}
    >
      <View style={{ gap: 6 }}>
        <Text selectable style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '900' }}>
          Kondisi Kebun
        </Text>
        <Text selectable style={{ color: '#DDEFE2', lineHeight: 21 }}>
          {farmName
            ? `Ringkasan cepat ${farmName} berdasarkan data operasional.`
            : 'Ringkasan cepat berdasarkan data operasional kebun.'}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text selectable style={{ color: '#FFFFFF', fontSize: 52, fontVariant: ['tabular-nums'], fontWeight: '900' }}>
            {healthyPercent}%
          </Text>
          <Text selectable style={{ color: '#DDEFE2', fontSize: 15, lineHeight: 21 }}>
            pohon dalam kondisi sehat
          </Text>
        </View>
        <View style={{ justifyContent: 'center' }}>
          <Badge
            label={summary && summary.problemTrees > 0 ? 'Perlu dicek' : 'Stabil'}
            tone={summary && summary.problemTrees > 0 ? 'warning' : 'success'}
          />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <HeroMetric label="Total Pohon" value={summary?.totalTrees ?? 0} />
        <HeroMetric label="Sehat" value={summary?.healthyTrees ?? 0} />
        <HeroMetric label="Perhatian" value={summary?.problemTrees ?? 0} warning />
      </View>
    </View>
  );
}

function HeroMetric({ label, value, warning }: { label: string; value: number; warning?: boolean }) {
  return (
    <View
      style={{
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderColor: 'rgba(255,255,255,0.25)',
        borderRadius: 12,
        borderWidth: 1,
        flex: 1,
        gap: 4,
        padding: 10,
      }}
    >
      <Text selectable style={{ color: '#DDEFE2', fontSize: 12, fontWeight: '700' }}>
        {label}
      </Text>
      <Text selectable style={{ color: warning ? '#F6D77A' : '#FFFFFF', fontSize: 22, fontVariant: ['tabular-nums'], fontWeight: '900' }}>
        {value}
      </Text>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Text selectable style={{ color: '#1E2A24', fontSize: 19, fontWeight: '800', paddingTop: 4 }}>
      {title}
    </Text>
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
        <View style={{ justifyContent: 'space-between', minHeight: 76 }}>
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
      title: 'Tugas hari ini',
      description: 'Pastikan pekerjaan yang jatuh tempo hari ini siap dikerjakan.',
      tone: 'warning',
      value: summary.todayTasks,
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
