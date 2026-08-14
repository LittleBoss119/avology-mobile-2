import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, Text, View, type LayoutChangeEvent } from 'react-native';

import {
  ManualScheduleForm,
  clearResolvedScheduleFormErrors,
  hasScheduleFormErrors,
  scheduleFormFieldOrder,
  validateScheduleForm,
  type ManualScheduleFormValues,
  type ScheduleFormErrors,
} from '../../../../../src/components/care-schedule-components';
import { Icon } from '../../../../../src/components/icons';
import { Button, Card, EmptyState, ErrorBanner, LoadingState, Screen, TopAppBar } from '../../../../../src/components/ui';
import { colors, radius, spacing } from '../../../../../src/constants/theme';
import { useAuth } from '../../../../../src/context/auth-context';
import { setPendingFeedback } from '../../../../../src/lib/pendingFeedback';
import {
  getCareScheduleDetail,
  getScheduleEditEligibility,
  updateCareSchedule,
} from '../../../../../src/services/careScheduleService';
import { getActiveWorkers } from '../../../../../src/services/memberService';
import { getTrees } from '../../../../../src/services/treeService';
import type { CareCategory, CareScheduleDetail, Tree, WorkerMembership } from '../../../../../src/types/domain';

export default function EditCareScheduleScreen() {
  const { currentFarm } = useAuth();
  const { scheduleId } = useLocalSearchParams<{ scheduleId: string }>();
  const [blockedReason, setBlockedReason] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<ScheduleFormErrors>({});
  const [loading, setLoading] = React.useState(true);
  const [schedule, setSchedule] = React.useState<CareScheduleDetail | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [trees, setTrees] = React.useState<Tree[]>([]);
  const [values, setValues] = React.useState<ManualScheduleFormValues | null>(null);
  const [workers, setWorkers] = React.useState<WorkerMembership[]>([]);

  const scrollRef = React.useRef<ScrollView>(null);
  const formTop = React.useRef(0);
  const fieldOffsets = React.useRef<Record<string, number>>({});

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
    if (!schedule || !values) {
      setError('Data jadwal tidak ditemukan.');
      return;
    }

    if (blockedReason) {
      setError(blockedReason);
      return;
    }

    const nextErrors = validateScheduleForm(values);

    if (hasScheduleFormErrors(nextErrors)) {
      setErrors(nextErrors);
      scrollToFirstError(nextErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    setError(null);

    const result = await updateCareSchedule({
      assignedWorkerId: values.assignedWorkerId,
      // Aman: validateScheduleForm memastikan kategori sudah dipilih.
      category: values.category as CareCategory,
      customTargetNote: values.targetType === 'custom' ? values.customTargetNote : null,
      instruction: values.instruction,
      requiresPhoto: values.requiresPhoto,
      scheduleId: schedule.id,
      scheduledDate: values.scheduledDate,
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
    // Konfirmasi ditampilkan sebagai SuccessBanner di detail jadwal saat fokus,
    // mengikuti pola record.tsx → detail tugas worker. router.back() menjaga
    // back-stack tetap bersih (list → detail).
    setPendingFeedback('schedule_updated');
    router.back();
  }

  if (loading) {
    return <LoadingState message="Menyiapkan form edit jadwal..." />;
  }

  if (!schedule || !values) {
    return (
      <Screen header={<TopAppBar title="Edit jadwal" onBack={() => router.back()} />}>
        <ErrorBanner message={error} />
        <EmptyState title="Jadwal tidak ditemukan" subtitle="Jadwal mungkin tidak tersedia atau akses ditolak." />
      </Screen>
    );
  }

  if (blockedReason) {
    return (
      <Screen header={<TopAppBar title="Edit jadwal" onBack={() => router.back()} />}>
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
      header={<TopAppBar title="Edit jadwal" onBack={() => router.back()} />}
      scrollRef={scrollRef}
      stickyFooter={<Button title="Simpan perubahan" loading={submitting} onPress={handleSubmit} />}
    >
      <ErrorBanner message={error} />
      <RepeatStatusNotice repeatEveryDays={schedule.repeatEveryDays} />
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

// Read-only. Layar ini TIDAK menyediakan cara mengubah atau menghentikan
// pengulangan: updateCareSchedule tidak menulis repeat_every_days, jadi kontrol
// apa pun di sini akan berbohong. Menghentikan rantai jalurnya
// stopScheduleRepeat dari layar detail jadwal.
function RepeatStatusNotice({ repeatEveryDays }: { repeatEveryDays: number | null }) {
  if (repeatEveryDays === null) {
    return null;
  }

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: colors.primarySoft,
        borderColor: colors.primaryBorder,
        borderCurve: 'continuous',
        borderRadius: radius.lg,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
      }}
    >
      <Icon name="calendar" size={18} color={colors.primary} />
      <Text selectable style={{ color: colors.text, flex: 1, fontSize: 14, fontWeight: '700' }}>
        {`Berulang tiap ${repeatEveryDays} hari`}
      </Text>
    </View>
  );
}

function buildInitialValues(schedule: CareScheduleDetail): ManualScheduleFormValues {
  const assignedWorkerId = schedule.tasks[0]?.assignedTo ?? '';

  return {
    assignedWorkerId,
    category: schedule.category,
    customTargetNote: schedule.customTargetNote ?? '',
    instruction: schedule.instruction ?? '',
    // Selalu mati di layar Edit: updateCareSchedule tidak menulis
    // repeat_every_days, jadi form tidak boleh berpura-pura bisa mengubahnya.
    // Status rantainya ditampilkan read-only lewat RepeatStatusNotice.
    repeatEnabled: false,
    repeatEveryDays: '',
    requiresPhoto: schedule.requiresPhoto,
    scheduledDate: schedule.scheduledDate,
    targetTreeId: schedule.targetTreeId ?? '',
    targetType: schedule.targetType,
    title: schedule.title,
  };
}
