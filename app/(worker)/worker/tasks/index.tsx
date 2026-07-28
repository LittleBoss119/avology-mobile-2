import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatCareTarget } from '../../../../src/components/care-schedule-components';
import { formatCareCategory } from '../../../../src/components/care-sop-components';
import { Icon } from '../../../../src/components/icons';
import {
  Badge,
  Card,
  ChipButton,
  CompactMetaItem,
  EmptyState,
  ErrorBanner,
  FilterChipsRow,
  LoadingState,
  MainTabHeader,
  Screen,
} from '../../../../src/components/ui';
import { tokens } from '../../../../src/constants/theme';
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
      <MainTabHeader
        title="Tugas"
        roleLabel="Pekerja"
        subtitle="Selesaikan pekerjaan dari pemilik kebun."
        onProfilePress={() => router.push('/worker/profile')}
      />
      <ErrorBanner message={error} />

      {error ? null : (
        <>
          <RangeFilter selectedRange={rangeFilter} onSelect={setRangeFilter} tasks={tasks} />

          <Text selectable style={styles.metaLine}>
            {`${filteredTasks.length} tugas`}
          </Text>

          {filteredTasks.length === 0 ? (
            <EmptyState
              title={tasks.length === 0 ? 'Belum ada tugas.' : rangeFilter === 'today' ? 'Belum ada tugas hari ini.' : 'Tidak ada tugas pada filter ini.'}
            />
          ) : (
            <View style={styles.list}>
              {filteredTasks.map((task) => (
                <WorkerTaskCard
                  key={task.id}
                  task={task}
                  onPress={() => router.push(`/worker/tasks/${task.id}`)}
                />
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

function RangeFilter({
  onSelect,
  selectedRange,
  tasks,
}: {
  onSelect: (range: TaskRangeFilter) => void;
  selectedRange: TaskRangeFilter;
  tasks: CareTask[];
}) {
  return (
    <FilterChipsRow>
      {taskRangeFilters.map((filter) => (
        <ChipButton
          key={filter.value}
          active={selectedRange === filter.value}
          count={countTasksForRange(tasks, filter.value)}
          label={filter.label}
          onPress={() => onSelect(filter.value)}
        />
      ))}
    </FilterChipsRow>
  );
}

function WorkerTaskCard({ onPress, task }: { onPress: () => void; task: CareTask }) {
  const heading = task.category ? formatCareCategory(task.category) : task.title;
  const showTitleRow = Boolean(task.title) && task.category !== null;

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card} variant="default">
        <View style={styles.cardRow1}>
          <Text selectable numberOfLines={1} style={styles.cardHeading}>
            {heading}
          </Text>
          <Badge label={formatTaskStatusLabel(task.status)} maxWidth={100} tone={getTaskTone(task.status)} />
        </View>

        {showTitleRow ? (
          <Text selectable numberOfLines={1} style={styles.cardTitle}>
            {task.title}
          </Text>
        ) : null}

        {task.instruction ? (
          <Text selectable ellipsizeMode="tail" numberOfLines={1} style={styles.cardInstruction}>
            {task.instruction}
          </Text>
        ) : null}

        <View style={styles.cardMeta}>
          <CompactMetaItem icon="calendar" label={formatDate(task.dueDate)} />
          <CompactMetaItem icon="target" label={formatCareTarget(task)} />
          {task.requiresPhoto ? (
            <View style={styles.cardPhoto}>
              <Icon name="camera" size={tokens.icon.xs} color={tokens.color.text.secondary} />
              <Text selectable style={styles.cardAttribute}>
                Butuh foto
              </Text>
            </View>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

const taskRangeFilters: Array<{ label: string; value: TaskRangeFilter }> = [
  { label: 'Hari Ini', value: 'today' },
  { label: 'Belum', value: 'pending' },
  { label: 'Tertunda', value: 'postponed' },
  { label: 'Selesai', value: 'completed' },
  { label: 'Semua', value: 'all' },
];

function formatTaskStatusLabel(status: TaskStatus): string {
  if (status === 'completed') {
    return 'Selesai';
  }

  if (status === 'postponed') {
    return 'Tertunda';
  }

  return 'Belum';
}

function getTaskTone(status: TaskStatus): 'muted' | 'success' | 'warning' {
  if (status === 'completed') {
    return 'success';
  }

  if (status === 'postponed') {
    return 'warning';
  }

  return 'muted';
}

function countTasksForRange(tasks: CareTask[], range: TaskRangeFilter): number {
  if (range === 'today') {
    return countTodayOpenTasks(tasks);
  }

  if (range === 'pending' || range === 'postponed' || range === 'completed') {
    return countTasksByStatus(tasks, range);
  }

  return tasks.length;
}

function countTasksByStatus(tasks: CareTask[], status: TaskStatus): number {
  return tasks.filter((task) => task.status === status).length;
}

function countTodayOpenTasks(tasks: CareTask[]): number {
  const today = getTodayIsoDate();
  return tasks.filter((task) => task.dueDate === today && task.status !== 'completed').length;
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

function getTodayIsoDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
  metaLine: { ...tokens.type.meta, color: tokens.color.text.tertiary },
  list: { gap: tokens.space.md },

  card: { gap: 0 },
  cardRow1: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.space.sm,
    justifyContent: 'space-between',
  },
  cardHeading: { ...tokens.type.subheading, color: tokens.color.text.primary, flex: 1 },
  cardTitle: { ...tokens.type.meta, color: tokens.color.text.tertiary, marginTop: tokens.space.xs },
  cardInstruction: { ...tokens.type.meta, color: tokens.color.text.tertiary, marginTop: tokens.space.xs },
  cardMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.md,
    marginTop: tokens.space.sm,
  },
  cardPhoto: { alignItems: 'center', flexDirection: 'row', gap: tokens.space.xs },
  cardAttribute: { ...tokens.type.meta, color: tokens.color.text.secondary },
});
