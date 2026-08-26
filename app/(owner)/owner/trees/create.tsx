import { router, Stack } from 'expo-router';
import React from 'react';
import { Alert } from 'react-native';

import {
  clearResolvedTreeFormErrors,
  formatDateForDb,
  hasTreeFormErrors,
  TreeMainPhotoFormSection,
  TreeForm,
  validateTreeForm,
  type TreeFormErrors,
  type TreeFormValues,
} from '../../../../src/components/tree-components';
import { useSnackbar } from '../../../../src/components/snackbar';
import { Button, ErrorBanner, Screen, TopAppBar } from '../../../../src/components/ui';
import { useAuth } from '../../../../src/context/auth-context';
import { pickImageFromGallery, takePhotoFromCamera } from '../../../../src/lib/media';
import { uploadTreeMainPhoto } from '../../../../src/services/photoAttachmentService';
import { createTree } from '../../../../src/services/treeService';
import type { PickedPhotoAsset } from '../../../../src/types/media';
import { buildTreeDisplayCode } from '../../../../src/utils/treeFormat';

const initialValues: TreeFormValues = {
  rowPosition: '',
  columnPosition: '',
  variety: '',
  plantedAt: null,
};

export default function OwnerCreateTreeScreen() {
  const { currentFarm } = useAuth();
  const showSnackbar = useSnackbar();
  const [error, setError] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<TreeFormErrors>({});
  const [processingPhoto, setProcessingPhoto] = React.useState(false);
  const [selectedPhoto, setSelectedPhoto] = React.useState<PickedPhotoAsset | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [values, setValues] = React.useState<TreeFormValues>(() => ({
    ...initialValues,
    plantedAt: new Date(),
  }));

  function handleValuesChange(next: TreeFormValues) {
    setValues(next);
    setErrors((prev) => clearResolvedTreeFormErrors(prev, next));
  }

  async function handleSubmit() {
    const nextErrors = validateTreeForm(values);

    if (hasTreeFormErrors(nextErrors)) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});

    if (!currentFarm?.farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await createTree({
      farmId: currentFarm.farmId,
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
        farmId: currentFarm.farmId,
        fileName: selectedPhoto.fileName,
        localUri: selectedPhoto.uri,
        mimeType: selectedPhoto.mimeType,
        treeId: result.data.treeId,
      });

      if (photoResult.error) {
        setSubmitting(false);
        Alert.alert(
          'Pohon tersimpan',
          'Pohon tersimpan, tetapi foto gagal diunggah. Foto dapat ditambahkan dari detail pohon.',
          [
            {
              text: 'OK',
              onPress: () => router.replace(`/owner/trees/${result.data.treeId}`),
            },
          ]
        );
        return;
      }
    }

    setSubmitting(false);
    const displayCode = buildTreeDisplayCode(values);
    showSnackbar(displayCode ? `Pohon ${displayCode} ditambahkan` : 'Pohon ditambahkan');
    router.replace('/owner/trees');
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

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        footer={<Button title="Simpan Pohon" loading={submitting} onPress={handleSubmit} />}
        header={<TopAppBar title="Tambah Pohon" onBack={() => router.back()} />}
      >
        <ErrorBanner message={error} />
        <TreeForm errors={errors} values={values} onChange={handleValuesChange} />
        <TreeMainPhotoFormSection
          disabled={submitting}
          photo={selectedPhoto}
          processing={processingPhoto}
          onCameraPress={handleTakePhotoFromCamera}
          onGalleryPress={handlePickPhotoFromGallery}
          onRemoveSelected={() => setSelectedPhoto(null)}
        />
      </Screen>
    </>
  );
}
