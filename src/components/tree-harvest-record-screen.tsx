import { router } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import {
  GRADE_PANEN,
  GRADE_PANEN_LABELS,
  MAX_BERAT_PANEN_KG,
  type GradePanen,
} from '../constants/gradePanen';
import { colors, spacing, typography } from '../constants/theme';
import { createHarvestRecord } from '../services/harvestService';
import { uploadHarvestRecordPhoto } from '../services/photoAttachmentService';
import { getTreeDetail } from '../services/treeService';
import { PHOTO_PROCESSING_MESSAGE, pickImageFromGallery, takePhotoFromCamera } from '../lib/media';
import type { Tree } from '../types/domain';
import type { PickedPhotoAsset } from '../types/media';
import { MAX_ANGKA_DESIMAL, parseDecimalInput, sanitizeDecimalInput } from '../utils/decimalInput';
import { formatTreeContextLine } from '../utils/treeFormat';
import { useSnackbar } from './snackbar';
import {
  Button,
  DateField,
  ErrorBanner,
  Field,
  LoadingState,
  OptionGroup,
  PhotoPickerCard,
  Screen,
  TopAppBar,
} from './ui';

type HarvestFormErrors = { jumlah?: string };

export function TreeHarvestRecordScreen({
  basePath,
  treeId,
}: {
  basePath: '/owner/trees' | '/worker/trees';
  treeId?: string;
}) {
  const showSnackbar = useSnackbar();
  const [error, setError] = React.useState<string | null>(null);
  const [eventDate, setEventDate] = React.useState(formatDateInput(new Date()));
  const [fieldErrors, setFieldErrors] = React.useState<HarvestFormErrors>({});
  const [grade, setGrade] = React.useState<GradePanen | null>(null);
  const [beratKg, setBeratKg] = React.useState('');
  const [fruitCount, setFruitCount] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [note, setNote] = React.useState('');
  const [pendingRecordId, setPendingRecordId] = React.useState<string | null>(null);
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
    // ini, menekan Simpan akan membuat catatan panen kedua yang isinya sama --
    // dan panen ganda langsung merusak angka target kebun.
    if (pendingRecordId) {
      await retryPendingPhotoUpload(pendingRecordId);
      return;
    }

    const jumlahMessage = validateJumlahPanen();

    if (jumlahMessage) {
      setFieldErrors({ jumlah: jumlahMessage });
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    setError(null);

    const result = await createHarvestRecord({
      farmId: tree.farmId,
      fruitCondition: grade,
      fruitCount: fruitCount.trim() ? Number(fruitCount) : null,
      harvestWeightKg: parseDecimalInput(beratKg),
      harvestedAt: eventDate,
      note,
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
          'Catatan panen tersimpan, tetapi foto gagal diunggah. Tekan Simpan lagi untuk mencoba unggah foto.'
        );
        return;
      }
    }

    setSelectedPhoto(null);
    setSubmitting(false);
    showSnackbar('Panen tercatat');
    router.replace(`${basePath}/${tree.id}`);
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

    const photoResult = await uploadHarvestRecordPhoto({
      base64: selectedPhoto.base64,
      farmId: tree.farmId,
      fileName: selectedPhoto.fileName,
      harvestRecordId: recordId,
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

  // Minimal salah satu dari berat atau jumlah buah. Cerminan constraint
  // harvest_records_amount_present_check, dan RPC menegakkan aturan yang sama —
  // ini hanya supaya pekerja dapat jawaban tanpa menunggu jaringan.
  function validateJumlahPanen(): string | null {
    const beratTeks = beratKg.trim();
    const jumlahTeks = fruitCount.trim();

    if (!beratTeks && !jumlahTeks) {
      return 'Isi berat panen atau jumlah buah, minimal salah satu.';
    }

    if (beratTeks) {
      const berat = parseDecimalInput(beratTeks);

      if (berat === null) {
        return 'Berat panen harus lebih dari 0.';
      }

      // Dijaga di sini, bukan diserahkan ke constraint database. Pelanggaran
      // constraint sampai ke layar sebagai "Terjadi kendala saat memproses
      // data." — kalimat yang tidak menyebut angka mana yang kebesaran.
      if (berat > MAX_BERAT_PANEN_KG) {
        return 'Berat panen terlalu besar.';
      }
    }

    if (jumlahTeks) {
      const jumlah = Number(jumlahTeks);

      if (!Number.isInteger(jumlah) || jumlah <= 0) {
        return 'Jumlah buah harus lebih dari 0.';
      }
    }

    return null;
  }

  if (loading) {
    return (
      <LoadingState
        header={<TopAppBar title="Catat panen" onBack={() => router.back()} />}
        message="Memuat pohon..."
      />
    );
  }

  return (
    // URUTAN TETAP, sama di ketiga form catatan — lihat catatan di
    // tree-condition-report-screen.tsx. Di layar ini pilihan utamanya grade,
    // lalu isian angkanya, lalu tanggal, foto, catatan, Simpan.
    <Screen
      autoScrollOnFocus
      header={<TopAppBar title="Catat panen" onBack={() => router.back()} />}
      stickyFooter={<Button title="Simpan" loading={submitting} onPress={handleSubmit} />}
    >
      <ErrorBanner message={error} />

      {tree ? (
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
      ) : null}

      {/* GRADE: A1 / A2 / A3, TIGA nilai dan tidak ada yang keempat.
          Spek redesign menulis "grade (A/B/C/Campur)" dan itu salah pada dua
          hal sekaligus. Nilainya dikunci check constraint
          harvest_records_fruit_condition_grade_check (migrasi 045):
          `fruit_condition is null or fruit_condition in ('A1','A2','A3')`.
          Dan "Campur" bertentangan dengan aturan satu grade per catatan —
          panen bergrade campuran dicatat sebagai beberapa catatan terpisah.
          Mengubahnya butuh migrasi, dan itu di luar lingkup redesign.

          TIGA chip, bukan baris penuh: baris penuh dipakai untuk daftar 4-6
          pilihan status. Tiga chip pendek muat dalam satu baris dan tidak
          membungkus.

          Menekan chip yang sudah aktif MEMBATALKAN pilihan — grade memang
          boleh kosong, dan constraint-nya sendiri mengizinkan NULL. */}
      <OptionGroup
        label="Grade"
        options={GRADE_PANEN.map((option) => ({
          disabled: submitting,
          label: GRADE_PANEN_LABELS[option],
          value: option,
        }))}
        value={grade}
        onChange={(value) => setGrade(grade === value ? null : (value as GradePanen))}
      />

      {/* DUA KOLOM SEJAJAR, berat di KIRI. Seluruh target pemilik kebun
          berbasis kilogram (2 kg/m², 13 ton dari 6.500 m²), jadi berat adalah
          metrik utama dan jumlah buah sekunder — dan pada baris yang dibaca
          dari kiri ke kanan, kiri adalah posisi yang didahulukan.

          SATUAN DI DALAM KOLOM lewat prop `unit`, bukan diimbuhkan ke label.
          Label "Berat panen (kg)" memaksa mata bolak-balik ke label untuk
          memastikan angka yang barusan diketik satuannya benar. */}
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Field
            error={fieldErrors.jumlah}
            keyboardType="decimal-pad"
            label="Berat panen"
            onChangeText={(value) => {
              setBeratKg(sanitizeDecimalInput(value, MAX_ANGKA_DESIMAL));
              setFieldErrors((prev) => ({ ...prev, jumlah: undefined }));
            }}
            placeholder="12,5"
            unit="kg"
            value={beratKg}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            keyboardType="number-pad"
            label="Jumlah buah"
            onChangeText={(value) => {
              setFruitCount(value.replace(/[^0-9]/g, ''));
              setFieldErrors((prev) => ({ ...prev, jumlah: undefined }));
            }}
            placeholder="12"
            unit="buah"
            value={fruitCount}
          />
        </View>
      </View>

      {/* KEDUANYA TIDAK DITANDAI `optional`, dan itu bukan kelalaian: masing-
          masing memang boleh kosong, tapi tidak keduanya sekaligus (constraint
          harvest_records_amount_present_check). '(boleh kosong)' pada keduanya
          akan menjanjikan form yang bisa disimpan tanpa angka sama sekali. */}
      <Text
        selectable
        style={{
          color: colors.textMuted,
          fontSize: typography.meta.fontSize,
          lineHeight: typography.meta.lineHeight,
        }}
      >
        Isi berat panen, jumlah buah, atau keduanya — minimal salah satu.
      </Text>

      <DateField label="Tanggal panen" onChangeDate={setEventDate} value={eventDate} />

      {/* `processing` dipisahkan dari `disabled` dengan sengaja: `disabled`
          berarti formulirnya sedang disimpan, `processing` berarti fotonya
          sedang diperkecil. Bagi pengguna keduanya kejadian yang berbeda, dan
          hanya yang kedua yang perlu menerangkan dirinya lewat teks. */}
      <PhotoPickerCard
        changeHint="Ketuk foto untuk mengganti atau menghapusnya."
        choosePhotoLabel="Pilih galeri"
        description={processingPhoto ? PHOTO_PROCESSING_MESSAGE : 'Untuk mendokumentasikan hasil panen.'}
        imageUri={selectedPhoto?.uri}
        loading={submitting || processingPhoto}
        optional
        removeLabel="Hapus foto"
        takePhotoLabel="Ambil foto"
        title="Foto panen"
        onChoosePhoto={handlePickPhotoFromGallery}
        onRemovePhoto={selectedPhoto ? () => setSelectedPhoto(null) : undefined}
        onTakePhoto={handleTakePhotoFromCamera}
      />

      <Field
        label="Catatan"
        multiline
        optional
        onChangeText={setNote}
        placeholder="Keterangan tambahan tentang panen ini"
        value={note}
      />
    </Screen>
  );
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
