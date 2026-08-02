import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { PhotoSourceSheet } from '../../../../../src/components/bottom-sheet';
import { Icon, type IconName } from '../../../../../src/components/icons';
import {
  Badge,
  Button,
  ErrorBanner,
  LoadingState,
  Screen,
  TopAppBar,
} from '../../../../../src/components/ui';
import { colors, radius, spacing } from '../../../../../src/constants/theme';
import { pickImageFromGallery, takePhotoFromCamera } from '../../../../../src/lib/media';
import { setPendingFeedback } from '../../../../../src/lib/pendingFeedback';
import {
  completeTask,
  getTaskDetail,
  postponeTask,
  rollbackCompletedTaskActivity,
  updateLatestTaskRealization,
} from '../../../../../src/services/careTaskService';
import {
  listTaskProofPhotosForActivities,
  uploadTaskProofPhoto,
} from '../../../../../src/services/photoAttachmentService';
import type { ActivityStatus, CareTaskDetail } from '../../../../../src/types/domain';
import type { PickedPhotoAsset, TaskProofPhoto } from '../../../../../src/types/media';

type RecordMode = 'create' | 'edit';

export default function WorkerTaskRecordScreen() {
  const params = useLocalSearchParams<{ taskId: string; mode?: string; activityId?: string }>();
  const taskId = params.taskId;
  const mode: RecordMode = params.mode === 'edit' ? 'edit' : 'create';
  const activityId = params.activityId?.trim() || null;

  const scrollRef = React.useRef<ScrollView>(null);

  const [task, setTask] = React.useState<CareTaskDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [bannerError, setBannerError] = React.useState<string | null>(null);

  const [status, setStatus] = React.useState<ActivityStatus>('completed');
  const [note, setNote] = React.useState('');
  const [produk, setProduk] = React.useState('');
  const [newPhoto, setNewPhoto] = React.useState<PickedPhotoAsset | null>(null);
  const [existingProof, setExistingProof] = React.useState<TaskProofPhoto | null>(null);
  const [removeExistingPhoto, setRemoveExistingPhoto] = React.useState(false);

  const [photoError, setPhotoError] = React.useState<string | null>(null);
  const [reasonError, setReasonError] = React.useState<string | null>(null);

  const loadTask = React.useCallback(async () => {
    const normalizedTaskId = taskId?.trim();

    if (!normalizedTaskId) {
      setBannerError('Data tugas tidak ditemukan.');
      setTask(null);
      return;
    }

    setBannerError(null);

    const result = await getTaskDetail({ taskId: normalizedTaskId });

    if (result.error) {
      setBannerError(result.error.message);
      setTask(null);
      return;
    }

    setTask(result.data);

    if (mode === 'edit' && activityId) {
      const activity = result.data.activities.find((item) => item.id === activityId);

      if (activity) {
        setStatus(activity.status);
        setNote(activity.note ?? '');
        setProduk(activity.produk ?? '');
      }

      const proofResult = await listTaskProofPhotosForActivities({
        activityIds: [activityId],
        farmId: result.data.farmId,
      });

      if (!proofResult.error) {
        setExistingProof(proofResult.data[activityId] ?? null);
      }
    }
  }, [activityId, mode, taskId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadTask().finally(() => setLoading(false));
    }, [loadTask])
  );

  async function handlePickFromGallery() {
    const result = await pickImageFromGallery();

    if (result.error) {
      setBannerError(result.error.message);
      return;
    }

    if (result.data) {
      setBannerError(null);
      setPhotoError(null);
      setNewPhoto(result.data);
      setRemoveExistingPhoto(false);
    }
  }

  async function handleTakeFromCamera() {
    const result = await takePhotoFromCamera();

    if (result.error) {
      setBannerError(result.error.message);
      return;
    }

    if (result.data) {
      setBannerError(null);
      setPhotoError(null);
      setNewPhoto(result.data);
      setRemoveExistingPhoto(false);
    }
  }

  // Satu slot foto: hapus membuang foto baru dulu (kalau ada), lalu menandai
  // foto lama untuk dihapus saat simpan.
  function handleDeletePhoto() {
    if (newPhoto) {
      setNewPhoto(null);
      return;
    }

    if (existingProof && !removeExistingPhoto) {
      setRemoveExistingPhoto(true);
    }
  }

  function selectStatus(next: ActivityStatus) {
    setStatus(next);
    setPhotoError(null);
    setReasonError(null);
  }

  const hasUsableProof = Boolean(newPhoto) || (Boolean(existingProof) && !removeExistingPhoto);
  const photoUri = newPhoto?.uri ?? (existingProof && !removeExistingPhoto ? existingProof.signedUrl : null);

  async function handleSubmit() {
    if (!task) {
      return;
    }

    if (status === 'completed' && task.requiresPhoto && !hasUsableProof) {
      setPhotoError('Tugas ini butuh bukti foto.');
      scrollRef.current?.scrollToEnd({ animated: true });
      return;
    }

    if (status === 'postponed' && !note.trim()) {
      setReasonError('Isi alasan penundaan.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    if (mode === 'edit') {
      await submitEdit(task);
      return;
    }

    if (status === 'completed') {
      await submitComplete(task);
      return;
    }

    await submitPostpone(task);
  }

  async function submitComplete(currentTask: CareTaskDetail) {
    setSubmitting(true);
    setBannerError(null);

    const result = await completeTask({
      note,
      produk,
      taskId: currentTask.id,
    });

    if (result.error) {
      setBannerError(result.error.message);
      setSubmitting(false);
      return;
    }

    if (newPhoto) {
      const proofResult = await uploadTaskProofPhoto({
        activityId: result.data.activityId,
        base64: newPhoto.base64,
        farmId: currentTask.farmId,
        fileName: newPhoto.fileName,
        localUri: newPhoto.uri,
        mimeType: newPhoto.mimeType,
        taskId: currentTask.id,
      });

      if (proofResult.error) {
        if (currentTask.requiresPhoto) {
          const rollbackResult = await rollbackCompletedTaskActivity({ activityId: result.data.activityId });
          setBannerError(
            rollbackResult.error
              ? 'Foto bukti gagal diunggah. Status tugas perlu diperiksa kembali.'
              : 'Foto bukti gagal diunggah. Tugas belum ditandai selesai.'
          );
          setSubmitting(false);
          return;
        }

        Alert.alert('Tugas selesai', 'Tugas selesai, tetapi bukti foto gagal diunggah.');
      }
    }

    setSubmitting(false);
    setPendingFeedback('completed');
    router.back();
  }

  async function submitPostpone(currentTask: CareTaskDetail) {
    setSubmitting(true);
    setBannerError(null);

    const result = await postponeTask({
      note,
      taskId: currentTask.id,
    });

    if (result.error) {
      setBannerError(result.error.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setPendingFeedback('postponed');
    router.back();
  }

  async function submitEdit(currentTask: CareTaskDetail) {
    if (!activityId) {
      setBannerError('Hasil kerja tidak ditemukan.');
      return;
    }

    setSubmitting(true);
    setBannerError(null);

    const result = await updateLatestTaskRealization({
      activityId,
      note,
      produk: status === 'completed' ? produk : undefined,
      proofPhoto: newPhoto
        ? {
            base64: newPhoto.base64,
            fileName: newPhoto.fileName,
            mimeType: newPhoto.mimeType,
            uri: newPhoto.uri,
          }
        : null,
      removeExistingProof: removeExistingPhoto,
      status,
      taskId: currentTask.id,
    });

    if (result.error) {
      setBannerError(result.error.message);
      setSubmitting(false);
      return;
    }

    // Partial-success (mis. foto lama gagal dihapus): tahan di layar ini supaya
    // pekerja melihat peringatannya, bukan langsung kembali diam-diam.
    if (result.data.warningMessage) {
      setBannerError(result.data.warningMessage);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setPendingFeedback('updated');
    router.back();
  }

  if (loading) {
    return <LoadingState message="Memuat tugas..." />;
  }

  const headerTitle = mode === 'edit' ? 'Edit hasil kerja' : 'Catat hasil kerja';

  if (!task) {
    return (
      <Screen header={<TopAppBar title={headerTitle} onBack={() => router.back()} />}>
        <ErrorBanner message={bannerError} />
      </Screen>
    );
  }

  const submitLabel =
    mode === 'edit'
      ? 'Simpan perubahan'
      : status === 'postponed'
        ? 'Simpan penundaan'
        : 'Simpan hasil kerja';

  const showProduk = status === 'completed';

  return (
    <Screen
      header={<TopAppBar title={headerTitle} onBack={() => router.back()} />}
      scrollRef={scrollRef}
      stickyFooter={<Button title={submitLabel} loading={submitting} disabled={submitting} onPress={handleSubmit} />}
    >
      <ErrorBanner message={bannerError} />

      <Text selectable style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
        {`${task.title} · ${formatDate(task.dueDate)}`}
      </Text>

      <View style={{ gap: spacing.sm }}>
        <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
          Hasil pekerjaan
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <ResultOption
            active={status === 'completed'}
            description="Sudah dikerjakan"
            icon="check"
            label="Selesai"
            onPress={() => selectStatus('completed')}
          />
          <ResultOption
            active={status === 'postponed'}
            description="Belum bisa hari ini"
            icon="clock"
            label="Tunda"
            onPress={() => selectStatus('postponed')}
          />
        </View>
      </View>

      {status === 'completed' ? (
        <>
          <TextArea
            label="Catatan"
            onChangeText={setNote}
            placeholder="Contoh: Pekerjaan selesai sesuai instruksi"
            value={note}
          />

          {showProduk ? (
            <View style={{ gap: 7 }}>
              <InlineFieldLabel label="Produk yang dipakai" optional />
              <TextInput
                onChangeText={setProduk}
                placeholder="NPK Mutiara"
                placeholderTextColor={colors.textSoft}
                style={inputStyle}
                value={produk}
              />
            </View>
          ) : null}

          <View style={{ gap: spacing.sm }}>
            <InlineFieldLabel label="Foto" optional={!task.requiresPhoto} required={task.requiresPhoto} />
            <ProofPhotoField
              disabled={submitting}
              imageUri={photoUri}
              onCameraPress={handleTakeFromCamera}
              onDeletePhoto={handleDeletePhoto}
              onGalleryPress={handlePickFromGallery}
            />
            {photoError ? (
              <Text selectable style={{ color: colors.danger, lineHeight: 20 }}>
                {photoError}
              </Text>
            ) : null}
          </View>
        </>
      ) : (
        <TextArea
          label="Alasan tunda"
          error={reasonError}
          onChangeText={(value) => {
            setNote(value);
            if (value.trim()) {
              setReasonError(null);
            }
          }}
          placeholder="Contoh: Stok air belum tersedia"
          value={note}
        />
      )}
    </Screen>
  );
}

const inputStyle = {
  backgroundColor: colors.surface,
  borderColor: colors.border,
  borderCurve: 'continuous' as const,
  borderRadius: radius.md,
  borderWidth: 1,
  color: colors.text,
  fontSize: 16,
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.md,
};

// Slot foto tunggal, dua keadaan, mengikuti pola TreeDetailHero (tree-detail-screen.tsx):
// kosong = kotak dashed + ikon kamera; ada foto = gambar penuh radius 12 dengan
// tombol kamera hijau di pojok kanan-bawah. Sumber foto lewat PhotoSourceSheet bersama.
function ProofPhotoField({
  disabled,
  imageUri,
  onCameraPress,
  onDeletePhoto,
  onGalleryPress,
}: {
  disabled: boolean;
  imageUri: string | null;
  onCameraPress: () => void;
  onDeletePhoto: () => void;
  onGalleryPress: () => void;
}) {
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const hasPhoto = Boolean(imageUri);

  function openSheet() {
    if (disabled) {
      return;
    }

    setSheetOpen(true);
  }

  return (
    <>
      <PhotoSourceSheet
        cameraLabel="Ambil foto"
        deleteLabel="Hapus foto"
        galleryLabel="Pilih galeri"
        hasPhoto={hasPhoto}
        subtitle="Pilih sumber foto."
        title="Foto bukti kerja"
        visible={sheetOpen}
        onCameraPress={() => {
          setSheetOpen(false);
          onCameraPress();
        }}
        onClose={() => setSheetOpen(false)}
        onDeletePhoto={() => {
          setSheetOpen(false);
          onDeletePhoto();
        }}
        onGalleryPress={() => {
          setSheetOpen(false);
          onGalleryPress();
        }}
      />

      {hasPhoto ? (
        <View style={{ borderCurve: 'continuous', borderRadius: 12, overflow: 'hidden' }}>
          <Image resizeMode="cover" source={{ uri: imageUri ?? undefined }} style={{ height: 200, width: '100%' }} />
          <Pressable
            accessibilityLabel="Ubah foto"
            accessibilityRole="button"
            disabled={disabled}
            onPress={openSheet}
            style={{
              alignItems: 'center',
              backgroundColor: colors.primary,
              borderRadius: radius.round,
              bottom: spacing.md,
              height: 38,
              justifyContent: 'center',
              position: 'absolute',
              right: spacing.md,
              width: 38,
            }}
          >
            <Icon name="camera" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityLabel="Tambah foto"
          accessibilityRole="button"
          disabled={disabled}
          onPress={openSheet}
          style={{
            alignItems: 'center',
            backgroundColor: colors.photoPlaceholder,
            borderColor: colors.border,
            borderCurve: 'continuous',
            borderRadius: 12,
            borderStyle: 'dashed',
            borderWidth: 1,
            gap: spacing.sm,
            justifyContent: 'center',
            minHeight: 180,
            padding: spacing.xl,
          }}
        >
          <View
            style={{
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderColor: colors.primaryBorder,
              borderRadius: radius.round,
              borderWidth: 1,
              height: 52,
              justifyContent: 'center',
              width: 52,
            }}
          >
            <Icon name="camera" size={24} color={colors.primary} />
          </View>
          <Text selectable={false} style={{ color: colors.text, fontWeight: '700' }}>
            Tambah foto
          </Text>
        </Pressable>
      )}
    </>
  );
}

function InlineFieldLabel({
  label,
  optional = false,
  required = false,
}: {
  label: string;
  optional?: boolean;
  required?: boolean;
}) {
  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
      <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
        {label}
        {optional ? (
          <Text selectable style={{ color: colors.textMuted, fontWeight: '400' }}>
            {' · opsional'}
          </Text>
        ) : null}
      </Text>
      {required ? <Badge label="Wajib" tone="warning" /> : null}
    </View>
  );
}

function TextArea({
  error,
  label,
  onChangeText,
  placeholder,
  value,
}: {
  error?: string | null;
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
          ...inputStyle,
          minHeight: 96,
          paddingTop: spacing.md,
          textAlignVertical: 'top',
        }}
        value={value}
      />
      {error ? (
        <Text selectable style={{ color: colors.danger, lineHeight: 20 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function ResultOption({
  active,
  description,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  description: string;
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        backgroundColor: active ? colors.primarySoft : colors.surface,
        borderColor: active ? colors.primary : colors.border,
        borderCurve: 'continuous',
        borderRadius: radius.lg,
        borderWidth: active ? 1.5 : 1,
        flex: 1,
        gap: spacing.xs,
        padding: spacing.md,
      }}
    >
      <Icon name={icon} size={20} color={active ? colors.primary : colors.textMuted} />
      <Text selectable style={{ color: active ? colors.primaryDark : colors.text, fontSize: 16, fontWeight: '700' }}>
        {label}
      </Text>
      <Text selectable style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
        {description}
      </Text>
    </Pressable>
  );
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
