import { router, Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert } from 'react-native';

import {
  formatDateForDb,
  parseDbDate,
  TreeMainPhotoFormSection,
  TreeForm,
  type TreeFormValues,
} from '../../../../../src/components/tree-components';
import { Button, ErrorBanner, LoadingState, Screen, TopAppBar } from '../../../../../src/components/ui';
import { pickImageFromGallery, takePhotoFromCamera } from '../../../../../src/lib/media';
import {
  deleteTreeMainPhoto,
  getTreeMainPhoto,
  uploadTreeMainPhoto,
} from '../../../../../src/services/photoAttachmentService';
import { getTreeDetail, updateTree } from '../../../../../src/services/treeService';
import type { PickedPhotoAsset, TreeMainPhoto } from '../../../../../src/types/media';

const initialValues: TreeFormValues = {
  rowPosition: '',
  columnPosition: '',
  variety: '',
  plantedAt: null,
};

export default function OwnerEditTreeScreen() {
  const { treeId } = useLocalSearchParams<{ treeId: string }>();
  const [currentPhoto, setCurrentPhoto] = React.useState<TreeMainPhoto | null>(null);
  const [deletePhotoRequested, setDeletePhotoRequested] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [farmId, setFarmId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedPhoto, setSelectedPhoto] = React.useState<PickedPhotoAsset | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [values, setValues] = React.useState<TreeFormValues>(initialValues);

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

      setValues({
        rowPosition: result.data.rowPosition ?? '',
        columnPosition: result.data.columnPosition ?? '',
        variety: result.data.variety ?? '',
        plantedAt: parseDbDate(result.data.plantedAt),
      });
      setFarmId(result.data.farmId);

      const photoResult = await getTreeMainPhoto(result.data.farmId, result.data.id);

      if (!isMounted) {
        return;
      }

      if (photoResult.error) {
        setCurrentPhoto(null);
      } else {
        setCurrentPhoto(photoResult.data);
      }

      setLoading(false);
    }

    loadTree();

    return () => {
      isMounted = false;
    };
  }, [treeId]);

  async function handleSubmit() {
    const normalizedTreeId = treeId?.trim();

    if (!normalizedTreeId) {
      setError('Data pohon tidak ditemukan.');
      return;
    }

    if (!values.rowPosition.trim() || !values.columnPosition.trim()) {
      setError('Baris dan kolom wajib diisi untuk membuat kode pohon.');
      return;
    }

    if (!farmId) {
      setError('Data kebun pohon tidak ditemukan.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await updateTree({
      treeId: normalizedTreeId,
      rowPosition: values.rowPosition,
      columnPosition: values.columnPosition,
      variety: values.variety,
      plantedAt: formatDateForDb(values.plantedAt),
    });

    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    if (selectedPhoto) {
      const photoResult = await uploadTreeMainPhoto({
        base64: selectedPhoto.base64,
        farmId,
        fileName: selectedPhoto.fileName,
        localUri: selectedPhoto.uri,
        mimeType: selectedPhoto.mimeType,
        treeId: normalizedTreeId,
      });

      if (photoResult.error) {
        setSubmitting(false);
        Alert.alert(
          'Perubahan tersimpan',
          'Data pohon tersimpan, tetapi foto gagal diunggah. Foto dapat ditambahkan dari detail pohon.',
          [
            {
              text: 'OK',
              onPress: () => router.replace(`/owner/trees/${normalizedTreeId}`),
            },
          ]
        );
        return;
      }
    } else if (deletePhotoRequested && currentPhoto) {
      const deleteResult = await deleteTreeMainPhoto({
        farmId,
        treeId: normalizedTreeId,
      });

      if (deleteResult.error) {
        setSubmitting(false);
        Alert.alert(
          'Perubahan tersimpan',
          'Data pohon tersimpan, tetapi foto gagal dihapus. Foto dapat dikelola dari detail pohon.',
          [
            {
              text: 'OK',
              onPress: () => router.replace(`/owner/trees/${normalizedTreeId}`),
            },
          ]
        );
        return;
      }
    }

    setSubmitting(false);
    router.replace(`/owner/trees/${normalizedTreeId}`);
  }

  async function handlePickPhotoFromGallery() {
    const result = await pickImageFromGallery();

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (result.data) {
      setDeletePhotoRequested(false);
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
      setDeletePhotoRequested(false);
      setError(null);
      setSelectedPhoto(result.data);
    }
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <LoadingState message="Memuat data pohon..." />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        footer={
          <>
            <Button title="Simpan Perubahan" loading={submitting} onPress={handleSubmit} />
            <Button
              title="Batal"
              variant="secondary"
              disabled={submitting}
              onPress={() => router.back()}
            />
          </>
        }
      >
        <TopAppBar title="Edit Pohon" onBack={() => router.back()} />
        <ErrorBanner message={error} />
        <TreeForm
          dateSectionDescription="Perbarui tanggal tanam jika ada perubahan."
          dateSectionTitle="Data Pertumbuhan"
          values={values}
          onChange={setValues}
        />
        <TreeMainPhotoFormSection
          currentPhotoUrl={currentPhoto?.signedUrl}
          deleteRequested={deletePhotoRequested}
          disabled={submitting}
          photo={selectedPhoto}
          onCameraPress={handleTakePhotoFromCamera}
          onDeleteExisting={() => {
            setSelectedPhoto(null);
            setDeletePhotoRequested(true);
          }}
          onGalleryPress={handlePickPhotoFromGallery}
          onRemoveSelected={() => setSelectedPhoto(null)}
          onRestoreExisting={() => setDeletePhotoRequested(false)}
        />
      </Screen>
    </>
  );
}
