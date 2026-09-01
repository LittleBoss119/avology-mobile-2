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
  LoadingState,
  Screen,
  SearchFilterRow,
  SegmentedControl,
} from '../../../../src/components/ui';
import { tokens } from '../../../../src/constants/theme';
import { useAuth } from '../../../../src/context/auth-context';
import { getCareSchedulesWithTasks } from '../../../../src/services/careScheduleService';
import { getFarmMemberBasicProfiles } from '../../../../src/services/memberService';
import type { CareScheduleDetail, FarmMemberBasicProfile, TargetType } from '../../../../src/types/domain';
import { formatCareCategory, formatTargetType } from '../../../../src/utils/displayFormat';
import {
  addDaysToIsoDate,
  dayDifference,
  formatFullDate,
  getTodayIsoDate,
  scheduleTimeBucket,
  type TimeBucket,
} from '../../../../src/utils/taskDueDate';

// Sumbu waktu dinyatakan oleh struktur section (Terlambat / Hari ini /
// Mendatang), bukan chip. Pemisah agenda-vs-arsip pindah ke segmented control:
// ia MENGGANTI TAMPILAN, bukan menyaring, jadi bentuknya harus beda dari chip
// filter — sama seperti "Daftar | Denah" di layar Pohon.
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
const COMPLETION_SEGMENTS = [
  { key: 'unfinished', label: 'Belum selesai' },
  { key: 'completed', label: 'Selesai' },
];

// Batas riwayat segmen "Selesai": 30 hari terakhir.
//
// Disaring di KLIEN, bukan lewat scheduledFrom di permintaan, supaya jendela
// tampilan dan jendela pengambilan tetap dua hal terpisah — permintaannya sudah
// punya aturannya sendiri (UNFINISHED_LOOKBACK_DAYS + includeOlderOpenWork) dan
// mencampur keduanya membuat sebab hilangnya sebuah baris tidak bisa dibaca
// dari satu tempat.
//
// Bandingannya scheduledDate, tanggal yang SAMA dengan yang dipakai mengurutkan
// dan mengelompokkan baris. Memakai tanggal lain (mis. tanggal realisasi) akan
// membuat baris yang lolos saringan jatuh di section yang tidak sesuai dengan
// alasan ia lolos.
const COMPLETED_LOOKBACK_DAYS = 30;

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

  const completedFromIso = addDaysToIsoDate(todayIso, -COMPLETED_LOOKBACK_DAYS);

  function matchesSchedule(schedule: CareScheduleDetail, sheet: SheetCriteria): boolean {
    // loadedFilter, BUKAN completionFilter: segmen menyala seketika, tapi baris
    // yang dipegang masih milik segmen sebelumnya sampai data baru tiba.
    if (isScheduleSettled(schedule) !== (loadedFilter === 'completed')) {
      return false;
    }

    // Jendela riwayat. Hanya berlaku di segmen "Selesai": agenda tidak boleh
    // kehilangan tunggakan hanya karena tanggalnya tua.
    if (loadedFilter === 'completed' && schedule.scheduledDate < completedFromIso) {
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
      // Kode pohon dimasukkan LENGKAP, bukan lewat formatCareTarget. Ringkasan
      // yang tampil di kartu berbunyi "3 pohon", dan mencari "1-A" tidak akan
      // pernah menemukannya kalau hanya ringkasan itu yang dicari.
      //
      // `?? []` menutup jadwal yang kode pohonnya belum termuat: pencarian
      // tetap jalan atas judul, sasaran ringkas, dan nama pekerja.
      const treeCodes = (schedule.targetTreeCodes ?? []).join(' ');
      // Nama kategori ikut dicari. Sejak judul dirakit program, mengetik
      // "Pemupukan" memang menemukan jadwal BARU lewat ruas judul — tapi
      // hanya kebetulan, dan tetap gagal untuk jadwal lama yang judulnya
      // masih "Test" atau "awas". Dengan kategorinya ikut, placeholder
      // "Cari jenis, target, atau pekerja" benar untuk keduanya.
      const searchable = [
        formatCareCategory(schedule.category),
        schedule.title,
        formatCareTarget(schedule),
        treeCodes,
        workers,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (!searchable.includes(debouncedSearch)) {
        return false;
      }
    }

    return true;
  }

  // Segmen "Selesai" adalah ARSIP, bukan agenda: ia dirender sebagai satu daftar
  // rata tanpa section dan tanpa header, dan tidak melewati
  // buildScheduleSections sama sekali. Tiga nama section yang ada — Terlambat,
  // Hari ini, Mendatang — semuanya menyatakan hubungan dengan pekerjaan yang
  // MASIH menunggu, dan tak satu pun benar untuk yang sudah tidak menunggu.
  const isArchive = loadedFilter === 'completed';

  // Dua arah urutan, sesuai pertanyaan yang dijawab masing-masing segmen.
  //
  // Agenda MENAIK: pertanyaannya "apa yang paling lama tertunggak", jadi yang
  // paling tua duduk paling atas — di "Terlambat" paling lama telat, di
  // "Mendatang" yang paling dekat.
  //
  // Arsip MENURUN: pertanyaannya "yang barusan itu tercatat, kan", dan
  // jawabannya selalu ada di ujung terbaru. Dengan jendela 30 hari, mengurutkan
  // menaik berarti yang dicari selalu berada di dasar daftar.
  const displayedSchedules = schedules
    .filter((schedule) => matchesSchedule(schedule, criteria))
    .sort((a, b) => {
      const ascending = a.scheduledDate < b.scheduledDate ? -1 : a.scheduledDate > b.scheduledDate ? 1 : 0;

      return isArchive ? -ascending : ascending;
    });

  const sections = isArchive ? [] : buildScheduleSections(displayedSchedules, buckets);

  // Dua sumbu, sesuai isi sheet setelah "Status" dan "Sumber" dihapus.
  const activeGroupCount =
    (criteria.target !== 'all' ? 1 : 0) +
    (criteria.worker !== 'all' ? 1 : 0);

  // Pencarian dan filter sheet disatukan: bagi pemilik keduanya adalah "saya
  // sedang mempersempit daftar", dan jawaban yang benar untuk nol hasil sama
  // untuk keduanya — longgarkan yang barusan dipersempit.
  const isNarrowed = debouncedSearch.length > 0 || activeGroupCount > 0;

  // Baris meta di bawah segmented. Saat menyegarkan, jendela arsip sengaja
  // tidak disebut: data yang dipegang bisa jadi masih milik segmen sebelumnya.
  const metaLine = refreshing
    ? 'Memuat jadwal...'
    : loadedFilter === 'completed'
      ? `${COMPLETED_LOOKBACK_DAYS} hari terakhir`
      : null;

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
      // Tanpa prop `header`: judul layar dibuang karena tab bar di bawah sudah
      // menamai layar ini dan menyalakannya. `applyTopInset` WAJIB ikut —
      // inset atas selama ini datang dari TopAppBar di dalam MainTabHeader
      // (ui.tsx), bukan dari Screen, jadi tanpa prop ini isi layar menempel ke
      // status bar.
      applyTopInset
      // Screen sendiri yang menyediakan ruang bawah sebesar tinggi footer ini
      // (stickyFooterReserve di ui.tsx), jadi baris terakhir daftar tidak
      // pernah tertutup dan tidak ada angka padding yang perlu ditebak di sini.
      stickyFooter={
        <Button
          icon={<Icon name="plus" size={tokens.icon.md} color={tokens.color.brand.on} />}
          onPress={() => router.push('/owner/schedules/create')}
          title="Tambah jadwal"
        />
      }
    >
      <ErrorBanner message={error} />

      {/* Tidak ada cabang "kebun kosong" yang menyembunyikan pencarian dan
          segmented. Layar ini tidak bisa membedakan kebun yang benar-benar belum
          punya jadwal dari kebun yang jadwalnya semua di luar jendela 180 hari —
          dan menyembunyikan segmented justru membuat segmen "Selesai" mustahil
          dicapai. Jadi kontrolnya selalu ada, dan teks kosongnya dibuat benar
          untuk kedua keadaan. */}
      {error ? null : (
        <>
          <SearchFilterRow
            filterActive={activeGroupCount > 0}
            filterCount={activeGroupCount}
            onChangeText={setSearch}
            onFilterPress={openFilterSheet}
            // Judul yang diketik pemilik tidak lagi DITAMPILKAN di baris daftar,
            // tapi tetap ikut DICARI (lihat matchesSchedule) — menghapusnya dari
            // pencarian akan membuat kata yang pernah diketik sendiri oleh
            // pemilik tidak menemukan apa pun. Placeholder menyebut "jenis"
            // karena itulah yang kini terbaca di baris pertama.
            placeholder="Cari jenis, target, atau pekerja"
            value={search}
          />

          <SegmentedControl
            onChange={(key) => setCompletionFilter(key === 'completed' ? 'completed' : 'unfinished')}
            options={COMPLETION_SEGMENTS}
            value={completionFilter}
          />

          {/* Hanya ada isi di dua keadaan: sedang menyegarkan, atau sedang di
              segmen arsip yang jendelanya perlu dinyatakan. Di agenda tidak ada
              baris apa pun — hitungan "Menampilkan N jadwal" dihapus, karena
              jumlah baris sudah terbaca dari daftarnya sendiri dan angka itu
              hanya menambah satu hal untuk dibaca sebelum sampai ke pekerjaan. */}
          {metaLine ? (
            <View style={styles.metaSlot}>
              <Text selectable style={styles.metaLine}>
                {metaLine}
              </Text>
            </View>
          ) : null}

          {/* Saat menyegarkan, baris lama dipertahankan dan EmptyState ditahan —
              kalau tidak, berpindah segmen akan memunculkan "tidak ada yang
              cocok" sekejap sebelum data baru datang. */}
          {/* Pencarian dan filter diperiksa LEBIH DULU: owner yang mempersempit
              daftar tanpa hasil harus diberi tahu penyempitannya yang nihil,
              bukan disuruh membuat jadwal baru. */}
          {displayedSchedules.length === 0 && refreshing ? null : displayedSchedules.length === 0 ? (
            isNarrowed ? (
              <EmptyState
                icon="search"
                subtitle="Coba ubah kata pencarian atau longgarkan filternya."
                title="Tidak ada yang cocok"
                variant="plain"
              />
            ) : loadedFilter === 'completed' ? (
              <EmptyState
                icon="clipboard"
                subtitle={`Jadwal yang beres dalam ${COMPLETED_LOOKBACK_DAYS} hari terakhir muncul di sini.`}
                title="Belum ada yang selesai"
                variant="plain"
              />
            ) : (
              // Benar untuk kebun yang belum punya jadwal MAUPUN kebun yang
              // jadwalnya sudah beres semua — layar tidak bisa membedakan
              // keduanya tanpa request tambahan, jadi kalimatnya tidak
              // mengklaim salah satunya. Arahannya ke tombol yang memang ada di
              // layar ini, bukan ke tempat lain.
              <EmptyState
                icon="calendar-plus"
                subtitle={'Tekan "Tambah jadwal" di bawah untuk membuat yang pertama.'}
                title="Belum ada jadwal"
                variant="plain"
              />
            )
          ) : isArchive ? (
            // Arsip: satu kotak, tanpa section dan tanpa header. overdueSinceIso
            // selalu null di sini — sebuah jadwal yang sudah selesai atau
            // dibatalkan tidak bisa "telat" lagi.
            <View style={styles.sectionRows}>
              {displayedSchedules.map((schedule, index) => (
                <ScheduleRow
                  key={schedule.id}
                  isLast={index === displayedSchedules.length - 1}
                  onPress={() => router.push(`/owner/schedules/${schedule.id}`)}
                  overdueSinceIso={null}
                  schedule={schedule}
                  showDate
                  todayIso={todayIso}
                  workerNames={workerNames}
                />
              ))}
            </View>
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
                        // Section "Hari ini" SUDAH menyatakan tanggalnya di
                        // headernya sendiri; mengulanginya di setiap baris di
                        // bawahnya hanya menambah kata yang harus dilewati
                        // sebelum sampai ke target dan pekerja.
                        showDate={section.key !== 'today'}
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

// Baris agenda: DUA baris teks + satu penanda di kanan.
//
// Baris pertama adalah KATEGORI, bukan judul yang diketik pemilik. Judul bebas
// di lapangan berbunyi "Test", "Gawe baru", "awas" — kata-kata yang hanya berarti
// bagi orang yang mengetiknya, pada hari ia mengetiknya. Kategori selalu berarti
// sama bagi siapa pun yang membacanya. Judulnya TIDAK dihapus dari data dan tetap
// ikut dicari; ia hanya berhenti menempati baris paling menonjol.
//
// Baris kedua: target · pekerja · tanggal. Disusun sebagai SATU string yang
// digabung dengan ' · ', bukan beberapa <Text> bersebelahan — versi lama
// menaruh pemisahnya di ujung sebuah <Text> ("... · ") dan RN memangkas spasi
// ujung itu, sehingga tampil "Seluruh kebun ·Adit".
//
// Ruas tanggal bisa DILEPAS lewat showDate. Yang melepasnya hanya section
// "Hari ini", yang headernya sudah menyatakan tanggal itu untuk seluruh baris
// di bawahnya. Karena ruasnya dilepas SEBELUM join, tidak ada pemisah menggantung
// yang tertinggal di ujung.
function ScheduleRow({
  isLast,
  onPress,
  overdueSinceIso,
  schedule,
  showDate,
  todayIso,
  workerNames,
}: {
  isLast: boolean;
  onPress: () => void;
  // Non-null hanya di section "Terlambat".
  overdueSinceIso: string | null;
  schedule: CareScheduleDetail;
  showDate: boolean;
  todayIso: string;
  workerNames: Record<string, string>;
}) {
  const workers = getScheduleWorkerNames(schedule, workerNames);
  const taskCount = schedule.tasks.length;
  const overdueDays = overdueSinceIso ? Math.max(1, dayDifference(overdueSinceIso, todayIso)) : 0;
  const workerText = taskCount === 0 ? 'Belum ada pekerja' : formatWorkerSummary(workers);
  const metaLine = [
    formatCareTarget(schedule),
    workerText,
    showDate ? formatFullDate(schedule.scheduledDate) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable onPress={onPress} style={[styles.row, isLast ? null : styles.rowDivider]}>
      <View style={styles.rowHeader}>
        <Text selectable numberOfLines={1} style={styles.rowTitle}>
          {formatCareCategory(schedule.category)}
        </Text>
        <View style={styles.rowTrailing}>
          <ScheduleRowMarker overdueDays={overdueDays} overdueSinceIso={overdueSinceIso} schedule={schedule} />
        </View>
      </View>

      <Text selectable numberOfLines={2} style={styles.rowMetaText}>
        {metaLine}
      </Text>

      {/* TANPA pil "Butuh bukti" — pil itu kini hanya ada di daftar tugas
          pekerja, dan itu disengaja. Kewajiban foto adalah instruksi bagi orang
          yang akan MENGERJAKANNYA; bagi pemilik yang sedang memindai daftar, ia
          syarat yang ia sendiri tetapkan saat membuat jadwalnya dan tidak
          mengubah satu pun tindakan yang bisa ia ambil dari layar ini. Nilainya
          tetap terbaca di layar detail jadwal.

          Yang tersisa: progres, dan hanya kalau jadwalnya punya lebih dari satu
          tugas — di jadwal satu tugas "0/1 selesai" hanya mengulang apa yang
          sudah dinyatakan segmen dan penanda kanan. */}
      {taskCount > 1 ? (
        <View style={styles.rowAttributes}>
          <Text selectable numberOfLines={1} style={styles.rowProgress}>
            {getScheduleProgress(schedule)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// PALING BANYAK SATU penanda di kolom kanan, berprioritas — bukan tumpukan.
// Sebelum ini "N hari" dan pil pengulangan bisa muncul berbarengan, dan pada
// baris sesempit ini dua pil kecil bersebelahan terbaca sebagai satu blok kabur
// alih-alih dua fakta.
//
// Urutannya menurun dari yang paling menuntut tindakan:
//   0. Dibatalkan  -- jadwal ini tidak akan dikerjakan siapa pun lagi, jadi
//      tidak ada gunanya memberi tahu ia berulang tiap 7 hari. Ia mendahului
//      sisanya, dan ia satu-satunya yang bukan bagian dari daftar prioritas
//      aslinya: badge ini wajib dipertahankan (baris arsip yang dibatalkan
//      harus bisa dibedakan dari yang benar-benar selesai).
//   1. Terlambat   -- tunggakan.
//   2. Ditunda     -- pekerjaannya diakui belum dilakukan, tapi bukan tunggakan.
//   3. Berulang    -- sifat jadwal, bukan keadaannya. Kalah dari ketiganya.
//
// Setiap penanda membawa TEKS, bukan hanya warna dan bukan hanya ikon.
function ScheduleRowMarker({
  overdueDays,
  overdueSinceIso,
  schedule,
}: {
  overdueDays: number;
  overdueSinceIso: string | null;
  schedule: CareScheduleDetail;
}) {
  if (schedule.isCancelled) {
    return <Badge label="Dibatalkan" maxWidth={100} tone="danger" />;
  }

  if (overdueSinceIso) {
    return (
      <Text selectable={false} style={styles.overdueText}>
        {`Telat ${overdueDays} hari`}
      </Text>
    );
  }

  // Tingkat JADWAL: sebuah jadwal bisa punya banyak tugas, dan cukup satu yang
  // ditunda untuk membuat jadwalnya belum tuntas karena penundaan. Tidak ada
  // kolom "ditunda" di care_schedules — status penundaan hidup di care_tasks
  // .status, jadi inilah satu-satunya sumber yang tersedia di baris daftar.
  if (schedule.tasks.some((task) => task.status === 'postponed')) {
    return (
      <View style={styles.neutralPill}>
        <Text selectable={false} style={styles.neutralPillText}>
          Ditunda
        </Text>
      </View>
    );
  }

  if (schedule.repeatEveryDays !== null) {
    return (
      <View style={styles.repeatPill}>
        <Icon name="repeat" size={tokens.icon.xs} color={tokens.color.brand.base} />
        <Text selectable={false} style={styles.repeatPillText}>
          {`Tiap ${schedule.repeatEveryDays} hari`}
        </Text>
      </View>
    );
  }

  return null;
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

// Dipakai HANYA untuk segmen "Belum selesai". Arsip dirender sebagai daftar rata
// di layar, tidak lewat sini — lihat `isArchive`.
//
// Partisi TOTAL: setiap jadwal masuk ke tepat satu section — tidak ada jalur
// yang membuang baris, tidak ada filter dan tidak ada continue yang menjatuhkan
// apa pun. Jumlah baris yang dirender selalu sama dengan panjang input.
//
// Cabang `else` di bawah yang menampung ember 'inactive' ke "Mendatang" adalah
// PENJAGA, bukan jalur yang diharapkan: di segmen agenda sebuah jadwal
// ber-bucket 'inactive' berarti ia dibatalkan atau seluruh tugasnya selesai,
// dan keduanya sudah dibuang lebih dulu oleh isScheduleSettled(). Kalau suatu
// hari salah satu dari dua definisi itu bergeser, barisnya tetap TERLIHAT di
// tempat yang paling tidak berbahaya, bukan lenyap tanpa jejak.
//
// TIGA section, urut tetap: Terlambat, Hari ini, Mendatang. Header per tanggal
// ("Sabtu, 19 Sep 2026") dihapus: pada kebun dengan jadwal berulang, satu
// tanggal sering hanya berisi satu baris, sehingga daftar berubah jadi deret
// header dengan satu baris di bawah masing-masing — lebih banyak header
// daripada pekerjaan. Tanggalnya sekarang ada di baris meta tiap baris (kecuali
// di "Hari ini", yang headernya sudah menyatakannya).
//
// Section yang kosong TIDAK dimasukkan sama sekali, jadi headernya juga tidak
// pernah dirender.
//
// `schedules` sudah terurut scheduledDate MENAIK, jadi isi tiap section ikut
// menaik: di "Terlambat" paling lama telat di atas, di "Mendatang" yang paling
// dekat di atas.
function buildScheduleSections(
  schedules: CareScheduleDetail[],
  buckets: Record<string, TimeBucket>
): ScheduleSection[] {
  const overdue: CareScheduleDetail[] = [];
  const today: CareScheduleDetail[] = [];
  const upcoming: CareScheduleDetail[] = [];

  for (const schedule of schedules) {
    // 'missed' (migrasi 048) diperlakukan sama seperti 'overdue': jadwal
    // terlewat tetap berada di section "Terlambat", bukan berpindah diam-diam
    // ke tempat lain. Datanya sudah terpisah di taskDueDate.ts dan tinggal
    // dipakai saat statusnya benar-benar ditampilkan.
    const bucket = buckets[schedule.id];

    if (bucket === 'overdue' || bucket === 'missed') {
      overdue.push(schedule);
    } else if (bucket === 'today') {
      today.push(schedule);
    } else {
      upcoming.push(schedule);
    }
  }

  const sections: ScheduleSection[] = [];

  // Angka di kanan HANYA di "Terlambat", dipertahankan apa adanya: itu satu-
  // satunya section yang jumlahnya berarti tindakan ("sebanyak ini menumpuk").
  // "Hari ini" dan "Mendatang" sengaja tanpa angka.
  if (overdue.length > 0) {
    sections.push({
      key: 'overdue',
      title: 'Terlambat',
      tone: 'danger',
      trailing: `${overdue.length}`,
      schedules: overdue,
    });
  }

  if (today.length > 0) {
    sections.push({ key: 'today', title: 'Hari ini', tone: 'default', schedules: today });
  }

  if (upcoming.length > 0) {
    sections.push({ key: 'upcoming', title: 'Mendatang', tone: 'default', schedules: upcoming });
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
  // Pil netral untuk "Ditunda". Bentuk sama persis dengan repeatPill, hanya
  // warnanya yang berbeda — keduanya penanda sifat baris, bukan peringatan.
  neutralPill: {
    alignItems: 'center',
    backgroundColor: tokens.color.status.neutral.bg,
    borderRadius: tokens.radius.pill,
    flexDirection: 'row',
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 2,
  },
  neutralPillText: { ...tokens.type.caption, color: tokens.color.status.neutral.text },
  rowMetaText: { ...tokens.type.meta, color: tokens.color.text.tertiary },
  rowAttributes: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.sm,
  },
  rowProgress: { ...tokens.type.meta, color: tokens.color.text.secondary },
  filterSheetBody: { gap: tokens.space.md },
  filterGroup: { gap: tokens.space.sm },
  filterLabel: { ...tokens.type.label, color: tokens.color.text.primary },
  sheetResetRow: { alignItems: 'flex-end' },
  resetText: { ...tokens.type.label, color: tokens.color.brand.base },
  resetTextDisabled: { color: tokens.color.text.tertiary },

});
