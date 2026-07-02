import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Badge, Card, ErrorBanner, MainTabHeader, MetaRow, Screen, SectionHeader } from '../../../src/components/ui';
import { colors, radius, spacing } from '../../../src/constants/theme';
import { useAuth } from '../../../src/context/auth-context';
import { getOwnerDashboardSummary } from '../../../src/services/dashboardService';
import { getActiveWorkers, getFarmActorDisplayProfiles, getPendingWorkers } from '../../../src/services/memberService';
import type { FarmActorDisplayProfile, OwnerDashboardSummary, WorkerMembership } from '../../../src/types/domain';
import { formatMemberStatus, formatPersonDisplayName, formatRole } from '../../../src/utils/displayFormat';

type OwnerFarmHubData = {
  activeWorkerCount: number | null;
  activeWorkers: WorkerMembership[];
  actors: FarmActorDisplayProfile[];
  pendingWorkerCount: number | null;
  pendingWorkers: WorkerMembership[];
  summary: OwnerDashboardSummary | null;
};

export default function OwnerFarmHubScreen() {
  const { currentFarm, profile, signOut } = useAuth();
  const [hubData, setHubData] = React.useState<OwnerFarmHubData>({
    activeWorkerCount: null,
    activeWorkers: [],
    actors: [],
    pendingWorkerCount: null,
    pendingWorkers: [],
    summary: null,
  });
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [logoutError, setLogoutError] = React.useState<string | null>(null);
  const farm = currentFarm?.farm;
  const farmId = currentFarm?.farmId;

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
          pendingWorkers: pendingWorkersResult.data ?? [],
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

  const ownerName = findOwnerName(hubData.actors) ?? formatPersonDisplayName(profile?.fullName, 'Pemilik kebun');

  return (
    <Screen>
      <MainTabHeader
        title="Kebun"
        roleLabel="Pemilik"
        subtitle="Data kebun, anggota, dan operasional."
        onProfilePress={() => router.push('/owner/profile')}
      />
      <ErrorBanner message={logoutError} />

      <Card variant="highlight">
        <SectionHeader description="Ringkasan identitas kebun aktif." title="Data Kebun" />
        {!farm ? (
          <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
            Data utama kebun belum tersedia. Coba buka kembali halaman ini beberapa saat lagi.
          </Text>
        ) : null}
        <MetaRow label="Nama kebun" value={farm?.name} />
        <MetaRow label="Lokasi" value={farm?.location} />
        <MetaRow label="Luas kebun" value={formatArea(farm?.areaSize)} />
        <MetaRow label="Total pohon aktif" value={formatCount(hubData.summary?.totalTrees, 'pohon')} />
        <MetaRow label="Kode bergabung" value={farm?.joinCode} />
        <NavRow label="Buka Profil Kebun" onPress={() => router.push('/owner/farm-profile')} />
      </Card>

      <Card>
        <SectionHeader description="Pantau anggota dan pengajuan akses pekerja." title="Anggota Kebun" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          <SummaryPill label="Pekerja aktif" value={formatSummaryCount(hubData.activeWorkerCount)} />
          <SummaryPill label="Menunggu" tone="warning" value={formatSummaryCount(hubData.pendingWorkerCount)} />
        </View>
        <MetaRow label="Owner" value={ownerName} />
        <NavRow label="Kelola Anggota" onPress={() => router.push('/owner/workers')} />
      </Card>

      <Card>
        <SectionHeader description="Akses cepat untuk pekerjaan operasional kebun." title="Manajemen Operasional" />
        <NavRow label="Manajemen Pekerja" subtitle="Kelola pekerja aktif dan pengajuan." onPress={() => router.push('/owner/workers')} />
        <NavRow label="SOP Perawatan" subtitle="Template instruksi dan jadwal berulang." onPress={() => router.push('/owner/sops')} />
        <NavRow label="Jadwal Perawatan" subtitle="Buat dan pantau agenda perawatan." onPress={() => router.push('/owner/schedules')} />
      </Card>

      <Card>
        <SectionHeader description="Data pribadi akun Avology." title="Akun Saya" />
        <MetaRow label="Nama" value={formatPersonDisplayName(profile?.fullName, 'Pemilik kebun')} />
        {profile?.email ? <MetaRow label="Email login" value={profile.email} /> : null}
        <MetaRow label="Nomor HP" value={profile?.phone} />
        <NavRow label="Profil Akun" onPress={() => router.push('/owner/profile')} />
        <DangerRow disabled={loggingOut} label={loggingOut ? 'Keluar...' : 'Keluar Akun'} onPress={handleLogout} />
      </Card>
    </Screen>
  );
}

function NavRow({ label, onPress, subtitle }: { label: string; onPress: () => void; subtitle?: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
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
        <Text selectable style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>
          {label}
        </Text>
        {subtitle ? (
          <Text selectable style={{ color: colors.textMuted, lineHeight: 19 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Text selectable style={{ color: colors.primary, fontSize: 20, fontWeight: '900' }}>
        {'>'}
      </Text>
    </Pressable>
  );
}

function DangerRow({ disabled, label, onPress }: { disabled?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.dangerBorder : colors.dangerBg,
        borderColor: colors.dangerBorder,
        borderRadius: radius.lg,
        borderWidth: 1,
        opacity: disabled ? 0.6 : 1,
        padding: spacing.md,
      })}
    >
      <Text selectable style={{ color: colors.danger, fontSize: 15, fontWeight: '800', textAlign: 'center' }}>
        {label}
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
      <Text selectable style={{ color: tone === 'warning' ? colors.warning : colors.success, fontSize: isUnavailable ? 15 : 22, fontWeight: '900' }}>
        {value}
      </Text>
      <Text selectable style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
        {label}
      </Text>
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
