import { useLocalSearchParams } from 'expo-router';

import { TreeDetailScreen } from '../../../../src/components/tree-detail-screen';

export default function OwnerTreeDetailScreen() {
  const { treeId } = useLocalSearchParams<{ treeId: string }>();

  return <TreeDetailScreen mode="owner" treeId={treeId} />;
}
