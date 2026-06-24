import { Stack, useLocalSearchParams } from 'expo-router';

import { TreeDetailScreen } from '../../../../src/components/tree-detail-screen';

export default function OwnerTreeDetailScreen() {
  const { treeId } = useLocalSearchParams<{ treeId: string }>();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TreeDetailScreen mode="owner" treeId={treeId} />
    </>
  );
}
