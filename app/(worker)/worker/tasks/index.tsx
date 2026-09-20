import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  WorkerTaskCard,
  WorkerTaskMarker,
} from '../../../../src/components/care-schedule-components';
import {
  EmptyState,
  ErrorBanner,
  RootTabTitle,
  Screen,
  SectionLabel,
  SkeletonList,
  UnderlineTabs,
} from '../../../../src/components/ui';
import { colors, spacing, tokens } from '../../../../src/constants/theme';
import { useAuth } from '../../../../src/context/auth-context';
import { getWorkerTasks } from '../../../../src/services/careTaskService';
import type { CareTask } from '../../../../src/types/domain';
import {
  addDaysToIsoDate,
  dayDifference,
  getTodayIsoDate,
  taskTimeBucket,
  type TimeBucket,
} from '../../../../src/utils/taskDueDate';

// Sumbu waktu dinyatakan oleh struktur seksi (Telat / Hari ini / Besok), bukan
// chip — sama seperti layar Perawatan pemilik. Pemisah agenda-vs-arsip memakai
// TAB BERGARIS BAWAH: ia mengganti TAMPILAN, bukan menyaring, dan bentuknya
// harus beda dari chip filter. Sejak batch 6b ia komponen yang sama persis
// dengan Daftar/Denah di layar Pohon dan Belum selesai/Selesai di layar
// Perawatan pemilik.
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

// Tinggi kartu kerangka. Ditiru dari <WorkerTaskCard> dengan instruksi dua
// baris: padding 18+18, judul 23, meta 20, instruksi 2x22, tombol 56, ditambah
// tiga gap 12 -> sekitar 212. Disalin sebagai angka, sama seperti kerangka
// daftar pohon dan daftar jadwal — kerangka yang meleset beberapa piksel tidak
// merusak apa pun, dan mengekspor konstanta tata letak kartu hanya untuk
// kerangkanya mengikat keduanya lebih erat daripada yang perlu.
const TASK_CARD_SKELETON_HEIGHT = 212;

export default function WorkerTaskListScreen() {
  const { currentFarm } = useAuth();
  // Inset atas diterapkan DI SINI, bukan lewat `applyTopInset` pada <Screen>.
  // Sejak batch 6b judul dan tab layar ini duduk DI LUAR Screen — supaya
  // keduanya tidak ikut tergulung bersama daftar — jadi elemen teratas yang
  // nyata bukan lagi Screen. Rumusnya sama persis dengan layar Pohon dan layar
  // Perawatan pemilik.
  const insets = useSafeAreaInsets();
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

  const sections = isArchive ? [] : buildTaskSections(displayedTasks, buckets, todayIso);

  return (
    // JUDUL DAN TAB DI LUAR <Screen>, sama persis dengan layar Pohon dan layar
    // Perawatan pemilik.
    //
    // Keduanya milik HALAMAN, bukan milik salah satu tab: judul "Tugas" tidak
    // berganti saat pekerja menekan Selesai. Kalau keduanya dirender sebagai
    // anak Screen, keduanya ikut tergulung bersama daftar kartu yang kini jauh
    // lebih tinggi daripada baris sebelumnya.
    <View style={styles.root}>
      <View style={[styles.headerWrap, { paddingTop: spacing.xl + insets.top }]}>
        {/* Judul layar root tab, 26 rata kiri — penundaan dari batch 1b.
            "Tugas", kata yang sama dengan label tab di bawahnya; lihat catatan
            panjang pada workerNavigationItems di role-bottom-navigation.tsx
            tentang kenapa sisi pekerja memakai kata ini dan sisi pemilik
            memakai "Perawatan". */}
        <RootTabTitle title="Tugas" />
        <View style={styles.tabsWrap}>
          <UnderlineTabs
            onChange={(key) => setCompletionFilter(key === 'completed' ? 'completed' : 'unfinished')}
            options={COMPLETION_SEGMENTS}
            value={completionFilter}
          />
        </View>
      </View>

      <Screen>
        <ErrorBanner message={error} />

        {error ? null : loading ? (
          // KERANGKA hanya di pemuatan PERTAMA, dan itu satu-satunya tempat ia
          // bisa jujur di layar ini.
          //
          // Berpindah tab TIDAK memuat ulang apa pun: getWorkerTasks mengambil
          // seluruh tugas milik pengguna sekali, dan kedua tab menyaringnya di
          // klien. Pertukarannya seketika, tanpa satu frame pun menunggu.
          // Memasang kerangka di sana berarti mengarang penantian yang tidak
          // ada — persis kebalikan dari alasan kerangka dipasang di layar
          // Perawatan pemilik, yang memang menembak ulang tiap tab berpindah.
          <SkeletonList rows={3} rowHeight={TASK_CARD_SKELETON_HEIGHT} />
        ) : (
          <>
            {/* Hanya di tab arsip, untuk menyatakan jendelanya. Di agenda tidak
                ada baris apa pun di sini. */}
            {isArchive ? (
              <Text selectable style={styles.metaLine}>
                {`${COMPLETED_LOOKBACK_DAYS} hari terakhir`}
              </Text>
            ) : null}

            {displayedTasks.length === 0 ? (
              <TaskEmptyState completionFilter={completionFilter} hasAnyTask={tasks.length > 0} />
            ) : isArchive ? (
              // Arsip: satu daftar rata, tanpa seksi dan tanpa label.
              // overdueDays selalu null — tugas yang sudah selesai tidak bisa
              // telat lagi.
              <View style={styles.cardList}>
                {displayedTasks.map((task) => (
                  <WorkerTaskCard
                    key={task.id}
                    instruction={task.instruction}
                    marker={<WorkerTaskMarker overdueDays={null} task={task} />}
                    showDate
                    task={task}
                    onOpenDetail={() => router.push(`/worker/tasks/${task.id}`)}
                    onRecord={() => router.push(`/worker/tasks/${task.id}/record?mode=create`)}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.sections}>
                {sections.map((section) => (
                  <View key={section.key} style={styles.section}>
                    {/* <SectionLabel> bersama: 12/600 huruf besar, textMuted.
                        Menggantikan baris judul 14 yang mewarnai dirinya merah
                        di seksi tunggakan. Warna itu tidak lagi dibutuhkan:
                        tiap kartu di bawahnya sudah membawa penandanya sendiri
                        ("Telat N hari" atau badge "Hangus"), dan label seksi
                        yang ikut memerah membuat satu fakta diulang dua kali
                        dalam satu tarikan mata. */}
                    <SectionLabel title={section.title} />
                    <View style={styles.cardList}>
                      {section.tasks.map((task) => (
                        <WorkerTaskCard
                          key={task.id}
                          instruction={task.instruction}
                          marker={
                            <WorkerTaskMarker
                              overdueDays={
                                section.tone === 'danger'
                                  ? Math.max(1, dayDifference(task.dueDate, todayIso))
                                  : null
                              }
                              task={task}
                            />
                          }
                          // Seksi "Hari ini" dan "Besok" sudah menyatakan
                          // tanggalnya di labelnya sendiri untuk semua kartu di
                          // bawahnya; mengulanginya di tiap kartu hanya menambah
                          // kata yang harus dilewati sebelum sampai ke targetnya.
                          showDate={section.key !== 'today' && section.key !== 'tomorrow'}
                          task={task}
                          onOpenDetail={() => router.push(`/worker/tasks/${task.id}`)}
                          onRecord={() => router.push(`/worker/tasks/${task.id}/record?mode=create`)}
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
    </View>
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
// EMPAT ember, TIGA nama yang disebut spek. Urut tetap: Telat, Hari ini, Besok,
// Mendatang.
//
// Spek batch 6b menyebut tiga: TELAT, HARI INI, BESOK. Ember keempat DITAMBAHKAN
// dan itu penyimpangan yang disengaja — tanpanya tugas yang jatuh tempo lusa
// atau minggu depan tidak punya tempat, dan satu-satunya cara memuatnya di
// bawah label "Besok" adalah menulis label yang berbohong. Pilihan yang tersisa
// cuma dua: membuang barisnya, atau menamainya dengan benar. Membuang baris
// melanggar partisi total yang dijaga seluruh berkas ini.
//
// "Besok" dipisah dari "Mendatang" karena memang itu maksud speknya: horizon
// pekerja pendek, dan hari esok layak punya labelnya sendiri alih-alih melebur
// ke dalam satu tumpukan "nanti". Pada kebun yang jadwalnya rapat, seksi
// "Mendatang" sering kosong dan layarnya memang berisi tepat tiga label.
//
// "Telat" menggantikan "Terlambat", kata yang sama dengan penanda di tiap
// kartunya ("Telat N hari") dan dengan seksi di layar Perawatan pemilik. Satu
// kata untuk satu keadaan, di kedua sisi aplikasi.
//
// Partisi TOTAL: setiap tugas masuk ke tepat satu ember — tidak ada filter dan
// tidak ada continue yang menjatuhkan apa pun. Jumlah kartu yang dirender selalu
// sama dengan panjang input.
//
// Seksi yang kosong TIDAK dimasukkan sama sekali, jadi labelnya juga tidak
// pernah dirender.
//
// `tasks` sudah terurut dueDate MENAIK, jadi isi tiap seksi ikut menaik.
function buildTaskSections(
  tasks: CareTask[],
  buckets: Record<string, TimeBucket>,
  todayIso: string
): TaskSection[] {
  const tomorrowIso = addDaysToIsoDate(todayIso, 1);

  const overdue: CareTask[] = [];
  const today: CareTask[] = [];
  const tomorrow: CareTask[] = [];
  const upcoming: CareTask[] = [];

  for (const task of tasks) {
    // 'missed' (migrasi 048) ikut seksi "Telat", sama seperti di sisi pemilik.
    // Yang membedakannya dari telat biasa adalah PENANDA di kartunya, bukan
    // tempat duduknya: bagi pekerja yang memindai tunggakan, keduanya sama-sama
    // pekerjaan yang tidak terjadi pada waktunya.
    const bucket = buckets[task.id];

    if (bucket === 'overdue' || bucket === 'missed') {
      overdue.push(task);
    } else if (bucket === 'today') {
      today.push(task);
    } else if (task.dueDate === tomorrowIso) {
      // Dibaca dari dueDate, BUKAN dari ember: taskTimeBucket berhenti di
      // 'upcoming' dan tidak mengenal "besok". Ini satu-satunya tempat di berkas
      // ini yang memeriksa tanggal langsung, dan ia aman karena ember 'today'
      // sudah diperiksa lebih dulu di cabang di atasnya.
      tomorrow.push(task);
    } else {
      // PENJAGA, bukan jalur yang diharapkan, untuk ember 'inactive': di tab
      // agenda taskTimeBucket hanya mengembalikannya untuk tugas 'completed',
      // dan isTaskSettled() sudah membuangnya lebih dulu. Kalau salah satu
      // definisi itu bergeser, kartunya tetap TERLIHAT di tempat yang paling
      // tidak berbahaya alih-alih lenyap tanpa jejak.
      upcoming.push(task);
    }
  }

  const sections: TaskSection[] = [];

  // TANPA angka di label, termasuk di "Telat" — berbeda dari layar Perawatan
  // pemilik, dan itu disengaja. Pemilik memindai puluhan baris dan jumlahnya
  // berarti tindakan; pekerja memegang beberapa, dan angka di sebelah kata
  // "Telat" mudah salah dibaca sebagai lama hari.
  if (overdue.length > 0) {
    sections.push({ key: 'overdue', title: 'Telat', tone: 'danger', tasks: overdue });
  }

  if (today.length > 0) {
    sections.push({ key: 'today', title: 'Hari ini', tone: 'default', tasks: today });
  }

  if (tomorrow.length > 0) {
    sections.push({ key: 'tomorrow', title: 'Besok', tone: 'default', tasks: tomorrow });
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
  // Kepala layar di luar <Screen>. Ketiga nilainya disalin dari layar Pohon dan
  // layar Perawatan pemilik, dan memang harus sama: tab root yang judulnya
  // berdiri di ketinggian berbeda terbaca sebagai aplikasi yang berbeda.
  root: { backgroundColor: colors.background, flex: 1 },
  headerWrap: { gap: tokens.space.md, paddingHorizontal: spacing.screenHorizontal },
  tabsWrap: { paddingBottom: tokens.space.sm },

  metaLine: { ...tokens.type.meta, color: tokens.color.text.tertiary },

  // Seksi dipisah jarak; KARTU dipisah jarak juga, bukan garis rambut di dalam
  // satu kotak seperti sebelum batch 6b.
  //
  // Bentuknya berubah karena isinya berubah: sejak tiap tugas membawa tombol
  // "Catat hasil" sendiri, ia bukan lagi baris dalam daftar melainkan satuan
  // pekerjaan yang berdiri sendiri. Garis rambut di antara dua benda yang
  // masing-masing punya tombol membuat keduanya terbaca sebagai satu blok yang
  // terbelah, dan tombol kedua tampak milik baris di atasnya.
  //
  // listGap (12), bukan sectionGap: kartu-kartu di dalam satu seksi adalah satu
  // daftar. Nilai yang sama dengan daftar kartu tugas di Beranda pekerja.
  sections: { gap: tokens.layout.sectionGap },
  section: { gap: tokens.space.sm },
  cardList: { gap: tokens.layout.listGap },
});
