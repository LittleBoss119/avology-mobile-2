import { router, Stack, usePathname } from 'expo-router';
import React from 'react';

import { LoadingState } from '../../src/components/ui';
import { useAuth } from '../../src/context/auth-context';
import {
  logAccessGuardDecision,
  resolveAccessRoute,
  shouldRedirectAccess,
} from '../../src/utils/routeGuard';

export default function AuthLayout() {
  const { currentFarm, initializing, profile } = useAuth();
  const pathname = usePathname();
  const targetRoute = resolveAccessRoute({ session: profile, membership: currentFarm });
  const sessionUserId = profile?.id ?? null;
  const membershipKey = currentFarm
    ? `${currentFarm.membershipId}:${currentFarm.role}:${currentFarm.status}`
    : 'none';

  React.useEffect(() => {
    if (initializing) {
      return;
    }

    const shouldRedirect = shouldRedirectAccess(pathname, targetRoute);

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
  }, [initializing, membershipKey, pathname, sessionUserId, targetRoute]);

  if (initializing) {
    return <LoadingState message="Memeriksa sesi..." />;
  }

  return (
    <Stack
      screenOptions={{
        headerBackTitle: 'Kembali',
        headerStyle: { backgroundColor: '#F7FAF3' },
        headerShadowVisible: false,
        headerTintColor: '#065F2E',
        headerTitleStyle: { color: '#1E2A24', fontWeight: '700' },
        contentStyle: { backgroundColor: '#F7FAF3' },
      }}
    >
      <Stack.Screen name="get-started" options={{ headerShown: false, title: 'Avology' }} />
      <Stack.Screen name="login" options={{ headerShown: false, title: 'Masuk' }} />
      <Stack.Screen name="register" options={{ headerShown: false, title: 'Daftar' }} />
    </Stack>
  );
}
