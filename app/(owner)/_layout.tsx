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
import { colors as palette, fonts } from '../../src/theme/tokens';

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
          <Stack.Screen name="owner/index" options={{ headerShown: false, title: 'Pemilik' }} />
          <Stack.Screen name="owner/growth-monitoring" options={{ headerShown: false, title: 'Fase Pohon' }} />
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
          {/* gestureEnabled:false — pasangan wajib useUnsavedChangesGuard di
              dalam layar itu (batch 6b), alasan yang sama persis dengan
              owner/profile-edit di bawah: swipe-back iOS tidak bisa dicegat
              lewat API publik expo-router, jadi ia dimatikan supaya perubahan
              yang belum disimpan tidak bisa hilang lewat gestur. Back tetap ada
              di chevron, dan chevron itulah yang menanyakan konfirmasinya.

              Layar Edit Pohon memasangnya sendiri lewat <Stack.Screen> di dalam
              berkas layarnya, jadi ia tidak punya baris di sini. */}
          <Stack.Screen
            name="owner/schedules/[scheduleId]/edit"
            options={{ gestureEnabled: false, headerShown: false, title: 'Edit Jadwal' }}
          />
          {/* "Tugas Lapangan", dan judulnya kini HIDUP DI SINI saja.
              Layar ini punya dua nama sejak batch 1b — 'Tugas Pekerja' di header
              bawaan dan 'Tugas Lapangan' di <PageIntro> badan layar — dan batch
              7a memutuskan yang kedua. Alasannya bukan selera: aplikasi ini
              mengelola KEBUN, bukan mengawasi orang. 'Tugas Pekerja' membingkai
              layar ini sebagai manajemen pekerja, dan framing itu bertentangan
              dengan posisi yang dipegang naskah skripsinya.

              Judul kosong sementara di batch 1b dicabut bersama PageIntro-nya,
              jadi tinggal satu judul: 17 rata tengah di header, sesuai aturan
              "layar lain".

              Header tetap MENYALA karena ia satu-satunya sumber tombol kembali
              di layar ini; layar ini tidak punya <TopAppBar>. Mematikannya akan
              mengurung pengguna. */}
          <Stack.Screen name="owner/tasks/index" options={{ title: 'Tugas Lapangan' }} />
          <Stack.Screen name="owner/tasks/[taskId]" options={{ headerShown: false, title: 'Detail Tugas' }} />
          <Stack.Screen name="owner/farm" options={{ headerShown: false, title: 'Anggota' }} />
          <Stack.Screen name="owner/workers" options={{ title: 'Riwayat Akses' }} />
          <Stack.Screen name="owner/profile" options={{ headerShown: false, title: 'Profil Akun' }} />
          {/* gestureEnabled:false disengaja — swipe-back iOS tidak bisa dicegat lewat
              API publik expo-router, jadi dimatikan supaya perubahan yang belum
              disimpan tidak bisa hilang lewat gestur. Back tetap ada di chevron. */}
          <Stack.Screen
            name="owner/profile-edit"
            options={{ gestureEnabled: false, headerShown: false, title: 'Edit Profil' }}
          />
          <Stack.Screen name="owner/profile-password" options={{ headerShown: false, title: 'Ganti Password' }} />
          {/* gestureEnabled:false pada KEDUANYA — pasangan wajib
              useUnsavedChangesGuard yang dipasang di dalam kedua layar itu di
              batch 7a, alasan yang sama persis dengan owner/profile-edit dan
              owner/schedules/[scheduleId]/edit di atas: swipe-back iOS tidak
              bisa dicegat lewat API publik expo-router, jadi ia dimatikan supaya
              perubahan yang belum disimpan tidak bisa hilang lewat gestur. Back
              tetap ada di chevron, dan chevron itulah yang menanyakan
              konfirmasinya.

              Data kebun tidak selalu sedang dalam mode isian, dan gesturnya
              tetap dimatikan tanpa syarat: gestureEnabled adalah pilihan per
              rute, bukan per keadaan, dan menyalakannya kembali saat mode bacaan
              berarti menggantungkan keselamatan perubahan pada urutan render. */}
          <Stack.Screen
            name="owner/farm-profile"
            options={{ gestureEnabled: false, headerShown: false, title: 'Data Kebun' }}
          />
          <Stack.Screen
            name="owner/farm-grid"
            options={{ gestureEnabled: false, headerShown: false, title: 'Ukuran Denah' }}
          />
        </Stack>
      </View>
      <RoleBottomNavigation role="owner" />
    </View>
  );
}
