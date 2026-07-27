import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, MainTabHeader, MetaRow, Screen, SectionHeader } from '../../../src/components/ui';
import { colors, radius, spacing } from '../../../src/constants/theme';
import { useAuth } from '../../../src/context/auth-context';
import { getOwnerDashboardSummary } from '../../../src/services/dashboardService';
import { getActiveWorkers, getFarmActorDisplayProfiles, getPendingWorkers } from '../../../src/services/memberService';
import type { FarmActorDisplayProfile, OwnerDashboardSummary, WorkerMembership } from '../../../src/types/domain';

type OwnerFarmHubData = {
  activeWorkerCount: number | null;
  activeWorkers: WorkerMembership[];
  actors: FarmActorDisplayProfile[];
  pendingWorkerCount: number | null;
  summary: OwnerDashboardSummary | null;
};

export default function OwnerFarmHubScreen() {
  const { currentFarm } = useAuth();
  const [hubData, setHubData] = React.useState<OwnerFarmHubData>({
    activeWorkerCount: null,
    activeWorkers: [],
    actors: [],
    pendingWorkerCount: null,
    summary: null,
  });
  const farm = currentFarm?.farm;
  const farmId = currentFarm?.farmId;
  const ownerName = findOwnerName(hubData.actors) ?? 'Pemilik kebun';

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;

      async function loadHubData() {
        if (!farmId) {
          return;
        }

        const [summaryResult, activeWorkersResult, pendingWorkersResult, actorsResult] = await Promise.all([
          getOwnerDashboardSummary({ farmId }),
          getActiveWorkers(farmId),
          getPendingWorkers(farmId),
          getFarmActorDisplayProfiles(farmId),
        ]);

        if (!isActive) {
          return;
        }

        setHubData({
          activeWorkerCount: activeWorkersResult.error ? null : activeWorkersResult.data?.length ?? 0,
          activeWorkers: activeWorkersResult.data ?? [],
          actors: actorsResult.data ?? [],
          pendingWorkerCount: pendingWorkersResult.error ? null : pendingWorkersResult.data?.length ?? 0,
          summary: summaryResult.data,
        });

        logOptionalHubError('ringkasan kebun', summaryResult.error?.message);
        logOptionalHubError('pekerja aktif', activeWorkersResult.error?.message);
        logOptionalHubError('pengajuan pekerja', pendingWorkersResult.error?.message);
        logOptionalHubError('anggota kebun', actorsResult.error?.message);
      }

      loadHubData();

      return () => {
        isActive = false;
      };
    }, [farmId])
  );

  return (
    <Screen>
      <MainTabHeader title="Kebun" onProfilePress={() => router.push('/owner/profile')} />

      <Card variant="highlight">
        <SectionHeader title="Profil Kebun" />
        {!farm ? (
          <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
            Data kebun belum tersedia.
          </Text>
        ) : null}
        <MetaRow label="Nama kebun" value={farm?.name} />
        <MetaRow label="Lokasi" value={farm?.location} />
        <MetaRow label="Luas" value={formatArea(farm?.areaSize)} />
        <MetaRow label="Total pohon aktif" value={formatCount(hubData.summary?.totalTrees, 'pohon')} />
        <NavRow label="Edit kebun" onPress={() => router.push('/owner/farm-profile')} />
      </Card>

      <Card>
        <SectionHeader title="Kode Bergabung" />
        <View
          style={{
            backgroundColor: colors.surfaceMuted,
            borderColor: colors.border,
            borderRadius: radius.lg,
            borderWidth: 1,
            gap: spacing.xs,
            padding: spacing.md,
          }}
        >
          <Text selectable style={{ color: colors.text, fontSize: 24, fontWeight: '700', letterSpacing: 1 }}>
            {farm?.joinCode ?? 'Belum tersedia'}
          </Text>
          <Text selectable style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
            Tekan lama kode untuk menyalin.
          </Text>
        </View>
      </Card>

      <Card>
        <SectionHeader title="Anggota Kebun" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          <SummaryPill label="Pekerja aktif" value={formatSummaryCount(hubData.activeWorkerCount)} />
          <SummaryPill label="Menunggu" tone="warning" value={formatSummaryCount(hubData.pendingWorkerCount)} />
        </View>
        <MetaRow label="Pemilik" value={ownerName} />
        {hubData.activeWorkers.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            {hubData.activeWorkers.slice(0, 3).map((worker) => (
              <WorkerPreviewRow key={worker.membershipId} worker={worker} />
            ))}
          </View>
        ) : (
          <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
            Belum ada pekerja aktif.
          </Text>
        )}
        <NavRow label="Kelola Pekerja" onPress={() => router.push('/owner/workers')} />
      </Card>

      <Card>
        <SectionHeader title="Operasional" />
        <NavRow
          label="SOP Perawatan"
          subtitle="Template instruksi perawatan kebun."
          onPress={() => router.push('/owner/sops')}
        />
        <NavRow
          label="Jadwal Perawatan"
          subtitle="Buat dan pantau agenda kerja."
          onPress={() => router.push('/owner/schedules')}
        />
      </Card>
    </Screen>
  );
}

function NavRow({ label, onPress, subtitle }: { label: string; onPress: () => void; subtitle?: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
        borderColor: colors.border,
        borderRadius: radius.lg,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing.md,
        justifyContent: 'space-between',
        padding: spacing.md,
      })}
    >
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text selectable style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
          {label}
        </Text>
        {subtitle ? (
          <Text selectable style={{ color: colors.textMuted, lineHeight: 19 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Text selectable style={{ color: colors.primary, fontSize: 20, fontWeight: '700' }}>
        {'>'}
      </Text>
    </Pressable>
  );
}

function SummaryPill({ label, tone = 'success', value }: { label: string; tone?: 'success' | 'warning'; value: number | string }) {
  const isUnavailable = typeof value === 'string';

  return (
    <View
      style={{
        backgroundColor: tone === 'warning' ? colors.warningBg : colors.successBg,
        borderColor: tone === 'warning' ? colors.warningBorder : colors.successBorder,
        borderRadius: radius.lg,
        borderWidth: 1,
        flexBasis: 132,
        flexGrow: 1,
        gap: spacing.xs,
        padding: spacing.md,
      }}
    >
      <Text selectable style={{ color: tone === 'warning' ? colors.warning : colors.success, fontSize: isUnavailable ? 15 : 22, fontWeight: '700' }}>
        {value}
      </Text>
      <Text selectable style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
        {label}
      </Text>
    </View>
  );
}

function WorkerPreviewRow({ worker }: { worker: WorkerMembership }) {
  return (
    <View
      style={{
        borderColor: colors.border,
        borderRadius: radius.lg,
        borderWidth: 1,
        padding: spacing.md,
      }}
    >
      <Text selectable numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
        {worker.fullName}
      </Text>
      {worker.phone ? (
        <Text selectable numberOfLines={1} style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
          {worker.phone}
        </Text>
      ) : null}
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

function formatSummaryCount(value: number | null): number | string {
  return value ?? 'Belum tersedia';
}

function logOptionalHubError(label: string, message?: string | null) {
  if (typeof __DEV__ !== 'undefined' && __DEV__ && message) {
    console.debug('[owner-farm] Optional data unavailable', { label, message });
  }
}
