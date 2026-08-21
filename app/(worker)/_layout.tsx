import { router, Stack, useFocusEffect, usePathname } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { AccessGate } from '../../src/components/access-gate';
import { RoleBottomNavigation } from '../../src/components/role-bottom-navigation';
import { useAuth } from '../../src/context/auth-context';
import {
  logAccessGuardDecision,
  resolveAccessRoute,
  shouldRedirectAccess,
} from '../../src/utils/routeGuard';

export default function WorkerLayout() {
  const { currentFarm, initializing, profile, refresh } = useAuth();
  // Dimulai true, BUKAN false. Dengan false, render pertama setelah mount jatuh
  // ke cabang <Stack> di bawah karena useFocusEffect baru menyalakannya setelah
  // commit — sehingga seluruh layar pekerja sempat dilukis memakai currentFarm
  // yang masih basi. Itu jalur nyata: pekerja yang aksesnya dicabut selagi app
  // di background akan melihat dashboardnya sekali lagi saat app kembali fokus,
  // sebelum guard memindahkannya ke /removed-access. Aman dari macet: satu-
  // satunya yang mematikannya (.finally() di useFocusEffect) selalu jalan.
  const [checkingAccess, setCheckingAccess] = React.useState(true);
  const pathname = usePathname();
  const loading = initializing || checkingAccess;
  const targetRoute = resolveAccessRoute({ session: profile, membership: currentFarm });
  const sessionUserId = profile?.id ?? null;
  const membershipKey = currentFarm
    ? `${currentFarm.membershipId}:${currentFarm.role}:${currentFarm.status}`
    : 'none';
  // Dihitung saat RENDER, bukan hanya di dalam effect. Nilainya dipakai dua kali
  // untuk dua pertanyaan yang berbeda waktunya: "harus pindah?" (di effect,
  // setelah commit) dan "boleh melukis <Stack>?" (di sini, sebelum commit).
  // Tanpa pemakaian kedua, masih tersisa satu frame — antara verifikasi selesai
  // dan effect jalan — di mana loading sudah false tapi router.replace() belum
  // dipanggil, dan di frame itu layar pekerja terlihat oleh orang yang justru
  // sedang diarahkan pergi.
  const shouldRedirect = !loading && shouldRedirectAccess(pathname, targetRoute);

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
  }, [loading, membershipKey, pathname, sessionUserId, shouldRedirect, targetRoute]);

  if (loading || shouldRedirect) {
    return <AccessGate />;
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
            headerTitleStyle: { color: '#1E2A24', fontWeight: '700' },
            contentStyle: { backgroundColor: '#F7FAF3' },
          }}
        >
          <Stack.Screen name="worker/index" options={{ headerShown: false, title: 'Pekerja' }} />
          <Stack.Screen name="worker/trees/index" options={{ headerShown: false, title: 'Pohon' }} />
          <Stack.Screen name="worker/trees/[treeId]" options={{ headerShown: false, title: 'Detail Pohon' }} />
          <Stack.Screen name="worker/trees/[treeId]/report" options={{ headerShown: false, title: 'Catat Kondisi' }} />
          <Stack.Screen name="worker/trees/[treeId]/phase" options={{ headerShown: false, title: 'Catat Fase' }} />
          <Stack.Screen name="worker/trees/[treeId]/care" options={{ headerShown: false, title: 'Catat Perawatan' }} />
          <Stack.Screen name="worker/trees/[treeId]/harvest" options={{ headerShown: false, title: 'Catat Panen' }} />
          <Stack.Screen name="worker/tasks/index" options={{ headerShown: false, title: 'Tugas' }} />
          <Stack.Screen name="worker/tasks/[taskId]" options={{ headerShown: false, title: 'Detail Tugas' }} />
          <Stack.Screen name="worker/tasks/[taskId]/record" options={{ headerShown: false, title: 'Catat Hasil Kerja' }} />
          <Stack.Screen name="worker/reports/index" options={{ headerShown: false, title: 'Laporan' }} />
          <Stack.Screen name="worker/reports/create" options={{ headerShown: false, title: 'Buat Laporan' }} />
          <Stack.Screen name="worker/reports/[reportId]" options={{ headerShown: false, title: 'Detail Laporan' }} />
          <Stack.Screen name="worker/reports/[reportId]/edit" options={{ headerShown: false, title: 'Edit laporan' }} />
          <Stack.Screen name="worker/farm" options={{ headerShown: false, title: 'Kebun' }} />
          <Stack.Screen name="worker/profile" options={{ headerShown: false, title: 'Profil Akun' }} />
          {/* gestureEnabled:false disengaja — swipe-back iOS tidak bisa dicegat lewat
              API publik expo-router, jadi dimatikan supaya perubahan yang belum
              disimpan tidak bisa hilang lewat gestur. Back tetap ada di chevron. */}
          <Stack.Screen
            name="worker/profile-edit"
            options={{ gestureEnabled: false, headerShown: false, title: 'Edit Profil' }}
          />
          <Stack.Screen name="worker/profile-password" options={{ headerShown: false, title: 'Ubah Password' }} />
        </Stack>
      </View>
      <RoleBottomNavigation role="worker" />
    </View>
  );
}
