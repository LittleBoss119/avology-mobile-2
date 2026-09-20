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
      {/* gestureEnabled:false disengaja, dan ia PASANGAN WAJIB
          useUnsavedChangesGuard di dalam TreeRecordEditScreen — pola yang sama
          dengan layar Edit profil. Swipe-back iOS tidak bisa dicegat lewat API
          publik expo-router, jadi ia dimatikan supaya perubahan yang belum
          disimpan tidak bisa hilang lewat gestur. Back tetap ada di chevron,
          dan chevron itulah yang menanyakan konfirmasinya. */}
      <Stack.Screen options={{ gestureEnabled: false, headerShown: false }} />

      <TreeRecordEditScreen
        basePath="/owner/trees"
        recordId={recordId}
        recordType={recordType}
        treeId={treeId}
      />
    </>
  );
}
