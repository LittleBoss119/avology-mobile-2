import { useLocalSearchParams } from 'expo-router';

import { TreeManualCareRecordScreen } from '../../../../../src/components/tree-manual-care-record-screen';

export default function OwnerCreateManualCareRecordScreen() {
  const { treeId } = useLocalSearchParams<{ treeId: string }>();

  return <TreeManualCareRecordScreen basePath="/owner/trees" treeId={treeId} />;
}
