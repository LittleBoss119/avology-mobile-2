import { useLocalSearchParams } from 'expo-router';

import { TreeCareActivityScreen } from '../../../../../src/components/tree-care-activity-screen';

export default function OwnerCreateCareActivityScreen() {
  const { treeId } = useLocalSearchParams<{ treeId: string }>();

  return <TreeCareActivityScreen basePath="/owner/trees" treeId={treeId} />;
}
