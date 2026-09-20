import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Share, Text, View } from 'react-native';

import { ConfirmDialog } from '../../../src/components/bottom-sheet';
import {
  Button,
  EmptyState,
  ErrorBanner,
  Field,
  LoadingState,
  MenuRow,
  MenuRowGroup,
  MetaRow,
  Screen,
  SectionLabel,
  TopAppBar,
} from '../../../src/components/ui';
import { useSnackbar } from '../../../src/components/snackbar';
import { tokens } from '../../../src/constants/theme';
import {
  colors as palette,
  fonts,
  radius as shapeRadius,
  text as typeScale,
  touch,
} from '../../../src/theme/tokens';
import { useAuth } from '../../../src/context/auth-context';
import { useUnsavedChangesGuard } from '../../../src/hooks/useUnsavedChangesGuard';
import { getFarmDetail, updateFarmProfile } from '../../../src/services/farmService';
import type { Farm } from '../../../src/types/domain';
import { formatArea } from '../../../src/utils/farmFormat';
import { isOwnerActive } from '../../../src/utils/routeGuard';

// LAYAR INI PUNYA DUA MODE, BUKAN DUA LAYAR (adendum §3.2).
//
// Tombol "Edit" tidak mendorong layar baru; ia mengganti isi layar ini dari
// bacaan jadi isian. Alasannya: yang diubah di sini cuma tiga baris keterangan,
// dan mendorong layar penuh untuk tiga baris berarti pemilik kehilangan
// pandangan atas nilai lamanya persis saat ia hendak menggantinya.
//
// Yang bisa diubah HANYA nama, lokasi, dan luas lahan. Kode kebun dibuat
// database dan tidak punya jalur ubah sama sekali; ukuran denah punya layarnya
// sendiri karena ia keputusan struktural — ia menentukan posisi mana yang boleh
// ditanami, sedangkan ketiga kolom di sini hanya keterangan. Menaruh keduanya di
// satu tombol simpan berarti satu ketukan memindahkan dua hal yang risikonya
// jauh berbeda.
export default function OwnerFarmProfileScreen() {
  const { currentFarm, error: authError, refresh } = useAuth();
  const showSnackbar = useSnackbar();
  const [areaSize, setAreaSize] = React.useState('');
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [location, setLocation] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [name, setName] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  // Titik nol pembanding "ada perubahan". Diisi bersama ketiga kolom di
  // syncForm, supaya nilainya persis yang pertama kali ditampilkan.
  const [baseline, setBaseline] = React.useState({ areaSize: '', location: '', name: '' });
  // Kode kebun dan ukuran petak, DARI BARIS Farm YANG SAMA yang sudah diambil
  // layar ini lewat getFarmDetail — tidak ada query tambahan untuk keduanya.
  //
  // Ketiganya opsional di tipe Farm dan `undefined` berarti "belum terbaca",
  // BUKAN nol (lihat catatan pada Farm.gridRows di types/domain.ts). Karena itu
  // baris ukuran denah hanya menyebut angkanya saat dua-duanya benar-benar ada,
  // dan petak kode hanya dirender saat kodenya ada.
  const [grid, setGrid] = React.useState<{ columns?: number; rows?: number }>({});
  const [joinCode, setJoinCode] = React.useState<string | undefined>(undefined);

  const farmId = currentFarm?.farmId;
  const fieldErrors = submitted ? computeFieldErrors(name, areaSize) : {};

  const syncForm = React.useCallback((nextFarm: Farm) => {
    const nextAreaSize =
      nextFarm.areaSize === null || nextFarm.areaSize === undefined ? '' : String(nextFarm.areaSize);

    setName(nextFarm.name);
    setLocation(nextFarm.location ?? '');
    setAreaSize(nextAreaSize);
    setBaseline({ areaSize: nextAreaSize, location: nextFarm.location ?? '', name: nextFarm.name });
    setGrid({ columns: nextFarm.gridColumns, rows: nextFarm.gridRows });
    setJoinCode(nextFarm.joinCode);
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
        setFormError(null);

        const result = await getFarmDetail(farmId);

        if (!isActive) {
          return;
        }

        if (result.error) {
          setFormError(result.error.message);
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

  // Dibandingkan dalam bentuk ternormalisasi, bukan mentah: menambah lalu
  // menghapus satu spasi tidak boleh dihitung sebagai perubahan.
  const hasUnsavedChanges =
    editing &&
    (name.trim() !== baseline.name.trim() ||
      location.trim() !== baseline.location.trim() ||
      areaSize.trim() !== baseline.areaSize.trim());

  function leaveEditMode() {
    setAreaSize(baseline.areaSize);
    setLocation(baseline.location);
    setName(baseline.name);
    setSubmitted(false);
    setFormError(null);
    setEditing(false);
  }

  // PENJAGA PERUBAHAN BELUM DISIMPAN (batch 7a, langkah 2a). Sebelum ini layar
  // ini adalah formulir bertombol simpan yang perubahannya hilang tanpa sepatah
  // kata begitu chevron kembali ditekan.
  //
  // Di layar ini "kembali" punya DUA arti, dan itu yang membedakannya dari layar
  // berpenjaga lain: dalam mode isian ia berarti batal mengubah dan kembali ke
  // bacaan — masih di layar yang sama — sementara dalam mode bacaan ia berarti
  // meninggalkan layar. Karena itulah layar ini tidak butuh tombol "Batal" yang
  // dicabut di batch 6a: tombol itu akan mengerjakan persis apa yang sudah
  // dikerjakan chevron.
  const { handleBackPress } = useUnsavedChangesGuard({
    hasUnsavedChanges: hasUnsavedChanges && !saving,
    onBlocked: () => setConfirmDiscard(true),
    onLeave: () => {
      // Selama menyimpan, back sengaja tidak melakukan apa-apa: handleSave yang
      // selesai belakangan akan mengembalikan modenya sendiri.
      if (saving) {
        return;
      }

      if (editing) {
        leaveEditMode();
        return;
      }

      router.back();
    },
  });

  async function handleShareJoinCode() {
    if (!joinCode) {
      return;
    }

    // Kalimat yang sama persis dengan tombol Bagikan di layar Anggota, supaya
    // pekerja yang menerimanya lewat WhatsApp membaca bentuk pesan yang sama
    // dari pintu mana pun pemiliknya mengirimnya.
    await Share.share({ message: `Kode kebun ${name}: ${joinCode}` });
  }

  async function handleSave() {
    if (!farmId) {
      setFormError('Data kebun tidak ditemukan.');
      return;
    }

    setSubmitted(true);

    const errors = computeFieldErrors(name, areaSize);

    if (Object.keys(errors).length > 0) {
      return;
    }

    const parsedAreaSize = parseAreaSize(areaSize);

    if (parsedAreaSize instanceof Error) {
      return;
    }

    setSaving(true);
    setFormError(null);

    const result = await updateFarmProfile({
      areaSize: parsedAreaSize,
      farmId,
      location,
      name,
    });

    if (result.error) {
      setFormError(result.error.message);
      setSaving(false);
      return;
    }

    await refresh();
    setSaving(false);
    setSubmitted(false);
    setBaseline({ areaSize, location, name });
    // Kembali ke mode bacaan, BUKAN keluar dari layar. Yang baru saja disimpan
    // adalah tampilan layar ini sendiri; memulangkan pemilik ke layar Profil
    // berarti menyembunyikan hasil pekerjaannya sendiri.
    setEditing(false);
    showSnackbar('Perubahan disimpan');
  }

  if (!isOwnerActive(currentFarm)) {
    return (
      <Screen header={<TopAppBar title="Data kebun" onBack={() => router.back()} />}>
        <EmptyState title="Akses tidak tersedia" subtitle="Data kebun hanya tersedia untuk pemilik aktif." />
      </Screen>
    );
  }

  if (loading) {
    return (
      <LoadingState
        header={<TopAppBar title="Data kebun" onBack={() => router.back()} />}
        message="Memuat kebun..."
      />
    );
  }

  const gridLabel =
    grid.rows === undefined || grid.columns === undefined
      ? undefined
      : `${grid.rows} baris × ${grid.columns} kolom`;

  return (
    <Screen
      header={<TopAppBar title="Data kebun" onBack={handleBackPress} />}
      // BAR AKSI BERGANTI ISI menurut modenya, bukan bertambah. Dalam mode
      // bacaan ada dua tombol: berbagi kode (yang paling sering dilakukan
      // pemilik di layar ini) sebagai tombol utama, dan masuk mode isian sebagai
      // tombol sekunder. Dalam mode isian tinggal satu, yaitu menyimpan —
      // membatalkan sudah dikerjakan chevron kembali beserta penjaganya.
      stickyFooter={
        editing ? (
          <Button title="Simpan perubahan" loading={saving} onPress={handleSave} />
        ) : (
          <View style={{ gap: tokens.space.sm }}>
            <Button
              title="Bagikan kode"
              variant="primary"
              disabled={!joinCode}
              onPress={() => void handleShareJoinCode()}
            />
            <Button
              title="Edit"
              variant="secondary"
              emphasis="strong"
              onPress={() => setEditing(true)}
            />
          </View>
        )
      }
    >
      <ErrorBanner message={formError ?? authError?.message} />

      {editing ? (
        <View style={{ gap: tokens.space.xl }}>
          {/* SATU BARIS PENEGAS, dan ia hanya ada dalam mode isian. Yang
              dijawabnya adalah pertanyaan yang muncul justru karena mode ini
              menggantikan isi layar: kode kebun dan baris ukuran denah yang
              tadi terbaca di sini mendadak tidak ada, dan tanpa kalimat ini
              ketiadaan itu bisa dibaca sebagai "keduanya ikut terhapus". */}
          <Text
            selectable
            style={{
              color: tokens.color.text.secondary,
              fontSize: tokens.type.bodySmall.fontSize,
              lineHeight: tokens.type.bodySmall.lineHeight,
            }}
          >
            Kode kebun dan ukuran denah tidak diubah di sini.
          </Text>

          {/* `editing` pada <Field> dibuat di batch 1a persis untuk layar
              bermode tampil-lalu-edit seperti ini: garisnya jadi accent 1,5px,
              jadi ketiga kolom yang sedang bisa diubah terbaca sebagai satu
              kelompok yang menyala — bukan sekadar tiga kotak yang kebetulan
              muncul. */}
          <Field
            editing
            error={fieldErrors.name}
            label="Nama kebun"
            placeholder="Nama kebun"
            value={name}
            onChangeText={setName}
          />
          {/* `optional` dipakai di dua kolom ini dan TIDAK di nama. Itu mengikuti
              database apa adanya: farms.location dan farms.area_size keduanya
              boleh null (migrasi 002), nama tidak. Menandai yang opsional dengan
              kata — bukan membubuhi bintang pada yang wajib — adalah aturan yang
              sudah ditetapkan pada prop itu sendiri. */}
          <Field
            editing
            label="Lokasi"
            optional
            placeholder="Lokasi kebun"
            value={location}
            onChangeText={setLocation}
          />
          <Field
            editing
            error={fieldErrors.areaSize}
            keyboardType="decimal-pad"
            label="Luas lahan"
            optional
            placeholder="Contoh: 1200"
            // Satuan DI DALAM kolom, bukan diimbuhkan ke label. Ia bagian dari
            // angka yang sedang diketik, bukan bagian dari pertanyaannya. m²
            // bukan satuan yang dipilih di sini: formatArea sudah memakainya di
            // Beranda dan di layar Gabung kebun sejak sebelum batch ini.
            unit="m²"
            value={areaSize}
            onChangeText={setAreaSize}
          />
        </View>
      ) : (
        <>
          {/* KEPALA LAYAR, susunannya sejajar dengan detail catatan pohon
              (batch 5) dan detail jadwal (batch 6a): nilai utama serif, lalu
              baris fakta berlabel. Nama kebun adalah nilai utama layar ini —
              ia satu-satunya hal di sini yang dinamai manusia. */}
          <View style={{ gap: tokens.space.xs }}>
            <Text
              accessibilityRole="header"
              selectable
              style={{ ...typeScale.stat36, color: palette.textPrimary }}
            >
              {name}
            </Text>
            {location.trim() ? (
              <Text
                selectable
                style={{
                  color: tokens.color.text.secondary,
                  fontSize: tokens.type.body.fontSize,
                  lineHeight: tokens.type.body.lineHeight,
                }}
              >
                {location.trim()}
              </Text>
            ) : null}
          </View>

          {/* BARIS FAKTA, dan isinya HANYA luas lahan.
              §39 meminta "luas lahan · jumlah pohon". Jumlah pohon tidak ada di
              baris farms yang dibaca layar ini; satu-satunya sumbernya adalah
              hitungan atas tabel trees, dan mengambilnya dari sini berarti kueri
              baru — yang dilarang batasan keras batch ini. Angkanya karena itu
              tidak dikarang dan tidak pula diganti "-": barisnya memang tidak
              ada.

              formatArea, bukan angka mentah: ia yang sudah memformat luas di
              Beranda dan di kartu pratinjau layar Gabung kebun, lengkap dengan
              pemisah ribuan Indonesia dan satuan m². */}
          <MetaRow label="Luas lahan" value={formatArea(parseAreaSizeValue(areaSize))} />

          {/* SATU-SATUNYA jalan masuk ke /owner/farm-grid di seluruh aplikasi.
              Barisnya dicabut dari Beranda di batch 3 dan sengaja TIDAK dibuat
              ulang di layar Profil pada batch ini: ukuran denah adalah setelan
              kebun, dan kebun sudah punya satu pintu, yaitu layar ini.

              Angkanya jadi `meta` pada baris, bukan kalimat terpisah di
              bawahnya. Hanya dirender saat KEDUA angkanya terbaca — "0 × 0"
              adalah angka bohong yang terlihat persis seperti angka benar. */}
          <MenuRowGroup>
            <MenuRow
              icon="adjustments-horizontal"
              label="Ukuran denah"
              meta={gridLabel}
              onPress={() => router.push('/owner/farm-grid')}
            />
          </MenuRowGroup>

          {joinCode ? (
            <View style={{ gap: tokens.space.sm }}>
              <SectionLabel title="Kode kebun" />
              <JoinCodeBlocks code={joinCode} />
              {/* SATU kalimat, dan ia kalimat perintah, bukan keterangan.
                  "Kode kebun untuk bergabung" hanya menamai benda yang sudah
                  dinamai labelnya; yang belum diketahui pemilik baru adalah apa
                  yang harus ia LAKUKAN dengan deretan huruf itu. */}
              <Text
                selectable
                style={{
                  color: tokens.color.text.secondary,
                  fontSize: tokens.type.bodySmall.fontSize,
                  lineHeight: tokens.type.bodySmall.lineHeight,
                }}
              >
                Berikan kode ini kepada pekerja.
              </Text>
            </View>
          ) : null}
        </>
      )}

      <ConfirmDialog
        cancelLabel="Buang perubahan"
        cancelTone="danger"
        confirmLabel="Lanjut isi"
        message="Perubahan pada data kebun belum disimpan. Kalau keluar sekarang, perubahan itu hilang."
        onCancel={() => {
          setConfirmDiscard(false);
          leaveEditMode();
        }}
        onConfirm={() => setConfirmDiscard(false)}
        title="Perubahan belum disimpan"
        visible={confirmDiscard}
      />
    </Screen>
  );
}

// Kode kebun sebagai petak besar, BENTUK YANG SAMA dengan kolom kode di layar
// Gabung kebun — petak berdampingan, satu huruf per petak, lebarnya dibagi rata.
// Kesamaan itu bukan kerapian: pekerja mengetik kodenya ke dalam delapan petak,
// dan pemilik membacakannya dari delapan petak yang sama. Dua orang yang sedang
// menyebut deretan huruf yang sama lewat telepon harus melihat bentuk yang sama.
//
// Jumlah petak diturunkan dari PANJANG KODENYA, bukan dari konstanta. Kode
// dibuat database oleh generate_join_code() sebagai delapan karakter heksadesimal
// kapital (migrasi 006) — spek §39 menulis 6 dan itu keliru terhadap data —
// tapi layar ini tidak perlu memegang angkanya sendiri: ia menampilkan kode yang
// sudah ada, bukan meminta kode yang belum ada.
//
// BACA-SAJA. Tidak ada TextInput yang dibentangkan di atasnya seperti di layar
// Gabung kebun, dan tidak ada yang bisa ditekan: menyalin dikerjakan tekan-lama
// lewat `selectable`, dan mengirimkannya dikerjakan tombol "Bagikan kode" di bar
// aksi — jalur yang jauh lebih pendek daripada salin-lalu-pindah-aplikasi.
function JoinCodeBlocks({ code }: { code: string }) {
  const characters = Array.from(code);

  return (
    <View
      accessibilityLabel={`Kode kebun ${characters.join(' ')}`}
      accessibilityRole="text"
      style={{ flexDirection: 'row', gap: 6 }}
    >
      {characters.map((character, index) => (
        <View
          key={index}
          style={{
            alignItems: 'center',
            backgroundColor: palette.surfaceRaised,
            borderColor: palette.borderStrong,
            borderCurve: 'continuous',
            borderRadius: shapeRadius.control,
            borderWidth: 1,
            // flex 1, bukan lebar tetap: delapan petak harus muat di layar
            // tersempit tanpa angka yang ditebak per perangkat.
            flex: 1,
            height: touch.field,
            justifyContent: 'center',
          }}
        >
          <Text
            selectable
            style={{ color: palette.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: 20 }}
          >
            {character}
          </Text>
        </View>
      ))}
    </View>
  );
}

function computeFieldErrors(name: string, areaSize: string): { areaSize?: string; name?: string } {
  const errors: { areaSize?: string; name?: string } = {};

  if (!name.trim()) {
    errors.name = 'Nama kebun wajib diisi.';
  }

  const parsedAreaSize = parseAreaSize(areaSize);

  if (parsedAreaSize instanceof Error) {
    errors.areaSize = parsedAreaSize.message;
  }

  return errors;
}

function parseAreaSize(value: string): number | null | Error {
  const normalized = value.trim().replace(',', '.');

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return new Error('Luas lahan harus lebih dari 0.');
  }

  return parsed;
}

// Pembungkus untuk MODE BACAAN: parseAreaSize mengembalikan Error untuk isian
// yang tidak sah, dan mode bacaan tidak punya tempat untuk menampilkan galat —
// nilainya selalu datang dari database, jadi satu-satunya kemungkinan gagal di
// sini adalah kolom yang memang kosong.
function parseAreaSizeValue(value: string): number | null {
  const parsed = parseAreaSize(value);

  return parsed instanceof Error ? null : parsed;
}
