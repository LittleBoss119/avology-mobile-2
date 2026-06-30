import { useLocalSearchParams } from 'expo-router';

import { TreeHarvestRecordScreen } from '../../../../../src/components/tree-harvest-record-screen';

export default function WorkerCreateHarvestRecordScreen() {
  const { treeId } = useLocalSearchParams<{ treeId: string }>();

  return <TreeHarvestRecordScreen basePath="/worker/trees" treeId={treeId} />;
}
