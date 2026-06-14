import { useLocalSearchParams } from 'expo-router';

import { TreeGrowthPhaseRecordScreen } from '../../../../../src/components/tree-growth-phase-record-screen';

export default function OwnerCreateGrowthPhaseRecordScreen() {
  const { treeId } = useLocalSearchParams<{ treeId: string }>();

  return <TreeGrowthPhaseRecordScreen basePath="/owner/trees" treeId={treeId} />;
}
