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

export default function OwnerLayout() {
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
    return <LoadingState message="Memeriksa akses pemilik..." />;
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
          <Stack.Screen name="owner/index" options={{ headerBackVisible: false, title: 'Pemilik' }} />
          <Stack.Screen name="owner/growth-monitoring" options={{ title: 'Monitoring Fase' }} />
          <Stack.Screen name="owner/trees/index" options={{ headerBackVisible: false, title: 'Pohon' }} />
          <Stack.Screen name="owner/trees/create" options={{ headerShown: false, title: 'Tambah Pohon' }} />
          <Stack.Screen name="owner/trees/[treeId]" options={{ headerShown: false, title: 'Detail Pohon' }} />
          <Stack.Screen name="owner/trees/[treeId]/edit" options={{ headerShown: false, title: 'Edit Pohon' }} />
          <Stack.Screen name="owner/trees/[treeId]/report" options={{ headerShown: false, title: 'Catat Kondisi' }} />
          <Stack.Screen name="owner/trees/[treeId]/phase" options={{ headerShown: false, title: 'Catat Fase' }} />
          <Stack.Screen name="owner/sops/index" options={{ title: 'SOP Perawatan' }} />
          <Stack.Screen name="owner/sops/create" options={{ headerShown: false, title: 'Tambah SOP' }} />
          <Stack.Screen name="owner/sops/[sopId]" options={{ headerShown: false, title: 'Detail SOP' }} />
          <Stack.Screen name="owner/sops/[sopId]/edit" options={{ headerShown: false, title: 'Edit SOP' }} />
          <Stack.Screen name="owner/sops/[sopId]/schedule" options={{ headerShown: false, title: 'Buat Jadwal' }} />
          <Stack.Screen name="owner/schedules/index" options={{ headerBackVisible: false, title: 'Jadwal Perawatan' }} />
          <Stack.Screen name="owner/schedules/create" options={{ headerShown: false, title: 'Jadwal Manual' }} />
          <Stack.Screen name="owner/schedules/[scheduleId]" options={{ headerShown: false, title: 'Detail Jadwal' }} />
          <Stack.Screen name="owner/tasks/index" options={{ title: 'Tugas Pekerja' }} />
          <Stack.Screen name="owner/tasks/[taskId]" options={{ headerShown: false, title: 'Detail Tugas' }} />
          <Stack.Screen name="owner/reports/index" options={{ headerBackVisible: false, title: 'Laporan Operasional' }} />
          <Stack.Screen name="owner/reports/[reportId]" options={{ headerShown: false, title: 'Detail Laporan' }} />
          <Stack.Screen name="owner/reports/[reportId]/task" options={{ headerShown: false, title: 'Buat Tugas' }} />
          <Stack.Screen name="owner/farm" options={{ headerShown: false, title: 'Kebun' }} />
          <Stack.Screen name="owner/workers" options={{ title: 'Manajemen Pekerja' }} />
          <Stack.Screen name="owner/profile" options={{ headerBackVisible: false, title: 'Profil' }} />
          <Stack.Screen name="owner/farm-profile" options={{ title: 'Kebun Saya' }} />
        </Stack>
      </View>
      <RoleBottomNavigation role="owner" />
    </View>
  );
}
