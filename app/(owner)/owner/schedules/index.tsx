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
  SearchFilterRow,
  SectionHeader,
  Screen,
} from '../../../../src/components/ui';
import { colors, radius, spacing, typography } from '../../../../src/constants/theme';
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
  const [createMenuOpen, setCreateMenuOpen] = React.useState(false);
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [details, setDetails] = React.useState<Record<string, CareScheduleDetail>>({});
  const [error, setError] = React.useState<string | null>(null);
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

  const summary = buildScheduleSummary(schedules, details);
  const displayedSchedules = schedules.filter((schedule) =>
    matchesScheduleFilters(schedule, {
      detail: details[schedule.id],
      search: debouncedSearch,
      sourceFilter,
      statusFilter,
      workerNames,
    })
  );
  const hasActiveFilters = statusFilter !== 'all' || sourceFilter !== 'all';
  const todayIso = getTodayIsoDate();

  function clearFilters() {
    setStatusFilter('all');
    setSourceFilter('all');
  }

  return (
    <Screen
      floatingAction={
        <CreateScheduleFab
          open={createMenuOpen}
          onClose={() => setCreateMenuOpen(false)}
          onToggle={() => setCreateMenuOpen((current) => !current)}
        />
      }
      floatingActionBottom={86}
    >
      <MainTabHeader
        title="Tugas"
        roleLabel="Pemilik"
        subtitle="Pantau jadwal kerja dan perawatan."
        onProfilePress={() => router.push('/owner/profile')}
      />
      <ErrorBanner message={error} />

      <ScheduleHero summary={summary} />

      <SearchFilterRow
        onChangeText={setSearch}
        placeholder="Cari judul, target, atau pekerja"
        value={search}
      />

      <ScheduleFilterControls
        hasActiveFilters={hasActiveFilters}
        onClear={clearFilters}
        onSourceChange={setSourceFilter}
        onStatusChange={setStatusFilter}
        sourceFilter={sourceFilter}
        statusFilter={statusFilter}
      />

      <SectionHeader title="Daftar Jadwal">
        <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text selectable style={{ color: colors.textMuted, fontSize: typography.small.fontSize }}>
            {displayedSchedules.length} jadwal
          </Text>
          <Text selectable style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>
            Terdekat
          </Text>
        </View>
      </SectionHeader>

      {displayedSchedules.length === 0 ? (
        <EmptyState
          title={schedules.length === 0 ? 'Belum ada jadwal.' : 'Tidak ada jadwal pada filter ini.'}
        />
      ) : (
        <View style={{ gap: 10 }}>
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
    </Screen>
  );
}

function ScheduleHero({ summary }: { summary: ReturnType<typeof buildScheduleSummary> }) {
  return (
    <Card variant="heroGreen">
      <View style={{ gap: 4 }}>
        <Text selectable style={{ color: '#DDEFE2', fontSize: 15, fontWeight: '700' }}>
          Hari Ini
        </Text>
        <Text selectable style={{ color: '#FFFFFF', fontSize: 28, fontVariant: ['tabular-nums'], fontWeight: '700' }}>
          {summary.today} jadwal
        </Text>
        <Text selectable style={{ color: '#DDEFE2', lineHeight: 20 }}>
          {summary.unfinished} belum selesai dari seluruh jadwal aktif.
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 9 }}>
        <HeroMetric label="Belum" value={summary.unfinished} tone="warning" />
        <HeroMetric label="Selesai" value={summary.completed} tone="success" />
        <HeroMetric label="Tertunda" value={summary.postponed} tone="warning" />
      </View>
    </Card>
  );
}

function HeroMetric({
  label,
  tone,
  value,
}: {
  label: string;
  tone: 'danger' | 'success' | 'warning';
  value: number;
}) {
  const valueColor = tone === 'success' ? '#A6D96A' : tone === 'danger' ? '#FDA29B' : '#F6D77A';

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
      <Text selectable style={{ color: '#DDEFE2', fontSize: 12, fontWeight: '700' }}>
        {label}
      </Text>
      <Text selectable style={{ color: valueColor, fontSize: 23, fontVariant: ['tabular-nums'], fontWeight: '700' }}>
        {value}
      </Text>
    </View>
  );
}

function ScheduleFilterControls({
  hasActiveFilters,
  onClear,
  onSourceChange,
  onStatusChange,
  sourceFilter,
  statusFilter,
}: {
  hasActiveFilters: boolean;
  onClear: () => void;
  onSourceChange: (filter: ScheduleSourceFilter) => void;
  onStatusChange: (filter: ScheduleStatusFilter) => void;
  sourceFilter: ScheduleSourceFilter;
  statusFilter: ScheduleStatusFilter;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <FilterChipsRow hasActiveFilters={hasActiveFilters} onClear={onClear}>
        {statusFilters.map((filter) => (
          <ChipButton
            key={filter.value}
            active={statusFilter === filter.value}
            label={filter.label}
            onPress={() => onStatusChange(filter.value)}
          />
        ))}
      </FilterChipsRow>
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
    </View>
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
  // RF-11b: penanda jatuh tempo level-jadwal. null → badge status agregat & border
  // kartu persis seperti sebelumnya (nol perubahan bila tidak ada task jatuh tempo).
  dueMarker?: 'overdue' | 'due_today' | null;
  onPress: () => void;
  schedule: CareSchedule;
  workerNames: Record<string, string>;
}) {
  const status = getScheduleStatus(schedule, detail);
  const progress = getScheduleProgress(detail);
  const workers = getScheduleWorkerNames(detail, workerNames);

  return (
    <Pressable onPress={onPress}>
      <Card variant={dueMarker === 'overdue' ? 'danger' : dueMarker === 'due_today' ? 'warning' : 'default'}>
        <View style={{ gap: spacing.sm }}>
          <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: 8, justifyContent: 'space-between' }}>
            <Text
              selectable
              ellipsizeMode="tail"
              numberOfLines={1}
              style={{ color: colors.primary, flex: 1, fontSize: 17, fontWeight: '700' }}
            >
              {schedule.title}
            </Text>
            {dueMarker === 'overdue' ? (
              <Badge label="Terlambat" maxWidth={116} tone="danger" />
            ) : dueMarker === 'due_today' ? (
              <Badge label="Hari ini" maxWidth={116} tone="warning" />
            ) : (
              <Badge label={formatScheduleStatusLabel(status)} maxWidth={116} tone={getScheduleStatusTone(status)} />
            )}
          </View>

          <View style={{ alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Text selectable numberOfLines={1} style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
              {formatCareCategory(schedule.category)}
            </Text>
            {schedule.careSopId ? <Badge label="SOP" maxWidth={64} tone="warning" /> : null}
            {schedule.requiresPhoto ? <ProofPhotoIndicator /> : null}
          </View>

          <ScheduleCardMeta
            date={formatDate(schedule.scheduledDate)}
            progress={progress}
            target={formatCareTarget(schedule)}
            workers={workers}
          />
        </View>
      </Card>
    </Pressable>
  );
}

function ScheduleCardMeta({
  date,
  progress,
  target,
  workers,
}: {
  date: string;
  progress: string;
  target: string;
  workers: string[];
}) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <CompactMetaItem icon="calendar" label={date} />
        <CompactMetaItem icon="target" label={target} />
      </View>
      <View style={{ alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <CompactMetaItem icon="user" label={formatWorkerSummary(workers)} />
        <Text selectable numberOfLines={1} style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
          {progress}
        </Text>
      </View>
    </View>
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

function CreateScheduleFab({
  onClose,
  onToggle,
  open,
}: {
  onClose: () => void;
  onToggle: () => void;
  open: boolean;
}) {
  function goTo(path: '/owner/sops' | '/owner/schedules/create') {
    onClose();
    router.push(path);
  }

  return (
    <View style={{ alignItems: 'flex-end', gap: spacing.sm }}>
      {open ? (
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderCurve: 'continuous',
            borderRadius: radius.lg,
            borderWidth: 1,
            gap: spacing.sm,
            padding: spacing.sm,
            width: 178,
          }}
        >
          <CreateMenuButton label="Dari SOP" onPress={() => goTo('/owner/sops')} />
          <CreateMenuButton label="Buat Jadwal" primary onPress={() => goTo('/owner/schedules/create')} />
        </View>
      ) : null}
      <Pressable
        accessibilityLabel="Buat jadwal"
        accessibilityRole="button"
        onPress={onToggle}
        style={{
          alignItems: 'center',
          backgroundColor: colors.primary,
          borderColor: colors.primaryBorder,
          borderRadius: 999,
          borderWidth: 1,
          height: 58,
          justifyContent: 'center',
          width: 58,
        }}
      >
        <Text selectable={false} style={{ color: '#FFFFFF', fontSize: open ? 28 : 36, fontWeight: '400', lineHeight: 40 }}>
          {open ? 'x' : '+'}
        </Text>
      </Pressable>
    </View>
  );
}

function CreateMenuButton({
  label,
  onPress,
  primary,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: primary ? colors.primary : colors.primarySoft,
        borderColor: primary ? colors.primary : colors.primaryBorder,
        borderCurve: 'continuous',
        borderRadius: radius.button,
        borderWidth: 1,
        minHeight: 42,
        justifyContent: 'center',
        paddingHorizontal: spacing.md,
      }}
    >
      <Text selectable={false} style={{ color: primary ? colors.surface : colors.primary, fontSize: 14, fontWeight: '700' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function buildScheduleSummary(
  schedules: CareSchedule[],
  details: Record<string, CareScheduleDetail>
): { completed: number; postponed: number; today: number; unfinished: number } {
  const today = getTodayIsoDate();
  const activeSchedules = schedules.filter((schedule) => !schedule.isCancelled);
  const statuses = activeSchedules.map((schedule) => getScheduleStatus(schedule, details[schedule.id]));

  return {
    completed: statuses.filter((status) => status === 'completed').length,
    postponed: statuses.filter((status) => status === 'postponed').length,
    today: activeSchedules.filter((schedule) => schedule.scheduledDate === today).length,
    unfinished: statuses.filter((status) => status === 'unfinished').length,
  };
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
