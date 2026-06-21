import { router } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

import { useAuth } from '../context/auth-context';
import { formatMemberStatus, formatRole } from '../utils/displayFormat';
import { Button, Card, EmptyState, ErrorBanner, MetaRow, PageIntro, Screen } from './ui';

export function ProfileScreen() {
  const { currentFarm, error, profile, signOut } = useAuth();
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [logoutError, setLogoutError] = React.useState<string | null>(null);

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError(null);

    const result = await signOut();

    if (result) {
      setLogoutError(result.message);
      setLoggingOut(false);
      return;
    }

    setLoggingOut(false);
    router.replace('/get-started');
  }

  return (
    <Screen
      footer={
        <>
          <Button title="Keluar" variant="danger" loading={loggingOut} onPress={handleLogout} />
        </>
      }
    >
      <PageIntro title="Profil" subtitle="Data akun dan akses kebun saat ini." />
      <ErrorBanner message={logoutError ?? error?.message} />

      {!profile ? (
        <EmptyState title="Profil tidak tersedia" subtitle="Muat ulang halaman atau masuk ulang." />
      ) : (
        <Card>
          <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '700' }}>
            Akun
          </Text>
          <MetaRow label="Nama" value={profile.fullName} />
          <MetaRow label="Nomor HP" value={profile.phone} />
        </Card>
      )}

      {!currentFarm ? (
        <EmptyState title="Belum ada akses kebun" subtitle="Buat kebun atau ajukan gabung kebun dari onboarding." />
      ) : (
        <Card>
          <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '700' }}>
            Kebun
          </Text>
          <MetaRow label="Nama kebun" value={currentFarm.farm?.name} />
          <MetaRow label="Peran" value={formatRole(currentFarm.role)} />
          <MetaRow label="Status" value={formatMembershipStatus(currentFarm.status)} />
          {currentFarm.role === 'owner' ? <MetaRow label="Kode gabung" value={currentFarm.farm?.joinCode} /> : null}
        </Card>
      )}
    </Screen>
  );
}

function formatMembershipStatus(status: string): string {
  return formatMemberStatus(status);
}
