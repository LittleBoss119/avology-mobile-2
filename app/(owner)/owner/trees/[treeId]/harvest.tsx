import { useLocalSearchParams } from 'expo-router';

import { TreeHarvestRecordScreen } from '../../../../../src/components/tree-harvest-record-screen';

export default function OwnerCreateHarvestRecordScreen() {
  const { treeId } = useLocalSearchParams<{ treeId: string }>();

  return <TreeHarvestRecordScreen basePath="/owner/trees" treeId={treeId} />;
}
