import { router } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { Badge, Button, Card, ErrorBanner, MetaRow, PageIntro, Screen, SectionHeader } from '../../../src/components/ui';
import { useAuth } from '../../../src/context/auth-context';
import { formatMemberStatus, formatPersonDisplayName, formatRole } from '../../../src/utils/displayFormat';

export default function OwnerFarmHubScreen() {
  const { currentFarm, profile, signOut } = useAuth();
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [logoutError, setLogoutError] = React.useState<string | null>(null);
  const farm = currentFarm?.farm;

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError(null);

    const result = await signOut();

    if (result) {
      setLogoutError(result.message);
      setLoggingOut(false);
      return;
    }

    setLoggingOut(false);
    router.replace('/get-started');
  }

  return (
    <Screen>
      <PageIntro title="Kebun" subtitle="Kelola data kebun, pekerja, SOP, dan akses akun." />
      <ErrorBanner message={logoutError} />

      <Card variant="highlight">
        <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'space-between' }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text selectable style={{ color: '#102016', fontSize: 18, fontWeight: '800' }}>
              {farm?.name ?? 'Kebun aktif'}
            </Text>
            <Text selectable style={{ color: '#647067', lineHeight: 20 }}>
              {farm?.location ?? 'Data lokasi kebun belum tersedia.'}
            </Text>
          </View>
          <Badge label={formatRole(currentFarm?.role)} tone="success" />
        </View>
        <MetaRow label="Status akses" value={formatMemberStatus(currentFarm?.status)} />
        <MetaRow label="Kode gabung" value={farm?.joinCode} />
      </Card>

      <HubSection
        description="Lihat data kebun, lokasi, luas lahan, dan kode gabung yang sudah ada."
        title="Data Kebun"
      >
        <Button title="Buka Profil Kebun" variant="secondary" onPress={() => router.push('/owner/farm-profile')} />
      </HubSection>

      <HubSection
        description="Kelola pekerja aktif dan pengajuan akses pekerja dari halaman yang sudah tersedia."
        title="Manajemen Pekerja"
      >
        <Button title="Buka Manajemen Pekerja" variant="secondary" onPress={() => router.push('/owner/workers')} />
      </HubSection>

      <HubSection
        description="Buka template SOP perawatan untuk mempercepat pembuatan jadwal."
        title="SOP Perawatan"
      >
        <Button title="Buka SOP Perawatan" variant="secondary" onPress={() => router.push('/owner/sops')} />
      </HubSection>

      <HubSection
        description="Profil akun, edit data pribadi, dan keluar akun tetap berada di halaman Profil Akun."
        title="Akun Saya"
      >
        <MetaRow label="Nama" value={formatPersonDisplayName(profile?.fullName, 'Pemilik kebun')} />
        <MetaRow label="Nomor HP" value={profile?.phone} />
        {profile?.email ? <MetaRow label="Email login" value={profile.email} /> : null}
        <Button title="Buka Profil Akun" variant="secondary" onPress={() => router.push('/owner/profile')} />
        <Button title="Keluar Akun" variant="danger" loading={loggingOut} onPress={handleLogout} />
      </HubSection>
    </Screen>
  );
}

function HubSection({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <Card>
      <SectionHeader description={description} title={title} />
      {children}
    </Card>
  );
}
