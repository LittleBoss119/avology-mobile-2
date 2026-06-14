import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import {
  formatCareTarget,
  formatTaskStatus,
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
import { getTaskDetail } from '../../../../src/services/careTaskService';
import type {
  ActivityStatus,
  CareScheduleDetail,
  CareTaskDetail,
  WorkerMembership,
} from '../../../../src/types/domain';

export default function OwnerTaskDetailScreen() {
  const { currentFarm } = useAuth();
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [schedule, setSchedule] = React.useState<CareScheduleDetail | null>(null);
  const [task, setTask] = React.useState<CareTaskDetail | null>(null);
  const [workerNames, setWorkerNames] = React.useState<Record<string, string>>({});

  const farmId = currentFarm?.farmId;

  const loadDetail = React.useCallback(async () => {
    const normalizedTaskId = taskId?.trim();

    if (!normalizedTaskId) {
      setError('Data tugas tidak ditemukan.');
      setTask(null);
      setSchedule(null);
      setWorkerNames({});
      return;
    }

    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setTask(null);
      setSchedule(null);
      setWorkerNames({});
      return;
    }

    setError(null);
    setSchedule(null);

    const [taskResult, workersResult] = await Promise.all([
      getTaskDetail({ taskId: normalizedTaskId }),
      getActiveWorkers(farmId),
    ]);

    if (taskResult.error) {
      setError(taskResult.error.message);
      setTask(null);
    } else {
      setTask(taskResult.data);

      if (taskResult.data.careScheduleId) {
        const scheduleResult = await getCareScheduleDetail({
          scheduleId: taskResult.data.careScheduleId,
        });

        if (!scheduleResult.error) {
          setSchedule(scheduleResult.data);
        }
      }
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
  }, [farmId, taskId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadDetail().finally(() => setLoading(false));
    }, [loadDetail])
  );

  if (loading) {
    return <LoadingState message="Memuat detail tugas..." />;
  }

  if (!task) {
    return (
      <Screen footer={<Button title="Kembali" variant="secondary" onPress={() => router.replace('/owner/tasks')} />}>
        <PageIntro title="Detail Tugas" subtitle="Data tugas tidak dapat dimuat." />
        <ErrorBanner message={error} />
        <EmptyState title="Tugas tidak ditemukan" subtitle="Tugas mungkin tidak tersedia atau akses ditolak." />
      </Screen>
    );
  }

  return (
    <Screen footer={<Button title="Kembali ke Tugas" variant="secondary" onPress={() => router.replace('/owner/tasks')} />}>
      <PageIntro title={task.title} subtitle="Detail tugas worker dan riwayat realisasi." />
      <ErrorBanner message={error} />

      <Card>
        <MetaRow label="Judul" value={task.title} />
        <MetaRow label="Kategori" value={task.category ? formatCareCategory(task.category) : 'Tanpa kategori'} />
        <MetaRow label="Worker" value={workerNames[task.assignedTo] ?? task.assignedTo} />
        <MetaRow label="Jatuh tempo" value={task.dueDate} />
        <MetaRow label="Status" value={formatTaskStatus(task.status)} />
        <MetaRow label="Target" value={formatCareTarget(task)} />
      </Card>

      <Card>
        <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '700' }}>
          Instruksi
        </Text>
        <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
          {task.instruction || 'Instruksi belum diisi.'}
        </Text>
      </Card>

      <Card>
        <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '700' }}>
          Sumber Tugas
        </Text>
        {task.careScheduleId ? (
          <>
            <MetaRow label="Tipe sumber" value="Jadwal perawatan" />
            <MetaRow label="Judul jadwal" value={schedule?.title ?? task.careScheduleId} />
            <MetaRow label="Tanggal jadwal" value={schedule?.scheduledDate} />
            <Button
              title="Buka Jadwal"
              variant="secondary"
              onPress={() => router.push(`/owner/schedules/${task.careScheduleId}`)}
            />
          </>
        ) : (
          <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
            Tugas tidak terhubung ke jadwal perawatan.
          </Text>
        )}
      </Card>

      <Text selectable style={{ color: '#1E2A24', fontSize: 20, fontWeight: '700', paddingTop: 4 }}>
        Realisasi
      </Text>
      {task.activities.length === 0 ? (
        <EmptyState title="Belum ada realisasi" subtitle="Worker belum menyelesaikan atau menunda tugas ini." />
      ) : (
        <View style={{ gap: 12 }}>
          {task.activities.map((activity) => (
            <Card key={activity.id}>
              <MetaRow label="Status" value={formatActivityStatus(activity.status)} />
              <MetaRow label="Waktu" value={formatDateTime(activity.performedAt)} />
              <MetaRow label="Catatan" value={activity.note} />
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

function formatActivityStatus(status: ActivityStatus): string {
  const labels: Record<ActivityStatus, string> = {
    completed: 'Selesai',
    postponed: 'Ditunda',
  };

  return labels[status];
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('id-ID', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
