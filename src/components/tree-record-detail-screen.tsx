import { router } from 'expo-router';
import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { GRADE_PANEN_LABELS } from '../constants/gradePanen';
import { colors, radius, spacing, typography } from '../constants/theme';
import { colors as palette, text as typeScale } from '../theme/tokens';
import {
  getCareActivityDetail,
  softDeleteCareActivity,
} from '../services/careActivityService';
import {
  getConditionReportDetail,
  softDeleteConditionReport,
} from '../services/conditionReportService';
import {
  getGrowthPhaseRecordDetail,
  softDeleteGrowthPhaseRecord,
} from '../services/growthPhaseService';
import {
  getHarvestRecordDetail,
  softDeleteHarvestRecord,
} from '../services/harvestService';
import { getFarmActorDisplayProfiles } from '../services/memberService';
import {
  getConditionRecordPhotos,
  getGrowthPhaseRecordPhotos,
  getHarvestRecordPhotos,
  getInitiativeCareProofPhotos,
} from '../services/photoAttachmentService';
import { getTreeDetail } from '../services/treeService';
import { useAuth } from '../context/auth-context';
import type {
  CareCategory,
  HarvestRecord,
  MemberRole,
  ServiceResult,
  SuccessData,
  Tree,
  UUID,
} from '../types/domain';
import type { PhotoAttachmentEntityType, PhotoAttachmentPreviewItem } from '../types/media';
import {
  formatCareCategory,
  formatPersonDisplayName,
  formatProdukDenganTakaran,
  sanitizeDisplayValue,
} from '../utils/displayFormat';
import { formatGrowthPhase, formatTreeConditionStatus, formatTreeDisplayCode } from '../utils/treeFormat';
import { setPendingFeedback } from '../lib/pendingFeedback';
import { ConfirmDialog } from './bottom-sheet';
import { PhotoViewerModal } from './media';
import {
  Button,
  EmptyState,
  ErrorBanner,
  LoadingState,
  MenuRow,
  MetaRow,
  Screen,
  SectionLabel,
  TopAppBar,
} from './ui';

// Catatan perawatan (care) TIDAK BISA DIEDIT siapa pun — care_activities
// append-only, tidak ada RPC update untuknya (migrasi 027). Sejak migrasi 067
// ia BISA DIHAPUS, tapi hanya yang berasal dari pencatatan INISIATIF; yang
// terjadwal dibatalkan lewat layar tugas, bukan dari sini.
export type TreeRecordRouteType = 'condition' | 'phase' | 'harvest' | 'care';

type TreeRecordDetailScreenProps = {
  basePath: '/owner/trees' | '/worker/trees';
  recordId?: string;
  recordType?: string;
  treeId?: string;
};

type DetailState = {
  authorId: UUID;
  authorName?: string | null;
  authorRole?: MemberRole | null;
  authorVerb: 'harvested' | 'recorded';
  canEdit: boolean;
  // SENGAJA TERPISAH dari canEdit, dan seringkali berbeda darinya: pemilik kebun
  // boleh menghapus catatan pekerjanya tapi tidak boleh mengubahnya. Keduanya
  // dihitung di service, bukan di sini — layar ini tidak tahu siapa pemilik
  // kebun dan tidak boleh menebaknya.
  canDelete: boolean;
  createdAt?: string | null;
  eventAt: string;
  eventLabel: string;
  farmId: UUID;
  /**
   * NILAI UTAMA catatan ini, dan judul layarnya: 'Sehat', 'Berbunga', '12 kg',
   * 'Penyemprotan'. Dirender `fonts.serif` 36.
   *
   * MENGGANTIKAN `title`, yang dulu berbunyi 'Detail catatan kondisi' —
   * kalimat yang mengulang jenis catatan (sudah tertulis sebagai label di
   * atasnya) dan kata 'Detail' (sudah dinyatakan oleh fakta bahwa layar ini
   * terbuka). Nilainya sendiri dulu duduk sebagai MetaRow berlabel di tengah
   * layar, yaitu tempat terakhir yang dilihat pembacanya.
   */
  headline: string;
  note: string | null;
  recordLabel: string;
  // Ruas kedua label jenis (mis. asal perawatan Terjadwal/Inisiatif). Digabung
  // ke label yang sama dengan titik tengah, bukan berdiri sebagai badge kedua.
  originLabel?: string | null;
  // Jenis foto yang dimiliki catatan INI, bukan jenis catatannya.
  //
  // Perbedaannya nyata sejak migrasi 060: recordType 'care' menampung DUA jenis
  // baris, dan hanya yang inisiatif punya foto di layar ini. Yang terjadwal
  // fotonya 'task_proof' dan ditampilkan di layar tugas, bukan di sini -- kalau
  // ia ikut dinilai dari recordType saja, layar detail perawatan terjadwal akan
  // memunculkan kotak "Foto catatan" yang selamanya kosong.
  //
  // Fase & panen dulu punya masalah yang sama dan itulah yang B3d hapus: kotak
  // foto tanpa jalur unggah di baliknya. Sejak migrasi 061 keduanya PUNYA
  // jalur itu -- entity_type sendiri, policy sendiri, pemilih foto di layar
  // pencatatannya -- jadi keduanya diisi di sini dengan alasan yang membuat
  // B3d tidak berlaku lagi untuk mereka. Yang masih berlaku: JANGAN mengisi
  // medan ini untuk perawatan terjadwal.
  //
  // null/undefined = catatan ini tidak punya kotak foto sama sekali.
  photoEntityType?: PhotoAttachmentEntityType | null;
  rows: Array<{ label: string; value: string | null }>;
  // false untuk record read-only-by-design (perawatan): sembunyikan hint
  // "hanya bisa diubah oleh pelapor" yang tidak relevan. Default (undefined) = tampil.
  supportsEdit?: boolean;
  /**
   * Aksi hapus dirender sebagai BARIS MERUSAK di badan layar, bukan tombol di
   * bar aksi. Hanya catatan perawatan memakainya (batch 6b).
   *
   * ADA KARENA layar ini melayani empat jenis catatan dengan dua bentuk aksi
   * yang berbeda. Tiga jenis lain punya tombol "Edit" sebagai aksi utamanya, dan
   * "Hapus" duduk di sebelahnya sebagai aksi kedua — di sana bar aksi memang
   * tempatnya. Perawatan TIDAK punya aksi utama sama sekali: bar aksi yang
   * isinya cuma satu tombol merah membuat menghapus terbaca sebagai hal yang
   * memang diharapkan dilakukan di layar ini.
   *
   * Sebagai baris merusak di dasar badan layar, ia harus digulung untuk
   * ditemukan — sepadan dengan seberapa jarang ia dipakai, dan bentuk yang sama
   * dengan "Pohon sudah tidak ada" di layar edit pohon (batch 4b) dan
   * "Batalkan jadwal" di detail jadwal (batch 6a).
   *
   * Tanpa nilai, jalur bar aksi berjalan persis seperti sebelumnya.
   */
  deleteAsRow?: boolean;
  /**
   * Kalimat yang menjelaskan kenapa catatan ini tidak bisa diubah, DAN apa
   * gantinya.
   *
   * Hanya diisi untuk perawatan INISIATIF, yang memang punya jalan keluar
   * (hapus lalu catat ulang). Perawatan TERJADWAL sengaja tidak mendapatnya:
   * di sana tidak ada tombol hapus dan tidak ada jalan keluar apa pun, jadi
   * kalimat yang menawarkannya akan menunjuk ke pintu yang tidak ada.
   */
  immutableNotice?: string | null;
  updatedAt?: string | null;
};

export function TreeRecordDetailScreen({
  basePath,
  recordId,
  recordType,
  treeId,
}: TreeRecordDetailScreenProps) {
  const { profile } = useAuth();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [detail, setDetail] = React.useState<DetailState | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [photos, setPhotos] = React.useState<PhotoAttachmentPreviewItem[]>([]);
  const [tree, setTree] = React.useState<Tree | null>(null);
  const normalizedType = normalizeRecordType(recordType);

  const loadDetail = React.useCallback(async () => {
    if (!treeId || !recordId || !normalizedType) {
      setError('Catatan tidak ditemukan.');
      setDetail(null);
      setTree(null);
      setPhotos([]);
      return;
    }

    setError(null);

    const [treeResult, detailResult] = await Promise.all([
      getTreeDetail({ treeId }),
      loadRecordDetail(normalizedType, recordId),
    ]);

    if (treeResult.error) {
      setError(treeResult.error.message);
      setTree(null);
    } else {
      setTree(treeResult.data);
    }

    if (detailResult.error) {
      setError(detailResult.error.message);
      setDetail(null);
      setPhotos([]);
      return;
    }

    setDetail(detailResult.data);
    const photoResult = await loadRecordPhotos(detailResult.data, recordId);
    setPhotos(photoResult.data ?? []);
  }, [normalizedType, recordId, treeId]);

  React.useEffect(() => {
    setLoading(true);
    loadDetail().finally(() => setLoading(false));
  }, [loadDetail]);

  // Menghapus catatan. Bentuknya sepadan dengan runEndPlanting di layar edit
  // pohon, dan karena alasan yang sama: SUKSES TIDAK MEMUAT ULANG LAYAR INI.
  //
  // Layar ini menampilkan catatan yang barusan dihapus. Memuatnya ulang berarti
  // memanggil kembali getConditionReportDetail dan kerabatnya — yang sejak
  // bagian B menyaring is_deleted, jadi jawabannya "tidak ditemukan". Pemakainya
  // akan melihat galat sebagai hasil dari tindakan yang BERHASIL. router.replace
  // membawanya ke detail pohon, tempat riwayatnya sudah tanpa catatan itu.
  //
  // replace, bukan push: layar ini sudah tidak sah dikunjungi lagi, jadi ia
  // tidak boleh tertinggal di back-stack menunggu ditekan kembali.
  //
  // Snackbar dititipkan lewat pendingFeedback karena layar yang seharusnya
  // menampilkannya sudah tidak ada saat pesannya jatuh tempo — layar detail
  // pohon membacanya di useFocusEffect miliknya.
  //
  // Dialog ditutup LEBIH DULU, sebelum RPC berjalan. Keadaan "sedang menghapus"
  // ditunjukkan tombol Hapus di footer (label berganti, terkunci), bukan
  // pemintal di dalam dialog — jadi kalau gagal, galatnya mendarat di layar yang
  // sudah terlihat, bukan di balik dialog yang menutupinya.
  async function runDelete() {
    if (!detail || !normalizedType || !recordId) {
      return;
    }

    setConfirmDeleteOpen(false);
    setDeleting(true);
    setError(null);

    const result = await softDeleteRecord(normalizedType, recordId);

    if (result.error) {
      setError(result.error.message);
      setDeleting(false);
      return;
    }

    setDeleting(false);
    setPendingFeedback('record_deleted');
    router.replace(`${basePath}/${treeId}`);
  }

  if (loading) {
    // Bar tanpa judul, sama dengan layar yang sudah selesai memuat. Dulu judul
    // di sini terpaksa statis "Detail catatan" karena detail.title baru ada
    // SETELAH catatannya terbaca. Persoalan itu hilang bersama judul barnya:
    // judul catatan kini berdiri di badan layar, tempat ia memang boleh muncul
    // belakangan. Idiomnya sama dengan tree-detail-screen.tsx.
    return (
      <LoadingState
        header={<TopAppBar onBack={() => router.back()} />}
        message="Memuat detail catatan..."
      />
    );
  }

  if (!detail || !normalizedType) {
    return (
      <Screen>
        <TopAppBar onBack={() => router.back()} />
        <ErrorBanner message={error} />
        <EmptyState title="Catatan tidak ditemukan" subtitle="Catatan mungkin sudah dihapus atau akses tidak aktif." />
      </Screen>
    );
  }

  // Lewat sanitizeDisplayValue, bukan sekadar trim(). Itu penapis yang sama yang
  // dipakai MetaRow sebelum perubahan ini, jadi catatan yang isinya UUID atau
  // pesan teknis tetap disembunyikan seperti dulu — yang berubah cuma bahwa
  // hasil kosongnya sekarang berarti "jangan render", bukan "cetak tanda hubung".
  const noteText = sanitizeDisplayValue(detail.note);

  return (
    <Screen
      // Footer muncul kalau ADA SALAH SATU aksi, bukan hanya saat bisa diubah.
      // Kombinasi "tidak bisa ubah, bisa hapus" bukan kasus tepi — itu keadaan
      // pemilik kebun yang membuka catatan pekerjanya, dan di sana tombol Hapus
      // berdiri sendirian.
      //
      // KECUALI saat `deleteAsRow`: di sana hapus turun ke badan layar dan bar
      // aksi tidak dirender sama sekali. Lihat catatan pada prop itu.
      footer={
        detail.canEdit || (detail.canDelete && !detail.deleteAsRow) ? (
          <>
            {detail.canEdit ? (
              /* 'Edit', bukan 'Ubah' dan bukan 'Edit catatan'. Satu kata: bar
                 aksi berdiri di bawah layar yang seluruhnya membahas satu
                 catatan, jadi kata 'catatan' di dalam labelnya mengulang
                 konteks yang tidak pernah ambigu. */
              <Button
                title="Edit"
                onPress={() => router.push(`${basePath}/${treeId}/records/${normalizedType}/${recordId}/edit`)}
              />
            ) : null}
            {detail.canDelete && !detail.deleteAsRow ? (
              /* loadingTitle, BUKAN pemintal: label berganti jadi teks biasa
                 sehingga lebar tombolnya tidak berubah saat diproses. Itu satu-
                 satunya jalur Button yang tidak memasang ActivityIndicator. */
              <Button
                title="Hapus"
                loading={deleting}
                loadingTitle="Menghapus…"
                variant="danger"
                onPress={() => setConfirmDeleteOpen(true)}
              />
            ) : null}
          </>
        ) : undefined
      }
    >
      <TopAppBar onBack={() => router.back()} />
      <ErrorBanner message={error} />

      {/* ConfirmDialog, BUKAN Alert.alert. Alert bawaan platform tidak bisa
          diberi gaya, judulnya tampil berbeda di Android dan iOS, dan seluruh
          konfirmasi merusak lain di app ini sudah memakai dialog yang sama. */}
      <ConfirmDialog
        confirmLabel="Hapus"
        cancelLabel="Batal"
        message="Catatan ini akan dihapus dan tidak muncul lagi di riwayat pohon."
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={runDelete}
        title="Hapus catatan?"
        tone="danger"
        visible={confirmDeleteOpen}
      />

      {/* SUSUNAN TETAP untuk ketiga jenis catatan (batch 5):
            1. label jenis   2. nilai utama   3. baris meta
            4. catatan       5. foto          6. tombol Edit (di bar aksi)

          FOTO TURUN dari puncak layar ke bawah catatan. Sebagai hero setinggi
          220 ia mendorong nilai catatan — satu-satunya hal yang dicari
          pembacanya — keluar dari layar pertama, dan foto catatan adalah bukti
          pendukung, bukan isinya. Syaratnya tidak berubah: detail.photoEntityType
          (jenis foto yang dimiliki catatan INI, bukan jenis catatannya) DAN
          memang ada fotonya. */}

      {/* 1. LABEL JENIS. 12/600 huruf besar, letterSpacing 1,2, textMuted —
             lebih ringan daripada nilai yang dinamainya. Menggantikan dua
             <Badge> yang dulu berdiri di sini: chip berbingkai untuk sebuah
             kata yang tidak bisa ditekan dan tidak menyatakan status apa pun.
             Asal perawatan ('Terjadwal'/'Inisiatif') masuk sebagai ruas kedua
             label yang sama, bukan sebagai chip kedua. */}
      <View style={{ gap: spacing.sm }}>
        <SectionLabel
          title={
            detail.originLabel ? `${detail.recordLabel} · ${detail.originLabel}` : detail.recordLabel
          }
        />

        {/* 2. NILAI UTAMA, serif 36. Keluarga serif dipakai di seluruh redesign
               untuk angka dan nilai yang DIBACA sebagai nilai, bukan sebagai
               kalimat — idiom yang sama dengan kode pohon serif 40 di layar
               detail pohon, satu tingkat lebih kecil karena layar ini anaknya. */}
        <Text
          accessibilityRole="header"
          selectable
          style={{ ...typeScale.stat36, color: palette.textPrimary }}
        >
          {detail.headline}
        </Text>

        {/* 3. BARIS META: pohon · tanggal · oleh. SATU baris, bukan dua.
               Pohonnya disebut lewat kode saja ('Pohon 12-C'), bukan lewat
               formatTreeContextLine yang berisi empat ruas — di layar ini
               pertanyaannya cuma "catatan pohon yang mana", dan satu-satunya
               jalan masuk ke sini adalah riwayat pohon itu sendiri. */}
        <Text selectable style={secondaryLineStyle}>
          {[
            tree ? `Pohon ${formatTreeDisplayCode(tree)}` : null,
            formatEventDate(detail.eventAt),
            `${detail.authorVerb === 'harvested' ? 'dipanen oleh' : 'dicatat oleh'} ${formatActorDisplayName(
              {
                actorId: detail.authorId,
                actorName: detail.authorName,
                actorRole: detail.authorRole,
                currentUserId: profile?.id,
              }
            )}`,
          ]
            .filter((part): part is string => Boolean(part))
            .join(' · ')}
        </Text>
      </View>

      {/* Fakta SISA, yang tidak terangkat jadi nilai utama: jumlah buah dan
          grade pada panen, bahan dan status pada perawatan. Baris bernilai null
          tidak pernah ditambahkan — lihat buildHarvestRows. */}
      {detail.rows.length > 0 ? (
        <View style={{ gap: spacing.md }}>
          {detail.rows.map((row) => (
            <MetaRow key={row.label} label={row.label} value={row.value} />
          ))}
        </View>
      ) : null}

      {/* 4. CATATAN sebagai PARAGRAF, dan hanya kalau ada isinya. Dulu ia MetaRow
             yang mencetak tanda hubung saat kosong — sebuah baris yang hadir hanya
             untuk mengumumkan bahwa tidak ada yang perlu dibaca. */}
      {noteText ? (
        <View style={{ gap: spacing.xs }}>
          {/* colors.textMuted, BUKAN colors.muted: alias `muted` hanya hidup di
              peta warna lokal ui.tsx, bukan di token bersama. Nilainya sama. */}
          <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
            Catatan
          </Text>
          <Text selectable style={{ color: colors.text, fontSize: 16, lineHeight: 24 }}>
            {noteText}
          </Text>
        </View>
      ) : null}

      {/* 5. FOTO. Tanpa foto, di posisi ini tidak dirender apa pun: kartu
             berjudul "Foto catatan" yang dulu berdiri di sini dengan tulisan
             "Tidak ada foto pada catatan ini" sudah dicabut di B3d. Kalimat itu
             memberi tahu pembacanya ketiadaan, yang sudah terlihat dari tidak
             adanya foto. */}
      {detail.photoEntityType && photos.length > 0 ? <RecordPhotoSection photos={photos} /> : null}

      {/* Jejak audit dan keterangan izin duduk paling bawah: keduanya tentang
          catatannya, bukan isinya. */}
      {detail.createdAt || shouldShowUpdatedAt(detail.createdAt, detail.updatedAt) ? (
        <View style={{ gap: spacing.md }}>
          {detail.createdAt ? <MetaRow label="Dibuat pada" value={formatDateTime(detail.createdAt)} /> : null}
          {shouldShowUpdatedAt(detail.createdAt, detail.updatedAt) ? (
            <MetaRow label="Terakhir diubah" value={formatDateTime(detail.updatedAt as string)} />
          ) : null}
        </View>
      ) : null}

      {!detail.canEdit && detail.supportsEdit !== false ? (
        <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
          Catatan ini hanya bisa diubah oleh pelapor.
        </Text>
      ) : null}

      {/* Keterangan "tidak bisa diubah" milik catatan yang memang TIDAK PERNAH
          bisa diubah siapa pun — bukan yang kebetulan bukan milik pembacanya.
          Keduanya dipisah karena jalan keluarnya berbeda: yang di atas bisa
          diminta ke pelapornya, yang ini harus dihapus lalu dicatat ulang.

          Dicetak TEPAT DI ATAS baris hapusnya, karena ia yang menjelaskan
          kenapa baris itu ada sama sekali. */}
      {detail.immutableNotice ? (
        <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
          {detail.immutableNotice}
        </Text>
      ) : null}

      {/* BARIS MERUSAK, menggantikan tombol Hapus di bar aksi untuk catatan
          perawatan. Lihat catatan lengkap pada prop `deleteAsRow`.

          Kata "HAPUS" BENAR DI SINI, dan itu kebalikan dari aturan di batch 4b
          dan 6a. Di sana kata itu dilarang karena datanya tidak dihapus —
          siklus ditutup, jadwal dibatalkan, barisnya tetap ada. Catatan
          perawatan inisiatif BENAR-BENAR hilang dari riwayat lewat
          soft_delete_care_activity, jadi menghaluskannya jadi "batalkan" akan
          berbohong ke arah yang berlawanan.

          navigates={false}: ia membuka dialog di tempat, bukan berpindah layar.
          <MenuRow> memang sudah menjatuhkan chevron untuk baris danger secara
          bawaan; ditulis eksplisit supaya alasannya terbaca. */}
      {detail.canDelete && detail.deleteAsRow ? (
        <MenuRow
          danger
          icon="x"
          label={deleting ? 'Menghapus…' : 'Hapus catatan'}
          meta="Catatan ini hilang dari riwayat pohon."
          navigates={false}
          onPress={() => {
            if (deleting) {
              return;
            }

            setConfirmDeleteOpen(true);
          }}
        />
      ) : null}
    </Screen>
  );
}

// Gaya baris keterangan sekunder di kepala layar. Dipakai dua kali — baris
// waktu/pencatat dan baris konteks pohon — dan sengaja SATU nilai supaya
// keduanya tidak bisa menyimpang satu sama lain.
const secondaryLineStyle = {
  color: colors.textMuted,
  fontSize: typography.small.fontSize,
  lineHeight: typography.small.lineHeight,
} as const;

// Foto catatan. Gambar lebar setinggi 220, di bawah catatan.
//
// NAMANYA BUKAN LAGI 'Hero', dan itu bukan kosmetik: di batch 5 fotonya turun
// dari puncak layar ke posisi kelima dalam susunan tetap. Nama yang menyatakan
// posisi yang sudah tidak ditempatinya akan menyesatkan pembaca berikutnya
// lebih daripada tidak ada nama sama sekali.
//
// Bentuknya tetap sepadan dengan foto pohon di layar detail pohon — tinggi 220,
// sudut kartu, dan ketukan membuka PhotoViewerModal yang sama. Dua layar yang
// bersebelahan dalam satu alur tidak boleh memperlakukan foto dengan dua cara.
//
// KETUKAN DI SINI HANYA MEMBESARKAN, tidak membuka jalur ganti atau hapus.
// Layar ini BACA SAJA; mengganti foto catatan ada di layar Edit, dan hanya di
// sana. Larangan gestur tersembunyi tidak berlaku untuk pembesaran: ia tidak
// mengubah apa pun, dan tidak ada fungsi yang hilang bila ketukannya tidak
// pernah ditemukan.
//
// SENGAJA BUKAN PhotoAttachmentPreviewList. Komponen itu adalah DAFTAR yang bisa
// disunting: tiap foto duduk di dalam kotak berbingkai berpadding dengan tombol
// hapus opsional, gambarnya setinggi 156. Itu bentuk yang benar untuk layar yang
// MENGELOLA foto, dan bentuk yang salah untuk satu gambar yang hanya dibaca.
//
// Kegagalan muat ditangani per foto, sama seperti di PhotoAttachmentPreviewList
// dan dengan alasan yang sama: signed URL foto hanya berumur 10 menit, jadi
// layar yang dibiarkan terbuka akan menemui gambar yang sudah kedaluwarsa.
function RecordPhotoSection({ photos }: { photos: PhotoAttachmentPreviewItem[] }) {
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [failedUrls, setFailedUrls] = React.useState<string[]>([]);

  React.useEffect(() => {
    setFailedUrls([]);
  }, [photos]);

  function markFailed(url: string) {
    setFailedUrls((current) => (current.includes(url) ? current : [...current, url]));
  }

  return (
    <View style={{ gap: spacing.md }}>
      {photos.map((photo, index) => (
        <View key={photo.id ?? `${photo.url}-${index}`} style={{ gap: spacing.sm }}>
          {failedUrls.includes(photo.url) ? (
            <View
              style={{
                alignItems: 'center',
                backgroundColor: colors.photoPlaceholder,
                borderColor: colors.border,
                borderCurve: 'continuous',
                borderRadius: radius.imageCard,
                borderWidth: 1,
                height: 220,
                justifyContent: 'center',
                padding: spacing.lg,
              }}
            >
              <Text
                selectable
                style={{ color: colors.textMuted, lineHeight: typography.small.lineHeight, textAlign: 'center' }}
              >
                Foto belum dapat dimuat.
              </Text>
            </View>
          ) : (
            <Pressable
              accessibilityLabel="Lihat foto catatan ukuran penuh"
              accessibilityRole="imagebutton"
              onPress={() => setPreviewUrl(photo.url)}
            >
              <Image
                resizeMode="cover"
                source={{ uri: photo.url }}
                onError={() => markFailed(photo.url)}
                style={{ borderRadius: radius.imageCard, height: 220, width: '100%' }}
              />
            </Pressable>
          )}
          {photo.caption ? (
            <Text selectable style={secondaryLineStyle}>
              {photo.caption}
            </Text>
          ) : null}
        </View>
      ))}
      <PhotoViewerModal
        onClose={() => setPreviewUrl(null)}
        photoUrl={previewUrl}
        visible={Boolean(previewUrl)}
      />
    </View>
  );
}

// Pemetaan jenis catatan ke RPC hapusnya. Satu tempat, bukan empat cabang di
// dalam runDelete — bentuknya sepadan dengan loadRecordDetail di bawah.
//
// Penjaga eksahustifnya sama: kalau TreeRecordRouteType bertambah anggota tanpa
// fungsi ini ikut disesuaikan, compiler yang menemukannya, bukan pemakainya.
async function softDeleteRecord(
  recordType: TreeRecordRouteType,
  recordId: UUID
): Promise<ServiceResult<SuccessData>> {
  if (recordType === 'condition') {
    return softDeleteConditionReport({ recordId, reason: null });
  }

  if (recordType === 'phase') {
    return softDeleteGrowthPhaseRecord({ recordId, reason: null });
  }

  if (recordType === 'harvest') {
    return softDeleteHarvestRecord({ recordId, reason: null });
  }

  if (recordType === 'care') {
    return softDeleteCareActivity({ recordId, reason: null });
  }

  return unknownRecordType(recordType);
}

function normalizeRecordType(value?: string): TreeRecordRouteType | null {
  if (value === 'condition' || value === 'phase' || value === 'harvest' || value === 'care') {
    return value;
  }

  return null;
}

async function loadRecordDetail(
  recordType: TreeRecordRouteType,
  recordId: UUID
): Promise<ServiceResult<DetailState>> {
  if (recordType === 'condition') {
    const result = await getConditionReportDetail({ reportId: recordId });

    if (result.error) {
      return result;
    }

    const authorDisplay = await resolveRecordAuthor(result.data.farmId, result.data.reportedBy);

    return {
      data: {
        authorId: result.data.reportedBy,
        authorName: authorDisplay.fullName,
        authorRole: authorDisplay.role,
        authorVerb: 'recorded',
        canEdit: result.data.canEdit === true,
        canDelete: result.data.canDelete === true,
        createdAt: result.data.createdAt,
        eventAt: result.data.reportedAt,
        eventLabel: 'Tanggal catatan',
        farmId: result.data.farmId,
        // Statusnya NAIK jadi nilai utama; barisnya ikut pergi. Ia tidak
        // ditulis dua kali — sebagai judul serif dan lagi sebagai MetaRow
        // berlabel 'Status kondisi' di bawahnya.
        headline: formatTreeConditionStatus(result.data.conditionStatus),
        note: result.data.note,
        photoEntityType: 'condition_record',
        recordLabel: 'Kondisi',
        rows: [],
        updatedAt: result.data.updatedAt,
      },
      error: null,
    };
  }

  if (recordType === 'phase') {
    const result = await getGrowthPhaseRecordDetail({ recordId });

    if (result.error) {
      return result;
    }

    const authorDisplay = await resolveRecordAuthor(result.data.farmId, result.data.recordedBy);

    return {
      data: {
        authorId: result.data.recordedBy,
        authorName: authorDisplay.fullName,
        authorRole: authorDisplay.role,
        authorVerb: 'recorded',
        canEdit: result.data.canEdit === true,
        canDelete: result.data.canDelete === true,
        createdAt: result.data.createdAt,
        eventAt: result.data.recordedAt,
        eventLabel: 'Tanggal catatan',
        farmId: result.data.farmId,
        // Fasenya NAIK jadi nilai utama; barisnya ikut pergi, alasan yang sama
        // dengan cabang kondisi di atas.
        headline: formatGrowthPhase(result.data.phase),
        note: result.data.note,
        photoEntityType: 'growth_phase_record',
        recordLabel: 'Fase',
        rows: [],
        updatedAt: result.data.updatedAt,
      },
      error: null,
    };
  }

  if (recordType === 'harvest') {
    const result = await getHarvestRecordDetail({ recordId });

    if (result.error) {
      return result;
    }

    const authorDisplay = await resolveRecordAuthor(result.data.farmId, result.data.harvestedBy);

    return {
      data: {
        authorId: result.data.harvestedBy,
        authorName: authorDisplay.fullName,
        authorRole: authorDisplay.role,
        authorVerb: 'harvested',
        canEdit: result.data.canEdit === true,
        canDelete: result.data.canDelete === true,
        createdAt: result.data.createdAt,
        eventAt: result.data.harvestedAt,
        eventLabel: 'Tanggal panen',
        farmId: result.data.farmId,
        headline: buildHarvestHeadline(result.data),
        note: result.data.note,
        photoEntityType: 'harvest_record',
        recordLabel: 'Panen',
        // Baris yang nilainya null TIDAK ditambahkan sama sekali, bukan
        // ditampilkan sebagai "-": sejak migrasi 045 panen boleh dicatat lewat
        // berat saja atau jumlah saja, dan baris kosong hanya jadi kebisingan.
        //
        // String(result.data.fruitCount) yang lama menghasilkan teks "null"
        // begitu kolomnya nullable — itu yang diperbaiki di sini.
        rows: buildHarvestRows(result.data),
        updatedAt: result.data.updatedAt,
      },
      error: null,
    };
  }

  if (recordType === 'care') {
    const result = await getCareActivityDetail({ activityId: recordId });

    if (result.error) {
      return result;
    }

    const care = result.data;
    const authorDisplay = await resolveRecordAuthor(care.farmId, care.performedBy);

    const rows: Array<{ label: string; value: string | null }> = [];

    // Judul tugas induk hanya untuk terjadwal & bila keresolve (RLS worker bisa null).
    if (care.asal === 'terjadwal' && care.taskTitle) {
      rows.push({ label: 'Dari tugas', value: care.taskTitle });
    }

    // Kategori TIDAK lagi jadi baris: ia naik ke nilai utama (lihat
    // buildCareHeadline). Baris 'Kategori' yang tetap berdiri berarti kata yang
    // sama dicetak dua kali dalam satu layar sependek ini.

    // Utang dari Tahap D: baris ini dulu teks polos tanpa takaran, padahal tiga
    // layar hasil kerja lain sudah memakai formatter yang sama.
    const bahan = formatProdukDenganTakaran(care.produk, care.produkJumlah, care.produkSatuan);

    if (bahan) {
      rows.push({ label: 'Bahan', value: bahan });
    }

    // Status hanya informatif untuk terjadwal (inisiatif selalu completed).
    if (care.asal === 'terjadwal') {
      rows.push({ label: 'Status', value: care.status === 'completed' ? 'Selesai' : 'Ditunda' });
    }

    return {
      data: {
        authorId: care.performedBy,
        authorName: authorDisplay.fullName,
        authorRole: authorDisplay.role,
        authorVerb: 'recorded',
        canEdit: false,
        canDelete: care.canDelete === true,
        // Baris merusak, bukan tombol di bar aksi — lihat prop `deleteAsRow`.
        //
        // canDelete SENDIRI sudah menutup perawatan TERJADWAL tanpa penjaga
        // tambahan di sini: resolveCareActivityCanDelete mengembalikan false
        // untuk apa pun yang bukan 'inisiatif', cerminan persis penjaga di
        // dalam soft_delete_care_activity (migrasi 067). Jadi perawatan
        // terjadwal tidak punya tombol aksi apa pun di layar ini, dan itu
        // memang yang benar: ia tidak bisa diedit DAN tidak bisa dihapus.
        deleteAsRow: true,
        createdAt: null,
        eventAt: care.performedAt,
        eventLabel: 'Tanggal perawatan',
        farmId: care.farmId,
        headline: buildCareHeadline(care.category),
        // HANYA untuk yang INISIATIF (adendum §1.5).
        //
        // Spek asli menulis "Tombol Edit + baris 'Perubahan tersimpan sebagai
        // catatan baru'" untuk layar ini, dan itu salah: care_activities
        // bersifat menambah, dan pemicu rantai jadwal berulang hanya berbunyi
        // saat penyimpanan baru — tidak ada jalur edit sama sekali, untuk
        // asal mana pun. Kalimat itu benar di layar Perbaiki catatan hasil
        // kerja, tempat koreksinya memang tersedia, dan tinggal di sana.
        //
        // Perawatan TERJADWAL tidak mendapat kalimat ini walaupun ia juga tidak
        // bisa diubah. Alasannya ada di separuh keduanya: "hapus lalu catat
        // ulang" adalah jalan keluar yang TIDAK tersedia untuknya — ia tidak
        // punya tombol hapus, dan pekerjaannya milik sebuah tugas, bukan milik
        // orang yang membuka layar ini. Menawarkan pintu yang tidak ada lebih
        // buruk daripada diam.
        immutableNotice:
          care.asal === 'inisiatif'
            ? 'Catatan perawatan tidak bisa diubah. Bila keliru, hapus lalu catat ulang.'
            : null,
        note: care.note,
        originLabel: care.asal === 'terjadwal' ? 'Terjadwal' : 'Inisiatif',
        // Hanya yang inisiatif. Foto perawatan terjadwal adalah 'task_proof'
        // dan hidup di layar tugas; lihat catatan pada DetailState.
        photoEntityType: care.asal === 'inisiatif' ? 'initiative_care_proof' : null,
        recordLabel: 'Perawatan',
        rows,
        supportsEdit: false,
        updatedAt: null,
      },
      error: null,
    };
  }

  return unknownRecordType(recordType);
}

async function resolveRecordAuthor(
  farmId: UUID,
  authorId: UUID
): Promise<{ fullName: string | null; role: MemberRole | null }> {
  const actorProfilesResult = await getFarmActorDisplayProfiles(farmId);

  if (actorProfilesResult.data) {
    const actor = actorProfilesResult.data.find((profile) => profile.userId === authorId);

    if (actor) {
      return {
        fullName: actor.fullName,
        role: actor.role,
      };
    }
  }

  return {
    fullName: null,
    role: null,
  };
}

// SATU nilai panen untuk judul serif. Berat kalau ada, kalau tidak jumlah buah.
// TIDAK PERNAH keduanya.
//
// Aturannya SAMA PERSIS dengan formatHarvestFactValue di tree-components.tsx,
// yang melayani baris "Panen terakhir" di layar detail pohon — dan sengaja
// begitu: kedua layar itu bersebelahan dalam satu alur, jadi panen yang sama
// tidak boleh disebut dengan dua angka berbeda. Yang berbeda hanya sumbernya:
// di sana teks deskripsi rakitan view, di sini kolom HarvestRecord langsung.
//
// Berat didahulukan karena ia yang dipakai menjual, dan karena ia satu-satunya
// dari keduanya yang bisa dijumlahkan antarpanen tanpa berbohong (berat alpukat
// terlalu bervariasi untuk dikonversi dari jumlah buah).
//
// Cabang terakhir tidak pernah tercapai selama constraint
// harvest_records_amount_present_check masih berlaku — ia menjamin setidaknya
// satu dari keduanya terisi. Ia ada supaya layar tidak berjudul kosong kalau
// constraint itu suatu hari dilonggarkan.
function buildHarvestHeadline(record: HarvestRecord): string {
  if (record.harvestWeightKg !== null) {
    const berat = record.harvestWeightKg.toLocaleString('id-ID', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    });

    return `${berat} kg`;
  }

  if (record.fruitCount !== null) {
    return `${record.fruitCount} buah`;
  }

  return 'Panen';
}

// Judul catatan perawatan: nama kategorinya.
//
// care_activities.category NULLABLE (migrasi 025) dan baris lama memang ada
// yang kosong, jadi cadangannya kata 'Perawatan' — bukan string kosong, yang
// akan menyisakan lubang di tempat judul.
function buildCareHeadline(category: CareCategory | null | undefined): string {
  return category ? formatCareCategory(category) : 'Perawatan';
}

// Dinilai dari JENIS FOTO yang dipegang catatan itu, bukan dari recordType --
// alasannya di catatan pada DetailState.photoEntityType.
//
// Sengaja TIDAK memakai guard eksahustif seperti loadRecordDetail: yang
// diperiksa di sini bukan union recordType melainkan union entity_type foto,
// dan dua dari enam anggotanya ('tree_main', 'task_proof') memang tidak pernah
// tampil di layar ini. Default "tidak ada foto" adalah jawaban yang benar untuk
// keduanya, bukan kasus yang terlewat.
async function loadRecordPhotos(
  detail: DetailState,
  recordId: UUID
): Promise<ServiceResult<PhotoAttachmentPreviewItem[]>> {
  if (detail.photoEntityType === 'condition_record') {
    const result = await getConditionRecordPhotos({ conditionRecordId: recordId, farmId: detail.farmId });
    return result.error ? result : { data: result.data.map((photo) => toPreviewPhoto(photo.attachment.id, photo.signedUrl)), error: null };
  }

  if (detail.photoEntityType === 'initiative_care_proof') {
    const result = await getInitiativeCareProofPhotos({ activityId: recordId, farmId: detail.farmId });
    return result.error ? result : { data: result.data.map((photo) => toPreviewPhoto(photo.attachment.id, photo.signedUrl)), error: null };
  }

  if (detail.photoEntityType === 'growth_phase_record') {
    const result = await getGrowthPhaseRecordPhotos({ farmId: detail.farmId, growthPhaseRecordId: recordId });
    return result.error ? result : { data: result.data.map((photo) => toPreviewPhoto(photo.attachment.id, photo.signedUrl)), error: null };
  }

  if (detail.photoEntityType === 'harvest_record') {
    const result = await getHarvestRecordPhotos({ farmId: detail.farmId, harvestRecordId: recordId });
    return result.error ? result : { data: result.data.map((photo) => toPreviewPhoto(photo.attachment.id, photo.signedUrl)), error: null };
  }

  // tree_main, task_proof, dan perawatan TERJADWAL: tidak punya kotak foto di
  // layar ini, jadi tidak ada yang perlu dimuat.
  return { data: [], error: null };
}

// Guard eksahustif: recordType sudah dipersempit ke never di titik ini, jadi
// cabang ini hanya tercapai bila union TreeRecordRouteType bertambah tanpa
// pemanggilnya ikut disesuaikan.
// Baris detail panen, hanya yang benar-benar ada isinya.
//
// Berat ditulis dengan locale id-ID supaya pemisah desimalnya koma, dan nol di
// belakang koma dibuang: 12.00 -> "12 kg", 0.50 -> "0,5 kg".
function buildHarvestRows(record: HarvestRecord): Array<{ label: string; value: string | null }> {
  const rows: Array<{ label: string; value: string | null }> = [];

  // Nilai yang SUDAH naik jadi judul serif tidak diulang sebagai baris. Berat
  // yang ada selalu menang jadi judul (lihat buildHarvestHeadline), jadi baris
  // 'Berat panen' hanya muncul kalau judulnya ternyata jumlah buah — dan itu
  // berarti beratnya null dan barisnya memang tidak akan dirender.
  if (record.harvestWeightKg !== null && record.fruitCount !== null) {
    rows.push({ label: 'Jumlah buah', value: `${record.fruitCount} buah` });
  }

  // Grade lama yang belum dibersihkan sudah dipetakan jadi null oleh mapper di
  // harvestService, jadi barisnya cukup disembunyikan — bukan menampilkan teks
  // bebas yang sudah tidak berlaku.
  if (record.fruitCondition) {
    rows.push({ label: 'Grade', value: GRADE_PANEN_LABELS[record.fruitCondition] });
  }

  return rows;
}

function unknownRecordType(recordType: never): ServiceResult<never> {
  return {
    data: null,
    error: { message: `Jenis catatan tidak dikenal: ${String(recordType)}` },
  };
}

function toPreviewPhoto(id: UUID, url: string, caption?: string | null): PhotoAttachmentPreviewItem {
  return { caption, id, url };
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('id-ID', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatEventDate(value: string): string {
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

function formatActorDisplayName({
  actorId,
  actorName,
  actorRole,
  currentUserId,
}: {
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: MemberRole | null;
  currentUserId?: string | null;
}): string {
  if (actorId && currentUserId && actorId === currentUserId) {
    return 'Anda';
  }

  const displayName = formatPersonDisplayName(actorName, '');

  if (displayName) {
    return displayName;
  }

  if (actorRole === 'owner') {
    return 'Pemilik kebun';
  }

  if (actorRole === 'worker') {
    return 'Anggota kebun';
  }

  return 'Anggota kebun';
}

function shouldShowUpdatedAt(createdAt?: string | null, updatedAt?: string | null): boolean {
  if (!updatedAt) {
    return false;
  }

  if (!createdAt) {
    return true;
  }

  const createdTime = new Date(createdAt).getTime();
  const updatedTime = new Date(updatedAt).getTime();

  if (Number.isNaN(createdTime) || Number.isNaN(updatedTime)) {
    return updatedAt !== createdAt;
  }

  return Math.abs(updatedTime - createdTime) > 1000;
}
