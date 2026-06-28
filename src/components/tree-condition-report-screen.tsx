import { router } from 'expo-router';
import React from 'react';
import { Image, Text, TextInput, View } from 'react-native';

import { createTreeConditionReport } from '../services/conditionReportService';
import { uploadConditionRecordPhoto } from '../services/photoAttachmentService';
import { getTreeDetail } from '../services/treeService';
import { pickImageFromGallery, takePhotoFromCamera } from '../lib/media';
import type { Tree, TreeConditionStatus } from '../types/domain';
import type { PickedPhotoAsset } from '../types/media';
import { formatTreeConditionStatus, formatTreeLocation } from '../utils/treeFormat';
import { ConditionStatusBadge } from './tree-components';
import { Button, Card, ErrorBanner, LoadingState, MetaRow, Screen, TopAppBar } from './ui';

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
        <Card>
          <MetaRow label="Kode pohon" value={tree.treeCode} />
          <MetaRow label="Lokasi" value={formatTreeLocation(tree)} />
          <MetaRow label="Varietas" value={tree.variety} />
          <Text selectable style={{ color: '#68746D', fontSize: 13 }}>
            Kondisi terakhir
          </Text>
          <ConditionStatusBadge status={tree.currentCondition} />
        </Card>
      ) : null}

      <Card>
        <Text selectable style={{ color: '#1E2A24', fontSize: 16, fontWeight: '700' }}>
          Kondisi baru
        </Text>
        <View style={{ gap: 10 }}>
          {conditionOptions.map((status) => (
            <Button
              key={status}
              title={formatTreeConditionStatus(status)}
              variant={conditionStatus === status ? 'primary' : 'secondary'}
              onPress={() => setConditionStatus(status)}
            />
          ))}
        </View>
      </Card>

      <TextArea label="Catatan" onChangeText={setNote} placeholder="Opsional" value={note} />

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
    <Card>
      <View style={{ gap: 5 }}>
        <Text selectable style={{ color: '#1E2A24', fontSize: 16, fontWeight: '800' }}>
          Foto Kondisi
        </Text>
        <Text selectable style={{ color: '#68746D', lineHeight: 20 }}>
          Opsional, untuk mendokumentasikan kondisi pohon.
        </Text>
      </View>

      {photo ? (
        <View style={{ gap: 10 }}>
          <Image
            resizeMode="cover"
            source={{ uri: photo.uri }}
            style={{
              borderRadius: 12,
              height: 150,
              width: '100%',
            }}
          />
          <Button disabled={disabled} title="Hapus Foto" variant="secondary" onPress={onRemove} />
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button disabled={disabled} title="Ambil Foto" variant="secondary" onPress={onCameraPress} />
        </View>
        <View style={{ flex: 1 }}>
          <Button disabled={disabled} title="Pilih Galeri" variant="secondary" onPress={onGalleryPress} />
        </View>
      </View>
    </Card>
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
      <Text selectable style={{ color: '#1E2A24', fontSize: 14, fontWeight: '600' }}>
        {label}
      </Text>
      <TextInput
        multiline
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A098"
        style={{
          backgroundColor: '#FFFFFF',
          borderColor: '#DDE4DA',
          borderCurve: 'continuous',
          borderRadius: 8,
          borderWidth: 1,
          color: '#1E2A24',
          fontSize: 16,
          minHeight: 96,
          paddingHorizontal: 14,
          paddingTop: 12,
          textAlignVertical: 'top',
        }}
        value={value}
      />
    </View>
  );
}
