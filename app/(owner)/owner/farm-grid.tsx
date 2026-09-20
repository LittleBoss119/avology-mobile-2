import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Icon } from '../../../src/components/icons';
import { ConfirmDialog } from '../../../src/components/bottom-sheet';
import { useSnackbar } from '../../../src/components/snackbar';
import {
  Button,
  EmptyState,
  LoadingState,
  Screen,
  SectionLabel,
  TopAppBar,
} from '../../../src/components/ui';
import { colors, radius, spacing, tokens } from '../../../src/constants/theme';
import { colors as palette, fonts, touch } from '../../../src/theme/tokens';
import { useAuth } from '../../../src/context/auth-context';
import { useUnsavedChangesGuard } from '../../../src/hooks/useUnsavedChangesGuard';
import { getFarmDetail, setFarmGrid } from '../../../src/services/farmService';
import type { Farm } from '../../../src/types/domain';
import { isOwnerActive } from '../../../src/utils/routeGuard';

// Mengubah ukuran petak kebun: berapa baris dan berapa kolom posisi tanam yang
// ada. Sampai layar ini lahir, dimensinya hanya bisa diubah lewat SQL, sehingga
// aplikasi terlihat cuma jalan di satu kebun berukuran 26 x 9.
//
// TIDAK ADA MIGRASI DI BALIK LAYAR INI. RPC set_farm_grid sudah ada sejak 054
// dan pesannya diperbaiki di 063; layar ini hanya memanggilnya.
//
// PEMBAGIAN KERJA VALIDASI, dan urutannya penting:
//
//   * Di sini  -- bilangan bulat, baris 1..999, kolom 1..26, keduanya wajib.
//     Ini SEMATA mencegah panggilan yang pasti ditolak. Ia bukan sumber
//     kebenaran dan tidak boleh diperlakukan begitu.
//   * Di RPC   -- kelima penjagaan yang sesungguhnya, termasuk yang TIDAK BISA
//     diketahui klien tanpa bertanya ke database: penolakan pengecilan saat
//     masih ada pohon di luar ukuran baru, pohon BERARSIP ikut dihitung.
//
// PENOLAKAN PENGECILAN, dan bentuknya ditetapkan adendum §1.3:
//
//   * TOMBOL SIMPAN TETAP AKTIF. Klien tidak menebak-nebak apakah pengecilan
//     akan ditolak. Untuk menebaknya ia harus tahu posisi setiap pohon termasuk
//     yang berarsip -- itu kueri baru -- dan tebakan yang meleset akan
//     mematikan tombol untuk pengecilan yang sebenarnya sah.
//   * Penolakannya tampil sebagai SPANDUK GALAT di layar yang sama, sesudah
//     percobaan simpan. Bukan dialog konfirmasi sebelum menyimpan, dan bukan
//     layar baru: yang perlu diketahui pemilik bukan "yakin?" melainkan APA yang
//     menghalangi, dan itu baru diketahui setelah database menjawab.
//   * Pesannya dipakai APA ADANYA. set_farm_grid menyebut jumlah pohon
//     penghalang beserta satu contoh kode posisi; memetakannya ke kalimat tetap
//     akan membuang persis dua keterangan yang membuat pesan itu bisa
//     ditindaklanjuti.
//
// Spanduknya berbentuk sendiri, bukan ErrorBanner bersama: pesan itu panjangnya
// dua sampai tiga baris dan pemilik perlu membacanya sambil membetulkan
// angkanya, jadi ia butuh ikon yang menandai "ini penolakan" -- bukan warna
// saja -- dan tidak boleh hilang sendiri seperti snackbar.

const MIN_ROWS = 1;
const MAX_ROWS = 999;
const MIN_COLUMNS = 1;
const MAX_COLUMNS = 26;

// Sisi sel pratinjau, dalam piksel. 8 adalah angka spek §40, dan pada 26 kolom
// ia menghasilkan baris selebar 26*8 + 25*2 = 258 -- muat di layar tersempit
// yang ditargetkan proyek ini tanpa perlu digulung ke samping.
const PREVIEW_CELL = 8;
const PREVIEW_GAP = 2;

// PRATINJAU DIPOTONG di 40 baris, dan pemotongannya dikatakan, bukan
// disembunyikan. Batas atas baris adalah 999: seluruh matriksnya berarti 8.991
// sel, yaitu 8.991 View yang harus dirakit ulang tiap ketukan tombol stepper.
// Di ponsel kelas bawah yang dipakai di kebun, itu bukan pratinjau melainkan
// aplikasi yang membeku. Empat puluh baris sudah jauh melampaui kebun nyata
// yang dilayani aplikasi ini (26), dan yang di atasnya tetap terwakili angka
// pada baris konsekuensi.
const MAX_PREVIEW_ROWS = 40;

export default function OwnerFarmGridScreen() {
  const { currentFarm, error: authError, refresh } = useAuth();
  const showSnackbar = useSnackbar();
  const [columns, setColumns] = React.useState('');
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);
  const [currentGrid, setCurrentGrid] = React.useState<{ columns?: number; rows?: number }>({});
  const [loading, setLoading] = React.useState(true);
  const [rows, setRows] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  // Galat SERVER, dipisahkan dari galat per-kotak. Ia punya tempat sendiri di
  // atas formulir dan dibersihkan begitu salah satu kotak berubah — pesan yang
  // menjawab angka lama tidak boleh menggantung di atas angka baru.
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);

  const farmId = currentFarm?.farmId;
  const fieldErrors = submitted ? computeFieldErrors(rows, columns) : {};

  const syncForm = React.useCallback((nextFarm: Farm) => {
    // `?? undefined` dipertahankan apa adanya dari mapFarm: undefined berarti
    // "belum terbaca", bukan nol. Kotaknya dibiarkan kosong pada kasus itu
    // alih-alih diisi 26 dan 9, yang akan menyalin nilai bawaan database ke
    // layar seolah-olah itu ukuran kebun ini.
    setCurrentGrid({ columns: nextFarm.gridColumns, rows: nextFarm.gridRows });
    setRows(nextFarm.gridRows === undefined ? '' : String(nextFarm.gridRows));
    setColumns(nextFarm.gridColumns === undefined ? '' : String(nextFarm.gridColumns));
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;

      async function loadFarm() {
        if (!farmId || !isOwnerActive(currentFarm)) {
          setLoading(false);
          return;
        }

        setLoading(true);
        setServerError(null);

        const result = await getFarmDetail(farmId);

        if (!isActive) {
          return;
        }

        if (result.error) {
          setServerError(result.error.message);

          if (currentFarm?.farm) {
            syncForm(currentFarm.farm);
          }
        } else {
          syncForm(result.data);
        }

        setLoading(false);
      }

      void loadFarm();

      return () => {
        isActive = false;
      };
    }, [currentFarm, farmId, syncForm])
  );

  // Pembanding "ada perubahan" adalah UKURAN YANG TERSIMPAN, bukan salinan
  // terpisah: currentGrid memang sudah memegang nilai dari database, jadi tidak
  // ada baseline kedua yang bisa menyimpang darinya.
  const hasUnsavedChanges =
    rows.trim() !== formatGridValue(currentGrid.rows) ||
    columns.trim() !== formatGridValue(currentGrid.columns);

  // PENJAGA PERUBAHAN BELUM DISIMPAN (batch 7a, langkah 2a). Sebelum ini,
  // menaikkan jumlah baris lalu menekan kembali membuang perubahan itu tanpa
  // sepatah kata pun — di layar yang justru mengubah struktur kebunnya.
  const { handleBackPress } = useUnsavedChangesGuard({
    hasUnsavedChanges: hasUnsavedChanges && !saving,
    onBlocked: () => setConfirmDiscard(true),
    onLeave: () => {
      if (saving) {
        return;
      }

      router.back();
    },
  });

  function handleRowsChange(value: string) {
    setServerError(null);
    setRows(value);
  }

  function handleColumnsChange(value: string) {
    setServerError(null);
    setColumns(value);
  }

  async function handleSave() {
    if (!farmId) {
      setServerError('Data kebun tidak ditemukan.');
      return;
    }

    setSubmitted(true);

    const errors = computeFieldErrors(rows, columns);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setSaving(true);
    setServerError(null);

    const result = await setFarmGrid({
      columns: Number(columns.trim()),
      farmId,
      rows: Number(rows.trim()),
    });

    if (result.error) {
      // Ditampilkan APA ADANYA. Untuk penolakan pengecilan, kalimat inilah yang
      // memberi tahu berapa pohon yang menghalangi dan di posisi mana salah
      // satunya — memetakannya ke kalimat tetap akan membuang keduanya.
      setServerError(result.error.message);
      setSaving(false);
      return;
    }

    // WAJIB, dan bukan kerapian: currentFarm.farm di auth-context membawa
    // gridRows/gridColumns dan hanya disegarkan oleh refresh(). Peta membaca
    // ulang sendiri lewat useFocusEffect, konteks auth tidak.
    await refresh();
    setSaving(false);
    showSnackbar('Ukuran kebun disimpan');
    router.back();
  }

  if (!isOwnerActive(currentFarm)) {
    return (
      <Screen header={<TopAppBar title="Ukuran denah" onBack={() => router.back()} />}>
        <EmptyState
          title="Akses tidak tersedia"
          subtitle="Ukuran denah hanya bisa diubah oleh pemilik aktif."
        />
      </Screen>
    );
  }

  if (loading) {
    return (
      <LoadingState
        header={<TopAppBar title="Ukuran denah" onBack={() => router.back()} />}
        message="Memuat ukuran kebun..."
      />
    );
  }

  const parsedRows = parseInRange(rows, MIN_ROWS, MAX_ROWS);
  const parsedColumns = parseInRange(columns, MIN_COLUMNS, MAX_COLUMNS);
  const previewReady = parsedRows !== null && parsedColumns !== null;

  return (
    <Screen
      header={<TopAppBar title="Ukuran denah" onBack={handleBackPress} />}
      // TOMBOL TETAP AKTIF, termasuk saat pengecilan yang akan ditolak server.
      // Lihat catatan panjang di kepala berkas: menebak penolakan di klien
      // menuntut kueri baru, dan tebakan yang meleset mematikan tombol untuk
      // pengecilan yang sebenarnya sah.
      stickyFooter={<Button title="Simpan ukuran" loading={saving} onPress={handleSave} />}
    >
      <GridErrorBanner message={serverError ?? authError?.message} />

      {/* STEPPER, bukan dua kotak angka telanjang. Yang dilakukan pemilik di
          layar ini hampir selalu menambah atau mengurangi SATU baris — kebun
          tumbuh sebaris demi sebaris — dan untuk itu tombol jauh lebih murah
          daripada memanggil papan angka, menghapus isinya, lalu mengetik ulang.

          Kotak angkanya TIDAK dicabut, dan itu disengaja: melompat dari 9 ke 26
          kolom lewat tombol adalah tujuh belas ketukan. Bentuk akhirnya karena
          itu stepper YANG KOTAKNYA MASIH BISA DIKETIK — tombol untuk perubahan
          kecil, ketikan untuk lompatan besar.

          Baris di KIRI, kolom di kanan. Bukan selera: kode posisinya berformat
          "baris-kolom" (12-C), jadi urutan membaca kedua kontrol ini harus sama
          dengan urutan membaca kodenya. */}
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Stepper
          error={fieldErrors.rows}
          label="Baris"
          max={MAX_ROWS}
          min={MIN_ROWS}
          onChangeText={handleRowsChange}
          placeholder="26"
          value={rows}
        />
        <Stepper
          error={fieldErrors.columns}
          label="Kolom"
          max={MAX_COLUMNS}
          min={MIN_COLUMNS}
          onChangeText={handleColumnsChange}
          placeholder="9"
          value={columns}
        />
      </View>

      {/* SATU kalimat untuk KEDUA kontrol, bukan satu per kontrol. Batas baris
          dan batas kolom dibaca sekali bersamaan; memecahnya jadi dua kalimat
          kembar membuat mata membacanya dua kali untuk satu keputusan. */}
      <Text selectable style={styles.hint}>
        Baris 1 sampai 999, kolom 1 sampai 26. Kolom diberi huruf A sampai Z.
      </Text>

      {/* Hanya dirender saat angka yang diketik BERBEDA dari yang tersimpan.
          Selama keduanya sama, barisnya cuma mengulang apa yang sudah terbaca di
          kedua kotak; begitu berbeda, ia satu-satunya yang masih menyimpan
          ukuran lama — dan itulah yang dibutuhkan orang yang ingin membatalkan
          perubahannya sendiri. */}
      {hasUnsavedChanges && currentGrid.rows !== undefined && currentGrid.columns !== undefined ? (
        <Text selectable style={styles.hint}>
          {`Ukuran sekarang ${currentGrid.rows} baris × ${currentGrid.columns} kolom.`}
        </Text>
      ) : null}

      {/* PRATINJAU DENAH, langsung di layar ini dan bukan di balik tombol.
          Angka "26 x 9" tidak memberi tahu apa pun tentang BENTUK kebun; petak
          8px memberitahukannya dalam sekali lihat — apakah ia memanjang,
          melebar, atau hampir bujur sangkar — dan bentuk itulah yang dicocokkan
          pemilik dengan lahannya sendiri.

          Hilang total kalau angkanya belum sah. Petak yang salah ukuran lebih
          buruk daripada tidak ada petak: ia terbaca sebagai janji. */}
      {previewReady ? (
        <View style={{ gap: tokens.space.sm }}>
          <SectionLabel title="Pratinjau denah" />
          <GridPreview columns={parsedColumns} rows={parsedRows} />
          {/* BARIS KONSEKUENSI. Ia menerjemahkan dua angka jadi satu angka yang
              benar-benar berarti bagi pemilik: berapa posisi tanam yang ia
              punya.

              §40 meminta baris ini menyebut juga berapa yang TERPAKAI ("234
              posisi tanam · 196 terpakai"). Angka itu tidak ada di sini dan
              tidak dikarang: ia menuntut hitungan atas tabel trees — termasuk
              pohon berarsip, yang justru ikut menghalangi pengecilan — dan itu
              kueri baru, yang dilarang batasan keras batch ini. Yang disebut
              karena itu hanya yang memang bisa dihitung dari kedua angka di
              atas. */}
          <Text selectable style={styles.consequence}>
            {`${parsedRows * parsedColumns} posisi tanam`}
          </Text>
          {parsedRows > MAX_PREVIEW_ROWS ? (
            <Text selectable style={styles.hint}>
              {`Petak di atas menampilkan ${MAX_PREVIEW_ROWS} baris pertama.`}
            </Text>
          ) : null}
        </View>
      ) : null}

      <ConfirmDialog
        cancelLabel="Buang perubahan"
        cancelTone="danger"
        confirmLabel="Lanjut ubah"
        message="Ukuran denah yang baru belum disimpan. Kalau keluar sekarang, perubahan itu hilang."
        onCancel={() => {
          setConfirmDiscard(false);
          router.back();
        }}
        onConfirm={() => setConfirmDiscard(false)}
        title="Perubahan belum disimpan"
        visible={confirmDiscard}
      />
    </Screen>
  );
}

// Petak pratinjau: seluruh matriks, sel 8px, jarak 2px.
//
// Selnya digambar SERAGAM, tanpa membedakan posisi yang sudah ditanami dari
// yang kosong. Bukan penyederhanaan: membedakannya menuntut posisi setiap pohon,
// yaitu kueri yang tidak boleh ditambahkan di batch ini. Petak seragam menjawab
// pertanyaan yang memang ditanyakan layar ini — seberapa besar dan apa bentuknya
// — dan tidak berpura-pura menjawab yang lain.
function GridPreview({ columns, rows }: { columns: number; rows: number }) {
  const visibleRows = Math.min(rows, MAX_PREVIEW_ROWS);

  return (
    <View
      // Satu label untuk seluruh petak, dan pembacanya berhenti di situ:
      // membiarkan pembaca layar menyusuri 234 sel kosong satu per satu adalah
      // hukuman, bukan aksesibilitas. Angka yang sama sudah dikatakan baris
      // konsekuensi tepat di bawahnya.
      accessibilityLabel={`Pratinjau denah ${rows} baris kali ${columns} kolom`}
      accessibilityRole="image"
      style={{ gap: PREVIEW_GAP }}
    >
      {Array.from({ length: visibleRows }, (_, rowIndex) => (
        <View key={rowIndex} style={{ flexDirection: 'row', gap: PREVIEW_GAP }}>
          {Array.from({ length: columns }, (_, columnIndex) => (
            <View
              key={columnIndex}
              style={{
                backgroundColor: palette.surfaceSunken,
                borderColor: palette.border,
                borderRadius: tokens.radius.tileFar,
                borderWidth: 1,
                height: PREVIEW_CELL,
                width: PREVIEW_CELL,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

// Stepper: tombol kurang, kotak angka, tombol tambah.
//
// Kedua tombolnya 48 — touch.min, pedoman Android — bukan tokens.layout.tapTarget
// (44, minimum iOS). Seluruh pengguna aplikasi ini memakai Android di kebun,
// dengan tangan basah atau berdebu.
//
// Tombol menolak melewati batasnya dan MATI di sana, bukan diam-diam menjepit
// nilainya: tombol yang tetap menyala tapi tidak mengubah apa-apa membuat orang
// menekannya berulang kali sambil mengira layarnya yang tidak menanggapi.
function Stepper({
  error,
  label,
  max,
  min,
  onChangeText,
  placeholder,
  value,
}: {
  error?: string;
  label: string;
  max: number;
  min: number;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const parsed = parsePositiveInteger(value);
  const canDecrease = parsed !== null && parsed > min;
  const canIncrease = parsed !== null && parsed < max;

  return (
    <View style={styles.field}>
      <Text selectable style={styles.fieldLabel}>
        {label}
      </Text>
      <View style={[styles.stepperRow, error ? styles.stepperRowError : null]}>
        <StepperButton
          accessibilityLabel={`Kurangi ${label.toLowerCase()}`}
          disabled={!canDecrease}
          icon="minus"
          onPress={() => onChangeText(String((parsed ?? min) - 1))}
        />
        <TextInput
          autoCorrect={false}
          keyboardType="number-pad"
          maxLength={3}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSoft}
          style={styles.stepperInput}
          value={value}
        />
        <StepperButton
          accessibilityLabel={`Tambah ${label.toLowerCase()}`}
          disabled={!canIncrease}
          icon="plus"
          onPress={() => onChangeText(String((parsed ?? min - 1) + 1))}
        />
      </View>
      {error ? (
        <Text selectable style={styles.fieldError}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function StepperButton({
  accessibilityLabel,
  disabled,
  icon,
  onPress,
}: {
  accessibilityLabel: string;
  disabled: boolean;
  icon: 'minus' | 'plus';
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: touch.min,
        minWidth: touch.min,
        opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
      })}
    >
      <Icon name={icon} size={tokens.icon.md} color={palette.accentText} />
    </Pressable>
  );
}

// Spanduk galat server. TIDAK memakai ErrorBanner dari ui.tsx karena komponen
// itu hanya teks berwarna — dan di layar ini warna tidak boleh jadi satu-satunya
// penanda. Ikonnya yang membawa arti "ini penolakan", bukan latar merahnya.
//
// Tidak diangkat ke ui.tsx: mengubah ErrorBanner bersama berarti mengubah
// spanduk di SELURUH layar repo ini, dan itu di luar lingkup tahap ini.
function GridErrorBanner({ message }: { message?: string | null }) {
  if (!message) {
    return null;
  }

  return (
    <View style={styles.errorBanner}>
      <Icon
        name="alert-triangle"
        size={tokens.icon.md}
        color={tokens.color.status.danger.text}
      />
      <Text selectable style={styles.errorText}>
        {message}
      </Text>
    </View>
  );
}

function formatGridValue(value?: number): string {
  return value === undefined ? '' : String(value);
}

function computeFieldErrors(rows: string, columns: string): { columns?: string; rows?: string } {
  const errors: { columns?: string; rows?: string } = {};
  const parsedRows = parsePositiveInteger(rows);
  const parsedColumns = parsePositiveInteger(columns);

  if (!rows.trim()) {
    errors.rows = 'Jumlah baris wajib diisi.';
  } else if (parsedRows === null) {
    errors.rows = 'Jumlah baris harus berupa angka bulat.';
  } else if (parsedRows < MIN_ROWS || parsedRows > MAX_ROWS) {
    errors.rows = 'Jumlah baris harus antara 1 dan 999.';
  }

  if (!columns.trim()) {
    errors.columns = 'Jumlah kolom wajib diisi.';
  } else if (parsedColumns === null) {
    errors.columns = 'Jumlah kolom harus berupa angka bulat.';
  } else if (parsedColumns < MIN_COLUMNS || parsedColumns > MAX_COLUMNS) {
    errors.columns = 'Jumlah kolom harus antara 1 dan 26.';
  }

  return errors;
}

// Hanya digit. Number('') adalah 0 dan Number(' 12 ') adalah 12, jadi keduanya
// tidak bisa dipakai sendirian untuk memutuskan "ini angka bulat yang diketik
// pengguna". Pemeriksaan bentuk dilakukan lebih dulu, baru konversinya.
function parsePositiveInteger(value: string): number | null {
  const normalized = value.trim();

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isSafeInteger(parsed) ? parsed : null;
}

// Mengembalikan null untuk apa pun yang di luar rentang, supaya pemanggil cukup
// memeriksa satu hal sebelum menggambar pratinjau.
function parseInRange(value: string, min: number, max: number): number | null {
  const parsed = parsePositiveInteger(value);

  if (parsed === null || parsed < min || parsed > max) {
    return null;
  }

  return parsed;
}

const styles = {
  consequence: {
    color: tokens.color.text.primary,
    ...tokens.type.bodyStrong,
  },
  errorBanner: {
    alignItems: 'flex-start',
    backgroundColor: tokens.color.status.danger.bg,
    borderColor: tokens.color.status.danger.border,
    borderCurve: 'continuous',
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  errorText: {
    color: tokens.color.status.danger.text,
    flex: 1,
    ...tokens.type.body,
  },
  field: {
    flex: 1,
    gap: spacing.sm,
  },
  fieldError: {
    color: tokens.color.status.danger.text,
    ...tokens.type.meta,
  },
  fieldLabel: {
    color: colors.text,
    ...tokens.type.bodyStrong,
  },
  hint: {
    color: tokens.color.text.secondary,
    ...tokens.type.bodySmall,
  },
  // Border pindah ke BARIS, bukan ke kotak angkanya: kedua tombol dan angkanya
  // adalah satu kontrol, dan menggambar kotak hanya di sekeliling angkanya
  // membuat tombol terlihat seperti dua hal lain yang kebetulan berdiri di
  // sampingnya.
  stepperRow: {
    alignItems: 'center',
    backgroundColor: palette.surfaceRaised,
    borderColor: palette.borderStrong,
    borderCurve: 'continuous',
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: touch.min,
  },
  stepperRowError: {
    borderColor: palette.statusBuruk,
  },
  stepperInput: {
    color: colors.text,
    flex: 1,
    fontFamily: fonts.sansSemiBold,
    fontSize: 20,
    paddingVertical: 0,
    textAlign: 'center',
  },
} as const;
