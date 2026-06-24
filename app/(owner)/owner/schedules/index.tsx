import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { formatCareTarget } from '../../../../src/components/care-schedule-components';
import {
  appTheme,
  Badge,
  Button,
  Card,
  ChipButton,
  EmptyState,
  ErrorBanner,
  LoadingState,
  Screen,
} from '../../../../src/components/ui';
import { useAuth } from '../../../../src/context/auth-context';
import { getCareScheduleDetail, getCareSchedules } from '../../../../src/services/careScheduleService';
import { getFarmMemberBasicProfiles } from '../../../../src/services/memberService';
import type { CareSchedule, CareScheduleDetail, FarmMemberBasicProfile } from '../../../../src/types/domain';

type ScheduleStatusFilter = 'all' | 'today' | 'unfinished' | 'completed' | 'postponed';
type ScheduleSourceFilter = 'all' | 'manual' | 'sop';
type ScheduleVisualStatus = 'completed' | 'postponed' | 'unfinished';

const statusFilters: Array<{ label: string; value: ScheduleStatusFilter }> = [
  { label: 'Semua', value: 'all' },
  { label: 'Hari ini', value: 'today' },
  { label: 'Belum selesai', value: 'unfinished' },
  { label: 'Selesai', value: 'completed' },
  { label: 'Tertunda', value: 'postponed' },
];

const sourceFilters: Array<{ label: string; value: ScheduleSourceFilter }> = [
  { label: 'Semua', value: 'all' },
  { label: 'Manual', value: 'manual' },
  { label: 'Dari SOP', value: 'sop' },
];

export default function CareScheduleListScreen() {
  const { currentFarm } = useAuth();
  const [createMenuOpen, setCreateMenuOpen] = React.useState(false);
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [details, setDetails] = React.useState<Record<string, CareScheduleDetail>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [filterOpen, setFilterOpen] = React.useState(false);
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

  return (
    <Screen
      floatingAction={<FloatingAddButton onPress={() => setCreateMenuOpen(true)} />}
      floatingActionBottom={86}
    >
      <View style={{ gap: 5, paddingTop: 6 }}>
        <Text selectable style={{ color: appTheme.primary, fontSize: 31, fontWeight: '900', letterSpacing: 0 }}>
          Agenda Kebun
        </Text>
        <Text selectable style={{ color: appTheme.muted, fontSize: 15, lineHeight: 22 }}>
          Pantau jadwal kerja dan perawatan yang perlu diselesaikan.
        </Text>
      </View>
      <ErrorBanner message={error} />

      <ScheduleHero summary={summary} />

      <SearchFilterBar
        onFilterPress={() => setFilterOpen(true)}
        onSearchChange={setSearch}
        search={search}
      />

      <ActiveFilterSummary
        sourceFilter={sourceFilter}
        statusFilter={statusFilter}
        total={displayedSchedules.length}
      />

      <ScheduleFilterSheet
        onClose={() => setFilterOpen(false)}
        onSourceChange={setSourceFilter}
        onStatusChange={setStatusFilter}
        sourceFilter={sourceFilter}
        statusFilter={statusFilter}
        visible={filterOpen}
      />

      <CreateScheduleMenu
        onClose={() => setCreateMenuOpen(false)}
        visible={createMenuOpen}
      />

      <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text selectable style={{ color: appTheme.text, fontSize: 19, fontWeight: '900' }}>
          Daftar Jadwal
        </Text>
        <Text selectable style={{ color: appTheme.primary, fontSize: 13, fontWeight: '800' }}>
          Terdekat
        </Text>
      </View>

      {displayedSchedules.length === 0 ? (
        <EmptyState
          title={schedules.length === 0 ? 'Belum ada jadwal' : 'Tidak ada jadwal pada pencarian ini'}
          subtitle="Buat jadwal dari SOP atau manual untuk menghasilkan tugas pekerja."
        />
      ) : (
        <View style={{ gap: 10 }}>
          {displayedSchedules.map((schedule) => (
            <CompactScheduleCard
              key={schedule.id}
              detail={details[schedule.id]}
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
    <View
      style={{
        backgroundColor: appTheme.primary,
        borderRadius: 18,
        gap: 16,
        overflow: 'hidden',
        padding: 18,
      }}
    >
      <View style={{ gap: 4 }}>
        <Text selectable style={{ color: '#DDEFE2', fontSize: 15, fontWeight: '800' }}>
          Hari Ini
        </Text>
        <Text selectable style={{ color: '#FFFFFF', fontSize: 28, fontVariant: ['tabular-nums'], fontWeight: '900' }}>
          {summary.today} jadwal
        </Text>
        <Text selectable style={{ color: '#DDEFE2', lineHeight: 20 }}>
          {summary.unfinished} belum selesai dari seluruh jadwal aktif.
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 9 }}>
        <HeroMetric label="Belum" value={summary.unfinished} tone="warning" />
        <HeroMetric label="Selesai" value={summary.completed} tone="success" />
        <HeroMetric label="Tertunda" value={summary.postponed} tone="danger" />
      </View>
    </View>
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
        borderRadius: 14,
        borderWidth: 1,
        flex: 1,
        gap: 3,
        padding: 11,
      }}
    >
      <Text selectable style={{ color: '#DDEFE2', fontSize: 12, fontWeight: '800' }}>
        {label}
      </Text>
      <Text selectable style={{ color: valueColor, fontSize: 23, fontVariant: ['tabular-nums'], fontWeight: '900' }}>
        {value}
      </Text>
    </View>
  );
}

function SearchFilterBar({
  onFilterPress,
  onSearchChange,
  search,
}: {
  onFilterPress: () => void;
  onSearchChange: (value: string) => void;
  search: string;
}) {
  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: 10 }}>
      <View
        style={{
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          borderColor: '#DCE7D5',
          borderRadius: 15,
          borderWidth: 1,
          flex: 1,
          flexDirection: 'row',
          minHeight: 54,
          paddingLeft: 14,
        }}
      >
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={onSearchChange}
          placeholder="Cari judul, target, atau pekerja"
          placeholderTextColor="#94A098"
          style={{ color: '#1E2A24', flex: 1, fontSize: 15, minHeight: 52, paddingHorizontal: 12 }}
          value={search}
        />
      </View>
      <Pressable
        accessibilityLabel="Buka filter jadwal"
        accessibilityRole="button"
        onPress={onFilterPress}
        style={{
          alignItems: 'center',
          backgroundColor: appTheme.primary,
          borderRadius: 15,
          height: 54,
          justifyContent: 'center',
          width: 54,
        }}
      >
        <FilterGlyph />
      </Pressable>
    </View>
  );
}

function ActiveFilterSummary({
  sourceFilter,
  statusFilter,
  total,
}: {
  sourceFilter: ScheduleSourceFilter;
  statusFilter: ScheduleStatusFilter;
  total: number;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -6 }}>
      <Badge label={`${total} jadwal`} tone="muted" />
      {statusFilter !== 'all' ? <Badge label={getStatusFilterLabel(statusFilter)} tone="success" /> : null}
      {sourceFilter !== 'all' ? <Badge label={getSourceFilterLabel(sourceFilter)} tone="warning" /> : null}
    </View>
  );
}

function CompactScheduleCard({
  detail,
  onPress,
  schedule,
  workerNames,
}: {
  detail?: CareScheduleDetail;
  onPress: () => void;
  schedule: CareSchedule;
  workerNames: Record<string, string>;
}) {
  const status = getScheduleStatus(detail);
  const workers = getScheduleWorkerNames(detail, workerNames);

  return (
    <Pressable onPress={onPress}>
      <Card>
        <View style={{ gap: 8 }}>
          <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: 8, justifyContent: 'space-between' }}>
            <Text
              selectable
              ellipsizeMode="tail"
              numberOfLines={1}
              style={{ color: appTheme.primary, flex: 1, fontSize: 17, fontWeight: '900' }}
            >
                {schedule.title}
            </Text>
            <Badge label={formatScheduleStatusLabel(status)} maxWidth={116} tone={getScheduleStatusTone(status)} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            <Badge label={schedule.careSopId ? 'Dari SOP' : 'Manual'} maxWidth={96} tone={schedule.careSopId ? 'warning' : 'muted'} />
          </View>
          <ScheduleCardMeta
            date={formatDate(schedule.scheduledDate)}
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
  target,
  workers,
}: {
  date: string;
  target: string;
  workers: string[];
}) {
  return (
    <View style={{ gap: 4 }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 10 }}>
        <MetadataItem icon="calendar" label={date} />
        <MetadataItem icon="target" label={target} />
      </View>
      {workers.length > 0 ? (
        <MetadataItem icon="user" label={workers.join(', ')} />
      ) : null}
    </View>
  );
}

function MetadataItem({ icon, label }: { icon: 'calendar' | 'target' | 'user'; label: string }) {
  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: 5 }}>
      <MetadataIcon name={icon} />
      <Text selectable ellipsizeMode="tail" numberOfLines={1} style={{ color: appTheme.muted, flexShrink: 1, fontSize: 13, lineHeight: 18 }}>
        {label}
      </Text>
    </View>
  );
}

function MetadataIcon({ name }: { name: 'calendar' | 'target' | 'user' }) {
  const color = '#68746D';

  if (name === 'calendar') {
    return (
      <View style={{ borderColor: color, borderRadius: 3, borderWidth: 1.5, height: 14, width: 13 }}>
        <View style={{ backgroundColor: color, height: 1.5, marginTop: 3 }} />
      </View>
    );
  }

  if (name === 'target') {
    return (
      <View style={{ alignItems: 'center', borderColor: color, borderRadius: 999, borderWidth: 1.5, height: 14, justifyContent: 'center', width: 14 }}>
        <View style={{ borderColor: color, borderRadius: 999, borderWidth: 1.5, height: 6, width: 6 }} />
      </View>
    );
  }

  return (
    <View style={{ alignItems: 'center', width: 14 }}>
      <View style={{ borderColor: color, borderRadius: 999, borderWidth: 1.5, height: 6, width: 6 }} />
      <View style={{ borderColor: color, borderRadius: 999, borderWidth: 1.5, height: 6, marginTop: -1, width: 12 }} />
    </View>
  );
}

function ScheduleFilterSheet({
  onClose,
  onSourceChange,
  onStatusChange,
  sourceFilter,
  statusFilter,
  visible,
}: {
  onClose: () => void;
  onSourceChange: (filter: ScheduleSourceFilter) => void;
  onStatusChange: (filter: ScheduleStatusFilter) => void;
  sourceFilter: ScheduleSourceFilter;
  statusFilter: ScheduleStatusFilter;
  visible: boolean;
}) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={{ backgroundColor: 'rgba(30,42,36,0.12)', flex: 1 }} onPress={onClose} />
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          gap: 18,
          paddingBottom: 28,
          paddingHorizontal: 20,
          paddingTop: 10,
        }}
      >
        <View style={{ alignSelf: 'center', backgroundColor: '#DCE7D5', borderRadius: 999, height: 5, width: 48 }} />
        <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text selectable style={{ color: appTheme.text, fontSize: 20, fontWeight: '900' }}>
            Filter Jadwal
          </Text>
          <SheetDoneButton onPress={onClose} />
        </View>

        <FilterSection title="Status">
          {statusFilters.map((filter) => (
            <ChipButton
              key={filter.value}
              active={statusFilter === filter.value}
              label={filter.label}
              onPress={() => onStatusChange(filter.value)}
            />
          ))}
        </FilterSection>

        <FilterSection title="Sumber">
          {sourceFilters.map((filter) => (
            <ChipButton
              key={filter.value}
              active={sourceFilter === filter.value}
              label={filter.label}
              onPress={() => onSourceChange(filter.value)}
            />
          ))}
        </FilterSection>
      </View>
    </Modal>
  );
}

function CreateScheduleMenu({ onClose, visible }: { onClose: () => void; visible: boolean }) {
  function goTo(path: '/owner/sops' | '/owner/schedules/create') {
    onClose();
    router.push(path);
  }

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={{ backgroundColor: 'rgba(30,42,36,0.12)', flex: 1 }} onPress={onClose} />
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          gap: 12,
          paddingBottom: 28,
          paddingHorizontal: 20,
          paddingTop: 10,
        }}
      >
        <View style={{ alignSelf: 'center', backgroundColor: '#DCE7D5', borderRadius: 999, height: 5, width: 48 }} />
        <Text selectable style={{ color: appTheme.text, fontSize: 20, fontWeight: '900' }}>
          Buat Jadwal
        </Text>
        <Text selectable style={{ color: appTheme.muted, lineHeight: 20 }}>
          Pilih sumber jadwal perawatan.
        </Text>
        <Button title="Buat dari SOP" onPress={() => goTo('/owner/sops')} />
        <Button title="Buat Manual" variant="secondary" onPress={() => goTo('/owner/schedules/create')} />
      </View>
    </Modal>
  );
}

function FilterSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View style={{ gap: 9 }}>
      <Text selectable style={{ color: appTheme.text, fontSize: 15, fontWeight: '800' }}>
        {title}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
    </View>
  );
}

function SheetDoneButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: appTheme.primarySoft,
        borderColor: '#B8D8BF',
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 15,
        paddingVertical: 9,
      }}
    >
      <Text selectable style={{ color: appTheme.primary, fontSize: 14, fontWeight: '900' }}>
        Selesai
      </Text>
    </Pressable>
  );
}

function FloatingAddButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Buat jadwal"
      accessibilityRole="button"
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: appTheme.primary,
        borderColor: '#B8D8BF',
        borderRadius: 999,
        borderWidth: 1,
        height: 58,
        justifyContent: 'center',
        width: 58,
      }}
    >
      <Text selectable style={{ color: '#FFFFFF', fontSize: 36, fontWeight: '400', lineHeight: 40 }}>
        +
      </Text>
    </Pressable>
  );
}

function FilterGlyph() {
  return (
    <View style={{ gap: 4 }}>
      <SliderGlyphLine knobLeft={3} />
      <SliderGlyphLine knobLeft={12} />
      <SliderGlyphLine knobLeft={7} />
    </View>
  );
}

function SliderGlyphLine({ knobLeft }: { knobLeft: number }) {
  return (
    <View style={{ height: 4, justifyContent: 'center', width: 22 }}>
      <View style={{ backgroundColor: '#DDEFE2', borderRadius: 999, height: 2, width: 22 }} />
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 999,
          height: 6,
          left: knobLeft,
          position: 'absolute',
          width: 6,
        }}
      />
    </View>
  );
}

function buildScheduleSummary(
  schedules: CareSchedule[],
  details: Record<string, CareScheduleDetail>
): { completed: number; postponed: number; today: number; unfinished: number } {
  const today = getTodayIsoDate();
  const statuses = schedules.map((schedule) => getScheduleStatus(details[schedule.id]));

  return {
    completed: statuses.filter((status) => status === 'completed').length,
    postponed: statuses.filter((status) => status === 'postponed').length,
    today: schedules.filter((schedule) => schedule.scheduledDate === today).length,
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
  const status = getScheduleStatus(input.detail);

  if (input.statusFilter === 'today' && schedule.scheduledDate !== today) {
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

function getScheduleStatus(detail?: CareScheduleDetail): ScheduleVisualStatus {
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
  if (status === 'completed') {
    return 'Selesai';
  }

  if (status === 'postponed') {
    return 'Tertunda';
  }

  return 'Belum selesai';
}

function getScheduleStatusTone(status: ScheduleVisualStatus): 'danger' | 'muted' | 'success' | 'warning' {
  if (status === 'completed') {
    return 'success';
  }

  if (status === 'postponed') {
    return 'danger';
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

function getStatusFilterLabel(filter: ScheduleStatusFilter): string {
  return statusFilters.find((item) => item.value === filter)?.label ?? 'Semua';
}

function getSourceFilterLabel(filter: ScheduleSourceFilter): string {
  return sourceFilters.find((item) => item.value === filter)?.label ?? 'Semua';
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
