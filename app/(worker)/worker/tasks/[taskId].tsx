import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { formatCareTarget } from '../../../../src/components/care-schedule-components';
import { Icon } from '../../../../src/components/icons';
import { ReportSourceRow } from '../../../../src/components/operational-report-source-row';
import { WorkResultList } from '../../../../src/components/work-result-list';
import {
  Badge,
  Button,
  CameraGlyph,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  Screen,
  SuccessBanner,
  TopAppBar,
} from '../../../../src/components/ui';
import { colors, spacing, statusColors, typography } from '../../../../src/constants/theme';
import { consumePendingFeedback } from '../../../../src/lib/pendingFeedback';
import { getTaskDetail } from '../../../../src/services/careTaskService';
import { getOperationalReportDetail } from '../../../../src/services/operationalReportService';
import { listTaskProofPhotosForActivities } from '../../../../src/services/photoAttachmentService';
import type { CareTaskDetail, OperationalReport } from '../../../../src/types/domain';
import type { TaskProofPhotoMap } from '../../../../src/types/media';
import { formatCareCategory, formatTaskStatus } from '../../../../src/utils/displayFormat';
import { dueDatePill, getTodayIsoDate, type DueDatePill } from '../../../../src/utils/taskDueDate';

export default function WorkerTaskDetailScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [proofPhotoMap, setProofPhotoMap] = React.useState<TaskProofPhotoMap>({});
  const [sourceReport, setSourceReport] = React.useState<OperationalReport | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [task, setTask] = React.useState<CareTaskDetail | null>(null);

  const loadDetail = React.useCallback(async () => {
    const normalizedTaskId = taskId?.trim();

    if (!normalizedTaskId) {
      setError('Data tugas tidak ditemukan.');
      setProofPhotoMap({});
      setSourceReport(null);
      setTask(null);
      return;
    }

    setError(null);

    const result = await getTaskDetail({ taskId: normalizedTaskId });

    if (result.error) {
      setError(result.error.message);
      setProofPhotoMap({});
      setSourceReport(null);
      setTask(null);
      return;
    }

    setTask(result.data);

    // Policy operational_reports: pekerja hanya bisa membaca laporan yang dia
    // buat sendiri. Jadi kalau fetch ini berhasil, laporan itu PASTI miliknya —
    // hasilnya sekaligus jadi penentu boleh-tidaknya baris ini di-tap.
    if (result.data.operationalReportId) {
      const reportResult = await getOperationalReportDetail({
        operationalReportId: result.data.operationalReportId,
      });

      setSourceReport(reportResult.error ? null : reportResult.data);
    } else {
      setSourceReport(null);
    }

    const proofResult = await listTaskProofPhotosForActivities({
      activityIds: result.data.activities.map((activity) => activity.id),
      farmId: result.data.farmId,
    });

    if (proofResult.error) {
      setProofPhotoMap({});
    } else {
      setProofPhotoMap(proofResult.data);
    }
  }, [taskId]);

  useFocusEffect(
    React.useCallback(() => {
      // Konfirmasi setelah simpan (§1): baca-sekaligus-hapus penanda dari
      // record.tsx. Karena consume menghapus nilainya, banner hanya muncul sekali;
      // fokus tanpa penanda membersihkan banner lama (mis. kembali tanpa simpan).
      const feedback = consumePendingFeedback();
      setSuccess(feedbackMessage(feedback));
      setLoading(true);
      loadDetail().finally(() => setLoading(false));
    }, [loadDetail])
  );

  if (loading) {
    return <LoadingState message="Memuat detail tugas..." />;
  }

  if (!task) {
    return (
      <Screen header={<TopAppBar title="Detail Tugas" onBack={() => router.back()} />}>
        <ErrorBanner message={error} />
        <EmptyState title="Tugas tidak ditemukan" subtitle="Tugas mungkin tidak tersedia atau bukan milik Anda." />
      </Screen>
    );
  }

  const activeTask = task;
  const isCancelledByOwner = activeTask.scheduleIsCancelled === true;
  const showFooter = !isCancelledByOwner && activeTask.status !== 'completed';

  const pill: DueDatePill = isCancelledByOwner
    ? { tone: 'neutral', label: 'Dibatalkan owner' }
    : dueDatePill({ status: activeTask.status, dueDate: activeTask.dueDate }, getTodayIsoDate());

  return (
    <Screen
      header={<TopAppBar title="Detail Tugas" onBack={() => router.back()} />}
      stickyFooter={
        showFooter ? (
          <Button
            title="Catat hasil kerja"
            onPress={() => router.push(`/worker/tasks/${activeTask.id}/record?mode=create`)}
          />
        ) : undefined
      }
    >
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
            {activeTask.title}
          </Text>
          <View style={{ alignItems: 'center', flexDirection: 'row', flexShrink: 0, gap: spacing.sm }}>
            <Badge label={formatTaskStatus(activeTask.status)} tone={getTaskTone(activeTask.status)} />
            {activeTask.requiresPhoto ? <ProofPhotoIndicator /> : null}
          </View>
        </View>
        <Text selectable style={{ color: colors.textMuted, fontSize: 14, lineHeight: 20 }}>
          {`${activeTask.category ? formatCareCategory(activeTask.category) : 'Tanpa kategori'} · ${formatCareTarget(activeTask)}`}
        </Text>
      </View>

      <DueDatePillView pill={pill} />

      {activeTask.operationalReportId ? (
        <ReportSourceRow
          description={sourceReport?.description}
          onPress={
            sourceReport
              ? () => router.push(`/worker/reports/${sourceReport.id}`)
              : undefined
          }
        />
      ) : null}

      {isCancelledByOwner ? (
        <Card variant="danger">
          <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
            Tugas ini sudah dibatalkan oleh owner.
          </Text>
          <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
            Tugas ini tidak lagi tersedia sebagai pekerjaan aktif.
          </Text>
        </Card>
      ) : null}

      <View style={{ gap: spacing.xs }}>
        <Text selectable style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
          Instruksi
        </Text>
        <Text selectable style={{ color: colors.textMuted, fontSize: 16, lineHeight: 23 }}>
          {activeTask.instruction || 'Belum ada instruksi tambahan.'}
        </Text>
      </View>

      <View style={{ gap: spacing.md }}>
        <Text
          selectable
          style={{ color: colors.text, fontSize: typography.h3.fontSize, fontWeight: '700', lineHeight: typography.h3.lineHeight }}
        >
          {activeTask.activities.length === 0 ? 'Hasil kerja' : 'Riwayat hasil kerja'}
        </Text>
        {/* Bentuk barisnya milik WorkResultList, dipakai bersama layar owner.
            Tugas yang sudah dibatalkan owner tidak lagi menawarkan aksi
            perbaiki — handler-nya tidak dioper sama sekali. */}
        <WorkResultList
          activities={activeTask.activities}
          emptySubtitle="Pencet tombol di bawah untuk mulai."
          proofPhotoMap={proofPhotoMap}
          onFixLatestNote={
            isCancelledByOwner
              ? undefined
              : (activity) =>
                  router.push(`/worker/tasks/${activeTask.id}/record?mode=edit&activityId=${activity.id}`)
          }
        />
      </View>
    </Screen>
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

// getActivityTone() dihapus bersama WorkResultCard: status hasil kerja kini
// ditandai ikon berwarna di dalam baris, bukan Badge.

function getTaskTone(status: CareTaskDetail['status']): 'danger' | 'muted' | 'success' | 'warning' {
  if (status === 'completed') {
    return 'success';
  }

  if (status === 'postponed') {
    return 'warning';
  }

  return 'muted';
}

function feedbackMessage(feedback: string | null): string | null {
  if (feedback === 'completed') {
    return 'Hasil kerja tersimpan.';
  }

  if (feedback === 'postponed') {
    return 'Penundaan tersimpan.';
  }

  if (feedback === 'updated') {
    return 'Perubahan tersimpan.';
  }

  return null;
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
