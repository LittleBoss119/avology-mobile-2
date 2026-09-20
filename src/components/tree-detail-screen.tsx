import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';

import { colors, spacing, tokens, typography } from '../constants/theme';
import { colors as palette, text as typeScale } from '../theme/tokens';
import { getTreeConditionReports } from '../services/conditionReportService';
import { getTreeHistory } from '../services/historyService';
import {
  getTreeMainPhoto,
  listConditionRecordPhotosForTree,
} from '../services/photoAttachmentService';
import {
  getTreeDetail,
  listTreePlantings,
  startTreePlanting,
} from '../services/treeService';
import { useAuth } from '../context/auth-context';
import { consumePendingFeedback } from '../lib/pendingFeedback';
import type {
  Tree,
  TreeConditionReport,
  TreeHistoryItem,
  TreePlanting,
} from '../types/domain';
import type { ConditionRecordPhotoMap, TreeMainPhoto } from '../types/media';
import { daysSinceLocal } from '../utils/dateDiff';
// cycleStartKey dan isOnOrAfterCycleStart TIDAK LAGI DIPAKAI DI SINI: keduanya
// dulu dipakai untuk mencari sendiri tanggal fase di daftar riwayat, dan itu
// sudah digantikan kolom trees.current_growth_phase_since. Keduanya tetap
// diekspor treeCycle.ts — lihat catatan di sana.
import { findLastEndedPlanting, formatPlantingEndSummary } from '../utils/treeCycle';
import { formatGrowthPhase } from '../utils/displayFormat';
import { formatTreeAge, formatTreeDisplayCode } from '../utils/treeFormat';
import { PhotoViewerModal } from './media';
import {
  ConditionReportList,
  ConditionStatusBadge,
  formatHarvestFactValue,
  formatHistoryRowDate,
  TreeHistoryTimeline,
  type TreeHistoryRouteRecordType,
} from './tree-components';
import { BottomSheet, SheetActionRow } from './bottom-sheet';
import {
  StartTreePlantingSheet,
  type StartTreePlantingFormValues,
} from './tree-planting-sheets';
// FloweringAgeMarker TIDAK LAGI DIPAKAI DI SINI. Chip fase sudah membawa umur
// fasenya, dan pita terpisah di bawahnya mengulang angka yang sama satu layar
// lebih rendah. Komponennya TETAP ADA di repo — layar monitoring fase
// memakainya, dan bentuk pita di sana masih pada tempatnya.
import { Icon } from './icons';
import { useSnackbar } from './snackbar';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  Screen,
  TopAppBar,
} from './ui';

type TreeDetailMode = 'owner' | 'worker';

// Pesan yang dititipkan layar lain lewat pendingFeedback. Peta, bukan
// perbandingan string di tempat pemakaian, mengikuti profile-screen.tsx:17 —
// kunci yang tidak dikenal menghasilkan undefined dan tidak menampilkan apa pun.
const PENDING_FEEDBACK_MESSAGES: Record<string, string | undefined> = {
  planting_ended: 'Pohon ditandai sudah tidak ada',
  // Dititipkan layar detail catatan, yang menghapus lalu langsung pergi ke sini
  // — layar itu sudah tidak ada saat pesannya jatuh tempo.
  record_deleted: 'Catatan dihapus',
};

export function TreeDetailScreen({
  mode,
  treeId,
}: {
  mode: TreeDetailMode;
  treeId?: string;
}) {
  const { profile } = useAuth();
  const showSnackbar = useSnackbar();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [recordSheetOpen, setRecordSheetOpen] = React.useState(false);
  const [history, setHistory] = React.useState<TreeHistoryItem[]>([]);
  const [plantings, setPlantings] = React.useState<TreePlanting[]>([]);
  // Galat siklus tanam dipisahkan dari `error` layar supaya ia tampil DI DALAM
  // sheet yang gagal, tepat di atas tombolnya — bukan di balik sheet, di tempat
  // yang tidak terlihat selama sheet-nya masih terbuka.
  //
  // TETAP DI SINI walau EndTreePlantingSheet sudah pindah ke layar Ubah:
  // StartTreePlantingSheet ("Tanam") masih tinggal di layar ini dan memakai
  // kedua state ini. Yang ikut pergi bersama sheet-nya hanya endSheetOpen.
  const [cycleError, setCycleError] = React.useState<string | null>(null);
  const [cycleLoading, setCycleLoading] = React.useState(false);
  const [startSheetOpen, setStartSheetOpen] = React.useState(false);
  const [conditionPhotoMap, setConditionPhotoMap] = React.useState<ConditionRecordPhotoMap>({});
  const [reports, setReports] = React.useState<TreeConditionReport[]>([]);
  const [tree, setTree] = React.useState<Tree | null>(null);
  const [treeMainPhoto, setTreeMainPhoto] = React.useState<TreeMainPhoto | null>(null);

  const loadDetail = React.useCallback(async () => {
    if (!treeId) {
      setError('Data pohon tidak ditemukan.');
      setTree(null);
      setTreeMainPhoto(null);
      setConditionPhotoMap({});
      setHistory([]);
      setPlantings([]);
      setReports([]);
      return;
    }

    setError(null);

    const treeResult = await getTreeDetail({ treeId });

    if (treeResult.error) {
      setError(treeResult.error.message);
      setTree(null);
      setTreeMainPhoto(null);
      setConditionPhotoMap({});
      setHistory([]);
      setPlantings([]);
      setReports([]);
      return;
    }

    if (mode === 'worker' && treeResult.data.isArchived) {
      // TANPA kata "arsip" (batch 4b). is_archived tidak punya satu pun jalur
      // di antarmuka ini — tidak ada tombol, tidak ada menu, tidak ada sheet —
      // jadi pekerja yang membaca "diarsipkan" diberi nama untuk keadaan yang
      // tidak bisa ia lihat, sebabkan, maupun perbaiki. Yang perlu ia tahu
      // hanya bahwa pohonnya tidak tersedia baginya.
      setError('Pohon ini tidak tersedia untuk pekerja.');
      setTree(null);
      setTreeMainPhoto(null);
      setConditionPhotoMap({});
      setHistory([]);
      setPlantings([]);
      setReports([]);
      return;
    }

    setTree(treeResult.data);

    // Siklus aktif dibaca dari getTreeDetail, yang sudah membawanya sebagai
    // embedded resource — tidak perlu query tambahan, dan nilainya sudah ada
    // sebelum kedua pengambilan foto di bawah berjalan. null = posisi kosong.
    const activePlantingId = treeResult.data.activePlanting?.id ?? null;

    const [reportsResult, historyResult, photoResult, plantingsResult] = await Promise.all([
      getTreeConditionReports({ treeId }),
      getTreeHistory({ treeId }),
      getTreeMainPhoto(treeResult.data.farmId, treeResult.data.id, activePlantingId),
      listTreePlantings({ treeId }),
    ]);

    // Siklus tanam TIDAK menaikkan `error` layar. Ia hanya bahan tambahan —
    // pembatas di riwayat dan keterangan posisi kosong. Kalau pengambilannya
    // gagal, layarnya tetap utuh dengan riwayat datar tanpa pembatas; memerahkan
    // seluruh layar demi hiasan riwayat menukar hal kecil dengan hal besar.
    setPlantings(plantingsResult.data ?? []);

    if (reportsResult.error) {
      setError(reportsResult.error.message);
      setReports([]);
    } else {
      setReports(reportsResult.data);
    }

    if (historyResult.error) {
      setError(historyResult.error.message);
      setHistory([]);
    } else {
      setHistory(historyResult.data);
    }

    if (photoResult.error) {
      setTreeMainPhoto(null);
    } else {
      setTreeMainPhoto(photoResult.data);
    }

    if (reportsResult.data && reportsResult.data.length > 0) {
      const conditionPhotoResult = await listConditionRecordPhotosForTree({
        activePlantingId,
        conditionRecordIds: reportsResult.data.map((report) => report.id),
        farmId: treeResult.data.farmId,
        treeId: treeResult.data.id,
      });

      setConditionPhotoMap(conditionPhotoResult.data ?? {});
    } else {
      setConditionPhotoMap({});
    }
  }, [mode, treeId]);

  useFocusEffect(
    React.useCallback(() => {
      // Konfirmasi dari layar Ubah, dibaca-sekaligus-dihapus. Layar itu menutup
      // siklus tanam lalu LANGSUNG pergi ke sini — snackbar-nya tidak bisa
      // ditampilkan di layar asalnya karena layar itu sudah tidak ada lagi saat
      // pesannya jatuh tempo. Polanya sama dengan profile-screen.tsx:35.
      const message = PENDING_FEEDBACK_MESSAGES[consumePendingFeedback() ?? ''];

      if (message) {
        showSnackbar(message);
      }

      setLoading(true);
      loadDetail().finally(() => setLoading(false));
    }, [loadDetail, showSnackbar])
  );

  // Menutup sheet-nya DULU, baru memuat ulang.
  //
  // Bukan urutan bebas: sheet adalah konfirmasinya, jadi pemuatan ulang hanya
  // boleh berjalan setelah pemilik menekan tombolnya, dan tidak boleh berjalan
  // di belakang sheet yang masih terbuka. Sheet yang GAGAL sengaja tetap
  // terbuka — galatnya tampil di dalamnya dan isian pemilik tidak hilang.
  //
  // runEndPlanting yang dulu berpasangan dengan fungsi ini sudah pindah ke layar
  // Ubah, dan di sana bentuknya BERBEDA: ia tidak memuat ulang layarnya sendiri
  // melainkan langsung pergi ke layar ini. Alasannya ada di layar itu.
  async function runStartPlanting(values: StartTreePlantingFormValues) {
    if (!tree) {
      return;
    }

    setCycleLoading(true);
    setCycleError(null);

    const result = await startTreePlanting({
      plantedAt: values.plantedAt,
      treeId: tree.id,
      variety: values.variety,
    });

    if (result.error) {
      setCycleError(result.error.message);
      setCycleLoading(false);
      return;
    }

    setCycleLoading(false);
    setStartSheetOpen(false);
    await loadDetail();
    showSnackbar('Pohon baru ditanam');
  }

  if (loading) {
    // Tanpa judul, sama dengan layar yang sudah selesai memuat. Dulu judulnya
    // statis "Detail Pohon" justru untuk menghindari kedipan: judul sebenarnya
    // ("Detail Pohon" lawan "Detail Posisi") baru bisa ditentukan setelah
    // siklus tanamnya terbaca. Persoalan itu hilang bersama judulnya — kode
    // pohon di badan layar yang sekarang menjadi judulnya, dan ia memang baru
    // muncul setelah datanya datang.
    return (
      <LoadingState
        header={<TopAppBar onBack={() => router.back()} />}
        message="Memuat detail pohon..."
      />
    );
  }

  const basePath = mode === 'owner' ? '/owner/trees' : '/worker/trees';

  if (!tree) {
    return (
      <Screen header={<TopAppBar onBack={() => router.back()} />}>
        <ErrorBanner message={error} />
        {error ? (
          <EmptyState title="Gagal memuat detail pohon" subtitle="Periksa koneksi lalu coba lagi." />
        ) : (
          <EmptyState title="Pohon tidak ditemukan" subtitle="Pohon mungkin sudah tidak tersedia atau akses ditolak." />
        )}
      </Screen>
    );
  }

  // SELURUH MESIN UNGGAH DAN HAPUS FOTO DICABUT DARI LAYAR INI (batch 4b).
  //
  // Yang memicunya adalah tombol kamera bundar yang melayang di pojok foto:
  // tombol IKON-SAJA, dilarang aturan tombol yang berlaku, dan yang terakhir
  // tersisa di aplikasi setelah tombol zoom denah dicabut di batch 4a.
  //
  // Penggantinya bukan tombol berteks di layar ini, melainkan TIDAK ADA APA-APA:
  // layar Ubah sudah punya bagian "Foto pohon" yang lengkap — pilih dari galeri,
  // ambil dari kamera, hapus, batalkan penghapusan — dan tombol "Edit" yang
  // membukanya sudah berdiri di bar atas layar ini. Dua jalur ke satu pekerjaan
  // berarti dua tempat yang bisa berbeda perilakunya, dan yang di sini adalah
  // yang paling jarang diperiksa: ia mengunggah LANGSUNG tanpa tombol simpan,
  // sementara yang di layar Ubah menunggu "Simpan perubahan".
  //
  // Yang ikut pergi: handleOpenPhotoSource, handlePickPhotoFromGallery,
  // handleTakePhotoFromCamera, runTreePhotoUpload, handleDeletePhoto,
  // runDeletePhoto, <PhotoSourceSheet>, dan ketiga state photoAction*/
  // photoSourceOpen. Foto di layar ini sekarang DIBACA saja.

  function handleOpenHistoryRecord(item: TreeHistoryItem, recordType: TreeHistoryRouteRecordType) {
    if (!item.sourceId || !tree) {
      return;
    }

    router.push(`${basePath}/${tree.id}/records/${recordType}/${item.sourceId}`);
  }

  const displayCode = formatTreeDisplayCode(tree);

  // SATU-SATUNYA pembeda dua keadaan layar ini.
  //
  // activePlanting null berarti siklus terakhir posisi ini sudah ditutup: tidak
  // ada varietas, tidak ada tanggal tanam, dan layar edit akan ditolak RPC.
  // Bukan is_archived — arsip menyembunyikan posisinya dari daftar, sedangkan
  // ini soal ada atau tidaknya pohon di posisi yang tetap ditampilkan.
  const activePlanting = tree.activePlanting;
  const lastEndedPlanting = findLastEndedPlanting(plantings);

  // Umur fase yang sedang berjalan, dalam hari — angka pada chip 'Berbunga · 96 hari'.
  //
  // SATU PENGURANGAN, TITIK. Tanggalnya datang jadi dari database
  // (trees.current_growth_phase_since, migrasi 066), bukan dicari sendiri di
  // daftar riwayat.
  //
  // Versi sebelumnya menyapu `history` untuk menemukan catatan fase yang
  // menetapkan fase sekarang, dan karena itu harus MENGULANG penyaringan siklus
  // yang sudah ada di database — awal siklus, arah cast WIB, perbandingan
  // tanggal. Dua tempat yang harus sepakat selamanya, dan yang di klien memang
  // sempat tidak: ia pernah menghitung dari catatan pohon siklus SEBELUMNYA
  // sementara database sudah menyaringnya dengan benar.
  //
  // Kolom baru itu ditulis recalculate_tree_current_growth_phase dari BARIS
  // catatan yang sama yang menetapkan currentGrowthPhase, dalam SELECT yang
  // sama. Keduanya karena itu tidak bisa bercerita berbeda, dan tidak ada lagi
  // aturan siklus yang hidup di sisi klien.
  //
  // null berarti tanggalnya tidak diketahui — chip menampilkan nama fase saja,
  // BUKAN '0 hari'. Nol adalah angka yang benar hanya untuk fase yang dicatat
  // HARI INI, dan daysSinceLocal memang mengembalikan 0 untuk itu.
  //
  // NON-PREDIKTIF: angka ini menyatakan sudah berapa lama fasenya berjalan, dan
  // tidak pernah kapan buahnya siap dipetik (keputusan desain v4).
  const currentPhaseAgeDays = tree.currentGrowthPhaseSince
    ? daysSinceLocal(tree.currentGrowthPhaseSince)
    : null;

  // Panen TERAKHIR, dihitung dari `history` yang SUDAH dimuat — tidak ada
  // permintaan tambahan. Daftarnya terurut menurun (terbaru dulu, lihat
  // getTreeHistory), jadi yang pertama cocok adalah yang terakhir terjadi.
  //
  // "TOTAL PANEN" TIDAK ADA DI SINI, DAN ITU DISENGAJA. Adendum mencoretnya:
  // agregat jumlah panen per pohon tidak dihitung di mana pun, dan menjumlahkan
  // sendiri dari `history` akan menghasilkan angka yang BOHONG — deskripsi
  // panen menyimpan jumlah sebagai teks berformat bebas ('12 kg', '3 buah'),
  // satuannya bisa berbeda antarbaris, dan riwayatnya sendiri tidak dijamin
  // lengkap. Angka total yang salah lebih buruk daripada tidak ada angka total.
  const lastHarvest = history.find((item) => item.historyType === 'harvest') ?? null;

  return (
    <Screen
      header={
        <TreeDetailTopBar
          onEditPress={
            mode === 'owner' && activePlanting
              ? () => router.push(`${basePath}/${tree.id}/edit`)
              : undefined
          }
        />
      }
      // SATU tombol di bar aksi, dan isinya bercabang menurut keadaan posisi.
      //
      // Empat tombol catatan terpisah tidak muat di bar aksi dan melanggar
      // aturannya; satu pintu bernama "Tambah catatan" dengan empat pilihan
      // yang masing-masing bernama jelas lebih mudah dibaca daripada empat
      // pintu yang bersaing.
      //
      // Posisi kosong tidak bisa dicatat apa pun — tidak ada pohon yang
      // kondisinya bisa dilaporkan — jadi di sana bar aksinya berisi "Tanam",
      // satu-satunya hal yang masuk akal dilakukan pada posisi kosong. Pekerja
      // tidak boleh menanam, jadi baginya bar aksinya tidak ada sama sekali.
      stickyFooter={
        activePlanting ? (
          <Button title="Tambah catatan" onPress={() => setRecordSheetOpen(true)} />
        ) : mode === 'owner' ? (
          <Button
            title="Tanam"
            onPress={() => {
              setCycleError(null);
              setStartSheetOpen(true);
            }}
          />
        ) : undefined
      }
    >
      <ErrorBanner message={error} />

      {/* Foto disembunyikan saat posisinya kosong: foto itu milik pohon yang
          sudah tidak ada, dan menampilkannya di atas tulisan "Belum ditanami"
          membuat layar membantah dirinya sendiri. Berkasnya tidak dihapus. */}
      {activePlanting ? (
        <TreeDetailHero
          displayCode={displayCode}
          photoUrl={treeMainPhoto?.signedUrl}
          planting={activePlanting}
          tree={tree}
        />
      ) : (
        <EmptyPositionHeader displayCode={displayCode} />
      )}

      {activePlanting ? (
        <TreeFactRows
          lastHarvest={lastHarvest}
          phaseAgeDays={currentPhaseAgeDays}
          tree={tree}
        />
      ) : (
        <EmptyPositionNotice planting={lastEndedPlanting} />
      )}

      <RecordActivitySheet
        basePath={basePath}
        onClose={() => setRecordSheetOpen(false)}
        treeId={tree.id}
        visible={recordSheetOpen}
      />
      {/* EndTreePlantingSheet TIDAK LAGI DI SINI — ia pindah ke layar Edit
          bersama tombolnya. cycleError dan cycleLoading TETAP TINGGAL: keduanya
          juga melayani StartTreePlantingSheet di bawah, yang tidak ikut pindah. */}
      <StartTreePlantingSheet
        displayCode={displayCode}
        error={cycleError}
        loading={cycleLoading}
        onClose={() => setStartSheetOpen(false)}
        onSubmit={runStartPlanting}
        visible={startSheetOpen}
      />

      {/* DUA baris riwayat terakhir, lalu satu baris "Lihat semua" yang
          membentangkan sisanya DI TEMPAT.
          Bukan route baru: riwayat pohon tidak punya layarnya sendiri, dan
          membuatkannya berarti menambah route — dilarang di batch ini. Yang
          lebih penting, membentangkan di tempat memang lebih benar untuk daftar
          sepanjang ini: pemilik yang membuka riwayat hampir selalu mencari satu
          kejadian yang baru saja terjadi, dan dua baris teratas sudah
          menjawabnya tanpa perpindahan layar sama sekali. */}
      <TreeHistorySection
        currentUserId={profile?.id}
        history={history}
        onRecordPress={handleOpenHistoryRecord}
        plantings={plantings}
        viewerMode={mode}
      />

      {history.length === 0 && reports.length > 0 ? (
        <>
          <SectionTitle subtitle="Laporan kondisi tampil sebagai cadangan jika timeline belum tersedia." title="Laporan Kondisi" />
          <ConditionReportList
            conditionPhotoMap={conditionPhotoMap}
            currentUserId={profile?.id}
            reports={reports}
            viewerMode={mode}
          />
        </>
      ) : null}
    </Screen>
  );
}

// Bar atas: tombol back di kiri, "Edit" di kanan.
//
// SLOT KANAN KEMBALI, tapi bukan tombol titik-tiga yang dulu ada di sini. Yang
// dulu membuka menu berisi satu baris arsip; yang sekarang adalah tombol
// BERLABEL TEKS yang langsung membuka layar Edit.
//
// Kenapa Edit naik ke bar dan tidak tinggal di badan layar: bar aksi bawah kini
// dipegang satu tombol "Tambah catatan", dan menaruh tombol Edit kedua tepat di
// bawahnya membuat dua aksi yang bobotnya jauh berbeda tampil setara. Mengedit
// data pohon adalah tindakan atas CATATAN yang sedang dibaca, bukan langkah
// berikutnya dari membacanya — dan di seluruh aplikasi ini, tindakan atas layar
// yang sedang dibuka memang tinggal di bar atas.
//
// `onEditPress` opsional, dan tanpa nilai slot kanannya tidak dirender sama
// sekali: pekerja tidak boleh mengedit, dan posisi tanpa siklus tanam aktif
// tidak bisa disimpan (update_tree_with_planting menolaknya). Tidak dirender,
// bukan dirender lalu dinonaktifkan.
//
// Judul bar tetap tidak ada: kode pohon serif 40 di badan layar adalah judul
// yang sesungguhnya. TopAppBar menerima `title` sebagai opsional dan tingginya
// tidak bergantung padanya (minHeight 56 eksplisit).
function TreeDetailTopBar({ onEditPress }: { onEditPress?: () => void }) {
  return (
    <TopAppBar
      onBack={() => router.back()}
      right={
        onEditPress ? (
          <Button onPress={onEditPress} size="small" title="Edit" variant="secondary" />
        ) : undefined
      }
    />
  );
}

// Ukuran foto detail pohon. 140, TURUN DARI 220 penuh-lebar.
//
// Foto lama membentang selebar layar dan setinggi 220 — hampir sepertiga layar
// pertama untuk satu gambar yang jarang jadi alasan seseorang membuka detail
// pohon. Yang dicari orang di sini adalah kode, kondisi, dan apa yang terakhir
// terjadi; fotonya penegas, bukan isi utama. Pada 140 ia masih mengenali
// pohonnya dan tidak lagi mendorong seluruh fakta turun di bawah lipatan.
//
// PERSEGI, bukan lebar penuh: foto pohon diambil tegak dan melintang bergantian,
// dan kotak persegi memperlakukan keduanya sama. resizeMode 'cover' memotong
// sisi terpanjangnya.
const DETAIL_PHOTO_SIZE = 140;

function TreeDetailHero({
  displayCode,
  photoUrl,
  planting,
  tree,
}: {
  displayCode: string;
  photoUrl?: string | null;
  // Siklus AKTIF, dioper terpisah walau ada di dalam `tree`. Pemanggil hanya
  // merender komponen ini ketika siklusnya ada, dan prop tersendiri membuat
  // jaminan itu terbaca compiler alih-alih hanya diketahui pemanggilnya.
  planting: TreePlanting;
  tree: Tree;
}) {
  return (
    <View style={{ gap: spacing.md }}>
      {/* Kotaknya tidak dirender sama sekali kalau tidak ada foto — bukan
          berdiri kosong setinggi 140 bertuliskan "Belum ada foto".
          Pemberitahuan tanpa jalan keluar yang menghabiskan ruang di layar
          teratas adalah pertukaran yang buruk, dan jalan keluarnya memang tidak
          ada di layar ini: menambah foto dilakukan dari layar Ubah. */}
      {photoUrl ? (
        <View
          style={{
            borderCurve: 'continuous',
            // radius 10 = tokens.radius.control, ukuran yang sama dengan kolom
            // isian dan tombol. Kotak 140 dengan radius kartu (20) terbaca
            // sebagai pil; 10 menahannya tetap kotak.
            borderRadius: tokens.radius.control,
            height: DETAIL_PHOTO_SIZE,
            overflow: 'hidden',
            width: DETAIL_PHOTO_SIZE,
          }}
        >
          <TreePhotoArea photoUrl={photoUrl} />
        </View>
      ) : null}

      <View style={{ gap: spacing.xs }}>
        {/* KODE POHON, serif 40. Ia judul layar ini — tidak ada judul lain di
            mana pun, termasuk di bar atas. Serif, bukan sans: di seluruh
            redesign, keluarga serif dipakai untuk angka dan kode yang DIBACA
            sebagai nilai, bukan sebagai kalimat. */}
        <Text accessibilityRole="header" selectable style={{ ...typeScale.stat40, color: palette.textPrimary }}>
          {displayCode}
        </Text>
        {/* SATU baris: 'Miki · ditanam 25 Agu 2026 · 6 hari'.
 
            Baris lokasi ('Baris 12, kolom C') yang dulu berdiri di sini
            DICABUT — kode di atasnya sudah berbunyi '12-C', dan mengeja ulang
            ketiga karakternya dengan kata adalah baris yang tidak memberi tahu
            pembacanya hal baru.

            UMUR TETAP IKUT, satu ruas lebih panjang dari bunyi spek
            ("varietas · ditanam [tanggal]"). Ia sudah ada di baris ini sebelum
            batch 4b, dan membuangnya berarti menyuruh pemilik menghitung
            sendiri berapa umur pohonnya dari sebuah tanggal — pekerjaan yang
            justru paling berat bagi pengguna yang jadi alasan seluruh aturan
            ini ada. formatPlantingMetaLine melewati ruas yang kosong beserta
            pemisahnya, jadi baris ini tidak pernah menggantung. */}
        <Text selectable style={{ ...tokens.type.bodySmall, color: tokens.color.text.secondary }}>
          {formatPlantingMetaLine(planting)}
        </Text>
      </View>

      {/* Badge kondisi berpenanda bentuk, SENDIRIAN.
          Chip fase dan chip 'Tanam ke-N' yang dulu berdampingan di sini pindah
          ke baris fakta di bawah, tempat keduanya punya label yang menyebutkan
          apa yang sedang diukur. Deret chip tanpa label menuntut pembacanya
          mengenali tiap chip dari isinya sendiri — dan 'Tanam ke-2' hanya bisa
          dikenali oleh orang yang sudah tahu apa artinya. */}
      <View style={{ flexDirection: 'row' }}>
        <ConditionStatusBadge size="md" status={tree.currentCondition} />
      </View>
    </View>
  );
}

// Baris fakta: fase aktif dan panen terakhir.
//
// BARIS BERLABEL, bukan chip. Keduanya menjawab pertanyaan yang diajukan
// pemilik dengan kata-kata ("fasenya apa sekarang", "terakhir panen kapan"),
// dan baris berlabel menjawab dengan bentuk yang sama — label di kiri, jawaban
// di kanan. Chip menuntut pembacanya mengenali jenis chip lebih dulu.
//
// Dipisah garis rambut, tanpa kartu. Hierarki dari garis dan ruang.
function TreeFactRows({
  lastHarvest,
  phaseAgeDays,
  tree,
}: {
  lastHarvest: TreeHistoryItem | null;
  phaseAgeDays: number | null;
  tree: Tree;
}) {
  return (
    <View>
      <TreeFactRow
        label="Fase aktif"
        value={
          tree.currentGrowthPhase
            ? [
                formatGrowthPhase(tree.currentGrowthPhase),
                // Umur fase HANYA kalau tanggalnya diketahui. Lihat catatan
                // panjang pada currentPhaseAgeDays: null berarti tidak tahu,
                // dan '0 hari' berarti hari ini — dua hal yang berbeda.
                //
                // NON-PREDIKTIF: angka ini menyatakan sudah berapa lama fasenya
                // berjalan, dan tidak pernah kapan buahnya siap dipetik.
                typeof phaseAgeDays === 'number' ? `${phaseAgeDays} hari` : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : null
        }
        // Belum pernah dicatat adalah keadaan yang PERLU diketahui pemilik — ia
        // yang memberi tahu bahwa pohon ini belum pernah disentuh sama sekali —
        // jadi barisnya tetap berdiri dengan kalimatnya sendiri.
        emptyText="Belum dicatat"
      />
      {/* SATU NILAI, bukan seluruh ruas angka. '21 kg · 20 Sep', bukan
          'Jumlah buah: 12, Berat: 21 kg · 20 Sep' — yang membungkus jadi dua
          baris dan mengulang label yang sudah berdiri di sisi kiri.
          Lihat aturan pemilihannya di formatHarvestFactValue. */}
      <TreeFactRow
        label="Panen terakhir"
        value={
          lastHarvest
            ? [formatHarvestFactValue(lastHarvest.description), formatHistoryRowDate(lastHarvest.happenedAt)]
                .filter(Boolean)
                .join(' · ') || null
            : null
        }
        emptyText="Belum ada panen"
      />
    </View>
  );
}

function TreeFactRow({
  emptyText,
  label,
  value,
}: {
  emptyText: string;
  label: string;
  value: string | null;
}) {
  return (
    <View
      style={{
        alignItems: 'center',
        borderTopColor: tokens.color.line.hairline,
        borderTopWidth: 1,
        flexDirection: 'row',
        gap: spacing.md,
        justifyContent: 'space-between',
        minHeight: tokens.layout.rowMinHeight,
        paddingVertical: spacing.md,
      }}
    >
      <Text selectable style={{ ...tokens.type.body, color: tokens.color.text.secondary }}>
        {label}
      </Text>
      <Text
        selectable
        style={{
          // Nilai kosong tetap dicetak, dengan warna yang lebih redup — bukan
          // '-', yang menyuruh pembacanya menebak apakah datanya kosong, gagal
          // dimuat, atau tidak berlaku.
          color: value ? tokens.color.text.primary : tokens.color.text.tertiary,
          flexShrink: 1,
          textAlign: 'right',
          ...tokens.type.bodyStrong,
        }}
      >
        {value ?? emptyText}
      </Text>
    </View>
  );
}

// Riwayat: DUA baris terbaru, lalu satu baris "Lihat semua" yang membentangkan
// sisanya di tempat.
//
// Ambang dua baris bukan angka yang dikarang: riwayat pohon yang aktif tumbuh
// bisa memuat puluhan kejadian, dan seluruhnya dirender mentah di layar detail
// membuat satu-satunya hal yang dicari orang — kejadian paling baru — terkubur
// di antara kejadian tahun lalu. Dua baris cukup untuk menjawab "apa yang baru
// saja terjadi"; sisanya tersedia satu ketukan kemudian.
//
// TIDAK ADA ROUTE BARU. "Lihat semua" menyalakan state di komponen ini dan
// menyerahkan seluruh `history` ke <TreeHistoryTimeline> yang sama — komponen
// yang sama persis, dengan daftar yang lebih panjang.
//
// PEMBATAS SIKLUS ikut hanya pada tampilan penuh. Pada dua baris teratas,
// pembatas hampir pasti tidak punya apa pun untuk dipisahkan, dan
// TreeHistoryTimeline sendiri sudah menahannya (pembatas cuma muncul kalau
// plantings lebih dari satu) — `plantings` sengaja tidak dioper saat terlipat
// supaya aturannya tidak bergantung pada kebetulan itu.
function TreeHistorySection({
  currentUserId,
  history,
  onRecordPress,
  plantings,
  viewerMode,
}: {
  currentUserId?: string;
  history: TreeHistoryItem[];
  onRecordPress: (item: TreeHistoryItem, recordType: TreeHistoryRouteRecordType) => void;
  plantings: TreePlanting[];
  viewerMode: TreeDetailMode;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const visibleHistory = expanded ? history : history.slice(0, HISTORY_PREVIEW_COUNT);
  const hiddenCount = history.length - visibleHistory.length;

  return (
    <View style={{ gap: spacing.md }}>
      <SectionTitle title="Riwayat pohon" />
      <TreeHistoryTimeline
        currentUserId={currentUserId}
        history={visibleHistory}
        onRecordPress={onRecordPress}
        plantings={expanded ? plantings : undefined}
        viewerMode={viewerMode}
      />
      {/* Barisnya tidak dirender kalau tidak ada yang disembunyikan, dan
          berganti jadi "Sembunyikan" setelah dibentangkan — bukan menghilang,
          yang akan mengurung pemilik di daftar panjang tanpa jalan kembali.
          Jumlahnya disebutkan supaya ketukan itu bisa diperkirakan akibatnya. */}
      {hiddenCount > 0 || expanded ? (
        <Button
          onPress={() => setExpanded((current) => !current)}
          title={expanded ? 'Sembunyikan sebagian' : `Lihat semua (${history.length})`}
          variant="secondary"
        />
      ) : null}
    </View>
  );
}

const HISTORY_PREVIEW_COUNT = 2;

// Kepala Keadaan B. Sepadan dengan kepala pohon aktif — kode serif 40 lalu satu
// badge — supaya berpindah keadaan tidak terasa seperti berpindah layar. Yang
// hilang cuma fotonya dan baris varietasnya, dan keduanya memang tidak ada.
//
// `tree` TIDAK LAGI DIPAKAI: baris lokasi ('Baris 12, kolom C') dicabut di
// batch 4b dengan alasan yang sama seperti di kepala pohon aktif — kode di
// atasnya sudah berbunyi '12-C', dan mengeja ulang ketiga karakternya dengan
// kata adalah baris yang tidak memberi tahu pembacanya hal baru.
function EmptyPositionHeader({ displayCode }: { displayCode: string }) {
  return (
    <View style={{ gap: spacing.md }}>
      <Text accessibilityRole="header" selectable style={{ ...typeScale.stat40, color: palette.textPrimary }}>
        {displayCode}
      </Text>
      <View style={{ flexDirection: 'row' }}>
        <Badge label="Belum ditanami" maxWidth={200} size="md" tone="neutral" />
      </View>
    </View>
  );
}

// Kotak keterangan Keadaan B: kapan dan kenapa pohon sebelumnya berakhir.
//
// Kalimat kedua BOLEH menjanjikan berhentinya jadwal perawatan sejak migrasi
// 057: create_manual_schedule dan create_successor_schedule sama-sama menolak
// posisi tanpa siklus tanam aktif, dan pemilih pohon di layar buat maupun
// sunting jadwal tidak lagi menampilkannya.
//
// SATU CABANG BELUM TERTUTUP: jadwal bertarget SELURUH KEBUN masih menautkan
// posisi ini lewat complete_task, yang menyaring is_archived tapi bukan siklus
// tanam. Diperbaiki di migrasi 058.
function EmptyPositionNotice({ planting }: { planting: TreePlanting | null }) {
  return (
    <Card variant="warning">
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Icon name="alert-triangle" size={tokens.icon.md} color={tokens.color.status.warning.text} />
        <Text selectable style={{ color: tokens.color.status.warning.text, flex: 1, lineHeight: 21 }}>
          {formatPlantingEndSummary(planting)} Posisi ini tidak mendapat jadwal perawatan sampai ditanami lagi.
          Riwayat pohon sebelumnya tetap tersimpan di bawah.
        </Text>
      </View>
    </Card>
  );
}

// Foto pohon di layar detail: DIBACA SAJA.
//
// `mode` dan `onPhotoPress` dicabut bersama tombol kamera bundar. Komponen ini
// tidak lagi punya cabang peran sama sekali — pemilik dan pekerja melihat hal
// yang sama persis, karena keduanya memang hanya melihat.
//
// KETUK-UNTUK-MEMBESARKAN DIPERTAHANKAN, dan itu keputusan yang perlu ditulis
// alasannya. Yang dilarang adalah tombol ikon-saja dan gestur tersembunyi untuk
// MENGGANTI foto; membuka viewer bukan keduanya — ia tidak mengubah apa pun,
// dan pada kotak yang baru saja menyusut dari 220 ke 140 kemampuan memeriksa
// fotonya lebih dekat justru jadi lebih berguna, bukan kurang.
//
// Kalau ini ternyata juga harus dicabut, yang perlu dihapus hanya <Pressable>
// pembungkus dan <PhotoViewerModal> di bawah; <Image> beserta kedua keadaan
// muatnya berdiri sendiri tanpa keduanya.
function TreePhotoArea({ photoUrl }: { photoUrl?: string | null }) {
  const [previewOpen, setPreviewOpen] = React.useState(false);
  // KEADAAN MUAT DAN GAGAL MUAT, keduanya wajib ada (batch 4b).
  //
  // Sebelum ini <Image> berdiri sendirian: selama gambarnya diunduh, kotaknya
  // kosong tanpa penjelasan, dan kalau unduhannya gagal ia tetap kosong —
  // selamanya, tanpa satu pun isyarat bahwa ada yang salah. Dua keadaan yang
  // tampak identik untuk sebab yang jauh berbeda tidak bisa ditindaklanjuti
  // siapa pun.
  //
  // 'loading' adalah keadaan AWAL tiap kali URL-nya berganti, bukan hanya pada
  // pemasangan pertama: foto yang baru diunggah mengganti URL-nya, dan tanpa
  // penyetelan ulang di bawah, kotaknya melompat dari foto lama ke foto baru
  // tanpa jeda yang terlihat.
  const [photoState, setPhotoState] = React.useState<'loading' | 'ready' | 'failed'>('loading');

  // Foto utama bisa diganti atau dihapus tanpa meninggalkan layar ini. Kalau
  // fotonya berganti selagi viewer terbuka, viewer harus ikut tutup -- bukan
  // diam-diam memperlihatkan foto yang sudah tidak ada lagi.
  React.useEffect(() => {
    setPreviewOpen(false);
    setPhotoState('loading');
  }, [photoUrl]);

  if (photoUrl) {
    return (
      <>
        {/*
          Foto utama pohon dibuka lewat viewer bersama yang sama dengan foto
          catatan, foto bukti kerja, dan foto kondisi.

          Catatan lama di sini menjelaskan pembagian kerja dengan tombol kamera
          di pojok — "ketuk foto berarti lihat lebih besar, ketuk tombol berarti
          ganti atau hapus". Tombol itu sudah dicabut, jadi tidak ada lagi yang
          perlu dibagi: satu-satunya hal yang bisa dilakukan pada foto ini
          adalah melihatnya.
        */}
        <Pressable
          accessibilityLabel="Lihat foto pohon ukuran penuh"
          accessibilityRole="imagebutton"
          // Gagal muat TIDAK bisa ditekan: tidak ada foto untuk dibesarkan, dan
          // viewer yang terbuka kosong cuma memindahkan kebingungan satu layar
          // lebih dalam.
          disabled={photoState === 'failed'}
          onPress={() => setPreviewOpen(true)}
          style={{ bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 }}
        >
          <Image
            onError={() => setPhotoState('failed')}
            onLoad={() => setPhotoState('ready')}
            resizeMode="cover"
            source={{ uri: photoUrl }}
            style={{ height: '100%', width: '100%' }}
          />
          {photoState === 'ready' ? null : (
            <View
              style={{
                alignItems: 'center',
                backgroundColor: tokens.color.surface.subtle,
                bottom: 0,
                gap: tokens.space.xs,
                justifyContent: 'center',
                left: 0,
                padding: tokens.space.sm,
                position: 'absolute',
                right: 0,
                top: 0,
              }}
            >
              {photoState === 'loading' ? (
                <ActivityIndicator color={tokens.color.text.tertiary} />
              ) : (
                <>
                  {/* Gagal muat dikatakan dengan BENTUK dan KATA, bukan kotak
                      abu polos: kotak polos tidak bisa dibedakan dari foto yang
                      kebetulan rata warnanya. */}
                  <Icon
                    name="alert-triangle"
                    size={tokens.icon.md}
                    color={tokens.color.text.tertiary}
                  />
                  <Text
                    selectable={false}
                    numberOfLines={2}
                    style={{
                      color: tokens.color.text.tertiary,
                      textAlign: 'center',
                      ...tokens.type.meta,
                    }}
                  >
                    Foto gagal dimuat
                  </Text>
                </>
              )}
            </View>
          )}
        </Pressable>
        {/* TOMBOL KAMERA BUNDAR DICABUT DI SINI (batch 4b). Ia tombol
            ikon-saja, dan ia yang terakhir tersisa di aplikasi setelah tombol
            zoom denah dicabut di batch 4a. Mengganti foto pindah seluruhnya ke
            layar Ubah, yang sudah punya bagian "Foto pohon" berlabel lengkap. */}
        <PhotoViewerModal
          onClose={() => setPreviewOpen(false)}
          photoUrl={photoUrl}
          visible={previewOpen}
        />
      </>
    );
  }

  // TANPA FOTO: TIDAK ADA APA-APA, untuk KEDUA peran.
  //
  // Di sini dulu ada dua cabang. Pemilik mendapat kotak bergaris putus-putus
  // bertuliskan "Tambah foto" yang membuka lembar sumber foto; pekerja tidak
  // mendapat apa-apa.
  //
  // Cabang pemilik ikut pergi bersama tombol kameranya, dan dengan alasan yang
  // sama: menambah foto dilakukan dari layar Ubah, dan kotak yang menjanjikan
  // pekerjaan itu di sini adalah jalur kedua ke satu hal yang sama. Yang
  // tersisa sekarang berlaku untuk keduanya, dan itu justru menyederhanakan:
  // komponen ini tidak lagi tahu apa pun tentang peran.
  //
  // Pemanggilnya (TreeDetailHero) tidak mengandalkan null di sini — ia sendiri
  // sudah tidak merender pembungkus 140-nya sama sekali saat photoUrl kosong.
  //
  // Di sini dulu berdiri kotak setinggi 220 bertuliskan "Belum ada foto". Kotak
  // itu memberi tahu pekerja sesuatu yang tidak bisa ia tindak lanjuti — hanya
  // pemilik yang boleh mengunggah foto pohon — sambil mendorong seluruh isi
  // layar yang berguna turun satu layar penuh. Pemberitahuan tanpa jalan keluar
  // yang menghabiskan ruang paling mahal di layar adalah pertukaran yang buruk.
  //
  // Pemanggilnya (TreeDetailHero) tidak boleh sekadar mengandalkan null di sini:
  // pembungkusnya sendiri menetapkan minHeight 220, jadi ia ikut memeriksa
  // kondisi yang sama dan tidak merender pembungkusnya sama sekali.
  return null;
}

// Baris meta siklus tanam: 'Miki · ditanam 25 Agu 2026 · 6 hari'.
//
// Pengganti kartu "Pohon yang ditanam sekarang" beserta keempat InfoCell-nya.
// Isinya milik SIKLUS TANAM yang sedang berjalan (migrasi 055), bukan milik
// posisinya — sebuah posisi bisa ditanami berkali-kali. Judul kartu yang dulu
// menjelaskan itu ikut hilang; yang menggantikannya adalah chip 'Tanam ke-N'
// di atas baris ini, yang mengatakan hal yang sama dengan satu kata lebih
// sedikit dan hanya muncul saat memang ada yang perlu dikatakan.
//
// Kata 'ditanam' dipertahankan di depan tanggalnya. Tanpa label apa pun, tiga
// ruas berturut-turut — varietas, sebuah tanggal, sebuah durasi — membuat
// tanggal dan durasi mudah tertukar artinya. Umurnya sendiri tidak perlu label:
// formatTreeAge sudah menghasilkan bentuk yang tidak mungkin salah baca
// ('6 hari', '3 th 2 bln').
//
// Ruas yang kosong DILEWATI, bukan diisi 'Belum diisi'. Varietas boleh NULL
// (start_tree_planting menerimanya, 055:357) dan begitu pula tanggal tanam;
// mencetak 'Belum diisi' di tengah baris bertitik membuatnya terbaca seolah
// sebuah nilai.
function formatPlantingMetaLine(planting: TreePlanting): string {
  const parts: string[] = [];
  const variety = planting.variety?.trim();

  if (variety) {
    parts.push(variety);
  }

  if (planting.plantedAt) {
    parts.push(`ditanam ${formatFriendlyDate(planting.plantedAt)}`);
    parts.push(formatTreeAge(planting.plantedAt));
  }

  // Siklus tanpa varietas MAUPUN tanggal tanam benar-benar bisa ada. Barisnya
  // tidak boleh jadi string kosong yang menyisakan ruang menganggur di bawah
  // chip, jadi ia mengatakan apa adanya.
  return parts.length > 0 ? parts.join(' · ') : 'Data penanaman belum dilengkapi';
}

function RecordActivitySheet({
  basePath,
  onClose,
  treeId,
  visible,
}: {
  basePath: string;
  onClose: () => void;
  treeId: string;
  visible: boolean;
}) {
  function goTo(path: string) {
    onClose();
    router.push(path);
  }

  return (
    <BottomSheet onClose={onClose} title="Tambah catatan" visible={visible}>
      <View style={{ gap: tokens.space.sm }}>
        {/* JUDUL SATU KATA + SUBJUDUL SATU FRASA, menggantikan "Catat kondisi",
            "Catat fase", dan seterusnya.
 
            Kata "Catat" diulang empat kali di lembar yang JUDULNYA sudah
            berbunyi "Tambah catatan" tidak membedakan satu baris dari baris
            lain — ia cuma memakai empat kali kata pertama tiap baris, yaitu
            tempat yang paling dulu dibaca mata. Yang membedakan keempatnya
            justru kata kedua, dan sekarang kata itu berdiri sendirian.

            Subjudulnya menjelaskan APA yang dicatat dengan kata sehari-hari,
            bukan mengulang istilahnya. "Fase" saja bisa berarti apa pun bagi
            orang yang belum pernah memakai aplikasi ini; "tahap pertumbuhan"
            tidak. */}
        <SheetActionRow
          description="Keadaan pohon hari ini"
          icon="alert-triangle"
          iconTone="condition"
          title="Kondisi"
          onPress={() => goTo(`${basePath}/${treeId}/report`)}
        />
        <SheetActionRow
          description="Tahap pertumbuhan"
          icon="flower"
          iconTone="phase"
          title="Fase"
          onPress={() => goTo(`${basePath}/${treeId}/phase`)}
        />
        <SheetActionRow
          description="Hasil yang dipetik"
          icon="basket"
          iconTone="harvest"
          title="Panen"
          onPress={() => goTo(`${basePath}/${treeId}/harvest`)}
        />
        <SheetActionRow
          description="Pekerjaan yang dilakukan"
          icon="spray"
          iconTone="care"
          title="Perawatan"
          onPress={() => goTo(`${basePath}/${treeId}/care`)}
        />
        {/* Batal EKSPLISIT, di samping backdrop dan gestur tutup yang sudah
            ada. Keduanya harus dipelajari dulu; tombol berlabel tidak. Lembar
            ini dibuka dari bar aksi, jadi ia bisa terbuka karena salah tekan —
            dan orang yang salah tekan mencari jalan keluar yang terlihat. */}
        <Button onPress={onClose} title="Batal" variant="secondary" />
      </View>
    </BottomSheet>
  );
}

// OwnerTreeMenu ("Kelola data pohon") DICABUT bersama fitur arsip.
//
// Ia sempat berisi dua baris; "Edit Pohon" lebih dulu pindah keluar menjadi
// tombol lebar "Edit data pohon" di badan layar, menyisakan arsip sendirian.
// Begitu arsip pergi, menunya kosong — jadi menu, tombol titik-tiga yang
// membukanya, dan state menuOpen ikut dicabut sekaligus. Semua aksi yang
// tersisa di layar ini sudah punya tempatnya sendiri di badan layar.

function SectionTitle({ subtitle, title }: { subtitle?: string; title: string }) {
  return (
    <View style={{ gap: spacing.xs, paddingTop: spacing.xs }}>
      <Text selectable style={{ color: colors.text, fontSize: typography.h2.fontSize, fontWeight: '700', lineHeight: typography.h2.lineHeight }}>
        {title}
      </Text>
      {subtitle ? (
        <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function formatFriendlyDate(value?: string | null): string {
  if (!value) {
    return 'Belum diisi';
  }

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
