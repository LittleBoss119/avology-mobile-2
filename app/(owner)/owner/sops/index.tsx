import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  CareSOPCard,
  careCategoryOptions,
  careSopTargetOptions,
  formatCareCategory,
  formatCareSOPTarget,
} from '../../../../src/components/care-sop-components';
import {
  appTheme,
  Card,
  ChipButton,
  EmptyState,
  ErrorBanner,
  FilterChipsRow,
  LoadingState,
  SearchFilterRow,
  SectionHeader,
  Screen,
  TopAppBar,
} from '../../../../src/components/ui';
import { colors, radius } from '../../../../src/constants/theme';
import { useAuth } from '../../../../src/context/auth-context';
import {
  getCareSOPNextScheduleReference,
  getCareSOPs,
} from '../../../../src/services/careSopService';
import type {
  CareCategory,
  CareSOP,
  CareSOPDefaultTargetType,
  CareSOPNextScheduleReference,
  CareSOPNextScheduleStatus,
} from '../../../../src/types/domain';
import { formatTargetType } from '../../../../src/utils/displayFormat';

type ActiveStatusFilter = 'active' | 'all' | 'inactive';
type DueStatusFilter = CareSOPNextScheduleStatus | 'all';

export default function CareSOPListScreen() {
  const { currentFarm } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeStatusFilter, setActiveStatusFilter] = React.useState<ActiveStatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = React.useState<CareCategory | 'all'>('all');
  const [dueStatusFilter, setDueStatusFilter] = React.useState<DueStatusFilter>('all');
  const [references, setReferences] = React.useState<Record<string, CareSOPNextScheduleReference>>({});
  const [search, setSearch] = React.useState('');
  const [sops, setSops] = React.useState<CareSOP[]>([]);
  const [targetTypeFilter, setTargetTypeFilter] = React.useState<CareSOPDefaultTargetType | 'all'>('all');

  const farmId = currentFarm?.farmId;

  const loadSops = React.useCallback(async () => {
    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setSops([]);
      setReferences({});
      return;
    }

    setError(null);

    const result = await getCareSOPs({ farmId });

    if (result.error) {
      setError(result.error.message);
      setSops([]);
      setReferences({});
      return;
    }

    setSops(result.data);

    const referenceEntries = await Promise.all(
      result.data.map(async (sop) => {
        const referenceResult = await getCareSOPNextScheduleReference({ sopId: sop.id });
        return [sop.id, referenceResult.error ? null : referenceResult.data] as const;
      })
    );

    setReferences(
      Object.fromEntries(
        referenceEntries.filter((entry): entry is readonly [string, CareSOPNextScheduleReference] =>
          Boolean(entry[1])
        )
      )
    );
  }, [farmId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadSops().finally(() => setLoading(false));
    }, [loadSops])
  );

  if (loading) {
    return <LoadingState message="Memuat SOP perawatan..." />;
  }

  const normalizedSearch = search.trim().toLowerCase();
  const displayedSops = sops.filter((sop) => {
    const reference = references[sop.id];
    const matchesSearch = normalizedSearch
      ? [
          sop.name,
          sop.category,
          formatCareCategory(sop.category),
          formatCareSOPTarget(sop),
          sop.defaultInstruction,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch)
      : true;
    const matchesCategory = categoryFilter === 'all' || sop.category === categoryFilter;
    const matchesTarget = targetTypeFilter === 'all' || sop.defaultTargetType === targetTypeFilter;
    const matchesActiveStatus =
      activeStatusFilter === 'all' ||
      (activeStatusFilter === 'active' ? sop.isActive : !sop.isActive);
    const matchesDueStatus = dueStatusFilter === 'all' || reference?.status === dueStatusFilter;

    return matchesSearch && matchesCategory && matchesTarget && matchesActiveStatus && matchesDueStatus;
  });
  const hasActiveFilters =
    categoryFilter !== 'all' ||
    targetTypeFilter !== 'all' ||
    activeStatusFilter !== 'all' ||
    dueStatusFilter !== 'all';

  function clearFilters() {
    setCategoryFilter('all');
    setTargetTypeFilter('all');
    setActiveStatusFilter('all');
    setDueStatusFilter('all');
  }

  return (
    <Screen
      floatingAction={<FloatingAddButton onPress={() => router.push('/owner/sops/create')} />}
      floatingActionBottom={86}
    >
      <TopAppBar
        title="SOP Perawatan"
        subtitle="Template instruksi untuk membuat jadwal lebih cepat."
        onBack={() => router.back()}
      />
      <ErrorBanner message={error} />

      <SOPSummary
        active={sops.filter((sop) => sop.isActive).length}
        inactive={sops.filter((sop) => !sop.isActive).length}
        total={sops.length}
      />

      <SearchFilterRow
        onChangeText={setSearch}
        placeholder="Cari nama SOP, kategori, atau target"
        value={search}
      />

      <SOPFilterControls
        activeStatusFilter={activeStatusFilter}
        categoryFilter={categoryFilter}
        dueStatusFilter={dueStatusFilter}
        hasActiveFilters={hasActiveFilters}
        onActiveStatusChange={setActiveStatusFilter}
        onCategoryChange={setCategoryFilter}
        onClear={clearFilters}
        onDueStatusChange={setDueStatusFilter}
        onTargetTypeChange={setTargetTypeFilter}
        targetTypeFilter={targetTypeFilter}
      />

      <SectionHeader title="Daftar SOP">
        <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text selectable style={{ color: colors.textMuted, fontSize: 14 }}>
            {displayedSops.length} SOP
          </Text>
          <Text selectable style={{ color: colors.primary, fontSize: 13, fontWeight: '800' }}>
            Perawatan
          </Text>
        </View>
      </SectionHeader>

      {displayedSops.length === 0 ? (
        <EmptyState
          title={sops.length === 0 ? 'Belum ada SOP.' : 'Tidak ada SOP pada filter ini.'}
        />
      ) : (
        <View style={{ gap: 12 }}>
          {displayedSops.map((sop) => (
            <CareSOPCard
              key={sop.id}
              reference={references[sop.id]}
              sop={sop}
              onPress={() => router.push(`/owner/sops/${sop.id}`)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function SOPSummary({
  active,
  inactive,
  total,
}: {
  active: number;
  inactive: number;
  total: number;
}) {
  return (
    <Card variant="heroGreen">
      <Text selectable style={{ color: '#DDEFE2', fontSize: 15, fontWeight: '800' }}>
        SOP Perawatan
      </Text>
      <Text selectable style={{ color: '#FFFFFF', fontSize: 28, fontVariant: ['tabular-nums'], fontWeight: '900' }}>
        {total} template
      </Text>
      <View style={{ flexDirection: 'row', gap: 9 }}>
        <SummaryPill label="Aktif" value={active} />
        <SummaryPill label="Nonaktif" value={inactive} />
      </View>
    </Card>
  );
}

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
    <View
      style={{
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderColor: 'rgba(255,255,255,0.22)',
        borderRadius: radius.lg,
        borderWidth: 1,
        flex: 1,
        gap: 3,
        padding: 11,
      }}
    >
      <Text selectable style={{ color: '#DDEFE2', fontSize: 12, fontWeight: '800' }}>
        {label}
      </Text>
      <Text selectable style={{ color: '#A6D96A', fontSize: 23, fontVariant: ['tabular-nums'], fontWeight: '900' }}>
        {value}
      </Text>
    </View>
  );
}

function SOPFilterControls({
  activeStatusFilter,
  categoryFilter,
  dueStatusFilter,
  hasActiveFilters,
  onActiveStatusChange,
  onCategoryChange,
  onClear,
  onDueStatusChange,
  onTargetTypeChange,
  targetTypeFilter,
}: {
  activeStatusFilter: ActiveStatusFilter;
  categoryFilter: CareCategory | 'all';
  dueStatusFilter: DueStatusFilter;
  hasActiveFilters: boolean;
  onActiveStatusChange: (value: ActiveStatusFilter) => void;
  onCategoryChange: (value: CareCategory | 'all') => void;
  onClear: () => void;
  onDueStatusChange: (value: DueStatusFilter) => void;
  onTargetTypeChange: (value: CareSOPDefaultTargetType | 'all') => void;
  targetTypeFilter: CareSOPDefaultTargetType | 'all';
}) {
  return (
    <View style={{ gap: 8 }}>
      <FilterChipsRow hasActiveFilters={hasActiveFilters} onClear={onClear}>
        <ChipButton active={categoryFilter === 'all'} label="Semua kategori" onPress={() => onCategoryChange('all')} />
        {careCategoryOptions.map((category) => (
          <ChipButton
            key={category}
            active={categoryFilter === category}
            label={formatCareCategory(category)}
            onPress={() => onCategoryChange(category)}
          />
        ))}
      </FilterChipsRow>
      <FilterChipsRow>
        <ChipButton active={targetTypeFilter === 'all'} label="Semua target" onPress={() => onTargetTypeChange('all')} />
        {careSopTargetOptions.map((targetType) => (
          <ChipButton
            key={targetType}
            active={targetTypeFilter === targetType}
            label={formatTargetType(targetType)}
            onPress={() => onTargetTypeChange(targetType)}
          />
        ))}
      </FilterChipsRow>
      <FilterChipsRow>
        <ChipButton active={activeStatusFilter === 'all'} label="Semua status" onPress={() => onActiveStatusChange('all')} />
        <ChipButton active={activeStatusFilter === 'active'} label="Aktif" onPress={() => onActiveStatusChange('active')} />
        <ChipButton active={activeStatusFilter === 'inactive'} label="Nonaktif" onPress={() => onActiveStatusChange('inactive')} />
      </FilterChipsRow>
      <FilterChipsRow>
        <ChipButton active={dueStatusFilter === 'all'} label="Semua acuan" onPress={() => onDueStatusChange('all')} />
        <ChipButton active={dueStatusFilter === 'overdue'} label="Terlambat" onPress={() => onDueStatusChange('overdue')} />
        <ChipButton active={dueStatusFilter === 'due_today'} label="Hari ini" onPress={() => onDueStatusChange('due_today')} />
        <ChipButton active={dueStatusFilter === 'upcoming'} label="Belum jatuh tempo" onPress={() => onDueStatusChange('upcoming')} />
        <ChipButton active={dueStatusFilter === 'no_history'} label="Belum ada realisasi" onPress={() => onDueStatusChange('no_history')} />
        <ChipButton active={dueStatusFilter === 'no_interval'} label="Tidak ada interval" onPress={() => onDueStatusChange('no_interval')} />
      </FilterChipsRow>
    </View>
  );
}

function FloatingAddButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Tambah SOP"
      accessibilityRole="button"
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: appTheme.primary,
        borderColor: '#B8D8BF',
        borderRadius: 999,
        borderWidth: 1,
        height: 58,
        justifyContent: 'center',
        width: 58,
      }}
    >
      <Text selectable style={{ color: '#FFFFFF', fontSize: 36, fontWeight: '400', lineHeight: 40 }}>
        +
      </Text>
    </Pressable>
  );
}
