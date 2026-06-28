import { router } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { Badge, Button, Card, ErrorBanner, MetaRow, PageIntro, Screen, SectionHeader } from '../../../src/components/ui';
import { useAuth } from '../../../src/context/auth-context';
import { formatMemberStatus, formatPersonDisplayName, formatRole } from '../../../src/utils/displayFormat';

export default function WorkerFarmHubScreen() {
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
      <PageIntro title="Kebun" subtitle="Informasi kebun tempat kamu bekerja dan akses akun." />
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
        <MetaRow label="Bergabung sejak" value={formatDate(currentFarm?.joinedAt)} />
      </Card>

      <HubSection
        description="Data kebun berasal dari akses aktif saat ini. Detail tambahan akan dipoles pada batch visual berikutnya."
        title="Informasi Kebun"
      >
        <MetaRow label="Nama kebun" value={farm?.name} />
        <MetaRow label="Lokasi" value={farm?.location} />
      </HubSection>

      <HubSection
        description="Peran dan status akses mengikuti data keanggotaan yang sudah aktif."
        title="Status Akses"
      >
        <MetaRow label="Peran" value={formatRole(currentFarm?.role)} />
        <MetaRow label="Status" value={formatMemberStatus(currentFarm?.status)} />
      </HubSection>

      <HubSection
        description="Profil akun dan keluar akun tetap berada di halaman Profil Akun."
        title="Akun Saya"
      >
        <MetaRow label="Nama" value={formatPersonDisplayName(profile?.fullName, 'Pekerja kebun')} />
        <MetaRow label="Nomor HP" value={profile?.phone} />
        {profile?.email ? <MetaRow label="Email login" value={profile.email} /> : null}
        <Button title="Buka Profil Akun" variant="secondary" onPress={() => router.push('/worker/profile')} />
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

function formatDate(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  return new Date(value).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
