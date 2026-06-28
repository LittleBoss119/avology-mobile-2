import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing, typography } from '../constants/theme';
import { createTreeConditionReport } from '../services/conditionReportService';
import { uploadConditionRecordPhoto } from '../services/photoAttachmentService';
import { getTreeDetail } from '../services/treeService';
import { pickImageFromGallery, takePhotoFromCamera } from '../lib/media';
import type { Tree, TreeConditionStatus } from '../types/domain';
import type { PickedPhotoAsset } from '../types/media';
import { formatTreeConditionStatus, formatTreeDisplayCode, formatTreeLocation } from '../utils/treeFormat';
import { ConditionStatusBadge } from './tree-components';
import { Button, Card, ErrorBanner, FormSection, LoadingState, MetaRow, PhotoPickerCard, Screen, TopAppBar } from './ui';

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
  const [conditionStatus, setConditionStatus] = React.useState<TreeConditionStatus | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [note, setNote] = React.useState('');
  const [pendingConditionRecordId, setPendingConditionRecordId] = React.useState<string | null>(null);
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
      setError('Kondisi pohon wajib dipilih.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await createTreeConditionReport({
      conditionStatus,
      farmId: tree.farmId,
      note,
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
          'Laporan kondisi tersimpan, tetapi foto gagal diunggah. Tekan Simpan Kondisi lagi untuk mencoba unggah foto.'
        );
        return;
      }
    }

    setSelectedPhoto(null);
    setSubmitting(false);
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
    const result = await pickImageFromGallery();

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (result.data) {
      setError(null);
      setSelectedPhoto(result.data);
    }
  }

  async function handleTakePhotoFromCamera() {
    const result = await takePhotoFromCamera();

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (result.data) {
      setError(null);
      setSelectedPhoto(result.data);
    }
  }

  if (loading) {
    return <LoadingState message="Memuat pohon..." />;
  }

  return (
    <Screen
      footer={
        <>
          <Button title="Simpan Kondisi" loading={submitting} onPress={handleSubmit} />
          <Button title="Batal" variant="secondary" disabled={submitting} onPress={() => router.back()} />
        </>
      }
    >
      <TopAppBar title="Catat Kondisi" onBack={() => router.back()} />
      <ErrorBanner message={error} />

      {tree ? (
        <Card variant="highlight">
          <Text selectable style={{ color: colors.text, fontSize: typography.h3.fontSize, fontWeight: '800' }}>
            Konteks Pohon
          </Text>
          <MetaRow label="Kode pohon" value={formatTreeDisplayCode(tree)} />
          <MetaRow label="Lokasi" value={formatTreeLocation(tree)} />
          <MetaRow label="Varietas" value={tree.variety ?? 'Belum diisi'} />
          <View style={{ gap: spacing.xs }}>
            <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
              Kondisi terakhir
            </Text>
            <ConditionStatusBadge status={tree.currentCondition} />
          </View>
        </Card>
      ) : null}

      <FormSection title="Kondisi Baru" description="Pilih kondisi terbaru yang terlihat pada pohon.">
        <View style={{ gap: spacing.sm }}>
          {conditionOptions.map((status) => (
            <SelectableOption
              key={status}
              active={conditionStatus === status}
              label={formatTreeConditionStatus(status)}
              onPress={() => setConditionStatus(status)}
            />
          ))}
        </View>
      </FormSection>

      <FormSection title="Catatan" description="Tambahkan gejala, tindakan, atau kondisi visual pohon.">
        <TextArea onChangeText={setNote} placeholder="Opsional" value={note} />
      </FormSection>

      <ConditionPhotoPicker
        disabled={submitting}
        photo={selectedPhoto}
        onCameraPress={handleTakePhotoFromCamera}
        onGalleryPress={handlePickPhotoFromGallery}
        onRemove={() => setSelectedPhoto(null)}
      />
    </Screen>
  );
}

function ConditionPhotoPicker({
  disabled,
  onCameraPress,
  onGalleryPress,
  onRemove,
  photo,
}: {
  disabled: boolean;
  onCameraPress: () => void;
  onGalleryPress: () => void;
  onRemove: () => void;
  photo: PickedPhotoAsset | null;
}) {
  return (
    <PhotoPickerCard
      choosePhotoLabel="Pilih Galeri"
      description="Opsional, untuk mendokumentasikan kondisi pohon."
      imageUri={photo?.uri}
      loading={disabled}
      removeLabel="Hapus Foto"
      takePhotoLabel="Ambil Foto"
      title="Foto Kondisi"
      onChoosePhoto={onGalleryPress}
      onRemovePhoto={photo ? onRemove : undefined}
      onTakePhoto={onCameraPress}
    />
  );
}

function SelectableOption({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: active ? colors.primarySoft : colors.surface,
        borderColor: active ? colors.primary : colors.border,
        borderCurve: 'continuous',
        borderRadius: radius.lg,
        borderWidth: 1,
        padding: spacing.md,
      }}
    >
      <Text selectable style={{ color: active ? colors.primary : colors.text, fontSize: 15, fontWeight: '800' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function TextArea({
  onChangeText,
  placeholder,
  value,
}: {
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
