import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Alert, Text, TextInput, View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  MetaRow,
  PageIntro,
  Screen,
  SectionHeader,
  SuccessBanner,
} from '../../../src/components/ui';
import { colors, radius, spacing } from '../../../src/constants/theme';
import { useAuth } from '../../../src/context/auth-context';
import { getFarmDetail, updateFarmProfile } from '../../../src/services/farmService';
import type { Farm } from '../../../src/types/domain';
import { isOwnerActive } from '../../../src/utils/routeGuard';

export default function OwnerFarmProfileScreen() {
  const { currentFarm, error: authError, refresh } = useAuth();
  const [areaSize, setAreaSize] = React.useState('');
  const [editMode, setEditMode] = React.useState(false);
  const [farm, setFarm] = React.useState<Farm | null>(currentFarm?.farm ?? null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [location, setLocation] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [name, setName] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const farmId = currentFarm?.farmId;

  function syncForm(nextFarm: Farm) {
    setName(nextFarm.name);
    setLocation(nextFarm.location ?? '');
    setAreaSize(nextFarm.areaSize === null || nextFarm.areaSize === undefined ? '' : String(nextFarm.areaSize));
  }

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
          setFarm(currentFarm?.farm ?? null);
        } else {
          setFarm(result.data);
          syncForm(result.data);
        }

        setLoading(false);
      }

      void loadFarm();

      return () => {
        isActive = false;
      };
    }, [currentFarm, farmId])
  );

  function handleStartEdit() {
    if (farm) {
      syncForm(farm);
    }

    setFormError(null);
    setSuccessMessage(null);
    setEditMode(true);
  }

  function handleCancelEdit() {
    if (farm) {
      syncForm(farm);
    }

    setFormError(null);
    setEditMode(false);
  }

  async function handleSave() {
    if (!farmId) {
      setFormError('Data kebun tidak ditemukan.');
      return;
    }

    const parsedAreaSize = parseAreaSize(areaSize);

    if (parsedAreaSize instanceof Error) {
      setFormError(parsedAreaSize.message);
      return;
    }

    setSaving(true);
    setFormError(null);
    setSuccessMessage(null);

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

    const detailResult = await getFarmDetail(farmId);

    if (detailResult.error) {
      setFormError(detailResult.error.message);
      setSaving(false);
      return;
    }

    setFarm(detailResult.data);
    syncForm(detailResult.data);
    setEditMode(false);
    setSuccessMessage('Data kebun berhasil diperbarui');
    await refresh();
    setSaving(false);
  }

  function handleCopyFallback() {
    Alert.alert('Salin kode', 'Tekan lama kode bergabung untuk menyalin secara manual.');
  }

  if (!isOwnerActive(currentFarm)) {
    return (
      <Screen>
        <PageIntro title="Profil Kebun" subtitle="Profil kebun dan akses operasional." />
        <EmptyState title="Akses tidak tersedia" subtitle="Profil Kebun hanya tersedia untuk pemilik aktif." />
      </Screen>
    );
  }

  if (loading) {
    return <LoadingState message="Memuat profil kebun..." />;
  }

  return (
    <Screen>
      <PageIntro title={editMode ? 'Edit kebun' : 'Profil Kebun'} subtitle="Data kebun, kode bergabung, dan akses operasional." />
      <ErrorBanner message={formError ?? authError?.message} />
      <SuccessBanner message={successMessage} />

      {!farm ? (
        <EmptyState title="Data kebun tidak tersedia" subtitle="Coba buka kembali halaman ini beberapa saat lagi." />
      ) : editMode ? (
        <Card variant="highlight">
          <SectionHeader title="Edit kebun" description="Ubah data dasar kebun tanpa mengubah kode bergabung." />
          <FarmTextField label="Nama kebun" value={name} onChangeText={setName} placeholder="Nama kebun" />
          <FarmTextField label="Lokasi" value={location} onChangeText={setLocation} placeholder="Lokasi kebun" />
          <FarmTextField
            keyboardType="decimal-pad"
            label="Luas kebun"
            value={areaSize}
            onChangeText={setAreaSize}
            placeholder="Contoh: 1200"
          />
          <View style={{ gap: spacing.sm }}>
            <Button title="Simpan perubahan" loading={saving} onPress={handleSave} />
            <Button title="Batal" disabled={saving} variant="secondary" onPress={handleCancelEdit} />
          </View>
        </Card>
      ) : (
        <>
          <Card variant="highlight">
            <SectionHeader title="Data Kebun" description="Profil kebun terpisah dari profil akun pribadi." />
            <MetaRow label="Nama kebun" value={farm.name} />
            <MetaRow label="Lokasi" value={farm.location} />
            <MetaRow label="Luas kebun" value={formatArea(farm.areaSize)} />
            <Button title="Edit kebun" onPress={handleStartEdit} />
          </Card>

          <Card>
            <SectionHeader title="Kode bergabung" description="Bagikan kode ini kepada pekerja yang perlu mengajukan akses." />
            <View
              style={{
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.border,
                borderRadius: radius.lg,
                borderWidth: 1,
                padding: spacing.lg,
              }}
            >
              <Text selectable style={{ color: colors.text, fontSize: 24, fontWeight: '700', letterSpacing: 0 }}>
                {farm.joinCode}
              </Text>
            </View>
            <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
              Tekan lama kode untuk menyalin secara manual.
            </Text>
            <Button title="Salin kode" variant="secondary" onPress={handleCopyFallback} />
          </Card>

          <Card>
            <SectionHeader title="Pengelolaan" description="Akses cepat untuk pengaturan operasional kebun." />
            <Button title="Manajemen Pekerja" variant="secondary" onPress={() => router.push('/owner/workers')} />
            <Button title="SOP Perawatan" variant="secondary" onPress={() => router.push('/owner/sops')} />
          </Card>
        </>
      )}
    </Screen>
  );
}

function FarmTextField({
  keyboardType,
  label,
  onChangeText,
  placeholder,
  value,
}: {
  keyboardType?: 'default' | 'decimal-pad';
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
        {label}
      </Text>
      <TextInput
        autoCorrect={false}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSoft}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          borderWidth: 1,
          color: colors.text,
          fontSize: 16,
          minHeight: 52,
          paddingHorizontal: spacing.lg,
        }}
        value={value}
      />
    </View>
  );
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

function formatArea(value?: number | null): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return `${new Intl.NumberFormat('id-ID').format(value)} meter persegi`;
}
