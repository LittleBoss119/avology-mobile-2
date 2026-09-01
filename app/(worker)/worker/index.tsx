import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tokens } from '../../../src/constants/theme';
import {
  Card,
  ErrorBanner,
  LoadingState,
  MenuRowGroup,
  Screen,
  SectionHeader,
} from '../../../src/components/ui';
import {
  FarmIdentityBlock,
  StatColumn,
  TreeStatRow,
} from '../../../src/components/farm-overview';
import { Icon, type IconName } from '../../../src/components/icons';
import { useAuth } from '../../../src/context/auth-context';
import { getWorkerDashboardSummary } from '../../../src/services/dashboardService';
import { getTrees } from '../../../src/services/treeService';
import type { Tree, WorkerDashboardSummary } from '../../../src/types/domain';

type TreeConditionCounts = {
  healthyTrees: number;
  problemTrees: number;
  totalTrees: number;
};

export default function WorkerDashboardScreen() {
  const { currentFarm } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [summary, setSummary] = React.useState<WorkerDashboardSummary | null>(null);
  const [treeCounts, setTreeCounts] = React.useState<TreeConditionCounts | null>(null);

  const farmId = currentFarm?.farmId;
  const userId = currentFarm?.userId;

  const loadDashboard = React.useCallback(async () => {
    if (!farmId || !userId) {
      setError('Data pekerja aktif tidak ditemukan.');
      setSummary(null);
      setTreeCounts(null);
      return;
    }

    setError(null);

    // Kondisi kebun dihitung DI KLIEN dari daftar pohon yang sudah dipakai layar
    // Pohon pekerja — getTrees dengan argumen yang sama persis (farmId + non
    // arsip). Tidak ada service, RPC, maupun penghitung agregat baru: pekerja
    // memang sudah berhak membaca daftar ini, dan ringkasan tiga angka tidak
    // pantas menambah satu jalur data sendiri.
    const [summaryResult, treesResult] = await Promise.all([
      getWorkerDashboardSummary({ farmId, userId }),
      getTrees({ archived: false, farmId }),
    ]);

    if (summaryResult.error) {
      setError('Data beranda belum bisa dimuat.');
      setSummary(null);
      setTreeCounts(null);
      return;
    }

    setSummary(summaryResult.data);

    // Gagalnya daftar pohon TIDAK menjatuhkan seluruh Beranda: kartu tugas hari
    // ini tetap berdiri, dan seksi kondisi kebun yang hilang sendirian.
    if (treesResult.error) {
      setError('Kondisi kebun belum bisa dimuat.');
      setTreeCounts(null);
      return;
    }

    setTreeCounts(countTreeConditions(treesResult.data));
  }, [farmId, userId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadDashboard().finally(() => setLoading(false));
    }, [loadDashboard])
  );

  if (loading) {
    return <LoadingState message="Memuat dashboard pekerja..." />;
  }

  const farm = currentFarm?.farm;

  // Tanpa prop `header`: judul layar dibuang karena tab bar di bawah sudah
  // menamai layar ini dan menyalakannya. `applyTopInset` WAJIB ikut — inset
  // atas selama ini datang dari TopAppBar di dalam MainTabHeader (ui.tsx),
  // bukan dari Screen, jadi tanpa prop ini isi layar menempel ke status bar.
  return (
    <Screen applyTopInset>
      {/* Tanpa chip "Ubah data kebun": hanya pemilik yang boleh mengubah data
          kebun, jadi di sini blok identitas murni penanda tempat. */}
      {farm ? <FarmIdentityBlock farm={farm} /> : null}
      <ErrorBanner message={error} />

      {summary === null ? null : (
        <View style={styles.sections}>
          <TaskCard summary={summary} />

          {/* HILANG SELURUHNYA saat daftar pohon gagal dimuat — treeCounts null
              berarti angkanya tidak diketahui, bukan nol, dan kartu berisi tiga
              nol adalah angka bohong. Galatnya sudah dikabarkan ErrorBanner di
              atas. */}
          {treeCounts ? <TreesCard treeCounts={treeCounts} /> : null}

          {/* Jalan masuk ke Kebun setelah ia dicabut dari bottom nav. Tanpa
              label sampingan: WorkerDashboardSummary tidak menghitung anggota,
              dan menambah hitungan berarti menambah request — bukan menata
              navigasi.

              Baris kedua ("Laporan") ikut dibuang bersama modul laporan
              operasional di migrasi 053. */}
          <Card padding={tokens.layout.cardPadding}>
            <MenuRowGroup>
              <NavRow icon="user" title="Anggota" onPress={() => router.push('/worker/farm')} />
            </MenuRowGroup>
          </Card>
        </View>
      )}
    </Screen>
  );
}

function TodayTaskCard({ summary }: { summary: WorkerDashboardSummary }) {
  const aktif = summary.todayTasks > 0;
  const caption =
    summary.todayTasks > 0
      ? 'Ketuk untuk mulai mengerjakan.'
      : summary.unfinishedTasks > 0
        ? `Masih ada ${summary.unfinishedTasks} tugas terbuka dari hari lain.`
        : 'Belum ada tugas yang perlu dikerjakan.';

  return (
    <Pressable onPress={() => router.push('/worker/tasks')}>
      <Card variant={aktif ? 'softGreen' : 'default'} style={styles.taskCard}>
        <View style={styles.cardHeader}>
          <Text selectable style={aktif ? styles.cardTitleActive : styles.cardTitleIdle}>
            Tugas hari ini
          </Text>
          <Icon
            name="chevron-right"
            size={tokens.icon.sm}
            color={aktif ? tokens.color.brand.base : tokens.color.text.tertiary}
          />
        </View>
        <Text selectable style={aktif ? styles.cardNumberActive : styles.cardNumberIdle}>
          {summary.todayTasks}
        </Text>
        <Text selectable style={styles.cardCaption}>
          {caption}
        </Text>
      </Card>
    </Pressable>
  );
}

// Kartu Tugas. SATU angka: unfinishedTasks, berlabel "Belum selesai".
//
// WorkerDashboardSummary punya tiga angka (dashboardService), dan dua di
// antaranya sengaja TIDAK dipakai di sini:
//
//   unfinishedTasks -- TANPA batas tanggal, status pending/postponed. DIPAKAI.
//
//   completedTasks  -- TANPA batas tanggal, status completed. DIBUANG. Ia
//     akumulasi seumur keanggotaan: hanya naik, tidak pernah turun, dan
//     setelah beberapa bulan jadi angka besar yang artinya tidak berubah dari
//     hari ke hari. Angka semacam itu bukan informasi, dan berdampingan dengan
//     angka yang menuntut tindakan ia mengundang salah baca.
//
//   todayTasks      -- due_date = HARI INI, status pending/postponed. DIBUANG,
//     dan BUKAN sebagai pengganti kolom yang hilang: ia HIMPUNAN BAGIAN dari
//     unfinishedTasks (penyaring status dan pengecualiannya sama persis, hanya
//     ditambah batas due_date). Menaruh keduanya berdampingan berarti memajang
//     dua angka yang tumpang tindih, dan orang akan menjumlahkannya.
//
// Judulnya "Tugas", bukan "Tugas hari ini": angkanya memang bukan angka hari
// ini, dan pembaca layar ini akan membaca labelnya apa adanya.
function TaskCard({ summary }: { summary: WorkerDashboardSummary }) {
  return (
    <Pressable onPress={() => router.push('/worker/tasks')}>
      <Card padding={tokens.layout.cardPadding}>
        <View style={styles.cardHeader}>
          <Text selectable style={styles.cardTitle}>
            Tugas
          </Text>
          <Icon name="chevron-right" size={tokens.icon.sm} color={tokens.color.text.tertiary} />
        </View>
        {/* Pembungkus barisnya TETAP ada walau isinya tinggal satu kolom:
            StatColumn ber-`flex: 1` dan butuh induk berarah baris untuk
            memenuhi lebar penuh lalu memusatkan isinya. Dengan begitu angka di
            kartu ini persis seukuran angka di kartu Pohon di bawahnya — sama
            komponennya, sama gayanya, bukan sekadar mirip. */}
        <View style={styles.statRow}>
          {/* Warna hanya menyala saat masih ada yang menunggu dikerjakan; nol
              tetap netral. Labelnya yang membawa pesan, warnanya penegas. */}
          <StatColumn
            color={
              summary.unfinishedTasks > 0 ? tokens.color.brand.base : tokens.color.text.primary
            }
            label="Belum selesai"
            value={summary.unfinishedTasks}
          />
        </View>
      </Card>
    </Pressable>
  );
}

// Kartu Pohon. Bentuknya sama persis dengan kartu Pohon di Beranda pemilik —
// TreeStatRow yang sama, dari berkas yang sama.
//
// Rute dan cabang tampilannya TIDAK diubah: '/worker/trees' membuka Daftar atau
// Denah menurut treeBrowseState, yaitu tampilan yang terakhir dipakai. Sudah
// diputuskan tidak dipaksa ke salah satunya.
function TreesCard({ treeCounts }: { treeCounts: TreeConditionCounts }) {
  // Kebun tanpa pohon: satu kalimat, TANPA tombol dan tanpa bisa diketuk.
  // Pekerja tidak boleh menambah pohon, jadi menawarkan jalan masuk ke sana cuma
  // memberi tugas yang bukan miliknya — dan mengantar ke daftar yang pasti
  // kosong hanya memberi jalan buntu. Yang perlu dia tahu hanya kenapa angkanya
  // tidak ada.
  if (treeCounts.totalTrees === 0) {
    return (
      <Card padding={tokens.layout.cardPadding}>
        <Text selectable style={styles.emptyConditionText}>
          Kebun ini belum punya data pohon.
        </Text>
      </Card>
    );
  }

  return (
    <Pressable onPress={() => router.push('/worker/trees')}>
      <Card padding={tokens.layout.cardPadding}>
        <View style={styles.cardHeader}>
          <Text selectable style={styles.cardTitle}>
            Pohon
          </Text>
          <Icon name="chevron-right" size={tokens.icon.sm} color={tokens.color.text.tertiary} />
        </View>
        <TreeStatRow
          healthyTrees={treeCounts.healthyTrees}
          problemTrees={treeCounts.problemTrees}
          totalTrees={treeCounts.totalTrees}
        />
      </Card>
    </Pressable>
  );
}

function NavRow({ icon, onPress, title }: { icon: IconName; onPress: () => void; title: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.navRow}>
      <Icon name={icon} size={tokens.icon.md} color={tokens.color.brand.base} />
      <Text selectable style={styles.rowTitle}>
        {title}
      </Text>
      <Icon name="chevron-right" size={tokens.icon.sm} color={tokens.color.text.tertiary} />
    </Pressable>
  );
}

// Baris polos dengan divider, tanpa Card — sejajar dengan seksi "Pantauan" di
// Beranda pemilik.
function WorkSummaryList({ summary }: { summary: WorkerDashboardSummary }) {
  const items = [
    { key: 'unfinished', label: 'Belum selesai', value: summary.unfinishedTasks },
    { key: 'completed', label: 'Sudah selesai', value: summary.completedTasks },
  ];

  return (
    <View>
      {items.map((item, index) => (
        <React.Fragment key={item.key}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <View style={styles.row}>
            <Text selectable style={styles.rowLabel}>
              {item.label}
            </Text>
            <Text selectable style={styles.rowValue}>
              {item.value}
            </Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

// Dua ember, sama dengan yang dipakai ringkasan pemilik di server
// (dashboardService.countHealthyTrees / countProblemTrees): sehat = 'healthy',
// perhatian = SELAIN 'healthy'. Disamakan supaya angka yang dilihat pekerja dan
// pemilik untuk kebun yang sama tidak pernah berbeda.
function countTreeConditions(trees: Tree[]): TreeConditionCounts {
  const healthyTrees = trees.filter((tree) => tree.currentCondition === 'healthy').length;

  return {
    healthyTrees,
    problemTrees: trees.length - healthyTrees,
    totalTrees: trees.length,
  };
}

const styles = StyleSheet.create({
  sections: { gap: tokens.layout.sectionGap },
  section: { gap: tokens.space.md },

  taskCard: { gap: 0 },
  // `marginBottom` DICABUT. Ia dulu mengganti jarak yang dimatikan
  // `taskCard: { gap: 0 }` pada kartu lama. Kartu-kartu baru memakai Card
  // apa adanya, yang sudah punya `gap` sendiri — membiarkan marginBottom di
  // sini membuat kartu Beranda pekerja 8px lebih longgar daripada kartu
  // Beranda pemilik yang bentuknya seharusnya sama persis.
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardTitleActive: { ...tokens.type.label, color: tokens.color.brand.base },
  cardTitleIdle: { ...tokens.type.label, color: tokens.color.text.secondary },
  cardNumberActive: { ...tokens.type.display, color: tokens.color.brand.base },
  cardNumberIdle: { ...tokens.type.display, color: tokens.color.text.tertiary },
  cardCaption: { ...tokens.type.bodySmall, color: tokens.color.text.secondary, marginTop: tokens.space.xs },

  // Judul kartu, sama persis dengan Beranda pemilik — kedua Beranda kini satu
  // gaya, jadi tidak ada lagi varian aktif/idle yang membedakan bobotnya.
  cardTitle: { ...tokens.type.label, color: tokens.color.text.secondary },

  // Kolomnya sendiri (statCol/statValue/statLabel) hidup di farm-overview.tsx
  // bersama StatColumn. Yang tinggal di sini hanya PEMBUNGKUS barisnya, karena
  // kartu Tugas memakai dua kolom sedangkan TreeStatRow memakai tiga — dan
  // nilainya sengaja identik dengan statRow di sana supaya kedua kartu di layar
  // yang sama punya jarak antarkolom yang sama.
  statRow: { flexDirection: 'row', gap: tokens.space.md },

  // Baris navigasi di dalam kartu. minHeight mengikuti controlHeight seperti
  // MenuRow di ui.tsx dan NavRow di Beranda pemilik.
  navRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.space.md,
    minHeight: tokens.layout.controlHeight,
  },

  destinations: { gap: 0 },
  divider: {
    backgroundColor: tokens.color.line.hairline,
    height: StyleSheet.hairlineWidth,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.space.md,
    justifyContent: 'space-between',
    minHeight: tokens.layout.rowMinHeight,
    paddingVertical: tokens.space.md,
  },
  // Rata tengah: keadaan kosong salah satu dari empat hal yang boleh rata
  // tengah menurut aturan desain yang berlaku.
  emptyConditionText: {
    ...tokens.type.body,
    color: tokens.color.text.secondary,
    textAlign: 'center',
  },
  rowLabel: { ...tokens.type.body, color: tokens.color.text.secondary },
  rowTitle: { ...tokens.type.body, color: tokens.color.text.primary, flex: 1 },
  rowValue: { ...tokens.type.bodyStrong, color: tokens.color.text.primary },
});
