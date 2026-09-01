import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { tokens } from '../constants/theme';
import { useAuth } from '../context/auth-context';
import { getFloweringAndFruitingTrees } from '../services/growthPhaseService';
import type { FloweringMonitoringTree, GrowthPhase } from '../types/domain';
import { daysSinceLocal } from '../utils/dateDiff';
import { formatGrowthPhase, formatTreeLocation } from '../utils/treeFormat';
// FloweringAgeMarker TIDAK LAGI DIPAKAI DI SINI. Umur fase kini dibawa
// GrowthPhaseBadge — komponen yang sama yang dipakai layar detail pohon —
// sehingga kedua layar menghasilkan bentuk teks yang sama persis
// ('Berbunga · 96 hari') dari kolom yang sama. Komponennya tetap ada di repo.
import { GrowthPhaseBadge } from './tree-components';
import { Button, Card, EmptyState, ErrorBanner, LoadingState, MetaRow, Screen, TopAppBar } from './ui';

export function OwnerGrowthMonitoringScreen() {
  const { currentFarm } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [trees, setTrees] = React.useState<FloweringMonitoringTree[]>([]);

  const farmId = currentFarm?.farmId;

  const loadTrees = React.useCallback(async () => {
    if (!farmId) {
      setError('Kebun aktif tidak ditemukan.');
      setTrees([]);
      return;
    }

    setError(null);

    const result = await getFloweringAndFruitingTrees({ farmId });

    if (result.error) {
      setError(result.error.message);
      setTrees([]);
      return;
    }

    setTrees(result.data);
  }, [farmId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadTrees().finally(() => setLoading(false));
    }, [loadTrees])
  );

  if (loading) {
    return (
      <LoadingState
        header={<TopAppBar title="Monitoring Fase" onBack={() => router.back()} />}
        message="Memuat monitoring fase..."
      />
    );
  }

  const floweringTrees = trees.filter((tree) => tree.currentGrowthPhase === 'flowering');
  const fruitingTrees = trees.filter((tree) => tree.currentGrowthPhase === 'fruiting');

  return (
    /* Judulnya ADA, dan itu bukan pengecualian terhadap aturan "layar detail
       tanpa judul": ini layar DAFTAR yang dicapai dari Beranda, bukan detail
       satu benda yang namanya sudah tercetak besar di badan layar.

       PageIntro dicabut karena judulnya kini di TopAppBar. Sebelumnya keduanya
       berdiri bersama header navigator, sehingga "Monitoring Fase" tercetak DUA
       KALI di layar yang sama. applyTopInset ikut pergi: TopAppBar menerapkan
       safe-area atas sendiri, dan membiarkan keduanya berarti inset ganda. */
    <Screen
      header={
        <TopAppBar
          title="Monitoring Fase"
          subtitle="Pantau pohon yang sedang berbunga dan berbuah berdasarkan fase terbaru."
          onBack={() => router.back()}
        />
      }
    >
      <ErrorBanner message={error} />

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <SummaryCard count={floweringTrees.length} label="Pohon Berbunga" />
        </View>
        <View style={{ flex: 1 }}>
          <SummaryCard count={fruitingTrees.length} label="Pohon Berbuah" />
        </View>
      </View>

      <TreePhaseSection
        emptySubtitle="Pohon dengan fase Berbunga akan muncul di sini setelah dicatat dari detail pohon."
        emptyTitle="Belum ada pohon berbunga"
        phase="flowering"
        title="Pohon Berbunga"
        trees={floweringTrees}
      />

      <TreePhaseSection
        emptySubtitle="Pohon dengan fase Berbuah akan muncul di sini setelah dicatat dari detail pohon."
        emptyTitle="Belum ada pohon berbuah"
        phase="fruiting"
        title="Pohon Berbuah"
        trees={fruitingTrees}
      />
    </Screen>
  );
}

// Empat hex mentah di berkas ini dipetakan ke token TEKS, dan pemetaannya
// ditentukan PERANNYA, bukan kemiripan angkanya:
//
//   '#68746D' -> tokens.color.text.secondary ('#5B6B60')  label di atas angka
//   '#1E2A24' -> tokens.color.text.primary   ('#17231B')  angka, judul, kode
//
// TIDAK SATU PUN cocok persis, dan itu disebut terus terang di laporan yang
// menyertai perubahan ini. Keduanya nilai peninggalan dari sebelum lapisan token
// ada — selisihnya di bawah 14/255 per kanal, tidak terlihat pada teks — dan
// sistem tokennya hanya punya tiga peran teks (primary, secondary, tertiary)
// sehingga perannya tidak ambigu. Tidak ada token baru yang dikarang.
//
// Hanya WARNA yang berpindah; fontSize dan fontWeight dibiarkan apa adanya.
function SummaryCard({ count, label }: { count: number; label: string }) {
  return (
    <Card>
      <Text selectable style={{ color: tokens.color.text.secondary, fontSize: 13, fontWeight: '600' }}>
        {label}
      </Text>
      <Text
        selectable
        style={{
          color: tokens.color.text.primary,
          fontSize: 30,
          fontVariant: ['tabular-nums'],
          fontWeight: '700',
        }}
      >
        {count}
      </Text>
    </Card>
  );
}

function TreePhaseSection({
  emptySubtitle,
  emptyTitle,
  phase,
  title,
  trees,
}: {
  emptySubtitle: string;
  emptyTitle: string;
  phase: GrowthPhase;
  title: string;
  trees: FloweringMonitoringTree[];
}) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'space-between' }}>
        <Text selectable style={{ color: tokens.color.text.primary, flex: 1, fontSize: 20, fontWeight: '700' }}>
          {title}
        </Text>
        <GrowthPhaseBadge phase={phase} />
      </View>

      {trees.length === 0 ? (
        <EmptyState title={emptyTitle} subtitle={emptySubtitle} />
      ) : (
        <View style={{ gap: 12 }}>
          {trees.map((tree) => (
            <MonitoringTreeCard key={tree.id} tree={tree} />
          ))}
        </View>
      )}
    </View>
  );
}

function MonitoringTreeCard({ tree }: { tree: FloweringMonitoringTree }) {
  // Perhitungan yang SAMA PERSIS dengan layar detail pohon: satu pengurangan
  // dari kolom turunan, bukan pencarian di daftar riwayat. Penyaringan siklus
  // sudah selesai di database (migrasi 064 dan 066), jadi tidak ada aturan
  // siklus yang hidup di sisi klien — di layar ini maupun di sana.
  //
  // Penjaganya `tree.currentGrowthPhaseSince ? ... : null`, dan pasangannya di
  // GrowthPhaseBadge memakai `typeof ageDays === 'number'`. Itu yang membuat
  // "0 hari" tetap tampil untuk fase yang dicatat HARI INI: nol adalah angka
  // yang benar, sedangkan tanggal yang tidak diketahui menghasilkan null dan
  // chip-nya jatuh ke nama fase saja.
  //
  // NON-PREDIKTIF: angkanya menyatakan sudah berapa lama fase berjalan, tidak
  // pernah kapan buahnya siap dipetik (keputusan desain v4).
  const phaseAgeDays = tree.currentGrowthPhaseSince
    ? daysSinceLocal(tree.currentGrowthPhaseSince)
    : null;

  return (
    <Card>
      {/* Hanya WARNANYA yang pindah ke token; fontSize dan fontWeight dibiarkan
          apa adanya. Menyeragamkan tipografinya sekaligus akan mengubah bentuk
          kartu ini, dan itu di luar yang diminta. */}
      <Text selectable style={{ color: tokens.color.text.primary, fontSize: 18, fontWeight: '700' }}>
        {tree.treeCode}
      </Text>
      <MetaRow label="Lokasi" value={formatTreeLocation(tree)} />
      {tree.activePlanting?.variety ? (
        <MetaRow label="Varietas" value={tree.activePlanting.variety} />
      ) : null}
      {/* Chip menggantikan baris "Fase saat ini" DAN pita FloweringAgeMarker
          sekaligus. Keduanya dulu berdiri berdampingan mengatakan hal yang
          bersinggungan — satu menyebut nama fasenya, satu lagi menyebut umurnya,
          dan yang kedua bahkan menghitung dari fase yang berbeda. Chip membawa
          keduanya dalam satu baris, dengan bentuk yang sama seperti di layar
          detail pohon. */}
      {tree.currentGrowthPhase ? (
        <View style={{ flexDirection: 'row' }}>
          <GrowthPhaseBadge ageDays={phaseAgeDays} phase={tree.currentGrowthPhase} />
        </View>
      ) : null}
      <Button title="Buka Detail" variant="secondary" onPress={() => router.push(`/owner/trees/${tree.id}`)} />
    </Card>
  );
}
