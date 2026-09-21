import { router } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { tokens } from '../constants/theme';
import { createCareActivity } from '../services/careActivityService';
import { uploadInitiativeCareProofPhoto } from '../services/photoAttachmentService';
import { getTreeDetail } from '../services/treeService';
import { PHOTO_PROCESSING_MESSAGE, pickImageFromGallery, takePhotoFromCamera } from '../lib/media';
import type { CareCategory, Tree } from '../types/domain';
import type { PickedPhotoAsset } from '../types/media';
import { formatCareCategory } from '../utils/displayFormat';
import { formatTreeDisplayCode, formatTreeLocation } from '../utils/treeFormat';
import { careCategoryOptions } from '../constants/careCategory';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import { ConfirmDialog } from './bottom-sheet';
import { useSnackbar } from './snackbar';
import { Button, Card, DateField, ErrorBanner, Field, FormSection, LoadingState, MetaRow, OptionGroup, PhotoPickerCard, Screen, TopAppBar } from './ui';

type CareFormErrors = { category?: string };

// Pencatatan perawatan inisiatif untuk SATU pohon: pohonnya ditentukan oleh
// konteks route (user masuk dari detail pohon tertentu), jadi tidak ada pemilih
// pohon di sini -- konteksnya sudah jelas dan memilih ulang justru rancu.
//
// Model datanya tetap many-to-many (care_activity_trees): dari jalur ini
// isinya selalu 1 baris. Pencatatan multi-pohon akan punya layar dan titik
// masuk sendiri, terpisah dari detail pohon.
//
// SATU foto opsional (migrasi 060, entity_type 'initiative_care_proof').
//
// Kegagalan unggah TIDAK membatalkan catatannya. Perilakunya mengikuti layar
// catat kondisi, bukan layar bukti kerja terjadwal: catatan tetap tersimpan,
// pesannya menawarkan coba lagi, dan tombol Simpan berubah jadi tombol unggah
// ulang. Foto di sini memang tidak wajib -- membatalkan catatan yang sudah sah
// karena fotonya gagal naik adalah hukuman untuk kesalahan yang bukan milik
// penggunanya.
export function TreeCareActivityScreen({
  basePath,
  treeId,
}: {
  basePath: '/owner/trees' | '/worker/trees';
  treeId?: string;
}) {
  const showSnackbar = useSnackbar();
  const [category, setCategory] = React.useState<CareCategory | ''>('');
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [eventDate, setEventDate] = React.useState(formatDateInput(new Date()));
  // Titik nol pembanding "ada perubahan". Penginisialisasi useState hanya
  // dibaca pada render pertama, jadi nilainya terkunci pada tanggal yang
  // PERTAMA ditampilkan — bukan tanggal hari ini yang dihitung ulang.
  const [initialEventDate] = React.useState(eventDate);
  const [fieldErrors, setFieldErrors] = React.useState<CareFormErrors>({});
  const [loading, setLoading] = React.useState(true);
  const [note, setNote] = React.useState('');
  const [pendingActivityId, setPendingActivityId] = React.useState<string | null>(null);
  const [processingPhoto, setProcessingPhoto] = React.useState(false);
  const [produk, setProduk] = React.useState('');
  const [selectedPhoto, setSelectedPhoto] = React.useState<PickedPhotoAsset | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [tree, setTree] = React.useState<Tree | null>(null);

  React.useEffect(() => {
    let isMounted = true;

    async function loadTree() {
      if (!treeId) {
        setError('Data pohon tidak ditemukan.');
        setLoading(false);
        return;
      }

      setError(null);
      const result = await getTreeDetail({ treeId });

      if (!isMounted) {
        return;
      }

      if (result.error) {
        setError(result.error.message);
        setLoading(false);
        return;
      }

      if (basePath === '/worker/trees' && result.data.isArchived) {
        setError('Pohon yang diarsipkan tidak tersedia untuk pekerja.');
        setLoading(false);
        return;
      }

      setTree(result.data);
      setLoading(false);
    }

    loadTree();

    return () => {
      isMounted = false;
    };
  }, [basePath, treeId]);

  async function handleSubmit() {
    if (!tree) {
      setError('Data pohon tidak ditemukan.');
      return;
    }

    // Catatannya sudah tersimpan pada percobaan sebelumnya; yang tersisa cuma
    // fotonya. Menyimpan ulang di sini akan membuat catatan kembar.
    if (pendingActivityId) {
      await retryPendingPhotoUpload(pendingActivityId);
      return;
    }

    if (!category) {
      setFieldErrors({ category: 'Jenis perawatan wajib dipilih.' });
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    setError(null);

    const result = await createCareActivity({
      category,
      farmId: tree.farmId,
      note,
      performedAt: eventDate,
      produk,
      treeIds: [tree.id],
    });

    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    if (selectedPhoto) {
      const photoUploaded = await uploadSelectedPhoto(result.data.activityId);

      if (!photoUploaded) {
        setPendingActivityId(result.data.activityId);
        setSubmitting(false);
        setError(
          'Perawatan tersimpan, tetapi foto gagal diunggah. Tekan Simpan lagi untuk mencoba unggah foto.'
        );
        return;
      }
    }

    setSelectedPhoto(null);
    setSubmitting(false);
    showSnackbar('Perawatan tercatat');
    router.replace(`${basePath}/${tree.id}`);
  }

  async function retryPendingPhotoUpload(activityId: string) {
    if (!tree) {
      setError('Data pohon tidak ditemukan.');
      return;
    }

    // Fotonya sudah dilepas pengguna. Catatannya tetap sah tanpa foto, jadi
    // tidak ada yang perlu diulang -- tinggal keluar.
    if (!selectedPhoto) {
      setPendingActivityId(null);
      showSnackbar('Perawatan tercatat');
      router.replace(`${basePath}/${tree.id}`);
      return;
    }

    setSubmitting(true);
    setError(null);

    const photoUploaded = await uploadSelectedPhoto(activityId);

    if (!photoUploaded) {
      setSubmitting(false);
      setError(
        'Foto masih gagal diunggah. Periksa koneksi atau pilih ulang foto, lalu coba lagi.'
      );
      return;
    }

    setPendingActivityId(null);
    setSelectedPhoto(null);
    setSubmitting(false);
    showSnackbar('Perawatan tercatat');
    router.replace(`${basePath}/${tree.id}`);
  }

  async function uploadSelectedPhoto(activityId: string): Promise<boolean> {
    if (!tree || !selectedPhoto) {
      return true;
    }

    const photoResult = await uploadInitiativeCareProofPhoto({
      activityId,
      base64: selectedPhoto.base64,
      farmId: tree.farmId,
      fileName: selectedPhoto.fileName,
      localUri: selectedPhoto.uri,
      mimeType: selectedPhoto.mimeType,
    });

    if (photoResult.error && typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[care-photo-upload-failed]', {
        activityId,
        code: photoResult.error.code ?? null,
        farmId: tree.farmId,
        message: photoResult.error.message,
        rawMessage: photoResult.error.rawMessage ?? null,
        treeId: tree.id,
      });
    }

    return !photoResult.error;
  }

  async function handlePickPhotoFromGallery() {
    setProcessingPhoto(true);

    try {
      const result = await pickImageFromGallery();

      if (result.error) {
        setError(result.error.message);
        return;
      }

      if (result.data) {
        setError(null);
        setSelectedPhoto(result.data);
      }
    } finally {
      setProcessingPhoto(false);
    }
  }

  async function handleTakePhotoFromCamera() {
    setProcessingPhoto(true);

    try {
      const result = await takePhotoFromCamera();

      if (result.error) {
        setError(result.error.message);
        return;
      }

      if (result.data) {
        setError(null);
        setSelectedPhoto(result.data);
      }
    } finally {
      setProcessingPhoto(false);
    }
  }

  // PENJAGA PERUBAHAN BELUM DISIMPAN (batch 7b, langkah 2a).
  //
  // Sebelum ini, menekan chevron kembali di tengah pengisian membuang seluruh
  // isian tanpa sepatah kata pun — termasuk foto yang baru saja diambil di
  // kebun, yang tidak bisa diambil ulang begitu pohonnya ditinggalkan.
  //
  // Pola dan kata-katanya sama persis dengan lima layar edit yang sudah
  // berpenjaga sejak batch 6; yang berbeda hanya kalimat dialognya, karena di
  // sini yang hilang adalah CATATAN BARU, bukan perubahan atas catatan lama.
  const hasUnsavedChanges = category !== '' ||
    produk.trim() !== '' ||
    note.trim() !== '' ||
    selectedPhoto !== null ||
    eventDate !== initialEventDate;

  const { handleBackPress } = useUnsavedChangesGuard({
    // Saat penyimpanan atau pemrosesan foto berjalan, dialog tidak ditawarkan:
    // tidak ada gunanya menanyakan "buang isian" untuk isian yang sedang
    // dikirim, dan keluar di tengah pemrosesan foto akan meninggalkan pekerjaan
    // yang hasilnya tidak punya tujuan.
    hasUnsavedChanges: hasUnsavedChanges && !submitting && !processingPhoto,
    onBlocked: () => setConfirmDiscard(true),
    onLeave: () => {
      if (submitting) {
        return;
      }

      router.back();
    },
  });

  if (loading) {
    return (
      <LoadingState
        header={<TopAppBar title="Catat perawatan" onBack={() => router.back()} />}
        message="Memuat pohon..."
      />
    );
  }

  return (
    <Screen
      header={<TopAppBar title="Catat perawatan" onBack={handleBackPress} />}
      stickyFooter={<Button title="Simpan" loading={submitting} onPress={handleSubmit} />}
    >
      <ErrorBanner message={error} />

      {tree ? (
        <Card variant="highlight">
          <Text selectable style={{ color: tokens.color.text.primary, ...tokens.type.subheading }}>
            Konteks Pohon
          </Text>
          <MetaRow label="Kode pohon" value={formatTreeDisplayCode(tree)} />
          <MetaRow label="Lokasi" value={formatTreeLocation(tree)} />
          <MetaRow label="Varietas" value={tree.activePlanting?.variety ?? 'Belum diisi'} />
        </Card>
      ) : null}

      <FormSection title="Jenis perawatan" description="Catat aktivitas perawatan yang dilakukan tanpa jadwal tugas.">
        <View style={{ gap: tokens.space.sm }}>
          <DateField label="Tanggal perawatan *" onChangeDate={setEventDate} value={eventDate} />
          <OptionGroup
            error={fieldErrors.category}
            label="Jenis perawatan *"
            options={careCategoryOptions.map((option) => ({
              disabled: submitting,
              label: formatCareCategory(option),
              value: option,
            }))}
            value={category}
            onChange={(value) => {
              setFieldErrors((prev) => ({ ...prev, category: undefined }));
              setCategory(value as CareCategory);
            }}
          />
        </View>
      </FormSection>

      <FormSection title="Produk yang dipakai" description="Opsional. Merek pupuk atau pestisida yang digunakan.">
        <Field label="" onChangeText={setProduk} placeholder="Opsional" value={produk} />
      </FormSection>

      <FormSection title="Catatan perawatan">
        <Field label="" multiline onChangeText={setNote} placeholder="Opsional" value={note} />
      </FormSection>

      <CarePhotoPicker
        disabled={submitting}
        photo={selectedPhoto}
        processing={processingPhoto}
        onCameraPress={handleTakePhotoFromCamera}
        onGalleryPress={handlePickPhotoFromGallery}
        onRemove={() => setSelectedPhoto(null)}
      />

      {/* Dialog penjaga. Tombol batalnya yang merusak ("Buang isian"), dan
          tombol utamanya yang aman ("Lanjut isi") — susunan yang sama dengan
          seluruh dialog penjaga lain di aplikasi ini. */}
      <ConfirmDialog
        cancelLabel="Buang isian"
        cancelTone="danger"
        confirmLabel="Lanjut isi"
        message="Catatan perawatan ini belum disimpan. Kalau keluar sekarang, isian itu hilang."
        onCancel={() => {
          setConfirmDiscard(false);
          router.back();
        }}
        onConfirm={() => setConfirmDiscard(false)}
        title="Isian belum disimpan"
        visible={confirmDiscard}
      />
    </Screen>
  );
}

// Kembaran ConditionPhotoPicker di tree-condition-report-screen.tsx, dengan
// pemisahan `processing` dari `disabled` yang sama: `disabled` berarti
// formulirnya sedang disimpan, `processing` berarti fotonya sedang diperkecil.
// Bagi pengguna keduanya kejadian yang berbeda, dan hanya yang kedua yang perlu
// menerangkan dirinya lewat teks.
function CarePhotoPicker({
  disabled,
  onCameraPress,
  onGalleryPress,
  onRemove,
  photo,
  processing,
}: {
  disabled: boolean;
  onCameraPress: () => void;
  onGalleryPress: () => void;
  onRemove: () => void;
  photo: PickedPhotoAsset | null;
  processing: boolean;
}) {
  return (
    // `changeHint` DITAMBAHKAN di batch 5, bersama pencabutan tombol silang
    // berikon-saja dari <PhotoPickerCard>. Layar ini wilayah batch 6; yang
    // dikerjakan di sini hanya menjaga "Hapus foto" tetap punya afordans yang
    // terlihat setelah tombol silangnya pergi.
    <PhotoPickerCard
      changeHint="Ketuk foto untuk mengganti atau menghapusnya."
      choosePhotoLabel="Pilih galeri"
      description={processing ? PHOTO_PROCESSING_MESSAGE : 'Opsional, untuk mendokumentasikan perawatan yang dilakukan.'}
      imageUri={photo?.uri}
      loading={disabled || processing}
      removeLabel="Hapus foto"
      takePhotoLabel="Ambil foto"
      title="Foto perawatan"
      onChoosePhoto={onGalleryPress}
      onRemovePhoto={photo ? onRemove : undefined}
      onTakePhoto={onCameraPress}
    />
  );
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
