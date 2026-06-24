import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import {
  CareTaskSummaryCard,
  formatCareTarget,
} from '../../../../src/components/care-schedule-components';
import { formatCareCategory } from '../../../../src/components/care-sop-components';
import {
  Badge,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  MetaRow,
  Screen,
  TopAppBar,
} from '../../../../src/components/ui';
import { useAuth } from '../../../../src/context/auth-context';
import { getCareScheduleDetail } from '../../../../src/services/careScheduleService';
import { getFarmMemberBasicProfiles } from '../../../../src/services/memberService';
import type { CareScheduleDetail, FarmMemberBasicProfile } from '../../../../src/types/domain';

export default function CareScheduleDetailScreen() {
  const { currentFarm } = useAuth();
  const { scheduleId } = useLocalSearchParams<{ scheduleId: string }>();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [schedule, setSchedule] = React.useState<CareScheduleDetail | null>(null);
  const [workerNames, setWorkerNames] = React.useState<Record<string, string>>({});

  const farmId = currentFarm?.farmId;

  const loadDetail = React.useCallback(async () => {
    const normalizedScheduleId = scheduleId?.trim();

    if (!normalizedScheduleId) {
      setError('Data jadwal tidak ditemukan.');
      setSchedule(null);
      setWorkerNames({});
      return;
    }

    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setSchedule(null);
      setWorkerNames({});
      return;
    }

    setError(null);

    const [scheduleResult, workersResult] = await Promise.all([
      getCareScheduleDetail({ scheduleId: normalizedScheduleId }),
      getFarmMemberBasicProfiles(farmId),
    ]);

    if (scheduleResult.error) {
      setError(scheduleResult.error.message);
      setSchedule(null);
    } else {
      setSchedule(scheduleResult.data);
    }

    if (workersResult.error) {
      setWorkerNames({});
    } else {
      setWorkerNames(
        Object.fromEntries(
          workersResult.data.map((worker: FarmMemberBasicProfile) => [worker.userId, worker.fullName])
        )
      );
    }
  }, [farmId, scheduleId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadDetail().finally(() => setLoading(false));
    }, [loadDetail])
  );

  if (loading) {
    return <LoadingState message="Memuat detail jadwal..." />;
  }

  if (!schedule) {
    return (
      <Screen>
        <TopAppBar title="Detail Jadwal" onBack={() => router.back()} />
        <ErrorBanner message={error} />
        <EmptyState title="Jadwal tidak ditemukan" subtitle="Jadwal mungkin tidak tersedia atau akses ditolak." />
      </Screen>
    );
  }

  return (
    <Screen>
      <TopAppBar title="Detail Jadwal" onBack={() => router.back()} />
      <ErrorBanner message={error} />

      <Card variant="highlight">
        <View style={{ gap: 8 }}>
          <Text selectable style={{ color: '#1E2A24', fontSize: 23, fontWeight: '900', lineHeight: 29 }}>
            {schedule.title}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            <Badge label={formatScheduleStatus(schedule)} tone={getScheduleTone(schedule)} />
            <Badge label={schedule.careSopId ? 'Dari SOP' : 'Manual'} tone={schedule.careSopId ? 'warning' : 'muted'} />
          </View>
        </View>
        <View style={{ gap: 10 }}>
          <MetaRow label="Kategori" value={formatCareCategory(schedule.category)} />
          <MetaRow label="Target" value={formatCareTarget(schedule)} />
          <MetaRow label="Tanggal jadwal" value={formatDate(schedule.scheduledDate)} />
          <MetaRow label="Pekerja" value={formatScheduleWorkers(schedule, workerNames)} />
          <MetaRow label="Jumlah tugas" value={`${schedule.tasks.length} tugas`} />
        </View>
      </Card>

      <Card>
        <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '700' }}>
          Instruksi
        </Text>
        <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
          {schedule.instruction || 'Instruksi belum diisi.'}
        </Text>
      </Card>

      <Text selectable style={{ color: '#1E2A24', fontSize: 20, fontWeight: '700', paddingTop: 4 }}>
        Tugas Pekerja
      </Text>
      {schedule.tasks.length === 0 ? (
        <EmptyState title="Belum ada tugas" subtitle="Tugas dari jadwal ini belum tersedia." />
      ) : (
        <View style={{ gap: 12 }}>
          {schedule.tasks.map((task) => (
            <CareTaskSummaryCard
              key={task.id}
              task={task}
              assignedWorkerName={workerNames[task.assignedTo]}
              onPress={() => router.push(`/owner/tasks/${task.id}`)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function formatScheduleStatus(schedule: CareScheduleDetail): string {
  if (schedule.tasks.length === 0) {
    return 'Belum ada tugas';
  }

  if (schedule.tasks.every((task) => task.status === 'completed')) {
    return 'Selesai';
  }

  if (schedule.tasks.some((task) => task.status === 'postponed')) {
    return 'Tertunda';
  }

  return 'Belum selesai';
}

function getScheduleTone(schedule: CareScheduleDetail): 'danger' | 'muted' | 'success' | 'warning' {
  if (schedule.tasks.length === 0) {
    return 'muted';
  }

  if (schedule.tasks.every((task) => task.status === 'completed')) {
    return 'success';
  }

  if (schedule.tasks.some((task) => task.status === 'postponed')) {
    return 'warning';
  }

  return 'muted';
}

function formatScheduleWorkers(
  schedule: CareScheduleDetail,
  workerNames: Record<string, string>
): string {
  const names = Array.from(
    new Set(schedule.tasks.map((task) => workerNames[task.assignedTo]).filter((name): name is string => Boolean(name)))
  );

  return names.length > 0 ? names.join(', ') : 'Belum ada pekerja';
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
