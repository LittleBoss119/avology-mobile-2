import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '../../../src/constants/theme';
import { WorkerTaskCard } from '../../../src/components/care-schedule-components';
import {
  EmptyState,
  ErrorBanner,
  LoadingState,
  MenuRow,
  MenuRowGroup,
  RootTabTitle,
  Screen,
} from '../../../src/components/ui';
import { useAuth } from '../../../src/context/auth-context';
import { getWorkerTasks } from '../../../src/services/careTaskService';
import { colors as palette, text as typeScale } from '../../../src/theme/tokens';
import type { CareTask } from '../../../src/types/domain';
import { formatPersonDisplayName } from '../../../src/utils/displayFormat';
import { formatFullDate, getTodayIsoDate, taskTimeBucket } from '../../../src/utils/taskDueDate';

export default function WorkerDashboardScreen() {
  const { currentFarm, profile } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [todayTasks, setTodayTasks] = React.useState<CareTask[] | null>(null);

  const farmId = currentFarm?.farmId;

  const loadDashboard = React.useCallback(async () => {
    if (!farmId) {
      setError('Data pekerja aktif tidak ditemukan.');
      setTodayTasks(null);
      return;
    }

    setError(null);

    // getWorkerTasks, BUKAN getWorkerDashboardSummary — dan itu MENGURANGI
    // jumlah permintaan, bukan menambah.
    //
    // Layar ini sekarang menampilkan kartu tugas, bukan sekadar hitungannya,
    // jadi ia butuh barisnya. Begitu barisnya ada, angka serif 80 di atasnya
    // bisa dihitung dari panjang daftar yang sama — dan ringkasan yang dulu
    // memasok angka itu jadi permintaan ketiga yang tidak dirender apa pun.
    //
    // Ini JUGA bukan query baru: getWorkerTasks sudah dipakai layar Tugas
    // pekerja dengan argumen yang sama persis, dan filter "hari ini" di bawah
    // memakai taskTimeBucket yang juga sudah dipakai di sana. Tidak ada
    // service, RPC, maupun penghitung agregat yang ditambahkan.
    //
    // getTrees ikut dicabut bersama kartu Pohon: susunan Beranda pekerja yang
    // baru tidak punya blok kondisi kebun sama sekali.
    const result = await getWorkerTasks({ farmId });

    if (result.error) {
      setError('Data beranda belum bisa dimuat.');
      setTodayTasks(null);
      return;
    }

    const todayIso = getTodayIsoDate();

    // Definisi "hari ini" dipatok ke taskTimeBucket, pemetaan yang SAMA yang
    // membangun section "Hari ini" di layar Tugas. Angka di Beranda dan isi
    // section di layar Tugas karena itu tidak bisa berselisih — dan dulu
    // mereka bisa: countWorkerTasksDueToday di dashboardService menyaring
    // status di SQL, sedangkan layar Tugas menyaringnya di klien.
    //
    // scheduleIsCancelled false: getWorkerTasks sudah membuang tugas dari
    // jadwal yang dibatalkan sebelum datanya sampai ke sini.
    setTodayTasks(
      result.data.filter((task) => taskTimeBucket(task, todayIso, false) === 'today')
    );
  }, [farmId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadDashboard().finally(() => setLoading(false));
    }, [loadDashboard])
  );

  if (loading) {
    return <LoadingState message="Memuat dashboard pekerja..." />;
  }

  const greeting = `Halo, ${formatPersonDisplayName(profile?.fullName, 'Pekerja')}`;
  // Tanggal hari ini, sama seperti Beranda pemilik (batch 4a). Sebelumnya
  // hanya sisi pemilik yang membawanya, dan itu selisih yang tidak punya
  // alasan: justru DI SINILAH tanggal paling berguna, karena seluruh isi layar
  // ini adalah "hari ini" dan pekerja membukanya di kebun, jauh dari kalender.
  const today = formatFullDate(getTodayIsoDate());

  return (
    <Screen applyTopInset>
      {/* Judul layar root tab, 26 rata kiri — penundaan dari batch 1b.
          Alasannya sama dengan Beranda pemilik: sapaan ADALAH judul halaman
          ini, dan baris kedua bertuliskan "Beranda" hanya akan menamai tab yang
          ikonnya sudah menyala di bawah.

          Blok identitas kebun yang dulu berdiri di sini dicabut, sejalan dengan
          Beranda pemilik. Nama kebun tetap terbaca di tab Profil. */}
      <RootTabTitle title={greeting} meta={today} />

      <ErrorBanner message={error} />

      {todayTasks === null ? null : (
        <>
          {todayTasks.length === 0 ? (
            /* Ikon centang, judul, satu kalimat — bentuk <EmptyState> yang
               sudah ada, bukan blok baru.

               Kalimatnya "Belum ada pekerjaan yang dijadwalkan.", BUKAN bunyi
               spek "Abah belum menjadwalkan pekerjaan". Menyebut nama pemilik
               secara harfiah salah di dua tingkat: nama itu diketik saat kebun
               dibuat dan bisa apa saja, dan kalimat yang menunjuk seseorang
               membuat layar kosong terbaca sebagai keluhan tentang orang itu.
               Yang perlu diketahui pekerja hanya bahwa hari ini memang belum
               ada pekerjaannya. */
            <EmptyState
              icon="check"
              subtitle="Belum ada pekerjaan yang dijadwalkan."
              title="Tidak ada tugas hari ini"
              variant="plain"
            />
          ) : (
            <>
              {/* Angka serif 80: jumlah kartu yang dirender persis di bawahnya.
                  Dihitung dari panjang daftar yang sama, bukan dari penghitung
                  kedua — aturan yang sama dengan angka 72 di Beranda pemilik. */}
              <View>
                <Text accessibilityRole="header" selectable style={styles.bigNumber}>
                  {todayTasks.length}
                </Text>
                <Text selectable style={styles.bigNumberCaption}>
                  tugas hari ini
                </Text>
              </View>

              {/* KARTU BERSAMA dengan tab Tugas (batch 6b). TaskCard lokal
                  yang dulu berdiri di dasar berkas ini sudah diangkat ke
                  care-schedule-components.tsx apa adanya.

                  Yang memaksa pengangkatan: tab Tugas kini memakai bentuk kartu
                  yang sama, dan dua bentuk kartu tugas yang berbeda di dua layar
                  adalah beban belajar kedua bagi orang yang sama.

                  `showDate` sengaja tidak dioper: seluruh daftar ini hari ini,
                  dan angka besar di atasnya sudah menyatakannya.

                  Baris judulnya kini MEMBUKA DETAIL, dan itu tidak membatalkan
                  pencabutan "Lihat detail" di batch 4a: yang dicabut adalah
                  TOMBOL KEDUA yang memaksa memilih tiap kali, bukan jalur ke
                  detailnya. Baris berchevron adalah spesies yang berbeda —
                  bentuk yang sama dengan <MenuRow> di seluruh aplikasi — dan
                  instruksinya tetap dicetak di kartu, jadi jalur umumnya tetap
                  tidak butuh perpindahan layar sama sekali. */}
              {/* PALING BANYAK DUA KARTU (pasca-batch 7). Beranda adalah
                  RINGKASAN; menumpuk seluruh tugas hari ini ke bawah membuatnya
                  harus digulir, dan layar yang harus digulir untuk dibaca sudah
                  berhenti jadi ringkasan. Sisanya satu baris di bawah.

                  BUKAN GULIR MENDATAR. Kartu yang berada di luar layar ke samping
                  tidak bisa ditemukan: tidak ada yang memberi tahu bahwa ada
                  kartu di sebelah kanan. Menggulir ke bawah setidaknya punya
                  afordans yang sudah dikenal — dan di sini pun ia tidak lagi
                  diperlukan.

                  Urutannya urutan getWorkerTasks yang sama dengan seksi "Hari
                  ini" di tab Tugas, jadi dua kartu di sini adalah dua kartu
                  teratas di sana. */}
              <View style={styles.taskList}>
                {todayTasks.slice(0, HOME_TASK_LIMIT).map((task) => (
                  <WorkerTaskCard
                    key={task.id}
                    instruction={task.instruction}
                    task={task}
                    onOpenDetail={() => router.push(`/worker/tasks/${task.id}`)}
                    onRecord={() => router.push(`/worker/tasks/${task.id}/record?mode=create`)}
                  />
                ))}
              </View>

              {/* Hanya saat memang ada yang tersembunyi. Menyebut SELURUH
                  jumlahnya ("Lihat semua 5 tugas"), bukan sisanya ("3 lainnya"):
                  angka itu sama dengan angka besar di atas, jadi pekerja tidak
                  perlu menjumlahkan apa pun untuk tahu ke mana baris ini
                  membawanya.

                  router.replace ke tab Tugas, BUKAN push — cara yang sama dengan
                  bar navigasi bawah. Tab Tugas adalah tab root; mendorongnya ke
                  atas Beranda akan membuat tombol kembali membawa pulang ke
                  Beranda alih-alih ke luar aplikasi, dan satu tab akan berdiri di
                  dua tempat tumpukan sekaligus. */}
              {todayTasks.length > HOME_TASK_LIMIT ? (
                <MenuRowGroup>
                  <MenuRow
                    icon="list-check"
                    label={`Lihat semua ${todayTasks.length} tugas`}
                    onPress={() => router.replace('/worker/tasks')}
                  />
                </MenuRowGroup>
              ) : null}
            </>
          )}

          {/* Satu baris, selalu ada — juga saat tidak ada tugas. Kondisi pohon
              dicatat ketika pekerja MELIHAT sesuatu di kebun, bukan ketika ia
              diberi tugas, jadi ia justru paling dibutuhkan di hari yang
              kosong.

              Tujuannya /worker/trees, daftar pohon. Layar pencatatan kondisi
              menuntut satu pohon tertentu (/worker/trees/[treeId]/report), dan
              tidak ada rute yang menerima "catat kondisi" tanpa pohon — jadi
              pohonnya dipilih dulu. `meta` mengatakan itu di muka; tanpa baris
              itu, tombol berjudul "Catat kondisi pohon" yang membuka daftar
              terbaca sebagai salah tujuan. */}
          <MenuRowGroup>
            <MenuRow
              icon="tree"
              label="Catat kondisi pohon"
              meta="Pilih pohonnya dulu di daftar"
              onPress={() => router.push('/worker/trees')}
            />
          </MenuRowGroup>
        </>
      )}
    </Screen>
  );
}

// Jumlah kartu tugas di Beranda. Dua: cukup untuk menjawab "apa yang harus
// dikerjakan sekarang" tanpa menggulir di layar ponsel kelas bawah, bahkan saat
// kartunya membawa instruksi dua baris dan penanda bukti foto.
const HOME_TASK_LIMIT = 2;

const styles = StyleSheet.create({
  // Serif 80, satu tingkat di atas angka 72 Beranda pemilik. Pemilik membaca
  // layarnya sambil duduk; pekerja membacanya sambil berdiri di kebun, sering
  // dengan matahari di layar.
  bigNumber: { ...typeScale.stat80, color: palette.textPrimary },
  bigNumberCaption: { ...typeScale.meta, color: palette.textMuted },

  // listGap, bukan sectionGap: kartu-kartu ini satu daftar, bukan beberapa
  // seksi yang berdiri sendiri. Nilai yang sama dipakai daftar kartu di tab
  // Tugas.
  //
  // Gaya ISI kartu (judul, meta, instruksi) tidak lagi di sini: ia ikut pindah
  // ke <WorkerTaskCard> bersama kartunya.
  taskList: { gap: tokens.layout.listGap },
});
