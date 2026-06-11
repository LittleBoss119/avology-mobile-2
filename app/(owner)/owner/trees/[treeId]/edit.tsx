import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';

import { TreeForm, type TreeFormValues } from '../../../../../src/components/tree-components';
import { Button, ErrorBanner, LoadingState, PageIntro, Screen } from '../../../../../src/components/ui';
import { getTreeDetail, updateTree } from '../../../../../src/services/treeService';

const initialValues: TreeFormValues = {
  treeCode: '',
  rowPosition: '',
  columnPosition: '',
  variety: '',
  plantedAt: '',
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
        setError('Tree ID tidak ditemukan.');
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
        treeCode: result.data.treeCode,
        rowPosition: result.data.rowPosition ?? '',
        columnPosition: result.data.columnPosition ?? '',
        variety: result.data.variety ?? '',
        plantedAt: result.data.plantedAt ?? '',
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
    const treeCode = values.treeCode.trim();

    if (!normalizedTreeId) {
      setError('Tree ID tidak ditemukan.');
      return;
    }

    if (!treeCode) {
      setError('Kode pohon wajib diisi.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await updateTree({
      treeId: normalizedTreeId,
      treeCode,
      rowPosition: values.rowPosition,
      columnPosition: values.columnPosition,
      variety: values.variety,
      plantedAt: values.plantedAt,
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
    return <LoadingState message="Memuat data pohon..." />;
  }

  return (
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
      <PageIntro title="Edit Tree" subtitle="Perbarui identitas dan lokasi pohon." />
      <ErrorBanner message={error} />
      <TreeForm values={values} onChange={setValues} />
    </Screen>
  );
}
