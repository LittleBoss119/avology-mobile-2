import { router } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { colors, spacing, typography } from '../constants/theme';
import { createTreeConditionReport } from '../services/conditionReportService';
import { uploadConditionRecordPhoto } from '../services/photoAttachmentService';
import { getTreeDetail } from '../services/treeService';
import { PHOTO_PROCESSING_MESSAGE, pickImageFromGallery, takePhotoFromCamera } from '../lib/media';
import type { Tree, TreeConditionStatus } from '../types/domain';
import type { PickedPhotoAsset } from '../types/media';
import { formatTreeConditionStatus, formatTreeContextLine } from '../utils/treeFormat';
import { ConditionStatusBadge } from './tree-components';
import { useSnackbar } from './snackbar';
import {
  Button,
  ChoiceRowGroup,
  CONDITION_BADGE,
  DateField,
  ErrorBanner,
  Field,
  LoadingState,
  PhotoPickerCard,
  Screen,
  TopAppBar,
} from './ui';

type ConditionFormErrors = { conditionStatus?: string };

// ENAM, bukan lima. Spek redesign mendaftar lima kondisi; aplikasi punya enam
// (lihat TreeConditionStatus di types/domain.ts, dan enum tree_condition_status
// di migrasi 001). 'damaged' adalah yang keenam, dan urutannya di sini —
// sehat, perlu perhatian, hama, sakit, rusak, mati — berjalan dari tidak ada
// masalah ke keadaan akhir.
const conditionOptions: TreeConditionStatus[] = [
  'healthy',
  'needs_attention',
  'pest_attacked',
  'disease_indicated',
  'damaged',
  'dead',
];

export function TreeConditionReportScreen({
  basePath,
  treeId,
}: {
  basePath: '/owner/trees' | '/worker/trees';
  treeId?: string;
}) {
  const showSnackbar = useSnackbar();
  const [conditionStatus, setConditionStatus] = React.useState<TreeConditionStatus | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [eventDate, setEventDate] = React.useState(formatDateInput(new Date()));
  const [fieldErrors, setFieldErrors] = React.useState<ConditionFormErrors>({});
  const [loading, setLoading] = React.useState(true);
  const [note, setNote] = React.useState('');
  const [pendingConditionRecordId, setPendingConditionRecordId] = React.useState<string | null>(null);
  const [processingPhoto, setProcessingPhoto] = React.useState(false);
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

    if (pendingConditionRecordId) {
      await retryPendingPhotoUpload(pendingConditionRecordId);
      return;
    }

    if (!conditionStatus) {
      setFieldErrors({ conditionStatus: 'Kondisi wajib dipilih.' });
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    setError(null);

    const result = await createTreeConditionReport({
      conditionStatus,
      farmId: tree.farmId,
      note,
      reportedAt: eventDate,
      treeId: tree.id,
    });

    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    if (selectedPhoto) {
      const photoUploaded = await uploadSelectedPhoto(result.data.reportId);

      if (!photoUploaded) {
        setPendingConditionRecordId(result.data.reportId);
        setSubmitting(false);
        setError(
          'Laporan kondisi tersimpan, tetapi foto gagal diunggah. Tekan Simpan lagi untuk mencoba unggah foto.'
        );
        return;
      }
    }

    setSelectedPhoto(null);
    setSubmitting(false);
    showSnackbar('Kondisi pohon tercatat');
    router.replace(`${basePath}/${tree.id}`);
  }

  async function retryPendingPhotoUpload(conditionRecordId: string) {
    if (!tree) {
      setError('Data pohon tidak ditemukan.');
      return;
    }

    if (!selectedPhoto) {
      setPendingConditionRecordId(null);
      router.replace(`${basePath}/${tree.id}`);
      return;
    }

    setSubmitting(true);
    setError(null);

    const photoUploaded = await uploadSelectedPhoto(conditionRecordId);

    if (!photoUploaded) {
      setSubmitting(false);
      setError(
        'Foto masih gagal diunggah. Periksa koneksi atau pilih ulang foto, lalu coba lagi.'
      );
      return;
    }

    setPendingConditionRecordId(null);
    setSelectedPhoto(null);
    setSubmitting(false);
    router.replace(`${basePath}/${tree.id}`);
  }

  async function uploadSelectedPhoto(conditionRecordId: string): Promise<boolean> {
    if (!tree || !selectedPhoto) {
      return true;
    }

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.debug('[condition-photo-upload]', {
        assetId: selectedPhoto.assetId,
        base64Length: selectedPhoto.base64?.length ?? null,
        conditionRecordId,
        farmId: tree.farmId,
        fileName: selectedPhoto.fileName,
        fileSize: selectedPhoto.fileSize,
        hasBase64: Boolean(selectedPhoto.base64),
        mimeType: selectedPhoto.mimeType,
        treeId: tree.id,
        uriPrefix: selectedPhoto.uri.slice(0, 32),
      });
    }

    const photoResult = await uploadConditionRecordPhoto({
      base64: selectedPhoto.base64,
      conditionRecordId,
      farmId: tree.farmId,
      fileName: selectedPhoto.fileName,
      localUri: selectedPhoto.uri,
      mimeType: selectedPhoto.mimeType,
    });

    if (photoResult.error && typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[condition-photo-upload-failed]', {
        code: photoResult.error.code ?? null,
        conditionRecordId,
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

  if (loading) {
    return (
      <LoadingState
        header={<TopAppBar title="Catat kondisi" onBack={() => router.back()} />}
        message="Memuat pohon..."
      />
    );
  }

  return (
    // URUTAN TETAP, sama di ketiga form catatan: konteks pohon -> satu pilihan
    // utama besar -> isian angka/tanggal -> foto -> catatan -> satu tombol
    // Simpan yang menempel di bar bawah. Form boleh menggulir; tidak ada field
    // yang dibuang supaya muat.
    <Screen
      autoScrollOnFocus
      header={<TopAppBar title="Catat kondisi" onBack={() => router.back()} />}
      stickyFooter={<Button title="Simpan" loading={submitting} onPress={handleSubmit} />}
    >
      <ErrorBanner message={error} />

      {/* Kartu "Konteks Pohon" berjudul dengan tiga MetaRow DICABUT, diganti
          satu baris yang literalnya sama persis dengan layar detail catatan dan
          layar edit catatan (formatTreeContextLine). Ketiganya bertetangga
          dalam satu alur, jadi konteks pohonnya tidak boleh berganti bentuk di
          tengah jalan. Kondisi terakhir tetap ditampilkan — ia yang sedang
          dikoreksi oleh catatan ini — tapi sebagai baris, bukan sebagai baris
          keempat di dalam kartu. */}
      {tree ? (
        <View style={{ gap: spacing.sm }}>
          <Text
            selectable
            style={{
              color: colors.textMuted,
              fontSize: typography.small.fontSize,
              lineHeight: typography.small.lineHeight,
            }}
          >
            {formatTreeContextLine(tree)}
          </Text>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
            <Text
              selectable
              style={{
                color: colors.textMuted,
                fontSize: typography.small.fontSize,
                lineHeight: typography.small.lineHeight,
              }}
            >
              Kondisi terakhir
            </Text>
            <ConditionStatusBadge status={tree.currentCondition} />
          </View>
        </View>
      ) : null}

      {/* PILIHAN UTAMA. Baris penuh setinggi 56, bukan chip yang membungkus —
          enam pilihan berbaris ke bawah dipindai sekali lihat, sementara enam
          chip yang terbungkus jadi tiga baris tak beraturan harus dibaca satu
          per satu.

          Penanda bentuk dan warnanya dibaca dari CONDITION_BADGE, tabel yang
          SAMA yang melayani badge kondisi, sel denah, baris daftar pohon, dan
          penanda timeline. Tidak ada pemetaan kedua di berkas ini; getConditionTone
          dihapus di batch 4b justru karena ia pemetaan kedua semacam itu. */}
      <ChoiceRowGroup
        error={fieldErrors.conditionStatus}
        label="Kondisi pohon"
        options={conditionOptions.map((status) => ({
          disabled: submitting,
          label: formatTreeConditionStatus(status),
          marker: {
            color: CONDITION_BADGE[status].markerColor,
            shape: CONDITION_BADGE[status].shape,
          },
          value: status,
        }))}
        value={conditionStatus}
        onChange={(value) => {
          setFieldErrors((prev) => ({ ...prev, conditionStatus: undefined }));
          setConditionStatus(value as TreeConditionStatus);
        }}
      />

      <DateField label="Tanggal catatan" onChangeDate={setEventDate} value={eventDate} />

      <ConditionPhotoPicker
        disabled={submitting}
        photo={selectedPhoto}
        processing={processingPhoto}
        onCameraPress={handleTakePhotoFromCamera}
        onGalleryPress={handlePickPhotoFromGallery}
        onRemove={() => setSelectedPhoto(null)}
      />

      {/* Label kolom, bukan judul bagian berkartu. Imbuhan '(boleh kosong)'
          ditulis prop `optional`, bukan diketik ke dalam label maupun
          disembunyikan di placeholder. */}
      <Field
        label="Catatan"
        multiline
        optional
        onChangeText={setNote}
        placeholder="Gejala, tindakan, atau kondisi visual pohon"
        value={note}
      />
    </Screen>
  );
}

// `processing` dipisahkan dari `disabled` dengan sengaja: `disabled` berarti
// formulirnya sedang disimpan, `processing` berarti fotonya sedang diperkecil.
// Bagi pengguna keduanya kejadian yang berbeda, dan hanya yang kedua yang perlu
// menerangkan dirinya lewat teks.
function ConditionPhotoPicker({
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
    <PhotoPickerCard
      changeHint="Ketuk foto untuk mengganti atau menghapusnya."
      choosePhotoLabel="Pilih galeri"
      description={processing ? PHOTO_PROCESSING_MESSAGE : 'Untuk mendokumentasikan kondisi pohon.'}
      imageUri={photo?.uri}
      loading={disabled || processing}
      optional
      removeLabel="Hapus foto"
      takePhotoLabel="Ambil foto"
      title="Foto kondisi"
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
