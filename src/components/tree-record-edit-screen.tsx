import { router } from 'expo-router';
import React from 'react';
import { Alert, Text, View } from 'react-native';

import {
  GRADE_PANEN,
  GRADE_PANEN_LABELS,
  MAX_BERAT_PANEN_KG,
  type GradePanen,
} from '../constants/gradePanen';
import { colors, spacing, typography } from '../constants/theme';
import {
  getConditionReportDetail,
  updateOwnConditionReport,
} from '../services/conditionReportService';
import {
  getGrowthPhaseRecordDetail,
  updateOwnGrowthPhaseRecord,
} from '../services/growthPhaseService';
import {
  getHarvestRecordDetail,
  updateOwnHarvestRecord,
} from '../services/harvestService';
import {
  deletePhotoAttachment,
  listEntityPhotos,
  replaceSinglePhotoAttachment,
} from '../services/photoAttachmentService';
import { getTreeDetail } from '../services/treeService';
import { PHOTO_PROCESSING_MESSAGE, pickImageFromGallery, takePhotoFromCamera } from '../lib/media';
import type {
  GrowthPhase,
  Tree,
  TreeConditionStatus,
  UUID,
} from '../types/domain';
import type {
  PhotoAttachmentEntityType,
  PhotoAttachmentWithSignedUrl,
  PickedPhotoAsset,
} from '../types/media';
import { MAX_ANGKA_DESIMAL, parseDecimalInput, sanitizeDecimalInput } from '../utils/decimalInput';
import { formatGrowthPhase, formatTreeConditionStatus, formatTreeContextLine } from '../utils/treeFormat';
import type { TreeRecordRouteType } from './tree-record-detail-screen';
import {
  Button,
  ChoiceRowGroup,
  CONDITION_BADGE,
  DateField,
  EmptyState,
  ErrorBanner,
  Field,
  LoadingState,
  OptionGroup,
  PhotoPickerCard,
  Screen,
  TopAppBar,
} from './ui';

type TreeRecordEditScreenProps = {
  basePath: '/owner/trees' | '/worker/trees';
  recordId?: string;
  recordType?: string;
  treeId?: string;
};

// Daftar dan urutannya SAMA PERSIS dengan form catat masing-masing. Enam
// kondisi, lima fase dalam urutan kanonik; alasannya ditulis lengkap di
// tree-condition-report-screen.tsx dan tree-growth-phase-record-screen.tsx.
const conditionOptions: TreeConditionStatus[] = [
  'healthy',
  'needs_attention',
  'pest_attacked',
  'disease_indicated',
  'damaged',
  'dead',
];

const phaseOptions: GrowthPhase[] = [
  'initial_planting',
  'vegetative',
  'flowering',
  'fruiting',
  'harvesting',
];

/**
 * Jenis catatan yang PUNYA jalur edit. Tiga, bukan empat.
 *
 * 'care' bukan anggotanya, dan itu bukan kelupaan: care_activities append-only
 * dan tidak punya RPC update sama sekali (migrasi 027). Layar ini karena itu
 * tidak pernah terbuka untuk perawatan, dan §8 adendum — ganti foto pada Edit
 * catatan — tidak berlaku untuknya.
 *
 * Dipersempit dari TreeRecordRouteType, bukan mengabaikannya: tipe rute tetap
 * berempat karena layar DETAIL memang melayani keempatnya.
 */
type EditableRecordType = Extract<TreeRecordRouteType, 'condition' | 'phase' | 'harvest'>;

// Jenis entity foto per jenis catatan. Ketiga nilai di kanan adalah entity_type
// yang policy-nya dipasang migrasi 061 — masing-masing dengan fungsi
// can_upload_* sendiri yang mensyaratkan pengunggahnya adalah pencatat baris
// itu, yaitu orang yang sama yang canEdit-nya true di layar ini.
const RECORD_PHOTO_ENTITY_TYPE: Record<EditableRecordType, PhotoAttachmentEntityType> = {
  condition: 'condition_record',
  harvest: 'harvest_record',
  phase: 'growth_phase_record',
};

export function TreeRecordEditScreen({
  basePath,
  recordId,
  recordType,
  treeId,
}: TreeRecordEditScreenProps) {
  const normalizedType = normalizeRecordType(recordType);
  const [canEdit, setCanEdit] = React.useState(false);
  const [conditionStatus, setConditionStatus] = React.useState<TreeConditionStatus | ''>('');
  const [eventDate, setEventDate] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [grade, setGrade] = React.useState<GradePanen | null>(null);
  const [beratKg, setBeratKg] = React.useState('');
  const [fruitCount, setFruitCount] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [note, setNote] = React.useState('');
  const [phase, setPhase] = React.useState<GrowthPhase | ''>('');
  const [submitting, setSubmitting] = React.useState(false);
  const [tree, setTree] = React.useState<Tree | null>(null);
  // ——— Foto catatan (adendum §4.2). farmId ikut disimpan karena setiap
  // panggilan foto memintanya, dan satu-satunya sumbernya adalah detail
  // catatan yang baru saja dimuat. ———
  const [currentPhoto, setCurrentPhoto] = React.useState<PhotoAttachmentWithSignedUrl | null>(null);
  const [deletePhotoRequested, setDeletePhotoRequested] = React.useState(false);
  const [farmId, setFarmId] = React.useState<UUID | null>(null);
  const [processingPhoto, setProcessingPhoto] = React.useState(false);
  const [selectedPhoto, setSelectedPhoto] = React.useState<PickedPhotoAsset | null>(null);

  const loadRecord = React.useCallback(async () => {
    if (!treeId || !recordId || !normalizedType) {
      setError('Catatan tidak ditemukan.');
      setCanEdit(false);
      setTree(null);
      return;
    }

    setError(null);
    const treeResult = await getTreeDetail({ treeId });

    if (treeResult.error) {
      setError(treeResult.error.message);
      setTree(null);
    } else {
      setTree(treeResult.data);
    }

    // Foto yang sudah tersimpan. Kegagalan memuatnya TIDAK menghentikan layar
    // dan tidak menulis ke `error`: catatannya sendiri sudah terbaca, dan
    // menolak menampilkan form yang bisa diedit karena pratinjau fotonya gagal
    // adalah hukuman yang tidak sepadan. Kotak fotonya tampil kosong, dan
    // pemakainya masih bisa memilih foto baru.
    async function loadExistingPhoto(recordFarmId: UUID) {
      if (!recordId || !normalizedType) {
        return;
      }

      const photosResult = await listEntityPhotos({
        entityId: recordId,
        entityType: RECORD_PHOTO_ENTITY_TYPE[normalizedType],
        farmId: recordFarmId,
      });

      setCurrentPhoto(photosResult.data?.[0] ?? null);
    }

    if (normalizedType === 'condition') {
      const result = await getConditionReportDetail({ reportId: recordId });

      if (result.error) {
        setError(result.error.message);
        setCanEdit(false);
        return;
      }

      setCanEdit(result.data.canEdit === true);
      setConditionStatus(result.data.conditionStatus);
      setEventDate(toDateInput(result.data.reportedAt));
      setFarmId(result.data.farmId);
      setNote(result.data.note ?? '');
      await loadExistingPhoto(result.data.farmId);
      return;
    }

    if (normalizedType === 'phase') {
      const result = await getGrowthPhaseRecordDetail({ recordId });

      if (result.error) {
        setError(result.error.message);
        setCanEdit(false);
        return;
      }

      setCanEdit(result.data.canEdit === true);
      setEventDate(toDateInput(result.data.recordedAt));
      setFarmId(result.data.farmId);
      setNote(result.data.note ?? '');
      setPhase(result.data.phase);
      await loadExistingPhoto(result.data.farmId);
      return;
    }

    if (normalizedType === 'harvest') {
      const result = await getHarvestRecordDetail({ recordId });

      if (result.error) {
        setError(result.error.message);
        setCanEdit(false);
        return;
      }

      setCanEdit(result.data.canEdit === true);
      setEventDate(toDateInput(result.data.harvestedAt));
      setFarmId(result.data.farmId);
      // Dulu `String(result.data.fruitCount)`. Sejak kolomnya nullable, itu
      // menghasilkan teks "null" di dalam field — bukan field kosong.
      setGrade(result.data.fruitCondition);
      setBeratKg(result.data.harvestWeightKg === null ? '' : String(result.data.harvestWeightKg));
      setFruitCount(result.data.fruitCount === null ? '' : String(result.data.fruitCount));
      setNote(result.data.note ?? '');
      await loadExistingPhoto(result.data.farmId);
      return;
    }

  }, [normalizedType, recordId, treeId]);

  React.useEffect(() => {
    setLoading(true);
    loadRecord().finally(() => setLoading(false));
  }, [loadRecord]);

  async function handleSubmit() {
    if (!recordId || !normalizedType) {
      setError('Catatan tidak ditemukan.');
      return;
    }

    if (!eventDate) {
      setError('Tanggal catatan wajib diisi.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await submitRecordUpdate(normalizedType, recordId);

    if (result) {
      setError(result);
      setSubmitting(false);
      return;
    }

    // FOTO DIURUS SETELAH catatannya tersimpan, bukan sebelum. Urutannya
    // penting: kalau fotonya lebih dulu dan penyimpanan catatannya kemudian
    // gagal, foto lama sudah terlanjur hilang untuk catatan yang isinya tidak
    // jadi berubah — kerugian yang tidak bisa dibatalkan demi perubahan yang
    // tidak terjadi.
    const photoMessage = await submitPhotoChange(normalizedType, recordId);

    setSubmitting(false);

    if (photoMessage) {
      // Catatannya SUDAH tersimpan. Dialognya karena itu berjudul "tersimpan",
      // bukan galat — bentuk yang sama dengan kegagalan foto di layar Ubah
      // pohon, dan karena alasan yang sama: menampilkannya sebagai kegagalan
      // akan membuat pemakainya menekan Simpan lagi untuk perubahan yang sudah
      // masuk.
      Alert.alert('Perubahan tersimpan', photoMessage, [
        {
          text: 'OK',
          onPress: () => router.replace(`${basePath}/${treeId}/records/${normalizedType}/${recordId}`),
        },
      ]);
      return;
    }

    Alert.alert('Catatan berhasil diperbarui.', '', [
      {
        text: 'OK',
        onPress: () => router.replace(`${basePath}/${treeId}/records/${normalizedType}/${recordId}`),
      },
    ]);
  }

  /**
   * Menerapkan perubahan foto. Mengembalikan pesan kalau gagal, null kalau
   * tidak ada yang perlu dilakukan ATAU berhasil.
   *
   * TIGA KEADAAN, dan hanya satu yang bisa aktif pada satu waktu:
   *
   *   - ada foto baru dipilih -> replaceSinglePhotoAttachment: unggah dulu,
   *     baru hapus yang lama. Urutan itu milik fungsinya dan memang yang benar
   *     — kalau unggahannya gagal, foto lama masih di tempatnya.
   *   - hapus diminta dan ada foto lama -> deletePhotoAttachment.
   *   - selebihnya -> tidak ada yang dikerjakan.
   *
   * Memilih foto baru MEMBATALKAN permintaan hapus (lihat kedua handler
   * pemilih di bawah), jadi kedua cabang pertama tidak pernah menyala bersama.
   */
  async function submitPhotoChange(
    type: EditableRecordType,
    id: UUID
  ): Promise<string | null> {
    if (!farmId) {
      return null;
    }

    if (selectedPhoto) {
      const replaceResult = await replaceSinglePhotoAttachment({
        base64: selectedPhoto.base64,
        entityId: id,
        entityType: RECORD_PHOTO_ENTITY_TYPE[type],
        farmId,
        fileName: selectedPhoto.fileName,
        // false, sama dengan jalur unggah di form catat. Bendera `isPrimary`
        // hanya dibaca foto utama pohon; menyalakannya di sini akan membuat
        // foto catatan berbeda bentuk dari saudaranya yang dibuat lewat form
        // catat tanpa ada yang memintanya.
        isPrimary: false,
        localUri: selectedPhoto.uri,
        mimeType: selectedPhoto.mimeType,
      });

      return replaceResult.error
        ? 'Isi catatan tersimpan, tetapi foto gagal diganti. Buka Edit lagi untuk mencoba ulang.'
        : null;
    }

    if (deletePhotoRequested && currentPhoto) {
      const deleteResult = await deletePhotoAttachment({ photoId: currentPhoto.attachment.id });

      return deleteResult.error
        ? 'Isi catatan tersimpan, tetapi foto gagal dihapus. Buka Edit lagi untuk mencoba ulang.'
        : null;
    }

    return null;
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
        // Memilih foto baru membatalkan permintaan hapus: yang diminta jelas
        // "ganti", bukan "hapus lalu tambah".
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

  // Ketukan "Hapus foto" di dalam sheet. DUA ARTI menurut apa yang sedang
  // ditampilkan, dan keduanya sama-sama belum menyentuh server:
  //
  //   - kalau yang tampil foto yang BARU DIPILIH -> buang pilihannya saja.
  //     Tidak ada apa pun yang terunggah, jadi tidak ada yang perlu dihapus.
  //   - kalau yang tampil foto TERSIMPAN -> catat permintaannya. Berkasnya
  //     masih utuh di storage dan barisnya masih ada di photo_attachments;
  //     penghapusan baru berjalan di submitPhotoChange, setelah Simpan ditekan.
  //     Sampai saat itu "Batalkan hapus foto" mengembalikannya tanpa biaya.
  function handleRemovePhoto() {
    if (selectedPhoto) {
      setSelectedPhoto(null);
      return;
    }

    if (currentPhoto) {
      setDeletePhotoRequested(true);
    }
  }

  async function submitRecordUpdate(type: EditableRecordType, id: UUID): Promise<string | null> {
    if (type === 'condition') {
      if (!conditionStatus) {
        return 'Status kondisi wajib dipilih.';
      }

      const result = await updateOwnConditionReport({
        conditionStatus,
        note,
        reportedAt: eventDate,
        reportId: id,
      });
      return result.error?.message ?? null;
    }

    if (type === 'phase') {
      if (!phase) {
        return 'Fase pertumbuhan wajib dipilih.';
      }

      const result = await updateOwnGrowthPhaseRecord({
        note,
        phase,
        recordedAt: eventDate,
        recordId: id,
      });
      return result.error?.message ?? null;
    }

    if (type === 'harvest') {
      // Aturan yang sama persis dengan form catat panen: minimal salah satu
      // dari berat atau jumlah buah, dan batas atas berat dijaga di klien
      // supaya pesannya terbaca.
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

      const result = await updateOwnHarvestRecord({
        fruitCondition: grade,
        fruitCount: jumlahTeks ? Number(jumlahTeks) : null,
        harvestWeightKg: parseDecimalInput(beratKg),
        harvestedAt: eventDate,
        note,
        recordId: id,
      });
      return result.error?.message ?? null;
    }

    // `type` sudah dipersempit ke never di titik ini. Cabang ini hanya
    // tercapai kalau EditableRecordType bertambah anggota tanpa fungsi ini
    // ikut disesuaikan — dan compiler yang menagihnya lebih dulu.
    return 'Jenis catatan tidak dikenal.';
  }

  if (loading) {
    // Judulnya BUKAN tebakan: normalizedType diturunkan dari parameter rute
    // (recordType), jadi ia sudah diketahui sebelum satu pun permintaan jalan —
    // judul saat memuat persis sama dengan judul setelah selesai memuat.
    // Cadangan 'Edit catatan' hanya untuk tipe rute yang tidak dikenali, dan
    // teksnya sama dengan cabang yang menangani keadaan itu di bawah.
    return (
      <LoadingState
        header={
          <TopAppBar
            title={normalizedType ? getEditTitle(normalizedType) : 'Edit catatan'}
            onBack={() => router.back()}
          />
        }
        message="Memuat catatan..."
      />
    );
  }

  if (!normalizedType || !recordId) {
    return (
      <Screen>
        <TopAppBar title="Edit catatan" onBack={() => router.back()} />
        <EmptyState title="Catatan tidak ditemukan" subtitle="Buka kembali catatan dari timeline pohon." />
      </Screen>
    );
  }

  if (!canEdit) {
    return (
      <Screen>
        <TopAppBar title={getEditTitle(normalizedType)} onBack={() => router.back()} />
        <ErrorBanner message={error} />
        <EmptyState title="Tidak bisa diedit" subtitle="Catatan ini hanya bisa diubah oleh pelapor." />
      </Screen>
    );
  }

  // Yang DITAMPILKAN di kotak foto, menurut tiga keadaan yang saling
  // mendahului: foto baru yang dipilih, lalu "sedang diminta dihapus"
  // (kosong), lalu foto tersimpan.
  const previewPhotoUri = selectedPhoto?.uri ?? (deletePhotoRequested ? null : currentPhoto?.signedUrl);
  const canRemovePhoto = Boolean(selectedPhoto || (currentPhoto && !deletePhotoRequested));

  return (
    // URUTAN TETAP, sama dengan form catat pasangannya: konteks pohon -> satu
    // pilihan utama besar -> isian angka/tanggal -> foto -> catatan -> bar aksi.
    <Screen
      autoScrollOnFocus
      footer={
        <>
          <Button title="Simpan perubahan" loading={submitting} onPress={handleSubmit} />
          <Button title="Batal" variant="secondary" disabled={submitting} onPress={() => router.back()} />
        </>
      }
    >
      <TopAppBar title={getEditTitle(normalizedType)} onBack={() => router.back()} />
      <ErrorBanner message={error} />

      {/* Baris yang sama persis dengan layar detail catatan — literal sama,
          formatter sama. Keduanya bersebelahan dalam satu alur (detail lalu
          Edit catatan), jadi konteks pohonnya tidak boleh berganti bentuk di
          tengah jalan. */}
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

      {/* PILIHAN UTAMA. <ChoiceRowGroup> bersama, bukan OptionList/OptionChip
          lokal yang dulu berdiri di dasar berkas ini. Keduanya dicabut: mereka
          pemetaan kedua dari "pilihan" ke rupanya, di layar yang bersebelahan
          dengan form catat yang memakai yang pertama — dan dua bentuk untuk satu
          pekerjaan selalu berakhir menyimpang. Penanda kondisinya pun dibaca
          dari CONDITION_BADGE, sumber yang sama dengan form catat kondisi. */}
      {normalizedType === 'condition' ? (
        <ChoiceRowGroup
          label="Kondisi pohon"
          options={conditionOptions.map((status) => ({
            disabled: submitting,
            label: formatTreeConditionStatus(status),
            marker: {
              color: CONDITION_BADGE[status].markerColor,
              shape: CONDITION_BADGE[status].shape,
            },
            value: status,
          }))}
          value={conditionStatus}
          onChange={(value) => setConditionStatus(value as TreeConditionStatus)}
        />
      ) : null}

      {normalizedType === 'phase' ? (
        <ChoiceRowGroup
          label="Fase pertumbuhan"
          options={phaseOptions.map((option) => ({
            disabled: submitting,
            highlighted: option === tree?.currentGrowthPhase,
            label: formatGrowthPhase(option),
            meta: option === tree?.currentGrowthPhase ? 'fase sekarang' : undefined,
            value: option,
          }))}
          value={phase}
          onChange={(value) => setPhase(value as GrowthPhase)}
        />
      ) : null}

      {normalizedType === 'harvest' ? (
        <>
          {/* Grade memakai OptionGroup yang sama dengan form catat panen supaya
              field ini terlihat identik di kedua layar. Menekan chip yang sudah
              aktif membatalkan pilihan — grade memang opsional, dan constraint
              harvest_records_fruit_condition_grade_check mengizinkan NULL. */}
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

          {/* Dua kolom sejajar dengan satuan di dalam kolom, sama dengan form
              catat panen. */}
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Field
                keyboardType="decimal-pad"
                label="Berat panen"
                onChangeText={(value) => setBeratKg(sanitizeDecimalInput(value, MAX_ANGKA_DESIMAL))}
                placeholder="12,5"
                unit="kg"
                value={beratKg}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                keyboardType="number-pad"
                label="Jumlah buah"
                onChangeText={(value) => setFruitCount(value.replace(/[^0-9]/g, ''))}
                placeholder="12"
                unit="buah"
                value={fruitCount}
              />
            </View>
          </View>

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
        </>
      ) : null}

      <DateField
        label={normalizedType === 'harvest' ? 'Tanggal panen' : 'Tanggal catatan'}
        onChangeDate={setEventDate}
        value={eventDate}
      />

      {/* GANTI FOTO CATATAN (adendum §4.2). Kartu "Penggantian foto catatan
          tidak termasuk dalam batch ini" yang dulu berdiri di sini DICABUT
          bersama keterbatasannya.

          Polanya mengikuti foto utama pohon di layar Ubah pohon: ketukan pada
          gambar membuka sheet berisi Ambil foto / Pilih galeri / Hapus foto,
          dan penghapusan baru terjadi setelah Simpan ditekan.

          KETUK-UNTUK-MEMBUKA-SHEET DIBENARKAN DI SINI, berbeda dari layar
          Detail Pohon tempat tombol kameranya dicabut: ini layar Edit,
          satu-satunya tempat foto catatan bisa diganti, dan pemakainya sudah
          datang untuk mengubah sesuatu. `changeHint` memasang afordans yang
          terlihat di bawah gambar supaya jalurnya tidak hanya bergantung pada
          ketukan yang harus ditemukan sendiri. */}
      <PhotoPickerCard
        changeHint="Ketuk foto untuk mengganti atau menghapusnya."
        choosePhotoLabel="Pilih galeri"
        description={processingPhoto ? PHOTO_PROCESSING_MESSAGE : undefined}
        emptyLabel="Tambah foto"
        imageUri={previewPhotoUri}
        loading={submitting || processingPhoto}
        optional
        removeLabel="Hapus foto"
        takePhotoLabel="Ambil foto"
        title="Foto catatan"
        onChoosePhoto={handlePickPhotoFromGallery}
        onRemovePhoto={canRemovePhoto ? handleRemovePhoto : undefined}
        onTakePhoto={handleTakePhotoFromCamera}
      />

      {/* Penghapusan yang BELUM TERJADI harus mengatakan dirinya, dan harus
          bisa dibatalkan tanpa biaya. Literal dan bentuknya sepadan dengan
          TreeMainPhotoFormSection; bedanya hanya kata "catatan". */}
      {deletePhotoRequested && !selectedPhoto ? (
        <View style={{ gap: spacing.md }}>
          <Text selectable style={{ color: colors.textMuted, lineHeight: typography.small.lineHeight }}>
            Foto catatan ini akan dihapus setelah perubahan disimpan.
          </Text>
          <Button
            disabled={submitting}
            title="Batalkan hapus foto"
            variant="secondary"
            onPress={() => setDeletePhotoRequested(false)}
          />
        </View>
      ) : null}

      <Field
        label="Catatan"
        multiline
        optional
        onChangeText={setNote}
        placeholder="Keterangan tambahan tentang catatan ini"
        value={note}
      />
    </Screen>
  );

}

// Nilai balik DIPERSEMPIT ke tiga jenis yang punya jalur edit, bukan
// TreeRecordRouteType lengkap yang berempat.
//
// Badannya sudah hanya menerima ketiganya sejak dulu — 'care' TIDAK BISA
// diedit siapa pun karena care_activities append-only dan tidak punya RPC
// update (migrasi 027) — tapi tipenya masih menjanjikan 'care' juga. Selisih
// itu berhenti jadi soal gaya begitu foto catatan masuk: RECORD_PHOTO_ENTITY_TYPE
// tidak punya baris 'care', dan janji tipe yang lebih lebar daripada kenyataan
// memaksa penjaga runtime untuk cabang yang tidak akan pernah tercapai.
function normalizeRecordType(value?: string): EditableRecordType | null {
  if (value === 'condition' || value === 'phase' || value === 'harvest') {
    return value;
  }

  return null;
}

// Penjaga eksahustifnya bekerja lewat Record, bukan rantai if: anggota baru di
// EditableRecordType gagal saat kompilasi di sini, bukan diam-diam jatuh ke
// cadangan yang keliru. Cadangan 'Edit catatan perawatan' yang dulu berdiri di
// ujung fungsi ini DICABUT — ia judul untuk layar yang tidak pernah ada.
function getEditTitle(recordType: EditableRecordType): string {
  const titles: Record<EditableRecordType, string> = {
    condition: 'Edit catatan kondisi',
    harvest: 'Edit catatan panen',
    phase: 'Edit catatan fase',
  };

  return titles[recordType];
}

function toDateInput(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// OptionList, OptionChip, InputField, dan TextArea DICABUT di batch 5.
//
// Keempatnya menggambar sendiri apa yang <ChoiceRowGroup> dan <Field> sudah
// gambar untuk seluruh aplikasi — tinggi, radius, warna garis, warna teks
// terpilih, perilaku tekan — dan hasilnya layar Edit catatan terlihat berbeda
// dari form catat yang persis di sebelahnya dalam satu alur.
//
// Yang ikut hilang bersamanya bukan cuma kemiripan: OptionChip lokal tidak
// pernah menerima `disabled`, jadi pilihannya masih bisa ditekan saat form
// sedang menyimpan, dan InputField selalu menulis placeholder 'Opsional' —
// termasuk pada kolom berat panen, yang tidak opsional kalau jumlah buahnya
// kosong.
