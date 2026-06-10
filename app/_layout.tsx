import 'react-native-gesture-handler';

import { Stack } from 'expo-router';
import { StatusBar } from 'react-native';

import { AuthProvider } from '../src/context/auth-context';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar barStyle="dark-content" />
      <Stack
        screenOptions={{
          headerBackTitle: 'Kembali',
          headerShadowVisible: false,
          contentStyle: { backgroundColor: '#F6F7F2' },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(owner)" options={{ headerShown: false }} />
        <Stack.Screen name="(worker)" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}
