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

export default function OwnerLayout() {
  const { currentFarm, initializing, profile, refresh } = useAuth();
  // Dimulai true, BUKAN false. Dengan false, render pertama setelah mount jatuh
  // ke cabang <Stack> di bawah karena useFocusEffect baru menyalakannya setelah
  // commit — sehingga seluruh layar pemilik sempat dilukis memakai currentFarm
  // yang masih basi dari sesi sebelumnya. Aman dari macet: satu-satunya yang
  // mematikannya (.finally() di useFocusEffect) selalu jalan, sukses maupun
  // gagal, dan tidak ada jalur lain yang menyalakannya.
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
  // dipanggil, dan di frame itu layar pemilik terlihat oleh orang yang justru
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
          <Stack.Screen name="owner/index" options={{ headerShown: false, title: 'Pemilik' }} />
          <Stack.Screen name="owner/growth-monitoring" options={{ headerShown: false, title: 'Monitoring Fase' }} />
          <Stack.Screen name="owner/trees/index" options={{ headerShown: false, title: 'Pohon' }} />
          <Stack.Screen name="owner/trees/create" options={{ headerShown: false, title: 'Tambah Pohon' }} />
          <Stack.Screen name="owner/trees/map" options={{ headerShown: false, title: 'Denah Kebun' }} />
          <Stack.Screen name="owner/trees/record-care" options={{ headerShown: false, title: 'Catat Perawatan' }} />
          <Stack.Screen name="owner/trees/add-trees" options={{ headerShown: false, title: 'Tambah Pohon Massal' }} />
          <Stack.Screen name="owner/trees/[treeId]" options={{ headerShown: false, title: 'Detail Pohon' }} />
          <Stack.Screen name="owner/trees/[treeId]/edit" options={{ headerShown: false, title: 'Edit Pohon' }} />
          <Stack.Screen name="owner/trees/[treeId]/report" options={{ headerShown: false, title: 'Catat Kondisi' }} />
          <Stack.Screen name="owner/trees/[treeId]/phase" options={{ headerShown: false, title: 'Catat Fase' }} />
          <Stack.Screen name="owner/trees/[treeId]/care" options={{ headerShown: false, title: 'Catat Perawatan' }} />
          <Stack.Screen name="owner/trees/[treeId]/harvest" options={{ headerShown: false, title: 'Catat Panen' }} />
          <Stack.Screen name="owner/schedules/index" options={{ headerShown: false, title: 'Jadwal Perawatan' }} />
          <Stack.Screen name="owner/schedules/create" options={{ headerShown: false, title: 'Jadwal Manual' }} />
          <Stack.Screen name="owner/schedules/[scheduleId]" options={{ headerShown: false, title: 'Detail Jadwal' }} />
          <Stack.Screen name="owner/schedules/[scheduleId]/edit" options={{ headerShown: false, title: 'Edit Jadwal' }} />
          <Stack.Screen name="owner/tasks/index" options={{ title: 'Tugas Pekerja' }} />
          <Stack.Screen name="owner/tasks/[taskId]" options={{ headerShown: false, title: 'Detail Tugas' }} />
          <Stack.Screen name="owner/farm" options={{ headerShown: false, title: 'Kebun' }} />
          <Stack.Screen name="owner/workers" options={{ title: 'Riwayat akses' }} />
          <Stack.Screen name="owner/profile" options={{ headerShown: false, title: 'Profil Akun' }} />
          {/* gestureEnabled:false disengaja — swipe-back iOS tidak bisa dicegat lewat
              API publik expo-router, jadi dimatikan supaya perubahan yang belum
              disimpan tidak bisa hilang lewat gestur. Back tetap ada di chevron. */}
          <Stack.Screen
            name="owner/profile-edit"
            options={{ gestureEnabled: false, headerShown: false, title: 'Edit Profil' }}
          />
          <Stack.Screen name="owner/profile-password" options={{ headerShown: false, title: 'Ubah Password' }} />
          <Stack.Screen name="owner/farm-profile" options={{ headerShown: false, title: 'Edit kebun' }} />
          <Stack.Screen name="owner/farm-grid" options={{ headerShown: false, title: 'Ukuran denah kebun' }} />
        </Stack>
      </View>
      <RoleBottomNavigation role="owner" />
    </View>
  );
}
