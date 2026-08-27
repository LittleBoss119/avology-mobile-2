import 'react-native-gesture-handler';

import { Stack } from 'expo-router';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from '../src/context/auth-context';
import { SnackbarProvider } from '../src/components/snackbar';

export default function RootLayout() {
  return (
    // Import side-effect di baris 1 dan pembungkus ini TIDAK saling menggantikan:
    // yang pertama memasang modul native gesture-handler, yang kedua menyediakan
    // akar pohon gesture yang dibutuhkan detektornya di Android. Keduanya wajib.
    //
    // Belum ada gesture yang dipakai saat ini. Pembungkus ini dipasang lebih awal
    // supaya perubahan pada berkas akar aplikasi selesai dan terverifikasi
    // terpisah dari pekerjaan cubit-zoom yang memakainya nanti.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SnackbarProvider>
        <AuthProvider>
          <StatusBar barStyle="dark-content" />
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
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
            <Stack.Screen name="(owner)" options={{ headerShown: false }} />
            <Stack.Screen name="(worker)" options={{ headerShown: false }} />
          </Stack>
        </AuthProvider>
      </SnackbarProvider>
    </GestureHandlerRootView>
  );
}
