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
  archived: boolean; // owner saja
  conditions: TreeConditionStatus[];
  phases: GrowthPhase[];
};

const DEFAULT_CRITERIA: TreeFilterCriteria = {
  ageRanges: [],
  archived: false,
  conditions: [],
  phases: [],
};

// Chip triase kondisi: 'Bermasalah' menyatukan empat kondisi non-mati; 'dead'
// sengaja tidak masuk chip mana pun.
const PROBLEM_CONDITIONS: TreeConditionStatus[] = [
  'needs_attention',
  'pest_attacked',
  'disease_indicated',
  'damaged',
];

type TriageKey = 'all' | 'problem' | 'healthy';

const triageChips: Array<{ conditions: TreeConditionStatus[]; key: TriageKey; label: string }> = [
  { conditions: [], key: 'all', label: 'Semua' },
  { conditions: PROBLEM_CONDITIONS, key: 'problem', label: 'Bermasalah' },
  { conditions: ['healthy'], key: 'healthy', label: 'Sehat' },
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

export default function WorkerTreeListScreen() {
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

    const result = await getTrees({
      archived: criteria.archived,
      farmId,
    });

    if (result.error) {
      setError(result.error.message);
      setTrees([]);
      setPhotoMap({});
      return;
    }

    setTrees(result.data);

    const photoResult = await listTreeMainPhotosForFarm(farmId);

    if (photoResult.error) {
      setPhotoMap({});
      return;
    }

    setPhotoMap(photoResult.data);
  }, [criteria.archived, farmId]);

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

  const problemCount = trees.filter((tree) => PROBLEM_CONDITIONS.includes(tree.currentCondition)).length;

  const activeGroupCount =
    (criteria.conditions.length > 0 ? 1 : 0) +
    (criteria.phases.length > 0 ? 1 : 0) +
    (criteria.ageRanges.length > 0 ? 1 : 0) +
    (criteria.archived ? 1 : 0);

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
        <MainTabHeader
          title="Pohon"
          roleLabel="Pekerja"
          onProfilePress={() => router.push('/worker/profile')}
        />
      }
    >
      <ErrorBanner message={error} />

      <SearchFilterRow
        filterCount={activeGroupCount}
        onChangeText={setSearch}
        onFilterPress={openFilterSheet}
        placeholder="Cari kode atau varietas"
        value={search}
      />

      <FilterChipsRow>
        {triageChips.map((chip) => (
          <ChipButton
            key={chip.key}
            active={sameConditionSet(criteria.conditions, chip.conditions)}
            count={chip.key === 'problem' && problemCount > 0 ? problemCount : undefined}
            label={chip.label}
            onPress={() => setCriteria((current) => ({ ...current, conditions: chip.conditions }))}
          />
        ))}
      </FilterChipsRow>

      <ResultCount count={displayedTrees.length} />

      <TreeFilterSheet
        draft={draft}
        includeStatus={false}
        onApply={applyDraft}
        onClose={() => setFilterSheetOpen(false)}
        onDraftChange={setDraft}
        visible={filterSheetOpen}
      />

      {displayedTrees.length === 0 ? (
        trees.length === 0 ? (
          <EmptyState
            icon="tree"
            subtitle="Data pohon akan muncul setelah pemilik menambahkannya."
            title="Belum ada pohon"
            variant="plain"
          />
        ) : (
          <EmptyState
            icon="tree"
            subtitle="Coba longgarkan filternya."
            title="Tidak ada pohon yang cocok"
            variant="plain"
          />
        )
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {displayedTrees.map((tree) => (
            <View key={tree.id} style={{ flexBasis: '47.8%', flexGrow: 0, maxWidth: '47.8%', minWidth: 0 }}>
              <TreeCard
                photoUrl={photoMap[tree.id]?.signedUrl}
                tree={tree}
                onPress={() => router.push(`/worker/trees/${tree.id}`)}
              />
            </View>
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
  includeStatus,
  onApply,
  onClose,
  onDraftChange,
  visible,
}: {
  draft: TreeFilterCriteria;
  includeStatus: boolean;
  onApply: () => void;
  onClose: () => void;
  onDraftChange: (next: TreeFilterCriteria) => void;
  visible: boolean;
}) {
  const isDefault =
    draft.ageRanges.length === 0 &&
    draft.archived === false &&
    draft.conditions.length === 0 &&
    draft.phases.length === 0;

  function toggleCondition(value: TreeConditionStatus) {
    onDraftChange({ ...draft, conditions: toggleArrayValue(draft.conditions, value) });
  }

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
            onPress={() => onDraftChange(DEFAULT_CRITERIA)}
          >
            <Text selectable={false} style={[styles.resetText, isDefault ? styles.resetTextDisabled : null]}>
              Atur ulang
            </Text>
          </Pressable>
        </View>

        <View style={styles.filterGroup}>
          <Text selectable style={styles.filterLabel}>
            Kondisi
          </Text>
          <FilterChipsRow>
            {conditionOptions.map((option) => (
              <ChipButton
                key={option.value}
                active={draft.conditions.includes(option.value)}
                label={option.label}
                onPress={() => toggleCondition(option.value)}
              />
            ))}
          </FilterChipsRow>
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

        {includeStatus ? (
          <View style={styles.filterGroup}>
            <Text selectable style={styles.filterLabel}>
              Status pohon
            </Text>
            <FilterChipsRow>
              <ChipButton active={!draft.archived} label="Aktif" onPress={() => onDraftChange({ ...draft, archived: false })} />
              <ChipButton active={draft.archived} label="Diarsipkan" onPress={() => onDraftChange({ ...draft, archived: true })} />
            </FilterChipsRow>
          </View>
        ) : null}

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
      tree.variety,
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

  const ageYears = getTreeAgeYears(tree.plantedAt);

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
  filterSheetBody: { gap: tokens.space.md },
  filterGroup: { gap: tokens.space.sm },
  filterLabel: { ...tokens.type.label, color: tokens.color.text.primary },
  sheetResetRow: { alignItems: 'flex-end' },
  resetText: { ...tokens.type.label, color: tokens.color.brand.base },
  resetTextDisabled: { color: tokens.color.text.tertiary },
});
