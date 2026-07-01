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
  EmptyState,
  ErrorBanner,
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

      <Card>
        <SectionHeader title="Filter SOP" description="Saring template berdasarkan kategori, target, status, dan acuan jadwal." />
        <FilterChips
          label="Kategori"
          options={[
            { label: 'Semua kategori', value: 'all' },
            ...careCategoryOptions.map((category) => ({
              label: formatCareCategory(category),
              value: category,
            })),
          ]}
          selectedValue={categoryFilter}
          onSelect={(value) => setCategoryFilter(value as CareCategory | 'all')}
        />
        <FilterChips
          label="Target"
          options={[
            { label: 'Semua target', value: 'all' },
            ...careSopTargetOptions.map((targetType) => ({
              label: formatTargetType(targetType),
              value: targetType,
            })),
          ]}
          selectedValue={targetTypeFilter}
          onSelect={(value) => setTargetTypeFilter(value as CareSOPDefaultTargetType | 'all')}
        />
        <FilterChips
          label="Status"
          options={[
            { label: 'Semua status', value: 'all' },
            { label: 'Aktif', value: 'active' },
            { label: 'Nonaktif', value: 'inactive' },
          ]}
          selectedValue={activeStatusFilter}
          onSelect={(value) => setActiveStatusFilter(value as ActiveStatusFilter)}
        />
        <FilterChips
          label="Acuan jadwal"
          options={[
            { label: 'Semua', value: 'all' },
            { label: 'Terlambat', value: 'overdue' },
            { label: 'Hari ini', value: 'due_today' },
            { label: 'Belum jatuh tempo', value: 'upcoming' },
            { label: 'Belum ada realisasi', value: 'no_history' },
            { label: 'Tidak ada interval', value: 'no_interval' },
          ]}
          selectedValue={dueStatusFilter}
          onSelect={(value) => setDueStatusFilter(value as DueStatusFilter)}
        />
      </Card>

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
          title={sops.length === 0 ? 'Belum ada SOP' : 'SOP tidak ditemukan'}
          subtitle={
            sops.length === 0
              ? 'Buat template SOP agar jadwal perawatan bisa dibuat lebih cepat dan konsisten.'
              : 'Coba ubah kata kunci atau filter SOP.'
          }
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

function FilterChips<TValue extends string>({
  label,
  onSelect,
  options,
  selectedValue,
}: {
  label: string;
  onSelect: (value: TValue) => void;
  options: Array<{ label: string; value: TValue }>;
  selectedValue: TValue;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text selectable style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((option) => {
          const active = selectedValue === option.value;

          return (
            <Pressable
              key={option.value}
              onPress={() => onSelect(option.value)}
              style={{
                backgroundColor: active ? colors.primary : colors.surface,
                borderColor: active ? colors.primary : colors.border,
                borderRadius: radius.round,
                borderWidth: 1,
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            >
              <Text selectable style={{ color: active ? '#FFFFFF' : colors.text, fontSize: 13, fontWeight: '800' }}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
