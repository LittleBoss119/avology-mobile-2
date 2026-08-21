import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tokens } from '../../../src/constants/theme';
import {
  Card,
  ErrorBanner,
  LoadingState,
  MainTabHeader,
  Screen,
  SectionHeader,
} from '../../../src/components/ui';
import { FarmIdentityBlock, TreeConditionSummary } from '../../../src/components/farm-overview';
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

  return (
    <Screen header={<MainTabHeader title="Beranda" />}>
      {/* Tanpa chip "Ubah data kebun": hanya pemilik yang boleh mengubah data
          kebun, jadi di sini blok identitas murni penanda tempat. */}
      {farm ? <FarmIdentityBlock farm={farm} /> : null}
      <ErrorBanner message={error} />

      {summary === null ? null : (
        <View style={styles.sections}>
          <TodayTaskCard summary={summary} />

          <View style={styles.section}>
            <SectionHeader title="Ringkasan kerja" />
            <WorkSummaryList summary={summary} />
          </View>

          {/* Sengaja TANPA surface dan dengan angka lebih kecil daripada versi
              pemilik. Pekerja datang ke layar ini untuk tahu apa yang harus
              dikerjakan hari ini; kondisi kebun adalah latar, bukan tugasnya.
              Kalau blok ini ikut jadi kartu putih, ia bersaing dengan "Tugas
              hari ini" dan keduanya sama-sama kehilangan bobot. */}
          {treeCounts ? (
            <View style={styles.section}>
              <SectionHeader title="Kondisi kebun" />
              {/* Kebun tanpa pohon: satu baris teks, tanpa tombol. Pekerja tidak
                  boleh menambah pohon, jadi menawarkan jalan masuk ke sana cuma
                  memberi tugas yang bukan miliknya. Yang perlu dia tahu hanya
                  kenapa angkanya tidak ada. */}
              {treeCounts.totalTrees === 0 ? (
                <Text selectable style={styles.emptyConditionText}>
                  Kebun ini belum punya data pohon.
                </Text>
              ) : (
                <TreeConditionSummary
                  healthyTrees={treeCounts.healthyTrees}
                  problemTrees={treeCounts.problemTrees}
                  size="sm"
                  totalTrees={treeCounts.totalTrees}
                />
              )}
            </View>
          ) : null}

          {/* Jalan masuk ke Kebun dan Laporan setelah keduanya dicabut dari
              bottom nav. Tanpa angka di kedua baris: WorkerDashboardSummary
              tidak menghitung anggota maupun laporan, dan menambah hitungan
              berarti menambah request — bukan menata navigasi. */}
          <View style={styles.destinations}>
            <View style={styles.divider} />
            <NavRow icon="user" title="Anggota kebun" onPress={() => router.push('/worker/farm')} />
            <View style={styles.divider} />
            <NavRow icon="file-text" title="Laporan" onPress={() => router.push('/worker/reports')} />
          </View>
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

function NavRow({ icon, onPress, title }: { icon: IconName; onPress: () => void; title: string }) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Icon name={icon} size={tokens.icon.md} color={tokens.color.text.tertiary} />
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
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: tokens.space.sm,
  },
  cardTitleActive: { ...tokens.type.label, color: tokens.color.brand.base },
  cardTitleIdle: { ...tokens.type.label, color: tokens.color.text.secondary },
  cardNumberActive: { ...tokens.type.display, color: tokens.color.brand.base },
  cardNumberIdle: { ...tokens.type.display, color: tokens.color.text.tertiary },
  cardCaption: { ...tokens.type.bodySmall, color: tokens.color.text.secondary, marginTop: tokens.space.xs },

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
  emptyConditionText: { ...tokens.type.body, color: tokens.color.text.secondary },
  rowLabel: { ...tokens.type.body, color: tokens.color.text.secondary },
  rowTitle: { ...tokens.type.body, color: tokens.color.text.primary, flex: 1 },
  rowValue: { ...tokens.type.bodyStrong, color: tokens.color.text.primary },
});
