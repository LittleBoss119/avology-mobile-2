import { useLocalSearchParams } from 'expo-router';

import { TreeCareActivityScreen } from '../../../../../src/components/tree-care-activity-screen';

export default function WorkerCreateCareActivityScreen() {
  const { treeId } = useLocalSearchParams<{ treeId: string }>();

  return <TreeCareActivityScreen basePath="/worker/trees" treeId={treeId} />;
}
