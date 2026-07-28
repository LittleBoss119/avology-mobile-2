import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet, SheetActionRow } from '../../../../src/components/bottom-sheet';
import { formatCareTarget } from '../../../../src/components/care-schedule-components';
import { formatCareCategory } from '../../../../src/components/care-sop-components';
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
import { tokens } from '../../../../src/constants/theme';
import { useAuth } from '../../../../src/context/auth-context';
import { getCareScheduleDetail, getCareSchedules } from '../../../../src/services/careScheduleService';
import { getFarmMemberBasicProfiles } from '../../../../src/services/memberService';
import type { CareSchedule, CareScheduleDetail, FarmMemberBasicProfile } from '../../../../src/types/domain';
import { scheduleDueMarker } from '../../../../src/utils/taskDueDate';

type ScheduleStatusFilter = 'all' | 'today' | 'unfinished' | 'completed' | 'postponed' | 'cancelled';
type ScheduleSourceFilter = 'all' | 'manual' | 'sop';
type ScheduleVisualStatus = 'cancelled' | 'completed' | 'postponed' | 'unfinished';

const statusFilters: Array<{ label: string; value: ScheduleStatusFilter }> = [
  { label: 'Semua', value: 'all' },
  { label: 'Hari ini', value: 'today' },
  { label: 'Belum', value: 'unfinished' },
  { label: 'Selesai', value: 'completed' },
  { label: 'Tertunda', value: 'postponed' },
  { label: 'Dibatalkan', value: 'cancelled' },
];

const sourceFilters: Array<{ label: string; value: ScheduleSourceFilter }> = [
  { label: 'Semua sumber', value: 'all' },
  { label: 'Manual', value: 'manual' },
  { label: 'SOP', value: 'sop' },
];

export default function CareScheduleListScreen() {
  const { currentFarm } = useAuth();
  const [addSheetOpen, setAddSheetOpen] = React.useState(false);
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [details, setDetails] = React.useState<Record<string, CareScheduleDetail>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [schedules, setSchedules] = React.useState<CareSchedule[]>([]);
  const [search, setSearch] = React.useState('');
  const [sourceFilter, setSourceFilter] = React.useState<ScheduleSourceFilter>('all');
  const [statusFilter, setStatusFilter] = React.useState<ScheduleStatusFilter>('all');
  const [workerNames, setWorkerNames] = React.useState<Record<string, string>>({});

  const farmId = currentFarm?.farmId;

  const loadSchedules = React.useCallback(async () => {
    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setDetails({});
      setSchedules([]);
      setWorkerNames({});
      return;
    }

    setError(null);

    const [result, workersResult] = await Promise.all([
      getCareSchedules({ farmId }),
      getFarmMemberBasicProfiles(farmId),
    ]);

    if (result.error) {
      setError(result.error.message);
      setDetails({});
      setSchedules([]);
      return;
    }

    setSchedules(result.data);

    if (workersResult.error) {
      setWorkerNames({});
    } else {
      setWorkerNames(
        Object.fromEntries(
          workersResult.data.map((worker: FarmMemberBasicProfile) => [worker.userId, worker.fullName])
        )
      );
    }

    const detailEntries = await Promise.all(
      result.data.map(async (schedule) => {
        const detailResult = await getCareScheduleDetail({ scheduleId: schedule.id });
        return [schedule.id, detailResult.error ? null : detailResult.data] as const;
      })
    );

    setDetails(
      Object.fromEntries(
        detailEntries.filter((entry): entry is readonly [string, CareScheduleDetail] => Boolean(entry[1]))
      )
    );
  }, [farmId]);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);

    return () => clearTimeout(timer);
  }, [search]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadSchedules().finally(() => setLoading(false));
    }, [loadSchedules])
  );

  if (loading) {
    return <LoadingState message="Memuat jadwal perawatan..." />;
  }

  const todayIso = getTodayIsoDate();

  function matchesActive(schedule: CareSchedule, status: ScheduleStatusFilter): boolean {
    return matchesScheduleFilters(schedule, {
      detail: details[schedule.id],
      search: debouncedSearch,
      sourceFilter,
      statusFilter: status,
      workerNames,
    });
  }

  const displayedSchedules = schedules.filter((schedule) => matchesActive(schedule, statusFilter));

  return (
    <Screen floatingAction={<AddScheduleFab onPress={() => setAddSheetOpen(true)} />}>
      <MainTabHeader
        title="Tugas"
        roleLabel="Pemilik"
        subtitle="Pantau jadwal kerja dan perawatan."
        onProfilePress={() => router.push('/owner/profile')}
      />
      <ErrorBanner message={error} />

      <SearchFilterRow
        filterActive={sourceFilter !== 'all'}
        onChangeText={setSearch}
        onFilterPress={() => setFilterSheetOpen(true)}
        placeholder="Cari judul, target, atau pekerja"
        value={search}
      />

      {/* Bungkus <View>: cegah FilterChipsRow (ScrollView horizontal) memuai
          vertikal di dalam <View flex:1> milik Screen saat daftar pendek,
          agar isi layar tetap rata atas. */}
      <View>
        <FilterChipsRow>
          {statusFilters.map((filter) => (
            <ChipButton
              key={filter.value}
              active={statusFilter === filter.value}
              count={schedules.filter((schedule) => matchesActive(schedule, filter.value)).length}
              label={filter.label}
              onPress={() => setStatusFilter(filter.value)}
            />
          ))}
        </FilterChipsRow>
      </View>

      {error ? null : (
        <>
          <Text selectable style={styles.metaLine}>
            {`${displayedSchedules.length} jadwal · urut terdekat`}
          </Text>
          {displayedSchedules.length === 0 ? (
            <EmptyState title={schedules.length === 0 ? 'Belum ada jadwal.' : 'Tidak ada jadwal pada filter ini.'} />
          ) : (
            <View style={styles.list}>
              {displayedSchedules.map((schedule) => (
                <CompactScheduleCard
                  key={schedule.id}
                  detail={details[schedule.id]}
                  dueMarker={scheduleDueMarker(schedule, details[schedule.id], todayIso)}
                  onPress={() => router.push(`/owner/schedules/${schedule.id}`)}
                  schedule={schedule}
                  workerNames={workerNames}
                />
              ))}
            </View>
          )}
        </>
      )}

      <AddScheduleSheet onClose={() => setAddSheetOpen(false)} visible={addSheetOpen} />
      <ScheduleFilterSheet
        onClose={() => setFilterSheetOpen(false)}
        onSourceChange={setSourceFilter}
        sourceFilter={sourceFilter}
        visible={filterSheetOpen}
      />
    </Screen>
  );
}

function CompactScheduleCard({
  detail,
  dueMarker,
  onPress,
  schedule,
  workerNames,
}: {
  detail?: CareScheduleDetail;
  // RF-11b: penanda jatuh tempo level-jadwal. null → badge status agregat.
  dueMarker?: 'overdue' | 'due_today' | null;
  onPress: () => void;
  schedule: CareSchedule;
  workerNames: Record<string, string>;
}) {
  const status = getScheduleStatus(schedule, detail);
  const workers = getScheduleWorkerNames(detail, workerNames);
  const taskCount = detail?.tasks.length ?? 0;

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card} variant="default">
        <View style={styles.cardRow1}>
          <Text selectable numberOfLines={1} style={styles.cardCategory}>
            {formatCareCategory(schedule.category)}
          </Text>
          {dueMarker === 'overdue' ? (
            <Badge label="Terlambat" maxWidth={116} tone="danger" />
          ) : dueMarker === 'due_today' ? (
            <Badge label="Hari ini" maxWidth={116} tone="warning" />
          ) : (
            <Badge label={formatScheduleStatusLabel(status)} maxWidth={116} tone={getScheduleStatusTone(status)} />
          )}
        </View>

        {schedule.title ? (
          <Text selectable numberOfLines={1} style={styles.cardTitle}>
            {schedule.title}
          </Text>
        ) : null}

        <View style={styles.cardMeta1}>
          <CompactMetaItem icon="calendar" label={formatDate(schedule.scheduledDate)} />
          <CompactMetaItem icon="target" label={formatCareTarget(schedule)} />
        </View>

        <View style={styles.cardMeta2}>
          <CompactMetaItem icon="user" label={formatWorkerSummary(workers)} />
          {taskCount > 1 ? (
            <Text selectable numberOfLines={1} style={styles.cardProgress}>
              {getScheduleProgress(detail)}
            </Text>
          ) : null}
          {schedule.careSopId ? (
            <Text selectable style={styles.cardAttribute}>
              SOP
            </Text>
          ) : null}
          {schedule.requiresPhoto ? (
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

function AddScheduleFab({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityLabel="Tambah jadwal" accessibilityRole="button" onPress={onPress} style={styles.fab}>
      <Text selectable={false} style={styles.fabPlus}>
        +
      </Text>
    </Pressable>
  );
}

function AddScheduleSheet({ onClose, visible }: { onClose: () => void; visible: boolean }) {
  function goTo(path: '/owner/schedules/create' | '/owner/sops') {
    onClose();
    router.push(path);
  }

  return (
    <BottomSheet onClose={onClose} title="Tambah jadwal" visible={visible}>
      <View style={styles.sheetRows}>
        <SheetActionRow
          description="Susun jadwal dari awal"
          icon="calendar"
          iconTone="brand"
          onPress={() => goTo('/owner/schedules/create')}
          title="Buat jadwal manual"
        />
        <SheetActionRow
          description="Pakai template yang tersimpan"
          icon="file-text"
          iconTone="neutral"
          onPress={() => goTo('/owner/sops')}
          title="Buat dari SOP"
        />
      </View>
    </BottomSheet>
  );
}

function ScheduleFilterSheet({
  onClose,
  onSourceChange,
  sourceFilter,
  visible,
}: {
  onClose: () => void;
  onSourceChange: (filter: ScheduleSourceFilter) => void;
  sourceFilter: ScheduleSourceFilter;
  visible: boolean;
}) {
  return (
    <BottomSheet onClose={onClose} subtitle="Pilih sumber jadwal." title="Filter jadwal" visible={visible}>
      <View style={styles.filterSheetBody}>
        <Text selectable style={styles.filterLabel}>
          Sumber
        </Text>
        <FilterChipsRow>
          {sourceFilters.map((filter) => (
            <ChipButton
              key={filter.value}
              active={sourceFilter === filter.value}
              label={filter.label}
              onPress={() => onSourceChange(filter.value)}
            />
          ))}
        </FilterChipsRow>
        <Button title="Selesai" variant="secondary" onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

function matchesScheduleFilters(
  schedule: CareSchedule,
  input: {
    detail?: CareScheduleDetail;
    search: string;
    sourceFilter: ScheduleSourceFilter;
    statusFilter: ScheduleStatusFilter;
    workerNames: Record<string, string>;
  }
): boolean {
  if (input.sourceFilter === 'manual' && schedule.careSopId) {
    return false;
  }

  if (input.sourceFilter === 'sop' && !schedule.careSopId) {
    return false;
  }

  const today = getTodayIsoDate();
  const status = getScheduleStatus(schedule, input.detail);

  if (input.statusFilter === 'today' && (schedule.scheduledDate !== today || schedule.isCancelled)) {
    return false;
  }

  if (
    input.statusFilter !== 'all' &&
    input.statusFilter !== 'today' &&
    status !== input.statusFilter
  ) {
    return false;
  }

  if (!input.search) {
    return true;
  }

  const workers = getScheduleWorkerNames(input.detail, input.workerNames).join(' ');
  const searchable = [schedule.title, formatCareTarget(schedule), workers]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return searchable.includes(input.search);
}

function getScheduleStatus(schedule?: CareSchedule, detail?: CareScheduleDetail): ScheduleVisualStatus {
  if (schedule?.isCancelled || detail?.isCancelled) {
    return 'cancelled';
  }

  if (!detail || detail.tasks.length === 0) {
    return 'unfinished';
  }

  if (detail.tasks.every((task) => task.status === 'completed')) {
    return 'completed';
  }

  if (detail.tasks.some((task) => task.status === 'postponed')) {
    return 'postponed';
  }

  return 'unfinished';
}

function formatScheduleStatusLabel(status: ScheduleVisualStatus): string {
  if (status === 'cancelled') {
    return 'Dibatalkan';
  }

  if (status === 'completed') {
    return 'Selesai';
  }

  if (status === 'postponed') {
    return 'Tertunda';
  }

  return 'Belum';
}

function getScheduleStatusTone(status: ScheduleVisualStatus): 'danger' | 'muted' | 'success' | 'warning' {
  if (status === 'cancelled') {
    return 'danger';
  }

  if (status === 'completed') {
    return 'success';
  }

  if (status === 'postponed') {
    return 'warning';
  }

  return 'warning';
}

function getScheduleWorkerNames(
  detail: CareScheduleDetail | undefined,
  workerNames: Record<string, string>
): string[] {
  if (!detail) {
    return [];
  }

  return Array.from(
    new Set(detail.tasks.map((task) => workerNames[task.assignedTo]).filter((name): name is string => Boolean(name)))
  );
}

function getScheduleProgress(detail?: CareScheduleDetail): string {
  if (!detail || detail.tasks.length === 0) {
    return 'Belum ada realisasi';
  }

  const completed = detail.tasks.filter((task) => task.status === 'completed').length;
  const postponed = detail.tasks.filter((task) => task.status === 'postponed').length;
  const suffix = postponed > 0 ? `, ${postponed} tertunda` : '';

  return `${completed}/${detail.tasks.length} selesai${suffix}`;
}

function formatWorkerSummary(workers: string[]): string {
  if (workers.length === 0) {
    return 'Pekerja belum tersedia';
  }

  if (workers.length === 1) {
    return workers[0];
  }

  return `${workers.length} pekerja`;
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
  cardCategory: { ...tokens.type.subheading, color: tokens.color.text.primary, flex: 1 },
  cardTitle: { ...tokens.type.meta, color: tokens.color.text.tertiary, marginTop: tokens.space.xs },
  cardMeta1: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.md,
    marginTop: tokens.space.sm,
  },
  cardMeta2: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.md,
    marginTop: tokens.space.xs,
  },
  cardProgress: { ...tokens.type.meta, color: tokens.color.text.secondary },
  cardAttribute: { ...tokens.type.meta, color: tokens.color.text.secondary },
  cardPhoto: { alignItems: 'center', flexDirection: 'row', gap: tokens.space.xs },

  fab: {
    alignItems: 'center',
    backgroundColor: tokens.color.brand.base,
    borderRadius: tokens.radius.pill,
    height: tokens.layout.controlHeight,
    justifyContent: 'center',
    width: tokens.layout.controlHeight,
  },
  fabPlus: { ...tokens.type.display, color: tokens.color.brand.on },

  sheetRows: { gap: tokens.space.sm },
  filterSheetBody: { gap: tokens.space.md },
  filterLabel: { ...tokens.type.label, color: tokens.color.text.primary },
});
