import { Redirect, Stack } from 'expo-router';

import { LoadingState } from '../../src/components/ui';
import { useAuth } from '../../src/context/auth-context';

export default function OnboardingLayout() {
  const { initializing, profile } = useAuth();

  if (initializing) {
    return <LoadingState message="Memeriksa sesi..." />;
  }

  if (!profile) {
    return <Redirect href="/get-started" />;
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
