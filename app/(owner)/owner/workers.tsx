import { useFocusEffect } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import {
  approveWorker,
  getActiveWorkers,
  getPendingWorkers,
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

export default function WorkerManagementScreen() {
  const { currentFarm, refresh } = useAuth();
  const [pendingWorkers, setPendingWorkers] = React.useState<WorkerMembership[]>([]);
  const [activeWorkers, setActiveWorkers] = React.useState<WorkerMembership[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [actionId, setActionId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const farmId = currentFarm?.farmId;

  const loadWorkers = React.useCallback(async () => {
    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setPendingWorkers([]);
      setActiveWorkers([]);
      return;
    }

    setError(null);
    const [pendingResult, activeResult] = await Promise.all([
      getPendingWorkers(farmId),
      getActiveWorkers(farmId),
    ]);

    if (pendingResult.error) {
      setError(pendingResult.error.message);
      setPendingWorkers([]);
    } else {
      setPendingWorkers(pendingResult.data);
    }

    if (activeResult.error) {
      setError(activeResult.error.message);
      setActiveWorkers([]);
    } else {
      setActiveWorkers(activeResult.data);
    }
  }, [farmId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadWorkers().finally(() => setLoading(false));
    }, [loadWorkers])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    await loadWorkers();
    setRefreshing(false);
  }

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
    return <LoadingState message="Memuat worker..." />;
  }

  return (
    <Screen footer={<Button title="Refresh" variant="secondary" loading={refreshing} onPress={handleRefresh} />}>
      <PageIntro
        title="Worker Management"
        subtitle="Setujui pengajuan worker, tolak pengajuan, atau nonaktifkan worker aktif."
      />
      <ErrorBanner message={error} />

      <SectionTitle title="Pengajuan Worker" />
      {pendingWorkers.length === 0 ? (
        <EmptyState title="Tidak ada pengajuan" subtitle="Pengajuan worker baru akan muncul di sini." />
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

      <SectionTitle title="Worker Aktif" />
      {activeWorkers.length === 0 ? (
        <EmptyState title="Belum ada worker aktif" subtitle="Worker yang disetujui akan muncul di sini." />
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
  children: React.ReactNode;
  worker: WorkerMembership;
}) {
  return (
    <Card>
      <MetaRow label="Nama" value={worker.fullName} />
      <MetaRow label="Nomor HP" value={worker.phone} />
      <MetaRow label="Status" value={formatMembershipStatus(worker.status)} />
      {children}
    </Card>
  );
}

function formatMembershipStatus(status: WorkerMembership['status']): string {
  const labels: Record<WorkerMembership['status'], string> = {
    active: 'Aktif',
    pending: 'Menunggu approval',
    rejected: 'Ditolak',
    removed: 'Dinonaktifkan',
  };

  return labels[status];
}
