import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { BottomSheet, ConfirmDialog } from '../../../src/components/bottom-sheet';
import { Icon } from '../../../src/components/icons';
import { MemberRow } from '../../../src/components/member-row';
import { useSnackbar } from '../../../src/components/snackbar';
import {
  Button,
  Card,
  ErrorBanner,
  LoadingState,
  MainTabHeader,
  MetaRow,
  Screen,
} from '../../../src/components/ui';
import { colors, radius, spacing, tokens, typography } from '../../../src/constants/theme';
import { useAuth } from '../../../src/context/auth-context';
import { getFarmDetail } from '../../../src/services/farmService';
import {
  approveWorker,
  getWorkerMemberships,
  rejectWorker,
  removeWorker,
} from '../../../src/services/memberService';
import type { Farm, WorkerMembership } from '../../../src/types/domain';

type SheetState = { mode: 'active' | 'pending'; worker: WorkerMembership };
type ConfirmState = { mode: 'reject' | 'remove'; worker: WorkerMembership };

export default function OwnerFarmHubScreen() {
  const { currentFarm, profile } = useAuth();
  const showSnackbar = useSnackbar();
  const [farm, setFarm] = React.useState<Farm | null>(currentFarm?.farm ?? null);
  const [workers, setWorkers] = React.useState<WorkerMembership[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [sheet, setSheet] = React.useState<SheetState | null>(null);
  const [confirm, setConfirm] = React.useState<ConfirmState | null>(null);

  const farmId = currentFarm?.farmId;
  const ownerName = profile?.fullName ?? 'Pemilik kebun';

  const pendingWorkers = workers.filter((worker) => worker.status === 'pending');
  const activeWorkers = workers
    .filter((worker) => worker.status === 'active')
    .sort((first, second) => toTime(first.joinedAt) - toTime(second.joinedAt));
  const historyCount = workers.filter(
    (worker) => worker.status === 'rejected' || worker.status === 'removed'
  ).length;
  const memberCount = 1 + activeWorkers.length;

  const load = React.useCallback(async () => {
    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setFarm(null);
      setWorkers([]);
      return;
    }

    setError(null);

    const [farmResult, workersResult] = await Promise.all([
      getFarmDetail(farmId),
      getWorkerMemberships(farmId),
    ]);

    if (farmResult.error) {
      setError(farmResult.error.message);
      setFarm(null);
      setWorkers([]);
      return;
    }

    setFarm(farmResult.data);

    if (workersResult.error) {
      setError(workersResult.error.message);
      setWorkers([]);
      return;
    }

    setWorkers(workersResult.data);
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

  async function handleCopyJoinCode() {
    if (!farm?.joinCode) {
      return;
    }

    await Clipboard.setStringAsync(farm.joinCode);
    showSnackbar('Kode disalin');
  }

  async function handleApprove(worker: WorkerMembership) {
    setBusy(true);
    const result = await approveWorker({ membershipId: worker.membershipId });
    setBusy(false);

    if (result.error) {
      showSnackbar(result.error.message);
      return;
    }

    setSheet(null);
    await load();
    showSnackbar(`${worker.fullName} diterima`);
  }

  async function handleReject(worker: WorkerMembership) {
    setBusy(true);
    const result = await rejectWorker({ membershipId: worker.membershipId });
    setBusy(false);
    setConfirm(null);

    if (result.error) {
      showSnackbar(result.error.message);
      return;
    }

    setSheet(null);
    await load();
    showSnackbar('Pengajuan ditolak');
  }

  async function handleRemove(worker: WorkerMembership) {
    setBusy(true);
    const result = await removeWorker({ membershipId: worker.membershipId });
    setBusy(false);
    setConfirm(null);

    if (result.error) {
      showSnackbar(result.error.message);
      return;
    }

    setSheet(null);
    await load();
    showSnackbar(`Akses ${worker.fullName} dinonaktifkan`);
  }

  const header = <MainTabHeader title="Kebun" roleLabel="Pemilik" onProfilePress={() => router.push('/owner/profile')} />;

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
  const memberRows: React.ReactNode[] = [];

  pendingWorkers.forEach((worker) => {
    memberRows.push(
      <MemberRow
        key={`pending-${worker.membershipId}`}
        name={worker.fullName}
        meta={`Mengajukan ${formatDayMonth(worker.createdAt)}`}
        tone="warning"
        trailing={
          <Button title="Tinjau" variant="secondary" size="small" onPress={() => setSheet({ mode: 'pending', worker })} />
        }
      />
    );
  });

  memberRows.push(<MemberRow key="owner" name={ownerName} meta="Pemilik · kamu" tone="accent" />);

  if (activeWorkers.length > 0) {
    activeWorkers.forEach((worker) => {
      memberRows.push(
        <MemberRow
          key={`active-${worker.membershipId}`}
          name={worker.fullName}
          meta={`Pekerja · sejak ${formatDayMonth(worker.joinedAt)}`}
          tone="neutral"
          trailing={
            <Pressable
              accessibilityLabel={`Opsi untuk ${worker.fullName}`}
              accessibilityRole="button"
              hitSlop={{ bottom: 8, left: 8, right: 8, top: 8 }}
              onPress={() => setSheet({ mode: 'active', worker })}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: spacing.xs })}
            >
              <Icon name="dots" size={20} color={colors.textSoft} />
            </Pressable>
          }
        />
      );
    });
  } else {
    memberRows.push(
      <Text key="no-active" style={{ color: colors.textMuted, lineHeight: 21, paddingVertical: tokens.space.md }}>
        Belum ada pekerja aktif.
      </Text>
    );
  }

  memberRows.push(
    <Pressable
      key="history"
      accessibilityRole="button"
      onPress={() => router.push('/owner/workers')}
      style={({ pressed }) => ({
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.md,
        justifyContent: 'space-between',
        opacity: pressed ? 0.6 : 1,
        paddingVertical: tokens.space.md,
      })}
    >
      <Text style={{ color: colors.text, fontSize: typography.bodyStrong.fontSize, fontWeight: '700' }}>
        Riwayat akses
      </Text>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs }}>
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>{historyCount}</Text>
        <Icon name="chevron-right" size={20} color={colors.textSoft} />
      </View>
    </Pressable>
  );

  return (
    <Screen header={header}>
      <ErrorBanner message={error} />

      <Card>
        <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={{ color: colors.text, fontSize: typography.h2.fontSize, fontWeight: '700', lineHeight: typography.h2.lineHeight }}>
              {farm.name}
            </Text>
            {metaLine ? (
              <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 20 }}>{metaLine}</Text>
            ) : null}
          </View>
          <Button title="Edit" variant="secondary" size="small" onPress={() => router.push('/owner/farm-profile')} />
        </View>
      </Card>

      <SectionLabel title="Kode bergabung" />
      <Card>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text
              style={{
                color: colors.text,
                fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
                fontSize: 24,
                fontWeight: '700',
                letterSpacing: 2,
              }}
            >
              {farm.joinCode}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>Bagikan ke pekerja baru.</Text>
          </View>
          <Pressable
            accessibilityLabel="Salin kode"
            accessibilityRole="button"
            onPress={handleCopyJoinCode}
            style={({ pressed }) => ({
              alignItems: 'center',
              backgroundColor: pressed ? colors.primarySoft : colors.surface,
              borderColor: colors.border,
              borderCurve: 'continuous',
              borderRadius: 11,
              borderWidth: 1,
              height: 34,
              justifyContent: 'center',
              width: 34,
            })}
          >
            <Icon name="copy" size={20} color={colors.primary} />
          </Pressable>
        </View>
      </Card>

      <SectionLabel
        title="Anggota"
        trailing={<Text style={{ color: colors.textMuted, fontSize: 14 }}>{memberCount} orang</Text>}
      />
      <Card>
        <View>
          {memberRows.map((row, index) => (
            <View
              key={index}
              style={index > 0 ? { borderTopColor: colors.divider, borderTopWidth: 1 } : undefined}
            >
              {row}
            </View>
          ))}
        </View>
      </Card>

      <SectionLabel title="Aturan kerja" />
      <Card>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/owner/sops')}
          style={({ pressed }) => ({
            alignItems: 'center',
            flexDirection: 'row',
            gap: spacing.md,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <View
            style={{
              alignItems: 'center',
              backgroundColor: tokens.color.surface.subtle,
              borderRadius: radius.round,
              height: 38,
              justifyContent: 'center',
              width: 38,
            }}
          >
            <Icon name="file-text" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: colors.text, fontSize: typography.bodyStrong.fontSize, fontWeight: '700' }}>
              SOP perawatan
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
              Template instruksi untuk pekerja
            </Text>
          </View>
          <Icon name="chevron-right" size={20} color={colors.textSoft} />
        </Pressable>
      </Card>

      <BottomSheet
        onClose={() => {
          if (!busy) {
            setSheet(null);
          }
        }}
        title={sheet?.worker.fullName ?? ''}
        visible={sheet !== null}
      >
        {sheet ? (
          <View style={{ gap: spacing.md }}>
            <MetaRow label="Nomor telepon" value={sheet.worker.phone} />
            {sheet.mode === 'pending' ? (
              <>
                <MetaRow label="Diajukan" value={formatDateTimeFull(sheet.worker.createdAt)} />
                <Button title="Terima" loading={busy} onPress={() => handleApprove(sheet.worker)} />
                <Button
                  title="Tolak"
                  variant="danger"
                  disabled={busy}
                  onPress={() => setConfirm({ mode: 'reject', worker: sheet.worker })}
                />
              </>
            ) : (
              <>
                <MetaRow label="Bergabung" value={formatDateTimeFull(sheet.worker.joinedAt)} />
                <Button
                  title="Nonaktifkan akses"
                  variant="danger"
                  disabled={busy}
                  onPress={() => setConfirm({ mode: 'remove', worker: sheet.worker })}
                />
              </>
            )}
          </View>
        ) : null}
      </BottomSheet>

      <ConfirmDialog
        cancelLabel="Batal"
        confirmLabel={confirm?.mode === 'reject' ? 'Tolak' : 'Nonaktifkan'}
        loading={busy}
        message={buildConfirmMessage(confirm)}
        onCancel={() => {
          if (!busy) {
            setConfirm(null);
          }
        }}
        onConfirm={() => {
          if (!confirm) {
            return;
          }

          if (confirm.mode === 'reject') {
            void handleReject(confirm.worker);
          } else {
            void handleRemove(confirm.worker);
          }
        }}
        title={confirm?.mode === 'reject' ? 'Tolak pengajuan?' : 'Nonaktifkan akses?'}
        tone="danger"
        visible={confirm !== null}
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
      <Text style={{ color: colors.text, fontSize: typography.h3.fontSize, fontWeight: '700', lineHeight: typography.h3.lineHeight }}>
        {title}
      </Text>
      {trailing}
    </View>
  );
}

function buildConfirmMessage(confirm: ConfirmState | null): string {
  if (!confirm) {
    return '';
  }

  if (confirm.mode === 'reject') {
    return `${confirm.worker.fullName} tidak akan bisa mengakses kebun ini.`;
  }

  return `${confirm.worker.fullName} akan kehilangan akses ke kebun ini. Dia perlu mengajukan ulang dengan kode bergabung untuk kembali.`;
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

function toTime(value?: string | null): number {
  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function formatDayMonth(value?: string | null): string {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function formatDateTimeFull(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString('id-ID', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}
