import { Redirect, Stack, useFocusEffect } from 'expo-router';
import React from 'react';

import { LoadingState } from '../../src/components/ui';
import { useAuth } from '../../src/context/auth-context';
import { getHomeRoute, isWorkerActive } from '../../src/utils/routeGuard';

export default function WorkerLayout() {
  const { currentFarm, initializing, profile, refresh } = useAuth();
  const [checkingAccess, setCheckingAccess] = React.useState(false);

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
    return <LoadingState message="Memeriksa akses worker..." />;
  }

  if (!isWorkerActive(currentFarm)) {
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
      <Stack.Screen name="worker/index" options={{ title: 'Worker' }} />
      <Stack.Screen name="worker/trees/index" options={{ title: 'Pohon' }} />
      <Stack.Screen name="worker/trees/[treeId]" options={{ title: 'Detail Pohon' }} />
      <Stack.Screen name="worker/trees/[treeId]/report" options={{ title: 'Catat Kondisi' }} />
      <Stack.Screen name="worker/trees/[treeId]/phase" options={{ title: 'Catat Fase' }} />
      <Stack.Screen name="worker/tasks/index" options={{ title: 'Tugas Saya' }} />
      <Stack.Screen name="worker/tasks/[taskId]" options={{ title: 'Detail Tugas' }} />
      <Stack.Screen name="worker/reports/index" options={{ title: 'Laporan' }} />
      <Stack.Screen name="worker/reports/create" options={{ title: 'Buat Laporan' }} />
      <Stack.Screen name="worker/profile" options={{ title: 'Profile' }} />
    </Stack>
  );
}
