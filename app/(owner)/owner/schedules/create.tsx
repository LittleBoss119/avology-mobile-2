import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import {
  ManualScheduleForm,
  type ManualScheduleFormValues,
} from '../../../../src/components/care-schedule-components';
import { Button, ErrorBanner, LoadingState, Screen, TopAppBar } from '../../../../src/components/ui';
import { useAuth } from '../../../../src/context/auth-context';
import { createManualSchedule } from '../../../../src/services/careScheduleService';
import { getActiveWorkers } from '../../../../src/services/memberService';
import { getTrees } from '../../../../src/services/treeService';
import type { CareCategory, TargetType, Tree, WorkerMembership } from '../../../../src/types/domain';

const initialValues: ManualScheduleFormValues = {
  assignedWorkerId: '',
  category: '',
  customTargetNote: '',
  instruction: '',
  requiresPhoto: false,
  scheduledDate: getTodayIsoDate(),
  targetColumn: '',
  targetRow: '',
  targetTreeId: '',
  targetType: 'farm',
  title: '',
};

export default function CreateManualScheduleScreen() {
  const { currentFarm } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [trees, setTrees] = React.useState<Tree[]>([]);
  const [values, setValues] = React.useState<ManualScheduleFormValues>(initialValues);
  const [workers, setWorkers] = React.useState<WorkerMembership[]>([]);

  const farmId = currentFarm?.farmId;

  React.useEffect(() => {
    let isMounted = true;

    async function loadFormData() {
      if (!farmId) {
        setError('Data kebun aktif tidak ditemukan.');
        setLoading(false);
        return;
      }

      setError(null);

      const [workersResult, treesResult] = await Promise.all([
        getActiveWorkers(farmId),
        getTrees({
          archived: false,
          farmId,
        }),
      ]);

      if (!isMounted) {
        return;
      }

      if (workersResult.error) {
        setError(workersResult.error.message);
        setWorkers([]);
      } else {
        setWorkers(workersResult.data);
      }

      if (treesResult.error) {
        setError(treesResult.error.message);
        setTrees([]);
      } else {
        setTrees(treesResult.data);
      }

      setLoading(false);
    }

    loadFormData();

    return () => {
      isMounted = false;
    };
  }, [farmId]);

  async function handleSubmit() {
    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      return;
    }

    const validation = validateValues(values);

    if (validation instanceof Error) {
      setError(validation.message);
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await createManualSchedule({
      assignedWorkerId: values.assignedWorkerId,
      category: validation.category,
      customTargetNote: values.targetType === 'custom' ? values.customTargetNote : null,
      farmId,
      instruction: values.instruction,
      requiresPhoto: values.requiresPhoto,
      scheduledDate: values.scheduledDate,
      targetColumn: values.targetType === 'column' ? values.targetColumn : null,
      targetRow: values.targetType === 'row' ? values.targetRow : null,
      targetTreeId: values.targetType === 'tree' ? values.targetTreeId : null,
      targetType: values.targetType,
      title: values.title,
    });

    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    router.replace(`/owner/schedules/${result.data.scheduleId}`);
  }

  if (loading) {
    return <LoadingState message="Menyiapkan form jadwal..." />;
  }

  return (
    <Screen
      footer={
        <View style={{ gap: 10 }}>
          <Button title="Simpan Jadwal" loading={submitting} onPress={handleSubmit} />
          <Button title="Batal" variant="secondary" onPress={() => router.back()} />
        </View>
      }
    >
      <TopAppBar title="Buat Jadwal" onBack={() => router.back()} />
      <ErrorBanner message={error} />
      <ManualScheduleForm values={values} trees={trees} workers={workers} onChange={setValues} />
    </Screen>
  );
}

function validateValues(
  values: ManualScheduleFormValues
): { category: CareCategory; targetType: TargetType } | Error {
  if (!values.title.trim()) {
    return new Error('Judul jadwal wajib diisi.');
  }

  if (!values.category) {
    return new Error('Ups, pilih kategori dulu.');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.scheduledDate.trim())) {
    return new Error('Ups, tanggal jadwal belum dipilih.');
  }

  if (!values.assignedWorkerId.trim()) {
    return new Error('Ups, pilih worker dulu.');
  }

  if (values.targetType === 'row' && !values.targetRow.trim()) {
    return new Error('Baris target wajib diisi.');
  }

  if (values.targetType === 'column' && !values.targetColumn.trim()) {
    return new Error('Kolom target wajib diisi.');
  }

  if (values.targetType === 'tree' && !values.targetTreeId.trim()) {
    return new Error('Pohon target wajib dipilih.');
  }

  if (values.targetType === 'custom' && !values.customTargetNote.trim()) {
    return new Error('Catatan target khusus wajib diisi.');
  }

  return {
    category: values.category,
    targetType: values.targetType,
  };
}

function getTodayIsoDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
