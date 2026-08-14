import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '../../../../src/components/bottom-sheet';
import { formatCareTarget } from '../../../../src/components/care-schedule-components';
import { Icon } from '../../../../src/components/icons';
import {
  Badge,
  Button,
  ChipButton,
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
import { getCareSchedulesWithTasks } from '../../../../src/services/careScheduleService';
import { getFarmMemberBasicProfiles } from '../../../../src/services/memberService';
import type { CareScheduleDetail, FarmMemberBasicProfile, TargetType } from '../../../../src/types/domain';
import { formatCareCategory, formatTargetType } from '../../../../src/utils/displayFormat';
import {
  addDaysToIsoDate,
  dayDifference,
  formatAgendaSectionTitle,
  getTodayIsoDate,
  scheduleTimeBucket,
  type TimeBucket,
} from '../../../../src/utils/taskDueDate';

// Sumbu waktu sekarang dinyatakan oleh struktur section (Terlambat + per
// tanggal), bukan chip. Yang tersisa di baris chip hanya pemisah agenda-vs-arsip.
type CompletionFilter = 'unfinished' | 'completed';
type ScheduleTargetFilter = 'all' | TargetType;

// Dua sumbu filter di sheet, saling bebas. Sumbu "Status" DIHAPUS: chip
// Belum selesai/Selesai di baris atas sudah menyatakannya, dan menjalankan
// keduanya bersamaan menghasilkan kombinasi mati seperti "Belum selesai" +
// status "Selesai" yang selalu nol baris tanpa penjelasan. Sumbu "Sumber"
// (Manual/SOP) DIHAPUS bersama fitur SOP di migrasi 046 — kolom care_sop_id
// yang membedakan keduanya sudah tidak ada, jadi semua jadwal kini manual.
type SheetCriteria = {
  target: ScheduleTargetFilter;
  worker: string; // 'all' | userId
};

const DEFAULT_CRITERIA: SheetCriteria = {
  target: 'all',
  worker: 'all',
};

// "Selesai" juga menampung jadwal yang DIBATALKAN: keduanya sama-sama bukan
// pekerjaan yang masih menunggu, dan membiarkan yang dibatalkan di daftar agenda
// membuat "Belum selesai" berisi baris yang tidak bisa dikerjakan siapa pun.
// Baris yang dibatalkan tetap memakai badge "Dibatalkan" supaya tidak tertukar
// dengan yang benar-benar selesai. Lihat catatan di laporan Tahap E.
const completionFilters: Array<{ label: string; value: CompletionFilter }> = [
  { label: 'Belum selesai', value: 'unfinished' },
  { label: 'Selesai', value: 'completed' },
];

// Jendela pengambilan untuk agenda "Belum selesai": 180 hari ke belakang.
//
// Kenapa 180 dan bukan 30/90: rantai berulang terpanjang yang masuk akal untuk
// kebun adalah perawatan semesteran, jadi satu siklus penuh apa pun pasti muat
// di dalam jendela ini. Jadwal yang dibuat manual jauh di masa lalu pun masih
// terlihat selama masih dalam setengah tahun terakhir.
//
// Jendela ini TIDAK dipakai sebagai penentu kebenaran daftar — jadwal yang lebih
// tua tapi tugasnya masih terbuka tetap dipungut lewat includeOlderOpenWork,
// jadi memperbesar/mengecilkan angka ini hanya menggeser berapa banyak baris
// yang ikut terambil, bukan baris mana yang boleh hilang.
const UNFINISHED_LOOKBACK_DAYS = 180;

const targetOptions: Array<{ label: string; value: ScheduleTargetFilter }> = [
  { label: 'Semua', value: 'all' },
  { label: formatTargetType('farm'), value: 'farm' },
  { label: formatTargetType('tree'), value: 'tree' },
  { label: formatTargetType('custom'), value: 'custom' },
];

export default function CareScheduleListScreen() {
  const { currentFarm } = useAuth();
  const [completionFilter, setCompletionFilter] = React.useState<CompletionFilter>('unfinished');
  const [criteria, setCriteria] = React.useState<SheetCriteria>(DEFAULT_CRITERIA);
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [draft, setDraft] = React.useState<SheetCriteria>(DEFAULT_CRITERIA);
  const [error, setError] = React.useState<string | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  // Chip yang datanya SEDANG dipegang, bukan chip yang sedang disorot. Selama
  // pemuatan berlangsung, penyaringan klien tetap memakai nilai ini supaya
  // baris lama tidak lenyap dan layar tidak berkedip kosong.
  const [loadedFilter, setLoadedFilter] = React.useState<CompletionFilter>('unfinished');
  const [refreshing, setRefreshing] = React.useState(false);
  const [schedules, setSchedules] = React.useState<CareScheduleDetail[]>([]);
  const [search, setSearch] = React.useState('');
  const [workerNames, setWorkerNames] = React.useState<Record<string, string>>({});

  const farmId = currentFarm?.farmId;
  const hasLoadedOnceRef = React.useRef(false);
  // Penjaga hasil basi: kalau chip ditekan cepat berkali-kali, hanya respons
  // permintaan TERAKHIR yang boleh menulis state.
  const requestIdRef = React.useRef(0);

  // Dulu: getCareSchedules + satu getCareScheduleDetail per jadwal, sehingga
  // jumlah request tumbuh linear terhadap jumlah jadwal — dan sejak rantai
  // berulang ada, jumlah jadwal tumbuh sendiri seiring waktu.
  // getCareSchedulesWithTasks memuat jadwal beserta tugasnya dalam jumlah
  // request tetap.
  const loadSchedules = React.useCallback(async () => {
    const requestId = ++requestIdRef.current;

    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setSchedules([]);
      setWorkerNames({});
      return;
    }

    setError(null);

    // "Selesai" adalah arsip — memang perlu dilihat utuh, jadi tanpa batas
    // tanggal. "Belum selesai" adalah agenda kerja: dibatasi jendela tanggal,
    // dengan jaring pengaman includeOlderOpenWork supaya tunggakan yang lebih
    // tua dari jendela tetap ikut terambil.
    const scheduledFrom =
      completionFilter === 'completed'
        ? null
        : addDaysToIsoDate(getTodayIsoDate(), -UNFINISHED_LOOKBACK_DAYS);

    const [result, workersResult] = await Promise.all([
      getCareSchedulesWithTasks({
        farmId,
        includeOlderOpenWork: scheduledFrom !== null,
        scheduledFrom,
      }),
      getFarmMemberBasicProfiles(farmId),
    ]);

    if (requestId !== requestIdRef.current) {
      return;
    }

    if (result.error) {
      setError(result.error.message);
      setSchedules([]);
      return;
    }

    setSchedules(result.data);
    setLoadedFilter(completionFilter);

    if (workersResult.error) {
      setWorkerNames({});
    } else {
      setWorkerNames(
        Object.fromEntries(
          workersResult.data.map((worker: FarmMemberBasicProfile) => [worker.userId, worker.fullName])
        )
      );
    }
  }, [completionFilter, farmId]);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);

    return () => clearTimeout(timer);
  }, [search]);

  // SATU efek untuk dua pemicu: layar mendapat fokus, dan chip berpindah
  // (identitas loadSchedules ikut berubah karena completionFilter ada di
  // dependency-nya). Tidak ada useEffect kedua, jadi tidak ada pemuatan ganda
  // saat mount. LoadingState layar penuh hanya dipakai sebelum ada data sama
  // sekali; sesudah itu pemuatan berjalan di latar dengan baris lama tetap
  // terlihat.
  useFocusEffect(
    React.useCallback(() => {
      if (hasLoadedOnceRef.current) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      loadSchedules().finally(() => {
        hasLoadedOnceRef.current = true;
        setLoading(false);
        setRefreshing(false);
      });
    }, [loadSchedules])
  );

  if (loading) {
    return <LoadingState message="Memuat jadwal perawatan..." />;
  }

  const todayIso = getTodayIsoDate();

  // Ember waktu dihitung SEKALI per jadwal, lalu dipakai ulang untuk penempatan
  // section dan penanda keterlambatan — satu sumber kebenaran, tidak dua definisi.
  // Tugas selalu ikut termuat sekarang, jadi tidak ada lagi cabang "detail belum
  // ada": scheduleTimeBucket sendiri sudah menangani jadwal tanpa tugas.
  const buckets: Record<string, TimeBucket> = {};
  for (const schedule of schedules) {
    buckets[schedule.id] = scheduleTimeBucket(schedule, schedule.tasks, todayIso);
  }

  function matchesSchedule(schedule: CareScheduleDetail, sheet: SheetCriteria): boolean {
    // loadedFilter, BUKAN completionFilter: chip menyala seketika, tapi baris
    // yang dipegang masih milik chip sebelumnya sampai data baru tiba.
    if (isScheduleSettled(schedule) !== (loadedFilter === 'completed')) {
      return false;
    }

    if (sheet.target !== 'all' && schedule.targetType !== sheet.target) {
      return false;
    }

    if (sheet.worker !== 'all') {
      if (!schedule.tasks.some((task) => task.assignedTo === sheet.worker)) {
        return false;
      }
    }

    if (debouncedSearch) {
      const workers = getScheduleWorkerNames(schedule, workerNames).join(' ');
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

  // Urutan menaik dipakai DUA kali: di dalam section "Terlambat" (paling lama
  // telat di atas) dan sebagai urutan section per tanggal.
  const displayedSchedules = schedules
    .filter((schedule) => matchesSchedule(schedule, criteria))
    .sort((a, b) => (a.scheduledDate < b.scheduledDate ? -1 : a.scheduledDate > b.scheduledDate ? 1 : 0));

  const sections = buildScheduleSections(displayedSchedules, buckets, todayIso);

  // Dua sumbu, sesuai isi sheet setelah "Status" dan "Sumber" dihapus.
  const activeGroupCount =
    (criteria.target !== 'all' ? 1 : 0) +
    (criteria.worker !== 'all' ? 1 : 0);

  // "Pekerja" hanya menawarkan pekerja yang BENAR-BENAR ditugaskan pada jadwal
  // kebun ini (dari details yang sudah di-fetch), bukan seluruh anggota kebun —
  // getFarmMemberBasicProfiles memuat semua status (pending/rejected/removed) +
  // owner, sehingga peta workerNames tak layak jadi sumber opsi filter pekerja.
  const assignedWorkerIds = new Set<string>();
  for (const schedule of schedules) {
    for (const task of schedule.tasks) {
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
      // Dulu FAB membuka sheet berisi dua pilihan (manual / dari SOP). Sejak
      // jalur SOP dihapus hanya tersisa satu tujuan, jadi sheet perantaranya
      // ikut hilang dan FAB langsung membuka form.
      floatingAction={
        <FloatingActionButton label="Tambah jadwal" onPress={() => router.push('/owner/schedules/create')} />
      }
      header={
        <MainTabHeader
          title="Jadwal"
          roleLabel="Pemilik"
          onProfilePress={() => router.push('/owner/profile')}
        />
      }
    >
      <ErrorBanner message={error} />

      {/* Tidak ada lagi cabang "kebun kosong" yang menyembunyikan pencarian dan
          chip. Layar ini tidak bisa membedakan kebun yang benar-benar belum punya
          jadwal dari kebun yang jadwalnya semua di luar jendela 180 hari — dan
          menyembunyikan chip justru membuat saran "buka Selesai" mustahil
          diikuti. Jadi kontrolnya selalu ada, dan teks kosongnya dibuat benar
          untuk kedua keadaan. */}
      {error ? null : (
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
            {completionFilters.map((filter) => (
              <ChipButton
                key={filter.value}
                active={completionFilter === filter.value}
                label={filter.label}
                onPress={() => setCompletionFilter(filter.value)}
              />
            ))}
          </FilterChipsRow>

          {/* Satu baris yang berganti isi, bukan dua slot. Saat menyegarkan
              angkanya sengaja tidak ditampilkan: data yang sedang dipegang bisa
              jadi masih milik chip sebelumnya, dan angka basi lebih buruk
              daripada tanpa angka. Tingginya tetap supaya daftar tidak bergeser
              naik-turun tiap kali menyegarkan. */}
          <View style={styles.metaSlot}>
            <Text selectable style={styles.metaLine}>
              {refreshing ? 'Memuat jadwal...' : `Menampilkan ${displayedSchedules.length} jadwal`}
            </Text>
          </View>

          {/* Saat menyegarkan, baris lama dipertahankan dan EmptyState ditahan —
              kalau tidak, berpindah chip akan memunculkan "tidak ada yang cocok"
              sekejap sebelum data baru datang. */}
          {/* Pencarian dan filter diperiksa LEBIH DULU: owner yang mengetik
              pencarian tanpa hasil harus diberi tahu pencariannya yang nihil,
              bukan disuruh melihat riwayat. */}
          {displayedSchedules.length === 0 && refreshing ? null : displayedSchedules.length === 0 ? (
            debouncedSearch.length > 0 ? (
              <EmptyState
                icon="search"
                subtitle={`Tidak ada jadwal yang cocok dengan "${search.trim()}".`}
                title="Tidak ada hasil"
                variant="plain"
              />
            ) : activeGroupCount > 0 ? (
              <EmptyState
                icon="filter"
                subtitle="Tidak ada jadwal dengan filter yang aktif."
                title="Tidak ada yang cocok"
                variant="plain"
              />
            ) : loadedFilter === 'completed' ? (
              <EmptyState
                icon="calendar"
                subtitle="Jadwal yang sudah selesai atau dibatalkan muncul di sini."
                title="Belum ada riwayat"
                variant="plain"
              />
            ) : (
              // Benar untuk kebun yang belum punya jadwal MAUPUN kebun yang
              // jadwalnya sudah beres semua — layar tidak bisa membedakan
              // keduanya tanpa request tambahan, jadi kalimatnya tidak
              // mengklaim salah satunya.
              <EmptyState
                icon="calendar-plus"
                subtitle={'Buat jadwal baru, atau buka "Selesai" untuk melihat riwayat.'}
                title="Tidak ada pekerjaan yang menunggu"
                variant="plain"
              />
            )
          ) : (
            <View style={styles.sections}>
              {sections.map((section) => (
                <View key={section.key} style={styles.section}>
                  <ScheduleSectionHeader section={section} />
                  <View style={styles.sectionRows}>
                    {section.schedules.map((schedule, index) => (
                      <ScheduleRow
                        key={schedule.id}
                        isLast={index === section.schedules.length - 1}
                        onPress={() => router.push(`/owner/schedules/${schedule.id}`)}
                        overdueSinceIso={section.tone === 'danger' ? scheduleOverdueSinceIso(schedule) : null}
                        schedule={schedule}
                        todayIso={todayIso}
                        workerNames={workerNames}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}

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

function ScheduleSectionHeader({ section }: { section: ScheduleSection }) {
  const isDanger = section.tone === 'danger';

  return (
    <View style={styles.sectionHeader}>
      <Text selectable style={[styles.sectionTitle, isDanger ? styles.sectionTitleDanger : null]}>
        {section.title}
      </Text>
      {section.trailing ? (
        <Text selectable style={[styles.sectionTrailing, isDanger ? styles.sectionTitleDanger : null]}>
          {section.trailing}
        </Text>
      ) : null}
    </View>
  );
}

// Baris agenda: judul + SATU baris meta. Tanggal tidak lagi ikut di sini —
// section header yang menyatakannya, dan badge status juga hilang karena sudah
// tersirat dari section. Yang tersisa hanya yang TIDAK tersirat: lama
// keterlambatan, penanda pengulangan, dan penanda pembatalan.
function ScheduleRow({
  isLast,
  onPress,
  overdueSinceIso,
  schedule,
  todayIso,
  workerNames,
}: {
  isLast: boolean;
  onPress: () => void;
  // Non-null hanya di section "Terlambat".
  overdueSinceIso: string | null;
  schedule: CareScheduleDetail;
  todayIso: string;
  workerNames: Record<string, string>;
}) {
  const workers = getScheduleWorkerNames(schedule, workerNames);
  const taskCount = schedule.tasks.length;
  const title = schedule.title || formatCareCategory(schedule.category);
  const overdueDays = overdueSinceIso ? Math.max(1, dayDifference(overdueSinceIso, todayIso)) : 0;

  return (
    <Pressable onPress={onPress} style={[styles.row, isLast ? null : styles.rowDivider]}>
      <View style={styles.rowHeader}>
        <Text selectable numberOfLines={1} style={styles.rowTitle}>
          {title}
        </Text>
        <View style={styles.rowTrailing}>
          {overdueSinceIso ? (
            <Text selectable={false} style={styles.overdueText}>
              {`${overdueDays} hari`}
            </Text>
          ) : null}
          {schedule.repeatEveryDays !== null ? (
            <View style={styles.repeatPill}>
              <Icon name="repeat" size={tokens.icon.xs} color={tokens.color.brand.base} />
              <Text selectable={false} style={styles.repeatPillText}>
                {`${schedule.repeatEveryDays}h`}
              </Text>
            </View>
          ) : null}
          {schedule.isCancelled ? <Badge label="Dibatalkan" maxWidth={100} tone="danger" /> : null}
        </View>
      </View>

      <View style={styles.rowMeta}>
        <Text selectable numberOfLines={1} style={styles.rowMetaText}>
          {`${formatCareCategory(schedule.category)} · ${formatCareTarget(schedule)} · `}
        </Text>
        {taskCount === 0 ? (
          <View style={styles.noWorkerPill}>
            <Icon name="alert-triangle" size={tokens.icon.xs} color={statusColors.warning.text} />
            <Text selectable={false} style={styles.noWorkerPillText}>
              Belum ada pekerja
            </Text>
          </View>
        ) : (
          <Text selectable numberOfLines={1} style={styles.rowMetaText}>
            {formatWorkerSummary(workers)}
          </Text>
        )}
      </View>

      {taskCount > 1 || schedule.requiresPhoto ? (
        <View style={styles.rowAttributes}>
          {taskCount > 1 ? (
            <Text selectable numberOfLines={1} style={styles.rowProgress}>
              {getScheduleProgress(schedule)}
            </Text>
          ) : null}
          {schedule.requiresPhoto ? (
            <View style={styles.proofPill}>
              <Icon name="camera" size={tokens.icon.xs} color={statusColors.warning.text} />
              <Text selectable={false} style={styles.proofPillText}>
                Butuh bukti
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
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
  const isDefault = draft.target === 'all' && draft.worker === 'all';

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

type ScheduleSection = {
  key: string;
  title: string;
  tone: 'danger' | 'default';
  trailing?: string;
  schedules: CareScheduleDetail[];
};

// Partisi TOTAL: setiap jadwal masuk ke tepat satu section — cabang if/else di
// bawah tidak punya jalur yang membuang baris, tidak ada filter dan tidak ada
// continue. Jumlah baris yang dirender selalu sama dengan panjang input.
//
// `schedules` sudah terurut scheduledDate MENAIK, jadi: (1) isi section
// "Terlambat" ikut menaik (paling lama telat di atas), dan (2) kunci Map
// bertambah menaik sehingga urutan section per tanggal juga menaik — Map
// mempertahankan urutan penyisipan.
function buildScheduleSections(
  schedules: CareScheduleDetail[],
  buckets: Record<string, TimeBucket>,
  todayIso: string
): ScheduleSection[] {
  const overdue: CareScheduleDetail[] = [];
  const byDate = new Map<string, CareScheduleDetail[]>();

  for (const schedule of schedules) {
    // 'missed' (migrasi 048) sementara diperlakukan sama seperti 'overdue'
    // supaya tampilan tidak berubah sebelum tahap polish UI: jadwal terlewat
    // tetap berada di section "Terlambat", bukan berpindah diam-diam ke
    // section tanggal lampau. Datanya sudah terpisah di taskDueDate.ts dan
    // tinggal dipakai saat statusnya benar-benar ditampilkan.
    const bucket = buckets[schedule.id];

    if (bucket === 'overdue' || bucket === 'missed') {
      overdue.push(schedule);
      continue;
    }

    const existing = byDate.get(schedule.scheduledDate);

    if (existing) {
      existing.push(schedule);
    } else {
      byDate.set(schedule.scheduledDate, [schedule]);
    }
  }

  const sections: ScheduleSection[] = [];

  // Digabung jadi SATU section berapa pun tanggalnya: yang penting bagi owner
  // adalah "ini menumpuk", bukan tersebar di banyak header tanggal lampau.
  if (overdue.length > 0) {
    sections.push({
      key: 'overdue',
      title: 'Terlambat',
      tone: 'danger',
      trailing: `${overdue.length}`,
      schedules: overdue,
    });
  }

  for (const [iso, list] of byDate) {
    sections.push({
      key: iso,
      title: formatAgendaSectionTitle(iso, todayIso),
      tone: 'default',
      schedules: list,
    });
  }

  return sections;
}

// Tanggal acuan penghitungan keterlambatan. Tugas boleh punya due_date sendiri,
// jadi dipakai tenggat TERAWAL yang belum selesai; kalau jadwal belum punya
// tugas sama sekali, acuannya tanggal jadwal itu sendiri.
function scheduleOverdueSinceIso(schedule: CareScheduleDetail): string {
  const openDueDates = schedule.tasks
    .filter((task) => task.status !== 'completed')
    .map((task) => task.dueDate);

  if (openDueDates.length === 0) {
    return schedule.scheduledDate;
  }

  return openDueDates.reduce((earliest, dueDate) => (dueDate < earliest ? dueDate : earliest));
}

// Pemisah agenda-vs-arsip untuk chip atas. "Settled" = tidak menunggu pekerjaan
// siapa pun lagi: sudah dibatalkan, atau punya tugas dan semuanya selesai.
// Jadwal TANPA tugas sengaja TIDAK settled — justru itu yang menunggu penugasan.
function isScheduleSettled(schedule: CareScheduleDetail): boolean {
  if (schedule.isCancelled === true) {
    return true;
  }

  return schedule.tasks.length > 0 && schedule.tasks.every((task) => task.status === 'completed');
}

function getScheduleWorkerNames(
  schedule: CareScheduleDetail,
  workerNames: Record<string, string>
): string[] {
  return Array.from(
    new Set(schedule.tasks.map((task) => workerNames[task.assignedTo]).filter((name): name is string => Boolean(name)))
  );
}

function getScheduleProgress(schedule: CareScheduleDetail): string {
  if (schedule.tasks.length === 0) {
    return 'Belum ada hasil kerja';
  }

  const completed = schedule.tasks.filter((task) => task.status === 'completed').length;
  const postponed = schedule.tasks.filter((task) => task.status === 'postponed').length;
  const suffix = postponed > 0 ? `, ${postponed} ditunda` : '';

  return `${completed}/${schedule.tasks.length} selesai${suffix}`;
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

const styles = StyleSheet.create({
  metaLine: { ...tokens.type.meta, color: tokens.color.text.tertiary },
  // Tinggi tetap: isi slot ini berganti antara jumlah dan penanda memuat, jadi
  // tanpa tinggi tetap seluruh daftar bisa bergeser tiap kali memuat.
  // tokens.space.xl (20) cukup untuk lineHeight tokens.type.meta (18).
  metaSlot: { height: tokens.space.xl, justifyContent: 'center' },

  // Agenda: section dipisah jarak, baris dipisah garis rambut — bukan kartu
  // bertumpuk berbayang.
  sections: { gap: tokens.layout.sectionGap },
  section: { gap: tokens.space.sm },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.space.sm,
    justifyContent: 'space-between',
  },
  sectionTitle: { ...tokens.type.label, color: tokens.color.text.secondary },
  sectionTitleDanger: { color: tokens.color.status.danger.text },
  sectionTrailing: { ...tokens.type.label, color: tokens.color.text.tertiary },
  sectionRows: {
    backgroundColor: tokens.color.surface.card,
    borderColor: tokens.color.line.card,
    borderCurve: 'continuous',
    borderRadius: tokens.radius.cardInner,
    borderWidth: 1,
    overflow: 'hidden',
  },

  row: {
    gap: tokens.space.xs,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
  },
  rowDivider: {
    borderBottomColor: tokens.color.line.hairline,
    borderBottomWidth: 1,
  },
  rowHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.space.sm,
    justifyContent: 'space-between',
  },
  rowTitle: { ...tokens.type.bodyStrong, color: tokens.color.text.primary, flex: 1 },
  rowTrailing: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: tokens.space.sm,
  },
  overdueText: { ...tokens.type.caption, color: tokens.color.status.danger.text },
  repeatPill: {
    alignItems: 'center',
    backgroundColor: tokens.color.brand.soft,
    borderRadius: tokens.radius.pill,
    flexDirection: 'row',
    gap: tokens.space.xs,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 2,
  },
  repeatPillText: { ...tokens.type.caption, color: tokens.color.brand.base },
  rowMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  rowMetaText: { ...tokens.type.meta, color: tokens.color.text.tertiary, flexShrink: 1 },
  noWorkerPill: {
    alignItems: 'center',
    backgroundColor: statusColors.warning.background,
    borderRadius: tokens.radius.pill,
    flexDirection: 'row',
    gap: tokens.space.xs,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 1,
  },
  noWorkerPillText: { ...tokens.type.caption, color: statusColors.warning.text },
  rowAttributes: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.sm,
  },
  rowProgress: { ...tokens.type.meta, color: tokens.color.text.secondary },
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

});
