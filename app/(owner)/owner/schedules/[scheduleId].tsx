import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatCareTarget } from '../../../../src/components/care-schedule-components';
import { formatCareCategory } from '../../../../src/components/care-sop-components';
import {
  Badge,
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
import { getCareScheduleDetail } from '../../../../src/services/careScheduleService';
import { getFarmMemberBasicProfiles } from '../../../../src/services/memberService';
import type { CareScheduleDetail, CareTask, FarmMemberBasicProfile, TaskStatus } from '../../../../src/types/domain';

export default function CareScheduleDetailScreen() {
  const { currentFarm } = useAuth();
  const { scheduleId } = useLocalSearchParams<{ scheduleId: string }>();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [schedule, setSchedule] = React.useState<CareScheduleDetail | null>(null);
  const [workerNames, setWorkerNames] = React.useState<Record<string, string>>({});

  const farmId = currentFarm?.farmId;

  const loadDetail = React.useCallback(async () => {
    const normalizedScheduleId = scheduleId?.trim();

    if (!normalizedScheduleId) {
      setError('Data jadwal tidak ditemukan.');
      setSchedule(null);
      setWorkerNames({});
      return;
    }

    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setSchedule(null);
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
      setSchedule(null);
    } else {
      setSchedule(scheduleResult.data);
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
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            <Badge label={formatScheduleStatus(schedule)} tone={getScheduleTone(schedule)} />
            <Badge label={schedule.careSopId ? 'SOP' : 'Manual'} tone={schedule.careSopId ? 'warning' : 'muted'} />
            <Badge label={formatCareCategory(schedule.category)} maxWidth={140} tone="success" />
            {schedule.requiresPhoto ? <Badge label="Butuh bukti foto" maxWidth={144} tone="warning" /> : null}
          </View>
        </View>
        <View style={{ gap: 10 }}>
          <MetaRow label="Kategori" value={formatCareCategory(schedule.category)} />
          <MetaRow label="Target" value={formatCareTarget(schedule)} />
          <MetaRow label="Tanggal jadwal" value={formatDate(schedule.scheduledDate)} />
          <MetaRow label="Pekerja" value={formatScheduleWorkers(schedule, workerNames)} />
          <MetaRow label="Jumlah tugas" value={`${schedule.tasks.length} tugas`} />
          <MetaRow label="Bukti foto" value={schedule.requiresPhoto ? 'Wajib' : 'Tidak wajib'} />
        </View>
      </Card>

      <Card>
        <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
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
              onPress={() => router.push(`/owner/tasks/${task.id}`)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function formatScheduleStatus(schedule: CareScheduleDetail): string {
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
  task,
}: {
  assignedWorkerName?: string;
  onPress: () => void;
  task: CareTask;
}) {
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
                fontWeight: '900',
                lineHeight: 23,
              }}
            >
              {task.title}
            </Text>
            <Badge label={formatTaskStatusForOwner(task.status)} maxWidth={100} tone={getTaskTone(task.status)} />
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            <Badge
              label={task.category ? formatCareCategory(task.category) : 'Tanpa kategori'}
              maxWidth={140}
              tone="success"
            />
            {task.requiresPhoto ? <Badge label="Butuh bukti" maxWidth={116} tone="warning" /> : null}
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
        </View>
      </Card>
    </Pressable>
  );
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
