import { router, Stack } from 'expo-router';
import React from 'react';

import {
  formatDateForDb,
  TreeForm,
  type TreeFormValues,
} from '../../../../src/components/tree-components';
import { Button, ErrorBanner, Screen, TopAppBar } from '../../../../src/components/ui';
import { useAuth } from '../../../../src/context/auth-context';
import { createTree } from '../../../../src/services/treeService';

const initialValues: TreeFormValues = {
  rowPosition: '',
  columnPosition: '',
  variety: '',
  plantedAt: null,
};

export default function OwnerCreateTreeScreen() {
  const { currentFarm } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [values, setValues] = React.useState<TreeFormValues>(initialValues);

  async function handleSubmit() {
    if (!values.rowPosition.trim() || !values.columnPosition.trim()) {
      setError('Baris dan kolom wajib diisi untuk membuat kode pohon.');
      return;
    }

    if (!currentFarm?.farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await createTree({
      farmId: currentFarm.farmId,
      rowPosition: values.rowPosition,
      columnPosition: values.columnPosition,
      variety: values.variety,
      plantedAt: formatDateForDb(values.plantedAt),
    });

    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    router.replace('/owner/trees');
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        footer={
          <>
            <Button title="Simpan Pohon" loading={submitting} onPress={handleSubmit} />
            <Button
              title="Batal"
              variant="secondary"
              disabled={submitting}
              onPress={() => router.replace('/owner/trees')}
            />
          </>
        }
      >
        <TopAppBar title="Tambah Pohon" onBack={() => router.back()} />
        <ErrorBanner message={error} />
        <TreeForm values={values} onChange={setValues} />
      </Screen>
    </>
  );
}
