import { router } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

import { useAuth } from '../context/auth-context';
import { Button, Card, EmptyState, ErrorBanner, MetaRow, PageIntro, Screen } from './ui';

export function ProfileScreen() {
  const { currentFarm, error, profile, refresh, signOut } = useAuth();
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [logoutError, setLogoutError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    setLogoutError(null);
    await refresh();
    setRefreshing(false);
  }

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
          <Button title="Refresh" variant="secondary" loading={refreshing} onPress={handleRefresh} />
          <Button title="Logout" variant="danger" loading={loggingOut} onPress={handleLogout} />
        </>
      }
    >
      <PageIntro title="Profile" subtitle="Data akun dan akses kebun saat ini." />
      <ErrorBanner message={logoutError ?? error?.message} />

      {!profile ? (
        <EmptyState title="Profil tidak tersedia" subtitle="Coba refresh atau login ulang." />
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
          <MetaRow label="Role" value={formatRole(currentFarm.role)} />
          <MetaRow label="Status" value={formatMembershipStatus(currentFarm.status)} />
          {currentFarm.role === 'owner' ? <MetaRow label="Join code" value={currentFarm.farm?.joinCode} /> : null}
        </Card>
      )}
    </Screen>
  );
}

function formatRole(role: string): string {
  return role === 'owner' ? 'Owner' : 'Worker';
}

function formatMembershipStatus(status: string): string {
  const labels: Record<string, string> = {
    active: 'Aktif',
    pending: 'Menunggu approval',
    rejected: 'Ditolak',
    removed: 'Dinonaktifkan',
  };

  return labels[status] ?? status;
}
