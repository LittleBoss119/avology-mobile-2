import { router } from 'expo-router';
import { Text } from 'react-native';

import { Button, Card, PageIntro, Screen } from '../../src/components/ui';

export default function GetStartedScreen() {
  return (
    <Screen
      footer={
        <>
          <Button title="Buat Akun" onPress={() => router.push('/register')} />
          <Button title="Login" variant="secondary" onPress={() => router.push('/login')} />
        </>
      }
    >
      <PageIntro
        title="Avology"
        subtitle="Kelola akses kebun alpukat MS Farm dari akun owner dan worker."
      />
      <Card>
        <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '700' }}>
          Iteration 1
        </Text>
        <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
          Fokus saat ini: auth, pembuatan kebun, join worker, dan pengelolaan membership.
        </Text>
      </Card>
    </Screen>
  );
}
