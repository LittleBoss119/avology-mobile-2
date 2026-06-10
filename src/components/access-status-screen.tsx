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
    await signOut();
    setLoggingOut(false);
    router.replace('/get-started');
  }

  return (
    <Screen
      footer={
        <>
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
