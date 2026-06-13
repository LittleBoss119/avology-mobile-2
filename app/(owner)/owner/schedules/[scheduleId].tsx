import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import {
  CareTaskSummaryCard,
  formatCareTarget,
} from '../../../../src/components/care-schedule-components';
import { formatCareCategory } from '../../../../src/components/care-sop-components';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  MetaRow,
  PageIntro,
  Screen,
} from '../../../../src/components/ui';
import { useAuth } from '../../../../src/context/auth-context';
import { getCareScheduleDetail } from '../../../../src/services/careScheduleService';
import { getActiveWorkers } from '../../../../src/services/memberService';
import type { CareScheduleDetail, WorkerMembership } from '../../../../src/types/domain';

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
      setError('Schedule ID tidak ditemukan.');
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
      getActiveWorkers(farmId),
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
          workersResult.data.map((worker: WorkerMembership) => [worker.userId, worker.fullName])
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
      <Screen footer={<Button title="Kembali" variant="secondary" onPress={() => router.replace('/owner/schedules')} />}>
        <PageIntro title="Detail Jadwal" subtitle="Data jadwal tidak dapat dimuat." />
        <ErrorBanner message={error} />
        <EmptyState title="Jadwal tidak ditemukan" subtitle="Jadwal mungkin tidak tersedia atau akses ditolak." />
      </Screen>
    );
  }

  return (
    <Screen footer={<Button title="Kembali ke Jadwal" variant="secondary" onPress={() => router.replace('/owner/schedules')} />}>
      <PageIntro title={schedule.title} subtitle="Detail jadwal perawatan dan tugas worker yang dihasilkan." />
      <ErrorBanner message={error} />

      <Card>
        <MetaRow label="Judul" value={schedule.title} />
        <MetaRow label="Kategori" value={formatCareCategory(schedule.category)} />
        <MetaRow label="Tanggal jadwal" value={schedule.scheduledDate} />
        <MetaRow label="Target" value={formatCareTarget(schedule)} />
        <MetaRow label="Tipe jadwal" value={schedule.careSopId ? 'Dari SOP' : 'Manual'} />
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
        Tugas Worker
      </Text>
      {schedule.tasks.length === 0 ? (
        <EmptyState title="Belum ada tugas" subtitle="Task dari jadwal ini belum tersedia." />
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
