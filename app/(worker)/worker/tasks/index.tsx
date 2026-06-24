import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { CareTaskSummaryCard } from '../../../../src/components/care-schedule-components';
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
import { getWorkerTasks } from '../../../../src/services/careTaskService';
import type { CareTask, TaskStatus } from '../../../../src/types/domain';

type TaskRangeFilter = 'today' | 'pending' | 'postponed' | 'completed' | 'all';

export default function WorkerTaskListScreen() {
  const { currentFarm } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [rangeFilter, setRangeFilter] = React.useState<TaskRangeFilter>('today');
  const [tasks, setTasks] = React.useState<CareTask[]>([]);

  const farmId = currentFarm?.farmId;

  const filteredTasks = React.useMemo(() => {
    const today = getTodayIsoDate();

    if (rangeFilter === 'today') {
      return tasks.filter((task) => task.dueDate === today && task.status !== 'completed');
    }

    if (rangeFilter === 'pending' || rangeFilter === 'postponed' || rangeFilter === 'completed') {
      return tasks.filter((task) => task.status === rangeFilter);
    }

    return tasks;
  }, [rangeFilter, tasks]);

  const loadTasks = React.useCallback(async () => {
    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setTasks([]);
      return;
    }

    setError(null);

    const result = await getWorkerTasks({ farmId });

    if (result.error) {
      setError(result.error.message);
      setTasks([]);
      return;
    }

    setTasks(result.data);
  }, [farmId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadTasks().finally(() => setLoading(false));
    }, [loadTasks])
  );

  if (loading) {
    return <LoadingState message="Memuat tugas..." />;
  }

  return (
    <Screen>
      <PageIntro title="Pekerjaan Lapangan" subtitle="Lihat tugas perawatan yang ditugaskan kepada Anda." />
      <ErrorBanner message={error} />

      <TaskSummary tasks={tasks} />

      <RangeFilter selectedRange={rangeFilter} onSelect={setRangeFilter} />

      {filteredTasks.length === 0 ? (
        <EmptyState
          title={tasks.length === 0 ? 'Belum ada tugas' : 'Tidak ada tugas pada pilihan ini'}
          subtitle="Tugas dari pemilik akan muncul di sini."
        />
      ) : (
        <View style={{ gap: 12 }}>
          {filteredTasks.map((task) => (
            <CareTaskSummaryCard
              key={task.id}
              showAssignedWorker={false}
              task={task}
              onPress={() => router.push(`/worker/tasks/${task.id}`)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function RangeFilter({
  onSelect,
  selectedRange,
}: {
  onSelect: (range: TaskRangeFilter) => void;
  selectedRange: TaskRangeFilter;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text selectable style={{ color: '#1E2A24', fontSize: 14, fontWeight: '600' }}>
        Tampilkan
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {taskRangeFilters.map((filter) => (
          <ChipButton
            key={filter.value}
            active={selectedRange === filter.value}
            label={filter.label}
            onPress={() => onSelect(filter.value)}
          />
        ))}
      </View>
    </View>
  );
}

function TaskSummary({ tasks }: { tasks: CareTask[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <SummaryPill label="Hari ini" value={countTodayOpenTasks(tasks)} />
      <SummaryPill label="Belum" value={countTasksByStatus(tasks, 'pending')} />
      <SummaryPill label="Ditunda" value={countTasksByStatus(tasks, 'postponed')} />
      <SummaryPill label="Selesai" value={countTasksByStatus(tasks, 'completed')} />
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

const taskRangeFilters: Array<{ label: string; value: TaskRangeFilter }> = [
  { label: 'Hari Ini', value: 'today' },
  { label: 'Belum Selesai', value: 'pending' },
  { label: 'Ditunda', value: 'postponed' },
  { label: 'Selesai', value: 'completed' },
  { label: 'Semua', value: 'all' },
];

function countTasksByStatus(tasks: CareTask[], status: TaskStatus): number {
  return tasks.filter((task) => task.status === status).length;
}

function countTodayOpenTasks(tasks: CareTask[]): number {
  const today = getTodayIsoDate();
  return tasks.filter((task) => task.dueDate === today && task.status !== 'completed').length;
}

function getTodayIsoDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
