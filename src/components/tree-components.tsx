import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import type {
  CareCategory,
  GrowthPhase,
  MemberRole,
  Tree,
  TreeConditionReport,
  TreeConditionStatus,
  CareActivityOrigin,
  TreeHistoryItem,
  TreeHistoryType,
  TreePlanting,
} from '../types/domain';
import type {
  ConditionRecordPhotoMap,
  PickedPhotoAsset,
} from '../types/media';
import { colors, radius, spacing, tokens, typography } from '../constants/theme';
import { PHOTO_PROCESSING_MESSAGE } from '../lib/media';
import { formatCareCategory, formatPersonDisplayName } from '../utils/displayFormat';
import {
  formatFullDate,
  formatShortDate,
  getTodayIsoDate,
  toWibIsoDate,
} from '../utils/taskDueDate';
import {
  formatCurrentCycleLine,
  formatCycleDividerLabel,
  groupTreeHistoryByCycle,
} from '../utils/treeCycle';
import {
  buildTreeDisplayCode,
  formatGrowthPhase,
  formatTreeAge,
  formatTreeConditionStatus,
  formatTreeDisplayCode,
} from '../utils/treeFormat';
import { colors as palette, fonts } from '../theme/tokens';
import { PhotoViewerModal } from './media';
import {
  Badge,
  Button,
  Card,
  CONDITION_BADGE,
  DateField,
  EmptyState,
  Field,
  MetaRow,
  PhotoPickerCard,
  StatusMarker,
} from './ui';
// AlertTriangleIcon, BasketIcon, FlowerIcon, dan SprayIcon DICABUT di batch 7b.
// Keempatnya hanya pernah dipakai getTimelineIcon, yaitu glif di dalam cakram
// yang kini tidak ada lagi: penanda baris riwayat sekarang BENTUK 11px di atas
// rel garis, bukan ikon bergaris 18px di dalam lingkaran berlatar. Definisinya
// tetap berdiri di icons.tsx.
import { ChevronRightIcon, Icon, type IconName } from './icons';

export type TreeFormValues = {
  rowPosition: string;
  columnPosition: string;
  variety: string;
  plantedAt: Date | null;
};

export type TreeCardProps = {
  tree: Tree;
  children?: React.ReactNode;
  photoUrl?: string | null;
  onPress?: () => void;
  /**
   * Satu keterangan pendek di KOLOM KANAN, tepat di atas badge kondisi.
   *
   * Ditambahkan di batch 7b untuk "N hari" pada layar Fase pohon (§17), dan
   * sengaja tidak memakai slot `children` yang sudah ada: `children` jatuh di
   * kolom tengah, di bawah baris meta, sedangkan angka yang dipindai baris demi
   * baris harus berdiri di tepi yang sama pada setiap baris — kolom kiri
   * panjangnya berubah-ubah mengikuti nama varietas.
   *
   * Bawaannya kosong, jadi dua pemanggil TreeCard yang sudah ada tidak bergeser
   * sepiksel pun.
   */
  trailing?: React.ReactNode;
};

export type TreeFormErrors = {
  columnPosition?: string;
  plantedAt?: string;
  rowPosition?: string;
  variety?: string;
};

export type TreeFormProps = {
  errors?: TreeFormErrors;
  /**
   * 'create' membiarkan posisi diisi dan menampilkan baris konfirmasi apakah
   * posisi itu masih kosong. 'edit' MENGUNCI posisi jadi satu baris terbaca
   * saja.
   *
   * Alasannya prinsip, bukan teknis. Kode posisi adalah identitas TEMPAT, bukan
   * identitas pohon: '12-C' berarti baris 12 kolom C di kebun ini, dan ia tetap
   * berarti itu setelah pohonnya mati dan diganti tiga kali. Membiarkan kode
   * dipindah berarti menulis ulang sejarah tempat — seluruh riwayat kondisi,
   * panen, dan perawatan yang tercatat di '12-C' mendadak jadi milik posisi
   * lain, dan tidak ada satu pun catatan yang menyebutkan bahwa itu terjadi.
   *
   * update_tree_with_planting (migrasi 056) MASIH MENERIMA posisi baru, jadi
   * penguncian ini murni di antarmuka. Itu disengaja: mengubah RPC berarti
   * migrasi, dan batch ini tidak menyentuh database.
   */
  mode: 'create' | 'edit';
  /**
   * Baris konfirmasi di bawah kolom posisi pada mode 'create'.
   *
   * null berarti belum bisa dikatakan — posisinya belum lengkap diketik, atau
   * daftar pohon belum selesai dimuat. Barisnya tidak dirender sama sekali,
   * BUKAN dirender sebagai "memeriksa...": baris yang berkedip antara tiga
   * keadaan di bawah kolom yang sedang diketik lebih mengganggu daripada
   * membantu.
   */
  positionStatus?: { occupied: boolean; code: string } | null;
  values: TreeFormValues;
  onChange: (values: TreeFormValues) => void;
};

/**
 * Tiga pilihan varietas sebagai TOMBOL BESAR, bukan dropdown.
 *
 * Dropdown menyembunyikan pilihannya sampai ditekan, menuntut ketukan kedua
 * untuk memilih, dan menampilkan daftarnya sebagai menu melayang yang sulit
 * disentuh dengan tepat. Tiga pilihan yang seluruhnya muat dalam satu baris
 * tidak punya satu pun alasan untuk disembunyikan.
 *
 * 'Lain' BUKAN varietas — ia jalan menuju kolom teks bebas. Kolom variety pada
 * tree_plantings menerima teks apa pun, jadi kedua nama ini murni jalan pintas
 * antarmuka, bukan enum. Tidak ada field baru dan tidak ada validasi yang
 * berubah: yang sampai ke service tetap satu string.
 */
const VARIETY_PRESETS = ['Miki', 'Aligator'] as const;
const VARIETY_OTHER = 'Lain';

export type TreeMainPhotoFormSectionProps = {
  currentPhotoUrl?: string | null;
  deleteRequested?: boolean;
  disabled: boolean;
  photo: PickedPhotoAsset | null;
  // Dipisahkan dari `disabled` dengan sengaja: `disabled` berarti formulirnya
  // sedang disimpan, `processing` berarti fotonya sedang diperkecil. Bagi
  // pengguna keduanya kejadian yang berbeda.
  processing?: boolean;
  onCameraPress: () => void;
  onDeleteExisting?: () => void;
  onGalleryPress: () => void;
  onRemoveSelected: () => void;
  onRestoreExisting?: () => void;
};

export type ConditionStatusBadgeProps = {
  // Diteruskan apa adanya ke Badge. Tanpa nilai, ukurannya persis seperti dulu.
  size?: 'sm' | 'md';
  status: TreeConditionStatus;
};

export type GrowthPhaseBadgeProps = {
  // Umur fase dalam hari, digabung ke label jadi 'Berbunga · 96 hari'.
  //
  // OPSIONAL, dan tanpa nilai chip-nya persis seperti sebelumnya — dua pemakai
  // lain (monitoring fase, layar catat fase) tidak mengirimnya dan tidak
  // bergeser sedikit pun.
  //
  // NON-PREDIKTIF, dan itu bukan kelalaian melainkan keputusan v4 yang dikunci
  // (docs/updated/landasan_avology_v4.md:29): angka ini menyatakan SUDAH BERAPA
  // LAMA fasenya berjalan, dan tidak pernah menyatakan kapan buahnya siap
  // dipetik. Jangan menambahkan perkiraan tanggal panen ke sini.
  ageDays?: number | null;
  phase: GrowthPhase;
};

export type ConditionReportListItem = Omit<TreeConditionReport, 'reportedBy'> & {
  reportedBy?: string | null;
  reportedByName?: string | null;
  reportedByRole?: MemberRole | null;
};

export type ConditionReportItemProps = {
  report: ConditionReportListItem;
};

export type ConditionReportListProps = {
  reports: ConditionReportListItem[];
  conditionPhotoMap?: ConditionRecordPhotoMap;
  emptyTitle?: string;
  emptySubtitle?: string;
  currentUserId?: string | null;
  viewerMode?: TreeHistoryViewerMode;
};

export type TreeHistoryTimelineProps = {
  currentUserId?: string | null;
  history: TreeHistoryItem[];
  onRecordPress?: (item: TreeHistoryItem, recordType: TreeHistoryRouteRecordType) => void;
  // Seluruh siklus tanam posisi ini, dipakai HANYA untuk menyisipkan pembatas
  // dan meredupkan kejadian milik siklus lama. Opsional dengan sengaja: kalau
  // pengambilannya gagal atau pemanggil tidak menyediakannya, timeline kembali
  // ke bentuk datar seperti sebelumnya alih-alih ikut kosong.
  plantings?: TreePlanting[];
  viewerMode?: TreeHistoryViewerMode;
};

type TreeHistoryViewerMode = 'owner' | 'worker';
export type TreeHistoryRouteRecordType = 'condition' | 'phase' | 'harvest' | 'care';

// BARIS daftar, bukan kartu grid. Namanya tetap TreeCard supaya kedua layar
// pemakainya tidak perlu ikut berubah.
//
// Grid dua kolom membayar mahal untuk foto: tiap kartu memuat gambar 4:3 selebar
// setengah layar, padahal foto pohon jarang jadi alasan seseorang membuka daftar
// — yang dicari kode, kondisi, dan fase. Sebagai baris, satu layar memuat tiga
// kali lebih banyak pohon dan ketiga hal itu terbaca sejajar ke bawah.
//
// DUA baris teks, bukan tiga: kode di atas, lalu SATU baris meta yang memuat
// varietas · fase · umur. Sebelumnya varietas berdiri sebagai baris sendiri di
// antara keduanya, dan itu memberinya berat yang tidak dimilikinya — varietas
// hampir selalu sama untuk seluruh kebun, jadi ia justru bagian meta yang paling
// jarang membedakan satu baris dari baris lain. Dengan dua baris, thumbnail 72px
// yang menentukan tinggi baris, dan kepadatannya naik tanpa ada yang hilang.
//
// Kondisi di tepi kanan sebagai IKON + TEKS, bukan badge berkotak. Badge memberi
// setiap baris sebuah kotak kedua di sebelah kotak thumbnail, dan di daftar
// sepanjang 234 posisi kotak-kotak itu menumpuk jadi kolom yang berisik.
// ConditionStatusBadge sendiri TIDAK diubah — ia masih dipakai layar detail
// pohon dan layar catat kondisi, tempat ia berdiri sendirian dan memang pantas
// jadi kotak.
//
// IKONNYA SENGAJA TIDAK UNIK per kondisi: hama, penyakit, dan rusak berbagi satu
// segitiga seru di sini. Pembedanya bukan ikon melainkan TEKS di sebelahnya,
// yang selalu berbeda dan selalu hadir; ikon adalah saluran ketiga setelah teks
// dan warna.
//
// PETA DENAH MELAKUKAN SEBALIKNYA — di sana ketiganya punya glif sendiri
// (serangga, daun berbercak, ranting patah). Itu bukan ketidakkonsistenan yang
// terlewat: di sel petak TIDAK ADA teks yang membedakan ketiganya, jadi glif
// adalah satu-satunya pembeda selain warna, dan warna ketiganya memang sengaja
// sama. Di baris ini teksnya ada, jadi glif yang lebih rumit hanya menambah
// detail tanpa menambah informasi.
//
// Tanpa chevron. Seluruh barisnya memang bisa ditekan, tapi itu sudah tersirat
// dari daftar yang isinya seragam; sebuah panah di setiap baris membayar ruang
// tetap untuk mengulang hal yang sama sebanyak jumlah pohon.
//
// Umur ikut di baris meta dalam bentuk pendek ("3 th"): di daftar ia hanya perlu
// dikenali sekilas, sedangkan bentuk panjangnya tetap ada di layar detail.
// 56, turun dari 72 (batch 4a). Yang dibeli dengan 16px itu bukan kerapatan
// demi kerapatan: pada 72 sebuah layar 812 memuat sekitar enam baris, pada 56
// delapan — dan daftar pohon dipindai, bukan dibaca. Foto pohon durian pada 56
// masih mengenali pohonnya; yang hilang cuma detail daun, yang memang tidak
// dipakai siapa pun untuk memutuskan apa pun dari baris daftar.
const TREE_ROW_THUMBNAIL = 56;
// 56 + 12 + 12 = 80, mengikuti thumbnail-nya turun dari 96. Padding vertikalnya
// TIDAK ikut berubah: yang menentukan tinggi baris tetap thumbnail, dan ruang
// napas di atas-bawahnya sudah pas pada space.md.
const TREE_ROW_MIN_HEIGHT = 80;

// 18/600 untuk kode pohon, naik dari subheading (17). Tidak ada token 18 di
// skala tipografi, dan menambahkannya untuk satu titik pakai akan melahirkan
// langkah baru di skala yang dipakai 53 berkas. Ditulis sebagai konstanta
// bernama di sini, bukan angka telanjang di dalam JSX.
//
// Kode pohon adalah satu-satunya hal di baris ini yang dicari mata lebih dulu —
// orang membuka daftar untuk menemukan "12-C", bukan untuk membaca varietasnya.
// Satu langkah di atas judul baris biasa itulah yang membuatnya jadi jangkar.
const TREE_ROW_CODE_SIZE = 18;
const TREE_ROW_CODE_LINE_HEIGHT = 24;

// CONDITION_ICONS DIHAPUS di batch 4a. Ia memetakan pest_attacked,
// disease_indicated, dan damaged ke satu 'alert-triangle' yang sama, dan satu-
// satunya pemanggilnya — baris daftar pohon — sekarang memakai
// <ConditionStatusBadge>, yang membedakan ketiganya lewat CONDITION_BADGE.

// Teks yang berdiri saat varietasnya memang belum diisi. Kalimat, bukan tanda
// hubung: "—" menyuruh pembaca menebak apakah datanya kosong, gagal dimuat, atau
// tidak berlaku. Bunyinya sengaja sama persis dengan label badge filter yang
// menyaring keadaan ini di kedua layar daftar, supaya yang dibaca di baris dan
// yang ditekan di sheet terasa satu benda.
//
// Pasangannya untuk fase TIDAK ditulis di sini: formatGrowthPhase(null) sudah
// mengembalikan 'Belum dicatat', dan menyalinnya jadi konstanta kedua berarti
// dua tempat yang bisa berbeda bunyi.
const NO_VARIETY_TEXT = 'Varietas belum diisi';

export function TreeCard({ children, onPress, photoUrl, trailing, tree }: TreeCardProps) {
  const displayCode = formatTreeDisplayCode(tree);
  const isInactive = tree.currentCondition === 'dead';
  // formatGrowthPhase(null) sudah mengembalikan 'Belum dicatat' — dipanggil
  // langsung tanpa cabang sendiri supaya teksnya tidak bisa menyimpang dari yang
  // dipakai layar lain.
  const phaseText = formatGrowthPhase(tree.currentGrowthPhase);
  const varietyText = tree.activePlanting?.variety?.trim() || NO_VARIETY_TEXT;
  // filter(Boolean) sebelum join: pohon tanpa tanggal tanam kehilangan bagian
  // umurnya BESERTA pemisahnya, bukan menyisakan "· " yang menggantung.
  const metaText = [varietyText, phaseText, shortTreeAge(tree.activePlanting?.plantedAt)]
    .filter(Boolean)
    .join(' · ');

  const content = (
    <View
      style={{
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.lg,
        // 72 + 12 + 12 = 96, dan alignItems 'center' menjaga thumbnail duduk di
        // tengah baris. Dua baris teks berjumlah sekitar 45, jadi thumbnail-lah
        // yang menentukan tinggi — padding dipilih supaya ia punya ruang napas
        // yang sama di atas dan di bawah, bukan menempel ke divider. Sejak baris
        // varietas dilebur ke baris meta, jarak itu justru bertambah lega;
        // TREE_ROW_MIN_HEIGHT sengaja TIDAK ikut diturunkan, karena yang menahan
        // tinggi tetap thumbnail-nya.
        minHeight: TREE_ROW_MIN_HEIGHT,
        opacity: isInactive ? 0.62 : 1,
        paddingVertical: spacing.md,
      }}
    >
      <View
        style={{
          borderCurve: 'continuous',
          borderRadius: tokens.radius.cardInner,
          height: TREE_ROW_THUMBNAIL,
          overflow: 'hidden',
          width: TREE_ROW_THUMBNAIL,
        }}
      >
        {/* iconSize tidak dioper: 28 bawaan TreeVisualPlaceholder memang ukuran
            yang benar untuk kotak sebesar ini. */}
        <TreeVisualPlaceholder inactive={isInactive} photoUrl={photoUrl} />
      </View>

      {/* minWidth 0 WAJIB di kolom yang melar: tanpa itu teks panjang mendorong
          kondisi keluar layar alih-alih terpotong sendiri. */}
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <Text
          selectable
          numberOfLines={1}
          style={{
            color: tokens.color.text.primary,
            // Berat dibawa keluarga huruf; Android tidak mensintesis berat
            // untuk font kustom.
            fontFamily: fonts.sansSemiBold,
            fontSize: TREE_ROW_CODE_SIZE,
            lineHeight: TREE_ROW_CODE_LINE_HEIGHT,
          }}
        >
          {displayCode}
        </Text>
        {/* 14, naik dari meta (13). Baris ini dibaca di kebun, sambil berdiri,
            dan 13px adalah ukuran terkecil di seluruh aplikasi ini — ia tidak
            pantas dipakai untuk baris yang menyebut varietas dan fase, dua hal
            yang memang dibaca dan bukan sekadar dikenali. */}
        <Text
          selectable
          numberOfLines={1}
          style={{ ...tokens.type.bodySmall, color: tokens.color.text.secondary }}
        >
          {metaText}
        </Text>
        {children}
      </View>

      {/* BADGE, bukan lagi ikon + teks telanjang (batch 4a).
          <ConditionStatusBadge> sudah ada di berkas ini dan sudah dipakai layar
          detail pohon; ia membawa penanda BENTUK dari CONDITION_BADGE, jadi
          Hama, Sakit, dan Rusak akhirnya bisa dibedakan di baris daftar tanpa
          bergantung pada rona.

          Sebelum ini ketiganya memakai CONDITION_ICONS, yang memetakan ketiga-
          tiganya ke satu 'alert-triangle' yang sama — persis penggabungan yang
          sudah diperbaiki di badge dan di sel denah, tapi belum di sini.

          flexShrink 0: kondisi adalah alasan utama baris ini dipindai, jadi
          teks di kolom tengah yang terpotong duluan saat ruang sempit. */}
      {/* alignItems 'flex-end': keterangan `trailing` dan badge di bawahnya
          rata di tepi kanan yang sama, jadi angka yang panjangnya berbeda
          ("7 hari" vs "128 hari") tetap berakhir di garis yang sama. */}
      <View style={{ alignItems: 'flex-end', flexShrink: 0, gap: 4 }}>
        {trailing}
        <ConditionStatusBadge status={tree.currentCondition} />
      </View>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return <Pressable onPress={onPress}>{content}</Pressable>;
}

// Bentuk pendek umur untuk baris daftar: "3 th", "5 bln", "12 hr".
//
// Memendekkan keluaran formatTreeAge, BUKAN menghitung ulang selisih tanggalnya.
// Aturan umur pohon (hari di bawah sebulan, bulan di bawah setahun, selebihnya
// tahun) hanya boleh hidup di satu tempat; menyalinnya ke sini berarti dua
// tempat yang bisa berbeda jawaban untuk pohon yang sama.
//
// Mengembalikan null kalau tanggal tanam kosong atau tidak terbaca — pemanggil
// membuang bagian itu beserta pemisahnya.
function shortTreeAge(plantedAt?: string | null): string | null {
  if (!plantedAt) {
    return null;
  }

  const match = /^(\d+)\s+(tahun|bulan|hari)$/.exec(formatTreeAge(plantedAt));

  if (!match) {
    return null;
  }

  const shortUnits: Record<string, string> = { bulan: 'bln', hari: 'hr', tahun: 'th' };

  return `${match[1]} ${shortUnits[match[2]]}`;
}

export function TreeVisualPlaceholder({
  iconSize = 28,
  inactive = false,
  photoUrl,
}: {
  iconSize?: number;
  inactive?: boolean;
  photoUrl?: string | null;
}) {
  const [imageFailed, setImageFailed] = React.useState(false);
  const shouldShowImage = Boolean(photoUrl && !imageFailed);

  React.useEffect(() => {
    setImageFailed(false);
  }, [photoUrl]);

  if (shouldShowImage) {
    return (
      <Image
        onError={() => setImageFailed(true)}
        resizeMode="cover"
        source={{ uri: photoUrl ?? undefined }}
        style={{ height: '100%', opacity: inactive ? 0.85 : 1, width: '100%' }}
      />
    );
  }

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: colors.photoPlaceholder,
        height: '100%',
        justifyContent: 'center',
        width: '100%',
      }}
    >
      <Icon name="tree" size={iconSize} color={colors.textMuted} />
    </View>
  );
}

// Varietas dan tanggal tanam dirender di KEDUA alur, dengan makna berbeda:
//
//   Tambah pohon  -> keduanya mengisi siklus tanam PERTAMA posisi ini.
//   Edit pohon    -> keduanya MENGOREKSI siklus yang sedang aktif (migrasi
//                    056). Koreksi, bukan penanaman ulang: cycle_no tidak naik.
//
// Penanaman ulang yang sungguhan punya jalurnya sendiri (end_tree_planting lalu
// start_tree_planting) dan bukan lewat form ini.
export function TreeForm({ errors, mode, onChange, positionStatus, values }: TreeFormProps) {
  const previewCode = buildTreeDisplayCode(values);
  const trimmedVariety = values.variety.trim();
  // Apakah pemilik MENEKAN tombol 'Lain'. Hanya itu yang disimpan sebagai
  // state; terbuka-atau-tidaknya kolom teks DITURUNKAN di bawah.
  const [otherChosen, setOtherChosen] = React.useState(false);

  // KOLOM TEKS BEBAS TERBUKA kalau pemilik menekan 'Lain', ATAU kalau nilai
  // yang tersimpan bukan salah satu preset.
  //
  // DITURUNKAN TIAP RENDER, BUKAN DIPOTRET SEKALI DI useState. Bedanya adalah
  // kehilangan data, bukan kerapian:
  //
  // useState dengan penginisialisasi malas hanya membaca nilainya pada render
  // PERTAMA. Layar Edit memuat pohonnya secara asinkron, jadi ada jalur di mana
  // form ter-mount sebelum varietas tersimpan sampai ke `values` — dan begitu
  // itu terjadi, potretnya selamanya `false`: 'Lain' tidak terpilih, kolom
  // teksnya tidak pernah terbuka, dan varietas "Mentega" yang tersimpan tidak
  // terlihat di mana pun DI LAYAR YANG GUNANYA MENGUBAHNYA. Nilainya masih ikut
  // terkirim saat disimpan, jadi kerusakannya diam: pemilik melihat tiga tombol
  // yang semuanya padam, menekan salah satunya untuk "mengisi yang kosong", dan
  // varietasnya tertimpa tanpa ia pernah tahu ada nilai di sana.
  //
  // Sebagai nilai turunan, varietas yang datang terlambat membuka kolomnya
  // sendiri pada render berikutnya. Tidak ada jalur di mana nilai tersimpan
  // bisa tidak terlihat.
  const otherOpen = otherChosen || (trimmedVariety.length > 0 && !isVarietyPreset(trimmedVariety));

  function updateTextValue(field: 'rowPosition' | 'columnPosition' | 'variety', value: string) {
    onChange({
      ...values,
      [field]: value,
    });
  }

  function updateDateValue(value: Date | null) {
    onChange({
      ...values,
      plantedAt: value,
    });
  }

  function chooseVariety(preset: string) {
    setOtherChosen(false);
    updateTextValue('variety', preset);
  }

  function chooseOther() {
    setOtherChosen(true);

    // Nilai preset DIKOSONGKAN saat beralih ke 'Lain'. Membiarkannya berarti
    // kolom teks terbuka sudah berisi "Miki", dan pemilik yang menekan 'Lain'
    // justru karena varietasnya bukan Miki harus menghapusnya dulu.
    //
    // PENJAGANYA WAJIB, dan ia yang melindungi "Mentega". Tanpa pemeriksaan
    // isVarietyPreset, menekan 'Lain' pada pohon yang varietasnya sudah bernilai
    // bebas akan MENGHAPUS nilai itu — persis nilai yang tombolnya ada untuk
    // menampungnya. Varietas di luar daftar tidak pernah dikosongkan oleh
    // tombol mana pun di form ini.
    if (isVarietyPreset(trimmedVariety)) {
      updateTextValue('variety', '');
    }
  }

  return (
    <View style={{ gap: spacing['2xl'] }}>
      {/* KONTEKS DULU: di mana pohon ini berdiri. Pada mode 'create' ia pilihan
          pertama yang menentukan sisanya; pada 'edit' ia fakta yang tidak boleh
          diganggu. Keduanya pantas berada paling atas.

          Kotak "Kode pohon otomatis" yang dulu berdiri di sini DICABUT. Ia
          memberi bingkai, latar, dan teks 24pt kepada dua karakter yang bisa
          dibaca langsung dari kedua kolom tepat di bawahnya — dan pada mode
          'create' kotak itu menghabiskan sekitar 80px untuk mengulang apa yang
          baru saja diketik. Yang menggantikannya baris konfirmasi di bawah,
          yang mengatakan sesuatu yang BELUM diketahui pemilik. */}
      {mode === 'create' ? (
        <TreeFormSection
          title="Posisi tanam"
          description="Kode pohon dirakit otomatis dari baris dan kolom."
        >
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Field
                error={errors?.rowPosition}
                keyboardType="number-pad"
                label="Baris *"
                onChangeText={(value) => updateTextValue('rowPosition', value)}
                placeholder="1"
                value={values.rowPosition}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                error={errors?.columnPosition}
                autoCapitalize="characters"
                label="Kolom *"
                onChangeText={(value) => updateTextValue('columnPosition', value)}
                placeholder="A"
                value={values.columnPosition}
              />
            </View>
          </View>

          {/* SATU BARIS KONFIRMASI, dan ia berbicara di KEDUA keadaan.
              Posisi yang sudah terisi TIDAK didiamkan: pemilik yang mengetik
              posisi yang sudah ada pohonnya akan tetap menekan Simpan dan baru
              ditolak database — dengan pesan yang ditulis untuk mesin, setelah
              ia selesai mengisi seluruh form. */}
          {positionStatus ? <PositionStatusLine status={positionStatus} /> : null}
        </TreeFormSection>
      ) : (
        <TreeFormSection
          title="Posisi tanam"
          description="Kode posisi tidak bisa diubah. Ia menandai tempat, bukan pohonnya."
        >
          <LockedPositionRow code={previewCode} />
        </TreeFormSection>
      )}

      <TreeFormSection title="Varietas">
        {/* Tiga tombol besar berlabel teks, bukan dropdown. Lihat catatan pada
            VARIETY_PRESETS. */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {VARIETY_PRESETS.map((preset) => (
            <View key={preset} style={{ flex: 1 }}>
              <VarietyChoiceButton
                label={preset}
                onPress={() => chooseVariety(preset)}
                selected={!otherOpen && trimmedVariety === preset}
              />
            </View>
          ))}
          <View style={{ flex: 1 }}>
            <VarietyChoiceButton
              label={VARIETY_OTHER}
              onPress={chooseOther}
              selected={otherOpen}
            />
          </View>
        </View>

        {otherOpen ? (
          <Field
            error={errors?.variety}
            label="Nama varietas *"
            onChangeText={(value) => updateTextValue('variety', value)}
            placeholder="Contoh: Alpukat mentega"
            value={values.variety}
          />
        ) : errors?.variety ? (
          // Galat varietas tetap harus terbaca walau kolom teksnya tertutup —
          // tanpa baris ini, menekan Simpan tanpa memilih varietas menghasilkan
          // form yang menolak tanpa mengatakan apa yang kurang.
          <Text
            selectable
            style={{
              color: tokens.color.status.danger.text,
              fontSize: tokens.type.meta.fontSize,
              lineHeight: tokens.type.meta.lineHeight,
            }}
          >
            {errors.variety}
          </Text>
        ) : null}
      </TreeFormSection>

      <DateField
        error={errors?.plantedAt}
        label="Tanggal tanam *"
        value={formatDateForDb(values.plantedAt)}
        onChangeDate={(value) => updateDateValue(parseDbDate(value))}
      />
    </View>
  );
}

function isVarietyPreset(value: string): boolean {
  return (VARIETY_PRESETS as readonly string[]).includes(value);
}

// Tombol pilihan varietas. Tinggi kontrol penuh (56), bukan chip — spek
// menyebutnya "tombol besar", dan di layar ini ia memang pilihan utama kedua
// setelah posisi.
//
// Keadaan terpilih dibawa DUA saluran: latar brand.soft DAN garis accent yang
// menebal jadi 2px. Warna sendirian tidak cukup, aturan yang sama yang berlaku
// di seluruh repo.
function VarietyChoiceButton({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: selected ? tokens.color.brand.soft : tokens.color.surface.card,
        borderColor: selected ? palette.accent : palette.borderStrong,
        borderCurve: 'continuous',
        borderRadius: tokens.radius.control,
        borderWidth: selected ? 2 : 1,
        justifyContent: 'center',
        minHeight: tokens.layout.controlHeight,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        selectable={false}
        numberOfLines={1}
        style={{
          color: selected ? palette.accentText : tokens.color.text.primary,
          fontFamily: selected ? fonts.sansSemiBold : fonts.sans,
          fontSize: tokens.type.body.fontSize,
          lineHeight: tokens.type.body.lineHeight,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// Posisi pada layar Edit: satu baris TERBACA SAJA, bukan kolom yang
// dinonaktifkan. Kolom nonaktif masih terlihat seperti kolom, dan pemilik akan
// mencoba mengetuknya berkali-kali sebelum menyimpulkan aplikasinya rusak.
// Baris berlatar surfaceSunken tanpa bingkai kolom tidak pernah mengundang
// ketukan.
function LockedPositionRow({ code }: { code: string | null }) {
  return (
    <View
      style={{
        backgroundColor: tokens.color.surface.subtle,
        borderCurve: 'continuous',
        borderRadius: tokens.radius.control,
        justifyContent: 'center',
        minHeight: tokens.layout.fieldHeight,
        paddingHorizontal: spacing.md,
      }}
    >
      <Text selectable style={{ ...tokens.type.body, color: tokens.color.text.secondary }}>
        {code ? `Posisi ${code} · tidak bisa dipindah` : 'Posisi tidak diketahui'}
      </Text>
    </View>
  );
}

// Baris konfirmasi posisi pada layar Tambah.
//
// Kosong dan terisi dibedakan TIGA saluran sekaligus — kata, bentuk penanda,
// dan warna — karena salah membaca baris ini berarti mengisi seluruh form lalu
// ditolak di ujung.
function PositionStatusLine({ status }: { status: { occupied: boolean; code: string } }) {
  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
      <StatusMarker
        color={status.occupied ? palette.statusPerhatian : palette.neutralCell}
        shape={status.occupied ? 'triangle-up' : 'circle-outline'}
      />
      <Text
        selectable
        style={{
          ...tokens.type.bodySmall,
          color: status.occupied ? tokens.color.status.warning.text : tokens.color.text.secondary,
          flex: 1,
        }}
      >
        {status.occupied
          ? `Posisi ${status.code} sudah ada pohonnya. Pilih posisi lain.`
          : `Posisi ${status.code} masih kosong`}
      </Text>
    </View>
  );
}

// Validasi bersama create & edit: tandai semua field wajib yang kosong sekaligus.
//
// Sejak migrasi 054, baris dan kolom punya BENTUK yang wajib: baris angka
// 1-999, kolom tepat satu huruf A-Z. Keduanya cerminan CHECK constraint
// trees_row_position_check dan trees_column_position_check — ditegakkan di sini
// juga supaya pekerja membaca pesan yang masuk akal, bukan balasan Postgres.
//
// Yang TIDAK diperiksa di sini: apakah posisinya muat di ukuran kebun. Itu
// milik trigger validate_tree_position, yang perlu membaca baris farms.
export function validateTreeForm(values: TreeFormValues): TreeFormErrors {
  const errors: TreeFormErrors = {};

  const rowPosition = values.rowPosition.trim();
  const columnPosition = values.columnPosition.trim().toUpperCase();

  if (!rowPosition) {
    errors.rowPosition = 'Baris wajib diisi.';
  } else if (!/^\d+$/.test(rowPosition)) {
    errors.rowPosition = 'Baris harus berupa angka.';
  } else if (Number(rowPosition) < 1 || Number(rowPosition) > 999) {
    errors.rowPosition = 'Baris harus antara 1 dan 999.';
  }

  if (!columnPosition) {
    errors.columnPosition = 'Kolom wajib diisi.';
  } else if (!/^[A-Z]$/.test(columnPosition)) {
    errors.columnPosition = 'Kolom harus satu huruf A sampai Z.';
  }

  if (!values.variety.trim()) {
    errors.variety = 'Varietas wajib diisi.';
  }

  if (!values.plantedAt) {
    errors.plantedAt = 'Tanggal tanam wajib dipilih.';
  }

  return errors;
}

export function hasTreeFormErrors(errors: TreeFormErrors): boolean {
  return Boolean(errors.rowPosition || errors.columnPosition || errors.variety || errors.plantedAt);
}

// Hapus error field yang sudah terisi (dipakai saat nilai berubah); tak pernah
// menambah error baru supaya pesan tidak muncul sambil mengetik.
export function clearResolvedTreeFormErrors(
  errors: TreeFormErrors,
  values: TreeFormValues
): TreeFormErrors {
  if (!hasTreeFormErrors(errors)) {
    return errors;
  }

  return {
    columnPosition: values.columnPosition.trim() ? undefined : errors.columnPosition,
    plantedAt: values.plantedAt ? undefined : errors.plantedAt,
    rowPosition: values.rowPosition.trim() ? undefined : errors.rowPosition,
    variety: values.variety.trim() ? undefined : errors.variety,
  };
}

export function TreeMainPhotoFormSection({
  currentPhotoUrl,
  deleteRequested = false,
  disabled,
  onCameraPress,
  onDeleteExisting,
  onGalleryPress,
  onRemoveSelected,
  onRestoreExisting,
  photo,
  processing = false,
}: TreeMainPhotoFormSectionProps) {
  const previewUri = photo?.uri ?? (deleteRequested ? null : currentPhotoUrl);
  const hasExistingPhoto = Boolean(currentPhotoUrl);
  const canRemove = Boolean(photo || (hasExistingPhoto && !deleteRequested));

  function handleRemovePress() {
    if (photo) {
      onRemoveSelected();
      return;
    }

    onDeleteExisting?.();
  }

  return (
    <View style={{ gap: spacing.md }}>
      {/* `changeHint` DITAMBAHKAN di batch 5, bersama pencabutan tombol silang
          berikon-saja dari <PhotoPickerCard>. "Hapus foto" pindah ke dalam
          sheet, dan baris ini yang memberitahu bahwa sheet itu ada. */}
      <PhotoPickerCard
        changeHint="Ketuk foto untuk mengganti atau menghapusnya."
        choosePhotoLabel="Pilih galeri"
        description={processing ? PHOTO_PROCESSING_MESSAGE : undefined}
        emptyLabel="Tambah foto pohon"
        imageUri={previewUri}
        loading={disabled || processing}
        removeLabel="Hapus foto"
        takePhotoLabel="Ambil foto"
        title="Foto pohon"
        onChoosePhoto={onGalleryPress}
        onRemovePhoto={canRemove ? handleRemovePress : undefined}
        onTakePhoto={onCameraPress}
      />

      {deleteRequested && !photo ? (
        <Text selectable style={{ color: colors.textMuted, lineHeight: tokens.type.bodySmall.lineHeight }}>
          Foto pohon saat ini akan dihapus setelah perubahan disimpan.
        </Text>
      ) : null}

      {deleteRequested && !photo && onRestoreExisting ? (
        <Button disabled={disabled} title="Batalkan hapus foto" variant="secondary" onPress={onRestoreExisting} />
      ) : null}
    </View>
  );
}

function TreeFormSection({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: spacing.xs }}>
        <Text
          selectable
          style={{
            color: colors.text,
            fontSize: tokens.type.subheading.fontSize,
            fontWeight: '700',
            lineHeight: tokens.type.subheading.lineHeight,
          }}
        >
          {title}
        </Text>
        {description ? (
          <Text
            selectable
            style={{
              color: colors.textMuted,
              fontSize: tokens.type.meta.fontSize,
              lineHeight: tokens.type.meta.lineHeight,
            }}
          >
            {description}
          </Text>
        ) : null}
      </View>
      <View style={{ gap: spacing.md }}>{children}</View>
    </View>
  );
}

// Satu-satunya tempat di mana TreeConditionStatus diikat ke tampilannya.
//
// CONDITION_BADGE menggantikan getConditionTone untuk badge ini, dan itu
// memperbaiki penggabungan yang nyata: getConditionTone memetakan
// pest_attacked, disease_indicated, DAN damaged ke satu nada 'danger' yang
// sama, sehingga Hama, Sakit, dan Rusak tampil sebagai chip yang identik
// kecuali labelnya. Sekarang ketiganya punya bentuk sendiri.
//
// getConditionTone sudah DIHAPUS di batch 4b setelah pemanggil terakhirnya
// pergi — lihat catatan di tempatnya dulu berdiri. CONDITION_BADGE kini
// satu-satunya pemetaan kondisi ke rupa di seluruh repo.
export function ConditionStatusBadge({ size, status }: ConditionStatusBadgeProps) {
  const appearance = CONDITION_BADGE[status];

  return (
    <Badge
      appearance={appearance}
      label={formatTreeConditionStatus(status)}
      marker={appearance.shape}
      markerColor={appearance.markerColor}
      maxWidth={180}
      size={size}
    />
  );
}

export function GrowthPhaseBadge({ ageDays, phase }: GrowthPhaseBadgeProps) {
  const tone = getGrowthPhaseTone(phase);
  // Umur digabung HANYA kalau angkanya benar-benar ada. null berarti tanggal
  // fasenya tidak ditemukan di siklus yang sedang berjalan, dan chip-nya jatuh
  // ke nama fase saja — bukan '0 hari', yang akan terbaca sebagai "baru hari
  // ini" padahal artinya "tidak tahu".
  const label =
    typeof ageDays === 'number' ? `${formatGrowthPhase(phase)} · ${ageDays} hari` : formatGrowthPhase(phase);

  // maxWidth naik dari 180: label terpanjang sekarang 'Vegetatif · 365 hari'.
  return <Badge label={label} maxWidth={220} tone={tone} />;
}

export function ConditionReportList({
  conditionPhotoMap = {},
  currentUserId,
  emptySubtitle = 'Laporan kondisi yang dibuat pemilik atau pekerja aktif akan muncul di sini.',
  emptyTitle = 'Belum ada laporan kondisi',
  reports,
  viewerMode = 'owner',
}: ConditionReportListProps) {
  if (reports.length === 0) {
    return <EmptyState title={emptyTitle} subtitle={emptySubtitle} />;
  }

  return (
    <View style={{ gap: 12 }}>
      {reports.map((report) => (
        <ConditionReportItem
          key={report.id}
          photoUrl={conditionPhotoMap[report.id]?.signedUrl}
          currentUserId={currentUserId}
          report={report}
          viewerMode={viewerMode}
        />
      ))}
    </View>
  );
}

export function TreeHistoryTimeline({
  currentUserId,
  history,
  onRecordPress,
  plantings,
  viewerMode = 'owner',
}: TreeHistoryTimelineProps) {
  if (history.length === 0) {
    return (
      <EmptyState
        title="Belum ada riwayat"
        subtitle="Catatan kondisi, fase, hasil panen, dan perawatan akan muncul di sini."
      />
    );
  }

  // SELURUH SIKLUS TANAM DITAMPILKAN, TIDAK DIFILTER KE SIKLUS AKTIF.
  //
  // Spek §15 menulis "timeline kronologis gabungan, difilter siklus tanam
  // aktif", dan bagian itu KELIRU terhadap keputusan yang sudah diambil di
  // revisi Bab 3: penanaman ulang pada satu posisi tidak boleh menghapus jejak
  // pengelolaan sebelumnya. Memfilter ke siklus aktif berarti tiga tahun
  // catatan lenyap dari layar begitu satu pohon diganti — kehilangan data yang
  // terlihat, akibat sebuah filter.
  //
  // Yang berlaku, dan yang dipertahankan di sini: seluruh siklus ditampilkan,
  // dipisah pembatas per siklus, dan siklus lama DIREDUPKAN supaya tetap
  // terbaca mana yang milik pohon yang sekarang.
  //
  // PENEMPATANNYA PERKIRAAN, bukan fakta tersimpan — lihat catatan panjang pada
  // groupTreeHistoryByCycle. Karena itu pembatasnya ditulis sebagai penanda
  // bacaan ("Siklus sebelumnya · rentang tanggal"), bukan sebagai angka yang
  // dipakai menghitung apa pun.
  //
  // Pembatas hanya muncul kalau memang ADA yang dipisahkan. Posisi yang baru
  // sekali ditanami — dan itu keadaan hampir semua pohon — tidak mendapat garis
  // apa pun.
  const cycleGroups = (plantings?.length ?? 0) > 1 ? groupTreeHistoryByCycle(history, plantings ?? []) : [];
  const entries = buildTimelineEntries(history, cycleGroups);
  // Satu baris konteks di atas timeline. Hanya dirender kalau `plantings`
  // benar-benar dioper — pada pratinjau dua baris di layar detail pohon ia
  // sengaja tidak dioper, dan kalimat "Siklus tanam sejak ..." di atas dua baris
  // catatan terbaru akan menjanjikan daftar yang jauh lebih panjang daripada
  // yang sedang ditampilkan.
  const currentCycleLine = plantings ? formatCurrentCycleLine(plantings) : null;

  // KARTU PEMBUNGKUS DICABUT (batch 7b). Yang mengikat baris-baris ini jadi satu
  // benda sekarang adalah REL GARIS 1px yang menembus seluruh kolom penanda —
  // dan rel itu mengerjakannya lebih baik daripada bingkai kartu, karena ia juga
  // menyatakan URUTAN, bukan cuma kebersamaan. Dua pengikat untuk satu daftar
  // berarti satu di antaranya menganggur.
  //
  // Garis rambut antar baris ikut pergi bersama kartunya, dengan alasan yang
  // sama: rel sudah menyambungkan baris-barisnya, dan garis melintang yang
  // memotongnya tiap beberapa puluh piksel justru melawan penyambungan itu.
  return (
    <View style={{ gap: spacing.md }}>
      {currentCycleLine ? (
        <Text selectable style={{ ...tokens.type.meta, color: tokens.color.text.tertiary }}>
          {currentCycleLine}
        </Text>
      ) : null}

      <View>
        {entries.map((entry, index) => {
          if (entry.kind === 'divider') {
            return <TreeCycleDivider key={entry.key} label={entry.label} />;
          }

          // Rel tidak digambar menembus pembatas siklus: pembatasnya adalah
          // GARIS MELINTANG berlabel, dan rel yang menyeberanginya akan
          // mengabarkan kesinambungan yang justru sedang dipotong.
          const previous = entries[index - 1];
          const next = entries[index + 1];

          return (
            <TreeHistoryTimelineItem
              key={entry.key}
              currentUserId={currentUserId}
              dimmed={entry.dimmed}
              item={entry.item}
              railBottom={next?.kind === 'item'}
              railTop={previous?.kind === 'item'}
              viewerMode={viewerMode}
              onRecordPress={onRecordPress}
            />
          );
        })}
      </View>
    </View>
  );
}

// Baris kejadian dan pembatas siklus diratakan jadi SATU daftar berurutan.
//
// Daftar datar, bukan sarang <View> per siklus: tiap unsur perlu tahu apa yang
// mendahului dan mengikutinya untuk memutuskan apakah potongan rel di atas dan
// di bawah penandanya digambar, dan pertanyaan itu jadi sekadar melihat
// entries[index ± 1].
//
// Kedua bentuk masukan bermuara ke sini: tanpa pengelompokan siklus
// (satu-satunya keadaan untuk hampir semua pohon) hasilnya daftar kejadian polos
// tanpa satu pun pembatas.
type TimelineEntry =
  | { dimmed: boolean; item: TreeHistoryItem; key: string; kind: 'item' }
  | { key: string; kind: 'divider'; label: string };

function buildTimelineEntries(
  history: TreeHistoryItem[],
  cycleGroups: ReturnType<typeof groupTreeHistoryByCycle>
): TimelineEntry[] {
  if (cycleGroups.length === 0) {
    return history.map((item, index) => ({
      dimmed: false,
      item,
      key: buildHistoryItemKey(item, index),
      kind: 'item',
    }));
  }

  const entries: TimelineEntry[] = [];

  for (const group of cycleGroups) {
    // Siklus TANPA kejadian tidak mendapat pembatas. Sebuah judul yang tidak
    // memperkenalkan apa pun cuma menambah baris yang harus dilewati — dan
    // siklus yang seluruh catatannya sudah terhapus memang mungkin terjadi.
    if (group.items.length === 0) {
      continue;
    }

    // Pembatas duduk DI ATAS kejadian milik siklusnya, bukan di bawah. Riwayat
    // tersusun menurun (terbaru dulu), jadi membacanya ke bawah berarti mundur
    // ke masa lalu, dan judul yang memperkenalkan sebuah bagian harus berdiri
    // sebelum bagian itu dibaca. Siklus terbaru tidak mendapat pembatas: ia
    // yang sedang berjalan, dan baris konteks di atas timeline sudah menamainya.
    if (!group.isLatestCycle) {
      entries.push({
        key: `divider-${group.planting.id}`,
        kind: 'divider',
        label: formatCycleDividerLabel(group.planting),
      });
    }

    group.items.forEach((item, index) => {
      entries.push({
        // Kejadian milik siklus lama diredupkan supaya terlihat mana yang milik
        // pohon yang sekarang. Judulnya memakai textMuted dan penandanya
        // beropasitas 60% — DUA saluran, bukan satu opacity untuk seluruh baris:
        // meredupkan semuanya sekaligus juga meredupkan tanggal dan label jenis
        // sampai di bawah ambang keterbacaan, sedangkan yang perlu dibedakan
        // hanyalah "ini bukan pohon yang sekarang".
        dimmed: !group.isLatestCycle,
        item,
        key: `${group.planting.id}-${buildHistoryItemKey(item, index)}`,
        kind: 'item',
      });
    });
  }

  return entries;
}

// Pembatas antarsiklus: garis, label huruf besar di tengah, garis.
//
// 12/600 huruf besar `textMuted` (§15). Bentuk yang sama dengan label jenis di
// tiap baris, dan itu disengaja: keduanya menamai KATEGORI dari apa yang ada di
// bawahnya, bukan isinya.
function TreeCycleDivider({ label }: { label: string }) {
  return (
    <View
      style={{
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.md,
        paddingVertical: spacing.lg,
      }}
    >
      <View style={{ backgroundColor: colors.border, flex: 1, height: 1 }} />
      {/* toUpperCase() pada nilainya, bukan textTransform: sebagian Android
          menerapkan textTransform SESUDAH pengukuran teks dan menghasilkan baris
          yang terpotong satu huruf di ujungnya. */}
      <Text
        selectable
        style={{
          color: palette.textMuted,
          fontFamily: fonts.sansSemiBold,
          fontSize: tokens.type.caption.fontSize,
          letterSpacing: 0.6,
          lineHeight: tokens.type.caption.lineHeight,
        }}
      >
        {label.toUpperCase()}
      </Text>
      <View style={{ backgroundColor: colors.border, flex: 1, height: 1 }} />
    </View>
  );
}

export function ConditionReportItem({
  currentUserId,
  photoUrl,
  report,
  viewerMode = 'owner',
}: ConditionReportItemProps & {
  currentUserId?: string | null;
  photoUrl?: string | null;
  viewerMode?: TreeHistoryViewerMode;
}) {
  const reporterName = formatActorDisplayName({
    actorId: report.reportedBy ?? null,
    actorName: report.reportedByName,
    actorRole: report.reportedByRole,
    currentUserId,
    viewerMode,
  });

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
        <ConditionStatusBadge status={report.conditionStatus} />
        <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
          {formatEventDate(report.reportedAt)}
        </Text>
      </View>
      <MetaRow label="Catatan" value={report.note || '-'} />
      {photoUrl ? <PhotoThumbnail photoUrl={photoUrl} /> : null}
      <MetaRow label="Dilaporkan oleh" value={reporterName} />
    </Card>
  );
}

// Lebar kolom tanggal, dan lebar kolom rel. Keduanya angka spek §4: tanggal
// 64, rel selebar penanda 11px yang dipusatkan dengan sisa ruang secukupnya.
const TIMELINE_DATE_WIDTH = 64;
const TIMELINE_RAIL_WIDTH = 20;

// Peredupan kejadian milik siklus lama, pada PENANDANYA saja. Judulnya
// diredupkan lewat warna teks (textMuted), bukan lewat opacity yang sama —
// lihat catatan pada `dimmed` di buildTimelineEntries.
const PAST_CYCLE_MARKER_OPACITY = 0.6;

// SATU BENTUK BARIS, EMPAT PEMBEDA (§4):
//
//   1. Kolom tanggal 64px di kiri.
//   2. Rel garis 1px di tengah, dengan penanda bentuk 11px.
//   3. Isi di kanan.
//   4. Label jenis 12/600 huruf besar di atas judulnya.
//
// Panen mendapat pembeda kelima: beratnya dicetak sebagai ANGKA SERIF 28,
// menggantikan judul biasa. Ia satu-satunya jenis catatan yang nilainya berupa
// angka yang dibandingkan antarpanen, dan angka yang dibandingkan pantas
// dibaca tanpa harus dieja dari dalam kalimat.
//
// CAKRAM DI BELAKANG PENANDA DICABUT. Perbaikan sementara di batch 5 membuatnya
// netral untuk semua jenis supaya ia berhenti berbohong (lingkaran "Sehat" di
// atas cakram ambar); sekarang ia hilang seluruhnya, diganti rel garis 1px.
function TreeHistoryTimelineItem({
  currentUserId,
  dimmed = false,
  item,
  onRecordPress,
  railBottom = false,
  railTop = false,
  viewerMode,
}: {
  currentUserId?: string | null;
  dimmed?: boolean;
  item: TreeHistoryItem;
  onRecordPress?: (item: TreeHistoryItem, recordType: TreeHistoryRouteRecordType) => void;
  railBottom?: boolean;
  railTop?: boolean;
  viewerMode: TreeHistoryViewerMode;
}) {
  const routeRecordType = getRouteRecordType(item);
  const canOpenRecord = Boolean(item.sourceId && routeRecordType && onRecordPress);
  const actorName = formatActorDisplayName({
    actorId: item.actorId,
    actorName: item.actorName,
    actorRole: item.actorRole,
    currentUserId,
    viewerMode,
  });
  // Berat panen sebagai angka tunggal ('21 kg' atau '12 buah'), BUKAN ruas
  // lengkap 'Jumlah buah: 12, Berat: 21 kg' yang dipakai judul biasa. Aturannya
  // milik formatHarvestFactValue: berat kalau ada, kalau tidak jumlah buah,
  // tidak pernah keduanya — angka serif 28 hanya muat untuk satu nilai.
  //
  // null berarti bentuk kalimatnya di luar dugaan, dan barisnya jatuh ke judul
  // biasa alih-alih mencetak kalimat panjang dengan ukuran 28.
  const harvestValue =
    item.historyType === 'harvest' ? formatHarvestFactValue(item.description) : null;
  const titleColor = dimmed ? palette.textMuted : colors.text;

  const content = (
    <>
      {/* KOLOM TANGGAL, lebar tetap 64. Tetap, bukan menyesuaikan isi: yang
          membuat kolom ini berguna adalah tanggalnya berakhir di garis yang
          SAMA pada setiap baris, sehingga mata bisa menyusurinya ke bawah tanpa
          membaca. */}
      <Text
        selectable
        style={{
          color: palette.textMuted,
          fontFamily: fonts.sans,
          fontSize: typography.meta.fontSize,
          lineHeight: typography.meta.lineHeight,
          width: TIMELINE_DATE_WIDTH,
        }}
      >
        {formatHistoryRowDate(item.happenedAt)}
      </Text>

      <View style={{ alignItems: 'center', width: TIMELINE_RAIL_WIDTH }}>
        {/* Potongan rel di ATAS penanda. Tingginya TETAP, bukan flex: ia yang
            menentukan di ketinggian berapa penanda duduk, dan penanda semua
            baris harus duduk pada ketinggian yang SAMA — sejajar dengan baris
            pertama isinya, bukan mengambang di tengah isi yang tingginya
            berubah-ubah mengikuti panjang judul.

            4 bukan angka yang dikarang: label jenis (12/16) dan tanggal (13/18)
            sama-sama berpusat sekitar 8-9px dari tepi atas baris, dan penanda
            11px yang pusatnya di sana berarti tepi atasnya di ~3,5. */}
        <View
          style={{
            backgroundColor: railTop ? tokens.color.line.hairline : 'transparent',
            height: spacing.xs,
            width: 1,
          }}
        />
        <View style={{ opacity: dimmed ? PAST_CYCLE_MARKER_OPACITY : 1 }}>
          <TimelineMarker item={item} />
        </View>
        {/* Potongan rel di BAWAH penanda melar mengisi sisa tinggi baris. */}
        <View
          style={{
            backgroundColor: railBottom ? tokens.color.line.hairline : 'transparent',
            flex: 1,
            width: 1,
          }}
        />
      </View>

      <View style={{ flex: 1, gap: 2, minWidth: 0, paddingBottom: spacing.lg }}>
        {/* LABEL JENIS, 12/600 huruf besar. Menggantikan kata pertama baris meta
            yang dulu berbunyi 'Kondisi · Anda'. Sebagai label di ATAS judul ia
            mengerjakan hal yang sama dengan lebih sedikit: jenisnya terbaca
            sebelum isinya, bukan sesudah. */}
        <Text
          selectable
          style={{
            color: palette.textMuted,
            fontFamily: fonts.sansSemiBold,
            fontSize: tokens.type.caption.fontSize,
            letterSpacing: 0.6,
            lineHeight: tokens.type.caption.lineHeight,
          }}
        >
          {formatHistoryKindLabel(item).toUpperCase()}
        </Text>

        {harvestValue ? (
          <Text
            selectable
            numberOfLines={1}
            style={{ color: titleColor, fontFamily: fonts.serif, fontSize: 28, lineHeight: 34 }}
          >
            {harvestValue}
          </Text>
        ) : (
          /* Judulnya ISI catatannya sendiri, bukan nama kategorinya — kategori
             sudah dibawa label di atasnya. numberOfLines 2 supaya nama jadwal
             yang panjang tidak mendorong isi lain keluar layar, tanpa
             memotongnya sedini satu baris. */
          <Text
            numberOfLines={2}
            selectable
            style={{
              color: titleColor,
              fontFamily: fonts.sansSemiBold,
              fontSize: typography.bodyStrong.fontSize,
              lineHeight: typography.bodyStrong.lineHeight,
            }}
          >
            {formatHistoryRowTitle(item)}
          </Text>
        )}

        <Text
          selectable
          style={{
            color: palette.textMuted,
            fontFamily: fonts.sans,
            fontSize: typography.meta.fontSize,
            lineHeight: typography.meta.lineHeight,
          }}
        >
          {actorName}
        </Text>
      </View>

      {/* Chevron WAJIB ADA di baris yang bisa dibuka. Sejak kartunya dicabut, ia
          satu-satunya isyarat "bisa ditekan" yang muncul SEBELUM disentuh — dan
          pembacanya pekerja lanjut usia dengan literasi teknologi rendah.
          Disejajarkan dengan baris pertama isinya lewat paddingTop, bukan ke
          tengah baris yang tingginya berubah-ubah. */}
      {canOpenRecord ? (
        <View style={{ flexShrink: 0, paddingTop: spacing.sm }}>
          <ChevronRightIcon color={colors.textSoft} size={20} />
        </View>
      ) : null}
    </>
  );

  const rowStyle = {
    flexDirection: 'row' as const,
    gap: spacing.sm,
  };

  if (canOpenRecord && routeRecordType) {
    return (
      <Pressable
        accessibilityHint="Buka detail catatan"
        accessibilityRole="button"
        onPress={() => onRecordPress?.(item, routeRecordType)}
        style={({ pressed }) => ({
          ...rowStyle,
          backgroundColor: pressed ? tokens.color.surface.subtle : 'transparent',
        })}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={rowStyle}>{content}</View>;
}

// PENANDA BARIS TIMELINE, satu bentuk per jenis catatan (§4):
//
//   Kondisi   -> bentuk menurut STATUSNYA, dibaca dari CONDITION_BADGE.
//   Fase      -> belah ketupat, markerFase.
//   Perawatan -> kotak, markerPerawatan.
//   Panen     -> lingkaran, markerPanen (= accent).
//
// Baris kondisi MEMBACA CONDITION_BADGE, bukan memetakan sendiri kondisi ke
// rupanya. Tabel itu sudah melayani badge kondisi, sel denah, dan baris daftar
// pohon; pemetaan kedua di sini berarti dua sumber untuk satu pertanyaan, dan
// dua sumber selalu berakhir menyimpang — persis yang pernah terjadi sebelum
// batch 5, saat setiap baris kondisi mendapat segitiga ambar apa pun kondisinya
// sehingga baris "Sehat" tampil dengan penanda "perlu perhatian".
//
// markerPerawatan dan markerFase SENGAJA bukan warna status: jenis catatan bukan
// masalah, dan aturan warna yang mengikat menyimpan warna status untuk masalah.
// Keduanya rona netral yang berbeda gelapnya, dan yang membedakannya BENTUK.
//
// item.title pada baris kondisi berisi nilai enum mentah ('healthy',
// 'needs_attention', ...) — lihat tree_history_view, yang menaruh
// tcr.condition_status::text di kolom title. isTreeConditionStatus yang
// menjaganya; kalau bentuknya ternyata lain, baris itu jatuh ke lingkaran netral
// alih-alih menabrak indeks yang tidak ada.
function TimelineMarker({ item }: { item: TreeHistoryItem }) {
  if (item.historyType === 'condition') {
    if (isTreeConditionStatus(item.title)) {
      const visual = CONDITION_BADGE[item.title];

      return <StatusMarker color={visual.markerColor} shape={visual.shape} />;
    }

    return <StatusMarker color={palette.textMuted} shape="circle-filled" />;
  }

  if (item.historyType === 'phase') {
    return <StatusMarker color={palette.markerFase} shape="diamond" />;
  }

  if (item.historyType === 'harvest') {
    return <StatusMarker color={palette.markerPanen} shape="circle-filled" />;
  }

  return <StatusMarker color={palette.markerPerawatan} shape="square" />;
}

// Judul baris riwayat: ISI catatannya, bukan nama jenisnya.
//
// Jenisnya sudah dibawa dua saluran lain — ikon berwarna di kiri dan kata
// pertama baris meta — jadi mengulanginya sebagai judul membuat baris terbaca
// "Kondisi / Kondisi · Anda" dan menyisakan nol tempat untuk hal yang benar-benar
// membedakan satu kejadian dari kejadian lain.
// DIEKSPOR sejak batch 4b. Layar detail pohon memakainya untuk baris "Panen
// terakhir", dan menyalin aturannya ke sana berarti dua tempat yang bisa
// menyebut kejadian yang sama dengan kata berbeda — persis selisih yang paling
// lama tidak ketahuan, karena keduanya jarang dilihat berdampingan.
export function formatHistoryRowTitle(item: TreeHistoryItem): string {
  if (item.historyType === 'condition' && isTreeConditionStatus(item.title)) {
    return formatTreeConditionStatus(item.title);
  }

  if (item.historyType === 'phase' && isGrowthPhase(item.title)) {
    return formatGrowthPhase(item.title);
  }

  if (item.historyType === 'harvest') {
    return formatHarvestAmountSummary(item.description) ?? item.title;
  }

  if (item.historyType === 'care') {
    // TERJADWAL: view menaruh judul tugas induknya di `title`
    // (coalesce(ct.title, 'Perawatan inisiatif'), migrasi 045:272), jadi nama
    // jadwalnya sudah ada di sana tanpa perlu diolah.
    if (item.asal === 'terjadwal') {
      return item.title;
    }

    // INISIATIF: kategorinya kini datang dari kolomnya SENDIRI.
    //
    // Sebelum migrasi 065 kategori hanya sampai ke sini lewat `description`, dan
    // hanya kalau catatannya kosong — view memilih salah satu dari keduanya
    // (coalesce(nullif(trim(ca.note),''), ca.category::text), 045:273). Begitu
    // pekerja menulis catatan, kategorinya hilang sama sekali. Kolom `kategori`
    // (065) membawanya terpisah, jadi keduanya bisa hadir bersama.
    if (isCareCategory(item.kategori)) {
      const kategori = formatCareCategory(item.kategori);
      const produk = item.produk?.trim();

      // 'Penyemprotan · Decis 25 EC'. Produk digabung ke JUDUL, bukan
      // dibiarkan di deskripsi seperti dulu: baris riwayat tidak punya baris
      // deskripsi lagi, dan bahan yang dipakai adalah hal kedua yang paling
      // sering dicari pemilik setelah jenis perawatannya.
      return produk ? `${kategori} · ${produk}` : kategori;
    }

    // Kategori kosong. Bisa terjadi pada baris lama: care_activities.category
    // nullable (025:16). Jatuh ke perilaku sebelumnya apa adanya — termasuk
    // cabang description-berisi-kategori, yang masih benar untuk baris yang
    // dicatat tanpa catatan sebelum 065.
    if (isCareCategory(item.description)) {
      return formatCareCategory(item.description);
    }

    return item.description?.trim() || item.title;
  }

  return item.title;
}

// Ruas ANGKA dari description panen, mis. 'Jumlah buah: 12, Berat: 5 kg'.
//
// Angka panen TIDAK punya kolomnya sendiri di tree_history_view — view merakit
// keempat bagiannya jadi satu kalimat (migrasi 045:282-318):
//   concat_ws('. ', <angka>, 'Kondisi: ...', 'Catatan: ...')
// dengan <angka> = concat_ws(', ', 'Jumlah buah: N', 'Berat: X kg').
// Jadi ruas sebelum '. ' yang pertama selalu ruas angkanya, dan constraint
// harvest_records_amount_present_check (045:86, tervalidasi penuh) menjamin
// setidaknya satu dari jumlah/berat terisi — ruas itu tidak pernah kosong.
//
// Beratnya sudah dirapikan di SQL ('12.00' jadi '12'), jadi titik desimal yang
// tersisa tidak pernah diikuti spasi dan tidak bisa tertukar dengan pemisah ruas.
//
// PENJAGA di bawah bukan basa-basi: ia yang membuat fungsi ini gagal dengan
// tenang — mengembalikan null supaya pemanggilnya jatuh ke item.title — kalau
// bentuk kalimatnya ternyata lain, alih-alih menampilkan 'Catatan: ...' sebagai
// judul yang seolah-olah angka.
function formatHarvestAmountSummary(description: string | null): string | null {
  const amount = description?.split('. ')[0]?.trim();

  if (!amount) {
    return null;
  }

  if (!amount.startsWith('Jumlah buah:') && !amount.startsWith('Berat:')) {
    return null;
  }

  return amount;
}

// SATU nilai panen, untuk baris fakta "Panen terakhir" di layar detail pohon.
//
// BERBEDA dari formatHarvestAmountSummary di atas, dan perbedaannya disengaja:
// yang di atas mengembalikan ruas angka APA ADANYA ('Jumlah buah: 12, Berat: 21
// kg') untuk baris timeline, yang punya lebar penuh dan memang menampilkan
// selengkap-lengkapnya. Baris fakta hanya punya sisa lebar setelah labelnya,
// dan dua nilai berlabel di sana membungkus jadi dua baris.
//
// ATURANNYA: berat kalau ada, kalau tidak jumlah buah. TIDAK PERNAH keduanya.
//
// Berat didahulukan karena ia yang dipakai menjual — dan karena ia satu-satunya
// dari keduanya yang bisa dijumlahkan antarpanen tanpa berbohong (berat alpukat
// terlalu bervariasi untuk dikonversi dari jumlah; lihat catatan kolom
// harvest_weight_kg di migrasi 045).
//
// TIDAK ADA TEBAKAN DI SINI. Bentuk kalimatnya dirakit view tree_history_view
// (045:282-318) dengan label harfiah 'Jumlah buah: ' dan 'Berat: ', dan
// constraint harvest_records_amount_present_check menjamin setidaknya satu
// terisi. Jadi mana berat dan mana jumlah dibaca dari labelnya sendiri, bukan
// disimpulkan dari bentuk angkanya.
//
// Awalan labelnya DIBUANG dari keluaran: baris nilai tidak mengulang label yang
// sudah berdiri di sisi kiri barisnya. Satuan 'kg' ikut karena ia bagian dari
// nilainya; untuk jumlah buah, 'buah' DITAMBAHKAN — angka telanjang di sebelah
// tanggal terbaca sebagai angka apa saja.
export function formatHarvestFactValue(description: string | null): string | null {
  const amount = formatHarvestAmountSummary(description);

  if (!amount) {
    return null;
  }

  const weight = /Berat:\s*([^,]+)/.exec(amount)?.[1]?.trim();

  if (weight) {
    return weight;
  }

  const fruitCount = /Jumlah buah:\s*([^,]+)/.exec(amount)?.[1]?.trim();

  return fruitCount ? `${fruitCount} buah` : null;
}

// Kata pertama baris meta. Untuk perawatan yang dipakai ASALNYA
// ('Terjadwal'/'Inisiatif'), bukan kata 'Perawatan': asal adalah satu-satunya
// hal yang membedakan dua baris perawatan dari sisi pembacanya, sedangkan
// 'Perawatan' sudah dibawa ikon semprotnya. Perawatan tanpa asal — nilai lama
// dari sebelum kolom asal ada — jatuh ke label jenis biasa.
function formatHistoryKindLabel(item: TreeHistoryItem): string {
  if (item.historyType === 'care') {
    return formatCareOrigin(item.asal) ?? formatHistoryType(item.historyType);
  }

  return formatHistoryType(item.historyType);
}

// '28 Agu' untuk tahun berjalan, '28 Agu 2025' untuk tahun lain.
//
// TANPA JAM, dan itu disengaja. happened_at memang bertipe timestamptz, tapi
// seluruh jalur tulis kecuali complete_task mengirim tanggal saja yang di-cast
// jadi tengah malam — jamnya karena itu konstan dan bukan waktu pencatatan.
// Mencetaknya berarti memberi angka presisi kepada data yang tidak punya.
//
// happened_at dinormalkan ke tanggal WIB lebih dulu: formatShortDate dan
// formatFullDate bekerja pada 'YYYY-MM-DD' murni dan akan mengembalikan string
// mentahnya kalau diberi timestamptz.
// Diekspor bersama formatHistoryRowTitle, dan dengan alasan yang sama.
export function formatHistoryRowDate(value: string, todayIso: string = getTodayIsoDate()): string {
  const iso = toWibIsoDate(value);

  if (!iso) {
    return '';
  }

  return iso.slice(0, 4) === todayIso.slice(0, 4) ? formatShortDate(iso) : formatFullDate(iso);
}

function PhotoThumbnailRow({ photoUrls }: { photoUrls: string[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {photoUrls.map((photoUrl) => (
        <PhotoThumbnail key={photoUrl} photoUrl={photoUrl} />
      ))}
    </View>
  );
}

function PhotoThumbnail({ photoUrl }: { photoUrl: string }) {
  const [imageFailed, setImageFailed] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  React.useEffect(() => {
    setImageFailed(false);
  }, [photoUrl]);

  // Signed URL foto berumur 10 menit, jadi kegagalan muat adalah kejadian biasa
  // pada layar yang dibiarkan terbuka.
  //
  // Kegagalan mengganti THUMBNAIL-nya saja, tidak menghentikan render. Dua hal
  // pernah salah di sini dan keduanya sudah diperbaiki: dulu cabang ini me-render
  // null sehingga thumbnail lenyap tanpa jejak, lalu setelah itu ia early-return
  // sehingga viewer ikut ter-unmount dan menutup sendiri di tengah gerakan
  // pengguna. Sejak ada cubit-zoom orang memandangi satu foto jauh lebih lama
  // daripada umur URL-nya, jadi viewer harus tetap berdiri sampai pengguna
  // sendiri yang menutupnya.
  //
  // Kotak placeholder sengaja memakai ukuran thumbnail yang sama (84x112) supaya
  // tata letak di sekitarnya tidak bergeser, dan TIDAK bisa ditap: membuka viewer
  // untuk gambar yang gagal dimuat hanya menghasilkan layar kosong.
  return (
    <>
      {imageFailed ? (
        <View
          style={{
            alignItems: 'center',
            alignSelf: 'flex-start',
            backgroundColor: colors.photoPlaceholder,
            borderColor: colors.border,
            borderCurve: 'continuous',
            borderRadius: radius.md,
            borderWidth: 1,
            height: 84,
            justifyContent: 'center',
            padding: spacing.xs,
            width: 112,
          }}
        >
          <Text
            selectable
            style={{
              color: colors.textMuted,
              lineHeight: typography.small.lineHeight,
              textAlign: 'center',
            }}
          >
            Foto belum dapat dimuat.
          </Text>
        </View>
      ) : (
        <Pressable
          accessibilityRole="imagebutton"
          onPress={() => setPreviewOpen(true)}
          style={{
            alignSelf: 'flex-start',
            borderColor: colors.border,
            borderCurve: 'continuous',
            borderRadius: radius.md,
            borderWidth: 1,
            overflow: 'hidden',
          }}
        >
          <Image
            onError={() => setImageFailed(true)}
            resizeMode="cover"
            source={{ uri: photoUrl }}
            style={{ height: 84, width: 112 }}
          />
        </Pressable>
      )}
      <PhotoViewerModal
        onClose={() => setPreviewOpen(false)}
        photoUrl={photoUrl}
        visible={previewOpen}
      />
    </>
  );
}

// getTimelineDotColor, getTimelineTextColor, dan getTimelineIcon DICABUT di
// batch 7b. Ketiganya melayani cakram berlatar di belakang penanda baris
// riwayat; cakramnya hilang bersama pembungkus Card, dan penanda barisnya kini
// dirakit TimelineMarker di atas. Tidak ada pemanggil lain di luar timeline itu.

type BadgeTone = 'danger' | 'muted' | 'success' | 'warning';

function formatActorDisplayName({
  actorId,
  actorName,
  actorRole,
  currentUserId,
  viewerMode,
}: {
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: MemberRole | null;
  currentUserId?: string | null;
  viewerMode: TreeHistoryViewerMode;
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

  void viewerMode;
  return 'Anggota kebun';
}

// getConditionTone DIHAPUS di batch 4b.
//
// Ia pemetaan KEDUA dari kondisi pohon ke rupanya, di samping CONDITION_BADGE —
// dan ia memetakan pest_attacked, disease_indicated, DAN damaged ke satu nada
// 'danger' yang sama, sehingga ketiganya tidak bisa dibedakan. Pemanggil
// terakhirnya (baris daftar pohon) pindah ke <ConditionStatusBadge> di batch
// 4a, dan sejak itu ia tidak pernah dipanggil lagi.
//
// Dibiarkan hidup, ia justru berbahaya: pemetaan kedua yang tidak dirender
// siapa pun adalah pemetaan yang akan menyimpang dari CONDITION_BADGE tanpa ada
// yang tahu, lalu dipakai lagi suatu hari karena namanya terdengar benar.
// Persis begitu baris timeline kondisi berakhir bersegitiga ambar untuk pohon
// sehat — satu pemetaan yang lupa diperbarui.

function getGrowthPhaseTone(phase: GrowthPhase): BadgeTone {
  if (phase === 'flowering') {
    return 'warning';
  }

  if (phase === 'fruiting') {
    return 'success';
  }

  return 'muted';
}

function getHistoryTone(type: TreeHistoryType): BadgeTone {
  if (type === 'condition') {
    return 'warning';
  }

  if (type === 'phase' || type === 'harvest') {
    return 'success';
  }

  return 'muted';
}

function getRouteRecordType(item: TreeHistoryItem): TreeHistoryRouteRecordType | null {
  if (item.historyType === 'condition') {
    return 'condition';
  }

  if (item.historyType === 'phase') {
    return 'phase';
  }

  if (item.historyType === 'harvest') {
    return 'harvest';
  }

  // 'care' punya layar detail READ-ONLY (US-14 / Iterasi C): bisa dibuka untuk
  // dilihat, tapi tetap tidak bisa diedit/dihapus (lihat migrasi 027).
  if (item.historyType === 'care') {
    return 'care';
  }

  return null;
}

function buildHistoryItemKey(item: TreeHistoryItem, index: number): string {
  const stableId = item.sourceId ?? item.happenedAt ?? item.title;
  return `${item.historyType}-${stableId}-${index}`;
}

function getHistoryActorPrefix(type: TreeHistoryType): string {
  if (type === 'harvest') {
    return 'Dipanen oleh';
  }

  return 'Dicatat oleh';
}

function formatHistoryType(type: TreeHistoryType): string {
  if (type === 'condition') {
    return 'Kondisi';
  }

  if (type === 'phase') {
    return 'Fase';
  }

  if (type === 'harvest') {
    return 'Panen';
  }

  return 'Perawatan';
}

function formatCareOrigin(asal?: CareActivityOrigin | null): string | null {
  if (asal === 'terjadwal') {
    return 'Terjadwal';
  }

  if (asal === 'inisiatif') {
    return 'Inisiatif';
  }

  return null;
}

function formatHistoryTitle(item: TreeHistoryItem): string {
  if (item.historyType === 'condition' && isTreeConditionStatus(item.title)) {
    return formatTreeConditionStatus(item.title);
  }

  if (item.historyType === 'phase' && isGrowthPhase(item.title)) {
    return formatGrowthPhase(item.title);
  }

  return item.title;
}

function formatHistoryDescription(item: TreeHistoryItem): string | null {
  if (item.historyType !== 'care') {
    return item.description;
  }

  // Catatan inisiatif tanpa note jatuh ke kategori mentah dari view
  // (mis. 'watering'), jadi diterjemahkan ke label Indonesia di sini.
  const base = isCareCategory(item.description)
    ? formatCareCategory(item.description)
    : item.description;

  // RF-12: produk/merek tampil inline di baris deskripsi, mis. "Semprot · Decis 25 EC".
  // Tanpa produk cukup tampilkan base; jangan sampai ada pemisah menggantung/"null".
  const produk = item.produk?.trim() ? item.produk.trim() : null;

  if (base && produk) {
    return `${base} · ${produk}`;
  }

  return base ?? produk;
}

function isCareCategory(value?: string | null): value is CareCategory {
  return (
    value === 'watering' ||
    value === 'fertilizing' ||
    value === 'spraying' ||
    value === 'weeding' ||
    value === 'other'
  );
}

// formatCompactConditionStatus dan formatCompactGrowthPhase DICABUT. Keduanya
// adalah daftar label ketiga dan keempat; sejak displayFormat.ts memakai bentuk
// pendek, isinya sudah identik dan menyimpannya hanya menyediakan tempat untuk
// menyimpang lagi. Badge dan judul linimasa sekarang memanggil formatter
// bersama yang sama dengan peta dan layar pencatatan.

function isTreeConditionStatus(value: string): value is TreeConditionStatus {
  return [
    'healthy',
    'needs_attention',
    'pest_attacked',
    'disease_indicated',
    'damaged',
    'dead',
  ].includes(value);
}

function isGrowthPhase(value: string): value is GrowthPhase {
  return [
    'initial_planting',
    'vegetative',
    'flowering',
    'fruiting',
    'harvesting',
  ].includes(value);
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

export function formatDateForDb(date: Date | null): string {
  if (!date) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDbDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, monthIndex, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}
