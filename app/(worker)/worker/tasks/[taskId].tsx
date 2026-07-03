import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import {
  formatCareTarget,
} from '../../../../src/components/care-schedule-components';
import { formatCareCategory } from '../../../../src/components/care-sop-components';
import { TaskProofPhotoPicker, TaskProofPhotoPreview } from '../../../../src/components/task-proof-photo';
import {
  Badge,
  Button,
  CameraGlyph,
  Card,
  EmptyState,
  ErrorBanner,
  FormSection,
  LoadingState,
  MetaRow,
  Screen,
  SectionHeader,
  SuccessBanner,
  TopAppBar,
} from '../../../../src/components/ui';
import { colors, radius, spacing, typography } from '../../../../src/constants/theme';
import {
  completeTask,
  getTaskDetail,
  postponeTask,
  rollbackCompletedTaskActivity,
  updateLatestTaskRealization,
} from '../../../../src/services/careTaskService';
import { pickImageFromGallery, takePhotoFromCamera } from '../../../../src/lib/media';
import { getOperationalReportDetail } from '../../../../src/services/operationalReportService';
import {
  listTaskProofPhotosForActivities,
  uploadTaskProofPhoto,
} from '../../../../src/services/photoAttachmentService';
import type { ActivityStatus, CareTaskDetail, OperationalReport } from '../../../../src/types/domain';
import type { PickedPhotoAsset, TaskProofPhotoMap } from '../../../../src/types/media';
import {
  formatOperationalReportCategory,
  formatOperationalReportStatus,
} from '../../../../src/utils/displayFormat';

export default function WorkerTaskDetailScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const [actionLoading, setActionLoading] = React.useState<'complete' | 'edit' | 'postpone' | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [completeNote, setCompleteNote] = React.useState('');
  const [editNote, setEditNote] = React.useState('');
  const [editProofPhoto, setEditProofPhoto] = React.useState<PickedPhotoAsset | null>(null);
  const [editStatus, setEditStatus] = React.useState<ActivityStatus>('completed');
  const [editingActivityId, setEditingActivityId] = React.useState<string | null>(null);
  const [showCompleteInput, setShowCompleteInput] = React.useState(false);
  const [postponeNote, setPostponeNote] = React.useState('');
  const [proofPhoto, setProofPhoto] = React.useState<PickedPhotoAsset | null>(null);
  const [proofPhotoMap, setProofPhotoMap] = React.useState<TaskProofPhotoMap>({});
  const [report, setReport] = React.useState<OperationalReport | null>(null);
  const [removeExistingEditProof, setRemoveExistingEditProof] = React.useState(false);
  const [showPostponeInput, setShowPostponeInput] = React.useState(false);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [task, setTask] = React.useState<CareTaskDetail | null>(null);

  const loadDetail = React.useCallback(async () => {
    const normalizedTaskId = taskId?.trim();

    if (!normalizedTaskId) {
      setError('Data tugas tidak ditemukan.');
      setProofPhotoMap({});
      setReport(null);
      setTask(null);
      return;
    }

    setError(null);
    setSuccess(null);
    setReport(null);

    const result = await getTaskDetail({ taskId: normalizedTaskId });

    if (result.error) {
      setError(result.error.message);
      setProofPhotoMap({});
      setTask(null);
      return;
    }

    setTask(result.data);

    const proofResult = await listTaskProofPhotosForActivities({
      activityIds: result.data.activities.map((activity) => activity.id),
      farmId: result.data.farmId,
    });

    if (proofResult.error) {
      setProofPhotoMap({});
    } else {
      setProofPhotoMap(proofResult.data);
    }

    if (result.data.operationalReportId) {
      const reportResult = await getOperationalReportDetail({
        operationalReportId: result.data.operationalReportId,
      });

      if (!reportResult.error) {
        setReport(reportResult.data);
      }
    }
  }, [taskId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadDetail().finally(() => setLoading(false));
    }, [loadDetail])
  );

  async function handleComplete() {
    if (!task) {
      return;
    }

    if (!showCompleteInput) {
      setShowCompleteInput(true);
      setShowPostponeInput(false);
      return;
    }

    if (task.requiresPhoto && !proofPhoto) {
      setError('Tambahkan bukti foto terlebih dahulu.');
      return;
    }

    setActionLoading('complete');
    setError(null);
    setSuccess(null);

    const result = await completeTask({
      note: completeNote,
      taskId: task.id,
    });

    if (result.error) {
      setError(result.error.message);
      setActionLoading(null);
      return;
    }

    if (proofPhoto) {
      const proofResult = await uploadTaskProofPhoto({
        activityId: result.data.activityId,
        base64: proofPhoto.base64,
        farmId: task.farmId,
        fileName: proofPhoto.fileName,
        localUri: proofPhoto.uri,
        mimeType: proofPhoto.mimeType,
        taskId: task.id,
      });

      if (proofResult.error) {
        if (task.requiresPhoto) {
          const rollbackResult = await rollbackCompletedTaskActivity({ activityId: result.data.activityId });
          setError(
            rollbackResult.error
              ? 'Foto bukti gagal diunggah. Status tugas perlu diperiksa kembali.'
              : 'Foto bukti gagal diunggah. Tugas belum ditandai selesai.'
          );
          setActionLoading(null);
          await loadDetail();
          return;
        }

        Alert.alert('Tugas selesai', 'Tugas selesai, tetapi bukti foto gagal diunggah.');
      }
    }

    setCompleteNote('');
    setProofPhoto(null);
    setShowCompleteInput(false);
    await loadDetail();
    setSuccess('Tugas berhasil diselesaikan.');
    setActionLoading(null);
  }

  async function handlePostpone() {
    if (!task) {
      return;
    }

    if (!showPostponeInput) {
      setShowPostponeInput(true);
      setShowCompleteInput(false);
      return;
    }

    if (!postponeNote.trim()) {
      setError('Catatan penundaan wajib diisi.');
      return;
    }

    setActionLoading('postpone');
    setError(null);
    setSuccess(null);

    const result = await postponeTask({
      note: postponeNote,
      taskId: task.id,
    });

    if (result.error) {
      setError(result.error.message);
      setActionLoading(null);
      return;
    }

    setPostponeNote('');
    setProofPhoto(null);
    setShowPostponeInput(false);
    await loadDetail();
    setSuccess('Tugas berhasil ditunda.');
    setActionLoading(null);
  }

  async function handleUpdateLatestRealization() {
    if (!task || !editingActivityId) {
      return;
    }

    const existingProof = proofPhotoMap[editingActivityId];

    if (
      task.requiresPhoto
      && editStatus === 'completed'
      && !editProofPhoto
      && (!existingProof || removeExistingEditProof)
    ) {
      setError('Foto wajib untuk menyelesaikan tugas ini');
      return;
    }

    if (editStatus === 'postponed' && !editNote.trim()) {
      setError('Catatan penundaan wajib diisi.');
      return;
    }

    setActionLoading('edit');
    setError(null);
    setSuccess(null);

    const result = await updateLatestTaskRealization({
      activityId: editingActivityId,
      note: editNote,
      proofPhoto: editProofPhoto
        ? {
            base64: editProofPhoto.base64,
            fileName: editProofPhoto.fileName,
            mimeType: editProofPhoto.mimeType,
            uri: editProofPhoto.uri,
          }
        : null,
      removeExistingProof: removeExistingEditProof,
      status: editStatus,
      taskId: task.id,
    });

    if (result.error) {
      setError(result.error.message);
      setActionLoading(null);
      return;
    }

    setSuccess('Realisasi berhasil diperbarui');
    if (result.data.warningMessage) {
      setError(result.data.warningMessage);
    }
    resetEditForm();
    await loadDetail();
    setActionLoading(null);
  }

  async function handlePickProofFromGallery() {
    const result = await pickImageFromGallery();

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (result.data) {
      setError(null);
      setProofPhoto(result.data);
    }
  }

  async function handleTakeProofFromCamera() {
    const result = await takePhotoFromCamera();

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (result.data) {
      setError(null);
      setProofPhoto(result.data);
    }
  }

  async function handlePickEditProofFromGallery() {
    const result = await pickImageFromGallery();

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (result.data) {
      setError(null);
      setEditProofPhoto(result.data);
      setRemoveExistingEditProof(false);
    }
  }

  async function handleTakeEditProofFromCamera() {
    const result = await takePhotoFromCamera();

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (result.data) {
      setError(null);
      setEditProofPhoto(result.data);
      setRemoveExistingEditProof(false);
    }
  }

  if (loading) {
    return <LoadingState message="Memuat detail tugas..." />;
  }

  if (!task) {
    return (
      <Screen>
        <TopAppBar title="Detail Tugas" onBack={() => router.back()} />
        <ErrorBanner message={error} />
        <EmptyState title="Tugas tidak ditemukan" subtitle="Tugas mungkin tidak tersedia atau bukan milik Anda." />
      </Screen>
    );
  }

  const isCompleted = task.status === 'completed';
  const isRealized = task.status === 'completed' || task.status === 'postponed';
  const isCancelledByOwner = task.scheduleIsCancelled === true;
  const isEditingRealization = Boolean(editingActivityId);
  const latestActivity = task.activities[0] ?? null;
  const latestActivityProof = latestActivity ? proofPhotoMap[latestActivity.id] : undefined;
  const selectedAction: 'complete' | 'postpone' | null = showCompleteInput
    ? 'complete'
    : showPostponeInput
      ? 'postpone'
      : null;

  function selectCompletion() {
    resetEditForm();
    setShowCompleteInput(true);
    setShowPostponeInput(false);
  }

  function selectPostpone() {
    resetEditForm();
    setShowPostponeInput(true);
    setShowCompleteInput(false);
  }

  function handleCancelRealization() {
    if (isEditingRealization) {
      resetEditForm();
      return;
    }

    if (!selectedAction) {
      router.back();
      return;
    }

    setShowCompleteInput(false);
    setShowPostponeInput(false);
  }

  function startEditRealization(activity: CareTaskDetail['activities'][number]) {
    setShowCompleteInput(false);
    setShowPostponeInput(false);
    setEditNote(activity.note ?? '');
    setEditProofPhoto(null);
    setEditStatus(activity.status);
    setEditingActivityId(activity.id);
    setRemoveExistingEditProof(false);
    setError(null);
    setSuccess(null);
  }

  function resetEditForm() {
    setEditNote('');
    setEditProofPhoto(null);
    setEditingActivityId(null);
    setRemoveExistingEditProof(false);
  }

  return (
    <Screen
      footer={
        isCancelledByOwner ? null : isEditingRealization ? (
          <View style={{ gap: spacing.sm }}>
            <Button
              title="Simpan Edit Realisasi"
              loading={actionLoading === 'edit'}
              disabled={actionLoading !== null}
              onPress={handleUpdateLatestRealization}
            />
            <Button title="Batal" variant="secondary" disabled={actionLoading !== null} onPress={resetEditForm} />
          </View>
        ) : isRealized ? null : (
          <View style={{ gap: spacing.sm }}>
            <Button
              title={selectedAction === 'postpone' ? 'Tunda Tugas' : 'Selesaikan'}
              disabled={!selectedAction || actionLoading !== null}
              loading={actionLoading !== null}
              onPress={selectedAction === 'postpone' ? handlePostpone : handleComplete}
            />
            <Button title={selectedAction ? 'Batal' : 'Kembali'} variant="secondary" onPress={handleCancelRealization} />
          </View>
        )
      }
    >
      <TopAppBar title="Detail Tugas" onBack={() => router.back()} />
      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <Card variant="softGreen">
        <Text
          selectable
          style={{
            color: colors.text,
            fontSize: typography.h2.fontSize,
            fontWeight: typography.h2.fontWeight,
            lineHeight: typography.h2.lineHeight,
          }}
        >
          {task.title}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          <Badge label={formatTaskStatusLabel(task.status)} tone={getTaskTone(task.status)} />
          {isCancelledByOwner ? <Badge label="Dibatalkan owner" maxWidth={148} tone="danger" /> : null}
          {task.requiresPhoto ? <ProofPhotoIndicator /> : null}
        </View>
        <View style={{ gap: 10 }}>
          <MetaRow label="Kategori" value={task.category ? formatCareCategory(task.category) : 'Tanpa kategori'} />
          <MetaRow label="Target" value={formatCareTarget(task)} />
          <MetaRow label="Tanggal" value={formatDate(task.dueDate)} />
        </View>
      </Card>

      {isCancelledByOwner ? (
        <Card variant="danger">
          <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
            Tugas ini sudah dibatalkan oleh owner.
          </Text>
          <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
            Tugas ini tidak lagi tersedia sebagai pekerjaan aktif.
          </Text>
        </Card>
      ) : null}

      <Card>
        <Text selectable style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>
          Instruksi
        </Text>
        <Text selectable style={{ color: colors.textMuted, fontSize: 16, lineHeight: 23 }}>
          {task.instruction || 'Belum ada instruksi tambahan.'}
        </Text>
      </Card>

      {!isRealized && !isCancelledByOwner ? (
        <FormSection title="Realisasi" description="Pilih hasil pekerjaan hari ini.">
          <View style={{ gap: spacing.sm }}>
            <RealizationOption
              active={selectedAction === 'complete'}
              description="Pekerjaan sudah dilakukan."
              label="Selesaikan"
              onPress={selectCompletion}
            />
            <RealizationOption
              active={selectedAction === 'postpone'}
              description="Belum bisa dikerjakan hari ini."
              label="Tunda"
              onPress={selectPostpone}
            />
          </View>

          {showCompleteInput ? (
            <TextArea
              label="Catatan Realisasi"
              onChangeText={setCompleteNote}
              placeholder="Contoh: Pekerjaan selesai sesuai instruksi"
              value={completeNote}
            />
          ) : null}

          {showPostponeInput ? (
            <TextArea
              label="Catatan Realisasi *"
              onChangeText={setPostponeNote}
              placeholder="Contoh: Stok air belum tersedia"
              value={postponeNote}
            />
          ) : null}
        </FormSection>
      ) : null}

      {!isCancelledByOwner && !isRealized && (task.requiresPhoto || showCompleteInput) ? (
        <TaskProofPhotoPicker
          disabled={actionLoading !== null || isCompleted}
          photo={proofPhoto}
          required={task.requiresPhoto}
          onCameraPress={handleTakeProofFromCamera}
          onGalleryPress={handlePickProofFromGallery}
          onRemove={() => setProofPhoto(null)}
        />
      ) : null}

      {!isCancelledByOwner && isEditingRealization ? (
        <FormSection title="Edit realisasi" description="Perbarui status, catatan, atau bukti realisasi terbaru.">
          <View style={{ gap: spacing.sm }}>
            <RealizationOption
              active={editStatus === 'completed'}
              description="Tandai tugas selesai sesuai instruksi."
              label="Selesaikan"
              onPress={() => setEditStatus('completed')}
            />
            <RealizationOption
              active={editStatus === 'postponed'}
              description="Tunda tugas dan tulis alasan penundaan."
              label="Tunda"
              onPress={() => setEditStatus('postponed')}
            />
          </View>

          <TextArea
            label={editStatus === 'postponed' ? 'Catatan Realisasi *' : 'Catatan Realisasi'}
            onChangeText={setEditNote}
            placeholder={editStatus === 'postponed' ? 'Contoh: Stok air belum tersedia' : 'Contoh: Pekerjaan selesai sesuai instruksi'}
            value={editNote}
          />

          <View style={{ gap: spacing.sm }}>
            <Text selectable style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>
              Bukti realisasi
            </Text>
            {task.requiresPhoto && editStatus === 'completed' ? (
              <Text selectable style={{ color: colors.warning, lineHeight: 20 }}>
                Foto wajib untuk menyelesaikan tugas ini
              </Text>
            ) : null}
            {latestActivityProof && !removeExistingEditProof && !editProofPhoto ? (
              <>
                <TaskProofPhotoPreview photo={latestActivityProof} />
                <Button
                  title="Hapus Foto"
                  variant="secondary"
                  disabled={actionLoading !== null}
                  onPress={() => setRemoveExistingEditProof(true)}
                />
              </>
            ) : null}
            {removeExistingEditProof && !editProofPhoto ? (
              <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
                Foto bukti saat ini akan dihapus setelah edit disimpan.
              </Text>
            ) : null}
            <TaskProofPhotoPicker
              disabled={actionLoading !== null}
              photo={editProofPhoto}
              required={task.requiresPhoto && editStatus === 'completed'}
              onCameraPress={handleTakeEditProofFromCamera}
              onGalleryPress={handlePickEditProofFromGallery}
              onRemove={() => setEditProofPhoto(null)}
            />
          </View>
        </FormSection>
      ) : null}

      {task.operationalReportId ? (
        <Card>
          <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
            Sumber Laporan
          </Text>
          {report ? (
            <>
              <MetaRow label="Kategori laporan" value={formatOperationalReportCategory(report.category)} />
              <MetaRow label="Lokasi laporan" value={report.locationNote ?? '-'} />
              <MetaRow label="Status laporan" value={formatOperationalReportStatus(report.status)} />
            </>
          ) : (
            <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
              Tugas ini berasal dari laporan operasional.
            </Text>
          )}
        </Card>
      ) : null}

      <SectionHeader title="Riwayat Realisasi" />
      {task.activities.length === 0 ? (
        <EmptyState title="Belum ada realisasi" subtitle="Selesaikan atau tunda tugas untuk menyimpan realisasi." />
      ) : (
        <View style={{ gap: 12 }}>
          {task.activities.map((activity, index) => (
            <Card key={activity.id}>
              <MetaRow label="Status" value={formatActivityStatus(activity.status)} />
              <MetaRow label="Waktu" value={formatDateTime(activity.performedAt)} />
              <MetaRow label="Catatan" value={activity.note} />
              {activity.status === 'completed' ? (
                <TaskProofPhotoPreview photo={proofPhotoMap[activity.id]} />
              ) : null}
              {index === 0 && !isEditingRealization && !isCancelledByOwner ? (
                <Button
                  title="Edit realisasi"
                  variant="secondary"
                  disabled={actionLoading !== null}
                  onPress={() => startEditRealization(activity)}
                />
              ) : null}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

function TextArea({
  label,
  onChangeText,
  placeholder,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <View style={{ gap: 7 }}>
      <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
        {label}
      </Text>
      <TextInput
        multiline
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSoft}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderCurve: 'continuous',
          borderRadius: radius.md,
          borderWidth: 1,
          color: colors.text,
          fontSize: 16,
          minHeight: 96,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          textAlignVertical: 'top',
        }}
        value={value}
      />
    </View>
  );
}

function RealizationOption({
  active,
  description,
  label,
  onPress,
}: {
  active: boolean;
  description: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        backgroundColor: active ? colors.primarySoft : colors.surface,
        borderColor: active ? colors.primary : colors.border,
        borderCurve: 'continuous',
        borderRadius: radius.lg,
        borderWidth: 1,
        gap: spacing.xs,
        padding: spacing.md,
      }}
    >
      <Text selectable style={{ color: active ? colors.primary : colors.text, fontSize: 16, fontWeight: '800' }}>
        {label}
      </Text>
      <Text selectable style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
        {description}
      </Text>
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
  const labels: Record<ActivityStatus, string> = {
    completed: 'Selesai',
    postponed: 'Tertunda',
  };

  return labels[status];
}

function formatTaskStatusLabel(status: CareTaskDetail['status']): string {
  if (status === 'completed') {
    return 'Selesai';
  }

  if (status === 'postponed') {
    return 'Tertunda';
  }

  return 'Belum';
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
