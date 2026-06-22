import { router } from 'expo-router';
import { Text } from 'react-native';

import { Button, Card, ErrorBanner, MetaRow, PageIntro, Screen } from '../../src/components/ui';
import { useAuth } from '../../src/context/auth-context';

export default function OnboardingDecisionScreen() {
  const { currentFarm, error, profile, signOut } = useAuth();
  const isInactiveRecovery = currentFarm?.status === 'rejected' || currentFarm?.status === 'removed';
  const inactiveRecoveryParams = isInactiveRecovery ? { inactiveRecovery: '1' } : undefined;

  async function handleLogout() {
    const signOutError = await signOut();

    if (!signOutError) {
      router.replace('/get-started');
    }
  }

  return (
    <Screen
      footer={
        <>
          <Button
            title="Buat Kebun sebagai Pemilik"
            onPress={() =>
              router.push({
                pathname: '/create-farm',
                params: inactiveRecoveryParams,
              })
            }
          />
          <Button
            title="Gabung sebagai Pekerja"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: '/join-farm',
                params: inactiveRecoveryParams,
              })
            }
          />
          <Button title="Profil Akun" variant="secondary" size="small" onPress={() => router.push('/profile')} />
          <Button title="Keluar" variant="secondary" onPress={handleLogout} />
        </>
      }
    >
      <PageIntro
        title="Pilih Akses"
        subtitle="Buat kebun baru sebagai pemilik atau ajukan bergabung menggunakan kode kebun."
      />
      <ErrorBanner message={error?.message} />
      <Card>
        <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '700' }}>
          Akun aktif
        </Text>
        <MetaRow label="Nama" value={profile?.fullName} />
        <MetaRow label="Nomor HP" value={profile?.phone} />
      </Card>
    </Screen>
  );
}
