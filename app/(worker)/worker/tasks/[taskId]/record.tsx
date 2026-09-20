import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { BottomSheet, ConfirmDialog } from '../../../../../src/components/bottom-sheet';
import { FormDateField } from '../../../../../src/components/care-schedule-components';
import { useUnsavedChangesGuard } from '../../../../../src/hooks/useUnsavedChangesGuard';
import { Icon, type IconName } from '../../../../../src/components/icons';
import {
  Badge,
  Button,
  ErrorBanner,
  LoadingState,
  OptionChip,
  OptionGroup,
  PhotoPickerCard,
  Screen,
  TopAppBar,
} from '../../../../../src/components/ui';
import {
  MAX_TAKARAN_BAHAN,
  SATUAN_BAHAN,
  SATUAN_BAHAN_LABELS,
  type SatuanBahan,
} from '../../../../../src/constants/satuanBahan';
import { spacing, tokens } from '../../../../../src/constants/theme';
import { colors as palette } from '../../../../../src/theme/tokens';
import { PHOTO_PROCESSING_MESSAGE, pickImageFromGallery, takePhotoFromCamera } from '../../../../../src/lib/media';
import { setPendingFeedback } from '../../../../../src/lib/pendingFeedback';
import {
  completeTask,
  getTaskDetail,
  postponeTask,
  rollbackCompletedTaskActivity,
  updateTaskRealization,
} from '../../../../../src/services/careTaskService';
import {
  listTaskProofPhotosForActivities,
  uploadTaskProofPhoto,
} from '../../../../../src/services/photoAttachmentService';
import type { ActivityStatus, CareActivity, CareTaskDetail } from '../../../../../src/types/domain';
import type { PickedPhotoAsset, TaskProofPhoto } from '../../../../../src/types/media';
import {
  MAX_ANGKA_DESIMAL,
  parseDecimalInput,
  sanitizeDecimalInput,
} from '../../../../../src/utils/decimalInput';
import { addDaysToIsoDate, getTodayIsoDate } from '../../../../../src/utils/taskDueDate';

type RecordMode = 'create' | 'edit';

// SATU kalimat, dipakai DUA kali: dicetak di bawah deret pilihan, dan jadi
// accessibilityHint kartu Tunda yang terkunci. Kalau ia disalin jadi dua
// literal, yang terlihat dan yang dibacakan pembaca layar akan berbeda pelan-
// pelan — dan yang paling jarang diperiksa justru yang kedua.
//
// SENGAJA TIDAK MENAMAI KEADAANNYA. Keadaan ini belum punya istilah di layar
// pekerja, dan satu-satunya kata yang tersedia — "Terlambat" — sudah dipakai
// untuk keadaan yang MASIH boleh ditunda (daftar tugas melipat 'missed' ke
// section itu, dan dueDatePill berbunyi "Terlambat N hari" untuk keduanya).
// Memakainya akan mengajari pekerja aturan yang salah tentang tugasnya yang
// lain. Jadi kalimat ini menyebut AKIBATNYA dan jalan keluarnya, bukan namanya.
const TUNDA_TERTUTUP_NOTICE =
  'Tugas ini sudah tidak bisa ditunda. Catat sebagai selesai kalau sudah dikerjakan.';

// Tiga alasan penundaan yang SUDAH BERNAMA, ditawarkan sebagai chip.
//
// Mereka datang dari apa yang benar-benar terjadi di kebun: bahan belum
// tersedia, hujan, alat rusak. Sebelum ini ketiganya harus DIKETIK — dan
// mengetik di ponsel sambil berdiri di kebun, dengan tangan kotor, adalah
// pekerjaan yang jauh lebih besar daripada yang terlihat dari meja. Akibatnya
// bisa ditebak dan sudah terbukti di kolom bebas lain di basis data ini:
// "hujan", "Hujan", "hujan deras", "ujan" — empat nilai untuk satu maksud, dari
// satu orang.
//
// Nilainya SAMA DENGAN LABELNYA, bukan kode pendek. Yang tersimpan ke
// care_activities.note adalah teks ini apa adanya, dan kolom itu sudah berisi
// kalimat bebas dari catatan lama — menyimpan 'rain' di sebelah "Stok air belum
// tersedia" akan membuat satu kolom berisi dua bahasa yang berbeda.
const POSTPONE_REASONS = ['Bahan habis', 'Hujan', 'Alat rusak'] as const;

// Kunci chip "Lainnya". Sengaja BUKAN string kosong dan bukan salah satu label:
// ia harus bisa dibedakan dari "belum memilih apa-apa" supaya validasi tahu
// bedanya antara chip yang belum ditekan dan kolom teks yang belum diisi.
const POSTPONE_REASON_OTHER = 'lainnya';

/**
 * Seluruh isian form yang bisa diubah pekerja, dalam satu objek.
 *
 * ADA KARENA layar ini kini dijaga useUnsavedChangesGuard, dan penjaga itu butuh
 * satu pertanyaan yang bisa dijawab: "apakah yang di layar sekarang berbeda dari
 * keadaan saat layar dibuka?". Tanpa objek acuan, jawabannya harus dirakit dari
 * delapan useState yang tersebar — dan setiap field baru yang kelak ditambahkan
 * akan lolos dari perbandingan tanpa ada yang menyadarinya.
 *
 * FOTO TIDAK DI SINI. `newPhoto` dan `removeExistingPhoto` cukup diperiksa
 * sebagai "ada/tidak": keduanya hanya bisa bergerak dari keadaan awalnya, tidak
 * pernah kembali ke sana lewat jalan lain, jadi menyimpannya sebagai acuan tidak
 * menambah satu pun jawaban.
 */
type RecordBaseline = {
  note: string;
  postponedUntil: string;
  produk: string;
  produkJumlah: string;
  produkSatuan: SatuanBahan | null;
  reasonChoice: string;
  reasonOther: string;
  status: ActivityStatus;
};

export default function WorkerTaskRecordScreen() {
  const params = useLocalSearchParams<{ taskId: string; mode?: string; activityId?: string }>();
  const taskId = params.taskId;
  const mode: RecordMode = params.mode === 'edit' ? 'edit' : 'create';
  const activityId = params.activityId?.trim() || null;

  const scrollRef = React.useRef<ScrollView>(null);

  // Isi form SAAT LAYAR DIBUKA, acuan penjaga "perubahan belum disimpan".
  //
  // Dihitung SEKALI lewat useMemo, lalu dipakai dua kali: sebagai acuan, dan
  // sebagai nilai awal `postponedUntil` di bawah. Dulu tanggal besok dihitung
  // langsung di penginisialisasi useState; kalau acuannya menghitungnya sendiri
  // untuk kedua kalinya, keduanya bisa berselisih sehari pada layar yang dibuka
  // tepat di tengah malam — dan layar itu lalu mengira dirinya sudah berubah
  // sebelum pekerja menyentuh apa pun.
  const initialBaseline = React.useMemo<RecordBaseline>(
    () => ({
      note: '',
      // Default besok: RPC menolak hari ini dan masa lalu, jadi membuka picker
      // di tanggal hari ini hanya akan menyeret pekerja ke pesan error.
      postponedUntil: addDaysToIsoDate(getTodayIsoDate(), 1),
      produk: '',
      produkJumlah: '',
      produkSatuan: null,
      reasonChoice: '',
      reasonOther: '',
      status: 'completed',
    }),
    []
  );
  // Ditimpa di mode PERBAIKI begitu barisnya terbaca — lihat loadTask. Di mode
  // catat ia tetap nilai awalnya seumur layar.
  const [baseline, setBaseline] = React.useState<RecordBaseline>(initialBaseline);
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);

  const [task, setTask] = React.useState<CareTaskDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [bannerError, setBannerError] = React.useState<string | null>(null);

  // Hanya dipakai mode CREATE. Di mode edit, status dibaca dari baris yang
  // sedang diperbaiki (editingActivity) dan tidak bisa digeser sama sekali.
  const [status, setStatus] = React.useState<ActivityStatus>('completed');
  const [editingActivity, setEditingActivity] = React.useState<CareActivity | null>(null);

  const [note, setNote] = React.useState('');
  // Alasan penundaan, DUA state dan bukan satu.
  //
  // `reasonChoice` adalah chip yang sedang menyala; `reasonOther` adalah teks
  // yang hanya berarti saat chipnya "Lainnya". Dipisah supaya berpindah dari
  // "Lainnya" ke "Hujan" lalu kembali tidak membuang apa yang sudah diketik —
  // dan supaya yang TERSIMPAN tidak pernah bergantung pada state yang sedang
  // tidak terlihat. Yang masuk ke note dirakit sekali di postponeReasonText().
  const [reasonChoice, setReasonChoice] = React.useState('');
  const [reasonOther, setReasonOther] = React.useState('');
  const [produk, setProduk] = React.useState('');
  const [produkJumlah, setProdukJumlah] = React.useState('');
  const [produkSatuan, setProdukSatuan] = React.useState<SatuanBahan | null>(null);
  const [satuanSheetOpen, setSatuanSheetOpen] = React.useState(false);

  const [newPhoto, setNewPhoto] = React.useState<PickedPhotoAsset | null>(null);
  const [existingProof, setExistingProof] = React.useState<TaskProofPhoto | null>(null);
  const [removeExistingPhoto, setRemoveExistingPhoto] = React.useState(false);

  const [bahanError, setBahanError] = React.useState<string | null>(null);
  const [photoError, setPhotoError] = React.useState<string | null>(null);
  const [processingPhoto, setProcessingPhoto] = React.useState(false);
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const [postponedUntil, setPostponedUntil] = React.useState(initialBaseline.postponedUntil);
  const [postponedUntilError, setPostponedUntilError] = React.useState<string | undefined>(undefined);

  const loadTask = React.useCallback(async () => {
    const normalizedTaskId = taskId?.trim();

    if (!normalizedTaskId) {
      setBannerError('Data tugas tidak ditemukan.');
      setTask(null);
      return;
    }

    setBannerError(null);

    const result = await getTaskDetail({ taskId: normalizedTaskId });

    if (result.error) {
      setBannerError(result.error.message);
      setTask(null);
      return;
    }

    setTask(result.data);

    if (mode === 'edit' && activityId) {
      const activity = result.data.activities.find((item) => item.id === activityId);

      // Baris yang mau diperbaiki disimpan utuh, bukan dipecah ke beberapa state.
      // Statusnya jadi satu-satunya sumber kebenaran untuk mode edit.
      setEditingActivity(activity ?? null);

      if (activity) {
        // Alasan lama DIPULIHKAN KE BENTUK CHIP kalau teksnya memang salah satu
        // dari ketiganya; kalau tidak, ia jatuh ke "Lainnya" dengan teksnya
        // utuh di kolom. Tanpa pemulihan ini, membuka kembali penundaan yang
        // dicatat lewat chip "Hujan" akan menampilkan form tanpa satu pun chip
        // menyala — pekerja lalu mengira alasannya hilang.
        //
        // Berlaku juga untuk catatan penundaan LAMA yang dibuat sebelum chip
        // ada: teks bebasnya tetap terbaca dan tetap bisa dikoreksi, lewat
        // cabang "Lainnya".
        const savedReason = (activity.note ?? '').trim();
        const matchedReason = POSTPONE_REASONS.find((reason) => reason === savedReason);

        // SATU objek, dipakai untuk mengisi form DAN jadi acuannya. Kalau
        // keduanya dirakit terpisah dan menyimpang satu ruas, layar akan
        // mengira dirinya berubah sejak dibuka dan menahan pekerja dengan
        // dialog buang-perubahan untuk perubahan yang tidak pernah terjadi.
        //
        // `postponedUntil` mengikuti nilai awal, bukan tanggal penundaan yang
        // tersimpan: update_task_realization TIDAK menerima tanggal sama sekali
        // — kolom tanggalnya memang tidak dirender di mode perbaiki — jadi
        // acuan apa pun selain nilai awal akan menandai layar "berubah" untuk
        // ruas yang tidak bisa dikirim ke mana pun.
        const loaded: RecordBaseline = {
          note: activity.note ?? '',
          postponedUntil: initialBaseline.postponedUntil,
          produk: activity.produk ?? '',
          produkJumlah: activity.produkJumlah === null ? '' : String(activity.produkJumlah),
          produkSatuan: activity.produkSatuan,
          reasonChoice: matchedReason ?? (savedReason ? POSTPONE_REASON_OTHER : ''),
          reasonOther: matchedReason ? '' : savedReason,
          status: activity.status,
        };

        setNote(loaded.note);
        setProduk(loaded.produk);
        setProdukJumlah(loaded.produkJumlah);
        setProdukSatuan(loaded.produkSatuan);
        setReasonChoice(loaded.reasonChoice);
        setReasonOther(loaded.reasonOther);
        setBaseline(loaded);
      } else {
        // Dulu form tetap terbuka dengan nilai kosong dan pekerja baru tahu ada
        // yang salah setelah menekan Simpan. Sekarang dikatakan di depan.
        setBannerError('Hasil kerja ini tidak ditemukan.');
      }

      const proofResult = await listTaskProofPhotosForActivities({
        activityIds: [activityId],
        farmId: result.data.farmId,
      });

      if (!proofResult.error) {
        setExistingProof(proofResult.data[activityId] ?? null);
      }
    }
  }, [activityId, initialBaseline.postponedUntil, mode, taskId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadTask().finally(() => setLoading(false));
    }, [loadTask])
  );

  // Foto diperiksa sebagai "ada/tidak", bukan lewat acuan: keduanya hanya bisa
  // bergerak dari keadaan awalnya dan tidak pernah kembali ke sana lewat jalan
  // lain. Lihat catatan pada RecordBaseline.
  const hasUnsavedChanges =
    note !== baseline.note ||
    postponedUntil !== baseline.postponedUntil ||
    produk !== baseline.produk ||
    produkJumlah !== baseline.produkJumlah ||
    produkSatuan !== baseline.produkSatuan ||
    reasonChoice !== baseline.reasonChoice ||
    reasonOther !== baseline.reasonOther ||
    status !== baseline.status ||
    newPhoto !== null ||
    removeExistingPhoto;

  // PENJAGA PERUBAHAN (batch 6b). Layar ini tidak punya tombol "Batal" untuk
  // dicabut — bar aksinya memang sudah satu tombol — jadi yang dipasang hanya
  // penjaganya, dan ia menutup jalur kehilangan data yang berdiri sendiri:
  // sebelum ini, menekan chevron kembali sesudah memotret bukti kerja membuang
  // foto itu tanpa satu pun peringatan, dan memotretnya ulang menuntut kembali
  // ke pohonnya.
  const { handleBackPress } = useUnsavedChangesGuard({
    // Saat penyimpanan berjalan, dialog tidak ditawarkan: tidak ada gunanya
    // menanyakan "buang perubahan" untuk perubahan yang sedang dikirim ke
    // server.
    hasUnsavedChanges: hasUnsavedChanges && !submitting,
    onBlocked: () => setConfirmDiscard(true),
    onLeave: () => {
      if (submitting) {
        return;
      }

      router.back();
    },
  });

  async function handlePickFromGallery() {
    setProcessingPhoto(true);

    try {
      const result = await pickImageFromGallery();

      if (result.error) {
        setBannerError(result.error.message);
        return;
      }

      if (result.data) {
        setBannerError(null);
        setPhotoError(null);
        setNewPhoto(result.data);
        setRemoveExistingPhoto(false);
      }
    } finally {
      setProcessingPhoto(false);
    }
  }

  async function handleTakeFromCamera() {
    setProcessingPhoto(true);

    try {
      const result = await takePhotoFromCamera();

      if (result.error) {
        setBannerError(result.error.message);
        return;
      }

      if (result.data) {
        setBannerError(null);
        setPhotoError(null);
        setNewPhoto(result.data);
        setRemoveExistingPhoto(false);
      }
    } finally {
      setProcessingPhoto(false);
    }
  }

  // Satu slot foto: hapus membuang foto baru dulu (kalau ada), lalu menandai
  // foto lama untuk dihapus saat simpan.
  function handleDeletePhoto() {
    if (newPhoto) {
      setNewPhoto(null);
      return;
    }

    if (existingProof && !removeExistingPhoto) {
      setRemoveExistingPhoto(true);
    }
  }

  function selectStatus(next: ActivityStatus) {
    // PAGAR TUNGGAL untuk "tugas yang sudah dilewati masa toleransinya tidak
    // bisa ditunda". Kartu Tunda sudah tidak bisa ditekan saat itu terjadi,
    // jadi baris ini tidak pernah berbunyi di jalur normal — ia berdiri supaya
    // penyetel status berikutnya tidak bisa melewatinya tanpa sadar. setStatus
    // tidak dipanggil dari tempat lain mana pun di berkas ini, dan nilai awalnya
    // 'completed', sehingga satu pemeriksaan di sini menutup seluruh jalurnya.
    if (next === 'postponed' && task?.missedAt) {
      return;
    }

    setStatus(next);
    setBahanError(null);
    setPhotoError(null);
    setReasonError(null);
  }

  // Status yang berlaku di layar ini. Mode edit membacanya dari BARIS-nya, jadi
  // tidak ada jalan bagi pekerja untuk menggesernya lalu mengirim kombinasi yang
  // pasti ditolak RPC (mis. mengisi bahan pada hasil kerja yang ditunda).
  const effectiveStatus: ActivityStatus =
    mode === 'edit' ? editingActivity?.status ?? 'completed' : status;
  const isCompleted = effectiveStatus === 'completed';
  const hasUsableProof = Boolean(newPhoto) || (Boolean(existingProof) && !removeExistingPhoto);
  const photoUri = newPhoto?.uri ?? (existingProof && !removeExistingPhoto ? existingProof.signedUrl : null);

  // Validasi bahan mendahului RPC supaya pekerja dapat jawaban tanpa menunggu
  // jaringan. RPC tetap jadi penjaga terakhir dengan pesan yang sama maksudnya.
  function validateBahan(): string | null {
    const namaBahan = produk.trim();
    const jumlahTeks = produkJumlah.trim();
    const adaTakaran = Boolean(jumlahTeks) || Boolean(produkSatuan);

    if (!adaTakaran) {
      return null;
    }

    if (!namaBahan) {
      return 'Isi nama bahannya dulu.';
    }

    if (!jumlahTeks || !produkSatuan) {
      return 'Isi takaran dan pilih satuannya.';
    }

    const jumlah = parseDecimalInput(jumlahTeks);

    if (jumlah === null) {
      return 'Takaran harus lebih dari 0.';
    }

    // Dijaga di sini, bukan diserahkan ke constraint database. Pelanggaran
    // constraint sampai ke layar sebagai "Terjadi kendala saat memproses data."
    // — kalimat yang tidak memberitahu apa pun tentang angka yang kebesaran.
    if (jumlah > MAX_TAKARAN_BAHAN) {
      return 'Takaran terlalu besar.';
    }

    return null;
  }

  async function handleSubmit() {
    if (!task) {
      return;
    }

    if (isCompleted) {
      const bahanMessage = validateBahan();

      if (bahanMessage) {
        setBahanError(bahanMessage);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        return;
      }
    }

    if (isCompleted && task.requiresPhoto && !hasUsableProof) {
      setPhotoError('Tugas ini butuh bukti foto.');
      scrollRef.current?.scrollToEnd({ animated: true });
      return;
    }

    // DUA pesan berbeda untuk dua kegagalan berbeda. "Isi alasan penundaan."
    // yang lama benar saat alasannya satu kolom teks; sejak ia jadi chip,
    // kalimat itu tidak memberi tahu apakah yang kurang adalah memilih chip
    // atau mengetik di kolom yang baru saja terbuka.
    if (!isCompleted) {
      if (!reasonChoice) {
        setReasonError('Pilih alasan penundaan.');
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        return;
      }

      if (reasonChoice === POSTPONE_REASON_OTHER && !reasonOther.trim()) {
        setReasonError('Tulis alasannya.');
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        return;
      }
    }

    // Cermin dari validasi RPC (migrasi 049). Diperiksa di sini juga supaya
    // pekerja mendapat pesan di sebelah field-nya, bukan banner error dari
    // server.
    if (!isCompleted && postponedUntil <= getTodayIsoDate()) {
      setPostponedUntilError('Pilih tanggal setelah hari ini.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    if (mode === 'edit') {
      await submitEdit();
      return;
    }

    if (isCompleted) {
      await submitComplete(task);
      return;
    }

    await submitPostpone(task);
  }

  async function submitComplete(currentTask: CareTaskDetail) {
    setSubmitting(true);
    setBannerError(null);

    const result = await completeTask({
      note,
      produk,
      produkJumlah: parseDecimalInput(produkJumlah),
      produkSatuan,
      taskId: currentTask.id,
    });

    if (result.error) {
      setBannerError(result.error.message);
      setSubmitting(false);
      return;
    }

    if (newPhoto) {
      const proofResult = await uploadTaskProofPhoto({
        activityId: result.data.activityId,
        base64: newPhoto.base64,
        farmId: currentTask.farmId,
        fileName: newPhoto.fileName,
        localUri: newPhoto.uri,
        mimeType: newPhoto.mimeType,
        taskId: currentTask.id,
      });

      if (proofResult.error) {
        if (currentTask.requiresPhoto) {
          const rollbackResult = await rollbackCompletedTaskActivity({ activityId: result.data.activityId });
          setBannerError(
            rollbackResult.error
              ? 'Foto bukti gagal diunggah. Status tugas perlu diperiksa kembali.'
              : 'Foto bukti gagal diunggah. Tugas belum ditandai selesai.'
          );
          setSubmitting(false);
          return;
        }

        Alert.alert('Tugas selesai', 'Tugas selesai, tetapi bukti foto gagal diunggah.');
      }
    }

    setSubmitting(false);
    setPendingFeedback('completed');
    router.back();
  }

  // Teks alasan yang benar-benar TERSIMPAN, dirakit di satu tempat.
  //
  // Dua jalur menulis kolom yang sama (postponeTask dan updateTaskRealization),
  // dan keduanya harus merakitnya dengan aturan yang sama persis — kalau salah
  // satu mengirim `note` mentah, mengoreksi sebuah penundaan akan menyimpan isi
  // field yang sedang tidak terlihat di layar.
  function postponeReasonText(): string {
    return reasonChoice === POSTPONE_REASON_OTHER ? reasonOther.trim() : reasonChoice;
  }

  function selectReason(next: string) {
    setReasonChoice(next);
    setReasonError(null);
  }

  async function submitPostpone(currentTask: CareTaskDetail) {
    setSubmitting(true);
    setBannerError(null);

    const result = await postponeTask({
      note: postponeReasonText(),
      postponedUntil,
      taskId: currentTask.id,
    });

    if (result.error) {
      setBannerError(result.error.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setPendingFeedback('postponed');
    router.back();
  }

  async function submitEdit() {
    if (!activityId) {
      setBannerError('Hasil kerja tidak ditemukan.');
      return;
    }

    setSubmitting(true);
    setBannerError(null);

    // Bahan hanya dikirim untuk baris yang SELESAI. Untuk baris ditunda,
    // ketiganya dikirim null — bukan sekadar tidak ditampilkan, supaya nilai
    // lama pun ikut dibersihkan kalau entah bagaimana pernah terisi.
    const result = await updateTaskRealization({
      activityId,
      // Baris SELESAI menyimpan catatan bebas; baris DITUNDA menyimpan
      // alasannya. Keduanya jatuh ke kolom note yang sama, jadi yang dikirim
      // harus dipilih menurut status barisnya — bukan menurut field mana yang
      // kebetulan terisi.
      note: isCompleted ? note : postponeReasonText(),
      produk: isCompleted ? produk : null,
      produkJumlah: isCompleted ? parseDecimalInput(produkJumlah) : null,
      produkSatuan: isCompleted ? produkSatuan : null,
      proofPhoto: newPhoto
        ? {
            base64: newPhoto.base64,
            fileName: newPhoto.fileName,
            mimeType: newPhoto.mimeType,
            uri: newPhoto.uri,
          }
        : null,
      removeExistingProof: removeExistingPhoto,
    });

    if (result.error) {
      setBannerError(result.error.message);
      setSubmitting(false);
      return;
    }

    // Partial-success (mis. foto lama gagal dihapus): tahan di layar ini supaya
    // pekerja melihat peringatannya, bukan langsung kembali diam-diam.
    if (result.data.warningMessage) {
      setBannerError(result.data.warningMessage);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setPendingFeedback('updated');
    router.back();
  }

  // DIANGKAT ke atas cabang memuat: judulnya hanya bergantung pada `mode`, yang
  // sudah diketahui dari params sejak render pertama, sehingga cabang memuat
  // bisa memakai judul yang SAMA dengan layar setelah selesai memuat.
  const headerTitle = mode === 'edit' ? 'Perbaiki catatan' : 'Catat hasil kerja';

  if (loading) {
    return (
      <LoadingState
        header={<TopAppBar title={headerTitle} onBack={() => router.back()} />}
        message="Memuat tugas..."
      />
    );
  }

  if (!task) {
    return (
      <Screen header={<TopAppBar title={headerTitle} onBack={() => router.back()} />}>
        <ErrorBanner message={bannerError} />
      </Screen>
    );
  }

  const submitLabel = mode === 'edit' ? 'Simpan perubahan' : 'Simpan hasil kerja';

  // Cermin aturan RPC postpone_task (migrasi 049:203-206), yang menolak
  // penundaan begitu tugasnya dilewati masa toleransi jadwal induknya. Sebelum
  // pagar ini ada, pekerja bisa memilih Tunda, mengisi tanggal DAN alasan
  // lengkap, menekan simpan, lalu baru ditolak — pekerjaannya terbuang di
  // ujung jalan.
  //
  // HANYA jalur TUNDA yang ditutup. 'Selesai' tetap utuh, dan itu memang inti
  // aturannya: tugas terlewat masih boleh dikerjakan — statusnya sengaja tidak
  // diubah saat disapu (taskDueDate.ts:153-154). Yang hilang cuma kemampuan
  // MENJADWALKANNYA ULANG, karena penyapu sudah memajukan rantai jadwalnya dan
  // penerusnya sudah ada.
  //
  // Mode EDIT tidak ikut terpengaruh, dan itu benar: di sana status dibaca dari
  // barisnya lalu dirender LockedResultRow, dan update_task_realization memang
  // TIDAK memeriksa missed_at — membetulkan catatan penundaan yang sudah ada
  // tetap boleh. Karena itu pemeriksaan ini duduk di cabang mode catat saja.
  const isMissed = Boolean(task.missedAt);

  return (
    <Screen
      header={<TopAppBar title={headerTitle} onBack={handleBackPress} />}
      scrollRef={scrollRef}
      stickyFooter={<Button title={submitLabel} loading={submitting} disabled={submitting} onPress={handleSubmit} />}
    >
      <ErrorBanner message={bannerError} />

      <Text selectable style={{ color: tokens.color.text.tertiary, ...tokens.type.meta }}>
        {`${task.title} · ${formatDate(task.dueDate)}`}
      </Text>

      <View style={{ gap: spacing.sm }}>
        <SectionLabel text="Hasil pekerjaan" />
        {mode === 'edit' ? (
          <>
            {/* TERKUNCI, bukan disembunyikan: pekerja tetap harus tahu entri ini
                Selesai atau Ditunda. Yang tidak boleh adalah mengubahnya —
                RPC update_task_realization tidak menerima status sama sekali. */}
            <LockedResultRow status={effectiveStatus} />
            {/* "TERSIMPAN SEBAGAI CATATAN BARU." (#33).

                Ia BENAR di layar ini, dan hanya di layar ini. Koreksi hasil
                kerja memang tersedia, dan update_task_realization memang
                menuliskan baris baru alih-alih menimpa yang lama — riwayat di
                layar detail tugas karena itu tumbuh satu baris tiap kali
                dikoreksi, dan pekerja yang tidak diberi tahu akan mengira
                koreksinya gagal lalu menekan Simpan lagi.

                JANGAN membawanya ke detail catatan perawatan. Di sana tidak ada
                jalur edit sama sekali (care_activities menambah, dan pemicu
                rantai jadwal berulang hanya berbunyi saat penyimpanan baru),
                jadi kalimat yang sama akan menjanjikan tombol yang tidak
                pernah ada. */}
            <Text selectable style={{ ...tokens.type.meta, color: tokens.color.text.secondary }}>
              Tersimpan sebagai catatan baru.
            </Text>
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <ResultOption
                active={status === 'completed'}
                description="Sudah dikerjakan"
                icon="check"
                label="Selesai"
                onPress={() => selectStatus('completed')}
              />
              <ResultOption
                active={status === 'postponed'}
                description="Belum bisa hari ini"
                disabled={isMissed}
                disabledHint={TUNDA_TERTUTUP_NOTICE}
                icon="clock"
                label="Tunda"
                onPress={() => selectStatus('postponed')}
              />
            </View>
            {/* Keterangannya DICETAK, bukan disimpan untuk saat kartunya
                ditekan. Keadaan "tidak bisa ditunda" tidak punya satu pun
                penanda lain di layar pekerja — daftar tugas melipatnya ke
                section "Terlambat" dan pill di detail tugas berbunyi "Terlambat
                N hari", sama seperti tugas terlambat biasa yang justru MASIH
                boleh ditunda. Jadi kalau sebabnya tidak berdiri di sini,
                pekerja tidak punya cara menemukannya. */}
            {isMissed ? (
              <Text
                selectable
                style={{ ...tokens.type.meta, color: tokens.color.text.secondary }}
              >
                {TUNDA_TERTUTUP_NOTICE}
              </Text>
            ) : null}
          </>
        )}
      </View>

      {isCompleted ? (
        <>
          {/* Bahan sengaja DI ATAS catatan: ini data terstruktur yang paling
              berharga buat Abah, sementara catatan teks bebas paling gampang
              dilewati. Menukar urutannya menukar juga peluang keduanya diisi. */}
          <BahanFields
            error={bahanError}
            jumlah={produkJumlah}
            nama={produk}
            satuan={produkSatuan}
            onChangeJumlah={(value) => {
              setProdukJumlah(sanitizeDecimalInput(value, MAX_ANGKA_DESIMAL));
              setBahanError(null);
            }}
            onChangeNama={(value) => {
              setProduk(value);
              setBahanError(null);
            }}
            onOpenSatuan={() => setSatuanSheetOpen(true)}
          />

          <View style={{ gap: spacing.sm }}>
            <SectionLabel optional text="Catatan" />
            <NoteInput
              onChangeText={setNote}
              placeholder="Contoh: Pekerjaan selesai sesuai instruksi"
              value={note}
            />
          </View>

          {/* <PhotoPickerCard> BERSAMA, menggantikan ProofPhotoField lokal
              (batch 6b).

              Dua hal sekaligus dicabut bersamanya. Pertama, TOMBOL KAMERA
              BUNDAR BERIKON-SAJA di pojok foto — sisa penugasan batch 5, yang
              mencabut tombol yang sama dari PhotoPickerCard tapi tidak
              menjangkau salinan lokal di berkas ini. Kedua, salinan lokalnya
              sendiri: ia memetakan "satu slot foto" ke rupanya untuk kedua
              kalinya, di aplikasi yang sudah punya pemetaan pertama.

              Yang hilang hanya perbedaan yang memang tidak punya alasan: tinggi
              gambar 200 lawan 180, dan pesan galat sebagai teks kecil lawan
              spanduk. Yang tetap: sheet sumber foto yang sama, baris "Hapus
              foto" di dalamnya, dan badge "Wajib" saat jadwalnya menuntut bukti.

              `changeHint` WAJIB di sini: setelah tombol bundarnya pergi,
              ketukan pada gambar adalah satu-satunya jalan ke ganti/hapus, dan
              gestur yang jadi satu-satunya jalan ke sebuah fungsi harus
              mengumumkan dirinya. */}
          <PhotoPickerCard
            changeHint="Ketuk foto untuk mengganti atau menghapusnya."
            choosePhotoLabel="Pilih galeri"
            description={processingPhoto ? PHOTO_PROCESSING_MESSAGE : undefined}
            emptyLabel="Tambah foto"
            error={photoError}
            imageUri={photoUri}
            loading={submitting || processingPhoto}
            optional={!task.requiresPhoto}
            removeLabel="Hapus foto"
            required={task.requiresPhoto}
            takePhotoLabel="Ambil foto"
            title="Foto bukti kerja"
            onChoosePhoto={handlePickFromGallery}
            onRemovePhoto={hasUsableProof ? handleDeletePhoto : undefined}
            onTakePhoto={handleTakeFromCamera}
          />
        </>
      ) : (
        <>
          {/* Tanggal DI ATAS alasan: sejak migrasi 049 penundaan adalah
              penjadwalan ulang, jadi pertanyaan pertamanya "kapan", bukan
              "kenapa". Hanya muncul di mode catat — pada mode perbaiki,
              tanggalnya ikut dikoreksi lewat field yang sama di bawah. */}
          <View style={{ gap: spacing.sm }}>
            <SectionLabel text="Ditunda sampai" />
            <FormDateField
              error={postponedUntilError}
              label=""
              onChangeDate={(value) => {
                setPostponedUntil(value);
                setPostponedUntilError(undefined);
              }}
              value={postponedUntil}
            />
          </View>

          {/* ALASAN SEBAGAI CHIP, bukan kolom teks (adendum §1.6).

              Tiga alasan yang sudah bernama bisa dipilih dengan satu ketukan.
              Mengetik di ponsel sambil berdiri di kebun dengan tangan kotor
              adalah pekerjaan yang jauh lebih besar daripada yang terlihat dari
              meja — dan hasilnya sudah terbukti di kolom bebas lain di basis
              data ini: empat ejaan untuk satu maksud, dari satu orang.

              "LAINNYA" MEMBUKA SATU KOLOM TEKS, dan hanya itu yang menuntut
              mengetik. Mewajibkan ketikan untuk ketiga alasan yang sudah
              bernama berarti membuang seluruh gunanya chip. */}
          <View style={{ gap: spacing.sm }}>
            <SectionLabel text="Alasan tunda" />
            <OptionGroup
              error={reasonError ?? undefined}
              options={[
                ...POSTPONE_REASONS.map((reason) => ({ label: reason, value: reason })),
                { label: 'Lainnya', value: POSTPONE_REASON_OTHER },
              ]}
              value={reasonChoice}
              onChange={selectReason}
            />
            {reasonChoice === POSTPONE_REASON_OTHER ? (
              <NoteInput
                onChangeText={(value) => {
                  setReasonOther(value);
                  if (value.trim()) {
                    setReasonError(null);
                  }
                }}
                placeholder="Contoh: Stok air belum tersedia"
                value={reasonOther}
              />
            ) : null}
          </View>
        </>
      )}

      <SatuanSheet
        onClose={() => setSatuanSheetOpen(false)}
        onSelect={(value) => {
          setProdukSatuan(value);
          setBahanError(null);
          setSatuanSheetOpen(false);
        }}
        selected={produkSatuan}
        visible={satuanSheetOpen}
      />

      {/* Bentuk dan literalnya sepadan dengan dialog yang sama di layar Edit
          profil, Edit catatan, Edit pohon, dan Edit jadwal. Yang berbeda hanya
          kata bendanya. */}
      <ConfirmDialog
        cancelLabel="Buang perubahan"
        cancelTone="danger"
        confirmLabel="Lanjut isi"
        message="Catatan ini belum disimpan. Kalau keluar sekarang, isian dan fotonya hilang."
        title="Perubahan belum disimpan"
        visible={confirmDiscard}
        onCancel={() => {
          setConfirmDiscard(false);
          router.back();
        }}
        onConfirm={() => setConfirmDiscard(false)}
      />
    </Screen>
  );
}

const inputStyle = {
  backgroundColor: tokens.color.surface.card,
  borderColor: tokens.color.line.card,
  borderCurve: 'continuous' as const,
  borderRadius: tokens.radius.control,
  borderWidth: 1,
  color: tokens.color.text.primary,
  fontSize: tokens.type.body.fontSize,
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.md,
};

// Blok "Bahan yang dipakai". Tiga kolom dalam satu baris: nama bahan paling
// lebar (flex), takaran sempit, satuan sedang.
//
// Satuan WAJIB dipilih dari daftar, tidak boleh diketik. Alasannya empiris:
// kolom fruit_condition yang dibiarkan bebas sudah terlanjur berisi "Bagus",
// "Baik", "Good", dan "Good test harvest" — empat nilai untuk satu maksud,
// dari satu orang, dalam 12 baris. Data seperti itu tidak bisa dijumlahkan.
function BahanFields({
  error,
  jumlah,
  nama,
  onChangeJumlah,
  onChangeNama,
  onOpenSatuan,
  satuan,
}: {
  error: string | null;
  jumlah: string;
  nama: string;
  onChangeJumlah: (value: string) => void;
  onChangeNama: (value: string) => void;
  onOpenSatuan: () => void;
  satuan: SatuanBahan | null;
}) {
  const borderColor = error ? tokens.color.status.danger.text : tokens.color.line.card;

  return (
    <View style={{ gap: spacing.sm }}>
      <SectionLabel optional text="Bahan yang dipakai" />
      <View style={{ alignItems: 'stretch', flexDirection: 'row', gap: spacing.sm }}>
        <TextInput
          onChangeText={onChangeNama}
          placeholder="NPK Mutiara"
          placeholderTextColor={tokens.color.text.tertiary}
          style={{ ...inputStyle, borderColor, flex: 1 }}
          value={nama}
        />
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={onChangeJumlah}
          placeholder="0"
          placeholderTextColor={tokens.color.text.tertiary}
          style={{ ...inputStyle, borderColor, textAlign: 'center', width: 76 }}
          value={jumlah}
        />
        <Pressable
          accessibilityLabel={satuan ? `Satuan ${SATUAN_BAHAN_LABELS[satuan]}` : 'Pilih satuan'}
          accessibilityRole="button"
          onPress={onOpenSatuan}
          style={{
            ...inputStyle,
            alignItems: 'center',
            borderColor,
            flexDirection: 'row',
            gap: spacing.xs,
            justifyContent: 'center',
            width: 104,
          }}
        >
          <Text
            numberOfLines={1}
            selectable={false}
            style={{
              color: satuan ? tokens.color.text.primary : tokens.color.text.tertiary,
              fontSize: tokens.type.body.fontSize,
            }}
          >
            {satuan ? SATUAN_BAHAN_LABELS[satuan] : 'Satuan'}
          </Text>
          <Icon name="chevron-down" size={tokens.icon.sm} color={tokens.color.text.tertiary} />
        </Pressable>
      </View>
      {error ? <FieldError message={error} /> : null}
    </View>
  );
}

// Pemilih satuan memakai BottomSheet dan OptionChip yang sudah ada — bukan
// kontrol baru. Chip lebih mudah ditekan satu tangan daripada daftar panjang.
function SatuanSheet({
  onClose,
  onSelect,
  selected,
  visible,
}: {
  onClose: () => void;
  onSelect: (value: SatuanBahan) => void;
  selected: SatuanBahan | null;
  visible: boolean;
}) {
  return (
    <BottomSheet
      onClose={onClose}
      subtitle="Pilih satuan takaran bahan."
      title="Satuan"
      visible={visible}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm }}>
        {SATUAN_BAHAN.map((value) => (
          <OptionChip
            key={value}
            label={SATUAN_BAHAN_LABELS[value]}
            onPress={() => onSelect(value)}
            selected={selected === value}
          />
        ))}
      </View>
    </BottomSheet>
  );
}

// Tampilan status di mode perbaiki. Sengaja memakai bahasa visual "terkunci"
// yang sama dengan Field locked di ui.tsx — permukaan redup, garis rambut, dan
// gembok — supaya terbaca "memang tidak bisa diubah", bukan "tombol mati".
function LockedResultRow({ status }: { status: ActivityStatus }) {
  const isCompleted = status === 'completed';

  return (
    <View
      accessibilityLabel={`Hasil pekerjaan ${isCompleted ? 'Selesai' : 'Ditunda'}, tidak bisa diubah`}
      style={{
        alignItems: 'center',
        backgroundColor: tokens.color.surface.subtle,
        borderColor: tokens.color.line.hairline,
        borderCurve: 'continuous',
        borderRadius: tokens.radius.control,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing.md,
        minHeight: tokens.layout.fieldHeight,
        paddingHorizontal: spacing.lg,
      }}
    >
      <Icon
        name={isCompleted ? 'check' : 'clock'}
        size={tokens.icon.md}
        color={tokens.color.text.secondary}
      />
      <Text
        selectable
        style={{ ...tokens.type.bodyStrong, color: tokens.color.text.secondary, flex: 1 }}
      >
        {isCompleted ? 'Selesai' : 'Ditunda'}
      </Text>
      <Icon name="lock" size={tokens.icon.sm} color={tokens.color.text.tertiary} />
    </View>
  );
}

// ProofPhotoField DICABUT (batch 6b). Ia salinan lokal dari <PhotoPickerCard>,
// dan satu-satunya perbedaannya yang punya arti adalah tombol kamera bundar
// berikon-saja di pojok foto — justru yang dilarang aturan desain proyek ini,
// dan yang sudah dicabut dari PhotoPickerCard sendiri di batch 5.

function SectionLabel({
  optional = false,
  required = false,
  text,
}: {
  optional?: boolean;
  required?: boolean;
  text: string;
}) {
  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
      <Text selectable style={{ color: tokens.color.text.primary, fontSize: 14, fontWeight: '700' }}>
        {text}
        {optional ? (
          <Text selectable style={{ color: tokens.color.text.tertiary, fontWeight: '400' }}>
            {' · opsional'}
          </Text>
        ) : null}
      </Text>
      {required ? <Badge label="Wajib" tone="warning" /> : null}
    </View>
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <Text
      selectable
      style={{
        color: tokens.color.status.danger.text,
        fontSize: tokens.type.meta.fontSize,
        lineHeight: tokens.type.meta.lineHeight,
      }}
    >
      {message}
    </Text>
  );
}

function NoteInput({
  error,
  onChangeText,
  placeholder,
  value,
}: {
  error?: string | null;
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
        placeholderTextColor={tokens.color.text.tertiary}
        style={{
          ...inputStyle,
          borderColor: error ? palette.statusBuruk : tokens.color.line.card,
          minHeight: 96,
          paddingTop: spacing.md,
          textAlignVertical: 'top',
        }}
        value={value}
      />
      {error ? <FieldError message={error} /> : null}
    </View>
  );
}

// Kartu pilihan hasil. Ini target sentuh utama layar ini, jadi sengaja besar:
// satu tangan, satu jempol, tanpa perlu membidik.
function ResultOption({
  active,
  description,
  disabled = false,
  disabledHint,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  description: string;
  // Bukan sekadar "tidak menanggapi ketukan": kartunya PINDAH ke bahasa visual
  // TERKUNCI yang sudah dipakai LockedResultRow di berkas ini — permukaan
  // redup, garis rambut, gembok. Bedanya dinyatakan di sana dan berlaku di
  // sini juga: "terkunci" terbaca sebagai memang tidak boleh, sementara kartu
  // yang cuma diredupkan tanpa gembok terbaca sebagai tombol rusak.
  //
  // Kartunya TETAP DIRENDER, tidak disembunyikan. Menyembunyikannya hanya benar
  // kalau ada hal lain di layar yang sudah menjelaskan ketidakhadirannya —
  // syarat yang dipakai layar detail jadwal pemilik saat memilih menyembunyikan
  // aksi, dan yang di sini TIDAK terpenuhi. Deret ini juga dua kolom flex: 1,
  // jadi membuang satu kartu mengubah bentuk layarnya tanpa sebab yang terbaca.
  disabled?: boolean;
  // Sebab terkuncinya, untuk pembaca layar. Teks yang SAMA dicetak di bawah
  // deretnya oleh pemanggil — lihat TUNDA_TERTUTUP_NOTICE.
  disabledHint?: string;
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  // disabled MENANG atas active. Keduanya tidak bisa berbarengan di layar ini
  // (kartu terkunci tidak pernah terpilih, dan selectStatus menolaknya), tapi
  // urutan ini ditulis eksplisit supaya keadaan terkunci tidak bisa tampil
  // separuh-hijau kalau kelak ada pemanggil yang mengombinasikan keduanya.
  const surfaceColor = disabled
    ? tokens.color.surface.subtle
    : active
      ? tokens.color.brand.soft
      : tokens.color.surface.card;
  const borderColor = disabled
    ? tokens.color.line.hairline
    : active
      ? tokens.color.brand.base
      : tokens.color.line.card;
  // Gelembung ikon memakai surface.card saat terkunci: latar kartunya sendiri
  // sudah surface.subtle, jadi gelembung ber-subtle akan lenyap ke dalamnya.
  const bubbleColor = active || disabled ? tokens.color.surface.card : tokens.color.surface.subtle;
  const iconColor = active && !disabled ? tokens.color.brand.base : tokens.color.text.tertiary;
  const labelColor = disabled
    ? tokens.color.text.secondary
    : active
      ? tokens.color.brand.dark
      : tokens.color.text.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: active }}
      accessibilityHint={disabled ? disabledHint : undefined}
      disabled={disabled}
      onPress={onPress}
      style={{
        backgroundColor: surfaceColor,
        borderColor,
        borderCurve: 'continuous',
        borderRadius: tokens.radius.card,
        borderWidth: active && !disabled ? 1.5 : 1,
        flex: 1,
        gap: spacing.sm,
        minHeight: 132,
        padding: spacing.lg,
      }}
    >
      <View
        style={{
          alignItems: 'center',
          backgroundColor: bubbleColor,
          borderRadius: tokens.radius.pill,
          height: 44,
          justifyContent: 'center',
          width: 44,
        }}
      >
        <Icon name={icon} size={tokens.icon.lg} color={iconColor} />
      </View>
      {/* Gembok berdampingan dengan judulnya, urutan yang sama dengan
          LockedResultRow (label dulu, gembok menyusul). Ikonnya sendiri tetap
          'clock' supaya kartunya masih terbaca sebagai "Tunda" dan bukan
          sebagai kontrol lain yang muncul entah dari mana. */}
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs }}>
        <Text selectable style={{ ...tokens.type.heading, color: labelColor }}>
          {label}
        </Text>
        {disabled ? (
          <Icon name="lock" size={tokens.icon.sm} color={tokens.color.text.tertiary} />
        ) : null}
      </View>
      <Text selectable style={{ ...tokens.type.meta, color: tokens.color.text.tertiary }}>
        {description}
      </Text>
    </Pressable>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
