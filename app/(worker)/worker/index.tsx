import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '../../../src/constants/theme';
import { formatCareTarget } from '../../../src/components/care-schedule-components';
import {
  Button,
  Card,
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
import { formatCareCategory, formatPersonDisplayName } from '../../../src/utils/displayFormat';
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

              <View style={styles.taskList}>
                {todayTasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </View>
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

// Kartu tugas dengan SATU tombol: "Catat hasil".
//
// Konsekuensinya hanya 2-3 kartu yang muat per layar, dan itu memang harganya:
// tanpa tombol ini, mencatat satu hasil kerja menuntut buka detail, gulung ke
// bawah, tekan tombol — tiga langkah untuk pekerjaan yang paling sering
// dilakukan di aplikasi ini. Jangan dipadatkan.
//
// TOMBOL "LIHAT DETAIL" DICABUT (batch 4a), dan penggantinya bukan tombol lain
// melainkan INSTRUKSINYA SENDIRI, dicetak di kartu.
//
// Alasannya: satu-satunya hal di layar detail yang benar-benar dibutuhkan
// sebelum mengerjakan adalah instruksi dari pemilik. Menyembunyikannya di balik
// tombol kedua berarti menukar satu baris teks dengan satu perjalanan layar —
// dan menaruh dua tombol berdampingan memaksa orang menimbang mana yang benar
// tiap kali, di layar yang seharusnya tidak menuntut pertimbangan apa pun.
//
// Informasi ditaruh di tempat aksinya. Detail tugas tetap terjangkau lewat tab
// Tugas, yang barisnya memang mengantar ke sana.
function TaskCard({ task }: { task: CareTask }) {
  // Kategori, bukan judul yang diketik pemilik — alasan yang sama dengan baris
  // di layar Tugas: judul bebas berbunyi "Test" atau "awas", sedangkan
  // "Penyemprotan" memberi tahu apa yang harus dibawa. 'Tugas perawatan' adalah
  // teks jatuh-balik yang sudah dipakai di sana, dipertahankan apa adanya.
  const title = task.category ? formatCareCategory(task.category) : 'Tugas perawatan';
  const instruction = task.instruction?.trim();

  return (
    <Card padding={tokens.layout.cardPadding}>
      <View style={styles.taskHead}>
        <Text selectable style={styles.taskTitle}>
          {title}
        </Text>
        {/* Target saja. Tanggalnya tidak ditulis: seluruh daftar ini hari ini,
            dan angka 80 di atasnya sudah menyatakannya. */}
        <Text selectable style={styles.taskMeta}>
          {formatCareTarget(task)}
        </Text>
      </View>

      {/* Instruksi pemilik, DI KARTU. Dibatasi tiga baris: instruksi yang
          lebih panjang dari itu bukan lagi "apa yang harus dikerjakan"
          melainkan catatan, dan kartu yang tumbuh sesuai panjang ketikan
          pemilik akan mendorong tugas kedua keluar layar.

          Tidak dirender sama sekali kalau kosong — bukan dirender sebagai
          baris kosong yang menyisakan tingginya. Kolom care_tasks.instruction
          memang nullable, dan sebagian besar tugas berulang tidak mengisinya. */}
      {instruction ? (
        <Text selectable numberOfLines={3} style={styles.taskInstruction}>
          {instruction}
        </Text>
      ) : null}

      <Button
        title="Catat hasil"
        onPress={() => router.push(`/worker/tasks/${task.id}/record?mode=create`)}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  // Serif 80, satu tingkat di atas angka 72 Beranda pemilik. Pemilik membaca
  // layarnya sambil duduk; pekerja membacanya sambil berdiri di kebun, sering
  // dengan matahari di layar.
  bigNumber: { ...typeScale.stat80, color: palette.textPrimary },
  bigNumberCaption: { ...typeScale.meta, color: palette.textMuted },

  // listGap, bukan sectionGap: kartu-kartu ini satu daftar, bukan beberapa
  // seksi yang berdiri sendiri.
  taskList: { gap: tokens.layout.listGap },
  taskHead: { gap: tokens.space.xs },
  taskTitle: { ...tokens.type.subheading, color: palette.textPrimary },
  taskMeta: { ...tokens.type.bodySmall, color: palette.textMuted },
  // textPrimary, bukan textMuted seperti baris target di atasnya. Instruksi
  // adalah hal yang harus DIKERJAKAN; target hanya menyebutkan di mana.
  // Meredupkannya bersama meta akan menaruh satu-satunya kalimat yang berisi
  // perintah di lapisan yang sama dengan keterangan.
  taskInstruction: { ...tokens.type.body, color: palette.textPrimary },
});
