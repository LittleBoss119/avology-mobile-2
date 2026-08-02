import { router } from 'expo-router';
import React from 'react';
import { ScrollView, View, type LayoutChangeEvent } from 'react-native';

import {
  ManualScheduleForm,
  clearResolvedScheduleFormErrors,
  hasScheduleFormErrors,
  scheduleFormFieldOrder,
  validateScheduleForm,
  type ManualScheduleFormValues,
  type ScheduleFormErrors,
} from '../../../../src/components/care-schedule-components';
import { Button, ErrorBanner, LoadingState, Screen, TopAppBar } from '../../../../src/components/ui';
import { useAuth } from '../../../../src/context/auth-context';
import { createManualSchedule } from '../../../../src/services/careScheduleService';
import { getActiveWorkers } from '../../../../src/services/memberService';
import { getTrees } from '../../../../src/services/treeService';
import type { CareCategory, Tree, WorkerMembership } from '../../../../src/types/domain';

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
  const [errors, setErrors] = React.useState<ScheduleFormErrors>({});
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [trees, setTrees] = React.useState<Tree[]>([]);
  const [values, setValues] = React.useState<ManualScheduleFormValues>(initialValues);
  const [workers, setWorkers] = React.useState<WorkerMembership[]>([]);

  const scrollRef = React.useRef<ScrollView>(null);
  const formTop = React.useRef(0);
  const fieldOffsets = React.useRef<Record<string, number>>({});

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

  function handleValuesChange(next: ManualScheduleFormValues) {
    setValues(next);
    setErrors((prev) => clearResolvedScheduleFormErrors(prev, next));
  }

  function scrollToFirstError(nextErrors: ScheduleFormErrors) {
    const firstKey = scheduleFormFieldOrder.find((key) => nextErrors[key]);

    if (!firstKey) {
      return;
    }

    const y = Math.max(0, formTop.current + (fieldOffsets.current[firstKey] ?? 0) - 12);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y, animated: true }));
  }

  async function handleSubmit() {
    const nextErrors = validateScheduleForm(values);

    if (hasScheduleFormErrors(nextErrors)) {
      setErrors(nextErrors);
      scrollToFirstError(nextErrors);
      return;
    }

    setErrors({});

    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await createManualSchedule({
      assignedWorkerId: values.assignedWorkerId,
      // Aman: validateScheduleForm memastikan kategori sudah dipilih.
      category: values.category as CareCategory,
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
      header={<TopAppBar title="Buat Jadwal" onBack={() => router.back()} />}
      scrollRef={scrollRef}
      stickyFooter={<Button title="Simpan jadwal" loading={submitting} onPress={handleSubmit} />}
    >
      <ErrorBanner message={error} />
      <View onLayout={(event: LayoutChangeEvent) => (formTop.current = event.nativeEvent.layout.y)}>
        <ManualScheduleForm
          errors={errors}
          onChange={handleValuesChange}
          onFieldLayout={(key, y) => {
            fieldOffsets.current[key] = y;
          }}
          trees={trees}
          values={values}
          workers={workers}
        />
      </View>
    </Screen>
  );
}

function getTodayIsoDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
