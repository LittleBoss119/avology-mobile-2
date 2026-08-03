import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Text, TextInput, View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
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

  const farmId = currentFarm?.farmId;
  const fieldErrors = submitted ? computeFieldErrors(name, areaSize) : {};

  const syncForm = React.useCallback((nextFarm: Farm) => {
    setName(nextFarm.name);
    setLocation(nextFarm.location ?? '');
    setAreaSize(nextFarm.areaSize === null || nextFarm.areaSize === undefined ? '' : String(nextFarm.areaSize));
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
        <TopAppBar title="Edit kebun" onBack={() => router.back()} />
        <EmptyState title="Akses tidak tersedia" subtitle="Edit kebun hanya tersedia untuk pemilik aktif." />
      </Screen>
    );
  }

  if (loading) {
    return <LoadingState message="Memuat kebun..." />;
  }

  return (
    <Screen>
      <TopAppBar title="Edit kebun" onBack={() => router.back()} />
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
    </Screen>
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
