import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Icon } from '../../../src/components/icons';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  MenuRowGroup,
  Screen,
  TopAppBar,
} from '../../../src/components/ui';
import { useSnackbar } from '../../../src/components/snackbar';
import { colors, radius, spacing, tokens } from '../../../src/constants/theme';
import { useAuth } from '../../../src/context/auth-context';
import { getFarmDetail, updateFarmProfile } from '../../../src/services/farmService';
import type { Farm } from '../../../src/types/domain';
import { isOwnerActive } from '../../../src/utils/routeGuard';

export default function OwnerFarmProfileScreen() {
  const { currentFarm, error: authError, refresh } = useAuth();
  const showSnackbar = useSnackbar();
  const [areaSize, setAreaSize] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [location, setLocation] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [name, setName] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  // Ukuran petak, DARI BARIS Farm YANG SAMA yang sudah diambil layar ini lewat
  // getFarmDetail — tidak ada query tambahan. Sebelumnya nilainya ikut terbaca
  // lalu dibuang karena syncForm hanya menyimpan tiga medan formulir.
  //
  // Keduanya opsional di tipe Farm dan `undefined` berarti "belum terbaca",
  // BUKAN nol (lihat catatan pada Farm.gridRows di types/domain.ts). Karena itu
  // label sampingannya hanya dirender saat dua-duanya benar-benar ada.
  const [grid, setGrid] = React.useState<{ columns?: number; rows?: number }>({});

  const farmId = currentFarm?.farmId;
  const fieldErrors = submitted ? computeFieldErrors(name, areaSize) : {};

  const syncForm = React.useCallback((nextFarm: Farm) => {
    setName(nextFarm.name);
    setLocation(nextFarm.location ?? '');
    setAreaSize(nextFarm.areaSize === null || nextFarm.areaSize === undefined ? '' : String(nextFarm.areaSize));
    setGrid({ columns: nextFarm.gridColumns, rows: nextFarm.gridRows });
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
    showSnackbar('Perubahan disimpan');
    router.back();
  }

  if (!isOwnerActive(currentFarm)) {
    return (
      <Screen>
        <TopAppBar title="Data kebun" onBack={() => router.back()} />
        <EmptyState title="Akses tidak tersedia" subtitle="Data kebun hanya tersedia untuk pemilik aktif." />
      </Screen>
    );
  }

  if (loading) {
    return <LoadingState message="Memuat kebun..." />;
  }

  return (
    <Screen>
      <TopAppBar title="Data kebun" onBack={() => router.back()} />
      <ErrorBanner message={formError ?? authError?.message} />

      <Card>
        <FarmTextField
          error={fieldErrors.name}
          label="Nama kebun"
          value={name}
          onChangeText={setName}
          placeholder="Nama kebun"
        />
        <FarmTextField label="Lokasi" value={location} onChangeText={setLocation} placeholder="Lokasi kebun" />
        <FarmTextField
          error={fieldErrors.areaSize}
          keyboardType="decimal-pad"
          label="Luas kebun"
          value={areaSize}
          onChangeText={setAreaSize}
          placeholder="Contoh: 1200"
        />
        <Button title="Simpan perubahan" loading={saving} onPress={handleSave} />
      </Card>

      {/* Ukuran denah SENGAJA bukan isian di formulir di atas, dan itu bukan
          soal ruang: mengubah jumlah baris/kolom petak adalah keputusan
          struktural — ia menentukan posisi mana yang boleh ditanami — sedangkan
          formulir di atas hanya mengganti keterangan kebun. Menaruh keduanya di
          satu tombol simpan berarti satu ketukan bisa memindahkan dua hal yang
          risikonya jauh berbeda.

          Layar ini kini SATU-SATUNYA jalan masuk ke /owner/farm-grid, setelah
          barisnya dicabut dari Beranda dalam perubahan yang sama. */}
      <Card padding={tokens.layout.cardPadding}>
        <MenuRowGroup>
          <GridRow grid={grid} onPress={() => router.push('/owner/farm-grid')} />
        </MenuRowGroup>
      </Card>
    </Screen>
  );
}

// Baris "Ukuran denah". Bentuknya mengikuti NavRow di Beranda pemilik: ikon,
// judul, keterangan di kanan, chevron.
//
// Keterangannya hanya dirender saat KEDUA angkanya terbaca. `undefined` pada
// gridRows/gridColumns berarti barisnya farms memang belum terbaca, bukan nol —
// dan "0 × 0" adalah angka bohong yang terlihat persis seperti angka benar.
function GridRow({
  grid,
  onPress,
}: {
  grid: { columns?: number; rows?: number };
  onPress: () => void;
}) {
  const meta =
    grid.rows === undefined || grid.columns === undefined
      ? undefined
      : `${grid.rows} × ${grid.columns}`;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        flexDirection: 'row',
        gap: tokens.space.md,
        minHeight: tokens.layout.controlHeight,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon name="adjustments-horizontal" size={tokens.icon.md} color={tokens.color.brand.base} />
      <Text selectable style={{ ...tokens.type.body, color: tokens.color.text.primary, flex: 1 }}>
        Ukuran denah
      </Text>
      {meta ? (
        <Text
          selectable
          numberOfLines={1}
          style={{ ...tokens.type.meta, color: tokens.color.text.secondary }}
        >
          {meta}
        </Text>
      ) : null}
      <Icon name="chevron-right" size={tokens.icon.sm} color={tokens.color.text.tertiary} />
    </Pressable>
  );
}

function FarmTextField({
  error,
  keyboardType,
  label,
  onChangeText,
  placeholder,
  value,
}: {
  error?: string;
  keyboardType?: 'default' | 'decimal-pad';
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{label}</Text>
      <TextInput
        autoCorrect={false}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSoft}
        style={{
          backgroundColor: colors.surface,
          borderColor: error ? tokens.color.status.danger.text : colors.border,
          borderRadius: radius.lg,
          borderWidth: 1,
          color: colors.text,
          fontSize: 16,
          minHeight: 52,
          paddingHorizontal: spacing.lg,
        }}
        value={value}
      />
      {error ? (
        <Text style={{ color: tokens.color.status.danger.text, fontSize: tokens.type.meta.fontSize, lineHeight: tokens.type.meta.lineHeight }}>
          {error}
        </Text>
      ) : null}
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
    return new Error('Luas kebun harus lebih dari 0.');
  }

  return parsed;
}
