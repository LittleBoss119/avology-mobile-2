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
import {
  EndTreePlantingSheet,
  type EndTreePlantingFormValues,
} from '../../../../../src/components/tree-planting-sheets';
import {
  Button,
  EmptyState,
  ErrorBanner,
  LoadingState,
  Screen,
  TopAppBar,
} from '../../../../../src/components/ui';
import { pickImageFromGallery, takePhotoFromCamera } from '../../../../../src/lib/media';
import { setPendingFeedback } from '../../../../../src/lib/pendingFeedback';
import {
  deleteTreeMainPhoto,
  getTreeMainPhoto,
  uploadTreeMainPhoto,
} from '../../../../../src/services/photoAttachmentService';
import { endTreePlanting, getTreeDetail, updateTree } from '../../../../../src/services/treeService';
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
  const [hasActivePlanting, setHasActivePlanting] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [processingPhoto, setProcessingPhoto] = React.useState(false);
  const [selectedPhoto, setSelectedPhoto] = React.useState<PickedPhotoAsset | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [values, setValues] = React.useState<TreeFormValues>(initialValues);
  // Menutup siklus tanam: state-nya TERPISAH dari state form di atas.
  //
  // cycleError bukan `error` layar, dengan alasan yang sama seperti di layar
  // detail sebelum aksi ini pindah ke sini: galatnya harus tampil DI DALAM sheet
  // yang gagal, tepat di atas tombolnya — bukan di balik sheet, di tempat yang
  // tidak terlihat selama sheet-nya masih terbuka.
  const [cycleError, setCycleError] = React.useState<string | null>(null);
  const [cycleLoading, setCycleLoading] = React.useState(false);
  const [endSheetOpen, setEndSheetOpen] = React.useState(false);

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

      // Posisi tanpa siklus tanam aktif TIDAK BOLEH merender form.
      //
      // update_tree_with_planting menolaknya dengan pesan "Posisi ini tidak
      // punya pohon aktif" (056:151-154), sementara form di bawah tetap terisi —
      // dengan varietas dan tanggal tanam KOSONG, karena keduanya diambil dari
      // activePlanting yang tidak ada. Hasilnya layar yang tampak bisa diisi dan
      // disimpan, padahal setiap penyimpanan pasti ditolak. Yang benar adalah
      // mengatakannya sebelum orang mengetik apa pun.
      setHasActivePlanting(Boolean(result.data.activePlanting));

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

  // Menutup siklus tanam. BENTUKNYA BERBEDA dari runStartPlanting di layar
  // detail, dan perbedaannya disengaja.
  //
  // Sukses TIDAK menutup sheet lalu memuat ulang layar ini. Ia langsung pergi.
  // Alasannya: begitu siklusnya berakhir, layar ini tidak bisa menyimpan apa pun
  // lagi — update_tree_with_planting menolak posisi tanpa siklus aktif — jadi
  // merendernya ulang menghasilkan form yang tampak bisa diisi padahal setiap
  // penyimpanan pasti ditolak. Persis keadaan yang cabang hasActivePlanting di
  // atas ada untuk mencegahnya, dan tidak masuk akal membuatnya sendiri.
  //
  // router.replace, BUKAN push: layar ini sudah tidak sah dikunjungi lagi, jadi
  // ia tidak boleh tertinggal di back-stack menunggu ditekan kembali.
  //
  // Snackbar-nya dititipkan lewat pendingFeedback karena layar yang seharusnya
  // menampilkannya sudah tidak ada saat pesannya jatuh tempo. Layar detail
  // membacanya di useFocusEffect miliknya.
  //
  // Isian form yang belum disimpan HILANG di sini, dan itu diterima:
  // penanda "pohon sudah tidak ada" membuat isian itu tidak bisa disimpan ke
  // mana pun. Tidak ada useUnsavedChangesGuard yang dipasang untuk memperingatkan
  // — peringatan yang menawarkan "batalkan" pada perubahan yang sudah pasti
  // tidak bisa disimpan cuma menunda pemiliknya.
  //
  // Sheet yang GAGAL sengaja tetap terbuka: galatnya tampil di dalamnya lewat
  // cycleError dan pilihan pemiliknya tidak hilang.
  // Parameternya `sheetValues`, BUKAN `values`: di berkas ini `values` sudah
  // berarti isian form pohon, dan dua arti untuk satu nama di satu fungsi adalah
  // jebakan yang menunggu penyunting berikutnya.
  async function runEndPlanting(sheetValues: EndTreePlantingFormValues) {
    const normalizedTreeId = treeId?.trim();

    if (!normalizedTreeId) {
      setCycleError('Data pohon tidak ditemukan.');
      return;
    }

    setCycleLoading(true);
    setCycleError(null);

    const result = await endTreePlanting({
      endReason: sheetValues.endReason,
      endedAt: sheetValues.endedAt,
      treeId: normalizedTreeId,
    });

    if (result.error) {
      setCycleError(result.error.message);
      setCycleLoading(false);
      return;
    }

    setCycleLoading(false);
    setPendingFeedback('planting_ended');
    router.replace(`/owner/trees/${normalizedTreeId}`);
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <LoadingState message="Memuat data pohon..." />
      </>
    );
  }

  // KEADAAN B: posisi tanpa pohon aktif. Form tidak dirender sama sekali —
  // alasannya di komentar pada setHasActivePlanting di atas.
  //
  // Satu tombol keluar, bukan dua: menanam pohon baru dilakukan dari layar
  // detail, dan menawarkannya di sini berarti pintu kedua ke aksi yang sama.
  if (!hasActivePlanting) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <Screen header={<TopAppBar title="Edit Pohon" onBack={() => router.back()} />}>
          <ErrorBanner message={error} />
          <EmptyState
            title="Posisi ini belum ditanami"
            subtitle="Data pohon hanya bisa diubah selama ada pohon yang sedang ditanam di posisi ini. Tanam pohon lebih dulu dari layar detail."
          />
          <Button
            title="Kembali ke detail pohon"
            variant="secondary"
            onPress={() => router.replace(`/owner/trees/${treeId}`)}
          />
        </Screen>
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

        {/* Aksi merusak duduk DI BAWAH form, di atas footer — bukan di footer
            bersama "Simpan Perubahan".
            Footer adalah tempat aksi utama layar ini, dan menaruh dua tombol
            yang artinya berlawanan berdampingan di sana membuat keduanya
            sama-sama terlihat seperti "selesai". Di badan layar, ia harus
            digulung untuk ditemukan — sepadan dengan seberapa jarang ia dipakai:
            mungkin sekali seumur pohon.

            Nada 'danger' di sini merah LEMBUT (latar status.danger.bg, teks
            status.danger.text), bukan tombol merah pekat. */}
        <Button
          title="Pohon sudah tidak ada"
          variant="danger"
          disabled={submitting}
          onPress={() => {
            setCycleError(null);
            setEndSheetOpen(true);
          }}
        />

        <EndTreePlantingSheet
          error={cycleError}
          loading={cycleLoading}
          onClose={() => setEndSheetOpen(false)}
          onSubmit={runEndPlanting}
          visible={endSheetOpen}
        />
      </Screen>
    </>
  );
}
