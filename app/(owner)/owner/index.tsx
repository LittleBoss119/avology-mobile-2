import { router } from 'expo-router';
import { Text } from 'react-native';

import { Button, Card, MetaRow, PageIntro, Screen } from '../../../src/components/ui';
import { useAuth } from '../../../src/context/auth-context';

export default function OwnerDashboardPlaceholderScreen() {
  const { currentFarm } = useAuth();

  return (
    <Screen
      footer={
        <>
          <Button title="Pohon" onPress={() => router.push('/owner/trees')} />
          <Button title="SOP Perawatan" onPress={() => router.push('/owner/sops')} />
          <Button title="Jadwal Perawatan" onPress={() => router.push('/owner/schedules')} />
          <Button title="Tugas Worker" onPress={() => router.push('/owner/tasks')} />
          <Button title="Kelola Worker" onPress={() => router.push('/owner/workers')} />
          <Button title="Profile" variant="secondary" onPress={() => router.push('/owner/profile')} />
        </>
      }
    >
      <PageIntro title="Owner Dashboard Placeholder" subtitle="Dashboard final akan diisi pada iterasi berikutnya." />
      <Card>
        <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '700' }}>
          Kebun aktif
        </Text>
        <MetaRow label="Nama kebun" value={currentFarm?.farm?.name} />
        <MetaRow label="Join code" value={currentFarm?.farm?.joinCode} />
      </Card>
    </Screen>
  );
}
