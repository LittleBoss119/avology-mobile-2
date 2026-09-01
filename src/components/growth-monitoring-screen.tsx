import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
import { GrowthPhaseBadge, TreeCard } from './tree-components';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  MetaRow,
  Screen,
  SegmentedControl,
  TopAppBar,
} from './ui';

// Dua fase yang dipantau layar ini. SENGAJA bukan GrowthPhase penuh: enum itu
// punya nilai lain (vegetatif, panen, ...) yang tidak pernah jadi segmen di
// sini, dan menyempitkan tipenya membuat penyempitan itu dijaga compiler alih-
// alih dijaga kedisiplinan pemanggil.
type PhaseSegment = 'flowering' | 'fruiting';

export function OwnerGrowthMonitoringScreen() {
  const { currentFarm } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [trees, setTrees] = React.useState<FloweringMonitoringTree[]>([]);
  // SELALU 'flowering' saat dibuka, berapa pun isinya. Perilaku yang bisa
  // ditebak menang atas perilaku yang pintar: segmen yang berpindah sendiri
  // menurut data membuat pemilik yang membuka layar ini dua hari berturut-turut
  // mendapati dirinya di tempat yang berbeda tanpa menyentuh apa pun. Jumlah di
  // label kedua segmen sudah mengabarkan ada apa di seberang tanpa perlu pindah.
  const [phase, setPhase] = React.useState<PhaseSegment>('flowering');

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
        header={<TopAppBar title="Fase pohon" onBack={() => router.back()} />}
        message="Memuat fase pohon..."
      />
    );
  }

  const floweringTrees = sortByPhaseAge(trees.filter((tree) => tree.currentGrowthPhase === 'flowering'));
  const fruitingTrees = sortByPhaseAge(trees.filter((tree) => tree.currentGrowthPhase === 'fruiting'));
  const displayedTrees = phase === 'flowering' ? floweringTrees : fruitingTrees;

  return (
    /* Judulnya ADA, dan itu bukan pengecualian terhadap aturan "layar detail
       tanpa judul": ini layar DAFTAR yang dicapai dari Beranda, bukan detail
       satu benda yang namanya sudah tercetak besar di badan layar.

       "Fase pohon", sama persis dengan label baris di Beranda yang mengantar ke
       sini. Judul yang berbeda dari pintu masuknya membuat orang bertanya-tanya
       apakah ia sampai di tempat yang benar.

       Subjudul dicabut: segmented tepat di bawahnya sudah mengatakan hal yang
       sama — dua fase, dengan jumlahnya — dalam bentuk yang bisa ditekan. */
    <Screen header={<TopAppBar title="Fase pohon" onBack={() => router.back()} />}>
      <ErrorBanner message={error} />

      {/* Jumlahnya masuk KE DALAM label, bukan jadi dua kartu angka terpisah di
          atas. Dua kartu itu memakan tinggi satu layar penuh untuk mengatakan
          dua angka, lalu daftar di bawahnya tetap harus digulung jauh untuk
          sampai ke fase kedua. Di sini satu pandangan menjawab dua-duanya, dan
          berpindah fase satu ketukan. */}
      <SegmentedControl
        onChange={(key) => setPhase(key === 'fruiting' ? 'fruiting' : 'flowering')}
        options={[
          { key: 'flowering', label: `Berbunga ${floweringTrees.length}` },
          { key: 'fruiting', label: `Berbuah ${fruitingTrees.length}` },
        ]}
        value={phase}
      />

      {/* Segmen yang TIDAK terpilih tidak dirender sama sekali — bukan
          disembunyikan, bukan digulung lewat. */}
      {displayedTrees.length === 0 ? (
        <Text selectable style={styles.emptyText}>
          {phase === 'flowering' ? 'Belum ada pohon berbunga.' : 'Belum ada pohon berbuah.'}
        </Text>
      ) : (
        // Satu kolom dengan garis rambut antar baris, sama seperti daftar Pohon.
        // Baris terakhir tidak diberi garis supaya daftarnya tidak menggantung.
        <View>
          {displayedTrees.map((tree, index) => {
            const phaseAgeText = buildPhaseAgeText(tree);

            return (
              <React.Fragment key={tree.id}>
                {index > 0 ? <View style={styles.rowDivider} /> : null}
                {/* TreeCard yang SAMA dengan daftar Pohon, kontraknya tidak
                    disentuh. Chip di sisi kanannya tetap terikat ke KONDISI
                    pohon, bukan ke fase — pohon berbuah yang kena hama harus
                    tetap terlihat kena hama di layar ini, dan fase sudah
                    dinyatakan oleh segmen yang sedang terbuka.

                    photoUrl sengaja TIDAK dioper: fotonya datang dari jalur
                    pengambilan terpisah yang tidak dipakai layar ini, dan
                    menambahkannya berarti menambah permintaan jaringan.
                    TreeCard jatuh ke placeholder-nya sendiri. */}
                <TreeCard tree={tree} onPress={() => router.push(`/owner/trees/${tree.id}`)}>
                  {phaseAgeText ? (
                    <Text selectable numberOfLines={1} style={styles.phaseAge}>
                      {phaseAgeText}
                    </Text>
                  ) : null}
                </TreeCard>
              </React.Fragment>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

// Paling lama di fase itu DI ATAS, yaitu currentGrowthPhaseSince menaik.
//
// Disalin sebelum diurutkan: `trees` adalah state, dan Array.sort mengubah
// tempat. Mengurutkan langsung akan memutasi array yang dipegang React.
//
// Diurutkan DI SINI, bukan di service: aturan sesi melarang menyentuh
// src/services/, dan jumlah barisnya paling banyak ratusan.
//
// TANGGAL KOSONG DITARUH PALING BAWAH. Menurut komentar migrasi 066 baris
// seperti itu seharusnya tidak ada untuk fase berbunga dan berbuah —
// current_growth_phase_since ditulis dari baris catatan yang sama dengan
// current_growth_phase — tapi itu janji yang tidak bisa diverifikasi dari kode
// terhadap data nyata, jadi ditangani apa adanya.
//
// tree_code jadi pemecah seri supaya urutannya DETERMINISTIK: tanpa itu dua
// pohon yang masuk fase pada tanggal yang sama (jalur nyatanya pencatatan
// massal) bisa bertukar tempat antar pemuatan tanpa ada yang berubah.
function sortByPhaseAge(trees: FloweringMonitoringTree[]): FloweringMonitoringTree[] {
  return [...trees].sort((first, second) => {
    const firstSince = first.currentGrowthPhaseSince;
    const secondSince = second.currentGrowthPhaseSince;

    if (firstSince !== secondSince) {
      if (!firstSince) {
        return 1;
      }

      if (!secondSince) {
        return -1;
      }

      // 'YYYY-MM-DD' — urutan leksikografis sama dengan urutan kronologis, jadi
      // tidak perlu diubah jadi Date hanya untuk dibandingkan.
      return firstSince < secondSince ? -1 : 1;
    }

    if (first.treeCode === second.treeCode) {
      return 0;
    }

    return first.treeCode < second.treeCode ? -1 : 1;
  });
}

// "96 hari di fase ini".
//
// FRASA BARU, dan itu disengaja walau ada dua frasa bertetangga di repo:
//   * GrowthPhaseBadge  -> 'Berbunga · 96 hari' (chip di detail pohon). Ia
//     menyebut nama fasenya, yang di layar ini sudah dinyatakan segmen yang
//     sedang terbuka — mengulangnya di tiap baris berarti mencetak kata yang
//     sama sebanyak jumlah pohon.
//   * FloweringAgeMarker -> '96 hari sejak berbunga' (pita, kini tanpa
//     pemanggil). Ia mengukur HAL LAIN: hari sejak fase berbunga, bukan hari di
//     fase yang sedang berjalan. Untuk pohon berbuah keduanya menjawab
//     pertanyaan yang berbeda.
//
// null berarti tanggalnya tidak diketahui, dan barisnya tidak mendapat
// keterangan sama sekali — BUKAN '0 hari', yang akan terbaca sebagai "baru hari
// ini" padahal artinya "tidak tahu". Nol sendiri angka yang benar untuk fase
// yang dicatat hari ini, dan daysSinceLocal memang mengembalikan 0 untuk itu.
function buildPhaseAgeText(tree: FloweringMonitoringTree): string | null {
  if (!tree.currentGrowthPhaseSince) {
    return null;
  }

  const days = daysSinceLocal(tree.currentGrowthPhaseSince);

  return days === null ? null : `${days} hari di fase ini`;
}

const styles = StyleSheet.create({
  rowDivider: {
    backgroundColor: tokens.color.line.hairline,
    height: StyleSheet.hairlineWidth,
  },
  // Rata tengah: keadaan kosong satu-satunya hal yang boleh rata tengah di
  // layar ini. Tanpa kartu, tanpa tombol.
  emptyText: { ...tokens.type.body, color: tokens.color.text.secondary, textAlign: 'center' },
  phaseAge: { ...tokens.type.meta, color: tokens.color.text.tertiary },
});

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
