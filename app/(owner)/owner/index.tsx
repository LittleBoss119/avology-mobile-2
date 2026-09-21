import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '../../../src/constants/theme';
import {
  ErrorBanner,
  LoadingState,
  MenuRow,
  MenuRowGroup,
  RootTabTitle,
  Screen,
  SectionLabel,
  type StatusMarkerShape,
} from '../../../src/components/ui';
import { StatColumn } from '../../../src/components/farm-overview';
import { Icon } from '../../../src/components/icons';
import { useAuth } from '../../../src/context/auth-context';
import { getOwnerDashboardSummary } from '../../../src/services/dashboardService';
import { colors as palette, text as typeScale } from '../../../src/theme/tokens';
import type { OwnerDashboardSummary } from '../../../src/types/domain';
import { formatPersonDisplayName } from '../../../src/utils/displayFormat';
import { formatFullDate, getTodayIsoDate } from '../../../src/utils/taskDueDate';

// Baris masalah: satu hal yang butuh keputusan pemilik, satu angka, satu tujuan.
//
// `value` WAJIB ikut ke dalam tipe ini, bukan dibaca ulang dari summary di
// tempat render. Itulah yang membuat aturan angka besar bisa ditegakkan di satu
// tempat: daftar ini dibangun sekali, angka serif 72 dijumlahkan DARI daftar
// yang sama, lalu daftar yang sama itu yang dirender. Tidak ada jalan untuk
// menambah baris tanpa angkanya ikut terjumlah, dan tidak ada jalan untuk
// menjumlahkan sesuatu yang tidak muncul sebagai baris.
type ProblemRow = {
  key: string;
  label: string;
  markerColor: string;
  markerShape: StatusMarkerShape;
  route: string;
  value: number;
};

export default function OwnerDashboardScreen() {
  const { currentFarm, profile } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [summary, setSummary] = React.useState<OwnerDashboardSummary | null>(null);

  const farmId = currentFarm?.farmId;

  const loadDashboard = React.useCallback(async () => {
    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setSummary(null);
      return;
    }

    setError(null);

    // SATU pengambilan, turun dari dua. getRecentFarmCareActivities ikut
    // dicabut bersama kartu "Terakhir dikerjakan": kartu itu tidak ada di
    // susunan Beranda yang baru, dan membiarkan permintaannya berjalan untuk
    // data yang tidak dirender berarti membayar ongkos muat tanpa hasil.
    // Layar ini menargetkan muat di bawah 3 detik.
    const result = await getOwnerDashboardSummary({ farmId });

    if (result.error) {
      setError('Data beranda belum bisa dimuat.');
      setSummary(null);
      return;
    }

    setSummary(result.data);
  }, [farmId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadDashboard().finally(() => setLoading(false));
    }, [loadDashboard])
  );

  if (loading) {
    return <LoadingState message="Memuat dashboard pemilik..." />;
  }

  const greeting = `Halo, ${formatPersonDisplayName(profile?.fullName, 'Pemilik')}`;
  const today = formatFullDate(getTodayIsoDate());

  return (
    <Screen applyTopInset>
      {/* Judul layar root tab, 26 rata kiri — penundaan dari batch 1b yang
          dipasang di sini.

          Judulnya SAPAAN, bukan kata "Beranda". Dua baris teratas yang berbunyi
          "Beranda" lalu "Halo, Abah" adalah satu baris yang menamai tab yang
          ikonnya sudah menyala di bawah, ditimpa satu baris lagi yang
          benar-benar menyapa. Susunan layar ini menaruh sapaan di urutan
          pertama, dan sapaan itulah heading halamannya.

          Blok identitas kebun yang dulu berdiri di sini DICABUT. Nama kebun
          tidak berubah dari hari ke hari, sedangkan seluruh sisa layar ini
          berubah tiap pagi — tempat paling atas layar tidak pantas ditempati
          hal yang tidak pernah berubah. Namanya tetap terbaca di tab Profil
          (baris "Kebun") dan di layar Data kebun. */}
      <RootTabTitle title={greeting} meta={today} />

      <ErrorBanner message={error} />

      {summary === null ? null : <DashboardBody summary={summary} />}
    </Screen>
  );
}

function DashboardBody({ summary }: { summary: OwnerDashboardSummary }) {
  const problems = buildProblemRows(summary);

  return (
    <>
      {problems.length === 0 ? <CalmBlock summary={summary} /> : <ProblemBlock rows={problems} />}

      {/* HILANG saat kebun belum punya pohon: layar tujuannya pasti kosong, dan
          dua baris nol tidak mengabarkan apa-apa. */}
      {summary.totalTrees === 0 ? null : <PhaseBlock summary={summary} />}

      <TaskBlock summary={summary} />
    </>
  );
}

// Angka serif 72 + daftar masalah.
//
// ATURAN YANG MENGIKAT: angkanya dijumlahkan dari `rows`, array yang sama yang
// dirender persis di bawahnya. Bukan dari summary, bukan dari penghitung kedua.
// Pemilik harus bisa menjumlahkan baris-baris di bawah angka itu dengan jarinya
// dan sampai di angka yang sama, tanpa berpikir — dan satu-satunya cara
// menjamin itu adalah tidak punya dua sumber untuk dijumlahkan.
//
// Baris bernilai nol tidak pernah masuk ke `rows` (lihat buildProblemRows),
// jadi ia tidak dirender DAN tidak ikut terjumlah. "0 tugas terlambat" tidak pernah
// muncul di layar ini.
function ProblemBlock({ rows }: { rows: ProblemRow[] }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <View style={styles.block}>
      {/* RATA KIRI, bukan rata tengah. Aturan desain memang mengizinkan blok
          angka statistik rata tengah, tapi angka ini bukan statistik yang
          berdiri sendiri — ia judul daftar tepat di bawahnya. Satu tepi baca
          yang sama antara angka dan daftar itulah yang membuat keduanya bisa
          dicocokkan sekali lihat. */}
      <View>
        <Text accessibilityRole="header" selectable style={styles.bigNumber}>
          {total}
        </Text>
        {/* Angka telanjang tidak mengatakan apa-apa. Baris ini yang menyebutkan
            satuannya, dan ia sengaja di BAWAH angka: yang dilihat duluan
            angkanya, keterangannya menyusul. */}
        <Text selectable style={styles.bigNumberCaption}>
          perlu perhatian
        </Text>
      </View>

      <MenuRowGroup>
        {rows.map((row) => (
          <MenuRow
            key={row.key}
            label={row.label}
            marker={{ color: row.markerColor, shape: row.markerShape }}
            onPress={() => router.push(row.route)}
            trailing={<RowCount value={row.value} />}
          />
        ))}
      </MenuRowGroup>
    </View>
  );
}

// Keadaan beres. Angka 72 DIGANTI judul serif — bukan angka 0 yang dipajang
// sebesar itu, dan bukan daftar masalah yang dirender kosong. Seluruh blok
// masalah tidak ada di pohon render sama sekali.
function CalmBlock({ summary }: { summary: OwnerDashboardSummary }) {
  return (
    <View style={styles.calm}>
      <Text accessibilityRole="header" selectable style={styles.calmTitle}>
        Kebun aman hari ini
      </Text>
      {/* Kalimatnya bercabang pada KEBUN TANPA POHON, dan cabang itu wajib.
          "Tidak ada yang perlu ditangani" memang benar untuk kebun yang belum
          punya satu pohon pun — tapi ia benar karena tidak ada apa pun untuk
          ditangani, bukan karena semuanya beres, dan pemilik yang baru membuat
          kebunnya akan membaca yang kedua. Kalimatnya dipertahankan persis dari
          kartu kebun-kosong yang dilepas di batch ini. */}
      <Text selectable style={styles.calmBody}>
        {summary.totalTrees === 0
          ? 'Belum ada pohon yang dicatat di kebun ini.'
          : 'Tidak ada pohon yang perlu dicek, tugas yang terlambat, atau pengajuan yang menunggu.'}
      </Text>
    </View>
  );
}

// Dua baris fase, BUKAN bar lima segmen.
//
// Spek meminta sebaran lima fase; dashboardService hanya menghitung dua —
// countTreesByGrowthPhase dipanggil untuk 'flowering' dan 'fruiting' saja.
// Tiga fase sisanya berarti tiga query baru, dan itu dilarang di batch ini.
// Yang ditampilkan di sini persis yang diketahui, tidak lebih.
//
// Penandanya BENTUK berwarna netral, bukan warna status: fase bukan masalah,
// dan aturan warna yang mengikat menyimpan warna untuk hal yang bermasalah.
// Yang membedakan berbunga dari berbuah adalah lingkaran versus kotak — dan itu
// tetap terbaca oleh mata yang tidak membedakan rona sama sekali.
function PhaseBlock({ summary }: { summary: OwnerDashboardSummary }) {
  return (
    <View style={styles.block}>
      <SectionLabel title="Fase" />
      <MenuRowGroup>
        <MenuRow
          label="Pohon berbunga"
          marker={{ color: palette.neutralCell, shape: 'circle-outline' }}
          onPress={() => router.push('/owner/growth-monitoring')}
          trailing={<RowCount value={summary.floweringTrees} />}
        />
        <MenuRow
          label="Pohon berbuah"
          marker={{ color: palette.neutralCell, shape: 'square' }}
          onPress={() => router.push('/owner/growth-monitoring')}
          trailing={<RowCount value={summary.fruitingTrees} />}
        />
      </MenuRowGroup>
    </View>
  );
}

// Tiga angka tugas yang SUDAH ADA di OwnerDashboardSummary: overdueTasks,
// todayTasks, unfinishedTasks.
//
// Spek meminta agregat "minggu ini" — tugas selesai minggu ini, panen minggu
// ini. Tidak satu pun dari keduanya dihitung di mana pun, dan keduanya menuntut
// query berjendela tanggal yang belum ada. Ketiga angka ini menggantikannya.
//
// TIDAK BISA DITEKAN, dan itu disengaja. "Terlambat" sudah punya jalan masuknya
// sendiri sebagai baris masalah di atas; dua angka sisanya tidak punya tujuan
// yang jelas — /owner/tasks dan /owner/schedules sama-sama masuk akal dan
// menyaring hal yang berbeda dari "hari ini". Tanpa chevron dan tanpa
// Pressable, perbedaannya terlihat tanpa harus dicoba.
function TaskBlock({ summary }: { summary: OwnerDashboardSummary }) {
  return (
    <View style={styles.block}>
      <SectionLabel title="Tugas" />
      <View style={styles.statRow}>
        {/* Warna hanya menyala saat ada isinya; nol tetap netral. */}
        <StatColumn
          color={
            summary.overdueTasks > 0 ? tokens.color.status.danger.text : tokens.color.text.primary
          }
          label="Terlambat"
          value={summary.overdueTasks}
        />
        <StatColumn color={tokens.color.text.primary} label="Hari ini" value={summary.todayTasks} />
        <StatColumn
          color={tokens.color.text.primary}
          label="Belum selesai"
          value={summary.unfinishedTasks}
        />
      </View>
    </View>
  );
}

// Angka + chevron di slot `trailing` MenuRow.
//
// MenuRow menjatuhkan chevronnya sendiri begitu `trailing` diisi — aturannya
// sendiri, dan benar: keduanya berebut tempat yang sama. Tapi baris ini
// BENAR-BENAR membuka layar lain, dan angka tanpa chevron mengajarkan bahwa
// baris di sini tidak bisa ditekan. Keduanya dirender bersama di dalam satu
// slot, jadi janji dan angkanya berjalan beriringan.
function RowCount({ value }: { value: number }) {
  return (
    <View style={styles.rowCount}>
      <Text selectable style={styles.rowCountValue}>
        {value}
      </Text>
      <Icon name="chevron-right" size={tokens.icon.md} color={palette.textMuted} />
    </View>
  );
}

// Tiga sumber masalah, semuanya sudah ada di OwnerDashboardSummary — tidak satu
// pun query ditambahkan untuk membangun daftar ini.
//
// Baris bernilai nol tidak masuk. Itu bukan penyaringan tampilan melainkan
// aturan isi: pemilik membuka Beranda untuk tahu apa yang harus dikerjakan, dan
// "0 tugas terlambat" adalah kabar bahwa tidak ada kabar — yang menempati baris
// sebesar pekerjaan sungguhan.
//
// Urutannya TETAP, tidak diurut menurut besarnya angka: pohon dulu (ia bisa
// mati kalau didiamkan), tugas kedua, orang terakhir. Daftar yang berubah
// urutan tiap hari harus dibaca ulang dari awal tiap hari.
function buildProblemRows(summary: OwnerDashboardSummary): ProblemRow[] {
  const rows: ProblemRow[] = [];

  if (summary.problemTrees > 0) {
    rows.push({
      key: 'problem-trees',
      label: 'Pohon perlu dicek',
      markerColor: palette.statusPerhatian,
      markerShape: 'triangle-up',
      route: '/owner/trees',
      value: summary.problemTrees,
    });
  }

  if (summary.overdueTasks > 0) {
    rows.push({
      key: 'overdue-tasks',
      label: 'Tugas terlambat',
      markerColor: palette.statusBuruk,
      markerShape: 'triangle-up',
      route: '/owner/schedules',
      value: summary.overdueTasks,
    });
  }

  // Tujuannya /owner/farm, layar Anggota — tempat pengajuan disetujui atau
  // ditolak. Baris "Anggota" yang mengantar ke sana pindah ke tab Profil di
  // batch ini; baris masalah ini sengaja menuju layarnya LANGSUNG, bukan ke
  // tab Profil, karena ia muncul justru saat ada keputusan yang menunggu.
  if (summary.pendingWorkers > 0) {
    rows.push({
      key: 'pending-workers',
      label: 'Pengajuan bergabung',
      markerColor: palette.statusPerhatian,
      markerShape: 'circle-filled',
      route: '/owner/farm',
      value: summary.pendingWorkers,
    });
  }

  return rows;
}

const styles = StyleSheet.create({
  // Jarak antarblok datang dari `gap: sectionGap` milik <Screen>; yang di sini
  // hanya jarak di DALAM satu blok, antara labelnya dan isinya.
  block: { gap: tokens.space.sm },

  // Serif 72. Ia satu-satunya angka sebesar ini di seluruh aplikasi, dan itu
  // memang tugasnya: dari jarak lengan, inilah satu hal yang terbaca lebih dulu
  // daripada apa pun di layar.
  bigNumber: { ...typeScale.stat72, color: palette.textPrimary },
  bigNumberCaption: { ...typeScale.meta, color: palette.textMuted },

  // Keadaan beres. Judul SERIF, sama keluarga huruf dengan angka yang
  // digantikannya — ia menempati tempat yang sama dan memikul peran yang sama.
  calm: { gap: tokens.space.sm },
  calmTitle: { ...typeScale.stat36, color: palette.textPrimary },
  calmBody: { ...typeScale.body, color: palette.textMuted },

  rowCount: { alignItems: 'center', flexDirection: 'row', gap: tokens.space.sm },
  rowCountValue: { ...tokens.type.subheading, color: palette.textPrimary },

  // Nilainya sengaja identik dengan statRow di farm-overview.tsx: StatColumn
  // yang dipakai di sini berasal dari sana, dan jarak antarkolom yang berbeda
  // akan membuat blok yang sama tampil beda lebar di dua layar.
  statRow: { flexDirection: 'row', gap: tokens.space.md },
});
