import { router, Stack, useFocusEffect, usePathname } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { RoleBottomNavigation } from '../../src/components/role-bottom-navigation';
import { LoadingState } from '../../src/components/ui';
import { useAuth } from '../../src/context/auth-context';
import {
  logAccessGuardDecision,
  resolveAccessRoute,
  shouldRedirectAccess,
} from '../../src/utils/routeGuard';

export default function WorkerLayout() {
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
    return <LoadingState message="Memeriksa akses pekerja..." />;
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
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
          <Stack.Screen name="worker/index" options={{ headerBackVisible: false, title: 'Pekerja' }} />
          <Stack.Screen name="worker/trees/index" options={{ headerBackVisible: false, title: 'Pohon' }} />
          <Stack.Screen name="worker/trees/[treeId]" options={{ headerShown: false, title: 'Detail Pohon' }} />
          <Stack.Screen name="worker/trees/[treeId]/report" options={{ headerShown: false, title: 'Catat Kondisi' }} />
          <Stack.Screen name="worker/trees/[treeId]/phase" options={{ headerShown: false, title: 'Catat Fase' }} />
          <Stack.Screen name="worker/tasks/index" options={{ headerBackVisible: false, title: 'Tugas Saya' }} />
          <Stack.Screen name="worker/tasks/[taskId]" options={{ headerShown: false, title: 'Detail Tugas' }} />
          <Stack.Screen name="worker/reports/index" options={{ headerBackVisible: false, title: 'Laporan' }} />
          <Stack.Screen name="worker/reports/create" options={{ headerShown: false, title: 'Buat Laporan' }} />
          <Stack.Screen name="worker/reports/[reportId]" options={{ headerShown: false, title: 'Detail Laporan' }} />
          <Stack.Screen name="worker/farm" options={{ headerShown: false, title: 'Kebun' }} />
          <Stack.Screen name="worker/profile" options={{ headerBackVisible: false, title: 'Profil' }} />
        </Stack>
      </View>
      <RoleBottomNavigation role="worker" />
    </View>
  );
}
