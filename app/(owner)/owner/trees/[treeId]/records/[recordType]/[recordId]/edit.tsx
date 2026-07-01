import { Stack, useLocalSearchParams } from 'expo-router';

import { TreeRecordEditScreen } from '../../../../../../../../src/components/tree-record-edit-screen';

export default function OwnerTreeRecordEditRoute() {
  const { recordId, recordType, treeId } = useLocalSearchParams<{
    recordId: string;
    recordType: string;
    treeId: string;
  }>();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TreeRecordEditScreen
        basePath="/owner/trees"
        recordId={recordId}
        recordType={recordType}
        treeId={treeId}
      />
    </>
  );
}
