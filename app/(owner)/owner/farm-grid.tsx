import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Text, TextInput, View } from 'react-native';

import { Icon } from '../../../src/components/icons';
import { useSnackbar } from '../../../src/components/snackbar';
import {
  Button,
  Card,
  EmptyState,
  LoadingState,
  Screen,
  TopAppBar,
} from '../../../src/components/ui';
import { colors, radius, spacing, tokens } from '../../../src/constants/theme';
import { useAuth } from '../../../src/context/auth-context';
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
//     masih ada pohon di luar ukuran baru.
//
// Penjagaan terakhir itu sebabnya galat server tampil sebagai SPANDUK, bukan
// snackbar. Pesannya memuat jumlah pohon penghalang dan satu contoh kode
// posisi, panjangnya dua sampai tiga baris, dan pemilik perlu membacanya sambil
// membetulkan angkanya. Snackbar hilang sendiri dalam 3,5 detik.

// Kebalikan columnNumberOf di farm-map-screen.tsx. DISALIN, bukan diimpor:
// helper di sana tidak diekspor, dan berkas peta tidak boleh disentuh di tahap
// ini. Kecil, murni, dan hanya dipakai untuk pratinjau di layar ini — jadi ia
// tinggal di sini alih-alih menambah permukaan berkas bersama.
const COLUMN_LETTER_OFFSET = 64; // 'A' = 65

function columnLetter(columnNumber: number): string {
  return String.fromCharCode(COLUMN_LETTER_OFFSET + columnNumber);
}

const MIN_ROWS = 1;
const MAX_ROWS = 999;
const MIN_COLUMNS = 1;
const MAX_COLUMNS = 26;

export default function OwnerFarmGridScreen() {
  const { currentFarm, error: authError, refresh } = useAuth();
  const showSnackbar = useSnackbar();
  const [columns, setColumns] = React.useState('');
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
      <Screen>
        <TopAppBar title="Ukuran denah kebun" onBack={() => router.back()} />
        <EmptyState
          title="Akses tidak tersedia"
          subtitle="Ukuran denah kebun hanya bisa diubah oleh pemilik aktif."
        />
      </Screen>
    );
  }

  if (loading) {
    return (
      <LoadingState
        header={<TopAppBar title="Ukuran denah kebun" onBack={() => router.back()} />}
        message="Memuat ukuran kebun..."
      />
    );
  }

  const previewCode = buildPreviewCode(rows, columns);

  return (
    <Screen>
      <TopAppBar title="Ukuran denah kebun" onBack={() => router.back()} />

      <GridErrorBanner message={serverError ?? authError?.message} />

      <Card>
        <Text selectable style={styles.currentLabel}>
          Ukuran sekarang
        </Text>
        <Text selectable style={styles.currentValue}>
          {formatCurrentGrid(currentGrid)}
        </Text>
      </Card>

      <Card>
        {/* Baris di KIRI, kolom di kanan. Bukan selera: kode posisinya berformat
            "baris-kolom" (12-C), jadi urutan membaca kedua kotak ini harus sama
            dengan urutan membaca kodenya. */}
        <View style={styles.gridRow}>
          <NumberField
            error={fieldErrors.rows}
            label="Baris"
            onChangeText={handleRowsChange}
            placeholder="26"
            value={rows}
          />
          <Text selectable={false} style={styles.multiplySign}>
            x
          </Text>
          <NumberField
            error={fieldErrors.columns}
            label="Kolom"
            onChangeText={handleColumnsChange}
            placeholder="9"
            value={columns}
          />
        </View>

        {/* SATU kalimat untuk KEDUA kotak, bukan satu per kotak. Batas baris dan
            batas kolom dibaca sekali bersamaan; memecahnya jadi dua kalimat
            kembar membuat mata membacanya dua kali untuk satu keputusan. */}
        <Text selectable style={styles.hint}>
          Baris 1 sampai 999, kolom 1 sampai 26. Kolom diberi huruf A sampai Z.
        </Text>
      </Card>

      {/* Hilang total kalau angkanya belum sah. Kode posisi yang salah lebih
          buruk daripada tidak ada pratinjau: ia terbaca sebagai janji. */}
      {previewCode ? (
        <Card variant="info">
          <Text selectable style={styles.previewLabel}>
            Kode posisi terakhir jadi
          </Text>
          <Text selectable style={styles.previewCode}>
            {previewCode}
          </Text>
        </Card>
      ) : null}

      <Button title="Simpan ukuran" loading={saving} onPress={handleSave} />
    </Screen>
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

// Angkanya rata tengah supaya dua kotak bersebelahan terbaca sebagai sepasang
// nilai, bukan dua formulir terpisah. minHeight 56 mengikuti tinggi sentuh
// tombol di proyek ini — layar ini dipakai juga oleh pengguna lanjut usia.
function NumberField({
  error,
  label,
  onChangeText,
  placeholder,
  value,
}: {
  error?: string;
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.field}>
      <Text selectable style={styles.fieldLabel}>
        {label}
      </Text>
      <TextInput
        autoCorrect={false}
        keyboardType="number-pad"
        maxLength={3}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSoft}
        style={[styles.input, error ? styles.inputError : null]}
        value={value}
      />
      {error ? (
        <Text selectable style={styles.fieldError}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function formatCurrentGrid(grid: { columns?: number; rows?: number }): string {
  if (grid.rows === undefined || grid.columns === undefined) {
    return 'Belum terbaca';
  }

  return `${grid.rows} baris x ${grid.columns} kolom`;
}

// Mengembalikan null, bukan string kosong: pemanggil menyembunyikan SELURUH
// kartunya, bukan merender kartu berisi teks kosong.
function buildPreviewCode(rows: string, columns: string): string | null {
  const parsedRows = parsePositiveInteger(rows);
  const parsedColumns = parsePositiveInteger(columns);

  if (parsedRows === null || parsedColumns === null) {
    return null;
  }

  if (parsedRows < MIN_ROWS || parsedRows > MAX_ROWS) {
    return null;
  }

  if (parsedColumns < MIN_COLUMNS || parsedColumns > MAX_COLUMNS) {
    return null;
  }

  return `${parsedRows}-${columnLetter(parsedColumns)}`;
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

const styles = {
  currentLabel: {
    color: tokens.color.text.secondary,
    ...tokens.type.label,
  },
  currentValue: {
    color: tokens.color.text.primary,
    ...tokens.type.heading,
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
  gridRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  hint: {
    color: tokens.color.text.secondary,
    ...tokens.type.bodySmall,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderCurve: 'continuous',
    borderRadius: radius.lg,
    borderWidth: 1,
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    minHeight: 56,
    paddingHorizontal: spacing.md,
    textAlign: 'center',
  },
  inputError: {
    borderColor: tokens.color.status.danger.text,
  },
  multiplySign: {
    alignSelf: 'center',
    color: tokens.color.text.tertiary,
    ...tokens.type.heading,
    // Menyeimbangkan tinggi label di atas kedua kotak, supaya tanda "x" duduk
    // sejajar dengan kotaknya, bukan dengan labelnya.
    marginTop: spacing.lg,
  },
  previewCode: {
    color: tokens.color.text.primary,
    ...tokens.type.title,
  },
  previewLabel: {
    color: tokens.color.text.secondary,
    ...tokens.type.label,
  },
} as const;
