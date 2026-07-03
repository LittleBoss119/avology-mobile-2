import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatCareTarget } from '../../../../src/components/care-schedule-components';
import { formatCareCategory } from '../../../../src/components/care-sop-components';
import {
  Badge,
  CameraGlyph,
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
import { colors, radius, spacing } from '../../../../src/constants/theme';
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

      <TaskSummary tasks={tasks} />

      <RangeFilter selectedRange={rangeFilter} onSelect={setRangeFilter} />

      {filteredTasks.length === 0 ? (
        <EmptyState
          title={tasks.length === 0 ? 'Belum ada tugas.' : rangeFilter === 'today' ? 'Belum ada tugas hari ini.' : 'Tidak ada tugas pada filter ini.'}
        />
      ) : (
        <View style={{ gap: 12 }}>
          {filteredTasks.map((task) => (
            <WorkerTaskCard
              key={task.id}
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
    <FilterChipsRow>
      {taskRangeFilters.map((filter) => (
        <ChipButton
          key={filter.value}
          active={selectedRange === filter.value}
          label={filter.label}
          onPress={() => onSelect(filter.value)}
        />
      ))}
    </FilterChipsRow>
  );
}

function TaskSummary({ tasks }: { tasks: CareTask[] }) {
  return (
    <Card variant="heroGreen">
      <View style={{ gap: spacing.xs }}>
        <Text selectable style={{ color: '#DDEFE2', fontSize: 15, fontWeight: '800' }}>
          Hari Ini
        </Text>
        <Text selectable style={{ color: colors.surface, fontSize: 28, fontVariant: ['tabular-nums'], fontWeight: '900' }}>
          {countTodayOpenTasks(tasks)} tugas
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <SummaryPill label="Belum" value={countTasksByStatus(tasks, 'pending')} />
        <SummaryPill label="Selesai" value={countTasksByStatus(tasks, 'completed')} />
        <SummaryPill label="Tertunda" value={countTasksByStatus(tasks, 'postponed')} />
      </View>
    </Card>
  );
}

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
    <View
      style={{
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderColor: 'rgba(255,255,255,0.22)',
        borderRadius: radius.lg,
        borderWidth: 1,
        flex: 1,
        gap: 3,
        padding: 11,
      }}
    >
      <Text selectable numberOfLines={1} style={{ color: '#DDEFE2', fontSize: 12, fontWeight: '800' }}>
        {label}
      </Text>
      <Text selectable style={{ color: colors.surface, fontSize: 22, fontVariant: ['tabular-nums'], fontWeight: '900' }}>
        {value}
      </Text>
    </View>
  );
}

function WorkerTaskCard({ onPress, task }: { onPress: () => void; task: CareTask }) {
  return (
    <Pressable onPress={onPress}>
      <Card>
        <View style={{ gap: spacing.sm }}>
          <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' }}>
            <Text
              selectable
              ellipsizeMode="tail"
              numberOfLines={1}
              style={{ color: colors.primary, flex: 1, fontSize: 17, fontWeight: '900', lineHeight: 23 }}
            >
              {task.title}
            </Text>
            <Badge label={formatTaskStatusLabel(task.status)} maxWidth={100} tone={getTaskTone(task.status)} />
          </View>

          <View style={{ alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {task.category ? (
              <Text selectable numberOfLines={1} style={{ color: colors.textMuted, fontSize: 13, fontWeight: '800' }}>
                {formatCareCategory(task.category)}
              </Text>
            ) : null}
            {task.requiresPhoto ? <ProofPhotoIndicator /> : null}
          </View>

          {task.instruction ? (
            <Text selectable ellipsizeMode="tail" numberOfLines={1} style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
              {task.instruction}
            </Text>
          ) : null}

          <View style={{ gap: spacing.xs }}>
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
              <CompactMetaItem icon="calendar" label={formatDate(task.dueDate)} />
              <CompactMetaItem icon="target" label={formatCareTarget(task)} />
            </View>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

function ProofPhotoIndicator() {
  return (
    <View
      accessibilityLabel="Perlu bukti foto"
      style={{
        alignItems: 'center',
        backgroundColor: colors.warningBg,
        borderColor: colors.warningBorder,
        borderCurve: 'continuous',
        borderRadius: radius.round,
        borderWidth: 1,
        height: 26,
        justifyContent: 'center',
        width: 26,
      }}
    >
      <CameraGlyph color={colors.warning} />
    </View>
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
