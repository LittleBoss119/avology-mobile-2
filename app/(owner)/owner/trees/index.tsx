import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { BottomSheet } from '../../../../src/components/bottom-sheet';
import { TreeCard } from '../../../../src/components/tree-components';
import {
  Button,
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
import {
  formatGrowthPhase,
  formatTreeConditionStatus,
  formatTreeDisplayCode,
} from '../../../../src/utils/treeFormat';

type AgeRangeFilter = 'all' | 'lt_1' | '1_3' | 'gt_3';

const conditionFilterOptions: Array<{ label: string; value: TreeConditionStatus }> = [
  { label: 'Sehat', value: 'healthy' },
  { label: 'Perhatian', value: 'needs_attention' },
  { label: 'Hama', value: 'pest_attacked' },
  { label: 'Penyakit', value: 'disease_indicated' },
  { label: 'Rusak', value: 'damaged' },
  { label: 'Mati', value: 'dead' },
];

const phaseFilterOptions: Array<{ label: string; value: GrowthPhase }> = [
  { label: 'Awal', value: 'initial_planting' },
  { label: 'Vegetatif', value: 'vegetative' },
  { label: 'Berbunga', value: 'flowering' },
  { label: 'Berbuah', value: 'fruiting' },
  { label: 'Panen', value: 'harvesting' },
];

const ageRangeFilters: Array<{ label: string; value: AgeRangeFilter }> = [
  { label: 'Semua', value: 'all' },
  { label: '<1 tahun', value: 'lt_1' },
  { label: '1-3 tahun', value: '1_3' },
  { label: '>3 tahun', value: 'gt_3' },
];

export default function OwnerTreeListScreen() {
  const { currentFarm } = useAuth();
  const [ageRange, setAgeRange] = React.useState<AgeRangeFilter>('all');
  const [archived, setArchived] = React.useState(false);
  const [conditionFilters, setConditionFilters] = React.useState<TreeConditionStatus[]>([]);
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [phaseFilters, setPhaseFilters] = React.useState<GrowthPhase[]>([]);
  const [photoMap, setPhotoMap] = React.useState<TreeMainPhotoMap>({});
  const [search, setSearch] = React.useState('');
  const [trees, setTrees] = React.useState<Tree[]>([]);

  const farmId = currentFarm?.farmId;
  const farmName = currentFarm?.farm?.name ?? 'kebun aktif';

  const loadTrees = React.useCallback(async () => {
    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setTrees([]);
      setPhotoMap({});
      return;
    }

    setError(null);

    const result = await getTrees({
      archived,
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
  }, [archived, farmId]);

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
          ageRange,
          conditionFilters,
          phaseFilters,
          search: debouncedSearch,
        })
      ),
    [ageRange, conditionFilters, debouncedSearch, phaseFilters, trees]
  );
  const hasActiveSearchOrFilter =
    debouncedSearch.length > 0 ||
    conditionFilters.length > 0 ||
    phaseFilters.length > 0 ||
    ageRange !== 'all' ||
    archived;

  function toggleConditionFilter(condition: TreeConditionStatus) {
    setConditionFilters((current) => toggleArrayValue(current, condition));
  }

  function togglePhaseFilter(phase: GrowthPhase) {
    setPhaseFilters((current) => toggleArrayValue(current, phase));
  }

  function clearFilters() {
    setAgeRange('all');
    setArchived(false);
    setConditionFilters([]);
    setPhaseFilters([]);
  }

  if (loading) {
    return <LoadingState message="Memuat pohon..." />;
  }

  return (
    <Screen floatingAction={<FloatingAddButton onPress={() => router.push('/owner/trees/create')} />}>
      <MainTabHeader
        title="Pohon"
        roleLabel="Pemilik"
        subtitle={`${trees.length} pohon ${archived ? 'diarsipkan' : 'aktif'} di ${farmName}.`}
        onProfilePress={() => router.push('/owner/profile')}
      />
      <ErrorBanner message={error} />
      <SearchFilterBar
        onSearchChange={setSearch}
        search={search}
      />
      <OwnerFilterControls
        ageRange={ageRange}
        archived={archived}
        conditionFilters={conditionFilters}
        hasActiveFilters={conditionFilters.length > 0 || phaseFilters.length > 0 || ageRange !== 'all' || archived}
        onClear={clearFilters}
        onOpenFilters={() => setFilterOpen(true)}
        phaseFilters={phaseFilters}
      />
      <ResultCount active={hasActiveSearchOrFilter} count={displayedTrees.length} />

      <OwnerFilterPanel
        ageRange={ageRange}
        archived={archived}
        conditionFilters={conditionFilters}
        onAgeRangeChange={setAgeRange}
        onArchivedChange={setArchived}
        onClose={() => setFilterOpen(false)}
        onConditionToggle={toggleConditionFilter}
        onPhaseToggle={togglePhaseFilter}
        phaseFilters={phaseFilters}
        visible={filterOpen}
      />

      {displayedTrees.length === 0 ? (
        <View style={{ gap: spacing.md }}>
          <EmptyState
            title={archived ? 'Belum ada pohon diarsipkan' : 'Belum ada pohon'}
            subtitle={
              archived
                ? 'Pohon yang diarsipkan pemilik akan muncul di sini.'
                : 'Tambahkan pohon pertama untuk mulai memantau kebun.'
            }
          />
          {!archived ? <Button title="Tambah Pohon" onPress={() => router.push('/owner/trees/create')} /> : null}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {displayedTrees.map((tree) => (
            <View key={tree.id} style={{ flexBasis: '47.8%', flexGrow: 0, maxWidth: '47.8%', minWidth: 0 }}>
              <TreeCard
                photoUrl={photoMap[tree.id]?.signedUrl}
                tree={tree}
                onPress={() => router.push(`/owner/trees/${tree.id}`)}
              />
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

function SearchFilterBar({
  onSearchChange,
  search,
}: {
  onSearchChange: (value: string) => void;
  search: string;
}) {
  return (
    <SearchFilterRow
      onChangeText={onSearchChange}
      placeholder="Cari kode atau varietas"
      value={search}
    />
  );
}

function ResultCount({ active, count }: { active: boolean; count: number }) {
  return (
    <Text selectable style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700', marginTop: -6 }}>
      {active ? `Menampilkan ${count} pohon` : `Menampilkan ${count} pohon`}
    </Text>
  );
}

function OwnerFilterControls({
  ageRange,
  archived,
  conditionFilters,
  hasActiveFilters,
  onClear,
  onOpenFilters,
  phaseFilters,
}: {
  ageRange: AgeRangeFilter;
  archived: boolean;
  conditionFilters: TreeConditionStatus[];
  hasActiveFilters: boolean;
  onClear: () => void;
  onOpenFilters: () => void;
  phaseFilters: GrowthPhase[];
}) {
  return (
    <FilterChipsRow
      hasActiveFilters={hasActiveFilters}
      onClear={onClear}
      chips={[
        {
          active: conditionFilters.length > 0,
          key: 'condition',
          label: 'Kondisi',
          onPress: onOpenFilters,
          valueLabel: conditionFilters.length === 1 ? getConditionFilterLabel(conditionFilters[0]) : conditionFilters.length > 0 ? `${conditionFilters.length}` : undefined,
        },
        {
          active: phaseFilters.length > 0,
          key: 'phase',
          label: 'Fase',
          onPress: onOpenFilters,
          valueLabel: phaseFilters.length === 1 ? getPhaseFilterLabel(phaseFilters[0]) : phaseFilters.length > 0 ? `${phaseFilters.length}` : undefined,
        },
        {
          active: ageRange !== 'all',
          key: 'age',
          label: 'Umur',
          onPress: onOpenFilters,
          valueLabel: ageRange !== 'all' ? getAgeRangeLabel(ageRange) : undefined,
        },
        {
          active: archived,
          key: 'status',
          label: 'Status',
          onPress: onOpenFilters,
          valueLabel: archived ? 'Arsip' : undefined,
        },
      ]}
    />
  );
}

function OwnerFilterPanel({
  ageRange,
  archived,
  conditionFilters,
  onAgeRangeChange,
  onArchivedChange,
  onClose,
  onConditionToggle,
  onPhaseToggle,
  phaseFilters,
  visible,
}: {
  ageRange: AgeRangeFilter;
  archived: boolean;
  conditionFilters: TreeConditionStatus[];
  onAgeRangeChange: (ageRange: AgeRangeFilter) => void;
  onArchivedChange: (archived: boolean) => void;
  onClose: () => void;
  onConditionToggle: (condition: TreeConditionStatus) => void;
  onPhaseToggle: (phase: GrowthPhase) => void;
  phaseFilters: GrowthPhase[];
  visible: boolean;
}) {
  return (
    <BottomSheet
      onClose={onClose}
      subtitle="Pilih kondisi, fase, umur, dan status pohon."
      title="Filter Pohon"
      visible={visible}
    >
      <View style={{ gap: tokens.space.xl }}>
        <FilterSection title="Kondisi">
          <ChipRow>
            {conditionFilterOptions.map((filter) => (
              <FilterChip
                key={filter.value}
                active={conditionFilters.includes(filter.value)}
                label={filter.label}
                onPress={() => onConditionToggle(filter.value)}
              />
            ))}
          </ChipRow>
        </FilterSection>

        <FilterSection title="Fase tumbuh">
          <ChipRow>
            {phaseFilterOptions.map((filter) => (
              <FilterChip
                key={filter.value}
                active={phaseFilters.includes(filter.value)}
                label={filter.label}
                onPress={() => onPhaseToggle(filter.value)}
              />
            ))}
          </ChipRow>
        </FilterSection>

        <FilterSection title="Umur">
          <ChipRow>
            {ageRangeFilters.map((filter) => (
              <FilterChip
                key={filter.value}
                active={ageRange === filter.value}
                label={filter.label}
                onPress={() => onAgeRangeChange(filter.value)}
              />
            ))}
          </ChipRow>
        </FilterSection>

        <FilterSection title="Status pohon">
          <ChipRow>
            <FilterChip active={!archived} label="Aktif" onPress={() => onArchivedChange(false)} />
            <FilterChip active={archived} label="Diarsipkan" onPress={() => onArchivedChange(true)} />
          </ChipRow>
        </FilterSection>

        <SheetDoneButton onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

function FloatingAddButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: colors.primary,
        borderColor: colors.primaryBorder,
        borderRadius: 999,
        borderWidth: 1,
        height: 58,
        justifyContent: 'center',
        width: 58,
      }}
    >
      <Text selectable style={{ color: '#FFFFFF', fontSize: 34, fontWeight: '400', lineHeight: 38 }}>
        +
      </Text>
    </Pressable>
  );
}

function SheetDoneButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: colors.primarySoft,
        borderColor: colors.primaryBorder,
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 15,
        paddingVertical: 9,
      }}
    >
      <Text selectable style={{ color: colors.primary, fontSize: 14, fontWeight: '700' }}>
        Selesai
      </Text>
    </Pressable>
  );
}

function FilterSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View style={{ gap: 9 }}>
      <Text selectable style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>;
}

function FilterChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: active ? colors.primary : colors.surface,
        borderColor: active ? colors.primary : colors.border,
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 9,
      }}
    >
      <Text selectable style={{ color: active ? colors.white : colors.text, fontWeight: '700' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function filterTrees(
  trees: Tree[],
  filters: {
    ageRange: AgeRangeFilter;
    conditionFilters: TreeConditionStatus[];
    phaseFilters: GrowthPhase[];
    search: string;
  }
): Tree[] {
  return trees.filter((tree) => {
    if (filters.conditionFilters.length > 0 && !filters.conditionFilters.includes(tree.currentCondition)) {
      return false;
    }

    if (
      filters.phaseFilters.length > 0 &&
      (!tree.currentGrowthPhase || !filters.phaseFilters.includes(tree.currentGrowthPhase))
    ) {
      return false;
    }

    if (!matchesAgeRange(tree, filters.ageRange)) {
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

function matchesAgeRange(tree: Tree, ageRange: AgeRangeFilter): boolean {
  if (ageRange === 'all') {
    return true;
  }

  const ageYears = getTreeAgeYears(tree.plantedAt);

  if (ageYears === null) {
    return false;
  }

  if (ageRange === 'lt_1') {
    return ageYears < 1;
  }

  if (ageRange === '1_3') {
    return ageYears >= 1 && ageYears <= 3;
  }

  return ageYears > 3;
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

function getConditionFilterLabel(condition: TreeConditionStatus): string {
  return conditionFilterOptions.find((filter) => filter.value === condition)?.label ?? formatTreeConditionStatus(condition);
}

function getPhaseFilterLabel(phase: GrowthPhase): string {
  return phaseFilterOptions.find((filter) => filter.value === phase)?.label ?? formatGrowthPhase(phase);
}

function getAgeRangeLabel(ageRange: AgeRangeFilter): string {
  return ageRangeFilters.find((filter) => filter.value === ageRange)?.label ?? 'Semua umur';
}
