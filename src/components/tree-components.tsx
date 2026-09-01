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
import { formatCycleDividerLabel, groupTreeHistoryByCycle } from '../utils/treeCycle';
import {
  buildTreeDisplayCode,
  formatGrowthPhase,
  formatTreeAge,
  formatTreeConditionStatus,
  formatTreeDisplayCode,
} from '../utils/treeFormat';
import { PhotoViewerModal } from './media';
import {
  Badge,
  badgeColors,
  Button,
  Card,
  DateField,
  EmptyState,
  Field,
  MetaRow,
  PhotoPickerCard,
} from './ui';
import {
  AlertTriangleIcon,
  BasketIcon,
  ChevronRightIcon,
  FlowerIcon,
  Icon,
  SprayIcon,
  type IconName,
} from './icons';

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
};

export type TreeFormErrors = {
  columnPosition?: string;
  plantedAt?: string;
  rowPosition?: string;
  variety?: string;
};

export type TreeFormProps = {
  errors?: TreeFormErrors;
  values: TreeFormValues;
  onChange: (values: TreeFormValues) => void;
};

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
const TREE_ROW_THUMBNAIL = 72;
const TREE_ROW_MIN_HEIGHT = 96;

// Record atas SELURUH nilai enum, bukan objek biasa — kalau tree_condition_status
// bertambah nilai, berkas ini gagal typecheck alih-alih diam-diam merender baris
// tanpa ikon.
const CONDITION_ICONS: Record<TreeConditionStatus, IconName> = {
  healthy: 'check',
  needs_attention: 'alert-triangle',
  pest_attacked: 'alert-triangle',
  disease_indicated: 'alert-triangle',
  damaged: 'alert-triangle',
  dead: 'x',
};

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

// Cukup redup untuk terbaca sebagai lapisan kedua, masih cukup pekat untuk
// dibaca — kejadian siklus lama tetap harus bisa dibuka dan dibaca isinya.
const PAST_CYCLE_OPACITY = 0.55;

export function TreeCard({ children, onPress, photoUrl, tree }: TreeCardProps) {
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
  const conditionColor = badgeColors[getConditionTone(tree.currentCondition)].text;

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
          style={{ ...tokens.type.subheading, color: tokens.color.text.primary }}
        >
          {displayCode}
        </Text>
        <Text
          selectable
          numberOfLines={1}
          style={{ ...tokens.type.meta, color: tokens.color.text.secondary }}
        >
          {metaText}
        </Text>
        {children}
      </View>

      {/* flexShrink 0: kondisi adalah alasan utama baris ini dipindai, jadi teks
          di kolom tengah yang terpotong duluan saat ruang sempit. maxWidth
          menahannya tetap satu kolom sempit — label terpanjang ('Perhatian')
          muat, dan tidak ada kondisi yang bisa melebar melewatinya. */}
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          flexShrink: 0,
          gap: tokens.space.xs,
          maxWidth: 110,
        }}
      >
        <Icon name={CONDITION_ICONS[tree.currentCondition]} size={tokens.icon.sm} color={conditionColor} />
        <Text
          selectable={false}
          numberOfLines={1}
          style={{ ...tokens.type.caption, color: conditionColor }}
        >
          {formatTreeConditionStatus(tree.currentCondition)}
        </Text>
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
export function TreeForm({ errors, onChange, values }: TreeFormProps) {
  const previewCode = buildTreeDisplayCode(values);

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

  return (
    <View style={{ gap: spacing['2xl'] }}>
      <TreeFormSection
        title="Identitas Pohon"
        description="Kode pohon otomatis dari baris dan kolom."
      >
        <View
          style={{
            backgroundColor: colors.primarySoft,
            borderColor: colors.primaryBorder,
            borderCurve: 'continuous',
            borderRadius: radius.lg,
            borderWidth: 1,
            gap: spacing.xs,
            padding: spacing.md,
          }}
        >
          <Text selectable style={{ color: colors.textMuted, fontSize: tokens.type.meta.fontSize, fontWeight: '700' }}>
            Kode pohon otomatis
          </Text>
          <Text
            selectable
            style={{
              color: previewCode ? colors.primary : colors.textSoft,
              fontSize: tokens.type.title.fontSize,
              fontWeight: '700',
            }}
          >
            {previewCode ?? 'Lengkapi baris & kolom'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Field
              error={errors?.rowPosition}
              label="Baris *"
              onChangeText={(value) => updateTextValue('rowPosition', value)}
              placeholder="1"
              value={values.rowPosition}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              error={errors?.columnPosition}
              label="Kolom *"
              onChangeText={(value) => updateTextValue('columnPosition', value)}
              placeholder="A"
              value={values.columnPosition}
            />
          </View>
        </View>
        <Field
          error={errors?.variety}
          label="Varietas *"
          onChangeText={(value) => updateTextValue('variety', value)}
          placeholder="Contoh: Alpukat mentega"
          value={values.variety}
        />
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
      <PhotoPickerCard
        choosePhotoLabel="Pilih Galeri"
        description={processing ? PHOTO_PROCESSING_MESSAGE : undefined}
        emptyLabel="Tambah foto pohon"
        imageUri={previewUri}
        loading={disabled || processing}
        removeLabel="Hapus Foto"
        takePhotoLabel="Ambil Foto"
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
        <Button disabled={disabled} title="Batalkan Hapus Foto" variant="secondary" onPress={onRestoreExisting} />
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

export function ConditionStatusBadge({ size, status }: ConditionStatusBadgeProps) {
  const tone = getConditionTone(status);

  return <Badge label={formatTreeConditionStatus(status)} maxWidth={180} size={size} tone={tone} />;
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

  // Pembatas hanya muncul kalau memang ADA yang dipisahkan. Posisi yang baru
  // sekali ditanami — dan itu keadaan hampir semua pohon — tidak mendapat garis
  // apa pun, karena satu pembatas tunggal di dasar riwayat tidak memberi tahu
  // pembacanya hal baru dan cuma menambah baris yang harus dilewati.
  const cycleGroups = (plantings?.length ?? 0) > 1 ? groupTreeHistoryByCycle(history, plantings ?? []) : [];
  const entries = buildTimelineEntries(history, cycleGroups);

  // SATU kartu, bukan satu kartu per kejadian.
  //
  // Sebelumnya tiap kejadian duduk dalam kartunya sendiri: bingkai, sudut
  // membulat, dan jarak di antaranya. Pada pohon dengan riwayat panjang itu
  // menghasilkan tumpukan kotak yang tiap kotaknya membayar ~2px bingkai dan
  // 12px jarak untuk memisahkan hal-hal yang memang sudah berurutan. Sebagai
  // baris di dalam satu kartu, pemisahnya cukup garis rambut selebar kartu dan
  // satu layar memuat jauh lebih banyak kejadian.
  //
  // padding 0 + gap 0 lewat prop dan style: Card bawaannya memberi padding 16
  // dan gap 12 kepada anak-anaknya, dan keduanya harus pergi supaya baris bisa
  // menempel satu sama lain serta garis rambutnya mencapai tepi kartu. Padding
  // horizontalnya dipindah ke tiap baris (lihat TIMELINE_ROW_PADDING_X).
  return (
    <Card padding={0} style={{ gap: 0, overflow: 'hidden' }}>
      {entries.map((entry, index) => {
        // Garis rambut HANYA di antara dua baris kejadian. Pembatas siklus sudah
        // berupa garis, jadi menaruh garis rambut menempel padanya menghasilkan
        // dua garis sejajar yang memisahkan hal yang sama.
        const previous = entries[index - 1];
        const showHairline = Boolean(previous) && previous.kind === 'item' && entry.kind === 'item';

        if (entry.kind === 'divider') {
          return (
            <View key={entry.key} style={{ paddingHorizontal: TIMELINE_ROW_PADDING_X }}>
              <TreeCycleDivider label={entry.label} />
            </View>
          );
        }

        return (
          <TreeHistoryTimelineItem
            key={entry.key}
            currentUserId={currentUserId}
            dimmed={entry.dimmed}
            item={entry.item}
            onRecordPress={onRecordPress}
            showHairline={showHairline}
            viewerMode={viewerMode}
          />
        );
      })}
    </Card>
  );
}

// Baris kejadian dan pembatas siklus diratakan jadi SATU daftar berurutan.
//
// Alasannya bentuk kartunya: seluruh riwayat kini tinggal di dalam satu kartu,
// jadi tidak ada lagi tempat untuk sarang <View> per siklus — dan garis rambut
// antar-baris hanya bisa diputuskan kalau tiap unsur tahu apa yang mendahuluinya.
// Daftar datar membuat pertanyaan itu sekadar melihat entries[index - 1].
//
// Kedua bentuk masukan bermuara ke sini: tanpa pengelompokan siklus (satu-satunya
// keadaan untuk hampir semua pohon) hasilnya daftar kejadian polos tanpa satu pun
// pembatas, persis seperti cabang terpisah yang dulu ada.
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
    group.items.forEach((item, index) => {
      entries.push({
        // Kejadian milik siklus lama diredupkan supaya terlihat mana yang milik
        // pohon yang sekarang. Lewat opacity, bukan warna teks pengganti: satu
        // nilai meredupkan seluruh isi baris sekaligus — ikon, judul, dan meta
        // ikut — tanpa memaksa setiap teks di dalamnya punya varian warna kedua.
        dimmed: !group.isLatestCycle,
        item,
        key: `${group.planting.id}-${buildHistoryItemKey(item, index)}`,
        kind: 'item',
      });
    });

    entries.push({
      key: `divider-${group.planting.id}`,
      kind: 'divider',
      label: formatCycleDividerLabel(group.planting),
    });
  }

  return entries;
}

// Pembatas awal sebuah siklus: '-- Ditanam ulang * 12 Mar 2023 * Aligator --'.
//
// Duduk di BAWAH kejadian-kejadian milik siklusnya, bukan di atas. Riwayat
// tersusun menurun (terbaru dulu), jadi membacanya ke bawah berarti mundur ke
// masa lalu — dan penanaman adalah hal paling awal yang terjadi pada siklus itu.
function TreeCycleDivider({ label }: { label: string }) {
  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.xs }}>
      <View style={{ backgroundColor: colors.border, flex: 1, height: 1 }} />
      <Text
        selectable
        style={{
          color: colors.textMuted,
          fontSize: typography.meta.fontSize,
          fontWeight: '700',
          lineHeight: typography.meta.lineHeight,
        }}
      >
        {label}
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

// Padding kiri-kanan tiap baris riwayat. Dipegang baris, BUKAN kartunya:
// kartunya berpadding 0 supaya garis rambut antar-baris mencapai kedua tepi
// alih-alih berhenti 16px di dalamnya dan terlihat seperti garis menggantung.
const TIMELINE_ROW_PADDING_X = spacing.cardPadding;

function TreeHistoryTimelineItem({
  currentUserId,
  dimmed = false,
  item,
  onRecordPress,
  showHairline = false,
  viewerMode,
}: {
  currentUserId?: string | null;
  dimmed?: boolean;
  item: TreeHistoryItem;
  onRecordPress?: (item: TreeHistoryItem, recordType: TreeHistoryRouteRecordType) => void;
  showHairline?: boolean;
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
  // 'Inisiatif · Adit', 'Kondisi · Anda'. Jenis lalu pencatat, satu baris abu.
  //
  // Menggantikan DUA chip yang dulu berdiri di puncak kartu — satu untuk jenis
  // catatan, satu lagi untuk asal perawatan. Keduanya membayar kotak berbingkai
  // untuk kata yang sudah dibawa saluran lain: jenisnya ada pada ikon di kiri,
  // dan sekarang juga tertulis di baris ini. Prefiks 'Dicatat oleh'/'Dipanen
  // oleh' ikut pergi bersama chip-nya; pada baris sesempit ini ia tiga kata yang
  // sama di setiap baris.
  const metaLine = `${formatHistoryKindLabel(item)} · ${actorName}`;
  const rowStyle = {
    alignItems: 'center' as const,
    borderTopColor: tokens.color.line.hairline,
    borderTopWidth: showHairline ? 1 : 0,
    flexDirection: 'row' as const,
    gap: spacing.md,
    paddingHorizontal: TIMELINE_ROW_PADDING_X,
    paddingVertical: spacing.md,
  };

  const content = (
    <>
      <View
        style={{
          alignItems: 'center',
          backgroundColor: getTimelineDotColor(item.historyType),
          borderRadius: 999,
          height: 34,
          justifyContent: 'center',
          width: 34,
        }}
      >
        {getTimelineIcon(item.historyType, getTimelineTextColor(item.historyType))}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ alignItems: 'baseline', flexDirection: 'row', gap: spacing.sm }}>
          {/* Judulnya isi catatannya sendiri, bukan nama kategorinya — kategori
              sudah dibawa ikon di kiri dan baris meta di bawah. numberOfLines 2
              supaya nama jadwal yang panjang tidak mendorong tanggalnya keluar
              layar, tanpa memotongnya sedini satu baris. */}
          <Text
            numberOfLines={2}
            selectable
            style={{
              color: colors.text,
              flex: 1,
              fontSize: typography.bodyStrong.fontSize,
              fontWeight: '700',
              lineHeight: typography.bodyStrong.lineHeight,
            }}
          >
            {formatHistoryRowTitle(item)}
          </Text>
          <Text selectable style={{ color: colors.textMuted, fontSize: typography.meta.fontSize }}>
            {formatHistoryRowDate(item.happenedAt)}
          </Text>
        </View>
        <Text
          selectable
          style={{
            color: colors.textMuted,
            fontSize: typography.meta.fontSize,
            lineHeight: typography.meta.lineHeight,
          }}
        >
          {metaLine}
        </Text>
      </View>
      {/* Chevron WAJIB ADA di baris yang bisa dibuka.
          Dulu ada dua isyarat "bisa ditekan": bingkai kartu yang berubah jadi
          hijau, dan chevron ini. Bingkainya hilang bersama kartunya, jadi
          chevron kini satu-satunya isyarat yang tersisa — dan pembacanya pekerja
          lanjut usia dengan literasi teknologi rendah. Umpan balik tekan di
          bawah adalah saluran ketiga, tapi ia baru muncul SETELAH disentuh;
          chevron yang memberi tahu sebelum disentuh. */}
      {canOpenRecord ? <ChevronRightIcon color={colors.textSoft} size={20} /> : null}
    </>
  );

  if (canOpenRecord && routeRecordType) {
    return (
      <Pressable
        accessibilityHint="Buka detail catatan"
        accessibilityRole="button"
        onPress={() => onRecordPress?.(item, routeRecordType)}
        style={({ pressed }) => ({
          ...rowStyle,
          backgroundColor: pressed ? tokens.color.surface.subtle : 'transparent',
          opacity: dimmed ? PAST_CYCLE_OPACITY : 1,
        })}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={{ ...rowStyle, opacity: dimmed ? PAST_CYCLE_OPACITY : 1 }}>{content}</View>
  );
}

// Judul baris riwayat: ISI catatannya, bukan nama jenisnya.
//
// Jenisnya sudah dibawa dua saluran lain — ikon berwarna di kiri dan kata
// pertama baris meta — jadi mengulanginya sebagai judul membuat baris terbaca
// "Kondisi / Kondisi · Anda" dan menyisakan nol tempat untuk hal yang benar-benar
// membedakan satu kejadian dari kejadian lain.
function formatHistoryRowTitle(item: TreeHistoryItem): string {
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
function formatHistoryRowDate(value: string, todayIso: string = getTodayIsoDate()): string {
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

// Warna lingkaran ikon per jenis catatan. SELURUHNYA token, tidak ada hex.
//
// Keempat jenis kini memakai keluarga tokens.color.record yang senama:
// condition, phase, harvest, care. Dua nilai terakhir yang masih hex sudah
// diselesaikan — masing-masing dengan alasan berbeda, dan yang kedua adalah
// pergantian warna yang disengaja:
//
//   * Latar fase dulu '#E7F6EC', beda satu langkah kanal hijau dari
//     record.phase.bg '#E7F5EC'. Itu salah ketik, bukan keputusan desain, dan
//     selisihnya tidak terlihat mata.
//   * Ikon panen dulu status.warning.bg + '#8A5B00', yaitu kuning pucat yang
//     nyaris kembar dengan dot KONDISI di sebelahnya. Dua jenis catatan yang
//     berbeda tidak boleh berbagi satu warna. Keduanya kini pindah ke keluarga
//     record.harvest (oranye), sehingga keempat jenis punya rona sendiri.
//
// Warna BUKAN satu-satunya pembeda, dan tidak pernah jadi satu-satunya: tiap
// jenis punya glif sendiri (segitiga, bunga, keranjang, semprot) dan namanya
// tertulis di baris meta tiap baris riwayat.
function getTimelineDotColor(type: TreeHistoryType): string {
  if (type === 'condition') {
    return tokens.color.record.condition.bg;
  }

  if (type === 'phase') {
    return tokens.color.record.phase.bg;
  }

  if (type === 'harvest') {
    return tokens.color.record.harvest.bg;
  }

  return tokens.color.record.care.bg;
}

function getTimelineTextColor(type: TreeHistoryType): string {
  if (type === 'condition') {
    return tokens.color.record.condition.text;
  }

  if (type === 'phase') {
    return tokens.color.record.phase.text;
  }

  if (type === 'harvest') {
    return tokens.color.record.harvest.text;
  }

  return tokens.color.record.care.text;
}

function getTimelineIcon(type: TreeHistoryType, color: string) {
  if (type === 'condition') {
    return <AlertTriangleIcon color={color} size={18} />;
  }

  if (type === 'phase') {
    return <FlowerIcon color={color} size={18} />;
  }

  if (type === 'harvest') {
    return <BasketIcon color={color} size={18} />;
  }

  return <SprayIcon color={color} size={18} />;
}

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

function getConditionTone(status: TreeConditionStatus): BadgeTone {
  if (status === 'healthy') {
    return 'success';
  }

  if (status === 'needs_attention') {
    return 'warning';
  }

  if (status === 'dead') {
    return 'muted';
  }

  return 'danger';
}

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
