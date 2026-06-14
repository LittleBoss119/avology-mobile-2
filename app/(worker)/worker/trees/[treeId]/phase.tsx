import { useLocalSearchParams } from 'expo-router';

import { TreeGrowthPhaseRecordScreen } from '../../../../../src/components/tree-growth-phase-record-screen';

export default function WorkerCreateGrowthPhaseRecordScreen() {
  const { treeId } = useLocalSearchParams<{ treeId: string }>();

  return <TreeGrowthPhaseRecordScreen basePath="/worker/trees" treeId={treeId} />;
}
