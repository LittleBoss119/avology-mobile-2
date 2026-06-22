import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { TreeCard } from '../../../../src/components/tree-components';
import { EmptyState, ErrorBanner, Field, LoadingState, PageIntro, Screen } from '../../../../src/components/ui';
import { useAuth } from '../../../../src/context/auth-context';
import { getTrees } from '../../../../src/services/treeService';
import type { Tree } from '../../../../src/types/domain';

export default function WorkerTreeListScreen() {
  const { currentFarm } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
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
      archived: false,
      farmId,
      search,
    });

    if (result.error) {
      setError(result.error.message);
      setTrees([]);
      return;
    }

    setTrees(result.data);
  }, [farmId, search]);

  React.useEffect(() => {
    loadTrees().finally(() => setLoading(false));
  }, [loadTrees]);

  if (loading) {
    return <LoadingState message="Memuat pohon..." />;
  }

  return (
    <Screen>
      <PageIntro title="Pohon" subtitle="Lihat pohon aktif dan buka detail untuk laporan kondisi." />
      <ErrorBanner message={error} />
      <Field
        label="Cari pohon"
        onChangeText={setSearch}
        placeholder="Baris, kolom, atau varietas"
        value={search}
      />

      {trees.length === 0 ? (
        <EmptyState title="Belum ada pohon aktif" subtitle="Pohon aktif dari kebun akan muncul di sini." />
      ) : (
        <View style={{ gap: 12 }}>
          {trees.map((tree) => (
            <TreeCard
              key={tree.id}
              tree={tree}
              onPress={() => router.push(`/worker/trees/${tree.id}`)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
