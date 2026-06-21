import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { useAuth } from '../context/auth-context';
import { getFloweringAndFruitingTrees } from '../services/growthPhaseService';
import type { GrowthPhase, Tree } from '../types/domain';
import { formatGrowthPhase, formatTreeLocation } from '../utils/treeFormat';
import { GrowthPhaseBadge } from './tree-components';
import { Button, Card, EmptyState, ErrorBanner, LoadingState, MetaRow, PageIntro, Screen } from './ui';

export function OwnerGrowthMonitoringScreen() {
  const { currentFarm } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [trees, setTrees] = React.useState<Tree[]>([]);

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
    return <LoadingState message="Memuat monitoring fase..." />;
  }

  const floweringTrees = trees.filter((tree) => tree.currentGrowthPhase === 'flowering');
  const fruitingTrees = trees.filter((tree) => tree.currentGrowthPhase === 'fruiting');

  return (
    <Screen>
      <PageIntro
        title="Monitoring Fase"
        subtitle="Pantau pohon yang sedang berbunga dan berbuah berdasarkan fase terbaru."
      />
      <ErrorBanner message={error} />

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <SummaryCard count={floweringTrees.length} label="Pohon Berbunga" />
        </View>
        <View style={{ flex: 1 }}>
          <SummaryCard count={fruitingTrees.length} label="Pohon Berbuah" />
        </View>
      </View>

      <TreePhaseSection
        emptySubtitle="Pohon dengan fase Berbunga akan muncul di sini setelah dicatat dari detail pohon."
        emptyTitle="Belum ada pohon berbunga"
        phase="flowering"
        title="Pohon Berbunga"
        trees={floweringTrees}
      />

      <TreePhaseSection
        emptySubtitle="Pohon dengan fase Berbuah akan muncul di sini setelah dicatat dari detail pohon."
        emptyTitle="Belum ada pohon berbuah"
        phase="fruiting"
        title="Pohon Berbuah"
        trees={fruitingTrees}
      />
    </Screen>
  );
}

function SummaryCard({ count, label }: { count: number; label: string }) {
  return (
    <Card>
      <Text selectable style={{ color: '#68746D', fontSize: 13, fontWeight: '600' }}>
        {label}
      </Text>
      <Text
        selectable
        style={{ color: '#1E2A24', fontSize: 30, fontVariant: ['tabular-nums'], fontWeight: '700' }}
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
  trees: Tree[];
}) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'space-between' }}>
        <Text selectable style={{ color: '#1E2A24', flex: 1, fontSize: 20, fontWeight: '700' }}>
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

function MonitoringTreeCard({ tree }: { tree: Tree }) {
  return (
    <Card>
      <Text selectable style={{ color: '#1E2A24', fontSize: 18, fontWeight: '700' }}>
        {tree.treeCode}
      </Text>
      <MetaRow label="Lokasi" value={formatTreeLocation(tree)} />
      {tree.variety ? <MetaRow label="Varietas" value={tree.variety} /> : null}
      {tree.currentGrowthPhase ? (
        <MetaRow label="Fase saat ini" value={formatGrowthPhase(tree.currentGrowthPhase)} />
      ) : null}
      <Button title="Buka Detail" variant="secondary" onPress={() => router.push(`/owner/trees/${tree.id}`)} />
    </Card>
  );
}
