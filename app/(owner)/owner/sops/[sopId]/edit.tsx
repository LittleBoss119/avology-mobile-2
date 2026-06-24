import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';

import {
  CareSOPForm,
  type CareSOPFormValues,
} from '../../../../../src/components/care-sop-components';
import { Button, ErrorBanner, LoadingState, Screen, TopAppBar } from '../../../../../src/components/ui';
import { getCareSOPDetail, updateCareSOP } from '../../../../../src/services/careSopService';
import { getTrees } from '../../../../../src/services/treeService';
import type { CareCategory, Tree } from '../../../../../src/types/domain';

const initialValues: CareSOPFormValues = {
  category: '',
  defaultInstruction: '',
  defaultTargetColumn: '',
  defaultTargetRow: '',
  defaultTargetTreeId: '',
  defaultTargetType: 'farm',
  intervalDays: '',
  name: '',
};

export default function EditCareSOPScreen() {
  const { sopId } = useLocalSearchParams<{ sopId: string }>();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [trees, setTrees] = React.useState<Tree[]>([]);
  const [values, setValues] = React.useState<CareSOPFormValues>(initialValues);

  React.useEffect(() => {
    let isMounted = true;

    async function loadSop() {
      const normalizedSopId = sopId?.trim();

      if (!normalizedSopId) {
        setError('Data SOP tidak ditemukan.');
        setLoading(false);
        return;
      }

      setError(null);

      const sopResult = await getCareSOPDetail({ sopId: normalizedSopId });

      if (!isMounted) {
        return;
      }

      if (sopResult.error) {
        setError(sopResult.error.message);
        setLoading(false);
        return;
      }

      setValues({
        category: sopResult.data.category,
        defaultInstruction: sopResult.data.defaultInstruction ?? '',
        defaultTargetColumn: sopResult.data.defaultTargetColumn ?? '',
        defaultTargetRow: sopResult.data.defaultTargetRow ?? '',
        defaultTargetTreeId: sopResult.data.defaultTargetTreeId ?? '',
        defaultTargetType: sopResult.data.defaultTargetType,
        intervalDays: sopResult.data.intervalDays ? String(sopResult.data.intervalDays) : '',
        name: sopResult.data.name,
      });

      const treesResult = await getTrees({
        archived: false,
        farmId: sopResult.data.farmId,
      });

      if (!isMounted) {
        return;
      }

      if (treesResult.error) {
        setError(treesResult.error.message);
        setTrees([]);
      } else {
        setTrees(treesResult.data);
      }

      setLoading(false);
    }

    loadSop();

    return () => {
      isMounted = false;
    };
  }, [sopId]);

  async function handleSubmit() {
    const normalizedSopId = sopId?.trim();

    if (!normalizedSopId) {
      setError('Data SOP tidak ditemukan.');
      return;
    }

    const validation = validateFormValues(values);

    if (validation instanceof Error) {
      setError(validation.message);
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await updateCareSOP({
      category: validation.category,
      defaultInstruction: values.defaultInstruction,
      defaultTargetColumn: values.defaultTargetType === 'column' ? values.defaultTargetColumn : null,
      defaultTargetRow: values.defaultTargetType === 'row' ? values.defaultTargetRow : null,
      defaultTargetTreeId: values.defaultTargetType === 'tree' ? values.defaultTargetTreeId : null,
      defaultTargetType: values.defaultTargetType,
      intervalDays: validation.intervalDays,
      name: values.name,
      sopId: normalizedSopId,
    });

    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    router.replace(`/owner/sops/${normalizedSopId}`);
  }

  if (loading) {
    return <LoadingState message="Memuat data SOP..." />;
  }

  return (
    <Screen
      footer={
        <Button title="Simpan Perubahan" loading={submitting} onPress={handleSubmit} />
      }
    >
      <TopAppBar title="Edit SOP" onBack={() => router.back()} />
      <ErrorBanner message={error} />
      <CareSOPForm values={values} trees={trees} onChange={setValues} />
    </Screen>
  );
}

function validateFormValues(
  values: CareSOPFormValues
): { category: CareCategory; intervalDays: number | null } | Error {
  if (!values.name.trim()) {
    return new Error('Nama SOP wajib diisi.');
  }

  if (!values.category) {
    return new Error('Kategori SOP wajib dipilih.');
  }

  const intervalDays = parseIntervalDays(values.intervalDays);

  if (intervalDays instanceof Error) {
    return intervalDays;
  }

  if (values.defaultTargetType === 'row' && !values.defaultTargetRow.trim()) {
    return new Error('Baris target wajib diisi.');
  }

  if (values.defaultTargetType === 'column' && !values.defaultTargetColumn.trim()) {
    return new Error('Kolom target wajib diisi.');
  }

  if (values.defaultTargetType === 'tree' && !values.defaultTargetTreeId.trim()) {
    return new Error('Pohon target wajib dipilih.');
  }

  return {
    category: values.category,
    intervalDays,
  };
}

function parseIntervalDays(value: string): number | null | Error {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return new Error('Interval perawatan harus berupa angka bulat lebih dari 0 hari.');
  }

  return parsed;
}
