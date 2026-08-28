import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '../../../../src/components/bottom-sheet';
import { TreeCard } from '../../../../src/components/tree-components';
import {
  Button,
  ChipButton,
  EmptyState,
  ErrorBanner,
  FilterChipsRow,
  LoadingState,
  MainTabHeader,
  SearchFilterRow,
  Screen,
} from '../../../../src/components/ui';
import { colors, spacing, tokens } from '../../../../src/constants/theme';
import { useAuth } from '../../../../src/context/auth-context';
import { listTreeMainPhotosForFarm } from '../../../../src/services/photoAttachmentService';
import { getTrees } from '../../../../src/services/treeService';
import type { GrowthPhase, Tree, TreeConditionStatus } from '../../../../src/types/domain';
import type { TreeMainPhotoMap } from '../../../../src/types/media';
import { formatTreeDisplayCode } from '../../../../src/utils/treeFormat';

type TreeAgeRange = 'lt_1' | '1_3' | 'gt_3';

type TreeFilterCriteria = {
  ageRanges: TreeAgeRange[];
  conditions: TreeConditionStatus[];
  phases: GrowthPhase[];
};

const DEFAULT_CRITERIA: TreeFilterCriteria = {
  ageRanges: [],
  conditions: [],
  phases: [],
};

// TIDAK TERPAKAI sejak sumbu kondisi seluruhnya pindah ke deret chip. Dibiarkan
// menunggu keputusan: chip "Bermasalah" yang menyatukan empat kondisi non-mati
// bisa saja kembali sebagai chip kedelapan.
const PROBLEM_CONDITIONS: TreeConditionStatus[] = [
  'needs_attention',
  'pest_attacked',
  'disease_indicated',
  'damaged',
];

const conditionOptions: Array<{ label: string; value: TreeConditionStatus }> = [
  { label: 'Sehat', value: 'healthy' },
  { label: 'Perhatian', value: 'needs_attention' },
  { label: 'Hama', value: 'pest_attacked' },
  { label: 'Penyakit', value: 'disease_indicated' },
  { label: 'Rusak', value: 'damaged' },
  { label: 'Mati', value: 'dead' },
];

const phaseOptions: Array<{ label: string; value: GrowthPhase }> = [
  { label: 'Awal', value: 'initial_planting' },
  { label: 'Vegetatif', value: 'vegetative' },
  { label: 'Berbunga', value: 'flowering' },
  { label: 'Berbuah', value: 'fruiting' },
  { label: 'Panen', value: 'harvesting' },
];

const ageRangeOptions: Array<{ label: string; value: TreeAgeRange }> = [
  { label: '<1 tahun', value: 'lt_1' },
  { label: '1-3 tahun', value: '1_3' },
  { label: '>3 tahun', value: 'gt_3' },
];

// SATU sumbu kondisi, dan tempatnya di sini — bukan dibagi dua antara deret chip
// dan grup "Kondisi" di dalam sheet. Dulu keduanya menulis criteria.conditions
// yang sama: menekan chip menghapus pilihan sheet tanpa memberi tahu, dan
// sebaliknya. Yang terlihat berbeda ternyata satu benda.
//
// Diturunkan dari conditionOptions supaya label chip dan label yang dulu ada di
// sheet tidak bisa berbeda. Tiap chip memilih TEPAT SATU kondisi; deretnya
// melebihi lebar layar dan digulung horizontal oleh FilterChipsRow.
const triageChips: Array<{ conditions: TreeConditionStatus[]; key: string; label: string }> = [
  { conditions: [], key: 'all', label: 'Semua' },
  ...conditionOptions.map((option) => ({
    conditions: [option.value],
    key: option.value,
    label: option.label,
  })),
];

export default function OwnerTreeListScreen() {
  const { currentFarm } = useAuth();
  const [criteria, setCriteria] = React.useState<TreeFilterCriteria>(DEFAULT_CRITERIA);
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [draft, setDraft] = React.useState<TreeFilterCriteria>(DEFAULT_CRITERIA);
  const [error, setError] = React.useState<string | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [photoMap, setPhotoMap] = React.useState<TreeMainPhotoMap>({});
  const [search, setSearch] = React.useState('');
  const [trees, setTrees] = React.useState<Tree[]>([]);

  const farmId = currentFarm?.farmId;

  const loadTrees = React.useCallback(async () => {
    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setTrees([]);
      setPhotoMap({});
      return;
    }

    setError(null);

    // archived: false sebagai literal, sama dengan enam pemanggil getTrees lain
    // di repo. Dulu nilainya datang dari sumbu filter Aktif/Diarsipkan di layar
    // ini; sumbu itu sudah dicabut, jadi tidak ada lagi yang bisa membuatnya
    // true. Parameternya sendiri TETAP ada di getTrees.
    const result = await getTrees({
      archived: false,
      farmId,
    });

    if (result.error) {
      setError(result.error.message);
      setTrees([]);
      setPhotoMap({});
      return;
    }

    setTrees(result.data);

    // Siklus aktif tiap posisi, diambil dari daftar pohon yang baru saja dimuat
    // — getTrees sudah membawa activePlanting sebagai embedded resource, jadi
    // tidak ada query tambahan. Tanpa peta ini, posisi yang ditanami ulang akan
    // menampilkan foto pohon lama di daftar.
    const photoResult = await listTreeMainPhotosForFarm(
      farmId,
      Object.fromEntries(result.data.map((tree) => [tree.id, tree.activePlanting?.id ?? null]))
    );

    if (photoResult.error) {
      setPhotoMap({});
      return;
    }

    setPhotoMap(photoResult.data);
  }, [farmId]);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);

    return () => clearTimeout(timer);
  }, [search]);

  useFocusEffect(
    React.useCallback(() => {
      loadTrees().finally(() => setLoading(false));
    }, [loadTrees])
  );

  const displayedTrees = React.useMemo(
    () =>
      sortTreesByCode(
        filterTrees(trees, {
          ageRanges: criteria.ageRanges,
          conditions: criteria.conditions,
          phases: criteria.phases,
          search: debouncedSearch,
        })
      ),
    [criteria.ageRanges, criteria.conditions, criteria.phases, debouncedSearch, trees]
  );

  // Kondisi TIDAK ikut dihitung di sini sejak ia keluar dari sheet: badge angka
  // di tombol Filter hanya boleh mewakili yang tersembunyi di balik tombol itu,
  // sedangkan kondisi sudah terpampang sebagai chip yang aktif.
  const activeGroupCount =
    (criteria.phases.length > 0 ? 1 : 0) + (criteria.ageRanges.length > 0 ? 1 : 0);

  // "Kebun ini memang belum punya pohon" — BUKAN sekadar nol hasil. Nol hasil
  // karena filter ditangani cabang empty state yang lain, yang menyuruh
  // melonggarkan filternya alih-alih menawarkan tombol Tambah Pohon.
  const isFarmEmpty = trees.length === 0;

  function openFilterSheet() {
    setDraft(criteria);
    setFilterSheetOpen(true);
  }

  function applyDraft() {
    setCriteria(draft);
    setFilterSheetOpen(false);
  }

  if (loading) {
    return <LoadingState message="Memuat pohon..." />;
  }

  return (
    <Screen
      header={
        // Aksi "tambah" pindah dari FAB ke sisi kanan judul. FAB melayang di atas
        // daftar dan menutupi baris terakhir; di sini tempatnya tetap dan tidak
        // menghalangi apa pun. flexShrink 0 supaya judul "Pohon" yang mengalah
        // kalau ruangnya sempit, bukan chipnya.
        <MainTabHeader
          title="Pohon"
          right={
            <View style={{ flexDirection: 'row', flexShrink: 0, gap: spacing.sm }}>
              <ChipButton active={false} label="Denah" onPress={() => router.push('/owner/trees/map')} />
              <ChipButton
                active={false}
                icon="plus"
                label="Tambah"
                onPress={() => router.push('/owner/trees/create')}
              />
            </View>
          }
        />
      }
    >
      <ErrorBanner message={error} />

      {/* Kebun yang belum punya pohon tidak diberi kolom pencarian, deret chip,
          maupun "Menampilkan 0 pohon": tidak ada yang bisa dicari atau disaring,
          dan ketiganya cuma menunda empty state yang jadi satu-satunya isi
          berguna di layar ini. Begitu ada pohon, ketiganya kembali — termasuk
          saat filter tidak menghasilkan apa-apa, karena di sana justru kontrol
          itulah jalan keluarnya. */}
      {isFarmEmpty ? null : (
        <>
          <SearchFilterRow
            filterCount={activeGroupCount}
            onChangeText={setSearch}
            onFilterPress={openFilterSheet}
            placeholder="Cari kode atau varietas"
            value={search}
          />

          {/* Tanpa angka. Baris "Menampilkan N pohon" tepat di bawahnya sudah
              menyatakan berapa yang terlihat, dan angka di chip yang tidak aktif
              mengabarkan hal yang tidak ditanyakan siapa pun. */}
          <FilterChipsRow>
            {triageChips.map((chip) => (
              <ChipButton
                key={chip.key}
                active={sameConditionSet(criteria.conditions, chip.conditions)}
                label={chip.label}
                onPress={() => setCriteria((current) => ({ ...current, conditions: chip.conditions }))}
              />
            ))}
          </FilterChipsRow>

          <ResultCount count={displayedTrees.length} />
        </>
      )}

      <TreeFilterSheet
        draft={draft}
        onApply={applyDraft}
        onClose={() => setFilterSheetOpen(false)}
        onDraftChange={setDraft}
        visible={filterSheetOpen}
      />

      {displayedTrees.length === 0 ? (
        trees.length === 0 ? (
          <View style={{ gap: spacing.md }}>
            <EmptyState
              icon="tree"
              title="Belum ada pohon"
              subtitle="Tambahkan pohon pertama untuk mulai memantau kondisi kebun."
              variant="plain"
            />
            <Button title="Tambah Pohon" onPress={() => router.push('/owner/trees/create')} />
          </View>
        ) : (
          <EmptyState
            icon="tree"
            subtitle="Coba longgarkan filternya."
            title="Tidak ada pohon yang cocok"
            variant="plain"
          />
        )
      ) : (
        // Satu kolom dengan garis rambut antar baris, bukan grid dua kolom.
        // Baris terakhir tidak diberi garis supaya daftarnya tidak menggantung.
        <View>
          {displayedTrees.map((tree, index) => (
            <React.Fragment key={tree.id}>
              {index > 0 ? <View style={styles.rowDivider} /> : null}
              <TreeCard
                photoUrl={photoMap[tree.id]?.signedUrl}
                tree={tree}
                onPress={() => router.push(`/owner/trees/${tree.id}`)}
              />
            </React.Fragment>
          ))}
        </View>
      )}
    </Screen>
  );
}

function ResultCount({ count }: { count: number }) {
  return (
    <Text selectable style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700', marginTop: -6 }}>
      {`Menampilkan ${count} pohon`}
    </Text>
  );
}

function TreeFilterSheet({
  draft,
  onApply,
  onClose,
  onDraftChange,
  visible,
}: {
  draft: TreeFilterCriteria;
  onApply: () => void;
  onClose: () => void;
  onDraftChange: (next: TreeFilterCriteria) => void;
  visible: boolean;
}) {
  // conditions TIDAK ikut diperiksa: sumbu itu sudah tidak ada di sheet ini, dan
  // "Atur ulang" di sini hanya boleh mengatur ulang apa yang terlihat di sini.
  // Chip kondisi di layar punya "Semua" sebagai jalan atur ulangnya sendiri.
  const isDefault = draft.ageRanges.length === 0 && draft.phases.length === 0;

  function togglePhase(value: GrowthPhase) {
    onDraftChange({ ...draft, phases: toggleArrayValue(draft.phases, value) });
  }

  function toggleAgeRange(value: TreeAgeRange) {
    onDraftChange({ ...draft, ageRanges: toggleArrayValue(draft.ageRanges, value) });
  }

  return (
    <BottomSheet onClose={onClose} title="Filter pohon" visible={visible}>
      <View style={styles.filterSheetBody}>
        <View style={styles.sheetResetRow}>
          <Pressable
            accessibilityRole="button"
            disabled={isDefault}
            hitSlop={{ bottom: 8, left: 8, right: 8, top: 8 }}
            // conditions dibawa serta, tidak ikut direset: kondisi dipilih lewat
            // chip di luar sheet, dan tombol ini tidak boleh diam-diam
            // membatalkan pilihan yang dibuat di sana.
            onPress={() => onDraftChange({ ...DEFAULT_CRITERIA, conditions: draft.conditions })}
          >
            <Text selectable={false} style={[styles.resetText, isDefault ? styles.resetTextDisabled : null]}>
              Atur ulang
            </Text>
          </Pressable>
        </View>

        <View style={styles.filterGroup}>
          <Text selectable style={styles.filterLabel}>
            Fase tumbuh
          </Text>
          <FilterChipsRow>
            {phaseOptions.map((option) => (
              <ChipButton
                key={option.value}
                active={draft.phases.includes(option.value)}
                label={option.label}
                onPress={() => togglePhase(option.value)}
              />
            ))}
          </FilterChipsRow>
        </View>

        <View style={styles.filterGroup}>
          <Text selectable style={styles.filterLabel}>
            Umur
          </Text>
          <FilterChipsRow>
            {ageRangeOptions.map((option) => (
              <ChipButton
                key={option.value}
                active={draft.ageRanges.includes(option.value)}
                label={option.label}
                onPress={() => toggleAgeRange(option.value)}
              />
            ))}
          </FilterChipsRow>
        </View>

        <Button title="Terapkan" variant="primary" onPress={onApply} />
      </View>
    </BottomSheet>
  );
}

function filterTrees(
  trees: Tree[],
  filters: {
    ageRanges: TreeAgeRange[];
    conditions: TreeConditionStatus[];
    phases: GrowthPhase[];
    search: string;
  }
): Tree[] {
  return trees.filter((tree) => {
    if (filters.conditions.length > 0 && !filters.conditions.includes(tree.currentCondition)) {
      return false;
    }

    if (
      filters.phases.length > 0 &&
      (!tree.currentGrowthPhase || !filters.phases.includes(tree.currentGrowthPhase))
    ) {
      return false;
    }

    if (!matchesAgeRanges(tree, filters.ageRanges)) {
      return false;
    }

    if (!filters.search) {
      return true;
    }

    const searchableText = [
      formatTreeDisplayCode(tree),
      tree.treeCode,
      tree.activePlanting?.variety,
      tree.rowPosition,
      tree.columnPosition,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchableText.includes(filters.search);
  });
}

function matchesAgeRanges(tree: Tree, ageRanges: TreeAgeRange[]): boolean {
  if (ageRanges.length === 0) {
    return true;
  }

  const ageYears = getTreeAgeYears(tree.activePlanting?.plantedAt);

  if (ageYears === null) {
    return false;
  }

  return ageRanges.some((range) => matchesSingleAgeRange(ageYears, range));
}

function matchesSingleAgeRange(ageYears: number, range: TreeAgeRange): boolean {
  if (range === 'lt_1') {
    return ageYears < 1;
  }

  if (range === '1_3') {
    return ageYears >= 1 && ageYears <= 3;
  }

  return ageYears > 3;
}

function sameConditionSet(a: TreeConditionStatus[], b: TreeConditionStatus[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const setB = new Set(b);
  return a.every((value) => setB.has(value));
}

function sortTreesByCode(trees: Tree[]): Tree[] {
  return [...trees].sort((first, second) =>
    formatTreeDisplayCode(first).localeCompare(formatTreeDisplayCode(second), 'id-ID', { numeric: true })
  );
}

function getTreeAgeYears(plantedAt?: string | null): number | null {
  if (!plantedAt) {
    return null;
  }

  const plantedDate = new Date(plantedAt);

  if (Number.isNaN(plantedDate.getTime())) {
    return null;
  }

  return (Date.now() - plantedDate.getTime()) / 31_536_000_000;
}

function toggleArrayValue<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

const styles = StyleSheet.create({
  rowDivider: {
    backgroundColor: tokens.color.line.hairline,
    height: StyleSheet.hairlineWidth,
  },
  filterSheetBody: { gap: tokens.space.md },
  filterGroup: { gap: tokens.space.sm },
  filterLabel: { ...tokens.type.label, color: tokens.color.text.primary },
  sheetResetRow: { alignItems: 'flex-end' },
  resetText: { ...tokens.type.label, color: tokens.color.brand.base },
  resetTextDisabled: { color: tokens.color.text.tertiary },
});
