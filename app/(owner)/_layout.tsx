import { Redirect, Stack } from 'expo-router';

import { LoadingState } from '../../src/components/ui';
import { useAuth } from '../../src/context/auth-context';
import { getHomeRoute, isOwnerActive } from '../../src/utils/routeGuard';

export default function OwnerLayout() {
  const { currentFarm, initializing, profile } = useAuth();

  if (initializing) {
    return <LoadingState message="Memeriksa akses owner..." />;
  }

  if (!isOwnerActive(currentFarm)) {
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
      <Stack.Screen name="owner/index" options={{ title: 'Owner' }} />
      <Stack.Screen name="owner/trees/index" options={{ title: 'Pohon' }} />
      <Stack.Screen name="owner/trees/create" options={{ title: 'Tambah Pohon' }} />
      <Stack.Screen name="owner/trees/[treeId]" options={{ title: 'Detail Pohon' }} />
      <Stack.Screen name="owner/trees/[treeId]/edit" options={{ title: 'Edit Tree' }} />
      <Stack.Screen name="owner/trees/[treeId]/report" options={{ title: 'Catat Kondisi' }} />
      <Stack.Screen name="owner/sops/index" options={{ title: 'SOP Perawatan' }} />
      <Stack.Screen name="owner/sops/create" options={{ title: 'Tambah SOP' }} />
      <Stack.Screen name="owner/sops/[sopId]" options={{ title: 'Detail SOP' }} />
      <Stack.Screen name="owner/sops/[sopId]/edit" options={{ title: 'Edit SOP' }} />
      <Stack.Screen name="owner/sops/[sopId]/schedule" options={{ title: 'Buat Jadwal' }} />
      <Stack.Screen name="owner/workers" options={{ title: 'Worker Management' }} />
      <Stack.Screen name="owner/profile" options={{ title: 'Profile' }} />
    </Stack>
  );
}
