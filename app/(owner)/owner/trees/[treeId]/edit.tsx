import { router, Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert } from 'react-native';

import {
  clearResolvedTreeFormErrors,
  formatDateForDb,
  hasTreeFormErrors,
  parseDbDate,
  TreeMainPhotoFormSection,
  TreeForm,
  validateTreeForm,
  type TreeFormErrors,
  type TreeFormValues,
} from '../../../../../src/components/tree-components';
import { useSnackbar } from '../../../../../src/components/snackbar';
import { Button, ErrorBanner, LoadingState, Screen, TopAppBar } from '../../../../../src/components/ui';
import { pickImageFromGallery, takePhotoFromCamera } from '../../../../../src/lib/media';
import {
  deleteTreeMainPhoto,
  getTreeMainPhoto,
  uploadTreeMainPhoto,
} from '../../../../../src/services/photoAttachmentService';
import { getTreeDetail, updateTree } from '../../../../../src/services/treeService';
import type { PickedPhotoAsset, TreeMainPhoto } from '../../../../../src/types/media';
import { buildTreeDisplayCode } from '../../../../../src/utils/treeFormat';

const initialValues: TreeFormValues = {
  rowPosition: '',
  columnPosition: '',
  variety: '',
  plantedAt: null,
};

export default function OwnerEditTreeScreen() {
  const { treeId } = useLocalSearchParams<{ treeId: string }>();
  const showSnackbar = useSnackbar();
  const [currentPhoto, setCurrentPhoto] = React.useState<TreeMainPhoto | null>(null);
  const [deletePhotoRequested, setDeletePhotoRequested] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<TreeFormErrors>({});
  const [farmId, setFarmId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [processingPhoto, setProcessingPhoto] = React.useState(false);
  const [selectedPhoto, setSelectedPhoto] = React.useState<PickedPhotoAsset | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [values, setValues] = React.useState<TreeFormValues>(initialValues);

  function handleValuesChange(next: TreeFormValues) {
    setValues(next);
    setErrors((prev) => clearResolvedTreeFormErrors(prev, next));
  }

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
        // rowPosition kini number (smallint di database, migrasi 054) sementara
        // field form selalu string — String() menjembataninya. `?? ''` saja
        // tidak cukup: ia menghasilkan number, bukan string.
        rowPosition: result.data.rowPosition === null ? '' : String(result.data.rowPosition),
        columnPosition: result.data.columnPosition ?? '',
        // Diambil dari siklus AKTIF — itulah satu-satunya siklus yang boleh
        // dikoreksi. Pohon yang siklusnya sudah ditutup tidak punya
        // activePlanting, dan update_tree_with_planting akan menolaknya.
        variety: result.data.activePlanting?.variety ?? '',
        plantedAt: parseDbDate(result.data.activePlanting?.plantedAt ?? null),
      });
      setFarmId(result.data.farmId);

      // Foto siklus lampau tidak boleh muncul sebagai foto yang sedang diedit:
      // menyimpan form akan membuatnya seolah foto pohon yang sekarang.
      const photoResult = await getTreeMainPhoto(
        result.data.farmId,
        result.data.id,
        result.data.activePlanting?.id ?? null
      );

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

    const nextErrors = validateTreeForm(values);

    if (hasTreeFormErrors(nextErrors)) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});

    if (!farmId) {
      setError('Data kebun pohon tidak ditemukan.');
      return;
    }

    setSubmitting(true);
    setError(null);

    // MENGOREKSI, bukan menanam ulang. update_tree_with_planting (migrasi 056)
    // memperbarui posisi di trees dan varietas serta tanggal tanam pada siklus
    // yang sedang AKTIF, dalam satu transaksi — cycle_no tidak naik dan tidak
    // ada siklus baru yang lahir.
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
    const displayCode = buildTreeDisplayCode(values);
    showSnackbar(displayCode ? `Pohon ${displayCode} diperbarui` : 'Pohon diperbarui');
    router.replace(`/owner/trees/${normalizedTreeId}`);
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
        setDeletePhotoRequested(false);
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
        setDeletePhotoRequested(false);
        setError(null);
        setSelectedPhoto(result.data);
      }
    } finally {
      setProcessingPhoto(false);
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
        footer={<Button title="Simpan Perubahan" loading={submitting} onPress={handleSubmit} />}
        header={<TopAppBar title="Edit Pohon" onBack={() => router.back()} />}
      >
        <ErrorBanner message={error} />
        <TreeForm errors={errors} values={values} onChange={handleValuesChange} />
        <TreeMainPhotoFormSection
          currentPhotoUrl={currentPhoto?.signedUrl}
          deleteRequested={deletePhotoRequested}
          disabled={submitting}
          photo={selectedPhoto}
          processing={processingPhoto}
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
