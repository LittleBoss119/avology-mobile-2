import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '../../../../src/components/bottom-sheet';
import { formatCareTarget } from '../../../../src/components/care-schedule-components';
import { Icon } from '../../../../src/components/icons';
import {
  Badge,
  Button,
  Card,
  ChipButton,
  CompactMetaItem,
  EmptyState,
  ErrorBanner,
  FilterChipsRow,
  LoadingState,
  MainTabHeader,
  Screen,
  SearchFilterRow,
} from '../../../../src/components/ui';
import { statusColors, tokens } from '../../../../src/constants/theme';
import { useAuth } from '../../../../src/context/auth-context';
import { getWorkerTasks } from '../../../../src/services/careTaskService';
import type { CareTask, TargetType, TaskStatus } from '../../../../src/types/domain';
import { formatCareCategory, formatTargetType, formatTaskStatus } from '../../../../src/utils/displayFormat';
import { getTodayIsoDate, taskTimeBucket, type TimeBucket } from '../../../../src/utils/taskDueDate';

type TimeFilter = 'all' | 'today' | 'overdue' | 'upcoming';
type TaskTargetFilter = 'all' | TargetType;

// Dua sumbu di sheet: Status (multi) + Target (satu). Tidak ada Sumber/Pekerja —
// CareTask tak membawa careSopId, dan semua tugas milik pengguna ini sendiri.
type SheetCriteria = {
  statuses: TaskStatus[]; // array kosong = semua status
  target: TaskTargetFilter;
};

const DEFAULT_CRITERIA: SheetCriteria = {
  statuses: [],
  target: 'all',
};

const timeFilters: Array<{ label: string; value: TimeFilter }> = [
  { label: 'Semua', value: 'all' },
  { label: 'Hari ini', value: 'today' },
  { label: 'Terlambat', value: 'overdue' },
  { label: 'Mendatang', value: 'upcoming' },
];

const statusOptions: Array<{ label: string; value: TaskStatus }> = [
  { label: 'Belum', value: 'pending' },
  { label: 'Ditunda', value: 'postponed' },
  { label: 'Selesai', value: 'completed' },
];

// Urutan tampil target yang benar-benar muncul di data (bukan seluruh enum).
const TARGET_ORDER: TargetType[] = ['farm', 'row', 'column', 'tree', 'custom'];

export default function WorkerTaskListScreen() {
  const { currentFarm } = useAuth();
  const [criteria, setCriteria] = React.useState<SheetCriteria>(DEFAULT_CRITERIA);
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [draft, setDraft] = React.useState<SheetCriteria>(DEFAULT_CRITERIA);
  const [error, setError] = React.useState<string | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [tasks, setTasks] = React.useState<CareTask[]>([]);
  const [timeFilter, setTimeFilter] = React.useState<TimeFilter>('all');

  const farmId = currentFarm?.farmId;

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

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);

    return () => clearTimeout(timer);
  }, [search]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadTasks().finally(() => setLoading(false));
    }, [loadTasks])
  );

  if (loading) {
    return <LoadingState message="Memuat tugas..." />;
  }

  const todayIso = getTodayIsoDate();

  // Ember waktu dihitung SEKALI per tugas, dipakai ulang untuk chip, badge kartu,
  // dan urutan. scheduleIsCancelled = false: getWorkerTasks sudah menyaring keluar
  // tugas dari jadwal yang dibatalkan sebelum data sampai ke sini.
  const buckets: Record<string, TimeBucket> = {};
  for (const task of tasks) {
    buckets[task.id] = taskTimeBucket(task, todayIso, false);
  }

  function matchesTask(task: CareTask, sheet: SheetCriteria): boolean {
    if (timeFilter !== 'all' && buckets[task.id] !== timeFilter) {
      return false;
    }

    if (sheet.statuses.length > 0 && !sheet.statuses.includes(task.status)) {
      return false;
    }

    if (sheet.target !== 'all' && task.targetType !== sheet.target) {
      return false;
    }

    if (debouncedSearch) {
      const searchable = [task.title, task.instruction, formatCareTarget(task)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (!searchable.includes(debouncedSearch)) {
        return false;
      }
    }

    return true;
  }

  // Satu comparator, dueDate menaik untuk semua chip (untuk 'overdue': paling lama telat di atas).
  const displayedTasks = tasks
    .filter((task) => matchesTask(task, criteria))
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));

  const activeGroupCount =
    (criteria.statuses.length > 0 ? 1 : 0) + (criteria.target !== 'all' ? 1 : 0);

  const presentTargets = new Set(tasks.map((task) => task.targetType));
  const targetOptions: Array<{ label: string; value: TaskTargetFilter }> = [
    { label: 'Semua', value: 'all' },
    ...TARGET_ORDER.filter((target) => presentTargets.has(target)).map((target) => ({
      label: formatTargetType(target),
      value: target,
    })),
  ];

  const hasNoData = tasks.length === 0;

  function openFilterSheet() {
    setDraft(criteria);
    setFilterSheetOpen(true);
  }

  function applyDraft() {
    setCriteria(draft);
    setFilterSheetOpen(false);
  }

  return (
    <Screen
      header={
        <MainTabHeader
          title="Tugas"
          roleLabel="Pekerja"
          onProfilePress={() => router.push('/worker/profile')}
        />
      }
    >
      <ErrorBanner message={error} />

      {error ? null : hasNoData ? (
        <EmptyState
          icon="list-check"
          subtitle="Tugas dari pemilik akan muncul di sini."
          title="Belum ada tugas"
          variant="plain"
        />
      ) : (
        <>
          <SearchFilterRow
            filterActive={activeGroupCount > 0}
            filterCount={activeGroupCount}
            onChangeText={setSearch}
            onFilterPress={openFilterSheet}
            placeholder="Cari judul atau target"
            value={search}
          />

          <FilterChipsRow>
            {timeFilters.map((filter) => (
              <ChipButton
                key={filter.value}
                active={timeFilter === filter.value}
                label={filter.label}
                onPress={() => setTimeFilter(filter.value)}
              />
            ))}
          </FilterChipsRow>

          <Text selectable style={styles.metaLine}>
            {`Menampilkan ${displayedTasks.length} tugas`}
          </Text>

          {displayedTasks.length === 0 ? (
            debouncedSearch.length > 0 ? (
              <EmptyState
                icon="search"
                subtitle={`Tidak ada tugas yang cocok dengan "${search.trim()}".`}
                title="Tidak ada hasil"
                variant="plain"
              />
            ) : (
              <EmptyState
                icon="filter"
                subtitle="Tidak ada tugas dengan filter yang aktif."
                title="Tidak ada yang cocok"
                variant="plain"
              />
            )
          ) : (
            <View style={styles.list}>
              {displayedTasks.map((task) => (
                <WorkerTaskCard
                  key={task.id}
                  bucket={buckets[task.id]}
                  onPress={() => router.push(`/worker/tasks/${task.id}`)}
                  task={task}
                />
              ))}
            </View>
          )}
        </>
      )}

      <TaskFilterSheet
        draft={draft}
        onApply={applyDraft}
        onClose={() => setFilterSheetOpen(false)}
        onDraftChange={setDraft}
        targetOptions={targetOptions}
        visible={filterSheetOpen}
      />
    </Screen>
  );
}

function WorkerTaskCard({
  bucket,
  onPress,
  task,
}: {
  // Ember waktu dihitung di layar sekali per tugas, dipakai untuk badge di sini.
  bucket: TimeBucket;
  onPress: () => void;
  task: CareTask;
}) {
  const hasTitle = Boolean(task.title);
  const categoryLabel = task.category ? formatCareCategory(task.category) : null;
  const headingText = hasTitle ? task.title : categoryLabel ?? task.title;
  const showCategoryRow = hasTitle && categoryLabel !== null;

  const badge =
    bucket === 'overdue' ? (
      <Badge label="Terlambat" maxWidth={100} tone="danger" />
    ) : (
      <Badge label={formatTaskStatus(task.status)} maxWidth={100} tone={getTaskTone(task.status)} />
    );

  const metaRow = (
    <View style={styles.cardMeta}>
      <CompactMetaItem icon="calendar" label={formatDate(task.dueDate)} />
      <CompactMetaItem icon="target" label={formatCareTarget(task)} />
    </View>
  );

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card} variant="default">
        <View style={styles.cardRow1}>
          <Text selectable numberOfLines={1} style={[styles.cardTitle, styles.cardTitleFlex]}>
            {headingText}
          </Text>
          {badge}
        </View>

        {/* Kategori/instruksi/meta satu gugus: jarak judul→gugus (card gap) lebih besar dari dalam gugus (xs). */}
        <View style={styles.detailGroup}>
          {showCategoryRow ? (
            <Text selectable numberOfLines={1} style={styles.cardCategory}>
              {categoryLabel}
            </Text>
          ) : null}
          {task.instruction ? (
            <Text selectable ellipsizeMode="tail" numberOfLines={2} style={styles.cardInstruction}>
              {task.instruction}
            </Text>
          ) : null}
          {metaRow}
        </View>

        {task.requiresPhoto ? (
          <View style={styles.cardAttributes}>
            <View style={styles.proofPill}>
              <Icon name="camera" size={tokens.icon.xs} color={statusColors.warning.text} />
              <Text selectable={false} style={styles.proofPillText}>
                Butuh bukti
              </Text>
            </View>
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

function TaskFilterSheet({
  draft,
  onApply,
  onClose,
  onDraftChange,
  targetOptions,
  visible,
}: {
  draft: SheetCriteria;
  onApply: () => void;
  onClose: () => void;
  onDraftChange: (next: SheetCriteria) => void;
  targetOptions: Array<{ label: string; value: TaskTargetFilter }>;
  visible: boolean;
}) {
  const isDefault = draft.statuses.length === 0 && draft.target === 'all';

  function toggleStatus(value: TaskStatus) {
    const nextStatuses = draft.statuses.includes(value)
      ? draft.statuses.filter((status) => status !== value)
      : [...draft.statuses, value];
    onDraftChange({ ...draft, statuses: nextStatuses });
  }

  return (
    <BottomSheet onClose={onClose} title="Filter tugas" visible={visible}>
      <View style={styles.filterSheetBody}>
        <View style={styles.sheetResetRow}>
          <Pressable
            accessibilityRole="button"
            disabled={isDefault}
            hitSlop={{ bottom: 8, left: 8, right: 8, top: 8 }}
            onPress={() => onDraftChange(DEFAULT_CRITERIA)}
          >
            <Text selectable={false} style={[styles.resetText, isDefault ? styles.resetTextDisabled : null]}>
              Atur ulang
            </Text>
          </Pressable>
        </View>

        <View style={styles.filterGroup}>
          <Text selectable style={styles.filterLabel}>
            Status
          </Text>
          <FilterChipsRow>
            {statusOptions.map((option) => (
              <StatusChip
                key={option.value}
                active={draft.statuses.includes(option.value)}
                label={option.label}
                onPress={() => toggleStatus(option.value)}
              />
            ))}
          </FilterChipsRow>
        </View>

        <View style={styles.filterGroup}>
          <Text selectable style={styles.filterLabel}>
            Target
          </Text>
          <FilterChipsRow>
            {targetOptions.map((option) => (
              <ChipButton
                key={option.value}
                active={draft.target === option.value}
                label={option.label}
                onPress={() => onDraftChange({ ...draft, target: option.value })}
              />
            ))}
          </FilterChipsRow>
        </View>

        <Button title="Terapkan" variant="primary" onPress={onApply} />
      </View>
    </BottomSheet>
  );
}

function StatusChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.statusChip, active ? styles.statusChipActive : null]}>
      {active ? <Icon name="check" size={tokens.icon.xs} color={tokens.color.brand.on} /> : null}
      <Text selectable={false} style={[styles.statusChipText, active ? styles.statusChipTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
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

const styles = StyleSheet.create({
  metaLine: { ...tokens.type.meta, color: tokens.color.text.tertiary },
  list: { gap: tokens.space.md },

  card: { gap: tokens.space.sm },
  cardRow1: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.space.sm,
    justifyContent: 'space-between',
  },
  cardTitle: { ...tokens.type.subheading, color: tokens.color.text.primary },
  cardTitleFlex: { flex: 1 },
  detailGroup: { gap: tokens.space.xs },
  cardCategory: { ...tokens.type.meta, color: tokens.color.text.tertiary },
  cardInstruction: { ...tokens.type.meta, color: tokens.color.text.tertiary },
  cardMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.md,
  },

  cardAttributes: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.sm,
  },
  proofPill: {
    alignItems: 'center',
    backgroundColor: statusColors.warning.background,
    borderRadius: tokens.radius.pill,
    flexDirection: 'row',
    gap: tokens.space.xs,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 2,
  },
  proofPillText: { ...tokens.type.caption, color: statusColors.warning.text },

  filterSheetBody: { gap: tokens.space.md },
  filterGroup: { gap: tokens.space.sm },
  filterLabel: { ...tokens.type.label, color: tokens.color.text.primary },
  sheetResetRow: { alignItems: 'flex-end' },
  resetText: { ...tokens.type.label, color: tokens.color.brand.base },
  resetTextDisabled: { color: tokens.color.text.tertiary },

  statusChip: {
    alignItems: 'center',
    backgroundColor: tokens.color.surface.card,
    borderColor: tokens.color.line.card,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: tokens.space.xs,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
  },
  statusChipActive: {
    backgroundColor: tokens.color.brand.base,
    borderColor: tokens.color.brand.base,
  },
  statusChipText: { ...tokens.type.label, color: tokens.color.text.primary },
  statusChipTextActive: { color: tokens.color.brand.on },
});
