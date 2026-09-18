import 'react-native-gesture-handler';

import { IBMPlexSans_400Regular, IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans';
import { SourceSerif4_600SemiBold } from '@expo-google-fonts/source-serif-4';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from '../src/context/auth-context';
import { SnackbarProvider } from '../src/components/snackbar';
import { colors } from '../src/theme/tokens';

export default function RootLayout() {
  // Tiga varian, bukan lebih. Berat di Android diatur lewat fontFamily, bukan
  // fontWeight, jadi setiap berat yang dipakai harus dimuat sebagai berkas
  // tersendiri. Kunci di sini WAJIB sama persis dengan nilai di `fonts` pada
  // src/theme/tokens.ts.
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_600SemiBold,
    SourceSerif4_600SemiBold,
  });

  // SEMENTARA (batch 1a, langkah 0): bukti font termuat. Dicabut lagi.
  console.log('[font]', { fontsLoaded, fontError: fontError ? String(fontError) : null });

  // Gerbang render. Tanpa ini layar sempat tampil dengan font sistem lalu
  // melompat begitu font siap.
  if (!fontsLoaded) {
    return null;
  }

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
              headerStyle: { backgroundColor: colors.surface },
              headerShadowVisible: false,
              headerTintColor: colors.accentText,
              headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' },
              contentStyle: { backgroundColor: colors.surface },
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
