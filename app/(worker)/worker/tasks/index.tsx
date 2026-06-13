import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { CareTaskSummaryCard } from '../../../../src/components/care-schedule-components';
import {
  Button,
  EmptyState,
  ErrorBanner,
  LoadingState,
  PageIntro,
  Screen,
} from '../../../../src/components/ui';
import { useAuth } from '../../../../src/context/auth-context';
import { getWorkerTasks } from '../../../../src/services/careTaskService';
import type { CareTask } from '../../../../src/types/domain';

type TaskRangeFilter = 'today' | 'all';

export default function WorkerTaskListScreen() {
  const { currentFarm, refresh } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [rangeFilter, setRangeFilter] = React.useState<TaskRangeFilter>('today');
  const [refreshing, setRefreshing] = React.useState(false);
  const [tasks, setTasks] = React.useState<CareTask[]>([]);

  const farmId = currentFarm?.farmId;

  const filteredTasks = React.useMemo(() => {
    if (rangeFilter === 'all') {
      return tasks;
    }

    const today = getTodayIsoDate();
    return tasks.filter((task) => task.dueDate === today);
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

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    await loadTasks();
    setRefreshing(false);
  }

  if (loading) {
    return <LoadingState message="Memuat tugas..." />;
  }

  return (
    <Screen footer={<Button title="Refresh" variant="secondary" loading={refreshing} onPress={handleRefresh} />}>
      <PageIntro title="Tugas Saya" subtitle="Lihat tugas perawatan yang ditugaskan kepada Anda." />
      <ErrorBanner message={error} />

      <RangeFilter selectedRange={rangeFilter} onSelect={setRangeFilter} />

      {filteredTasks.length === 0 ? (
        <EmptyState
          title={tasks.length === 0 ? 'Belum ada tugas' : 'Tidak ada tugas hari ini'}
          subtitle="Tugas dari owner akan muncul di sini."
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
      <View style={{ gap: 8 }}>
        <Button
          title="Hari Ini"
          variant={selectedRange === 'today' ? 'primary' : 'secondary'}
          onPress={() => onSelect('today')}
        />
        <Button
          title="Semua Tugas"
          variant={selectedRange === 'all' ? 'primary' : 'secondary'}
          onPress={() => onSelect('all')}
        />
      </View>
    </View>
  );
}

function getTodayIsoDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
