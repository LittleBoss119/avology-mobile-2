import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import {
  approveWorker,
  getWorkerMemberships,
  rejectWorker,
  removeWorker,
} from '../../../src/services/memberService';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  MetaRow,
  Screen,
  SectionHeader,
  TopAppBar,
} from '../../../src/components/ui';
import { showConfirmDialog, showErrorToast, showSuccessToast } from '../../../src/components/feedback';
import { colors, radius, spacing } from '../../../src/constants/theme';
import { useAuth } from '../../../src/context/auth-context';
import type { WorkerMembership } from '../../../src/types/domain';

type WorkerAction = 'approve' | 'reject' | 'remove';

export default function WorkerManagementScreen() {
  const { currentFarm } = useAuth();
  const [workers, setWorkers] = React.useState<WorkerMembership[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [actionId, setActionId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [historyExpanded, setHistoryExpanded] = React.useState(false);

  const farmId = currentFarm?.farmId;
  const pendingWorkers = workers.filter((worker) => worker.status === 'pending');
  const activeWorkers = workers.filter((worker) => worker.status === 'active');
  const historyWorkers = workers.filter((worker) => worker.status === 'rejected' || worker.status === 'removed');
  const visibleHistoryWorkers = historyExpanded ? historyWorkers : historyWorkers.slice(0, 3);

  const loadWorkers = React.useCallback(async () => {
    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setWorkers([]);
      return;
    }

    setError(null);

    const result = await getWorkerMemberships(farmId);

    if (result.error) {
      setError(result.error.message);
      setWorkers([]);
    } else {
      setWorkers(result.data);
    }
  }, [farmId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadWorkers().finally(() => setLoading(false));
    }, [loadWorkers])
  );

  async function handleAction(membershipId: string, action: WorkerAction) {
    setActionId(`${action}:${membershipId}`);
    setError(null);

    const result =
      action === 'approve'
        ? await approveWorker({ membershipId })
        : action === 'reject'
          ? await rejectWorker({ membershipId })
          : await removeWorker({ membershipId });

    if (result.error) {
      console.debug('[worker-management] action failed', {
        action,
        message: result.error.message,
      });
      setError('Ups, aksi belum berhasil. Coba lagi.');
      showErrorToast('Ups, aksi belum berhasil. Coba lagi.');
      setActionId(null);
      return;
    }

    await loadWorkers();
    setActionId(null);
    showSuccessToast(getSuccessMessage(action));
  }

  function confirmReject(worker: WorkerMembership) {
    showConfirmDialog({
      confirmLabel: 'Tolak',
      danger: true,
      message: `${worker.fullName} tidak akan mendapat akses ke kebun ini.`,
      onConfirm: () => {
        void handleAction(worker.membershipId, 'reject');
      },
      title: 'Tolak pengajuan?',
    });
  }

  function confirmRemove(worker: WorkerMembership) {
    showConfirmDialog({
      confirmLabel: 'Nonaktifkan',
      danger: true,
      message: `Akses ${worker.fullName} ke kebun ini akan dinonaktifkan. Akun pekerja tidak dihapus permanen.`,
      onConfirm: () => {
        void handleAction(worker.membershipId, 'remove');
      },
      title: 'Nonaktifkan akses pekerja?',
    });
  }

  if (loading) {
    return <LoadingState message="Memuat pekerja..." />;
  }

  return (
    <Screen>
      <TopAppBar title="Pekerja" onBack={() => router.back()} />
      <ErrorBanner message={error} />

      <WorkerSummary
        activeCount={activeWorkers.length}
        historyCount={historyWorkers.length}
        pendingCount={pendingWorkers.length}
      />

      <SectionHeader title="Menunggu Persetujuan" />
      {pendingWorkers.length === 0 ? (
        <EmptyState title="Tidak ada pengajuan baru." />
      ) : (
        <View style={{ gap: spacing.listGap }}>
          {pendingWorkers.map((worker) => (
            <WorkerAccessCard key={worker.membershipId} dateLabel="Tanggal pengajuan" dateValue={worker.createdAt} worker={worker}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Terima"
                    loading={actionId === `approve:${worker.membershipId}`}
                    size="small"
                    onPress={() => handleAction(worker.membershipId, 'approve')}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Tolak"
                    variant="danger"
                    loading={actionId === `reject:${worker.membershipId}`}
                    size="small"
                    onPress={() => confirmReject(worker)}
                  />
                </View>
              </View>
            </WorkerAccessCard>
          ))}
        </View>
      )}

      <SectionHeader title="Pekerja Aktif" />
      {activeWorkers.length === 0 ? (
        <EmptyState title="Belum ada pekerja aktif." />
      ) : (
        <View style={{ gap: spacing.listGap }}>
          {activeWorkers.map((worker) => (
            <WorkerAccessCard key={worker.membershipId} dateLabel="Bergabung" dateValue={worker.joinedAt} worker={worker}>
              <Button
                title="Nonaktifkan akses"
                variant="danger"
                loading={actionId === `remove:${worker.membershipId}`}
                size="small"
                onPress={() => confirmRemove(worker)}
              />
            </WorkerAccessCard>
          ))}
        </View>
      )}

      <SectionHeader title="Riwayat Akses">
        <Text selectable style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
          Ditolak atau dinonaktifkan.
        </Text>
      </SectionHeader>
      {historyWorkers.length === 0 ? (
        <EmptyState title="Belum ada riwayat akses." />
      ) : (
        <View style={{ gap: spacing.listGap }}>
          {visibleHistoryWorkers.map((worker) => (
            <WorkerAccessCard
              key={worker.membershipId}
              compact
              dateLabel={worker.status === 'rejected' ? 'Tanggal pengajuan' : 'Diperbarui'}
              dateValue={worker.status === 'rejected' ? worker.createdAt : worker.updatedAt}
              worker={worker}
            />
          ))}
          {historyWorkers.length > 3 ? (
            <Button
              title={historyExpanded ? 'Tampilkan lebih sedikit' : `Lihat ${historyWorkers.length - 3} riwayat lagi`}
              variant="quiet"
              size="small"
              onPress={() => setHistoryExpanded((current) => !current)}
            />
          ) : null}
        </View>
      )}
    </Screen>
  );
}

function WorkerSummary({
  activeCount,
  historyCount,
  pendingCount,
}: {
  activeCount: number;
  historyCount: number;
  pendingCount: number;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      <SummaryChip label="Menunggu" tone="warning" value={pendingCount} />
      <SummaryChip label="Aktif" tone="success" value={activeCount} />
      <SummaryChip label="Riwayat" tone="muted" value={historyCount} />
    </View>
  );
}

function SummaryChip({
  label,
  tone,
  value,
}: {
  label: string;
  tone: 'muted' | 'success' | 'warning';
  value: number;
}) {
  const toneStyle = getSummaryToneStyle(tone);

  return (
    <View
      style={{
        backgroundColor: toneStyle.background,
        borderColor: toneStyle.border,
        borderRadius: radius.lg,
        borderWidth: 1,
        flexBasis: '30%',
        flexGrow: 1,
        gap: spacing.xs,
        minWidth: 96,
        padding: spacing.md,
      }}
    >
      <Text selectable style={{ color: toneStyle.text, fontSize: 22, fontVariant: ['tabular-nums'], fontWeight: '900' }}>
        {value}
      </Text>
      <Text selectable style={{ color: colors.textMuted, fontSize: 12, fontWeight: '800' }}>
        {label}
      </Text>
    </View>
  );
}

function WorkerAccessCard({
  children,
  compact = false,
  dateLabel,
  dateValue,
  worker,
}: {
  children?: React.ReactNode;
  compact?: boolean;
  dateLabel: string;
  dateValue?: string | null;
  worker: WorkerMembership;
}) {
  return (
    <Card padding={compact ? spacing.md : spacing.cardPadding} variant={compact ? 'default' : 'softGreen'}>
      <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text selectable numberOfLines={2} style={{ color: colors.text, fontSize: 17, fontWeight: '900', lineHeight: 23 }}>
            {worker.fullName}
          </Text>
          {worker.phone ? (
            <Text selectable numberOfLines={1} style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
              {worker.phone}
            </Text>
          ) : null}
        </View>
        <Badge label={formatMembershipStatus(worker.status)} tone={getMembershipTone(worker.status)} />
      </View>

      <View style={{ gap: compact ? spacing.xs : spacing.sm }}>
        <MetaRow label={dateLabel} value={formatDateTime(dateValue)} />
        {!compact && worker.updatedAt ? <MetaRow label="Diperbarui" value={formatDateTime(worker.updatedAt)} /> : null}
      </View>

      {children}
    </Card>
  );
}

function getSuccessMessage(action: WorkerAction): string {
  if (action === 'approve') {
    return 'Pekerja berhasil diterima.';
  }

  if (action === 'reject') {
    return 'Pengajuan pekerja ditolak.';
  }

  return 'Akses pekerja dinonaktifkan.';
}

function formatMembershipStatus(status: WorkerMembership['status']): string {
  const labels: Record<WorkerMembership['status'], string> = {
    active: 'Aktif',
    pending: 'Menunggu',
    rejected: 'Ditolak',
    removed: 'Dinonaktifkan',
  };

  return labels[status];
}

function getMembershipTone(status: WorkerMembership['status']): 'danger' | 'muted' | 'success' | 'warning' {
  if (status === 'active') {
    return 'success';
  }

  if (status === 'pending') {
    return 'warning';
  }

  if (status === 'rejected') {
    return 'danger';
  }

  return 'muted';
}

function getSummaryToneStyle(tone: 'muted' | 'success' | 'warning') {
  if (tone === 'success') {
    return {
      background: colors.successBg,
      border: colors.successBorder,
      text: colors.success,
    };
  }

  if (tone === 'warning') {
    return {
      background: colors.warningBg,
      border: colors.warningBorder,
      text: colors.warning,
    };
  }

  return {
    background: colors.neutralBg,
    border: colors.neutralBorder,
    text: colors.neutral,
  };
}

function formatDateTime(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString('id-ID', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
