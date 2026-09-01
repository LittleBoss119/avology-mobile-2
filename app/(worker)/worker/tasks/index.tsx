import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatCareTarget } from '../../../../src/components/care-schedule-components';
import { Icon } from '../../../../src/components/icons';
import {
  EmptyState,
  ErrorBanner,
  LoadingState,
  MainTabHeader,
  Screen,
  SegmentedControl,
} from '../../../../src/components/ui';
import { statusColors, tokens } from '../../../../src/constants/theme';
import { useAuth } from '../../../../src/context/auth-context';
import { getWorkerTasks } from '../../../../src/services/careTaskService';
import type { CareTask } from '../../../../src/types/domain';
import { formatCareCategory } from '../../../../src/utils/displayFormat';
import {
  addDaysToIsoDate,
  dayDifference,
  formatFullDate,
  getTodayIsoDate,
  taskTimeBucket,
  type TimeBucket,
} from '../../../../src/utils/taskDueDate';

// Sumbu waktu dinyatakan oleh struktur section (Terlambat / Hari ini /
// Mendatang), bukan chip — sama seperti layar jadwal owner. Pemisah
// agenda-vs-arsip memakai segmented control, bukan chip: ia mengganti TAMPILAN,
// bukan menyaring, dan bentuknya harus beda dari chip filter.
//
// Pencarian dan panel filter DIHAPUS. Seorang pekerja memegang beberapa tugas
// terbuka sekaligus, bukan puluhan: menggulir lebih cepat daripada mengetik.
// Penghapusan itu sekaligus membunuh kombinasi filter mati yang dulu ada di
// sini — sumbu "Status" di sheet berisi "Selesai", dan memasangkannya dengan
// chip waktu seperti "Hari ini" selalu menghasilkan nol baris tanpa penjelasan,
// karena taskTimeBucket memetakan tugas selesai ke 'inactive'.
type CompletionFilter = 'unfinished' | 'completed';

const COMPLETION_SEGMENTS = [
  { key: 'unfinished', label: 'Belum selesai' },
  { key: 'completed', label: 'Selesai' },
];

// Batas riwayat segmen "Selesai": 7 hari terakhir — jauh lebih pendek dari 30
// hari milik owner, dan itu disengaja. Pekerja membuka arsip untuk memastikan
// "yang tadi tercatat, kan?", bukan untuk menelusuri riwayat sebulan.
//
// Disaring di KLIEN atas dueDate, tanggal yang SAMA dengan yang dipakai
// mengurutkan dan mengelompokkan baris (buildTaskSections memetakan lewat
// taskTimeBucket yang juga membaca dueDate). Memakai tanggal lain akan membuat
// baris yang lolos saringan jatuh di tempat yang tidak sesuai dengan alasan ia
// lolos.
const COMPLETED_LOOKBACK_DAYS = 7;

export default function WorkerTaskListScreen() {
  const { currentFarm } = useAuth();
  const [completionFilter, setCompletionFilter] = React.useState<CompletionFilter>('unfinished');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [tasks, setTasks] = React.useState<CareTask[]>([]);

  const farmId = currentFarm?.farmId;
  const hasLoadedOnceRef = React.useRef(false);

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

  // LoadingState layar penuh HANYA sebelum ada data sama sekali. Dulu efek ini
  // tanpa syarat menyalakannya tiap layar mendapat fokus, sehingga seluruh
  // daftar lenyap sekejap tiap kali kembali dari detail tugas; sesudah pemuatan
  // pertama, penyegaran berjalan di latar dengan baris lama tetap terlihat.
  //
  // Berbeda dari layar jadwal owner, di sini TIDAK ada penjaga hasil basi
  // (requestIdRef) maupun loadedFilter: chip tidak memicu pengambilan ulang —
  // getWorkerTasks selalu memuat seluruh tugas milik pengguna dan kedua chip
  // menyaringnya di klien — jadi tidak pernah ada dua permintaan yang berlomba.
  useFocusEffect(
    React.useCallback(() => {
      if (!hasLoadedOnceRef.current) {
        setLoading(true);
      }

      loadTasks().finally(() => {
        hasLoadedOnceRef.current = true;
        setLoading(false);
      });
    }, [loadTasks])
  );

  if (loading) {
    return <LoadingState message="Memuat tugas..." />;
  }

  const todayIso = getTodayIsoDate();

  // Ember waktu dihitung SEKALI per tugas, lalu dipakai ulang untuk penempatan
  // section — satu sumber kebenaran, tidak dua definisi. scheduleIsCancelled =
  // false: getWorkerTasks sudah menyaring keluar tugas dari jadwal yang
  // dibatalkan sebelum data sampai ke sini.
  //
  // Tidak perlu agregasi seperti scheduleTimeBucket di layar owner: sebuah
  // tugas tidak punya anak, dueDate dan status-nya milik sendiri, jadi
  // taskTimeBucket langsung memberi jawaban final. Cabang "nol tugas" milik
  // jadwal juga tidak punya padanan di sini.
  const buckets: Record<string, TimeBucket> = {};
  for (const task of tasks) {
    buckets[task.id] = taskTimeBucket(task, todayIso, false);
  }

  const completedFromIso = addDaysToIsoDate(todayIso, -COMPLETED_LOOKBACK_DAYS);

  // Segmen "Selesai" adalah ARSIP: satu daftar rata tanpa section dan tanpa
  // header, tidak melewati buildTaskSections sama sekali. Ketiga nama section
  // menyatakan hubungan dengan pekerjaan yang MASIH menunggu, dan tak satu pun
  // benar untuk tugas yang sudah dikerjakan.
  const isArchive = completionFilter === 'completed';

  // Dua arah urutan. Agenda MENAIK: yang paling lama tertunggak di atas. Arsip
  // MENURUN: pekerja membuka arsip untuk memastikan "yang tadi tercatat, kan",
  // dan jawabannya selalu ada di ujung terbaru.
  const displayedTasks = tasks
    .filter((task) => {
      if (isTaskSettled(task) !== isArchive) {
        return false;
      }

      // Jendela riwayat. Hanya berlaku di segmen "Selesai": agenda tidak boleh
      // kehilangan tunggakan hanya karena tanggalnya tua.
      return !isArchive || task.dueDate >= completedFromIso;
    })
    .sort((a, b) => {
      const ascending = a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;

      return isArchive ? -ascending : ascending;
    });

  const sections = isArchive ? [] : buildTaskSections(displayedTasks, buckets);

  return (
    <Screen
      header={
        // "Tugas", bukan "Perawatan". Pekerja tidak menyusun perawatan; ia
        // mengerjakan tugas yang sudah ditetapkan, dan kata itulah yang dipakai
        // di seluruh layar ini.
        <MainTabHeader title="Tugas" />
      }
    >
      <ErrorBanner message={error} />

      {error ? null : (
        <>
          <SegmentedControl
            onChange={(key) => setCompletionFilter(key === 'completed' ? 'completed' : 'unfinished')}
            options={COMPLETION_SEGMENTS}
            value={completionFilter}
          />

          {/* Hanya di segmen arsip, untuk menyatakan jendelanya. Di agenda tidak
              ada baris apa pun di sini. */}
          {isArchive ? (
            <Text selectable style={styles.metaLine}>
              {`${COMPLETED_LOOKBACK_DAYS} hari terakhir`}
            </Text>
          ) : null}

          {displayedTasks.length === 0 ? (
            <TaskEmptyState completionFilter={completionFilter} hasAnyTask={tasks.length > 0} />
          ) : isArchive ? (
            // Arsip: satu kotak, tanpa section dan tanpa header. overdueDays
            // selalu null — tugas yang sudah selesai tidak bisa telat lagi.
            <View style={styles.sectionRows}>
              {displayedTasks.map((task, index) => (
                <TaskRow
                  key={task.id}
                  isLast={index === displayedTasks.length - 1}
                  onPress={() => router.push(`/worker/tasks/${task.id}`)}
                  overdueDays={null}
                  showDate
                  task={task}
                />
              ))}
            </View>
          ) : (
            <View style={styles.sections}>
              {sections.map((section) => (
                <View key={section.key} style={styles.section}>
                  <Text
                    selectable
                    style={[
                      styles.sectionTitle,
                      section.tone === 'danger' ? styles.sectionTitleDanger : null,
                    ]}
                  >
                    {section.title}
                  </Text>
                  <View style={styles.sectionRows}>
                    {section.tasks.map((task, index) => (
                      <TaskRow
                        key={task.id}
                        isLast={index === section.tasks.length - 1}
                        onPress={() => router.push(`/worker/tasks/${task.id}`)}
                        overdueDays={
                          section.tone === 'danger'
                            ? Math.max(1, dayDifference(task.dueDate, todayIso))
                            : null
                        }
                        // Section "Hari ini" sudah menyatakan tanggalnya di
                        // headernya sendiri.
                        showDate={section.key !== 'today'}
                        task={task}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

// TIGA varian, dan tidak ada varian "hasil pencarian nihil" — layar ini tidak
// punya kolom cari, jadi keadaan itu tidak bisa terjadi di sini.
//
// Agenda kosong dipisah jadi DUA keadaan yang berbeda, dan pemisahannya bisa
// dipercaya: getWorkerTasks tidak punya jendela tanggal, jadi `tasks` memuat
// SELURUH tugas milik pengguna dan `hasAnyTask` benar-benar berarti "orang ini
// belum pernah diberi tugas" — tidak seperti layar jadwal owner, yang datanya
// dibatasi jendela 180 hari sehingga tidak bisa membedakan keduanya.
//
// Kedua kalimatnya menjawab pertanyaan yang berbeda. "Belum ada tugas" berarti
// tunggu pemilik. "Semua tugas sudah selesai" berarti pekerjaannya sudah beres,
// dan menyebut segmen "Selesai" karena di situlah bukti kerjanya sekarang
// berada — persis yang dicari orang yang baru saja menyelesaikan tugas
// terakhirnya dan melihat daftarnya mendadak kosong.
function TaskEmptyState({
  completionFilter,
  hasAnyTask,
}: {
  completionFilter: CompletionFilter;
  hasAnyTask: boolean;
}) {
  if (completionFilter === 'completed') {
    return (
      <EmptyState
        icon="clipboard"
        subtitle={`Tugas yang Anda kerjakan dalam ${COMPLETED_LOOKBACK_DAYS} hari terakhir muncul di sini.`}
        title="Belum ada yang selesai"
        variant="plain"
      />
    );
  }

  if (!hasAnyTask) {
    return (
      <EmptyState
        icon="list-check"
        subtitle="Tugas dari pemilik akan muncul di sini."
        title="Belum ada tugas"
        variant="plain"
      />
    );
  }

  return (
    <EmptyState
      icon="check"
      subtitle={'Buka "Selesai" untuk melihat yang sudah dikerjakan.'}
      title="Semua tugas sudah selesai"
      variant="plain"
    />
  );
}

// Baris agenda, bukan kartu. DUA baris teks + satu penanda di kanan.
//
// Baris pertama adalah KATEGORI, bukan judul yang diketik pemilik. Judul bebas
// berbunyi "Test", "Gawe baru", "awas" — kata-kata yang hanya berarti bagi orang
// yang mengetiknya. Bagi pekerja yang membacanya di kebun, "Penyemprotan"
// memberi tahu apa yang harus dibawa; "awas" tidak. Judulnya tidak dihapus dari
// data, ia hanya berhenti menempati baris paling menonjol.
//
// Baris kedua: target · tanggal. Tanpa nama pekerja — pekerja sudah tahu ini
// tugasnya sendiri. Ruas tanggal dilepas di section "Hari ini", yang headernya
// sudah menyatakannya; karena dilepas SEBELUM join, tidak ada pemisah
// menggantung yang tertinggal.
//
// Kepadatannya SENGAJA lebih longgar daripada baris jadwal owner. Owner
// memindai puluhan baris sambil duduk; pekerja menekan satu dari beberapa
// target di kebun, mungkin sambil berdiri dan memegang alat. Lihat catatan
// angka di StyleSheet bawah.
function TaskRow({
  isLast,
  onPress,
  overdueDays,
  showDate,
  task,
}: {
  isLast: boolean;
  onPress: () => void;
  // Non-null hanya di section "Terlambat".
  overdueDays: number | null;
  showDate: boolean;
  task: CareTask;
}) {
  // category boleh null di care_tasks; 'Tugas perawatan' adalah teks lama yang
  // sudah dipakai di sini sebagai jatuh-balik, dipertahankan apa adanya.
  const title = task.category ? formatCareCategory(task.category) : 'Tugas perawatan';
  const metaLine = [formatCareTarget(task), showDate ? formatFullDate(task.dueDate) : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable onPress={onPress} style={[styles.row, isLast ? null : styles.rowDivider]}>
      <View style={styles.rowHeader}>
        <Text selectable numberOfLines={2} style={styles.rowTitle}>
          {title}
        </Text>
        <TaskRowMarker overdueDays={overdueDays} task={task} />
      </View>

      <Text selectable numberOfLines={2} style={styles.rowMeta}>
        {metaLine}
      </Text>

      {task.requiresPhoto ? (
        <View style={styles.rowAttributes}>
          <View style={styles.proofPill}>
            <Icon name="camera" size={tokens.icon.xs} color={statusColors.warning.text} />
            <Text selectable={false} style={styles.proofPillText}>
              Butuh bukti
            </Text>
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

// PALING BANYAK SATU penanda di kolom kanan, berprioritas.
//
// Urutannya sama dengan baris jadwal owner, dikurangi dua yang tidak punya data
// di sini:
//   1. Terlambat -- tunggakan.
//   2. Ditunda   -- care_tasks.status, milik tugas itu sendiri.
//   3. Berulang  -- TIDAK ADA. Pengulangan adalah sifat care_schedules
//      (repeat_every_days), dan CareTask tidak membawanya. Sebuah tugas adalah
//      satu siklus dari rantai, jadi memberitahu pekerja "tiap 7 hari" pun
//      tidak mengubah apa yang harus ia kerjakan hari ini.
//   ("Dibatalkan" juga tidak ada: getWorkerTasks sudah menyaring keluar tugas
//    dari jadwal yang dibatalkan sebelum data sampai ke layar ini.)
//
// Setiap penanda membawa TEKS, bukan hanya warna.
function TaskRowMarker({ overdueDays, task }: { overdueDays: number | null; task: CareTask }) {
  if (overdueDays !== null) {
    return (
      <Text selectable={false} style={styles.overdueText}>
        {`Telat ${overdueDays} hari`}
      </Text>
    );
  }

  if (task.status === 'postponed') {
    return (
      <View style={styles.neutralPill}>
        <Text selectable={false} style={styles.neutralPillText}>
          Ditunda
        </Text>
      </View>
    );
  }

  return null;
}

type TaskSection = {
  key: string;
  title: string;
  tone: 'danger' | 'default';
  tasks: CareTask[];
};

// Dipakai HANYA untuk segmen "Belum selesai". Arsip dirender sebagai daftar rata
// di layar, tidak lewat sini — lihat `isArchive`.
//
// Partisi TOTAL: setiap tugas masuk ke tepat satu section — tidak ada jalur
// yang membuang baris, tidak ada filter dan tidak ada continue yang menjatuhkan
// apa pun. Jumlah baris yang dirender selalu sama dengan panjang input.
//
// Cabang `else` yang menampung ember 'inactive' ke "Mendatang" adalah PENJAGA,
// bukan jalur yang diharapkan: di segmen agenda taskTimeBucket hanya
// mengembalikan 'inactive' untuk tugas berstatus 'completed', dan isTaskSettled()
// sudah membuangnya lebih dulu. Kalau salah satu definisi itu bergeser, barisnya
// tetap TERLIHAT alih-alih lenyap tanpa jejak.
//
// TIGA section, urut tetap: Terlambat, Hari ini, Mendatang. Header per tanggal
// dihapus dengan alasan yang sama seperti di layar jadwal owner: tanggalnya kini
// ada di baris meta tiap baris (kecuali di "Hari ini"), dan header per tanggal
// membuat daftar berisi lebih banyak header daripada pekerjaan.
//
// Section yang kosong TIDAK dimasukkan sama sekali, jadi headernya juga tidak
// pernah dirender.
//
// `tasks` sudah terurut dueDate MENAIK, jadi isi tiap section ikut menaik.
function buildTaskSections(
  tasks: CareTask[],
  buckets: Record<string, TimeBucket>
): TaskSection[] {
  const overdue: CareTask[] = [];
  const today: CareTask[] = [];
  const upcoming: CareTask[] = [];

  for (const task of tasks) {
    // Lihat catatan yang sama di layar jadwal owner: 'missed' (migrasi 048)
    // ikut section "Terlambat".
    const bucket = buckets[task.id];

    if (bucket === 'overdue' || bucket === 'missed') {
      overdue.push(task);
    } else if (bucket === 'today') {
      today.push(task);
    } else {
      upcoming.push(task);
    }
  }

  const sections: TaskSection[] = [];

  // TANPA angka di header, termasuk di "Terlambat" — berbeda dari layar jadwal
  // owner, dan itu disengaja. Jumlahnya sudah terbaca dari barisnya sendiri, dan
  // angka di sebelah kata "Terlambat" mudah salah dibaca sebagai lama hari.
  if (overdue.length > 0) {
    sections.push({ key: 'overdue', title: 'Terlambat', tone: 'danger', tasks: overdue });
  }

  if (today.length > 0) {
    sections.push({ key: 'today', title: 'Hari ini', tone: 'default', tasks: today });
  }

  if (upcoming.length > 0) {
    sections.push({ key: 'upcoming', title: 'Mendatang', tone: 'default', tasks: upcoming });
  }

  return sections;
}

// Pemisah agenda-vs-arsip untuk chip atas. Padanan isScheduleSettled di layar
// jadwal owner, tapi cukup satu baris: sebuah tugas tidak punya anak yang harus
// diagregasi. 'postponed' SENGAJA bukan penutup — tugas yang ditunda masih
// menunggu dikerjakan, dan seluruh basis kode memperlakukannya begitu
// (taskTimeBucket, dueDatePill, dan penghitung dashboard pekerja).
function isTaskSettled(task: CareTask): boolean {
  return task.status === 'completed';
}

const styles = StyleSheet.create({
  metaLine: { ...tokens.type.meta, color: tokens.color.text.tertiary },

  // Agenda: section dipisah jarak, baris dipisah garis rambut — bukan kartu
  // bertumpuk berbayang.
  sections: { gap: tokens.layout.sectionGap },
  section: { gap: tokens.space.sm },
  sectionTitle: { ...tokens.type.label, color: tokens.color.text.secondary },
  sectionTitleDanger: { color: tokens.color.status.danger.text },
  sectionRows: {
    backgroundColor: tokens.color.surface.card,
    borderColor: tokens.color.line.card,
    borderCurve: 'continuous',
    borderRadius: tokens.radius.cardInner,
    borderWidth: 1,
    overflow: 'hidden',
  },

  // Kepadatan baris pekerja vs baris jadwal owner — sengaja berbeda:
  //   paddingVertical  space.lg (16) vs space.md (12) owner
  //   gap dalam baris  space.sm (8)  vs space.xs (4)  owner
  //   judul            subheading (17/23) vs bodyStrong (16/22) owner
  //   meta             bodySmall (14/20)  vs meta (13/18)       owner
  //   warna meta       text.secondary     vs text.tertiary      owner
  // Tinggi baris terpendek jadi 16+23+16 = 55, jauh di atas tapTarget 44.
  // paddingHorizontal dibiarkan sama (16): itu irama tepi layar, bukan
  // kepadatan, dan menggesernya justru membuat baris tidak sejajar dengan
  // header section di atasnya.
  row: {
    gap: tokens.space.sm,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.lg,
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
  rowTitle: { ...tokens.type.subheading, color: tokens.color.text.primary, flex: 1 },
  overdueText: { ...tokens.type.label, color: tokens.color.status.danger.text, flexShrink: 0 },
  // Pil netral untuk "Ditunda". Ukurannya mengikuti kepadatan baris pekerja
  // (paddingVertical 2 sama dengan proofPill di bawah), bukan baris owner.
  neutralPill: {
    alignItems: 'center',
    backgroundColor: tokens.color.status.neutral.bg,
    borderRadius: tokens.radius.pill,
    flexDirection: 'row',
    flexShrink: 0,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 2,
  },
  neutralPillText: { ...tokens.type.caption, color: tokens.color.status.neutral.text },
  rowMeta: { ...tokens.type.bodySmall, color: tokens.color.text.secondary },

  rowAttributes: {
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
});
