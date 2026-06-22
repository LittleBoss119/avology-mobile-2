import { router, Stack, useFocusEffect, usePathname } from 'expo-router';
import React from 'react';

import { LoadingState } from '../../src/components/ui';
import { useAuth } from '../../src/context/auth-context';
import {
  logAccessGuardDecision,
  resolveAccessRoute,
  shouldRedirectAccess,
} from '../../src/utils/routeGuard';

export default function OnboardingLayout() {
  const { currentFarm, initializing, profile, refresh } = useAuth();
  const [checkingAccess, setCheckingAccess] = React.useState(false);
  const pathname = usePathname();
  const loading = initializing || checkingAccess;
  const targetRoute = resolveAccessRoute({ session: profile, membership: currentFarm });
  const sessionUserId = profile?.id ?? null;
  const membershipKey = currentFarm
    ? `${currentFarm.membershipId}:${currentFarm.role}:${currentFarm.status}`
    : 'none';

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

  React.useEffect(() => {
    if (loading) {
      return;
    }

    const shouldRedirect = shouldRedirectAccess(pathname, targetRoute, currentFarm);

    logAccessGuardDecision({
      currentPathname: pathname,
      membership: currentFarm,
      redirect: shouldRedirect,
      session: profile,
      targetRoute,
    });

    if (shouldRedirect) {
      router.replace(targetRoute);
    }
  }, [loading, membershipKey, pathname, sessionUserId, targetRoute]);

  if (loading) {
    return <LoadingState message="Memeriksa sesi..." />;
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
      <Stack.Screen name="profile" options={{ title: 'Profil Akun' }} />
      <Stack.Screen name="pending-approval" options={{ title: 'Menunggu Persetujuan' }} />
      <Stack.Screen name="rejected" options={{ title: 'Akses Ditolak' }} />
      <Stack.Screen name="removed-access" options={{ title: 'Akses Dinonaktifkan' }} />
    </Stack>
  );
}
