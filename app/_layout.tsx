import 'react-native-gesture-handler';

import { Stack } from 'expo-router';
import { StatusBar } from 'react-native';

import { AuthProvider } from '../src/context/auth-context';
import { SnackbarProvider } from '../src/components/snackbar';

export default function RootLayout() {
  return (
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
  );
}
