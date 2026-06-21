import { router } from 'expo-router';
import { Text } from 'react-native';

import { Button, Card, PageIntro, Screen } from '../../src/components/ui';

export default function GetStartedScreen() {
  return (
    <Screen
      footer={
        <>
          <Button title="Buat Akun" onPress={() => router.push('/register')} />
          <Button title="Masuk" variant="secondary" onPress={() => router.push('/login')} />
        </>
      }
    >
      <PageIntro
        title="Avology"
        subtitle="Kelola operasional kebun alpukat MS Farm dari satu aplikasi mobile."
      />
      <Card>
        <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '700' }}>
          Operasional kebun alpukat
        </Text>
        <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
          Pantau pohon, tugas perawatan, laporan lapangan, dan akses pekerja dengan alur yang sederhana.
        </Text>
      </Card>
    </Screen>
  );
}
