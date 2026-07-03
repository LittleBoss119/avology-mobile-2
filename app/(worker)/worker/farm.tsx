import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Badge, Button, Card, ErrorBanner, MainTabHeader, MetaRow, Screen, SectionHeader } from '../../../src/components/ui';
import { colors, radius, spacing } from '../../../src/constants/theme';
import { useAuth } from '../../../src/context/auth-context';
import { getFarmActorDisplayProfiles, leaveCurrentFarm } from '../../../src/services/memberService';
import { getTrees } from '../../../src/services/treeService';
import type { FarmActorDisplayProfile } from '../../../src/types/domain';
import { formatMemberStatus, formatRole } from '../../../src/utils/displayFormat';

type WorkerFarmHubData = {
  actors: FarmActorDisplayProfile[];
  totalTrees: number | null;
};

export default function WorkerFarmHubScreen() {
  const { currentFarm, refresh } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [hubData, setHubData] = React.useState<WorkerFarmHubData>({
    actors: [],
    totalTrees: null,
  });
  const [leavingFarm, setLeavingFarm] = React.useState(false);
  const farm = currentFarm?.farm;
  const farmId = currentFarm?.farmId;
  const ownerName = findOwnerName(hubData.actors);
  const activeWorkers = hubData.actors.filter((actor) => actor.role === 'worker' && actor.status === 'active');
  const canLeaveFarm = currentFarm?.role === 'worker' && currentFarm.status === 'active' && Boolean(farmId);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;

      async function loadHubData() {
        if (!farmId) {
          return;
        }

        const [actorsResult, treesResult] = await Promise.all([
          getFarmActorDisplayProfiles(farmId),
          getTrees({ archived: false, farmId }),
        ]);

        if (!isActive) {
          return;
        }

        setHubData({
          actors: actorsResult.data ?? [],
          totalTrees: treesResult.data?.length ?? null,
        });

        logOptionalHubError('anggota kebun', actorsResult.error?.message);
        logOptionalHubError('jumlah pohon', treesResult.error?.message);
      }

      loadHubData();

      return () => {
        isActive = false;
      };
    }, [farmId])
  );

  function handleLeaveFarmPress() {
    Alert.alert(
      'Keluar dari kebun?',
      'Akses kamu ke kebun ini akan dinonaktifkan. Riwayat tugas dan laporan tetap tersimpan.',
      [
        { style: 'cancel', text: 'Batal' },
        {
          onPress: () => {
            void handleConfirmLeaveFarm();
          },
          style: 'destructive',
          text: 'Keluar dari kebun',
        },
      ]
    );
  }

  async function handleConfirmLeaveFarm() {
    if (!farmId || leavingFarm) {
      return;
    }

    setLeavingFarm(true);
    setError(null);

    const result = await leaveCurrentFarm({ farmId });

    if (result.error) {
      setError(result.error.message);
      setLeavingFarm(false);
      return;
    }

    await refresh();
    setLeavingFarm(false);
    router.replace('/removed-access');
  }

  return (
    <Screen>
      <MainTabHeader title="Kebun" onProfilePress={() => router.push('/worker/profile')} />
      <ErrorBanner message={error} />

      <Card variant="highlight">
        <SectionHeader title="Data Kebun" />
        <MetaRow label="Nama kebun" value={farm?.name} />
        <MetaRow label="Lokasi" value={farm?.location} />
        <MetaRow label="Luas" value={formatArea(farm?.areaSize)} />
        <MetaRow label="Total pohon aktif" value={formatCount(hubData.totalTrees, 'pohon')} />
      </Card>

      <Card>
        <SectionHeader title="Anggota Kebun" />
        <MetaRow label="Pemilik" value={ownerName ?? 'Belum tersedia'} />
        {activeWorkers.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            {activeWorkers.slice(0, 4).map((actor) => (
              <MemberRow key={actor.userId} actor={actor} />
            ))}
          </View>
        ) : (
          <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
            Data pekerja aktif belum tersedia.
          </Text>
        )}
      </Card>

      <Card>
        <SectionHeader title="Akses Saya" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Badge label={formatRole(currentFarm?.role)} tone="info" />
          <Badge label={formatMemberStatus(currentFarm?.status)} tone={currentFarm?.status === 'active' ? 'success' : 'warning'} />
        </View>
        <MetaRow label="Peran" value={formatRole(currentFarm?.role)} />
        <MetaRow label="Status" value={formatMemberStatus(currentFarm?.status)} />
        <MetaRow label="Bergabung sejak" value={formatDate(currentFarm?.joinedAt)} />
      </Card>

      {canLeaveFarm ? (
        <Card>
          <SectionHeader title="Akses Kebun" />
          <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
            Keluar hanya jika kamu tidak lagi bekerja di kebun ini.
          </Text>
          <Button
            size="small"
            title="Keluar dari kebun"
            loading={leavingFarm}
            variant="danger"
            onPress={handleLeaveFarmPress}
          />
        </Card>
      ) : null}
    </Screen>
  );
}

function MemberRow({ actor }: { actor: FarmActorDisplayProfile }) {
  return (
    <View
      style={{
        borderColor: colors.border,
        borderRadius: radius.lg,
        borderWidth: 1,
        gap: spacing.xs,
        padding: spacing.md,
      }}
    >
      <Text selectable style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>
        {actor.fullName}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Badge label={formatRole(actor.role)} tone={actor.role === 'owner' ? 'info' : 'neutral'} />
        <Badge label={formatMemberStatus(actor.status)} tone={actor.status === 'active' ? 'success' : 'warning'} />
      </View>
    </View>
  );
}

function findOwnerName(actors: FarmActorDisplayProfile[]): string | null {
  return actors.find((actor) => actor.role === 'owner' && actor.status === 'active')?.fullName ?? null;
}

function formatArea(value?: number | null): string {
  if (value === null || value === undefined) {
    return 'Belum tersedia';
  }

  return `${new Intl.NumberFormat('id-ID').format(value)} m²`;
}

function formatCount(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined) {
    return 'Belum tersedia';
  }

  return `${new Intl.NumberFormat('id-ID').format(value)} ${unit}`;
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

function logOptionalHubError(label: string, message?: string | null) {
  if (typeof __DEV__ !== 'undefined' && __DEV__ && message) {
    console.debug('[worker-farm] Optional data unavailable', { label, message });
  }
}
