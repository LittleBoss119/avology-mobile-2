import { router, Stack, useFocusEffect, useLocalSearchParams, usePathname } from 'expo-router';
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
  const { inactiveRecovery } = useLocalSearchParams<{ inactiveRecovery?: string }>();
  const [checkingAccess, setCheckingAccess] = React.useState(false);
  const pathname = usePathname();
  const loading = initializing || checkingAccess;
  const allowInactiveAccessRecovery = inactiveRecovery === '1';
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

    const shouldRedirect = shouldRedirectAccess(pathname, targetRoute, currentFarm, {
      allowInactiveAccessRecovery,
    });

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
  }, [allowInactiveAccessRecovery, loading, membershipKey, pathname, sessionUserId, targetRoute]);

  if (loading) {
    return <LoadingState message="Memeriksa akses..." />;
  }

  return (
    <Stack
      screenOptions={{
        headerBackTitle: 'Kembali',
        headerStyle: { backgroundColor: '#F7FAF3' },
        headerShadowVisible: false,
        headerTintColor: '#065F2E',
        headerTitleStyle: { color: '#1E2A24', fontWeight: '800' },
        contentStyle: { backgroundColor: '#F7FAF3' },
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
