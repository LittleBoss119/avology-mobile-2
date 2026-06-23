import { router } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

import { useAuth } from '../context/auth-context';
import { updateCurrentProfile } from '../services/authService';
import { isOwnerActive } from '../utils/routeGuard';
import {
  BrandMark,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  MetaRow,
  PageIntro,
  Screen,
  SuccessBanner,
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

  const canOpenFarmProfile = isOwnerActive(currentFarm);

  return (
    <Screen
      footer={
        <>
          {profile && isEditing ? (
            <>
              <Button title="Simpan Profil Akun" loading={saving} disabled={loggingOut} onPress={handleSave} />
              <Button
                title="Batal"
                variant="secondary"
                disabled={saving || loggingOut}
                onPress={handleCancelEdit}
              />
            </>
          ) : null}
          {profile && !isEditing ? (
            <Button
              title="Edit Profil Akun"
              variant="secondary"
              disabled={loggingOut}
              onPress={() => setIsEditing(true)}
            />
          ) : null}
          <Button title="Keluar" variant="danger" loading={loggingOut} disabled={saving} onPress={handleLogout} />
        </>
      }
    >
      <BrandMark compact />
      <PageIntro title="Profil Akun" subtitle="Kelola data pribadi akun Avology kamu." />
      <ErrorBanner message={formError ?? error?.message} />
      <SuccessBanner message={successMessage} />

      {!profile ? (
        <EmptyState title="Profil tidak tersedia" subtitle="Masuk ulang jika data akun belum muncul." />
      ) : (
        <Card variant="highlight">
          <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '700' }}>
            Profil Akun
          </Text>
          {isEditing ? (
            <>
              <Field label="Nama lengkap" value={fullName} onChangeText={setFullName} placeholder="Nama lengkap" />
              <Field
                label="Nomor HP"
                value={phone}
                onChangeText={setPhone}
                placeholder="Nomor HP"
                keyboardType="phone-pad"
              />
              {profile.email ? <MetaRow label="Email login" value={profile.email} /> : null}
            </>
          ) : (
            <>
              <MetaRow label="Nama lengkap" value={profile.fullName} />
              <MetaRow label="Nomor HP" value={profile.phone} />
              {profile.email ? <MetaRow label="Email login" value={profile.email} /> : null}
            </>
          )}
        </Card>
      )}

      {canOpenFarmProfile ? (
        <Card>
          <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '700' }}>
            Kebun Saya
          </Text>
          <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
            Area khusus pemilik untuk melihat data kebun, kode gabung, pekerja, dan SOP.
          </Text>
          <Button title="Buka Profil Kebun" variant="secondary" onPress={() => router.push('/owner/farm-profile')} />
        </Card>
      ) : null}
    </Screen>
  );
}
