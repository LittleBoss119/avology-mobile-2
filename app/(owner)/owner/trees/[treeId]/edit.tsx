import { router, Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';

import {
  formatDateForDb,
  parseDbDate,
  TreeForm,
  type TreeFormValues,
} from '../../../../../src/components/tree-components';
import { Button, ErrorBanner, LoadingState, Screen, TopAppBar } from '../../../../../src/components/ui';
import { getTreeDetail, updateTree } from '../../../../../src/services/treeService';

const initialValues: TreeFormValues = {
  rowPosition: '',
  columnPosition: '',
  variety: '',
  plantedAt: null,
};

export default function OwnerEditTreeScreen() {
  const { treeId } = useLocalSearchParams<{ treeId: string }>();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [values, setValues] = React.useState<TreeFormValues>(initialValues);

  React.useEffect(() => {
    let isMounted = true;

    async function loadTree() {
      if (!treeId) {
        setError('Data pohon tidak ditemukan.');
        setLoading(false);
        return;
      }

      setError(null);
      const result = await getTreeDetail({ treeId });

      if (!isMounted) {
        return;
      }

      if (result.error) {
        setError(result.error.message);
        setLoading(false);
        return;
      }

      setValues({
        rowPosition: result.data.rowPosition ?? '',
        columnPosition: result.data.columnPosition ?? '',
        variety: result.data.variety ?? '',
        plantedAt: parseDbDate(result.data.plantedAt),
      });
      setLoading(false);
    }

    loadTree();

    return () => {
      isMounted = false;
    };
  }, [treeId]);

  async function handleSubmit() {
    const normalizedTreeId = treeId?.trim();

    if (!normalizedTreeId) {
      setError('Data pohon tidak ditemukan.');
      return;
    }

    if (!values.rowPosition.trim() || !values.columnPosition.trim()) {
      setError('Baris dan kolom wajib diisi untuk membuat kode pohon.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await updateTree({
      treeId: normalizedTreeId,
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
    router.replace(`/owner/trees/${normalizedTreeId}`);
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <LoadingState message="Memuat data pohon..." />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        footer={
          <>
            <Button title="Simpan Perubahan" loading={submitting} onPress={handleSubmit} />
            <Button
              title="Batal"
              variant="secondary"
              disabled={submitting}
              onPress={() => router.back()}
            />
          </>
        }
      >
        <TopAppBar title="Edit Pohon" onBack={() => router.back()} />
        <ErrorBanner message={error} />
        <TreeForm values={values} onChange={setValues} />
      </Screen>
    </>
  );
}
