import { router } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../constants/theme';
import { useAuth } from '../context/auth-context';
import { updateCurrentProfile } from '../services/authService';
import type { CurrentUserFarm } from '../types/domain';
import { formatPersonDisplayName } from '../utils/displayFormat';
import { isOwnerActive, isWorkerActive } from '../utils/routeGuard';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  FormSection,
  MetaRow,
  Screen,
  SuccessBanner,
  TopAppBar,
} from './ui';

export function ProfileScreen() {
  const { currentFarm, error, profile, refresh, signOut } = useAuth();
  const [isEditing, setIsEditing] = React.useState(false);
  const [fullName, setFullName] = React.useState(profile?.fullName ?? '');
  const [phone, setPhone] = React.useState(profile?.phone ?? '');
  const [saving, setSaving] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isEditing) {
      setFullName(profile?.fullName ?? '');
      setPhone(profile?.phone ?? '');
    }
  }, [isEditing, profile?.fullName, profile?.phone]);

  async function handleSave() {
    const nextFullName = fullName.trim();

    if (!nextFullName) {
      setFormError('Nama lengkap wajib diisi.');
      return;
    }

    setSaving(true);
    setFormError(null);
    setSuccessMessage(null);

    const result = await updateCurrentProfile({
      fullName: nextFullName,
      phone,
    });

    if (result.error) {
      setFormError(result.error.message);
      setSaving(false);
      return;
    }

    await refresh();
    setSaving(false);
    setIsEditing(false);
    setSuccessMessage('Profil akun berhasil diperbarui.');
  }

  async function handleLogout() {
    setLoggingOut(true);
    setFormError(null);

    const result = await signOut();

    if (result) {
      setFormError(result.message);
      setLoggingOut(false);
      return;
    }

    setLoggingOut(false);
    router.replace('/get-started');
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setFormError(null);
    setFullName(profile?.fullName ?? '');
    setPhone(profile?.phone ?? '');
  }

  const farmHubRoute = getFarmHubRoute(currentFarm);
  const roleLabel = getRoleLabel(currentFarm);
  const activeFarmName = currentFarm?.farm?.name ?? null;
  const displayName = formatPersonDisplayName(profile?.fullName, 'Pengguna Avology');
  const initial = getProfileInitial(displayName);

  return (
    <Screen>
      <TopAppBar
        title={isEditing ? 'Edit Profil' : 'Profil Akun'}
        onBack={farmHubRoute ? () => router.replace(farmHubRoute) : undefined}
      />
      <ErrorBanner message={formError ?? error?.message} />
      <SuccessBanner message={successMessage} />

      {!profile ? (
        <EmptyState title="Profil tidak tersedia" subtitle="Masuk ulang jika data akun belum muncul." />
      ) : isEditing ? (
        <FormSection title="Data Pribadi" description="Perbarui nama dan nomor HP yang digunakan pada akun Avology.">
          <Field label="Nama lengkap" value={fullName} onChangeText={setFullName} placeholder="Nama lengkap" />
          <Field
            label="Nomor HP"
            value={phone}
            onChangeText={setPhone}
            placeholder="Nomor HP"
            keyboardType="phone-pad"
          />
          {profile.email ? <MetaRow label="Email login" value={profile.email} /> : null}
          <Button title="Simpan Perubahan" loading={saving} disabled={loggingOut} onPress={handleSave} />
          <Button
            title="Batal"
            variant="secondary"
            disabled={saving || loggingOut}
            onPress={handleCancelEdit}
          />
        </FormSection>
      ) : (
        <>
          <Card variant="highlight">
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
              <View
                style={{
                  alignItems: 'center',
                  backgroundColor: colors.primarySoft,
                  borderColor: colors.primaryBorder,
                  borderRadius: radius.round,
                  borderWidth: 1,
                  height: 58,
                  justifyContent: 'center',
                  width: 58,
                }}
              >
                <Text selectable style={{ color: colors.primary, fontSize: 24, fontWeight: '900' }}>
                  {initial}
                </Text>
              </View>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text selectable style={{ color: colors.text, fontSize: typography.h3.fontSize, fontWeight: '800', lineHeight: typography.h3.lineHeight }}>
                  {displayName}
                </Text>
                <View style={{ alignItems: 'flex-start' }}>
                  <Badge label={roleLabel} tone={currentFarm?.status === 'active' ? 'info' : 'neutral'} />
                </View>
                {activeFarmName ? (
                  <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
                    {activeFarmName}
                  </Text>
                ) : null}
              </View>
            </View>
          </Card>

          <Card>
            <Text selectable style={{ color: colors.text, fontSize: typography.h3.fontSize, fontWeight: '800' }}>
              Informasi Akun
            </Text>
            <View style={{ gap: spacing.md }}>
              <MetaRow label="Nama lengkap" value={profile.fullName} />
              <MetaRow label="Nomor HP" value={profile.phone} />
              {profile.email ? <MetaRow label="Email login" value={profile.email} /> : null}
              <MetaRow label="Role aktif" value={roleLabel} />
              <MetaRow label="Kebun aktif" value={activeFarmName ?? 'Belum terhubung'} />
            </View>
          </Card>

          <Card>
            <Text selectable style={{ color: colors.text, fontSize: typography.h3.fontSize, fontWeight: '800' }}>
              Aksi Akun
            </Text>
            <Button
              title="Edit Profil Akun"
              variant="secondary"
              disabled={loggingOut}
              onPress={() => setIsEditing(true)}
            />
            {farmHubRoute ? (
              <Button
                title="Buka Tab Kebun"
                variant="secondary"
                disabled={loggingOut}
                onPress={() => router.replace(farmHubRoute)}
              />
            ) : null}
          </Card>

          <Card>
            <Text selectable style={{ color: colors.danger, fontSize: typography.h3.fontSize, fontWeight: '800' }}>
              Keluar Akun
            </Text>
            <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
              Gunakan aksi ini untuk keluar dari akun Avology di perangkat ini.
            </Text>
            <Button title="Keluar Akun" variant="danger" loading={loggingOut} disabled={saving} onPress={handleLogout} />
          </Card>
        </>
      )}
    </Screen>
  );
}

function getFarmHubRoute(currentFarm: CurrentUserFarm | null): '/owner/farm' | '/worker/farm' | null {
  if (isOwnerActive(currentFarm)) {
    return '/owner/farm';
  }

  if (isWorkerActive(currentFarm)) {
    return '/worker/farm';
  }

  return null;
}

function getRoleLabel(currentFarm: CurrentUserFarm | null): string {
  if (isOwnerActive(currentFarm)) {
    return 'Pemilik';
  }

  if (isWorkerActive(currentFarm)) {
    return 'Pekerja';
  }

  return 'Belum terhubung';
}

function getProfileInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || 'A';
}
