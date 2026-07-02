import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { colors, radius, spacing } from '../../../src/constants/theme';
import {
  Card,
  ErrorBanner,
  LoadingState,
  MainTabHeader,
  Screen,
  SectionHeader,
} from '../../../src/components/ui';
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
    <Screen>
      <MainTabHeader
        title="Beranda"
        roleLabel="Pekerja"
        roleTone="neutral"
        subtitle={farmName ? `Halo, ${workerName}. Tugas kamu di ${farmName} hari ini.` : `Halo, ${workerName}. Tugas kamu hari ini.`}
        onProfilePress={() => router.push('/worker/profile')}
      />
      <ErrorBanner message={error} />

      <WorkerHero farmName={farmName} summary={summary} />

      <SectionHeader title="Fokus Kerja" />
      <TaskFocusCard summary={summary} />

      <SectionHeader title="Aksi Cepat" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <DashboardActionButton label="Lihat Tugas" meta="Hari ini" onPress={() => router.push('/worker/tasks')} primary />
        <DashboardActionButton label="Catat Kondisi" meta="Pohon" onPress={() => router.push('/worker/trees')} />
        <DashboardActionButton label="Buat Laporan" meta="Lapangan" onPress={() => router.push('/worker/reports/create')} />
      </View>
    </Screen>
  );
}
function WorkerHero({
  farmName,
  summary,
}: {
  farmName?: string;
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
              ? farmName
                ? `Kerjakan tugas di ${farmName}.`
                : 'Kerjakan tugas kebun hari ini.'
              : 'Belum ada tugas hari ini.'}
          </Text>
        </View>
        <Text selectable style={{ color: hasTodayTask ? colors.surface : colors.primary, fontSize: 52, fontVariant: ['tabular-nums'], fontWeight: '900' }}>
          {summary?.todayTasks ?? 0}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <HeroMetric
          active={hasTodayTask}
          label="Belum selesai"
          value={summary?.unfinishedTasks ?? 0}
          warning={(summary?.unfinishedTasks ?? 0) > 0}
        />
        <HeroMetric active={hasTodayTask} label="Selesai" value={summary?.completedTasks ?? 0} />
      </View>
    </Card>
  );
}

function HeroMetric({
  active,
  label,
  value,
  warning,
}: {
  active: boolean;
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: active ? 'rgba(255,255,255,0.12)' : colors.surface,
        borderColor: active ? 'rgba(255,255,255,0.25)' : colors.border,
        borderCurve: 'continuous',
        borderRadius: radius.lg,
        borderWidth: 1,
        flex: 1,
        gap: 4,
        padding: 10,
      }}
    >
      <Text selectable style={{ color: active ? colors.primarySoft : colors.textMuted, fontSize: 12, fontWeight: '700' }}>
        {label}
      </Text>
      <Text
        selectable
        style={{
          color: warning ? colors.warning : active ? colors.surface : colors.text,
          fontSize: 22,
          fontVariant: ['tabular-nums'],
          fontWeight: '900',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function TaskFocusCard({ summary }: { summary: WorkerDashboardSummary | null }) {
  if (!summary) {
    return (
      <Card>
        <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>
          Data tugas belum tersedia.
        </Text>
        <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
          Buka kembali halaman ini setelah koneksi atau akses kebun tersedia.
        </Text>
      </Card>
    );
  }

  if (summary.todayTasks > 0) {
    return (
      <Pressable onPress={() => router.push('/worker/tasks')}>
        <Card variant="warning">
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
    <Card variant="softGreen">
      <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
        Belum ada tugas hari ini.
      </Text>
      <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
        Tugas baru akan muncul saat pemilik membuat jadwal.
      </Text>
    </Card>
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
