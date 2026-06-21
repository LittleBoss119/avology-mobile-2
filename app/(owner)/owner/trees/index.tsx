import { router } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { TreeCard } from '../../../../src/components/tree-components';
import {
  Button,
  EmptyState,
  ErrorBanner,
  Field,
  LoadingState,
  PageIntro,
  Screen,
} from '../../../../src/components/ui';
import { useAuth } from '../../../../src/context/auth-context';
import { getTrees } from '../../../../src/services/treeService';
import type { Tree } from '../../../../src/types/domain';

export default function OwnerTreeListScreen() {
  const { currentFarm } = useAuth();
  const [archived, setArchived] = React.useState(false);
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
      archived,
      farmId,
      search,
    });

    if (result.error) {
      setError(result.error.message);
      setTrees([]);
      return;
    }

    setTrees(result.data);
  }, [archived, farmId, search]);

  React.useEffect(() => {
    loadTrees().finally(() => setLoading(false));
  }, [loadTrees]);

  if (loading) {
    return <LoadingState message="Memuat pohon..." />;
  }

  return (
    <Screen
      footer={
        <>
          <Button title="Tambah Pohon" onPress={() => router.push('/owner/trees/create')} />
        </>
      }
    >
      <PageIntro title="Pohon" subtitle="Kelola data pohon aktif dan pohon yang sudah diarsipkan." />
      <ErrorBanner message={error} />
      <Field
        label="Cari pohon"
        onChangeText={setSearch}
        placeholder="Kode pohon atau varietas"
        value={search}
      />
      <TreeArchiveFilter archived={archived} onChange={setArchived} />

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
        <View style={{ gap: 12 }}>
          {trees.map((tree) => (
            <TreeCard
              key={tree.id}
              tree={tree}
              onPress={() => router.push(`/owner/trees/${tree.id}`)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function TreeArchiveFilter({
  archived,
  onChange,
}: {
  archived: boolean;
  onChange: (archived: boolean) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text selectable style={{ color: '#1E2A24', fontSize: 14, fontWeight: '600' }}>
        Status pohon
      </Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button
            title="Aktif"
            variant={archived ? 'secondary' : 'primary'}
            onPress={() => onChange(false)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Diarsipkan"
            variant={archived ? 'primary' : 'secondary'}
            onPress={() => onChange(true)}
          />
        </View>
      </View>
    </View>
  );
}
