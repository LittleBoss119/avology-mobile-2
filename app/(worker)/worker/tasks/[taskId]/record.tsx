import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { BottomSheet, PhotoSourceSheet } from '../../../../../src/components/bottom-sheet';
import { FormDateField } from '../../../../../src/components/care-schedule-components';
import { Icon, type IconName } from '../../../../../src/components/icons';
import {
  Badge,
  Button,
  EmptyState,
  ErrorBanner,
  LoadingState,
  OptionChip,
  Screen,
  TopAppBar,
} from '../../../../../src/components/ui';
import {
  MAX_TAKARAN_BAHAN,
  SATUAN_BAHAN,
  SATUAN_BAHAN_LABELS,
  type SatuanBahan,
} from '../../../../../src/constants/satuanBahan';
import { spacing, tokens } from '../../../../../src/constants/theme';
import { PHOTO_PROCESSING_MESSAGE, pickImageFromGallery, takePhotoFromCamera } from '../../../../../src/lib/media';
import { setPendingFeedback } from '../../../../../src/lib/pendingFeedback';
import {
  completeTask,
  getTaskDetail,
  postponeTask,
  rollbackCompletedTaskActivity,
  updateTaskRealization,
} from '../../../../../src/services/careTaskService';
import {
  listTaskProofPhotosForActivities,
  uploadTaskProofPhoto,
} from '../../../../../src/services/photoAttachmentService';
import type { ActivityStatus, CareActivity, CareTaskDetail } from '../../../../../src/types/domain';
import type { PickedPhotoAsset, TaskProofPhoto } from '../../../../../src/types/media';
import {
  MAX_ANGKA_DESIMAL,
  parseDecimalInput,
  sanitizeDecimalInput,
} from '../../../../../src/utils/decimalInput';
import { addDaysToIsoDate, getTodayIsoDate } from '../../../../../src/utils/taskDueDate';

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

  // Hanya dipakai mode CREATE. Di mode edit, status dibaca dari baris yang
  // sedang diperbaiki (editingActivity) dan tidak bisa digeser sama sekali.
  const [status, setStatus] = React.useState<ActivityStatus>('completed');
  const [editingActivity, setEditingActivity] = React.useState<CareActivity | null>(null);

  const [note, setNote] = React.useState('');
  const [produk, setProduk] = React.useState('');
  const [produkJumlah, setProdukJumlah] = React.useState('');
  const [produkSatuan, setProdukSatuan] = React.useState<SatuanBahan | null>(null);
  const [satuanSheetOpen, setSatuanSheetOpen] = React.useState(false);

  const [newPhoto, setNewPhoto] = React.useState<PickedPhotoAsset | null>(null);
  const [existingProof, setExistingProof] = React.useState<TaskProofPhoto | null>(null);
  const [removeExistingPhoto, setRemoveExistingPhoto] = React.useState(false);

  const [bahanError, setBahanError] = React.useState<string | null>(null);
  const [photoError, setPhotoError] = React.useState<string | null>(null);
  const [processingPhoto, setProcessingPhoto] = React.useState(false);
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  // Default besok: RPC menolak hari ini dan masa lalu, jadi membuka picker di
  // tanggal hari ini hanya akan menyeret pekerja ke pesan error.
  const [postponedUntil, setPostponedUntil] = React.useState(() =>
    addDaysToIsoDate(getTodayIsoDate(), 1)
  );
  const [postponedUntilError, setPostponedUntilError] = React.useState<string | undefined>(undefined);

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

      // Baris yang mau diperbaiki disimpan utuh, bukan dipecah ke beberapa state.
      // Statusnya jadi satu-satunya sumber kebenaran untuk mode edit.
      setEditingActivity(activity ?? null);

      if (activity) {
        setNote(activity.note ?? '');
        setProduk(activity.produk ?? '');
        setProdukJumlah(activity.produkJumlah === null ? '' : String(activity.produkJumlah));
        setProdukSatuan(activity.produkSatuan);
      } else {
        // Dulu form tetap terbuka dengan nilai kosong dan pekerja baru tahu ada
        // yang salah setelah menekan Simpan. Sekarang dikatakan di depan.
        setBannerError('Hasil kerja ini tidak ditemukan.');
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
    setProcessingPhoto(true);

    try {
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
    } finally {
      setProcessingPhoto(false);
    }
  }

  async function handleTakeFromCamera() {
    setProcessingPhoto(true);

    try {
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
    } finally {
      setProcessingPhoto(false);
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
    setBahanError(null);
    setPhotoError(null);
    setReasonError(null);
  }

  // Status yang berlaku di layar ini. Mode edit membacanya dari BARIS-nya, jadi
  // tidak ada jalan bagi pekerja untuk menggesernya lalu mengirim kombinasi yang
  // pasti ditolak RPC (mis. mengisi bahan pada hasil kerja yang ditunda).
  const effectiveStatus: ActivityStatus =
    mode === 'edit' ? editingActivity?.status ?? 'completed' : status;
  const isCompleted = effectiveStatus === 'completed';
  const hasUsableProof = Boolean(newPhoto) || (Boolean(existingProof) && !removeExistingPhoto);
  const photoUri = newPhoto?.uri ?? (existingProof && !removeExistingPhoto ? existingProof.signedUrl : null);

  // Validasi bahan mendahului RPC supaya pekerja dapat jawaban tanpa menunggu
  // jaringan. RPC tetap jadi penjaga terakhir dengan pesan yang sama maksudnya.
  function validateBahan(): string | null {
    const namaBahan = produk.trim();
    const jumlahTeks = produkJumlah.trim();
    const adaTakaran = Boolean(jumlahTeks) || Boolean(produkSatuan);

    if (!adaTakaran) {
      return null;
    }

    if (!namaBahan) {
      return 'Isi nama bahannya dulu.';
    }

    if (!jumlahTeks || !produkSatuan) {
      return 'Isi takaran dan pilih satuannya.';
    }

    const jumlah = parseDecimalInput(jumlahTeks);

    if (jumlah === null) {
      return 'Takaran harus lebih dari 0.';
    }

    // Dijaga di sini, bukan diserahkan ke constraint database. Pelanggaran
    // constraint sampai ke layar sebagai "Terjadi kendala saat memproses data."
    // — kalimat yang tidak memberitahu apa pun tentang angka yang kebesaran.
    if (jumlah > MAX_TAKARAN_BAHAN) {
      return 'Takaran terlalu besar.';
    }

    return null;
  }

  async function handleSubmit() {
    if (!task) {
      return;
    }

    if (isCompleted) {
      const bahanMessage = validateBahan();

      if (bahanMessage) {
        setBahanError(bahanMessage);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        return;
      }
    }

    if (isCompleted && task.requiresPhoto && !hasUsableProof) {
      setPhotoError('Tugas ini butuh bukti foto.');
      scrollRef.current?.scrollToEnd({ animated: true });
      return;
    }

    if (!isCompleted && !note.trim()) {
      setReasonError('Isi alasan penundaan.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    // Cermin dari validasi RPC (migrasi 049). Diperiksa di sini juga supaya
    // pekerja mendapat pesan di sebelah field-nya, bukan banner error dari
    // server.
    if (!isCompleted && postponedUntil <= getTodayIsoDate()) {
      setPostponedUntilError('Pilih tanggal setelah hari ini.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    if (mode === 'edit') {
      await submitEdit();
      return;
    }

    if (isCompleted) {
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
      produkJumlah: parseDecimalInput(produkJumlah),
      produkSatuan,
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
      postponedUntil,
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

  async function submitEdit() {
    if (!activityId) {
      setBannerError('Hasil kerja tidak ditemukan.');
      return;
    }

    setSubmitting(true);
    setBannerError(null);

    // Bahan hanya dikirim untuk baris yang SELESAI. Untuk baris ditunda,
    // ketiganya dikirim null — bukan sekadar tidak ditampilkan, supaya nilai
    // lama pun ikut dibersihkan kalau entah bagaimana pernah terisi.
    const result = await updateTaskRealization({
      activityId,
      note,
      produk: isCompleted ? produk : null,
      produkJumlah: isCompleted ? parseDecimalInput(produkJumlah) : null,
      produkSatuan: isCompleted ? produkSatuan : null,
      proofPhoto: newPhoto
        ? {
            base64: newPhoto.base64,
            fileName: newPhoto.fileName,
            mimeType: newPhoto.mimeType,
            uri: newPhoto.uri,
          }
        : null,
      removeExistingProof: removeExistingPhoto,
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

  // DIANGKAT ke atas cabang memuat: judulnya hanya bergantung pada `mode`, yang
  // sudah diketahui dari params sejak render pertama, sehingga cabang memuat
  // bisa memakai judul yang SAMA dengan layar setelah selesai memuat.
  const headerTitle = mode === 'edit' ? 'Perbaiki catatan' : 'Catat hasil kerja';

  if (loading) {
    return (
      <LoadingState
        header={<TopAppBar title={headerTitle} onBack={() => router.back()} />}
        message="Memuat tugas..."
      />
    );
  }

  if (!task) {
    return (
      <Screen header={<TopAppBar title={headerTitle} onBack={() => router.back()} />}>
        <ErrorBanner message={bannerError} />
      </Screen>
    );
  }

  const submitLabel = mode === 'edit' ? 'Simpan perubahan' : 'Simpan hasil kerja';

  return (
    <Screen
      header={<TopAppBar title={headerTitle} onBack={() => router.back()} />}
      scrollRef={scrollRef}
      stickyFooter={<Button title={submitLabel} loading={submitting} disabled={submitting} onPress={handleSubmit} />}
    >
      <ErrorBanner message={bannerError} />

      <Text selectable style={{ color: tokens.color.text.tertiary, ...tokens.type.meta }}>
        {`${task.title} · ${formatDate(task.dueDate)}`}
      </Text>

      <View style={{ gap: spacing.sm }}>
        <SectionLabel text="Hasil pekerjaan" />
        {mode === 'edit' ? (
          // TERKUNCI, bukan disembunyikan: pekerja tetap harus tahu entri ini
          // Selesai atau Ditunda. Yang tidak boleh adalah mengubahnya —
          // RPC update_task_realization tidak menerima status sama sekali.
          <LockedResultRow status={effectiveStatus} />
        ) : (
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
        )}
      </View>

      {isCompleted ? (
        <>
          {/* Bahan sengaja DI ATAS catatan: ini data terstruktur yang paling
              berharga buat Abah, sementara catatan teks bebas paling gampang
              dilewati. Menukar urutannya menukar juga peluang keduanya diisi. */}
          <BahanFields
            error={bahanError}
            jumlah={produkJumlah}
            nama={produk}
            satuan={produkSatuan}
            onChangeJumlah={(value) => {
              setProdukJumlah(sanitizeDecimalInput(value, MAX_ANGKA_DESIMAL));
              setBahanError(null);
            }}
            onChangeNama={(value) => {
              setProduk(value);
              setBahanError(null);
            }}
            onOpenSatuan={() => setSatuanSheetOpen(true)}
          />

          <View style={{ gap: spacing.sm }}>
            <SectionLabel optional text="Catatan" />
            <NoteInput
              onChangeText={setNote}
              placeholder="Contoh: Pekerjaan selesai sesuai instruksi"
              value={note}
            />
          </View>

          <View style={{ gap: spacing.sm }}>
            <SectionLabel
              optional={!task.requiresPhoto}
              required={task.requiresPhoto}
              text="Foto"
            />
            <ProofPhotoField
              disabled={submitting || processingPhoto}
              imageUri={photoUri}
              processing={processingPhoto}
              onCameraPress={handleTakeFromCamera}
              onDeletePhoto={handleDeletePhoto}
              onGalleryPress={handlePickFromGallery}
            />
            {photoError ? <FieldError message={photoError} /> : null}
          </View>
        </>
      ) : (
        <>
          {/* Tanggal DI ATAS alasan: sejak migrasi 049 penundaan adalah
              penjadwalan ulang, jadi pertanyaan pertamanya "kapan", bukan
              "kenapa". Hanya muncul di mode catat — pada mode perbaiki,
              tanggalnya ikut dikoreksi lewat field yang sama di bawah. */}
          <View style={{ gap: spacing.sm }}>
            <SectionLabel text="Ditunda sampai" />
            <FormDateField
              error={postponedUntilError}
              label=""
              onChangeDate={(value) => {
                setPostponedUntil(value);
                setPostponedUntilError(undefined);
              }}
              value={postponedUntil}
            />
          </View>

          <View style={{ gap: spacing.sm }}>
            <SectionLabel text="Alasan tunda" />
            <NoteInput
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
          </View>
        </>
      )}

      <SatuanSheet
        onClose={() => setSatuanSheetOpen(false)}
        onSelect={(value) => {
          setProdukSatuan(value);
          setBahanError(null);
          setSatuanSheetOpen(false);
        }}
        selected={produkSatuan}
        visible={satuanSheetOpen}
      />
    </Screen>
  );
}

const inputStyle = {
  backgroundColor: tokens.color.surface.card,
  borderColor: tokens.color.line.card,
  borderCurve: 'continuous' as const,
  borderRadius: tokens.radius.control,
  borderWidth: 1,
  color: tokens.color.text.primary,
  fontSize: tokens.type.body.fontSize,
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.md,
};

// Blok "Bahan yang dipakai". Tiga kolom dalam satu baris: nama bahan paling
// lebar (flex), takaran sempit, satuan sedang.
//
// Satuan WAJIB dipilih dari daftar, tidak boleh diketik. Alasannya empiris:
// kolom fruit_condition yang dibiarkan bebas sudah terlanjur berisi "Bagus",
// "Baik", "Good", dan "Good test harvest" — empat nilai untuk satu maksud,
// dari satu orang, dalam 12 baris. Data seperti itu tidak bisa dijumlahkan.
function BahanFields({
  error,
  jumlah,
  nama,
  onChangeJumlah,
  onChangeNama,
  onOpenSatuan,
  satuan,
}: {
  error: string | null;
  jumlah: string;
  nama: string;
  onChangeJumlah: (value: string) => void;
  onChangeNama: (value: string) => void;
  onOpenSatuan: () => void;
  satuan: SatuanBahan | null;
}) {
  const borderColor = error ? tokens.color.status.danger.text : tokens.color.line.card;

  return (
    <View style={{ gap: spacing.sm }}>
      <SectionLabel optional text="Bahan yang dipakai" />
      <View style={{ alignItems: 'stretch', flexDirection: 'row', gap: spacing.sm }}>
        <TextInput
          onChangeText={onChangeNama}
          placeholder="NPK Mutiara"
          placeholderTextColor={tokens.color.text.tertiary}
          style={{ ...inputStyle, borderColor, flex: 1 }}
          value={nama}
        />
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={onChangeJumlah}
          placeholder="0"
          placeholderTextColor={tokens.color.text.tertiary}
          style={{ ...inputStyle, borderColor, textAlign: 'center', width: 76 }}
          value={jumlah}
        />
        <Pressable
          accessibilityLabel={satuan ? `Satuan ${SATUAN_BAHAN_LABELS[satuan]}` : 'Pilih satuan'}
          accessibilityRole="button"
          onPress={onOpenSatuan}
          style={{
            ...inputStyle,
            alignItems: 'center',
            borderColor,
            flexDirection: 'row',
            gap: spacing.xs,
            justifyContent: 'center',
            width: 104,
          }}
        >
          <Text
            numberOfLines={1}
            selectable={false}
            style={{
              color: satuan ? tokens.color.text.primary : tokens.color.text.tertiary,
              fontSize: tokens.type.body.fontSize,
            }}
          >
            {satuan ? SATUAN_BAHAN_LABELS[satuan] : 'Satuan'}
          </Text>
          <Icon name="chevron-down" size={tokens.icon.sm} color={tokens.color.text.tertiary} />
        </Pressable>
      </View>
      {error ? <FieldError message={error} /> : null}
    </View>
  );
}

// Pemilih satuan memakai BottomSheet dan OptionChip yang sudah ada — bukan
// kontrol baru. Chip lebih mudah ditekan satu tangan daripada daftar panjang.
function SatuanSheet({
  onClose,
  onSelect,
  selected,
  visible,
}: {
  onClose: () => void;
  onSelect: (value: SatuanBahan) => void;
  selected: SatuanBahan | null;
  visible: boolean;
}) {
  return (
    <BottomSheet
      onClose={onClose}
      subtitle="Pilih satuan takaran bahan."
      title="Satuan"
      visible={visible}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm }}>
        {SATUAN_BAHAN.map((value) => (
          <OptionChip
            key={value}
            label={SATUAN_BAHAN_LABELS[value]}
            onPress={() => onSelect(value)}
            selected={selected === value}
          />
        ))}
      </View>
    </BottomSheet>
  );
}

// Tampilan status di mode perbaiki. Sengaja memakai bahasa visual "terkunci"
// yang sama dengan Field locked di ui.tsx — permukaan redup, garis rambut, dan
// gembok — supaya terbaca "memang tidak bisa diubah", bukan "tombol mati".
function LockedResultRow({ status }: { status: ActivityStatus }) {
  const isCompleted = status === 'completed';

  return (
    <View
      accessibilityLabel={`Hasil pekerjaan ${isCompleted ? 'Selesai' : 'Ditunda'}, tidak bisa diubah`}
      style={{
        alignItems: 'center',
        backgroundColor: tokens.color.surface.subtle,
        borderColor: tokens.color.line.hairline,
        borderCurve: 'continuous',
        borderRadius: tokens.radius.control,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing.md,
        minHeight: tokens.layout.fieldHeight,
        paddingHorizontal: spacing.lg,
      }}
    >
      <Icon
        name={isCompleted ? 'check' : 'clock'}
        size={tokens.icon.md}
        color={tokens.color.text.secondary}
      />
      <Text
        selectable
        style={{ ...tokens.type.bodyStrong, color: tokens.color.text.secondary, flex: 1 }}
      >
        {isCompleted ? 'Selesai' : 'Ditunda'}
      </Text>
      <Icon name="lock" size={tokens.icon.sm} color={tokens.color.text.tertiary} />
    </View>
  );
}

// Slot foto tunggal, dua keadaan. Kosong memakai EmptyState varian 'dashed'
// yang dibuat di Tahap B, dibungkus Pressable supaya seluruh kotaknya jadi
// target sentuh — bukan cuma ikonnya. Ada foto = gambar penuh dengan tombol
// kamera hijau di pojok. Sumber foto lewat PhotoSourceSheet bersama.
// `processing` dipisahkan dari `disabled` dengan sengaja: `disabled` berarti
// formulirnya sedang dikirim, `processing` berarti fotonya sedang diperkecil.
// Bagi pengguna keduanya kejadian yang berbeda, dan hanya yang kedua yang perlu
// menerangkan dirinya lewat teks. Pemanggilnya menyalakan `disabled` juga selama
// memproses, sehingga bidang ini tidak bisa ditekan dua kali di tengah jalan.
function ProofPhotoField({
  disabled,
  imageUri,
  onCameraPress,
  onDeletePhoto,
  onGalleryPress,
  processing,
}: {
  disabled: boolean;
  imageUri: string | null;
  onCameraPress: () => void;
  onDeletePhoto: () => void;
  onGalleryPress: () => void;
  processing: boolean;
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
        <View style={{ borderCurve: 'continuous', borderRadius: tokens.radius.tile, overflow: 'hidden' }}>
          <Image resizeMode="cover" source={{ uri: imageUri ?? undefined }} style={{ height: 200, width: '100%' }} />
          <Pressable
            accessibilityLabel="Ubah foto"
            accessibilityRole="button"
            disabled={disabled}
            onPress={openSheet}
            style={{
              alignItems: 'center',
              backgroundColor: tokens.color.brand.base,
              borderRadius: tokens.radius.pill,
              bottom: spacing.md,
              height: 38,
              justifyContent: 'center',
              position: 'absolute',
              right: spacing.md,
              width: 38,
            }}
          >
            <Icon name="camera" size={tokens.icon.md} color={tokens.color.brand.on} />
          </Pressable>
        </View>
      ) : (
        <Pressable accessibilityLabel="Tambah foto" accessibilityRole="button" disabled={disabled} onPress={openSheet}>
          <EmptyState
            icon="camera"
            subtitle={processing ? PHOTO_PROCESSING_MESSAGE : 'Pencet untuk ambil atau pilih foto.'}
            title={processing ? 'Menyiapkan foto' : 'Tambah foto'}
            variant="dashed"
          />
        </Pressable>
      )}

      {/* Cabang berfoto tidak memakai EmptyState, jadi keterangannya ditaruh di
          bawah gambar — satu pesan per cabang, tidak pernah keduanya. */}
      {processing && hasPhoto ? (
        <Text selectable style={{ color: tokens.color.text.secondary, ...tokens.type.bodySmall }}>
          {PHOTO_PROCESSING_MESSAGE}
        </Text>
      ) : null}
    </>
  );
}

function SectionLabel({
  optional = false,
  required = false,
  text,
}: {
  optional?: boolean;
  required?: boolean;
  text: string;
}) {
  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
      <Text selectable style={{ color: tokens.color.text.primary, fontSize: 14, fontWeight: '700' }}>
        {text}
        {optional ? (
          <Text selectable style={{ color: tokens.color.text.tertiary, fontWeight: '400' }}>
            {' · opsional'}
          </Text>
        ) : null}
      </Text>
      {required ? <Badge label="Wajib" tone="warning" /> : null}
    </View>
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <Text
      selectable
      style={{
        color: tokens.color.status.danger.text,
        fontSize: tokens.type.meta.fontSize,
        lineHeight: tokens.type.meta.lineHeight,
      }}
    >
      {message}
    </Text>
  );
}

function NoteInput({
  error,
  onChangeText,
  placeholder,
  value,
}: {
  error?: string | null;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <TextInput
        multiline
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.color.text.tertiary}
        style={{
          ...inputStyle,
          borderColor: error ? tokens.color.status.danger.text : tokens.color.line.card,
          minHeight: 96,
          paddingTop: spacing.md,
          textAlignVertical: 'top',
        }}
        value={value}
      />
      {error ? <FieldError message={error} /> : null}
    </View>
  );
}

// Kartu pilihan hasil. Ini target sentuh utama layar ini, jadi sengaja besar:
// satu tangan, satu jempol, tanpa perlu membidik.
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
        backgroundColor: active ? tokens.color.brand.soft : tokens.color.surface.card,
        borderColor: active ? tokens.color.brand.base : tokens.color.line.card,
        borderCurve: 'continuous',
        borderRadius: tokens.radius.card,
        borderWidth: active ? 1.5 : 1,
        flex: 1,
        gap: spacing.sm,
        minHeight: 132,
        padding: spacing.lg,
      }}
    >
      <View
        style={{
          alignItems: 'center',
          backgroundColor: active ? tokens.color.surface.card : tokens.color.surface.subtle,
          borderRadius: tokens.radius.pill,
          height: 44,
          justifyContent: 'center',
          width: 44,
        }}
      >
        <Icon
          name={icon}
          size={tokens.icon.lg}
          color={active ? tokens.color.brand.base : tokens.color.text.tertiary}
        />
      </View>
      <Text
        selectable
        style={{
          ...tokens.type.heading,
          color: active ? tokens.color.brand.dark : tokens.color.text.primary,
        }}
      >
        {label}
      </Text>
      <Text selectable style={{ ...tokens.type.meta, color: tokens.color.text.tertiary }}>
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
