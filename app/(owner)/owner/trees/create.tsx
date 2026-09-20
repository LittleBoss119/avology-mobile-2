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
import { createTree, getTrees } from '../../../../src/services/treeService';
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
  // Kode posisi yang SUDAH TERISI di kebun ini.
  //
  // getTrees adalah service yang SUDAH ADA dan sudah dipakai daftar pohon serta
  // denah dengan argumen yang sama persis — tidak ada query, RPC, maupun
  // penghitung baru. Dimuat sekali saat layar dibuka, disaring di klien.
  //
  // null berarti belum selesai dimuat ATAU gagal dimuat, dan keduanya
  // menghasilkan hal yang sama: baris konfirmasi tidak dirender. GAGAL DIAM-
  // DIAM, tanpa ErrorBanner — yang hilang cuma satu baris keterangan, dan
  // penjaga yang sebenarnya tetap berdiri di database (trees_position_unique).
  // Memerahkan layar untuk keterangan yang tidak wajib akan menghalangi pemilik
  // menambah pohon karena hal yang tidak menghalanginya sama sekali.
  const [takenCodes, setTakenCodes] = React.useState<Set<string> | null>(null);

  const farmId = currentFarm?.farmId;

  React.useEffect(() => {
    if (!farmId) {
      return;
    }

    let active = true;

    void getTrees({ archived: false, farmId }).then((result) => {
      if (!active) {
        return;
      }

      if (result.error) {
        setTakenCodes(null);
        return;
      }

      setTakenCodes(
        new Set(
          result.data.map((tree) => `${tree.rowPosition}-${tree.columnPosition}`.toUpperCase())
        )
      );
    });

    return () => {
      active = false;
    };
  }, [farmId]);

  // Baris konfirmasi hanya bisa berbicara kalau KEDUA kolom sudah terisi dan
  // daftar posisi sudah terbaca. Selama salah satunya belum, ia null dan
  // barisnya tidak dirender — bukan dirender sebagai "memeriksa...".
  //
  // Kuncinya dirakit dengan cara yang sama persis dengan peta denah
  // (farm-map-screen: `${rowPosition}-${columnPosition}`), supaya kedua sisi
  // pencocokan tidak bisa berbeda bentuk.
  const positionStatus = React.useMemo(() => {
    const row = values.rowPosition.trim();
    const column = values.columnPosition.trim().toUpperCase();

    if (!row || !column || takenCodes === null) {
      return null;
    }

    const code = `${row}-${column}`;

    return { code, occupied: takenCodes.has(code) };
  }, [takenCodes, values.columnPosition, values.rowPosition]);

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
        footer={<Button title="Simpan pohon" loading={submitting} onPress={handleSubmit} />}
        header={<TopAppBar title="Tambah pohon" onBack={() => router.back()} />}
      >
        <ErrorBanner message={error} />
        <TreeForm
          errors={errors}
          mode="create"
          positionStatus={positionStatus}
          values={values}
          onChange={handleValuesChange}
        />
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
