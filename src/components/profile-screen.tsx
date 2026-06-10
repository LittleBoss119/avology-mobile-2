import { router } from 'expo-router';
import React from 'react';

import { useAuth } from '../context/auth-context';
import { Button, Card, ErrorBanner, MetaRow, PageIntro, Screen } from './ui';

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
    <Screen footer={<Button title="Logout" variant="danger" loading={loggingOut} onPress={handleLogout} />}>
      <PageIntro title="Profile" subtitle="Data akun dan membership saat ini." />
      <ErrorBanner message={logoutError ?? error?.message} />
      <Card>
        <MetaRow label="Nama" value={profile?.fullName} />
        <MetaRow label="Nomor HP" value={profile?.phone} />
        <MetaRow label="User ID" value={profile?.id} />
      </Card>
      <Card>
        <MetaRow label="Role" value={currentFarm?.role} />
        <MetaRow label="Status" value={currentFarm?.status} />
        <MetaRow label="Farm ID" value={currentFarm?.farmId} />
      </Card>
    </Screen>
  );
}
