import { router } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { tokens } from '../constants/theme';
import { createGrowthPhaseRecord } from '../services/growthPhaseService';
import { uploadGrowthPhaseRecordPhoto } from '../services/photoAttachmentService';
import { getTreeDetail } from '../services/treeService';
import { PHOTO_PROCESSING_MESSAGE, pickImageFromGallery, takePhotoFromCamera } from '../lib/media';
import type { GrowthPhase, Tree } from '../types/domain';
import type { PickedPhotoAsset } from '../types/media';
import { formatGrowthPhase, formatTreeDisplayCode, formatTreeLocation } from '../utils/treeFormat';
import { GrowthPhaseBadge } from './tree-components';
import { useSnackbar } from './snackbar';
import { Button, Card, DateField, ErrorBanner, Field, FormSection, LoadingState, MetaRow, OptionGroup, PhotoPickerCard, Screen, TopAppBar } from './ui';

type PhaseFormErrors = { phase?: string };

const phaseOptions: GrowthPhase[] = [
  'initial_planting',
  'vegetative',
  'flowering',
  'fruiting',
  'harvesting',
];

export function TreeGrowthPhaseRecordScreen({
  basePath,
  treeId,
}: {
  basePath: '/owner/trees' | '/worker/trees';
  treeId?: string;
}) {
  const showSnackbar = useSnackbar();
  const [error, setError] = React.useState<string | null>(null);
  const [eventDate, setEventDate] = React.useState(formatDateInput(new Date()));
  const [fieldErrors, setFieldErrors] = React.useState<PhaseFormErrors>({});
  const [loading, setLoading] = React.useState(true);
  const [note, setNote] = React.useState('');
  const [pendingRecordId, setPendingRecordId] = React.useState<string | null>(null);
  const [phase, setPhase] = React.useState<GrowthPhase | null>(null);
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

    // Catatannya SUDAH tersimpan dan yang gagal cuma fotonya: tombol yang sama
    // sekarang berarti "coba unggah lagi", bukan "simpan lagi". Tanpa cabang
    // ini, menekan Simpan akan membuat catatan kedua yang isinya sama.
    if (pendingRecordId) {
      await retryPendingPhotoUpload(pendingRecordId);
      return;
    }

    if (!phase) {
      setFieldErrors({ phase: 'Fase wajib dipilih.' });
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    setError(null);

    const result = await createGrowthPhaseRecord({
      farmId: tree.farmId,
      note,
      phase,
      recordedAt: eventDate,
      treeId: tree.id,
    });

    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    if (selectedPhoto) {
      const photoUploaded = await uploadSelectedPhoto(result.data.recordId);

      if (!photoUploaded) {
        setPendingRecordId(result.data.recordId);
        setSubmitting(false);
        setError(
          'Catatan fase tersimpan, tetapi foto gagal diunggah. Tekan Simpan lagi untuk mencoba unggah foto.'
        );
        return;
      }
    }

    setSelectedPhoto(null);
    finishGrowthPhaseRecord();
  }

  async function retryPendingPhotoUpload(recordId: string) {
    if (!tree) {
      setError('Data pohon tidak ditemukan.');
      return;
    }

    if (!selectedPhoto) {
      setPendingRecordId(null);
      router.replace(`${basePath}/${tree.id}`);
      return;
    }

    setSubmitting(true);
    setError(null);

    const photoUploaded = await uploadSelectedPhoto(recordId);

    if (!photoUploaded) {
      setSubmitting(false);
      setError(
        'Foto masih gagal diunggah. Periksa koneksi atau pilih ulang foto, lalu coba lagi.'
      );
      return;
    }

    setPendingRecordId(null);
    setSelectedPhoto(null);
    setSubmitting(false);
    router.replace(`${basePath}/${tree.id}`);
  }

  async function uploadSelectedPhoto(recordId: string): Promise<boolean> {
    if (!tree || !selectedPhoto) {
      return true;
    }

    const photoResult = await uploadGrowthPhaseRecordPhoto({
      base64: selectedPhoto.base64,
      farmId: tree.farmId,
      fileName: selectedPhoto.fileName,
      growthPhaseRecordId: recordId,
      localUri: selectedPhoto.uri,
      mimeType: selectedPhoto.mimeType,
    });

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

  function finishGrowthPhaseRecord() {
    if (!tree) {
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    showSnackbar('Fase pertumbuhan tercatat');
    router.replace(`${basePath}/${tree.id}`);
  }

  if (loading) {
    return (
      <LoadingState
        header={<TopAppBar title="Catat Fase" onBack={() => router.back()} />}
        message="Memuat pohon..."
      />
    );
  }

  return (
    <Screen
      header={<TopAppBar title="Catat Fase" onBack={() => router.back()} />}
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
          <View style={{ gap: tokens.space.xs }}>
            <Text selectable style={{ color: tokens.color.text.tertiary, ...tokens.type.meta }}>
              Fase saat ini
            </Text>
            {tree.currentGrowthPhase ? (
              <GrowthPhaseBadge phase={tree.currentGrowthPhase} />
            ) : (
              <Text selectable style={{ color: tokens.color.text.primary, ...tokens.type.bodyStrong }}>
                {formatGrowthPhase(tree.currentGrowthPhase)}
              </Text>
            )}
          </View>
        </Card>
      ) : null}

      <FormSection title="Fase baru" description="Pilih fase pertumbuhan terbaru yang terlihat di pohon.">
        <View style={{ gap: tokens.space.sm }}>
          <DateField label="Tanggal catatan *" onChangeDate={setEventDate} value={eventDate} />
          <OptionGroup
            error={fieldErrors.phase}
            options={phaseOptions.map((option) => ({
              disabled: submitting,
              label: formatPhaseOption(option),
              value: option,
            }))}
            value={phase}
            onChange={(value) => {
              setFieldErrors((prev) => ({ ...prev, phase: undefined }));
              setPhase(value as GrowthPhase);
            }}
          />
        </View>
      </FormSection>

      <FormSection title="Catatan" description="Catat tanda pertumbuhan yang terlihat di pohon.">
        <Field label="" multiline onChangeText={setNote} placeholder="Opsional" value={note} />
      </FormSection>

      {/* `processing` dipisahkan dari `disabled` dengan sengaja: `disabled`
          berarti formulirnya sedang disimpan, `processing` berarti fotonya
          sedang diperkecil. Bagi pengguna keduanya kejadian yang berbeda, dan
          hanya yang kedua yang perlu menerangkan dirinya lewat teks. */}
      <PhotoPickerCard
        choosePhotoLabel="Pilih Galeri"
        description={processingPhoto ? PHOTO_PROCESSING_MESSAGE : 'Opsional, untuk mendokumentasikan fase pertumbuhan pohon.'}
        imageUri={selectedPhoto?.uri}
        loading={submitting || processingPhoto}
        removeLabel="Hapus Foto"
        takePhotoLabel="Ambil Foto"
        title="Foto fase"
        onChoosePhoto={handlePickPhotoFromGallery}
        onRemovePhoto={selectedPhoto ? () => setSelectedPhoto(null) : undefined}
        onTakePhoto={handleTakePhotoFromCamera}
      />
    </Screen>
  );
}

function formatPhaseOption(phase: GrowthPhase): string {
  return phase === 'harvesting' ? 'Siap Panen / Panen' : formatGrowthPhase(phase);
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
