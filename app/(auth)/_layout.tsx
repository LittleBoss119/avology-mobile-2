import { router, Stack, usePathname } from 'expo-router';
import React from 'react';

import { AccessGate } from '../../src/components/access-gate';
import { useAuth } from '../../src/context/auth-context';
import {
  logAccessGuardDecision,
  resolveAccessRoute,
  shouldRedirectAccess,
} from '../../src/utils/routeGuard';
import { colors as palette, fonts } from '../../src/theme/tokens';

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
    return <AccessGate />;
  }

  return (
    <Stack
      screenOptions={{
        headerBackTitle: 'Kembali',
        headerStyle: { backgroundColor: palette.surface },
        headerShadowVisible: false,
        headerTintColor: palette.textPrimary,
        headerTitleAlign: 'center',
        // 17 rata tengah, berat dibawa keluarga huruf. Sama persis dengan judul
        // pada <TopAppBar>, supaya layar berheader bawaan dan layar berheader
        // dalam-isi tidak terlihat berasal dari dua aplikasi berbeda.
        headerTitleStyle: { color: palette.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: 17 },
        contentStyle: { backgroundColor: palette.surface },
      }}
    >
      <Stack.Screen name="get-started" options={{ headerShown: false, title: 'Avology' }} />
      <Stack.Screen name="login" options={{ headerShown: false, title: 'Masuk' }} />
      <Stack.Screen name="register" options={{ headerShown: false, title: 'Daftar' }} />
    </Stack>
  );
}
