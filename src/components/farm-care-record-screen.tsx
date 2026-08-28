import { router } from 'expo-router';
import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { careCategoryOptions } from '../constants/careCategory';
import { tokens } from '../constants/theme';
import { useAuth } from '../context/auth-context';
import { consumePendingCareTrees, peekPendingCareTrees } from '../lib/pendingCareTrees';
import { createCareActivity } from '../services/careActivityService';
import { getTrees } from '../services/treeService';
import type { CareCategory, Tree } from '../types/domain';
import { formatCareCategory } from '../utils/displayFormat';
// formatFullDate, BUKAN formatDateOnly. Yang pertama mengurai 'YYYY-MM-DD'
// lewat komponennya sehingga tidak bisa bergeser sehari oleh zona waktu; yang
// kedua melewatkan string itu ke new Date(), yang menafsirkannya sebagai tengah
// malam UTC. Kalimat konfirmasi ini yang dibaca orang sebelum menulis sesuatu
// yang tidak bisa dibatalkan — tanggalnya tidak boleh meleset.
import { formatFullDate } from '../utils/taskDueDate';
import { formatTreeDisplayCode } from '../utils/treeFormat';
import { ConfirmDialog } from './bottom-sheet';
import { Icon } from './icons';
import {
  Button,
  DateField,
  ErrorBanner,
  Field,
  FormSection,
  LoadingState,
  OptionGroup,
  Screen,
  TopAppBar,
} from './ui';

// Mencatat perawatan yang SUDAH TERLANJUR dikerjakan untuk banyak posisi
// sekaligus, di luar jadwal.
//
// Kembarannya untuk satu pohon adalah tree-care-activity-screen.tsx, dan layar
// ini SENGAJA bukan turunannya. Di sana pohonnya ditentukan route dan taruhannya
// satu baris; di sini himpunannya datang dari peta dan taruhannya sebanyak yang
// dipilih. Bidang formulirnya ditiru persis, tetapi apa yang mengelilinginya —
// daftar yang bisa dipangkas, penyaringan ulang siklus, dan konfirmasi wajib —
// tidak punya padanan di sana dan memang tidak boleh ditambahkan ke sana.
//
// TANPA prop apa pun, termasuk basePath. Pola A dipenuhi lewat bentuknya
// (seluruh logika di src/components, berkas route tinggal shim), bukan lewat
// prop peran: mode pilih di peta hanya ada untuk pemilik, jadi layar ini punya
// TEPAT SATU pemanggil. Prop yang nilainya cuma satu adalah keluwesan palsu.
//
// TANPA foto, dan tanpa mengimpor photoAttachmentService sama sekali. Foto
// perawatan inisiatif menurunkan planting_id dari performed_at, yang masuk akal
// untuk satu pohon; untuk banyak pohon pertanyaannya sama dengan yang dulu
// membuat seluruh 'task_proof' ber-planting_id NULL. Itu keputusan tersendiri.
//
// TANPA takaran jumlah dan satuan. create_care_activity (migrasi 027) tidak
// menerima produk_jumlah maupun produk_satuan, meski kedua kolomnya ada di
// care_activities sejak migrasi 043 — menambahkannya di sini menuntut migrasi.
// Layar satu-pohon juga tidak punya keduanya, jadi tidak ada yang hilang.

// Sebanyak ini kode posisi ditampilkan sebelum sisanya dilipat. Tiga baris chip
// pada layar ponsel — cukup untuk mengenali apa yang terpilih, belum cukup
// untuk menenggelamkan formulir di bawahnya.
const VISIBLE_CODE_LIMIT = 12;

type CareFormErrors = { category?: string };

// Posisi yang gugur antara peta dan layar ini. Kodenya disimpan supaya
// pemberitahuannya bisa menyebut yang mana, bukan cuma berapa.
type DroppedPositions = { codes: string[]; total: number };

const NO_DROPPED: DroppedPositions = { codes: [], total: 0 };

// Urutan yang sama dengan filter_trees_with_active_planting (migrasi 057):
// row_position lalu column_position, BUKAN urutan teks kode. Urutan teks
// menaruh '10-A' sebelum '2-A', yang bukan urutan apa pun yang dikenali orang
// yang berdiri di kebun.
function compareTreePosition(left: Tree, right: Tree): number {
  const rowDiff = (left.rowPosition ?? Number.MAX_SAFE_INTEGER) - (right.rowPosition ?? Number.MAX_SAFE_INTEGER);

  if (rowDiff !== 0) {
    return rowDiff;
  }

  return (left.columnPosition ?? '').localeCompare(right.columnPosition ?? '');
}

// Chip kode posisi yang bisa dibuang. Kembaran dekat ActiveFilterChip di
// farm-map-screen.tsx, dan sengaja DISALIN alih-alih diangkat ke ui.tsx:
// mengangkatnya berarti menyentuh berkas bersama terbesar di repo demi satu
// kebutuhan tahap ini. Keduanya presentasional murni dan tidak menyimpan aturan
// apa pun, jadi menyimpang satu sama lain tidak bisa merusak perilaku.
function RemovableCodeChip({ code, onRemove }: { code: string; onRemove: () => void }) {
  return (
    <Pressable
      accessibilityLabel={`Buang ${code} dari daftar`}
      accessibilityRole="button"
      onPress={onRemove}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: tokens.color.brand.soft,
        borderColor: tokens.color.brand.border,
        borderCurve: 'continuous',
        borderRadius: tokens.radius.pill,
        borderWidth: 1,
        flexDirection: 'row',
        gap: tokens.space.xs,
        minHeight: 36,
        opacity: pressed ? 0.82 : 1,
        paddingHorizontal: tokens.space.md,
      })}
    >
      <Text
        selectable={false}
        numberOfLines={1}
        style={{ color: tokens.color.brand.dark, ...tokens.type.meta, fontWeight: '700' }}
      >
        {code}
      </Text>
      <Icon name="x" size={tokens.icon.xs} color={tokens.color.brand.base} />
    </Pressable>
  );
}

// Modal hasil, mengikuti FarmCreatedModal di app/(onboarding)/create-farm.tsx —
// termasuk alasannya: tidak ada jalan keluar selain tombolnya. Catatannya sudah
// tersimpan dan tidak bisa dibatalkan, jadi menutup modal diam-diam akan
// meninggalkan pemilik di formulir yang isinya sudah tidak berlaku.
//
// Yang memuat ulang peta adalah TOMBOL ini, bukan penyimpanannya. Kalau layar
// ini menavigasi begitu RPC selesai, modalnya tidak akan pernah sempat terbaca.
function CareRecordedModal({
  categoryLabel,
  onDone,
  treeCount,
}: {
  categoryLabel: string;
  onDone: () => void;
  treeCount: number | null;
}) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={() => undefined}
      statusBarTranslucent
      transparent
      visible={treeCount !== null}
    >
      <View
        style={{
          alignItems: 'center',
          backgroundColor: tokens.color.overlay.scrim,
          flex: 1,
          justifyContent: 'center',
          padding: tokens.space.xxl,
        }}
      >
        <View
          style={{
            backgroundColor: tokens.color.surface.card,
            borderCurve: 'continuous',
            borderRadius: tokens.radius.card,
            gap: tokens.space.lg,
            padding: tokens.space.xxl,
            width: '100%',
          }}
        >
          <View
            style={{
              alignItems: 'center',
              alignSelf: 'center',
              backgroundColor: tokens.color.brand.soft,
              borderRadius: tokens.radius.pill,
              height: 64,
              justifyContent: 'center',
              width: 64,
            }}
          >
            <Icon name="check" size={32} color={tokens.color.brand.base} />
          </View>

          <Text
            selectable
            style={{
              color: tokens.color.text.primary,
              fontSize: tokens.type.heading.fontSize,
              fontWeight: tokens.type.heading.fontWeight,
              lineHeight: tokens.type.heading.lineHeight,
              textAlign: 'center',
            }}
          >
            Perawatan tercatat
          </Text>

          <Text
            selectable
            style={{
              color: tokens.color.text.secondary,
              fontSize: tokens.type.body.fontSize,
              lineHeight: tokens.type.body.lineHeight,
              textAlign: 'center',
            }}
          >
            {`${categoryLabel} tercatat untuk ${treeCount ?? 0} pohon. Catatannya muncul di riwayat tiap pohon.`}
          </Text>

          <Button onPress={onDone} title="Kembali ke denah" variant="primary" />
        </View>
      </View>
    </Modal>
  );
}

export function FarmCareRecordScreen() {
  const { currentFarm } = useAuth();
  const [category, setCategory] = React.useState<CareCategory | ''>('');
  const [confirmVisible, setConfirmVisible] = React.useState(false);
  const [dropped, setDropped] = React.useState<DroppedPositions>(NO_DROPPED);
  const [error, setError] = React.useState<string | null>(null);
  const [eventDate, setEventDate] = React.useState(formatDateInput(new Date()));
  const [expanded, setExpanded] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<CareFormErrors>({});
  const [loading, setLoading] = React.useState(true);
  const [note, setNote] = React.useState('');
  const [produk, setProduk] = React.useState('');
  const [recordedCount, setRecordedCount] = React.useState<number | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [trees, setTrees] = React.useState<Tree[]>([]);

  // Daftar id dari peta, DIBACA DI FASE RENDER — bukan di dalam effect.
  //
  // INI YANG MEMBUAT PENGHAPUSAN DI EFFECT AMAN, dan urutannya wajib dipahami
  // sebelum menyentuh salah satunya:
  //
  //   render (peek di sini)  ->  effect penghapus  ->  effect pemuatan
  //
  // React menjalankan SELURUH fase render sebelum effect mana pun. Jadi begitu
  // pembacaannya duduk di penginisialisasi useState, id-nya sudah tersimpan di
  // state layar ini sebelum consume sempat menyala, dan urutan deklarasi antar
  // effect berhenti menentukan apa pun.
  //
  // Versi pertama berkas ini membaca di dalam effect PEMUATAN, sementara effect
  // penghapus dideklarasikan di atasnya. React menjalankan effect sesuai urutan
  // deklarasi, jadi kotaknya selalu sudah kosong saat dibaca — gagal 100%, dan
  // komentar lama di sini menyebutnya "pola yang sama dengan layar Buat Jadwal"
  // padahal yang disalin cuma letak consume-nya, bukan letak peek-nya yang
  // justru menjadi sebab keamanannya.
  //
  // peek SENGAJA tidak menghapus: penginisialisasi useState boleh dipanggil
  // lebih dari sekali, dan versi yang menghapus akan mengosongkan daftarnya
  // pada pemanggilan kedua. Yang menghapus tetap effect di bawah, tepat sekali.
  const [pendingTreeIds] = React.useState<readonly string[]>(
    () => peekPendingCareTrees() ?? []
  );

  const farmId = currentFarm?.farmId;

  // Titipannya dipakai TEPAT SEKALI. Aman berada di effect justru karena
  // pembacaannya sudah selesai di fase render (lihat catatan panjang di atas);
  // aman pula dari effect pemuatan yang berdependensi [farmId] dan boleh jalan
  // lebih dari sekali, karena effect itu kini membaca state, bukan kotaknya.
  React.useEffect(() => {
    consumePendingCareTrees();
  }, []);

  React.useEffect(() => {
    let isMounted = true;

    async function loadSelectedTrees() {
      if (pendingTreeIds.length === 0) {
        setError('Tidak ada pohon yang diserahkan dari denah. Pilih pohonnya lebih dulu di peta.');
        setLoading(false);
        return;
      }

      if (!farmId) {
        setError('Data kebun aktif tidak ditemukan.');
        setLoading(false);
        return;
      }

      setError(null);

      const result = await getTrees({ archived: false, farmId });

      if (!isMounted) {
        return;
      }

      if (result.error) {
        setError(result.error.message);
        setLoading(false);
        return;
      }

      const treeById = new Map(result.data.map((tree) => [tree.id, tree]));
      const usable: Tree[] = [];
      const droppedCodes: string[] = [];
      let droppedTotal = 0;

      for (const treeId of pendingTreeIds) {
        const tree = treeById.get(treeId);

        // Tidak ketemu berarti barisnya hilang setelah peta memuatnya. Kodenya
        // tidak bisa disebut karena barisnya memang tidak ada di tangan kita —
        // yang bisa dilaporkan tinggal jumlahnya.
        if (!tree) {
          droppedTotal += 1;
          continue;
        }

        // PENYARINGAN SIKLUS AKTIF, dan ini satu-satunya yang ada.
        // create_care_activity (027:67) hanya memeriksa bahwa tiap pohon
        // sekebun dengan aktivitasnya; ia TIDAK memeriksa siklus tanam sama
        // sekali. Jadi kalau posisi tanpa siklus lolos dari sini, ia akan
        // benar-benar tertaut di care_activity_trees — tabel yang sengaja
        // tidak punya jalur DELETE (025:67), sehingga tautannya permanen.
        if (tree.activePlanting === null) {
          droppedCodes.push(formatTreeDisplayCode(tree));
          droppedTotal += 1;
          continue;
        }

        usable.push(tree);
      }

      setTrees(usable.sort(compareTreePosition));
      setDropped(droppedTotal > 0 ? { codes: droppedCodes, total: droppedTotal } : NO_DROPPED);
      setLoading(false);
    }

    loadSelectedTrees();

    return () => {
      isMounted = false;
    };
    // pendingTreeIds ikut disebut walau nilainya tidak pernah berubah — ia
    // state tanpa setter, jadi identitasnya tetap seumur layar. Menyebutnya
    // membuat dependensinya jujur terhadap apa yang benar-benar dibaca badan
    // effect ini, dan tidak menambah satu pun pemanggilan ulang.
  }, [farmId, pendingTreeIds]);

  const categoryLabel = category ? formatCareCategory(category) : '';
  const visibleTrees = expanded ? trees : trees.slice(0, VISIBLE_CODE_LIMIT);

  function goBackToMap() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/owner/trees/map');
  }

  function removeTree(treeId: string) {
    setTrees((current) => current.filter((tree) => tree.id !== treeId));
  }

  // Menekan simpan TIDAK menulis apa pun. Ia memvalidasi lalu membuka
  // konfirmasi; penulisannya ada di handleConfirmedSave.
  function handleSavePress() {
    if (!category) {
      setFieldErrors({ category: 'Jenis perawatan wajib dipilih.' });
      return;
    }

    setFieldErrors({});
    setError(null);
    setConfirmVisible(true);
  }

  async function handleConfirmedSave() {
    if (!farmId) {
      setConfirmVisible(false);
      setError('Data kebun aktif tidak ditemukan.');
      return;
    }

    if (!category) {
      setConfirmVisible(false);
      return;
    }

    // Gerbang terakhir sebelum RPC. Daftarnya sudah disaring saat dimuat, jadi
    // ini praktis tidak pernah berbunyi — dan justru karena itu ia murah, dan
    // justru karena database tidak menyaring apa pun ia tetap dipasang.
    // Jaminan "hanya posisi bersiklus aktif" tidak boleh punya satu pun celah
    // di sisi aplikasi, karena tidak ada sisi lain yang menutupinya.
    const stillPlanted = trees.filter((tree) => tree.activePlanting !== null);

    if (stillPlanted.length !== trees.length) {
      setConfirmVisible(false);
      setTrees(stillPlanted);
      setError(
        'Sebagian posisi siklus tanamnya sudah tidak aktif dan dikeluarkan dari daftar. Periksa daftarnya lalu simpan lagi.'
      );
      return;
    }

    if (stillPlanted.length === 0) {
      setConfirmVisible(false);
      setError('Tidak ada pohon yang bisa dicatat.');
      return;
    }

    setSubmitting(true);

    const result = await createCareActivity({
      category,
      farmId,
      note,
      performedAt: eventDate,
      produk,
      treeIds: stillPlanted.map((tree) => tree.id),
    });

    setSubmitting(false);
    setConfirmVisible(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    // TANPA navigasi di sini. Yang memindahkan layar adalah tombol di modal
    // hasil — kalau dipanggil sekarang, layar ini terbongkar bersama modalnya
    // sebelum sempat terbaca. Pola yang sama dipakai create-farm.tsx.
    setRecordedCount(stillPlanted.length);
  }

  if (loading) {
    return (
      <LoadingState
        header={<TopAppBar title="Catat perawatan" onBack={goBackToMap} />}
        message="Menyiapkan catatan perawatan..."
      />
    );
  }

  return (
    <Screen
      header={<TopAppBar title="Catat perawatan" onBack={goBackToMap} />}
      stickyFooter={
        <Button
          disabled={trees.length === 0}
          loading={submitting}
          onPress={handleSavePress}
          title="Simpan"
        />
      }
    >
      <ErrorBanner message={error} />

      {/* Posisi yang gugur antara peta dan layar ini. Disampaikan lebih dulu,
          sebelum formulirnya, supaya pemilik tahu daftarnya sudah berubah
          sebelum ia mulai mengisi apa pun. */}
      {dropped.total > 0 ? (
        <View
          style={{
            backgroundColor: tokens.color.status.warning.bg,
            borderColor: tokens.color.status.warning.border,
            borderCurve: 'continuous',
            borderRadius: tokens.radius.cardInner,
            borderWidth: 1,
            padding: tokens.space.md,
          }}
        >
          <Text selectable style={{ color: tokens.color.status.warning.text, ...tokens.type.bodySmall }}>
            {formatDroppedMessage(dropped)}
          </Text>
        </View>
      ) : null}

      <FormSection
        title="Pohon yang dicatat"
        description="Daftar ini datang dari denah kebun. Ketuk kode untuk membuangnya; menambah pohon dilakukan dari peta."
      >
        {trees.length === 0 ? (
          <View style={{ gap: tokens.space.md }}>
            <Text selectable style={{ color: tokens.color.text.secondary, ...tokens.type.bodySmall }}>
              Semua pohon sudah dibuang dari daftar. Tidak ada yang bisa dicatat.
            </Text>
            <Button onPress={goBackToMap} size="small" title="Pilih ulang di denah" variant="secondary" />
          </View>
        ) : (
          <View style={{ gap: tokens.space.md }}>
            <Text selectable style={{ color: tokens.color.text.secondary, ...tokens.type.bodySmall }}>
              {`${trees.length} pohon akan dicatat`}
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm }}>
              {visibleTrees.map((tree) => (
                <RemovableCodeChip
                  key={tree.id}
                  code={formatTreeDisplayCode(tree)}
                  onRemove={() => removeTree(tree.id)}
                />
              ))}
            </View>

            {/* Dilipat, bukan digulung di dalam kotak sendiri: penggulung
                vertikal di dalam penggulung vertikal milik Screen akan berebut
                gestur yang sama, persis masalah yang membuat peta tidak memakai
                Screen. Melipat membiarkan halamannya yang menggulung. */}
            {/* Syaratnya panjang DAFTAR, bukan berapa yang sedang tersembunyi.
                Kalau diukur dari yang tersembunyi, tombolnya tetap tampil
                setelah pemilik memangkas daftar di bawah batas sambil terbuka —
                tombol yang menjanjikan melipat sesuatu yang sudah tidak ada. */}
            {trees.length > VISIBLE_CODE_LIMIT ? (
              <Button
                onPress={() => setExpanded((current) => !current)}
                size="small"
                title={expanded ? 'Sembunyikan sebagian' : `Lihat semua (${trees.length})`}
                variant="quiet"
              />
            ) : null}
          </View>
        )}
      </FormSection>

      {/* Keempat bidang di bawah ditiru PERSIS dari tree-care-activity-screen:
          tanggal, jenis perawatan, produk, catatan. Tidak lebih, tidak kurang. */}
      <FormSection title="Jenis perawatan" description="Catat aktivitas perawatan yang dilakukan tanpa jadwal tugas.">
        <View style={{ gap: tokens.space.sm }}>
          <DateField label="Tanggal perawatan *" onChangeDate={setEventDate} value={eventDate} />
          <OptionGroupCategory
            disabled={submitting}
            error={fieldErrors.category}
            onChange={(value) => {
              setFieldErrors((prev) => ({ ...prev, category: undefined }));
              setCategory(value);
            }}
            value={category}
          />
        </View>
      </FormSection>

      <FormSection title="Produk yang dipakai" description="Opsional. Merek pupuk atau pestisida yang digunakan.">
        <Field label="" onChangeText={setProduk} placeholder="Opsional" value={produk} />
      </FormSection>

      <FormSection title="Catatan perawatan">
        <Field label="" multiline onChangeText={setNote} placeholder="Opsional" value={note} />
      </FormSection>

      {/* KONFIRMASI WAJIB, dan sengaja berbeda dari layar satu-pohon yang tidak
          punya konfirmasi sama sekali. Di sana taruhannya satu baris; di sini
          sebanyak pohon yang dipilih, dan care_activities bersifat append-only
          sementara care_activity_trees tidak punya jalur hapus. Salah mencatat
          untuk empat puluh pohon berarti empat puluh tautan permanen yang tidak
          bisa dikoreksi lewat jalur mana pun di aplikasi ini. */}
      <ConfirmDialog
        cancelLabel="Periksa lagi"
        confirmLabel="Ya, catat sekarang"
        icon="alert-triangle"
        loading={submitting}
        message={`${categoryLabel} akan dicatat untuk ${trees.length} pohon pada ${formatFullDate(eventDate)}. Catatan perawatan tidak bisa dibatalkan atau dihapus setelah tersimpan.`}
        title="Catat perawatan sekarang?"
        visible={confirmVisible}
        onCancel={() => {
          if (!submitting) {
            setConfirmVisible(false);
          }
        }}
        onConfirm={() => void handleConfirmedSave()}
      />

      <CareRecordedModal categoryLabel={categoryLabel} onDone={goBackToMap} treeCount={recordedCount} />
    </Screen>
  );
}

// Pembungkus tipis di atas OptionGroup, hanya supaya pemetaan kategori ke label
// tidak ditulis dua kali di dalam JSX yang sudah panjang. Daftarnya tetap
// careCategoryOptions dan labelnya tetap formatCareCategory — SUMBER YANG SAMA
// dengan layar satu-pohon, bukan salinan baru.
function OptionGroupCategory({
  disabled,
  error,
  onChange,
  value,
}: {
  disabled: boolean;
  error?: string;
  onChange: (value: CareCategory) => void;
  value: CareCategory | '';
}) {
  return (
    <OptionGroup
      error={error}
      label="Jenis perawatan *"
      options={careCategoryOptions.map((option) => ({
        disabled,
        label: formatCareCategory(option),
        value: option,
      }))}
      value={value}
      onChange={(next) => onChange(next as CareCategory)}
    />
  );
}

function formatDroppedMessage(dropped: DroppedPositions): string {
  if (dropped.codes.length === 0) {
    return `${dropped.total} posisi dikeluarkan dari daftar karena sudah tidak tersedia di kebun.`;
  }

  const listed = dropped.codes.join(', ');

  if (dropped.codes.length === dropped.total) {
    return `${dropped.total} posisi dikeluarkan dari daftar karena siklus tanamnya sudah tidak aktif: ${listed}.`;
  }

  return `${dropped.total} posisi dikeluarkan dari daftar karena sudah tidak bisa dicatat, di antaranya ${listed}.`;
}

// Sama persis dengan formatDateInput di tree-care-activity-screen: tanggal hari
// ini dalam waktu perangkat, bentuk YYYY-MM-DD yang diterima DateField.
function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
