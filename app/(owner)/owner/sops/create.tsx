import { router } from 'expo-router';
import React from 'react';

import {
  CareSOPForm,
  type CareSOPFormValues,
} from '../../../../src/components/care-sop-components';
import { Button, ErrorBanner, LoadingState, PageIntro, Screen } from '../../../../src/components/ui';
import { useAuth } from '../../../../src/context/auth-context';
import { createCareSOP } from '../../../../src/services/careSopService';
import { getTrees } from '../../../../src/services/treeService';
import type { CareCategory, Tree } from '../../../../src/types/domain';

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

export default function CreateCareSOPScreen() {
  const { currentFarm } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [trees, setTrees] = React.useState<Tree[]>([]);
  const [values, setValues] = React.useState<CareSOPFormValues>(initialValues);

  const farmId = currentFarm?.farmId;

  React.useEffect(() => {
    let isMounted = true;

    async function loadTrees() {
      if (!farmId) {
        setError('Data kebun aktif tidak ditemukan.');
        setLoading(false);
        return;
      }

      setError(null);

      const result = await getTrees({
        archived: false,
        farmId,
      });

      if (!isMounted) {
        return;
      }

      if (result.error) {
        setError(result.error.message);
        setTrees([]);
      } else {
        setTrees(result.data);
      }

      setLoading(false);
    }

    loadTrees();

    return () => {
      isMounted = false;
    };
  }, [farmId]);

  async function handleSubmit() {
    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      return;
    }

    const validation = validateFormValues(values);

    if (validation instanceof Error) {
      setError(validation.message);
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await createCareSOP({
      category: validation.category,
      defaultInstruction: values.defaultInstruction,
      defaultTargetColumn: values.defaultTargetType === 'column' ? values.defaultTargetColumn : null,
      defaultTargetRow: values.defaultTargetType === 'row' ? values.defaultTargetRow : null,
      defaultTargetTreeId: values.defaultTargetType === 'tree' ? values.defaultTargetTreeId : null,
      defaultTargetType: values.defaultTargetType,
      farmId,
      intervalDays: validation.intervalDays,
      name: values.name,
    });

    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    router.replace('/owner/sops');
  }

  if (loading) {
    return <LoadingState message="Menyiapkan form SOP..." />;
  }

  return (
    <Screen
      footer={
        <>
          <Button title="Simpan SOP" loading={submitting} onPress={handleSubmit} />
          <Button title="Batal" variant="secondary" disabled={submitting} onPress={() => router.back()} />
        </>
      }
    >
      <PageIntro title="Tambah SOP" subtitle="Buat template perawatan untuk dipakai saat membuat jadwal." />
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
