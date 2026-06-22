import { useFocusEffect } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import {
  approveWorker,
  getWorkerMemberships,
  rejectWorker,
  removeWorker,
} from '../../../src/services/memberService';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  MetaRow,
  PageIntro,
  Screen,
} from '../../../src/components/ui';
import { useAuth } from '../../../src/context/auth-context';
import type { WorkerMembership } from '../../../src/types/domain';
import { formatMemberStatus } from '../../../src/utils/displayFormat';

export default function WorkerManagementScreen() {
  const { currentFarm } = useAuth();
  const [workers, setWorkers] = React.useState<WorkerMembership[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [actionId, setActionId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const farmId = currentFarm?.farmId;
  const pendingWorkers = workers.filter((worker) => worker.status === 'pending');
  const activeWorkers = workers.filter((worker) => worker.status === 'active');
  const historyWorkers = workers.filter((worker) =>
    worker.status === 'rejected' || worker.status === 'removed'
  );

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

  async function handleAction(
    membershipId: string,
    action: 'approve' | 'reject' | 'remove'
  ) {
    setActionId(`${action}:${membershipId}`);
    setError(null);

    const result =
      action === 'approve'
        ? await approveWorker({ membershipId })
        : action === 'reject'
          ? await rejectWorker({ membershipId })
          : await removeWorker({ membershipId });

    if (result.error) {
      setError(result.error.message);
      setActionId(null);
      return;
    }

    await loadWorkers();
    setActionId(null);
  }

  if (loading) {
    return <LoadingState message="Memuat pekerja..." />;
  }

  return (
    <Screen>
      <PageIntro
        title="Manajemen Pekerja"
        subtitle="Kelola pengajuan, pekerja aktif, dan akses pekerja yang tidak aktif."
      />
      <ErrorBanner message={error} />

      <SectionTitle title="Pengajuan Menunggu" />
      {pendingWorkers.length === 0 ? (
        <EmptyState title="Tidak ada pengajuan" subtitle="Pengajuan pekerja baru akan muncul di sini." />
      ) : (
        pendingWorkers.map((worker) => (
          <WorkerCard key={worker.membershipId} worker={worker}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Setujui"
                  loading={actionId === `approve:${worker.membershipId}`}
                  onPress={() => handleAction(worker.membershipId, 'approve')}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Tolak"
                  variant="danger"
                  loading={actionId === `reject:${worker.membershipId}`}
                  onPress={() => handleAction(worker.membershipId, 'reject')}
                />
              </View>
            </View>
          </WorkerCard>
        ))
      )}

      <SectionTitle title="Pekerja Aktif" />
      {activeWorkers.length === 0 ? (
        <EmptyState title="Belum ada pekerja aktif" subtitle="Pekerja yang disetujui akan muncul di sini." />
      ) : (
        activeWorkers.map((worker) => (
          <WorkerCard key={worker.membershipId} worker={worker}>
            <Button
              title="Nonaktifkan"
              variant="danger"
              loading={actionId === `remove:${worker.membershipId}`}
              onPress={() => handleAction(worker.membershipId, 'remove')}
            />
          </WorkerCard>
        ))
      )}

      <SectionTitle title="Akses Tidak Aktif" />
      {historyWorkers.length === 0 ? (
        <EmptyState
          title="Belum ada akses tidak aktif"
          subtitle="Pekerja yang ditolak atau dinonaktifkan akan muncul di sini."
        />
      ) : (
        historyWorkers.map((worker) => (
          <WorkerCard key={worker.membershipId} worker={worker} />
        ))
      )}
    </Screen>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Text selectable style={{ color: '#1E2A24', fontSize: 20, fontWeight: '700', paddingTop: 4 }}>
      {title}
    </Text>
  );
}

function WorkerCard({
  children,
  worker,
}: {
  children?: React.ReactNode;
  worker: WorkerMembership;
}) {
  return (
    <Card>
      <MetaRow label="Nama" value={worker.fullName} />
      <MetaRow label="Nomor HP" value={worker.phone} />
      <MetaRow label="Status" value={formatMembershipStatus(worker.status)} />
      <MetaRow label="Tanggal pengajuan" value={formatDateTime(worker.createdAt)} />
      <MetaRow label="Terakhir diperbarui" value={formatDateTime(worker.updatedAt)} />
      {children}
    </Card>
  );
}

function formatMembershipStatus(status: WorkerMembership['status']): string {
  return formatMemberStatus(status);
}

function formatDateTime(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('id-ID', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
