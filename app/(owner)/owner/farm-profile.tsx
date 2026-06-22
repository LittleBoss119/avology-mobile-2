import { router } from 'expo-router';
import { Text } from 'react-native';

import { Button, Card, EmptyState, ErrorBanner, MetaRow, PageIntro, Screen } from '../../../src/components/ui';
import { useAuth } from '../../../src/context/auth-context';
import { isOwnerActive } from '../../../src/utils/routeGuard';

export default function OwnerFarmProfileScreen() {
  const { currentFarm, error } = useAuth();
  const farm = currentFarm?.farm;

  if (!isOwnerActive(currentFarm)) {
    return (
      <Screen>
        <PageIntro title="Profil Kebun" subtitle="Kelola informasi dan akses kebun." />
        <EmptyState title="Akses tidak tersedia" subtitle="Profil Kebun hanya tersedia untuk pemilik aktif." />
      </Screen>
    );
  }

  return (
    <Screen>
      <PageIntro title="Profil Kebun" subtitle="Kelola informasi dan akses kebun." />
      <ErrorBanner message={error?.message} />

      {!farm ? (
        <EmptyState title="Data kebun tidak tersedia" subtitle="Coba buka kembali halaman ini beberapa saat lagi." />
      ) : (
        <Card>
          <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '700' }}>
            Data Kebun
          </Text>
          <MetaRow label="Nama kebun" value={farm.name} />
          <MetaRow label="Lokasi" value={farm.location} />
          <MetaRow label="Luas" value={formatAreaSize(farm.areaSize)} />
          <MetaRow label="Kode gabung" value={farm.joinCode} />
        </Card>
      )}

      <Card>
        <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '700' }}>
          Pengelolaan
        </Text>
        <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
          Akses cepat untuk mengelola pekerja dan SOP perawatan kebun.
        </Text>
        <Button title="Manajemen Pekerja" variant="secondary" onPress={() => router.push('/owner/workers')} />
        <Button title="SOP Perawatan" variant="secondary" onPress={() => router.push('/owner/sops')} />
      </Card>
    </Screen>
  );
}

function formatAreaSize(areaSize?: number | null): string | null {
  if (areaSize === null || areaSize === undefined) {
    return null;
  }

  return `${new Intl.NumberFormat('id-ID').format(areaSize)} m²`;
}
