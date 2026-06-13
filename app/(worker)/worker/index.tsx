import { router } from 'expo-router';
import { Text } from 'react-native';

import { Button, Card, MetaRow, PageIntro, Screen } from '../../../src/components/ui';
import { useAuth } from '../../../src/context/auth-context';

export default function WorkerDashboardPlaceholderScreen() {
  const { currentFarm } = useAuth();

  return (
    <Screen
      footer={
        <>
          <Button title="Tugas Saya" onPress={() => router.push('/worker/tasks')} />
          <Button title="Pohon" onPress={() => router.push('/worker/trees')} />
          <Button title="Profile" variant="secondary" onPress={() => router.push('/worker/profile')} />
        </>
      }
    >
      <PageIntro title="Worker Dashboard Placeholder" subtitle="Tugas dan data operasional belum dibuka di Iteration 1." />
      <Card>
        <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '700' }}>
          Membership aktif
        </Text>
        <MetaRow label="Role" value={currentFarm?.role} />
        <MetaRow label="Status" value={currentFarm?.status} />
      </Card>
    </Screen>
  );
}
