import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { ConfirmDialog } from '../../../src/components/bottom-sheet';
import { MemberRow } from '../../../src/components/member-row';
import { useSnackbar } from '../../../src/components/snackbar';
import { Button, Card, ErrorBanner, LoadingState, MainTabHeader, Screen } from '../../../src/components/ui';
import { colors, spacing, typography } from '../../../src/constants/theme';
import { useAuth } from '../../../src/context/auth-context';
import { getFarmDetail } from '../../../src/services/farmService';
import { getFarmActorDisplayProfiles, leaveCurrentFarm } from '../../../src/services/memberService';
import type { Farm, FarmActorDisplayProfile } from '../../../src/types/domain';

export default function WorkerFarmHubScreen() {
  const { currentFarm, refresh } = useAuth();
  const showSnackbar = useSnackbar();
  const [farm, setFarm] = React.useState<Farm | null>(currentFarm?.farm ?? null);
  const [actors, setActors] = React.useState<FarmActorDisplayProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [confirmLeave, setConfirmLeave] = React.useState(false);

  const farmId = currentFarm?.farmId;
  const currentUserId = currentFarm?.userId;

  const activeMembers = actors
    .filter((actor) => actor.status === 'active')
    .sort((first, second) => roleOrder(first.role) - roleOrder(second.role));

  const load = React.useCallback(async () => {
    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setFarm(null);
      setActors([]);
      return;
    }

    setError(null);

    const [farmResult, actorsResult] = await Promise.all([
      getFarmDetail(farmId),
      getFarmActorDisplayProfiles(farmId),
    ]);

    if (farmResult.error) {
      setError(farmResult.error.message);
      setFarm(null);
      setActors([]);
      return;
    }

    setFarm(farmResult.data);

    if (actorsResult.error) {
      setError(actorsResult.error.message);
      setActors([]);
      return;
    }

    setActors(actorsResult.data);
  }, [farmId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  function handleRetry() {
    setLoading(true);
    load().finally(() => setLoading(false));
  }

  async function handleLeaveFarm() {
    if (!farmId) {
      return;
    }

    setBusy(true);
    const result = await leaveCurrentFarm({ farmId });
    setBusy(false);

    if (result.error) {
      setConfirmLeave(false);
      showSnackbar(result.error.message);
      return;
    }

    setConfirmLeave(false);
    await refresh();
    router.replace('/removed-access');
  }

  const header = (
    <MainTabHeader title="Kebun" roleLabel="Pekerja" onProfilePress={() => router.push('/worker/profile')} />
  );

  if (loading) {
    return <LoadingState message="Memuat kebun..." />;
  }

  if (!farm) {
    return (
      <Screen header={header}>
        <ErrorBanner message={error} />
        <Card>
          <Text style={{ color: colors.textMuted, lineHeight: 21 }}>Data kebun gagal dimuat.</Text>
          <Button title="Coba lagi" onPress={handleRetry} />
        </Card>
      </Screen>
    );
  }

  const metaLine = buildFarmMetaLine(farm);

  return (
    <Screen header={header}>
      <ErrorBanner message={error} />

      <Card>
        <View style={{ gap: spacing.xs }}>
          <Text
            style={{
              color: colors.text,
              fontSize: typography.h2.fontSize,
              fontWeight: '700',
              lineHeight: typography.h2.lineHeight,
            }}
          >
            {farm.name}
          </Text>
          {metaLine ? (
            <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 20 }}>{metaLine}</Text>
          ) : null}
        </View>
      </Card>

      <SectionLabel
        title="Anggota"
        trailing={<Text style={{ color: colors.textMuted, fontSize: 14 }}>{activeMembers.length} orang</Text>}
      />
      <Card>
        <View>
          {activeMembers.map((actor, index) => (
            <View
              key={actor.userId}
              style={index > 0 ? { borderTopColor: colors.divider, borderTopWidth: 1 } : undefined}
            >
              <MemberRow
                name={actor.fullName}
                meta={buildMemberMeta(actor, currentUserId)}
                tone={actor.role === 'owner' ? 'accent' : 'neutral'}
              />
            </View>
          ))}
        </View>
      </Card>

      <Pressable
        accessibilityRole="button"
        onPress={() => setConfirmLeave(true)}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: spacing.md })}
      >
        <Text
          style={{
            color: colors.danger,
            fontSize: typography.bodyStrong.fontSize,
            fontWeight: '700',
            textAlign: 'center',
          }}
        >
          Keluar dari kebun
        </Text>
      </Pressable>

      <ConfirmDialog
        cancelLabel="Batal"
        confirmLabel="Keluar"
        loading={busy}
        message="Kamu perlu kode bergabung untuk masuk lagi."
        onCancel={() => {
          if (!busy) {
            setConfirmLeave(false);
          }
        }}
        onConfirm={() => void handleLeaveFarm()}
        title="Keluar dari kebun?"
        tone="danger"
        visible={confirmLeave}
      />
    </Screen>
  );
}

function SectionLabel({ title, trailing }: { title: string; trailing?: React.ReactNode }) {
  return (
    <View
      style={{
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.md,
        justifyContent: 'space-between',
        paddingTop: spacing.xs,
      }}
    >
      <Text
        style={{
          color: colors.text,
          fontSize: typography.h3.fontSize,
          fontWeight: '700',
          lineHeight: typography.h3.lineHeight,
        }}
      >
        {title}
      </Text>
      {trailing}
    </View>
  );
}

function roleOrder(role: FarmActorDisplayProfile['role']): number {
  return role === 'owner' ? 0 : 1;
}

function buildMemberMeta(actor: FarmActorDisplayProfile, currentUserId?: string): string {
  const roleLabel = actor.role === 'owner' ? 'Pemilik' : 'Pekerja';
  return actor.userId === currentUserId ? `${roleLabel} · kamu` : roleLabel;
}

function buildFarmMetaLine(farm: Farm): string {
  const parts: string[] = [];
  const location = farm.location?.trim();

  if (location) {
    parts.push(location);
  }

  const area = formatArea(farm.areaSize);

  if (area) {
    parts.push(area);
  }

  return parts.join(' · ');
}

function formatArea(value?: number | null): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return `${new Intl.NumberFormat('id-ID').format(value)} m²`;
}
