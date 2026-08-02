import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { BottomSheet, ConfirmDialog } from '../../../../src/components/bottom-sheet';
import { formatCareTarget } from '../../../../src/components/care-schedule-components';
import { formatCareCategory } from '../../../../src/components/care-sop-components';
import { Icon, type IconName } from '../../../../src/components/icons';
import { TaskProofPhotoPreview } from '../../../../src/components/task-proof-photo';
import {
  Badge,
  CameraGlyph,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  MetaRow,
  Screen,
  SuccessBanner,
  TopAppBar,
} from '../../../../src/components/ui';
import { colors, radius, spacing, statusColors, typography } from '../../../../src/constants/theme';
import { useAuth } from '../../../../src/context/auth-context';
import { consumePendingFeedback } from '../../../../src/lib/pendingFeedback';
import { cancelCareSchedule, getCareScheduleDetail } from '../../../../src/services/careScheduleService';
import { getTaskDetail } from '../../../../src/services/careTaskService';
import { getFarmMemberBasicProfiles } from '../../../../src/services/memberService';
import { listTaskProofPhotosForActivities } from '../../../../src/services/photoAttachmentService';
import type {
  ActivityStatus,
  CareActivity,
  CareScheduleDetail,
  CareTaskDetail,
  FarmMemberBasicProfile,
} from '../../../../src/types/domain';
import type { TaskProofPhoto, TaskProofPhotoMap } from '../../../../src/types/media';
import { formatActivityStatus } from '../../../../src/utils/displayFormat';
import { scheduleDueDatePill, type DueDatePill } from '../../../../src/utils/taskDueDate';

export default function CareScheduleDetailScreen() {
  const { currentFarm } = useAuth();
  const { scheduleId } = useLocalSearchParams<{ scheduleId: string }>();
  const [error, setError] = React.useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [manageOpen, setManageOpen] = React.useState(false);
  const [proofPhotoMap, setProofPhotoMap] = React.useState<TaskProofPhotoMap>({});
  const [schedule, setSchedule] = React.useState<CareScheduleDetail | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
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
      // Konfirmasi setelah simpan dari layar Edit Jadwal: baca-sekaligus-hapus
      // penanda, tampilkan SuccessBanner sekali. Fokus tanpa penanda membersihkan
      // banner lama (mis. kembali tanpa menyimpan).
      const feedback = consumePendingFeedback();
      setSuccess(feedback === 'schedule_updated' ? 'Perubahan tersimpan.' : null);
      setLoading(true);
      loadDetail().finally(() => setLoading(false));
    }, [loadDetail])
  );

  if (loading) {
    return <LoadingState message="Memuat detail jadwal..." />;
  }

  if (!schedule) {
    return (
      <Screen header={<TopAppBar title="Detail Jadwal" onBack={() => router.back()} />}>
        <ErrorBanner message={error} />
        <EmptyState title="Jadwal tidak ditemukan" subtitle="Jadwal mungkin tidak tersedia atau akses ditolak." />
      </Screen>
    );
  }

  const activeSchedule = schedule;
  const hasRealization = scheduleHasRealization(activeSchedule, taskDetailMap);
  const isLocked = activeSchedule.isCancelled === true || hasRealization;
  const lockMessage = activeSchedule.isCancelled
    ? 'Jadwal ini sudah dibatalkan.'
    : 'Jadwal sudah punya hasil kerja dan tidak bisa diubah lagi.';

  const pill: DueDatePill = activeSchedule.isCancelled
    ? { tone: 'neutral', label: 'Jadwal dibatalkan' }
    : scheduleDueDatePill(activeSchedule, activeSchedule.tasks, getTodayIsoDate());

  function handleRequestCancel() {
    // §5.4: sheet "Kelola jadwal" ditutup dulu (pemanggil memanggil onClose),
    // beri jeda agar animasi tutupnya selesai sebelum ConfirmDialog muncul —
    // supaya tidak ada dua overlay bertumpuk sekaligus.
    setTimeout(() => setConfirmOpen(true), 260);
  }

  async function runCancelSchedule() {
    setCancelLoading(true);
    setError(null);

    const result = await cancelCareSchedule({
      scheduleId: activeSchedule.id,
    });

    if (result.error) {
      setError(result.error.message);
      setCancelLoading(false);
      setConfirmOpen(false);
      return;
    }

    await loadDetail();
    setCancelLoading(false);
    setConfirmOpen(false);
  }

  const showWorkerHeadings = activeSchedule.tasks.length > 1;

  return (
    <Screen
      header={
        <TopAppBar
          title="Detail Jadwal"
          onBack={() => router.back()}
          right={
            <Pressable
              accessibilityLabel="Kelola jadwal"
              accessibilityRole="button"
              hitSlop={{ bottom: 8, left: 8, right: 8, top: 8 }}
              onPress={() => setManageOpen(true)}
              style={{
                alignItems: 'center',
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderCurve: 'continuous',
                borderRadius: 11,
                borderWidth: 1,
                height: 32,
                justifyContent: 'center',
                width: 32,
              }}
            >
              <Icon name="dots" size={20} color={colors.primary} />
            </Pressable>
          }
        />
      }
    >
      <ManageScheduleSheet
        cancelDisabled={cancelLoading}
        locked={isLocked}
        lockMessage={lockMessage}
        visible={manageOpen}
        onClose={() => setManageOpen(false)}
        onCancelSchedule={handleRequestCancel}
        onEditSchedule={() => router.push(`/owner/schedules/${activeSchedule.id}/edit`)}
      />

      <ConfirmDialog
        confirmLabel="Batalkan jadwal"
        loading={cancelLoading}
        message={`Tugas dari jadwal ini tidak lagi muncul sebagai pekerjaan aktif untuk ${formatScheduleWorkers(activeSchedule, workerNames)}. Tindakan ini tidak bisa dibatalkan.`}
        title="Batalkan jadwal?"
        tone="danger"
        visible={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={runCancelSchedule}
      />

      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <View style={{ gap: spacing.sm }}>
        <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' }}>
          <Text
            selectable
            style={{
              color: colors.primaryDark,
              flex: 1,
              fontSize: typography.h2.fontSize,
              fontWeight: '600',
              lineHeight: typography.h2.lineHeight,
            }}
          >
            {activeSchedule.title}
          </Text>
          <View style={{ alignItems: 'center', flexDirection: 'row', flexShrink: 0, gap: spacing.sm }}>
            <Badge label={formatScheduleStatus(activeSchedule)} tone={getScheduleTone(activeSchedule)} />
            {activeSchedule.requiresPhoto ? <ProofPhotoIndicator /> : null}
          </View>
        </View>
        <Text selectable style={{ color: colors.textMuted, fontSize: 14, lineHeight: 20 }}>
          {`${formatCareCategory(activeSchedule.category)} · ${formatCareTarget(activeSchedule)}`}
        </Text>
      </View>

      <View style={{ gap: spacing.xs }}>
        <DueDatePillView pill={pill} />
        {activeSchedule.isCancelled && activeSchedule.cancelReason ? (
          <Text selectable style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
            {`Alasan: ${activeSchedule.cancelReason}`}
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <MetaRow label="Tanggal" value={formatDate(activeSchedule.scheduledDate)} />
        </View>
        <View style={{ flex: 1 }}>
          <MetaRow label="Pekerja" value={formatScheduleWorkers(activeSchedule, workerNames)} />
        </View>
      </View>

      <View style={{ gap: spacing.xs }}>
        <Text selectable style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
          Instruksi
        </Text>
        <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
          {activeSchedule.instruction || 'Belum ada instruksi tambahan.'}
        </Text>
      </View>

      <View style={{ gap: spacing.md }}>
        <Text selectable style={{ color: colors.text, fontSize: typography.h3.fontSize, fontWeight: '700', lineHeight: typography.h3.lineHeight }}>
          Hasil kerja
        </Text>
        {activeSchedule.tasks.map((task) => {
          const activities = taskDetailMap[task.id]?.activities ?? [];
          const workerName = workerNames[task.assignedTo];

          return (
            <View key={task.id} style={{ gap: spacing.sm }}>
              {showWorkerHeadings ? (
                <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
                  {workerName ?? 'Pekerja tidak tersedia'}
                </Text>
              ) : null}
              {activities.length === 0 ? (
                <EmptyState
                  title="Belum ada hasil kerja"
                  subtitle={`${workerName ?? 'Pekerja'} belum menyelesaikan atau menunda tugas ini.`}
                />
              ) : (
                activities.map((activity) => (
                  <WorkResultCard key={activity.id} activity={activity} proof={proofPhotoMap[activity.id]} />
                ))
              )}
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

function ManageScheduleSheet({
  cancelDisabled,
  locked,
  lockMessage,
  onCancelSchedule,
  onClose,
  onEditSchedule,
  visible,
}: {
  cancelDisabled: boolean;
  locked: boolean;
  lockMessage: string;
  onCancelSchedule: () => void;
  onClose: () => void;
  onEditSchedule: () => void;
  visible: boolean;
}) {
  return (
    <BottomSheet title="Kelola jadwal" visible={visible} onClose={onClose}>
      <View style={{ gap: spacing.sm }}>
        {locked ? (
          <Text selectable style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
            {lockMessage}
          </Text>
        ) : null}
        <ManageScheduleRow
          disabled={locked}
          icon="calendar"
          label="Edit jadwal"
          onPress={() => {
            onClose();
            onEditSchedule();
          }}
        />
        <ManageScheduleRow
          disabled={locked || cancelDisabled}
          icon="x"
          label="Batalkan jadwal"
          tone="danger"
          onPress={() => {
            onClose();
            onCancelSchedule();
          }}
        />
      </View>
    </BottomSheet>
  );
}

function ManageScheduleRow({
  disabled,
  icon,
  label,
  onPress,
  tone = 'default',
}: {
  disabled: boolean;
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
}) {
  const textColor = disabled ? colors.textSoft : tone === 'danger' ? colors.danger : colors.text;
  const iconColor = disabled ? colors.textSoft : tone === 'danger' ? colors.danger : colors.primary;
  const circleColor = disabled ? colors.surfaceMuted : tone === 'danger' ? colors.dangerBg : colors.primarySoft;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderCurve: 'continuous',
        borderRadius: radius.lg,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing.md,
        padding: spacing.md,
      }}
    >
      <View
        style={{
          alignItems: 'center',
          backgroundColor: circleColor,
          borderRadius: radius.round,
          height: 38,
          justifyContent: 'center',
          width: 38,
        }}
      >
        <Icon name={icon} size={20} color={iconColor} />
      </View>
      <Text selectable style={{ color: textColor, flex: 1, fontSize: 16, fontWeight: '700' }}>
        {label}
      </Text>
      {disabled ? null : <Icon name="chevron-right" size={20} color={colors.textSoft} />}
    </Pressable>
  );
}

function WorkResultCard({ activity, proof }: { activity: CareActivity; proof?: TaskProofPhoto }) {
  return (
    <Card>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' }}>
        <Badge label={formatActivityStatus(activity.status)} tone={getActivityTone(activity.status)} />
        <Text selectable style={{ color: colors.textMuted, fontSize: 12 }}>
          {formatDateTime(activity.performedAt)}
        </Text>
      </View>
      {activity.note ? (
        <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
          {activity.note}
        </Text>
      ) : null}
      {activity.produk ? (
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 6 }}>
          <Icon name="basket" size={14} color={colors.textMuted} />
          <Text selectable style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
            {activity.produk}
          </Text>
        </View>
      ) : null}
      {proof ? <TaskProofPhotoPreview borderRadius={8} photo={proof} /> : null}
    </Card>
  );
}

function DueDatePillView({ pill }: { pill: DueDatePill }) {
  const palette =
    pill.tone === 'warning'
      ? statusColors.warning
      : pill.tone === 'success'
        ? statusColors.success
        : statusColors.neutral;

  return (
    <View
      style={{
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: palette.background,
        borderColor: palette.border,
        borderCurve: 'continuous',
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
      }}
    >
      <Icon name="calendar" size={14} color={palette.text} />
      <Text selectable style={{ color: palette.text, fontSize: 13, fontWeight: '700' }}>
        {pill.label}
      </Text>
    </View>
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

function getActivityTone(status: ActivityStatus): 'success' | 'warning' {
  return status === 'completed' ? 'success' : 'warning';
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
    return 'Ditunda';
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

function getTodayIsoDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
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
