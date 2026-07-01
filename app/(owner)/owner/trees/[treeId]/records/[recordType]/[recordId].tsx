import { Stack, useLocalSearchParams } from 'expo-router';

import { TreeRecordDetailScreen } from '../../../../../../../src/components/tree-record-detail-screen';

export default function OwnerTreeRecordDetailRoute() {
  const { recordId, recordType, treeId } = useLocalSearchParams<{
    recordId: string;
    recordType: string;
    treeId: string;
  }>();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TreeRecordDetailScreen
        basePath="/owner/trees"
        recordId={recordId}
        recordType={recordType}
        treeId={treeId}
      />
    </>
  );
}
