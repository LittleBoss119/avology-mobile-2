import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tokens } from '../constants/theme';
import { useAuth } from '../context/auth-context';
import { getTrees } from '../services/treeService';
import type { GrowthPhase, Tree } from '../types/domain';
import { daysSinceLocal } from '../utils/dateDiff';
import { formatGrowthPhase } from '../utils/treeFormat';
import { Icon } from './icons';
import { TreeCard } from './tree-components';
import { ErrorBanner, LoadingState, Screen, TopAppBar } from './ui';

// LIMA FASE, URUTAN KANONIK, DAN URUTANNYA MENGIKAT (§17).
//
// Bukan urutan abjad dan bukan urutan "yang paling banyak dulu": ia urutan
// HIDUP sebuah pohon, dan itu satu-satunya urutan yang tidak perlu dipelajari
// oleh pembacanya. Karena urutannya sendiri yang membawa arti, fase TIDAK
// mendapat penanda bentuk — aturan yang sudah ditetapkan di batch 5. Bentuk
// dipakai untuk membedakan hal-hal yang setara (kondisi pohon); fase tidak
// setara, ia berurutan, dan posisi di daftar sudah mengatakannya.
const PHASE_ORDER: GrowthPhase[] = [
  'initial_planting',
  'vegetative',
  'flowering',
  'fruiting',
  'harvesting',
];

// DUA FASE YANG DIBENTANGKAN saat layar dibuka. Keduanya yang benar-benar
// dipantau pemilik dari hari ke hari — dan itu juga alasan kartu Beranda hanya
// menghitung keduanya. Tiga fase lain tetap punya barisnya sendiri beserta
// jumlahnya; yang dilipat hanya isinya.
const EXPANDED_BY_DEFAULT: GrowthPhase[] = ['flowering', 'fruiting'];

// Berapa baris yang ditampilkan sebuah kelompok yang terbentang sebelum baris
// "Lihat N lainnya" muncul. Tiga, bukan semua: kebun dengan enam puluh pohon
// berbuah akan mengubur keempat kelompok lain di bawah satu daftar panjang,
// dan yang dicari orang di layar ini justru perbandingan antar fase.
const PREVIEW_ROWS = 3;

export function OwnerGrowthMonitoringScreen() {
  const { currentFarm } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [trees, setTrees] = React.useState<Tree[]>([]);
  // Dua keadaan terpisah, bukan satu tingkat "terbuka sebagian / terbuka
  // penuh": sebuah kelompok bisa terbentang tapi masih memotong barisnya, dan
  // menutupnya harus mengembalikannya ke keadaan terpotong — bukan ke keadaan
  // penuh yang terakhir dibuka.
  const [openPhases, setOpenPhases] = React.useState<GrowthPhase[]>(EXPANDED_BY_DEFAULT);
  const [fullPhases, setFullPhases] = React.useState<GrowthPhase[]>([]);

  const farmId = currentFarm?.farmId;

  // getTrees, MENGGANTIKAN getFloweringAndFruitingTrees (batch 7b).
  //
  // Bukan query baru: getTrees adalah service yang SUDAH ADA dengan argumen
  // yang SAMA PERSIS seperti yang dipakai daftar pohon, denah kebun, layar buat
  // jadwal, dan layar tambah pohon. Yang berubah hanya layar ini berhenti
  // meminta dua fase saja.
  //
  // Harus berubah karena §17 menuntut LIMA kelompok. getFloweringAndFruitingTrees
  // menyaring di sisi database ke 'flowering' dan 'fruiting', jadi tiga fase
  // lain tidak punya cara untuk sampai ke layar ini lewat jalur itu.
  //
  // archived:false — pohon yang diarsipkan tidak sedang menjalani fase apa pun.
  // Baris yang sama dipakai daftar pohon untuk tab "aktif".
  const loadTrees = React.useCallback(async () => {
    if (!farmId) {
      setError('Kebun aktif tidak ditemukan.');
      setTrees([]);
      return;
    }

    setError(null);

    const result = await getTrees({ archived: false, farmId });

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

  function togglePhase(phase: GrowthPhase) {
    setOpenPhases((current) =>
      current.includes(phase) ? current.filter((item) => item !== phase) : [...current, phase]
    );
    // Menutup kelompok mengembalikannya ke keadaan terpotong. Tanpa baris ini,
    // kelompok yang pernah dibentangkan penuh akan meledak jadi enam puluh
    // baris lagi begitu dibuka kembali — keadaan yang tidak pernah diminta
    // ulang oleh siapa pun.
    setFullPhases((current) => current.filter((item) => item !== phase));
  }

  return (
    /* Judulnya ADA, dan itu bukan pengecualian terhadap aturan "layar detail
       tanpa judul": ini layar DAFTAR yang dicapai dari Beranda, bukan detail
       satu benda yang namanya sudah tercetak besar di badan layar.

       "Fase pohon", sama persis dengan label baris di Beranda yang mengantar ke
       sini. Judul yang berbeda dari pintu masuknya membuat orang bertanya-tanya
       apakah ia sampai di tempat yang benar. */
    <Screen header={<TopAppBar title="Fase pohon" onBack={() => router.back()} />}>
      <ErrorBanner message={error} />

      {/* SegmentedControl dua fase DICABUT (batch 7b). Ia memaksa memilih satu
          dari dua fase pada layar yang gunanya justru MEMBANDINGKAN — dan ia
          tidak punya tempat sama sekali untuk tiga fase lain yang kini ikut
          ditampilkan. Kelompok yang bisa dilipat menggantikannya: semua fase
          terlihat sekaligus beserta jumlahnya, dan isinya dibuka seperlunya. */}
      <View style={{ gap: tokens.space.lg }}>
        {PHASE_ORDER.map((phase) => {
          const phaseTrees = sortByPhaseAge(
            trees.filter((tree) => tree.currentGrowthPhase === phase)
          );
          const open = openPhases.includes(phase);
          const full = fullPhases.includes(phase);
          const visibleTrees = full ? phaseTrees : phaseTrees.slice(0, PREVIEW_ROWS);
          const hiddenCount = phaseTrees.length - visibleTrees.length;

          return (
            <View key={phase} style={{ gap: tokens.space.sm }}>
              <PhaseGroupHeader
                count={phaseTrees.length}
                open={open}
                phase={phase}
                onPress={() => togglePhase(phase)}
              />

              {/* Kelompok KOSONG tidak pernah merender isi, terbuka atau tidak.
                  Barisnya sendiri TETAP ADA beserta angka 0 — kelompok yang
                  hilang saat kosong akan membuat urutan lima fase itu berlubang,
                  dan urutan itulah satu-satunya hal yang membawa arti di sini. */}
              {open && phaseTrees.length > 0 ? (
                <View>
                  {visibleTrees.map((tree, index) => (
                    <React.Fragment key={tree.id}>
                      {index > 0 ? <View style={styles.rowDivider} /> : null}
                      {/* TreeCard yang SAMA dengan daftar Pohon, kontraknya
                          tidak disentuh selain slot `trailing` yang memang
                          dibuat untuk baris ini. Badge di sisi kanannya tetap
                          terikat ke KONDISI pohon, bukan ke fase — pohon
                          berbuah yang kena hama harus tetap terlihat kena hama
                          di layar ini, dan fasenya sudah dinyatakan kelompok
                          tempat barisnya berdiri.

                          photoUrl sengaja TIDAK dioper: fotonya datang dari
                          jalur pengambilan terpisah yang tidak dipakai layar
                          ini, dan menambahkannya berarti menambah permintaan
                          jaringan. TreeCard jatuh ke placeholder-nya sendiri. */}
                      <TreeCard
                        tree={tree}
                        trailing={<PhaseAge tree={tree} />}
                        onPress={() => router.push(`/owner/trees/${tree.id}`)}
                      />
                    </React.Fragment>
                  ))}

                  {/* "Lihat N lainnya" — baris teks, bukan tombol berbingkai.
                      Ia bagian dari daftarnya, bukan aksi yang berdiri sejajar
                      dengan menyimpan atau menghapus sesuatu. */}
                  {hiddenCount > 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.moreRow, { opacity: pressed ? 0.6 : 1 }]}
                      onPress={() => setFullPhases((current) => [...current, phase])}
                    >
                      <Text selectable={false} style={styles.moreText}>
                        {`Lihat ${hiddenCount} lainnya`}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      {/* Pohon yang BELUM PERNAH dicatat fasenya tidak muncul di kelompok mana
          pun, dan jumlahnya dikatakan terus terang di sini alih-alih dibiarkan
          hilang diam-diam. Ia bukan fase keenam: currentGrowthPhase null
          berarti belum ada catatan fase sama sekali, dan mengarang kelompok
          untuknya akan menaruh "belum diketahui" sejajar dengan lima keadaan
          yang benar-benar diketahui. */}
      {countWithoutPhase(trees) > 0 ? (
        <Text selectable style={styles.footnote}>
          {`${countWithoutPhase(trees)} pohon belum punya catatan fase.`}
        </Text>
      ) : null}
    </Screen>
  );
}

// Kepala kelompok: nama fase, jumlahnya, dan chevron yang menyatakan arah.
//
// Seluruh barisnya yang bisa ditekan, bukan chevron-nya saja — target sentuh
// selebar layar jauh lebih mudah dikenai daripada ikon 20px, dan pembacanya
// memakai aplikasi ini sambil berdiri di kebun.
function PhaseGroupHeader({
  count,
  onPress,
  open,
  phase,
}: {
  count: number;
  onPress: () => void;
  open: boolean;
  phase: GrowthPhase;
}) {
  const empty = count === 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: empty, expanded: open && !empty }}
      disabled={empty}
      style={({ pressed }) => [styles.groupHeader, { opacity: pressed ? 0.6 : 1 }]}
      onPress={onPress}
    >
      <Text selectable style={[styles.groupTitle, empty ? styles.groupTitleEmpty : null]}>
        {formatGrowthPhase(phase)}
      </Text>
      <Text selectable style={[styles.groupCount, empty ? styles.groupTitleEmpty : null]}>
        {count}
      </Text>
      {/* Kelompok kosong tidak punya chevron: tidak ada yang bisa dibuka, dan
          chevron yang tidak menanggapi ketukan lebih membingungkan daripada
          chevron yang tidak ada. */}
      {empty ? null : (
        <Icon
          name={open ? 'chevron-down' : 'chevron-right'}
          size={tokens.icon.md}
          color={tokens.color.text.tertiary}
        />
      )}
    </Pressable>
  );
}

// "96 hari" — sejak fase yang sedang berjalan DITANDAI, bukan sejak pohonnya
// ditanam.
//
// SATU PENGURANGAN, TITIK. Tanggalnya datang dari kolom turunan
// trees.current_growth_phase_since (migrasi 066), yang ditulis
// recalculate_tree_current_growth_phase dari BARIS catatan yang sama yang
// menetapkan currentGrowthPhase. Tidak ada kueri tambahan dan tidak ada
// penyapuan daftar riwayat di klien — penyaringan siklusnya sudah selesai di
// database, dan layar detail pohon membaca angka yang sama dari kolom yang sama.
//
// null berarti tanggalnya tidak diketahui, dan barisnya tidak mendapat
// keterangan sama sekali — BUKAN "0 hari", yang akan terbaca sebagai "baru hari
// ini" padahal artinya "tidak tahu". Nol sendiri angka yang benar untuk fase
// yang dicatat hari ini, dan daysSinceLocal memang mengembalikan 0 untuk itu.
function PhaseAge({ tree }: { tree: Tree }) {
  if (!tree.currentGrowthPhaseSince) {
    return null;
  }

  const days = daysSinceLocal(tree.currentGrowthPhaseSince);

  if (days === null) {
    return null;
  }

  return (
    <Text selectable numberOfLines={1} style={styles.phaseAge}>
      {`${days} hari`}
    </Text>
  );
}

function countWithoutPhase(trees: Tree[]): number {
  return trees.filter((tree) => tree.currentGrowthPhase === null).length;
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
// seperti itu seharusnya tidak ada — current_growth_phase_since ditulis dari
// baris catatan yang sama dengan current_growth_phase — tapi itu janji yang
// tidak bisa diverifikasi dari kode terhadap data nyata, jadi ditangani apa
// adanya.
//
// tree_code jadi pemecah seri supaya urutannya DETERMINISTIK: tanpa itu dua
// pohon yang masuk fase pada tanggal yang sama (jalur nyatanya pencatatan
// massal) bisa bertukar tempat antar pemuatan tanpa ada yang berubah.
function sortByPhaseAge(trees: Tree[]): Tree[] {
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

const styles = StyleSheet.create({
  footnote: { ...tokens.type.meta, color: tokens.color.text.tertiary },
  groupCount: {
    color: tokens.color.text.secondary,
    fontSize: tokens.type.bodyStrong.fontSize,
    fontWeight: tokens.type.bodyStrong.fontWeight,
    lineHeight: tokens.type.bodyStrong.lineHeight,
  },
  groupHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.space.md,
    minHeight: tokens.layout.rowMinHeight,
  },
  groupTitle: {
    color: tokens.color.text.primary,
    flex: 1,
    fontSize: tokens.type.subheading.fontSize,
    fontWeight: tokens.type.subheading.fontWeight,
    lineHeight: tokens.type.subheading.lineHeight,
  },
  // Kelompok kosong tetap terbaca, hanya lebih redup. Ia tidak disembunyikan:
  // "tidak ada pohon berbunga" adalah kabar, dan kabar itu hilang kalau
  // barisnya ikut hilang.
  groupTitleEmpty: { color: tokens.color.text.tertiary },
  moreRow: {
    borderTopColor: tokens.color.line.hairline,
    borderTopWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: tokens.layout.rowMinHeight,
  },
  moreText: {
    color: tokens.color.brand.base,
    fontSize: tokens.type.bodySmall.fontSize,
    lineHeight: tokens.type.bodySmall.lineHeight,
  },
  phaseAge: { ...tokens.type.meta, color: tokens.color.text.secondary },
  rowDivider: {
    backgroundColor: tokens.color.line.hairline,
    height: StyleSheet.hairlineWidth,
  },
});
