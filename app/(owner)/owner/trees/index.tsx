import { router } from 'expo-router';
import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { TreeCard } from '../../../../src/components/tree-components';
import {
  Badge,
  EmptyState,
  ErrorBanner,
  Field,
  LoadingState,
  PageIntro,
  Screen,
} from '../../../../src/components/ui';
import { useAuth } from '../../../../src/context/auth-context';
import { getTrees } from '../../../../src/services/treeService';
import type { Tree, TreeConditionStatus } from '../../../../src/types/domain';
import { formatTreeConditionStatus } from '../../../../src/utils/treeFormat';

type ConditionFilter = TreeConditionStatus | 'all';

const conditionFilters: Array<{ label: string; value: ConditionFilter }> = [
  { label: 'Semua', value: 'all' },
  { label: 'Sehat', value: 'healthy' },
  { label: 'Perlu Perhatian', value: 'needs_attention' },
  { label: 'Terserang Hama', value: 'pest_attacked' },
  { label: 'Terindikasi Penyakit', value: 'disease_indicated' },
  { label: 'Rusak', value: 'damaged' },
  { label: 'Mati', value: 'dead' },
];

export default function OwnerTreeListScreen() {
  const { currentFarm } = useAuth();
  const [archived, setArchived] = React.useState(false);
  const [condition, setCondition] = React.useState<ConditionFilter>('all');
  const [error, setError] = React.useState<string | null>(null);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [trees, setTrees] = React.useState<Tree[]>([]);

  const farmId = currentFarm?.farmId;

  const loadTrees = React.useCallback(async () => {
    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setTrees([]);
      return;
    }

    setError(null);

    const result = await getTrees({
      archived,
      condition,
      farmId,
      search,
    });

    if (result.error) {
      setError(result.error.message);
      setTrees([]);
      return;
    }

    setTrees(result.data);
  }, [archived, condition, farmId, search]);

  React.useEffect(() => {
    loadTrees().finally(() => setLoading(false));
  }, [loadTrees]);

  if (loading) {
    return <LoadingState message="Memuat pohon..." />;
  }

  return (
    <Screen
      floatingAction={
        <FloatingAddButton onPress={() => router.push('/owner/trees/create')} />
      }
    >
      <PageIntro
        title="Pohon"
        subtitle={`${trees.length} pohon ${archived ? 'diarsipkan' : 'aktif'} tampil dari kebun ini.`}
      />
      <ErrorBanner message={error} />
      <SearchFilterBar
        onFilterPress={() => setFilterOpen(true)}
        onSearchChange={setSearch}
        search={search}
      />
      <ActiveFilterSummary archived={archived} condition={condition} />

      <OwnerFilterPanel
        archived={archived}
        condition={condition}
        onArchivedChange={setArchived}
        onClose={() => setFilterOpen(false)}
        onConditionChange={setCondition}
        visible={filterOpen}
      />

      {trees.length === 0 ? (
        <EmptyState
          title={archived ? 'Belum ada pohon diarsipkan' : 'Belum ada pohon aktif'}
          subtitle={
            archived
              ? 'Pohon yang diarsipkan pemilik akan muncul di sini.'
              : 'Tambahkan pohon pertama untuk mulai mencatat kondisi.'
          }
        />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {trees.map((tree) => (
            <View key={tree.id} style={{ flexBasis: '47%', flexGrow: 1, minWidth: 154 }}>
              <TreeCard tree={tree} onPress={() => router.push(`/owner/trees/${tree.id}`)} />
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

function SearchFilterBar({
  onFilterPress,
  onSearchChange,
  search,
}: {
  onFilterPress: () => void;
  onSearchChange: (value: string) => void;
  search: string;
}) {
  return (
    <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Field
          label="Cari pohon"
          onChangeText={onSearchChange}
          placeholder="Kode atau varietas"
          value={search}
        />
      </View>
      <Pressable
        onPress={onFilterPress}
        style={{
          alignItems: 'center',
          backgroundColor: '#065F2E',
          borderRadius: 14,
          height: 50,
          justifyContent: 'center',
          width: 64,
        }}
      >
        <Text selectable style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '900' }}>
          Filter
        </Text>
      </Pressable>
    </View>
  );
}

function ActiveFilterSummary({
  archived,
  condition,
}: {
  archived: boolean;
  condition: ConditionFilter;
}) {
  if (condition === 'all' && !archived) {
    return null;
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {condition !== 'all' ? <Badge label={getConditionFilterLabel(condition)} tone="success" /> : null}
      {archived ? <Badge label="Diarsipkan" tone="muted" /> : null}
    </View>
  );
}

function OwnerFilterPanel({
  archived,
  condition,
  onArchivedChange,
  onClose,
  onConditionChange,
  visible,
}: {
  archived: boolean;
  condition: ConditionFilter;
  onArchivedChange: (archived: boolean) => void;
  onClose: () => void;
  onConditionChange: (condition: ConditionFilter) => void;
  visible: boolean;
}) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={{ backgroundColor: 'rgba(30,42,36,0.24)', flex: 1 }} onPress={onClose} />
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          gap: 18,
          padding: 20,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text selectable style={{ color: '#1E2A24', fontSize: 20, fontWeight: '900' }}>
              Filter Pohon
            </Text>
            <Text selectable style={{ color: '#68746D', lineHeight: 20 }}>
              Pilih kondisi dan status pohon yang ingin ditampilkan.
            </Text>
          </View>
          <Pressable onPress={onClose} style={{ padding: 6 }}>
            <Text selectable style={{ color: '#065F2E', fontSize: 16, fontWeight: '800' }}>
              Selesai
            </Text>
          </Pressable>
        </View>

        <View style={{ gap: 9 }}>
          <Text selectable style={{ color: '#1E2A24', fontSize: 15, fontWeight: '800' }}>
            Kondisi
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {conditionFilters.map((filter) => (
              <FilterChip
                key={filter.value}
                active={condition === filter.value}
                label={filter.value === 'all' ? filter.label : formatTreeConditionStatus(filter.value)}
                onPress={() => onConditionChange(filter.value)}
              />
            ))}
          </View>
        </View>

        <View style={{ gap: 9 }}>
          <Text selectable style={{ color: '#1E2A24', fontSize: 15, fontWeight: '800' }}>
            Status pohon
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <FilterChip active={!archived} label="Aktif" onPress={() => onArchivedChange(false)} />
            <FilterChip active={archived} label="Diarsipkan" onPress={() => onArchivedChange(true)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function FloatingAddButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: '#065F2E',
        borderColor: '#B8D8BF',
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
        backgroundColor: active ? '#065F2E' : '#FFFFFF',
        borderColor: active ? '#065F2E' : '#DCE7D5',
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 9,
      }}
    >
      <Text selectable style={{ color: active ? '#FFFFFF' : '#1E2A24', fontWeight: '700' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function getConditionFilterLabel(condition: ConditionFilter): string {
  return condition === 'all' ? 'Semua kondisi' : formatTreeConditionStatus(condition);
}
