import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import {
  formatCareTarget,
  formatTaskSource,
  formatTaskStatus,
} from '../../../../src/components/care-schedule-components';
import { formatCareCategory } from '../../../../src/components/care-sop-components';
import { TaskProofPhotoPreview } from '../../../../src/components/task-proof-photo';
import {
  Badge,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  MetaRow,
  Screen,
  TopAppBar,
  Button,
} from '../../../../src/components/ui';
import { useAuth } from '../../../../src/context/auth-context';
import { getCareScheduleDetail } from '../../../../src/services/careScheduleService';
import { getFarmMemberBasicProfiles } from '../../../../src/services/memberService';
import { getTaskDetail } from '../../../../src/services/careTaskService';
import { getOperationalReportDetail } from '../../../../src/services/operationalReportService';
import { listTaskProofPhotosForActivities } from '../../../../src/services/photoAttachmentService';
import type {
  ActivityStatus,
  CareScheduleDetail,
  CareTaskDetail,
  FarmMemberBasicProfile,
  OperationalReport,
} from '../../../../src/types/domain';
import type { TaskProofPhotoMap } from '../../../../src/types/media';
import {
  formatOperationalReportCategory,
  formatOperationalReportStatus,
} from '../../../../src/utils/displayFormat';

export default function OwnerTaskDetailScreen() {
  const { currentFarm } = useAuth();
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [report, setReport] = React.useState<OperationalReport | null>(null);
  const [proofPhotoMap, setProofPhotoMap] = React.useState<TaskProofPhotoMap>({});
  const [schedule, setSchedule] = React.useState<CareScheduleDetail | null>(null);
  const [task, setTask] = React.useState<CareTaskDetail | null>(null);
  const [workerNames, setWorkerNames] = React.useState<Record<string, string>>({});

  const farmId = currentFarm?.farmId;

  const loadDetail = React.useCallback(async () => {
    const normalizedTaskId = taskId?.trim();

    if (!normalizedTaskId) {
      setError('Data tugas tidak ditemukan.');
      setReport(null);
      setProofPhotoMap({});
      setTask(null);
      setSchedule(null);
      setWorkerNames({});
      return;
    }

    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setReport(null);
      setProofPhotoMap({});
      setTask(null);
      setSchedule(null);
      setWorkerNames({});
      return;
    }

    setError(null);
    setReport(null);
    setSchedule(null);

    const [taskResult, workersResult] = await Promise.all([
      getTaskDetail({ taskId: normalizedTaskId }),
      getFarmMemberBasicProfiles(farmId),
    ]);

    if (taskResult.error) {
      setError(taskResult.error.message);
      setProofPhotoMap({});
      setTask(null);
    } else {
      setTask(taskResult.data);

      const proofResult = await listTaskProofPhotosForActivities({
        activityIds: taskResult.data.activities.map((activity) => activity.id),
        farmId: taskResult.data.farmId,
      });

      if (proofResult.error) {
        setProofPhotoMap({});
      } else {
        setProofPhotoMap(proofResult.data);
      }

      if (taskResult.data.careScheduleId) {
        const scheduleResult = await getCareScheduleDetail({
          scheduleId: taskResult.data.careScheduleId,
        });

        if (!scheduleResult.error) {
          setSchedule(scheduleResult.data);
        }
      }

      if (taskResult.data.operationalReportId) {
        const reportResult = await getOperationalReportDetail({
          operationalReportId: taskResult.data.operationalReportId,
        });

        if (!reportResult.error) {
          setReport(reportResult.data);
        }
      }
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
  }, [farmId, taskId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadDetail().finally(() => setLoading(false));
    }, [loadDetail])
  );

  if (loading) {
    return <LoadingState message="Memuat detail tugas..." />;
  }

  if (!task) {
    return (
      <Screen>
        <TopAppBar title="Detail Tugas" onBack={() => router.back()} />
        <ErrorBanner message={error} />
        <EmptyState title="Tugas tidak ditemukan" subtitle="Tugas mungkin tidak tersedia atau akses ditolak." />
      </Screen>
    );
  }

  return (
    <Screen>
      <TopAppBar title="Detail Tugas" onBack={() => router.back()} />
      <ErrorBanner message={error} />

      <Card variant="highlight">
        <Text selectable style={{ color: '#1E2A24', fontSize: 22, fontWeight: '700', lineHeight: 28 }}>
          {task.title}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          <Badge label={formatTaskStatus(task.status)} tone={getTaskTone(task.status)} />
          <Badge label={formatTaskSource(task)} tone="muted" />
          {task.requiresPhoto ? <Badge label="Butuh bukti" tone="warning" /> : null}
        </View>
        <View style={{ gap: 10 }}>
          <MetaRow label="Pekerja" value={workerNames[task.assignedTo] ?? 'Pekerja tidak tersedia'} />
          <MetaRow label="Tanggal" value={formatDate(task.dueDate)} />
          <MetaRow label="Target" value={formatCareTarget(task)} />
          <MetaRow label="Kategori" value={task.category ? formatCareCategory(task.category) : 'Tanpa kategori'} />
          <MetaRow label="Bukti foto" value={task.requiresPhoto ? 'Wajib' : 'Tidak wajib'} />
        </View>
      </Card>

      <Card>
        <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '700' }}>
          Instruksi
        </Text>
        <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
          {task.instruction || '-'}
        </Text>
      </Card>

      <Card>
        <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '700' }}>
          Sumber Tugas
        </Text>
        {task.careScheduleId ? (
          <>
            <MetaRow label="Sumber tugas" value="Jadwal perawatan" />
            <MetaRow label="Judul jadwal" value={schedule?.title ?? 'Jadwal terkait'} />
            <MetaRow label="Tanggal jadwal" value={schedule?.scheduledDate} />
            <Button
              title="Buka Jadwal"
              variant="secondary"
              onPress={() => router.push(`/owner/schedules/${task.careScheduleId}`)}
            />
          </>
        ) : task.operationalReportId ? (
          <>
            <MetaRow label="Sumber tugas" value="Laporan operasional" />
            <MetaRow label="Kategori laporan" value={report ? formatOperationalReportCategory(report.category) : 'Laporan terkait'} />
            <MetaRow label="Lokasi laporan" value={report?.locationNote ?? '-'} />
            <MetaRow label="Pelapor" value={report ? workerNames[report.reportedBy] ?? 'Pelapor tidak tersedia' : 'Pelapor tidak tersedia'} />
            <MetaRow label="Status laporan" value={report ? formatOperationalReportStatus(report.status) : '-'} />
            <Button
              title="Buka Laporan"
              variant="secondary"
              onPress={() => router.push(`/owner/reports/${task.operationalReportId}`)}
            />
          </>
        ) : (
          <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
            Tugas tidak terhubung ke jadwal atau laporan.
          </Text>
        )}
      </Card>

      <Text selectable style={{ color: '#1E2A24', fontSize: 20, fontWeight: '700', paddingTop: 4 }}>
        Realisasi
      </Text>
      {task.activities.length === 0 ? (
        <EmptyState
          title="Belum ada realisasi"
          subtitle={task.requiresPhoto ? 'Menunggu bukti foto dari pekerja.' : 'Pekerja belum menyelesaikan atau menunda tugas ini.'}
        />
      ) : (
        <View style={{ gap: 12 }}>
          {task.activities.map((activity) => (
            <Card key={activity.id}>
              <MetaRow label="Status" value={formatActivityStatus(activity.status)} />
              <MetaRow label="Pelaksana" value={workerNames[activity.performedBy] ?? 'Pengguna tidak tersedia'} />
              <MetaRow label="Waktu" value={formatDateTime(activity.performedAt)} />
              <MetaRow label="Catatan" value={activity.note} />
              {activity.status === 'completed' ? (
                <>
                  <Text selectable style={{ color: '#1E2A24', fontSize: 15, fontWeight: '700' }}>
                    Bukti Realisasi
                  </Text>
                  <TaskProofPhotoPreview
                    emptyText={task.requiresPhoto ? 'Menunggu bukti foto dari pekerja.' : undefined}
                    photo={proofPhotoMap[activity.id]}
                  />
                </>
              ) : null}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

function getTaskTone(status: CareTaskDetail['status']): 'danger' | 'muted' | 'success' | 'warning' {
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

function formatActivityStatus(status: ActivityStatus): string {
  const labels: Record<ActivityStatus, string> = {
    completed: 'Selesai',
    postponed: 'Ditunda',
  };

  return labels[status];
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
