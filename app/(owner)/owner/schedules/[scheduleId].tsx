import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { formatCareTarget } from '../../../../src/components/care-schedule-components';
import { formatCareCategory } from '../../../../src/components/care-sop-components';
import { TaskProofPhotoPreview } from '../../../../src/components/task-proof-photo';
import {
  Badge,
  Button,
  CameraGlyph,
  Card,
  CompactMetaItem,
  EmptyState,
  ErrorBanner,
  LoadingState,
  MetaRow,
  Screen,
  SectionHeader,
  TopAppBar,
} from '../../../../src/components/ui';
import { colors, spacing, typography } from '../../../../src/constants/theme';
import { useAuth } from '../../../../src/context/auth-context';
import { cancelCareSchedule, getCareScheduleDetail } from '../../../../src/services/careScheduleService';
import { getTaskDetail } from '../../../../src/services/careTaskService';
import { getFarmMemberBasicProfiles } from '../../../../src/services/memberService';
import { listTaskProofPhotosForActivities } from '../../../../src/services/photoAttachmentService';
import type {
  ActivityStatus,
  CareActivity,
  CareScheduleDetail,
  CareTask,
  CareTaskDetail,
  FarmMemberBasicProfile,
  TaskStatus,
} from '../../../../src/types/domain';
import type { TaskProofPhotoMap } from '../../../../src/types/media';

export default function CareScheduleDetailScreen() {
  const { currentFarm } = useAuth();
  const { scheduleId } = useLocalSearchParams<{ scheduleId: string }>();
  const [error, setError] = React.useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [proofPhotoMap, setProofPhotoMap] = React.useState<TaskProofPhotoMap>({});
  const [schedule, setSchedule] = React.useState<CareScheduleDetail | null>(null);
  const [taskDetailMap, setTaskDetailMap] = React.useState<Record<string, CareTaskDetail>>({});
  const [workerNames, setWorkerNames] = React.useState<Record<string, string>>({});

  const farmId = currentFarm?.farmId;

  const loadDetail = React.useCallback(async () => {
    const normalizedScheduleId = scheduleId?.trim();

    if (!normalizedScheduleId) {
      setError('Data jadwal tidak ditemukan.');
      setProofPhotoMap({});
      setSchedule(null);
      setTaskDetailMap({});
      setWorkerNames({});
      return;
    }

    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setProofPhotoMap({});
      setSchedule(null);
      setTaskDetailMap({});
      setWorkerNames({});
      return;
    }

    setError(null);

    const [scheduleResult, workersResult] = await Promise.all([
      getCareScheduleDetail({ scheduleId: normalizedScheduleId }),
      getFarmMemberBasicProfiles(farmId),
    ]);

    if (scheduleResult.error) {
      setError(scheduleResult.error.message);
      setProofPhotoMap({});
      setSchedule(null);
      setTaskDetailMap({});
    } else {
      setSchedule(scheduleResult.data);
      await loadTaskRealizationSummaries(scheduleResult.data);
    }

    if (workersResult.error) {
      setWorkerNames({});
    } else {
      setWorkerNames(
        Object.fromEntries(
          workersResult.data.map((worker: FarmMemberBasicProfile) => [worker.userId, worker.fullName])
        )
      );
    }
  }, [farmId, scheduleId]);

  async function loadTaskRealizationSummaries(scheduleDetail: CareScheduleDetail) {
    if (scheduleDetail.tasks.length === 0) {
      setProofPhotoMap({});
      setTaskDetailMap({});
      return;
    }

    const taskResults = await Promise.all(
      scheduleDetail.tasks.map((task) => getTaskDetail({ taskId: task.id }))
    );
    const taskDetails = taskResults
      .map((result) => result.data)
      .filter((taskDetail): taskDetail is CareTaskDetail => Boolean(taskDetail));
    const activityIds = taskDetails.flatMap((taskDetail) =>
      taskDetail.activities.map((activity) => activity.id)
    );

    setTaskDetailMap(Object.fromEntries(taskDetails.map((taskDetail) => [taskDetail.id, taskDetail])));

    if (activityIds.length === 0) {
      setProofPhotoMap({});
      return;
    }

    const proofResult = await listTaskProofPhotosForActivities({
      activityIds,
      farmId: scheduleDetail.farmId,
    });

    setProofPhotoMap(proofResult.data ?? {});
  }

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadDetail().finally(() => setLoading(false));
    }, [loadDetail])
  );

  if (loading) {
    return <LoadingState message="Memuat detail jadwal..." />;
  }

  if (!schedule) {
    return (
      <Screen>
        <TopAppBar title="Detail Jadwal" onBack={() => router.back()} />
        <ErrorBanner message={error} />
        <EmptyState title="Jadwal tidak ditemukan" subtitle="Jadwal mungkin tidak tersedia atau akses ditolak." />
      </Screen>
    );
  }

  const hasRealization = scheduleHasRealization(schedule, taskDetailMap);

  function handleCancelSchedule() {
    Alert.alert(
      'Batalkan jadwal?',
      'Tugas dari jadwal ini tidak akan ditampilkan sebagai pekerjaan aktif.',
      [
        {
          text: 'Kembali',
          style: 'cancel',
        },
        {
          text: 'Batalkan jadwal',
          style: 'destructive',
          onPress: () => {
            runCancelSchedule();
          },
        },
      ]
    );
  }

  async function runCancelSchedule() {
    if (!schedule) {
      return;
    }

    setCancelLoading(true);
    setError(null);

    const result = await cancelCareSchedule({
      scheduleId: schedule.id,
    });

    if (result.error) {
      setError(result.error.message);
      setCancelLoading(false);
      return;
    }

    await loadDetail();
    setCancelLoading(false);
  }

  return (
    <Screen>
      <TopAppBar title="Detail Jadwal" onBack={() => router.back()} />
      <ErrorBanner message={error} />

      <Card variant="softGreen">
        <View style={{ gap: 8 }}>
          <Text
            selectable
            style={{
              color: colors.text,
              fontSize: typography.h2.fontSize,
              fontWeight: typography.h2.fontWeight,
              lineHeight: typography.h2.lineHeight,
            }}
          >
            {schedule.title}
          </Text>
          <View style={{ alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Badge label={formatScheduleStatus(schedule)} tone={getScheduleTone(schedule)} />
            {schedule.careSopId ? <Badge label="SOP" tone="warning" /> : null}
            <Badge label={formatCareCategory(schedule.category)} maxWidth={140} tone="success" />
            {schedule.requiresPhoto ? <ProofPhotoIndicator /> : null}
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          <CompactMetaItem icon="calendar" label={formatDate(schedule.scheduledDate)} />
          <CompactMetaItem icon="target" label={formatCareTarget(schedule)} />
          <CompactMetaItem icon="user" label={formatScheduleWorkers(schedule, workerNames)} />
        </View>
      </Card>

      {schedule.isCancelled ? (
        <Card variant="danger">
          <Badge label="Jadwal dibatalkan" maxWidth={160} tone="danger" />
          <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
            Tugas dari jadwal ini tidak ditampilkan sebagai pekerjaan aktif untuk pekerja.
          </Text>
          {schedule.cancelledAt ? <MetaRow label="Waktu batal" value={formatDateTime(schedule.cancelledAt)} /> : null}
          {schedule.cancelReason ? <MetaRow label="Alasan" value={schedule.cancelReason} /> : null}
        </Card>
      ) : hasRealization ? (
        <Card variant="warning">
          <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
            Jadwal tidak dapat diubah
          </Text>
          <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
            Jadwal sudah memiliki realisasi tugas dari pekerja, jadi tidak bisa diedit atau dibatalkan.
          </Text>
        </Card>
      ) : (
        <Card>
          <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
            Pengaturan Jadwal
          </Text>
          <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
            Ubah jadwal sebelum ada realisasi, atau batalkan jika pekerjaan ini tidak perlu ditampilkan sebagai pekerjaan aktif.
          </Text>
          <Button
            title="Edit jadwal"
            disabled={cancelLoading}
            onPress={() => router.push(`/owner/schedules/${schedule.id}/edit`)}
          />
          <Button
            title="Batalkan jadwal"
            variant="danger"
            loading={cancelLoading}
            disabled={cancelLoading}
            onPress={handleCancelSchedule}
          />
        </Card>
      )}

      <Card>
        <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
          Instruksi
        </Text>
        <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
          {schedule.instruction || 'Belum ada instruksi tambahan.'}
        </Text>
      </Card>

      <SectionHeader title="Tugas Pekerja" description="Tugas yang dibuat dari jadwal ini." />
      {schedule.tasks.length === 0 ? (
        <EmptyState title="Belum ada tugas" subtitle="Tugas dari jadwal ini belum tersedia." />
      ) : (
        <View style={{ gap: 12 }}>
          {schedule.tasks.map((task) => (
            <OwnerScheduleTaskCard
              key={task.id}
              task={task}
              assignedWorkerName={workerNames[task.assignedTo]}
              proofPhotoMap={proofPhotoMap}
              taskDetail={taskDetailMap[task.id]}
              workerNames={workerNames}
              onPress={() => router.push(`/owner/tasks/${task.id}`)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function formatScheduleStatus(schedule: CareScheduleDetail): string {
  if (schedule.isCancelled) {
    return 'Jadwal dibatalkan';
  }

  if (schedule.tasks.length === 0) {
    return 'Belum ada tugas';
  }

  if (schedule.tasks.every((task) => task.status === 'completed')) {
    return 'Selesai';
  }

  if (schedule.tasks.some((task) => task.status === 'postponed')) {
    return 'Tertunda';
  }

  return 'Belum';
}

function getScheduleTone(schedule: CareScheduleDetail): 'danger' | 'muted' | 'success' | 'warning' {
  if (schedule.isCancelled) {
    return 'danger';
  }

  if (schedule.tasks.length === 0) {
    return 'muted';
  }

  if (schedule.tasks.every((task) => task.status === 'completed')) {
    return 'success';
  }

  if (schedule.tasks.some((task) => task.status === 'postponed')) {
    return 'warning';
  }

  return 'muted';
}

function scheduleHasRealization(
  schedule: CareScheduleDetail,
  taskDetailMap: Record<string, CareTaskDetail>
): boolean {
  return schedule.tasks.some((task) => (taskDetailMap[task.id]?.activities.length ?? 0) > 0);
}

function formatScheduleWorkers(
  schedule: CareScheduleDetail,
  workerNames: Record<string, string>
): string {
  const names = Array.from(
    new Set(schedule.tasks.map((task) => workerNames[task.assignedTo]).filter((name): name is string => Boolean(name)))
  );

  return names.length > 0 ? names.join(', ') : 'Belum ada pekerja';
}

function OwnerScheduleTaskCard({
  assignedWorkerName,
  onPress,
  proofPhotoMap,
  task,
  taskDetail,
  workerNames,
}: {
  assignedWorkerName?: string;
  onPress: () => void;
  proofPhotoMap: TaskProofPhotoMap;
  task: CareTask;
  taskDetail?: CareTaskDetail;
  workerNames: Record<string, string>;
}) {
  const latestActivity = taskDetail?.activities[0] ?? null;
  const latestProof = latestActivity ? proofPhotoMap[latestActivity.id] : undefined;

  return (
    <Pressable onPress={onPress}>
      <Card>
        <View style={{ gap: spacing.sm }}>
          <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' }}>
            <Text
              selectable
              ellipsizeMode="tail"
              numberOfLines={1}
              style={{
                color: colors.primary,
                flex: 1,
                fontSize: 17,
                fontWeight: '700',
                lineHeight: 23,
              }}
            >
              {task.title}
            </Text>
            <Badge label={formatTaskStatusForOwner(task.status)} maxWidth={100} tone={getTaskTone(task.status)} />
          </View>

          <View style={{ alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {task.category ? (
              <Text selectable numberOfLines={1} style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
                {formatCareCategory(task.category)}
              </Text>
            ) : null}
            {task.requiresPhoto ? <ProofPhotoIndicator /> : null}
          </View>

          {task.instruction ? (
            <Text
              selectable
              ellipsizeMode="tail"
              numberOfLines={2}
              style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}
            >
              {task.instruction}
            </Text>
          ) : null}

          <View style={{ gap: spacing.xs }}>
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
              <CompactMetaItem icon="calendar" label={formatDate(task.dueDate)} />
              <CompactMetaItem icon="target" label={formatCareTarget(task)} />
            </View>
            <CompactMetaItem icon="user" label={assignedWorkerName ?? 'Pekerja belum tersedia'} />
          </View>

          {latestActivity ? (
            <View
              style={{
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.border,
                borderRadius: 12,
                borderWidth: 1,
                gap: spacing.xs,
                padding: spacing.md,
              }}
            >
              <View style={{ alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Badge label={`Realisasi: ${formatActivityStatus(latestActivity.status)}`} tone={getActivityTone(latestActivity.status)} />
                {latestProof ? <ProofPhotoIndicator /> : null}
              </View>
              <CompactMetaItem icon="user" label={workerNames[latestActivity.performedBy] ?? assignedWorkerName ?? 'Pekerja tidak tersedia'} />
              <CompactMetaItem icon="calendar" label={formatDateTime(latestActivity.performedAt)} />
              {latestActivity.note ? <MetaRow label="Catatan realisasi" value={latestActivity.note} /> : null}
              {latestProof ? <TaskProofPhotoPreview photo={latestProof} /> : null}
            </View>
          ) : (
            <Text selectable style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
              Belum ada realisasi dari pekerja.
            </Text>
          )}
        </View>
      </Card>
    </Pressable>
  );
}

function ProofPhotoIndicator() {
  return (
    <View
      accessibilityLabel="Perlu bukti foto"
      style={{
        alignItems: 'center',
        backgroundColor: colors.warningBg,
        borderColor: colors.warningBorder,
        borderCurve: 'continuous',
        borderRadius: 999,
        borderWidth: 1,
        height: 26,
        justifyContent: 'center',
        width: 26,
      }}
    >
      <CameraGlyph color={colors.warning} />
    </View>
  );
}

function formatActivityStatus(status: ActivityStatus): string {
  return status === 'completed' ? 'Selesai' : 'Tertunda';
}

function getActivityTone(status: ActivityStatus): 'success' | 'warning' {
  return status === 'completed' ? 'success' : 'warning';
}

function formatTaskStatusForOwner(status: TaskStatus): string {
  if (status === 'completed') {
    return 'Selesai';
  }

  if (status === 'postponed') {
    return 'Tertunda';
  }

  return 'Belum';
}

function getTaskTone(status: TaskStatus): 'muted' | 'success' | 'warning' {
  if (status === 'completed') {
    return 'success';
  }

  if (status === 'postponed') {
    return 'warning';
  }

  return 'muted';
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('id-ID', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
