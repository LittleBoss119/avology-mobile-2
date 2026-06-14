import { Redirect, Stack, useFocusEffect, usePathname } from 'expo-router';
import React from 'react';

import { LoadingState } from '../../src/components/ui';
import { useAuth } from '../../src/context/auth-context';
import { getHomeRoute, isAllowedOnboardingRoute } from '../../src/utils/routeGuard';

export default function OnboardingLayout() {
  const { currentFarm, initializing, profile, refresh } = useAuth();
  const [checkingAccess, setCheckingAccess] = React.useState(false);
  const pathname = usePathname();

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;

      setCheckingAccess(true);
      refresh().finally(() => {
        if (isActive) {
          setCheckingAccess(false);
        }
      });

      return () => {
        isActive = false;
      };
    }, [refresh])
  );

  if (initializing || checkingAccess) {
    return <LoadingState message="Memeriksa sesi..." />;
  }

  if (!profile) {
    return <Redirect href="/get-started" />;
  }

  if (!isAllowedOnboardingRoute(pathname, profile, currentFarm)) {
    return <Redirect href={getHomeRoute(profile, currentFarm)} />;
  }

  return (
    <Stack
      screenOptions={{
        headerBackTitle: 'Kembali',
        headerShadowVisible: false,
        contentStyle: { backgroundColor: '#F6F7F2' },
      }}
    >
      <Stack.Screen name="onboarding" options={{ title: 'Mulai' }} />
      <Stack.Screen name="create-farm" options={{ title: 'Buat Kebun' }} />
      <Stack.Screen name="join-farm" options={{ title: 'Gabung Kebun' }} />
      <Stack.Screen name="pending-approval" options={{ title: 'Menunggu Approval' }} />
      <Stack.Screen name="rejected" options={{ title: 'Akses Ditolak' }} />
      <Stack.Screen name="removed-access" options={{ title: 'Akses Dinonaktifkan' }} />
    </Stack>
  );
}
