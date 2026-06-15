import { router } from 'expo-router';
import React from 'react';

import { useAuth } from '../context/auth-context';
import { Button, Card, ErrorBanner, LoadingState, MetaRow, PageIntro, Screen } from './ui';

export function AccessStatusScreen({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  const { currentFarm, error, refresh, signOut } = useAuth();
  const [refreshing, setRefreshing] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);

  if (!currentFarm) {
    return <LoadingState message="Memuat status membership..." />;
  }

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
    router.replace('/');
  }

  async function handleLogout() {
    setLoggingOut(true);
    const signOutError = await signOut();
    setLoggingOut(false);

    if (!signOutError) {
      router.replace('/get-started');
    }
  }

  const canReturnToAccessFlow = currentFarm.status === 'rejected' || currentFarm.status === 'removed';

  return (
    <Screen
      footer={
        <>
          {canReturnToAccessFlow ? (
            <>
              <Button title="Kembali ke Pilih Akses" variant="secondary" onPress={() => router.push('/onboarding')} />
              <Button title="Gabung Kebun Lagi" variant="secondary" onPress={() => router.push('/join-farm')} />
            </>
          ) : null}
          <Button title="Refresh Status" loading={refreshing} onPress={handleRefresh} />
          <Button title="Logout" variant="secondary" loading={loggingOut} onPress={handleLogout} />
        </>
      }
    >
      <PageIntro title={title} subtitle={subtitle} />
      <ErrorBanner message={error?.message} />
      <Card>
        <MetaRow label="Role" value={currentFarm.role} />
        <MetaRow label="Status" value={currentFarm.status} />
      </Card>
    </Screen>
  );
}
