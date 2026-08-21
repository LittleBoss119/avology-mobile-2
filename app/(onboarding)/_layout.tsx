import { router, Stack, useFocusEffect, usePathname } from 'expo-router';
import React from 'react';

import { AccessGate } from '../../src/components/access-gate';
import { useAuth } from '../../src/context/auth-context';
import {
  consumePendingAccessRoute,
  peekPendingAccessRoute,
} from '../../src/lib/pendingAccessRoute';
import {
  logAccessGuardDecision,
  resolveAccessRoute,
  shouldRedirectAccess,
} from '../../src/utils/routeGuard';

export default function OnboardingLayout() {
  const { currentFarm, initializing, profile, refresh } = useAuth();
  // Dimulai true, BUKAN false. Dengan false, render pertama setelah mount jatuh
  // ke cabang <Stack> di bawah karena useFocusEffect baru menyalakannya setelah
  // commit — sehingga layar pilih akses sempat dilukis untuk user yang relasinya
  // sebenarnya pending/rejected/removed. Aman dari macet: satu-satunya yang
  // mematikannya (.finally() di useFocusEffect) selalu jalan.
  const [checkingAccess, setCheckingAccess] = React.useState(true);
  const pathname = usePathname();
  const loading = initializing || checkingAccess;
  const guardRoute = resolveAccessRoute({ session: profile, membership: currentFarm });
  // Tujuan pemulihan dari layar pemberitahuan HANYA berlaku setelah relasinya
  // benar-benar teramati null — yaitu setelah acknowledge_access_notice
  // menghapus barisnya. Selama relasinya masih rejected/removed, niat ini
  // diabaikan sepenuhnya, jadi ia tidak bisa dipakai menembus penguncian.
  const recoveryRoute = currentFarm ? null : peekPendingAccessRoute();
  const targetRoute = recoveryRoute ?? guardRoute;
  const sessionUserId = profile?.id ?? null;
  const membershipKey = currentFarm
    ? `${currentFarm.membershipId}:${currentFarm.role}:${currentFarm.status}`
    : 'none';
  // Dihitung saat RENDER, bukan hanya di dalam effect. Nilainya dipakai dua kali
  // untuk dua pertanyaan yang berbeda waktunya: "harus pindah?" (di effect,
  // setelah commit) dan "boleh melukis <Stack>?" (di bawah, sebelum commit).
  // Tanpa pemakaian kedua, masih tersisa satu frame — antara verifikasi selesai
  // dan effect jalan — di mana loading sudah false tapi router.replace() belum
  // dipanggil.
  //
  // Ikut membaca `targetRoute`, jadi niat pemulihan (recoveryRoute) tetap
  // dihormati persis seperti sebelumnya: kalau tujuannya sudah tercapai,
  // shouldRedirect false dan Stack dilukis seperti biasa.
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
      // Dihapus sebelum berpindah: niat ini sekali pakai. Kalau pemulihannya
      // gagal di tengah jalan dan guard mengarahkan ke tempat lain, niat lama
      // tidak boleh ikut menempel ke perjalanan berikutnya.
      consumePendingAccessRoute();
      router.replace(targetRoute);
      return;
    }

    if (recoveryRoute) {
      consumePendingAccessRoute();
    }
  }, [loading, membershipKey, pathname, recoveryRoute, sessionUserId, shouldRedirect, targetRoute]);

  if (loading || shouldRedirect) {
    return <AccessGate />;
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
      <Stack.Screen name="onboarding" options={{ headerShown: false, title: 'Pilih Akses' }} />
      <Stack.Screen name="create-farm" options={{ headerShown: false, title: 'Buat Kebun' }} />
      <Stack.Screen name="join-farm" options={{ headerShown: false, title: 'Gabung Kebun' }} />
      <Stack.Screen name="profile" options={{ headerShown: false, title: 'Profil Akun' }} />
      {/* gestureEnabled:false disengaja — swipe-back iOS tidak bisa dicegat lewat
          API publik expo-router, jadi dimatikan supaya perubahan yang belum
          disimpan tidak bisa hilang lewat gestur. Back tetap ada di chevron. */}
      <Stack.Screen
        name="profile-edit"
        options={{ gestureEnabled: false, headerShown: false, title: 'Edit Profil' }}
      />
      <Stack.Screen name="password" options={{ headerShown: false, title: 'Ubah Password' }} />
      <Stack.Screen name="pending-approval" options={{ headerShown: false, title: 'Menunggu Persetujuan' }} />
      <Stack.Screen name="rejected" options={{ headerShown: false, title: 'Akses Ditolak' }} />
      <Stack.Screen name="removed-access" options={{ headerShown: false, title: 'Akses Dinonaktifkan' }} />
    </Stack>
  );
}
