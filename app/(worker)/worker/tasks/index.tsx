import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatCareTarget } from '../../../../src/components/care-schedule-components';
import { Icon } from '../../../../src/components/icons';
import {
  ChipButton,
  EmptyState,
  ErrorBanner,
  FilterChipsRow,
  LoadingState,
  MainTabHeader,
  Screen,
} from '../../../../src/components/ui';
import { statusColors, tokens } from '../../../../src/constants/theme';
import { useAuth } from '../../../../src/context/auth-context';
import { getWorkerTasks } from '../../../../src/services/careTaskService';
import type { CareTask } from '../../../../src/types/domain';
import { formatCareCategory } from '../../../../src/utils/displayFormat';
import {
  dayDifference,
  formatAgendaSectionTitle,
  getTodayIsoDate,
  taskTimeBucket,
  type TimeBucket,
} from '../../../../src/utils/taskDueDate';

// Sumbu waktu dinyatakan oleh struktur section (Terlambat + per tanggal), bukan
// chip — sama seperti layar jadwal owner. Yang tersisa di baris chip hanya
// pemisah agenda-vs-arsip.
//
// Pencarian dan panel filter DIHAPUS. Seorang pekerja memegang beberapa tugas
// terbuka sekaligus, bukan puluhan: menggulir lebih cepat daripada mengetik.
// Penghapusan itu sekaligus membunuh kombinasi filter mati yang dulu ada di
// sini — sumbu "Status" di sheet berisi "Selesai", dan memasangkannya dengan
// chip waktu seperti "Hari ini" selalu menghasilkan nol baris tanpa penjelasan,
// karena taskTimeBucket memetakan tugas selesai ke 'inactive'.
type CompletionFilter = 'unfinished' | 'completed';

const completionFilters: Array<{ label: string; value: CompletionFilter }> = [
  { label: 'Belum selesai', value: 'unfinished' },
  { label: 'Selesai', value: 'completed' },
];

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

  // Urutan menaik dipakai DUA kali: di dalam section "Terlambat" (paling lama
  // telat di atas) dan sebagai urutan section per tanggal.
  const displayedTasks = tasks
    .filter((task) => isTaskSettled(task) === (completionFilter === 'completed'))
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));

  const sections = buildTaskSections(displayedTasks, buckets, todayIso);

  return (
    <Screen
      header={
        <MainTabHeader title="Perawatan" />
      }
    >
      <ErrorBanner message={error} />

      {error ? null : (
        <>
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

          {displayedTasks.length === 0 ? (
            <TaskEmptyState completionFilter={completionFilter} hasAnyTask={tasks.length > 0} />
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

// Layar ini memegang SELURUH tugas pengguna sekaligus (getWorkerTasks tidak
// punya jendela tanggal), jadi keadaan "belum punya tugas sama sekali" bisa
// dibedakan dengan pasti dari "semua tugas sudah beres" — tidak seperti layar
// jadwal owner yang harus berhati-hati karena datanya dibatasi jendela 180 hari.
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
        subtitle="Tugas yang sudah Anda kerjakan akan muncul di sini."
        title="Belum ada tugas selesai"
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

// Baris agenda, bukan kartu. Tanggal tidak ikut di sini — section header yang
// menyatakannya, dan badge status juga hilang karena sudah tersirat dari chip
// dan section. Instruksi juga dilepas: panjangnya tidak bisa diramalkan dan
// tempatnya memang di layar detail. Yang tersisa hanya yang TIDAK tersirat:
// lama keterlambatan dan penanda butuh bukti.
//
// Kepadatannya SENGAJA lebih longgar daripada baris jadwal owner. Owner
// memindai puluhan baris sambil duduk; pekerja menekan satu dari beberapa
// target di kebun, mungkin sambil berdiri dan memegang alat. Lihat catatan
// angka di StyleSheet bawah.
function TaskRow({
  isLast,
  onPress,
  overdueDays,
  task,
}: {
  isLast: boolean;
  onPress: () => void;
  // Non-null hanya di section "Terlambat".
  overdueDays: number | null;
  task: CareTask;
}) {
  const categoryLabel = task.category ? formatCareCategory(task.category) : null;
  const title = task.title || categoryLabel || 'Tugas perawatan';
  // Kategori dilewati kalau judulnya memang kategori itu sendiri (tugas tanpa
  // judul) — mengulanginya di baris meta tidak menambah informasi apa pun.
  const metaParts = [categoryLabel === title ? null : categoryLabel, formatCareTarget(task)];
  const metaLine = metaParts.filter(Boolean).join(' · ');

  return (
    <Pressable onPress={onPress} style={[styles.row, isLast ? null : styles.rowDivider]}>
      <View style={styles.rowHeader}>
        <Text selectable numberOfLines={2} style={styles.rowTitle}>
          {title}
        </Text>
        {overdueDays === null ? null : (
          <Text selectable={false} style={styles.overdueText}>
            {`${overdueDays} hari`}
          </Text>
        )}
      </View>

      {metaLine ? (
        <Text selectable numberOfLines={1} style={styles.rowMeta}>
          {metaLine}
        </Text>
      ) : null}

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

type TaskSection = {
  key: string;
  title: string;
  tone: 'danger' | 'default';
  tasks: CareTask[];
};

// Partisi TOTAL: setiap tugas masuk ke tepat satu section — tidak ada jalur
// yang membuang baris, tidak ada filter dan tidak ada continue yang menjatuhkan
// apa pun. Jumlah baris yang dirender selalu sama dengan panjang input.
//
// `tasks` sudah terurut dueDate MENAIK, jadi: (1) isi section "Terlambat" ikut
// menaik (paling lama telat di atas), dan (2) kunci Map bertambah menaik
// sehingga urutan section per tanggal juga menaik — Map mempertahankan urutan
// penyisipan.
//
// Di chip "Selesai" seluruh tugas ber-bucket 'inactive', jadi tidak ada yang
// masuk section "Terlambat" dan semuanya dikelompokkan menurut dueDate. Itu
// perilaku yang diinginkan: arsip tidak punya tunggakan.
function buildTaskSections(
  tasks: CareTask[],
  buckets: Record<string, TimeBucket>,
  todayIso: string
): TaskSection[] {
  const overdue: CareTask[] = [];
  const byDate = new Map<string, CareTask[]>();

  for (const task of tasks) {
    // Lihat catatan yang sama di layar jadwal owner: 'missed' (migrasi 048)
    // sementara ikut section "Terlambat" supaya tampilan tidak berubah sebelum
    // tahap polish UI.
    const bucket = buckets[task.id];

    if (bucket === 'overdue' || bucket === 'missed') {
      overdue.push(task);
      continue;
    }

    const existing = byDate.get(task.dueDate);

    if (existing) {
      existing.push(task);
    } else {
      byDate.set(task.dueDate, [task]);
    }
  }

  const sections: TaskSection[] = [];

  // Digabung jadi SATU section berapa pun tanggalnya: yang penting bagi pekerja
  // adalah "ini menumpuk", bukan tersebar di banyak header tanggal lampau.
  // Tanpa angka di header — jumlahnya sudah terbaca dari barisnya sendiri, dan
  // angka di sebelah kata "Terlambat" mudah salah dibaca sebagai lama hari.
  if (overdue.length > 0) {
    sections.push({
      key: 'overdue',
      title: 'Terlambat',
      tone: 'danger',
      tasks: overdue,
    });
  }

  for (const [iso, list] of byDate) {
    sections.push({
      key: iso,
      title: formatAgendaSectionTitle(iso, todayIso),
      tone: 'default',
      tasks: list,
    });
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
