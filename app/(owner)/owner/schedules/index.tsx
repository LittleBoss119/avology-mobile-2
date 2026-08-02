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
  FloatingActionButton,
  LoadingState,
  MainTabHeader,
  Screen,
  SearchFilterRow,
} from '../../../../src/components/ui';
import { statusColors, tokens } from '../../../../src/constants/theme';
import { useAuth } from '../../../../src/context/auth-context';
import { getCareScheduleDetail, getCareSchedules } from '../../../../src/services/careScheduleService';
import { getFarmMemberBasicProfiles } from '../../../../src/services/memberService';
import type { CareSchedule, CareScheduleDetail, FarmMemberBasicProfile, TargetType } from '../../../../src/types/domain';
import { formatTargetType } from '../../../../src/utils/displayFormat';
import { scheduleTimeBucket, type TimeBucket } from '../../../../src/utils/taskDueDate';

type TimeFilter = 'all' | 'today' | 'overdue' | 'upcoming';
type ScheduleSourceFilter = 'all' | 'manual' | 'sop';
type ScheduleTargetFilter = 'all' | TargetType;
type ScheduleVisualStatus = 'cancelled' | 'completed' | 'postponed' | 'unfinished';

// Empat sumbu filter yang saling bebas: timeFilter (baris chip) + tiga+satu grup di sheet.
type SheetCriteria = {
  statuses: ScheduleVisualStatus[]; // array kosong = semua status
  source: ScheduleSourceFilter;
  target: ScheduleTargetFilter;
  worker: string; // 'all' | userId
};

const DEFAULT_CRITERIA: SheetCriteria = {
  source: 'all',
  statuses: [],
  target: 'all',
  worker: 'all',
};

const timeFilters: Array<{ label: string; value: TimeFilter }> = [
  { label: 'Semua', value: 'all' },
  { label: 'Hari ini', value: 'today' },
  { label: 'Terlambat', value: 'overdue' },
  { label: 'Mendatang', value: 'upcoming' },
];

const statusOptions: Array<{ label: string; value: ScheduleVisualStatus }> = [
  { label: 'Belum', value: 'unfinished' },
  { label: 'Ditunda', value: 'postponed' },
  { label: 'Selesai', value: 'completed' },
  { label: 'Dibatalkan', value: 'cancelled' },
];

const sourceFilters: Array<{ label: string; value: ScheduleSourceFilter }> = [
  { label: 'Semua', value: 'all' },
  { label: 'Manual', value: 'manual' },
  { label: 'SOP', value: 'sop' },
];

const targetOptions: Array<{ label: string; value: ScheduleTargetFilter }> = [
  { label: 'Semua', value: 'all' },
  { label: formatTargetType('farm'), value: 'farm' },
  { label: formatTargetType('row'), value: 'row' },
  { label: formatTargetType('column'), value: 'column' },
  { label: formatTargetType('tree'), value: 'tree' },
  { label: formatTargetType('custom'), value: 'custom' },
];

export default function CareScheduleListScreen() {
  const { currentFarm } = useAuth();
  const [addSheetOpen, setAddSheetOpen] = React.useState(false);
  const [criteria, setCriteria] = React.useState<SheetCriteria>(DEFAULT_CRITERIA);
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [details, setDetails] = React.useState<Record<string, CareScheduleDetail>>({});
  const [draft, setDraft] = React.useState<SheetCriteria>(DEFAULT_CRITERIA);
  const [error, setError] = React.useState<string | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [schedules, setSchedules] = React.useState<CareSchedule[]>([]);
  const [search, setSearch] = React.useState('');
  const [timeFilter, setTimeFilter] = React.useState<TimeFilter>('all');
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

  // Ember waktu dihitung SEKALI per jadwal, lalu dipakai ulang untuk chip waktu,
  // badge kartu, dan urutan daftar — satu sumber kebenaran, tidak dua definisi.
  const buckets: Record<string, TimeBucket> = {};
  for (const schedule of schedules) {
    buckets[schedule.id] = getScheduleBucket(schedule, details[schedule.id], todayIso);
  }

  function matchesSchedule(schedule: CareSchedule, sheet: SheetCriteria): boolean {
    if (timeFilter !== 'all' && buckets[schedule.id] !== timeFilter) {
      return false;
    }

    if (
      sheet.statuses.length > 0 &&
      !sheet.statuses.includes(getScheduleStatus(schedule, details[schedule.id]))
    ) {
      return false;
    }

    if (sheet.source === 'manual' && schedule.careSopId) {
      return false;
    }

    if (sheet.source === 'sop' && !schedule.careSopId) {
      return false;
    }

    if (sheet.target !== 'all' && schedule.targetType !== sheet.target) {
      return false;
    }

    if (sheet.worker !== 'all') {
      const detail = details[schedule.id];
      if (!detail || !detail.tasks.some((task) => task.assignedTo === sheet.worker)) {
        return false;
      }
    }

    if (debouncedSearch) {
      const workers = getScheduleWorkerNames(details[schedule.id], workerNames).join(' ');
      const searchable = [schedule.title, formatCareTarget(schedule), workers]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (!searchable.includes(debouncedSearch)) {
        return false;
      }
    }

    return true;
  }

  // Urutan: 'overdue' → paling lama telat di atas (tanggal terlama dulu);
  // 'today'/'upcoming'/'all' → paling dekat di atas (tanggal terdekat dulu).
  // Kedua definisi tersebut sama-sama scheduledDate menaik.
  const displayedSchedules = schedules
    .filter((schedule) => matchesSchedule(schedule, criteria))
    .sort((a, b) => (a.scheduledDate < b.scheduledDate ? -1 : a.scheduledDate > b.scheduledDate ? 1 : 0));

  const activeGroupCount =
    (criteria.statuses.length > 0 ? 1 : 0) +
    (criteria.source !== 'all' ? 1 : 0) +
    (criteria.target !== 'all' ? 1 : 0) +
    (criteria.worker !== 'all' ? 1 : 0);

  // "Pekerja" hanya menawarkan pekerja yang BENAR-BENAR ditugaskan pada jadwal
  // kebun ini (dari details yang sudah di-fetch), bukan seluruh anggota kebun —
  // getFarmMemberBasicProfiles memuat semua status (pending/rejected/removed) +
  // owner, sehingga peta workerNames tak layak jadi sumber opsi filter pekerja.
  const assignedWorkerIds = new Set<string>();
  for (const schedule of schedules) {
    const detail = details[schedule.id];
    if (!detail) {
      continue;
    }
    for (const task of detail.tasks) {
      if (workerNames[task.assignedTo]) {
        assignedWorkerIds.add(task.assignedTo);
      }
    }
  }
  const workerOptions: Array<{ label: string; value: string }> = [
    { label: 'Semua', value: 'all' },
    ...Array.from(assignedWorkerIds)
      .map((userId) => ({ label: workerNames[userId], value: userId }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];

  const hasNoData = schedules.length === 0;

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
      floatingAction={<FloatingActionButton label="Tambah jadwal" onPress={() => setAddSheetOpen(true)} />}
      header={
        <MainTabHeader
          title="Jadwal"
          roleLabel="Pemilik"
          onProfilePress={() => router.push('/owner/profile')}
        />
      }
    >
      <ErrorBanner message={error} />

      {error ? null : hasNoData ? (
        <EmptyState
          icon="calendar-plus"
          subtitle="Buat jadwal pertama untuk kebun kamu."
          title="Belum ada jadwal"
          variant="plain"
        />
      ) : (
        <>
          <SearchFilterRow
            filterActive={activeGroupCount > 0}
            filterCount={activeGroupCount}
            onChangeText={setSearch}
            onFilterPress={openFilterSheet}
            placeholder="Cari judul, target, atau pekerja"
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
            {`Menampilkan ${displayedSchedules.length} jadwal`}
          </Text>

          {displayedSchedules.length === 0 ? (
            debouncedSearch.length > 0 ? (
              <EmptyState
                icon="search"
                subtitle={`Tidak ada jadwal yang cocok dengan "${search.trim()}".`}
                title="Tidak ada hasil"
                variant="plain"
              />
            ) : (
              <EmptyState
                icon="filter"
                subtitle="Tidak ada jadwal dengan filter yang aktif."
                title="Tidak ada yang cocok"
                variant="plain"
              />
            )
          ) : (
            <View style={styles.list}>
              {displayedSchedules.map((schedule) => (
                <CompactScheduleCard
                  key={schedule.id}
                  bucket={buckets[schedule.id]}
                  detail={details[schedule.id]}
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
        draft={draft}
        onApply={applyDraft}
        onClose={() => setFilterSheetOpen(false)}
        onDraftChange={setDraft}
        visible={filterSheetOpen}
        workerOptions={workerOptions}
      />
    </Screen>
  );
}

function CompactScheduleCard({
  bucket,
  detail,
  onPress,
  schedule,
  workerNames,
}: {
  // RF-11b/ember waktu: dihitung di layar sekali per jadwal, dipakai untuk badge di sini.
  bucket: TimeBucket;
  detail?: CareScheduleDetail;
  onPress: () => void;
  schedule: CareSchedule;
  workerNames: Record<string, string>;
}) {
  const status = getScheduleStatus(schedule, detail);
  const workers = getScheduleWorkerNames(detail, workerNames);
  const taskCount = detail?.tasks.length ?? 0;
  const hasTitle = Boolean(schedule.title);
  const showAttributes = schedule.requiresPhoto || Boolean(schedule.careSopId);

  const badge =
    bucket === 'overdue' ? (
      <Badge label="Terlambat" maxWidth={116} tone="danger" />
    ) : (
      <Badge label={formatScheduleStatusLabel(status)} maxWidth={116} tone={getScheduleStatusTone(status)} />
    );

  const metaRow = (
    <View style={styles.cardMeta1}>
      <CompactMetaItem icon="calendar" label={formatDate(schedule.scheduledDate)} />
      <CompactMetaItem icon="target" label={formatCareTarget(schedule)} />
      {taskCount > 1 ? (
        <Text selectable numberOfLines={1} style={styles.cardProgress}>
          {getScheduleProgress(detail)}
        </Text>
      ) : null}
    </View>
  );

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card} variant="default">
        {hasTitle ? (
          <>
            <View style={styles.cardRow1}>
              <Text selectable numberOfLines={1} style={[styles.cardTitle, styles.cardTitleFlex]}>
                {schedule.title}
              </Text>
              {badge}
            </View>
            {/* Kategori digugus dengan baris meta: jarak judul→kategori (card gap) lebih besar dari kategori→meta (xs). */}
            <View style={styles.categoryMetaGroup}>
              <Text selectable numberOfLines={1} style={styles.cardCategory}>
                {formatCareCategory(schedule.category)}
              </Text>
              {metaRow}
            </View>
          </>
        ) : (
          <>
            <View style={styles.cardRow1}>
              <Text selectable numberOfLines={1} style={[styles.cardTitle, styles.cardTitleFlex]}>
                {formatCareCategory(schedule.category)}
              </Text>
              {badge}
            </View>
            {metaRow}
          </>
        )}

        {showAttributes ? (
          <View style={styles.cardAttributes}>
            {schedule.requiresPhoto ? (
              <View style={styles.proofPill}>
                <Icon name="camera" size={tokens.icon.xs} color={statusColors.warning.text} />
                <Text selectable={false} style={styles.proofPillText}>
                  Butuh bukti
                </Text>
              </View>
            ) : null}
            {schedule.careSopId ? (
              <View style={styles.sopPill}>
                <Text selectable={false} style={styles.sopPillText}>
                  SOP
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.cardMeta2}>
          <CompactMetaItem icon="user" label={formatWorkerSummary(workers)} />
        </View>
      </Card>
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
  draft,
  onApply,
  onClose,
  onDraftChange,
  visible,
  workerOptions,
}: {
  draft: SheetCriteria;
  onApply: () => void;
  onClose: () => void;
  onDraftChange: (next: SheetCriteria) => void;
  visible: boolean;
  workerOptions: Array<{ label: string; value: string }>;
}) {
  const isDefault =
    draft.statuses.length === 0 &&
    draft.source === 'all' &&
    draft.target === 'all' &&
    draft.worker === 'all';

  function toggleStatus(value: ScheduleVisualStatus) {
    const nextStatuses = draft.statuses.includes(value)
      ? draft.statuses.filter((status) => status !== value)
      : [...draft.statuses, value];
    onDraftChange({ ...draft, statuses: nextStatuses });
  }

  return (
    <BottomSheet onClose={onClose} title="Filter jadwal" visible={visible}>
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
            Sumber
          </Text>
          <FilterChipsRow>
            {sourceFilters.map((filter) => (
              <ChipButton
                key={filter.value}
                active={draft.source === filter.value}
                label={filter.label}
                onPress={() => onDraftChange({ ...draft, source: filter.value })}
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

        <View style={styles.filterGroup}>
          <Text selectable style={styles.filterLabel}>
            Pekerja
          </Text>
          <FilterChipsRow>
            {workerOptions.map((option) => (
              <ChipButton
                key={option.value}
                active={draft.worker === option.value}
                label={option.label}
                onPress={() => onDraftChange({ ...draft, worker: option.value })}
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

// Ember waktu level-jadwal via scheduleTimeBucket bila detail (tasks) sudah termuat.
function getScheduleBucket(
  schedule: CareSchedule,
  detail: CareScheduleDetail | undefined,
  todayIso: string
): TimeBucket {
  if (detail) {
    return scheduleTimeBucket(schedule, detail.tasks, todayIso);
  }

  // Fallback transien sampai detail termuat: pakai scheduledDate jadwal dengan aturan yang sama.
  if (schedule.isCancelled) {
    return 'inactive';
  }

  if (schedule.scheduledDate < todayIso) {
    return 'overdue';
  }

  if (schedule.scheduledDate === todayIso) {
    return 'today';
  }

  return 'upcoming';
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
    return 'Ditunda';
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

  // 'warning' khusus untuk 'Ditunda'; 'Belum' (unfinished) pakai 'muted' (seragam dgn layar pekerja).
  return 'muted';
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
  const suffix = postponed > 0 ? `, ${postponed} ditunda` : '';

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

  card: { gap: tokens.space.sm },
  categoryMetaGroup: { gap: tokens.space.xs },
  cardRow1: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.space.sm,
    justifyContent: 'space-between',
  },
  cardCategory: { ...tokens.type.meta, color: tokens.color.text.tertiary },
  cardTitle: { ...tokens.type.subheading, color: tokens.color.text.primary },
  cardTitleFlex: { flex: 1 },
  cardMeta1: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.md,
  },
  cardMeta2: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.md,
  },
  cardProgress: { ...tokens.type.meta, color: tokens.color.text.secondary },

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
  sopPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
    borderColor: tokens.color.line.card,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 2,
  },
  sopPillText: { ...tokens.type.caption, color: tokens.color.text.tertiary },

  sheetRows: { gap: tokens.space.sm },
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
