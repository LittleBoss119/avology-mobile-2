import { router, useFocusEffect } from 'expo-router';
import React from 'react';

import { useAuth } from '../context/auth-context';
import { formatMemberStatus, formatRole } from '../utils/displayFormat';
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

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;

      setRefreshing(true);
      refresh().finally(() => {
        if (isActive) {
          setRefreshing(false);
        }
      });

      return () => {
        isActive = false;
      };
    }, [refresh])
  );

  if (!currentFarm) {
    return <LoadingState message="Memuat status akses..." />;
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
  const canManuallyCheckStatus = currentFarm.status === 'pending';
  const inactiveRecoveryParams = { inactiveRecovery: '1' };

  return (
    <Screen
      footer={
        <>
          {canReturnToAccessFlow ? (
            <>
              <Button
                title="Kembali ke Pilih Akses"
                variant="secondary"
                onPress={() =>
                  router.replace({
                    pathname: '/onboarding',
                    params: inactiveRecoveryParams,
                  })
                }
              />
              <Button
                title="Gabung Kebun Lagi"
                variant="secondary"
                onPress={() =>
                  router.replace({
                    pathname: '/join-farm',
                    params: inactiveRecoveryParams,
                  })
                }
              />
            </>
          ) : null}
          <Button title="Profil Akun" variant="secondary" size="small" onPress={() => router.push('/profile')} />
          {canManuallyCheckStatus ? (
            <Button title="Cek Status" variant="secondary" size="small" loading={refreshing} onPress={handleRefresh} />
          ) : null}
          <Button title="Keluar" variant="secondary" loading={loggingOut} onPress={handleLogout} />
        </>
      }
    >
      <PageIntro title={title} subtitle={subtitle} />
      <ErrorBanner message={error?.message} />
      <Card>
        <MetaRow label="Peran" value={formatRole(currentFarm.role)} />
        <MetaRow label="Status" value={formatMemberStatus(currentFarm.status)} />
      </Card>
    </Screen>
  );
}
