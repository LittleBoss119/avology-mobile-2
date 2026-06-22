import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import {
  CareTaskSummaryCard,
  formatTaskStatus,
} from '../../../../src/components/care-schedule-components';
import {
  Button,
  EmptyState,
  ErrorBanner,
  LoadingState,
  PageIntro,
  Screen,
} from '../../../../src/components/ui';
import { useAuth } from '../../../../src/context/auth-context';
import { getFarmMemberBasicProfiles } from '../../../../src/services/memberService';
import { getFarmTasks } from '../../../../src/services/careTaskService';
import type { CareTask, FarmMemberBasicProfile, TaskStatus } from '../../../../src/types/domain';

type TaskStatusFilter = 'all' | TaskStatus;

const statusFilters: TaskStatusFilter[] = ['all', 'pending', 'postponed', 'completed'];

export default function OwnerTaskListScreen() {
  const { currentFarm } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedStatus, setSelectedStatus] = React.useState<TaskStatusFilter>('all');
  const [tasks, setTasks] = React.useState<CareTask[]>([]);
  const [workerNames, setWorkerNames] = React.useState<Record<string, string>>({});

  const farmId = currentFarm?.farmId;

  const filteredTasks = React.useMemo(() => {
    if (selectedStatus === 'all') {
      return tasks;
    }

    return tasks.filter((task) => task.status === selectedStatus);
  }, [selectedStatus, tasks]);

  const loadTasks = React.useCallback(async () => {
    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setTasks([]);
      setWorkerNames({});
      return;
    }

    setError(null);

    const [tasksResult, workersResult] = await Promise.all([
      getFarmTasks({ farmId }),
      getFarmMemberBasicProfiles(farmId),
    ]);

    if (tasksResult.error) {
      setError(tasksResult.error.message);
      setTasks([]);
    } else {
      setTasks(tasksResult.data);
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
  }, [farmId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadTasks().finally(() => setLoading(false));
    }, [loadTasks])
  );

  if (loading) {
    return <LoadingState message="Memuat tugas pekerja..." />;
  }

  return (
    <Screen>
      <PageIntro title="Tugas Pekerja" subtitle="Lihat semua tugas perawatan dalam kebun aktif." />
      <ErrorBanner message={error} />

      <StatusFilter selectedStatus={selectedStatus} onSelect={setSelectedStatus} />

      {filteredTasks.length === 0 ? (
        <EmptyState
          title={tasks.length === 0 ? 'Belum ada tugas' : 'Tidak ada tugas pada filter ini'}
          subtitle="Tugas dari jadwal perawatan akan muncul di sini."
        />
      ) : (
        <View style={{ gap: 12 }}>
          {filteredTasks.map((task) => (
            <CareTaskSummaryCard
              key={task.id}
              assignedWorkerName={workerNames[task.assignedTo]}
              task={task}
              onPress={() => router.push(`/owner/tasks/${task.id}`)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function StatusFilter({
  onSelect,
  selectedStatus,
}: {
  onSelect: (status: TaskStatusFilter) => void;
  selectedStatus: TaskStatusFilter;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text selectable style={{ color: '#1E2A24', fontSize: 14, fontWeight: '600' }}>
        Status
      </Text>
      <View style={{ gap: 8 }}>
        {statusFilters.map((status) => (
          <Button
            key={status}
            title={status === 'all' ? 'Semua' : formatTaskStatus(status)}
            variant={selectedStatus === status ? 'primary' : 'secondary'}
            onPress={() => onSelect(status)}
          />
        ))}
      </View>
    </View>
  );
}
