import { router } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

import { colors, typography } from '../constants/theme';
import { createGrowthPhaseRecord } from '../services/growthPhaseService';
import { uploadGrowthPhaseRecordPhoto } from '../services/photoAttachmentService';
import { getTreeDetail } from '../services/treeService';
import { PHOTO_PROCESSING_MESSAGE, pickImageFromGallery, takePhotoFromCamera } from '../lib/media';
import type { GrowthPhase, Tree } from '../types/domain';
import type { PickedPhotoAsset } from '../types/media';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import { formatGrowthPhase, formatTreeContextLine } from '../utils/treeFormat';
import { ConfirmDialog } from './bottom-sheet';
import { useSnackbar } from './snackbar';
import {
  Button,
  ChoiceRowGroup,
  DateField,
  ErrorBanner,
  Field,
  LoadingState,
  PhotoPickerCard,
  Screen,
  TopAppBar,
} from './ui';

type PhaseFormErrors = { phase?: string };

// URUTAN KANONIK, dan ia MENGIKAT: awal tanam -> vegetatif -> berbunga ->
// berbuah -> panen. Sama persis dengan urutan anggota enum growth_phase
// (migrasi 001). Jangan diurut alfabetis maupun menurut frekuensi pemakaian:
// daftar ini adalah sebuah JALAN, dan jalan yang diacak berhenti menjadi jalan.
//
// 'unrecorded' TIDAK ADA di sini dan tidak boleh ditambahkan. Ia bukan anggota
// enum growth_phase sama sekali — ia nilai SARINGAN di lib/treeBrowseState.ts
// yang mewakili "fase belum pernah dicatat", yaitu currentGrowthPhase bernilai
// NULL. Tidak ada yang bisa mencatat pohon sebagai "belum dicatat".
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
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [eventDate, setEventDate] = React.useState(formatDateInput(new Date()));
  // Titik nol pembanding "ada perubahan". Penginisialisasi useState hanya
  // dibaca pada render pertama, jadi nilainya terkunci pada tanggal yang
  // PERTAMA ditampilkan — bukan tanggal hari ini yang dihitung ulang.
  const [initialEventDate] = React.useState(eventDate);
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

  // PENJAGA PERUBAHAN BELUM DISIMPAN (batch 7b, langkah 2a).
  //
  // Sebelum ini, menekan chevron kembali di tengah pengisian membuang seluruh
  // isian tanpa sepatah kata pun — termasuk foto yang baru saja diambil di
  // kebun, yang tidak bisa diambil ulang begitu pohonnya ditinggalkan.
  //
  // Pola dan kata-katanya sama persis dengan lima layar edit yang sudah
  // berpenjaga sejak batch 6; yang berbeda hanya kalimat dialognya, karena di
  // sini yang hilang adalah CATATAN BARU, bukan perubahan atas catatan lama.
  const hasUnsavedChanges = phase !== null ||
    note.trim() !== '' ||
    selectedPhoto !== null ||
    eventDate !== initialEventDate;

  const { handleBackPress } = useUnsavedChangesGuard({
    // Saat penyimpanan atau pemrosesan foto berjalan, dialog tidak ditawarkan:
    // tidak ada gunanya menanyakan "buang isian" untuk isian yang sedang
    // dikirim, dan keluar di tengah pemrosesan foto akan meninggalkan pekerjaan
    // yang hasilnya tidak punya tujuan.
    hasUnsavedChanges: hasUnsavedChanges && !submitting && !processingPhoto,
    onBlocked: () => setConfirmDiscard(true),
    onLeave: () => {
      if (submitting) {
        return;
      }

      router.back();
    },
  });

  if (loading) {
    return (
      <LoadingState
        header={<TopAppBar title="Catat fase" onBack={() => router.back()} />}
        message="Memuat pohon..."
      />
    );
  }

  return (
    // URUTAN TETAP, sama di ketiga form catatan — lihat catatan di
    // tree-condition-report-screen.tsx.
    <Screen
      autoScrollOnFocus
      header={<TopAppBar title="Catat fase" onBack={handleBackPress} />}
      stickyFooter={<Button title="Simpan" loading={submitting} onPress={handleSubmit} />}
    >
      <ErrorBanner message={error} />

      {/* Blok "Fase saat ini" DICABUT dari sini, dan isinya tidak hilang: fase
          yang sedang berjalan kini ditandai PADA BARIS PILIHANNYA SENDIRI di
          bawah. Menyebutnya dua kali — sekali di kepala layar, sekali lagi
          sebagai salah satu dari lima tombol — memaksa pembacanya mencocokkan
          sendiri mana yang mana.

          Yang ikut pergi: <GrowthPhaseBadge> di layar INI. Badge itu mengambil
          nadanya dari getGrowthPhaseTone, dan tiga dari lima fase jatuh ke nada
          'muted' yang teksnya `textMuted` — warna yang sama persis dengan
          placeholder kolom isian. Fase yang sedang berlaku adalah keadaan
          nyata, bukan saran dan bukan isian kosong. */}
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

      {/* PILIHAN UTAMA. Baris penuh setinggi 56, urutan kanonik.

          TANPA PENANDA BENTUK, dan itu keputusan sadar: tidak ada tabel bentuk
          untuk fase pertumbuhan di repo ini, dan aturan yang sudah tertulis
          pada prop `marker` di <Badge> menyebut nama fase sebagai contoh chip
          yang harus tetap polos — penanda bentuk adalah kosakata STATUS.
          Mengarang lima bentuk baru di sini berarti kosakata kedua yang harus
          dipelajari terpisah, untuk daftar yang urutannya sendiri sudah
          menjelaskan hubungan antaranggotanya. */}
      <ChoiceRowGroup
        error={fieldErrors.phase}
        label="Fase pertumbuhan"
        options={phaseOptions.map((option) => ({
          disabled: submitting,
          highlighted: option === tree?.currentGrowthPhase,
          label: formatPhaseOption(option),
          meta: option === tree?.currentGrowthPhase ? 'fase sekarang' : undefined,
          value: option,
        }))}
        value={phase}
        onChange={(value) => {
          setFieldErrors((prev) => ({ ...prev, phase: undefined }));
          setPhase(value as GrowthPhase);
        }}
      />

      <DateField label="Tanggal catatan" onChangeDate={setEventDate} value={eventDate} />

      {/* `processing` dipisahkan dari `disabled` dengan sengaja: `disabled`
          berarti formulirnya sedang disimpan, `processing` berarti fotonya
          sedang diperkecil. Bagi pengguna keduanya kejadian yang berbeda, dan
          hanya yang kedua yang perlu menerangkan dirinya lewat teks. */}
      <PhotoPickerCard
        changeHint="Ketuk foto untuk mengganti atau menghapusnya."
        choosePhotoLabel="Pilih galeri"
        description={processingPhoto ? PHOTO_PROCESSING_MESSAGE : 'Untuk mendokumentasikan fase pertumbuhan pohon.'}
        imageUri={selectedPhoto?.uri}
        loading={submitting || processingPhoto}
        optional
        removeLabel="Hapus foto"
        takePhotoLabel="Ambil foto"
        title="Foto fase"
        onChoosePhoto={handlePickPhotoFromGallery}
        onRemovePhoto={selectedPhoto ? () => setSelectedPhoto(null) : undefined}
        onTakePhoto={handleTakePhotoFromCamera}
      />

      <Field
        label="Catatan"
        multiline
        optional
        onChangeText={setNote}
        placeholder="Tanda pertumbuhan yang terlihat di pohon"
        value={note}
      />

      {/* Dialog penjaga. Tombol batalnya yang merusak ("Buang isian"), dan
          tombol utamanya yang aman ("Lanjut isi") — susunan yang sama dengan
          seluruh dialog penjaga lain di aplikasi ini. */}
      <ConfirmDialog
        cancelLabel="Buang isian"
        cancelTone="danger"
        confirmLabel="Lanjut isi"
        message="Catatan fase ini belum disimpan. Kalau keluar sekarang, isian itu hilang."
        onCancel={() => {
          setConfirmDiscard(false);
          router.back();
        }}
        onConfirm={() => setConfirmDiscard(false)}
        title="Isian belum disimpan"
        visible={confirmDiscard}
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
