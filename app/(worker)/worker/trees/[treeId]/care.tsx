import { useLocalSearchParams } from 'expo-router';

import { TreeManualCareRecordScreen } from '../../../../../src/components/tree-manual-care-record-screen';

export default function WorkerCreateManualCareRecordScreen() {
  const { treeId } = useLocalSearchParams<{ treeId: string }>();

  return <TreeManualCareRecordScreen basePath="/worker/trees" treeId={treeId} />;
}
