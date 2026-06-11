import { useLocalSearchParams } from 'expo-router';

import { TreeDetailScreen } from '../../../../src/components/tree-detail-screen';

export default function WorkerTreeDetailScreen() {
  const { treeId } = useLocalSearchParams<{ treeId: string }>();

  return <TreeDetailScreen mode="worker" treeId={treeId} />;
}
