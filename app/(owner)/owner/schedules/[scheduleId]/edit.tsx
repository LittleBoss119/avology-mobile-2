import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, Text, View } from 'react-native';

import {
  ManualScheduleForm,
  type ManualScheduleFormValues,
} from '../../../../../src/components/care-schedule-components';
import { Button, Card, EmptyState, ErrorBanner, LoadingState, Screen, TopAppBar } from '../../../../../src/components/ui';
import { colors } from '../../../../../src/constants/theme';
import { useAuth } from '../../../../../src/context/auth-context';
import {
  getCareScheduleDetail,
  getScheduleEditEligibility,
  updateCareSchedule,
} from '../../../../../src/services/careScheduleService';
import { getActiveWorkers } from '../../../../../src/services/memberService';
import { getTrees } from '../../../../../src/services/treeService';
import type {
  CareCategory,
  CareScheduleDetail,
  TargetType,
  Tree,
  WorkerMembership,
} from '../../../../../src/types/domain';

export default function EditCareScheduleScreen() {
  const { currentFarm } = useAuth();
  const { scheduleId } = useLocalSearchParams<{ scheduleId: string }>();
  const [blockedReason, setBlockedReason] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [schedule, setSchedule] = React.useState<CareScheduleDetail | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [trees, setTrees] = React.useState<Tree[]>([]);
  const [values, setValues] = React.useState<ManualScheduleFormValues | null>(null);
  const [workers, setWorkers] = React.useState<WorkerMembership[]>([]);

  const farmId = currentFarm?.farmId;

  React.useEffect(() => {
    let isMounted = true;

    async function loadFormData() {
      const normalizedScheduleId = scheduleId?.trim();

      if (!normalizedScheduleId) {
        setError('Data jadwal tidak ditemukan.');
        setLoading(false);
        return;
      }

      if (!farmId) {
        setError('Data kebun aktif tidak ditemukan.');
        setLoading(false);
        return;
      }

      setError(null);
      setBlockedReason(null);

      const [scheduleResult, eligibilityResult, workersResult, treesResult] = await Promise.all([
        getCareScheduleDetail({ scheduleId: normalizedScheduleId }),
        getScheduleEditEligibility({ scheduleId: normalizedScheduleId }),
        getActiveWorkers(farmId),
        getTrees({
          archived: false,
          farmId,
        }),
      ]);

      if (!isMounted) {
        return;
      }

      if (scheduleResult.error) {
        setError(scheduleResult.error.message);
        setLoading(false);
        return;
      }

      setSchedule(scheduleResult.data);
      setValues(buildInitialValues(scheduleResult.data));

      if (eligibilityResult.error) {
        setBlockedReason(eligibilityResult.error.message);
      } else if (!eligibilityResult.data.canEdit) {
        setBlockedReason(eligibilityResult.data.reason ?? 'Jadwal ini tidak bisa diedit.');
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
  }, [farmId, scheduleId]);

  async function handleSubmit() {
    if (!schedule || !values) {
      setError('Data jadwal tidak ditemukan.');
      return;
    }

    if (blockedReason) {
      setError(blockedReason);
      return;
    }

    const validation = validateValues(values);

    if (validation instanceof Error) {
      setError(validation.message);
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await updateCareSchedule({
      assignedWorkerId: values.assignedWorkerId,
      category: validation.category,
      customTargetNote: values.targetType === 'custom' ? values.customTargetNote : null,
      instruction: values.instruction,
      requiresPhoto: values.requiresPhoto,
      scheduleId: schedule.id,
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
    Alert.alert('Jadwal berhasil diperbarui', '', [
      {
        text: 'OK',
        onPress: () => router.replace(`/owner/schedules/${schedule.id}`),
      },
    ]);
  }

  if (loading) {
    return <LoadingState message="Menyiapkan form edit jadwal..." />;
  }

  if (!schedule || !values) {
    return (
      <Screen>
        <TopAppBar title="Edit jadwal" onBack={() => router.back()} />
        <ErrorBanner message={error} />
        <EmptyState title="Jadwal tidak ditemukan" subtitle="Jadwal mungkin tidak tersedia atau akses ditolak." />
      </Screen>
    );
  }

  if (blockedReason) {
    return (
      <Screen>
        <TopAppBar title="Edit jadwal" onBack={() => router.back()} />
        <ErrorBanner message={error} />
        <Card variant="warning">
          <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
            Jadwal tidak bisa diedit
          </Text>
          <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
            {blockedReason}
          </Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <View style={{ gap: 10 }}>
          <Button title="Simpan perubahan" loading={submitting} onPress={handleSubmit} />
          <Button title="Batal" variant="secondary" disabled={submitting} onPress={() => router.back()} />
        </View>
      }
    >
      <TopAppBar title="Edit jadwal" onBack={() => router.back()} />
      <ErrorBanner message={error} />
      <ManualScheduleForm values={values} trees={trees} workers={workers} onChange={setValues} />
    </Screen>
  );
}

function buildInitialValues(schedule: CareScheduleDetail): ManualScheduleFormValues {
  const assignedWorkerId = schedule.tasks[0]?.assignedTo ?? '';

  return {
    assignedWorkerId,
    category: schedule.category,
    customTargetNote: schedule.customTargetNote ?? '',
    instruction: schedule.instruction ?? '',
    requiresPhoto: schedule.requiresPhoto,
    scheduledDate: schedule.scheduledDate,
    targetColumn: schedule.targetColumn ?? '',
    targetRow: schedule.targetRow ?? '',
    targetTreeId: schedule.targetTreeId ?? '',
    targetType: schedule.targetType,
    title: schedule.title,
  };
}

function validateValues(
  values: ManualScheduleFormValues
): { category: CareCategory; targetType: TargetType } | Error {
  if (!values.title.trim()) {
    return new Error('Judul jadwal wajib diisi.');
  }

  if (!values.category) {
    return new Error('Kategori jadwal wajib dipilih.');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.scheduledDate.trim())) {
    return new Error('Tanggal jadwal harus memakai format YYYY-MM-DD.');
  }

  if (!values.assignedWorkerId.trim()) {
    return new Error('Pilih pekerja aktif.');
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
