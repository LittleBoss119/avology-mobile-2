import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import {
  CareTaskSummaryCard,
} from '../../../../src/components/care-schedule-components';
import {
  appTheme,
  ChipButton,
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

type TaskStatusFilter = 'all' | 'today' | TaskStatus;

const statusFilters: Array<{ label: string; value: TaskStatusFilter }> = [
  { label: 'Semua', value: 'all' },
  { label: 'Hari ini', value: 'today' },
  { label: 'Belum selesai', value: 'pending' },
  { label: 'Selesai', value: 'completed' },
  { label: 'Tertunda', value: 'postponed' },
];

export default function OwnerTaskListScreen() {
  const { currentFarm } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedStatus, setSelectedStatus] = React.useState<TaskStatusFilter>('all');
  const [tasks, setTasks] = React.useState<CareTask[]>([]);
  const [workerNames, setWorkerNames] = React.useState<Record<string, string>>({});

  const farmId = currentFarm?.farmId;

  const filteredTasks = React.useMemo(() => {
    if (selectedStatus === 'today') {
      return tasks.filter((task) => task.dueDate === getTodayIsoDate());
    }

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
      <PageIntro title="Tugas Lapangan" subtitle="Lihat semua tugas perawatan dalam kebun aktif." />
      <ErrorBanner message={error} />

      <TaskSummary tasks={tasks} />

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
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {statusFilters.map((status) => (
          <ChipButton
            key={status.value}
            active={selectedStatus === status.value}
            label={status.label}
            onPress={() => onSelect(status.value)}
          />
        ))}
      </View>
    </View>
  );
}

function TaskSummary({ tasks }: { tasks: CareTask[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <SummaryPill label="Hari ini" value={tasks.filter((task) => task.dueDate === getTodayIsoDate()).length} />
      <SummaryPill label="Belum" value={countTasksByStatus(tasks, 'pending')} />
      <SummaryPill label="Selesai" value={countTasksByStatus(tasks, 'completed')} />
      <SummaryPill label="Tertunda" value={countTasksByStatus(tasks, 'postponed')} />
    </View>
  );
}

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderColor: '#DCE7D5',
        borderRadius: 14,
        borderWidth: 1,
        flexBasis: '22%',
        flexGrow: 1,
        gap: 3,
        padding: 11,
      }}
    >
      <Text selectable numberOfLines={1} style={{ color: appTheme.muted, fontSize: 12, fontWeight: '800' }}>
        {label}
      </Text>
      <Text selectable style={{ color: appTheme.primary, fontSize: 22, fontVariant: ['tabular-nums'], fontWeight: '900' }}>
        {value}
      </Text>
    </View>
  );
}

function countTasksByStatus(tasks: CareTask[], status: TaskStatus): number {
  return tasks.filter((task) => task.status === status).length;
}

function getTodayIsoDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
