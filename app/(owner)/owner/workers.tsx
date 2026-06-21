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
import { formatMemberStatus } from '../../../src/utils/displayFormat';

export default function WorkerManagementScreen() {
  const { currentFarm } = useAuth();
  const [pendingWorkers, setPendingWorkers] = React.useState<WorkerMembership[]>([]);
  const [activeWorkers, setActiveWorkers] = React.useState<WorkerMembership[]>([]);
  const [loading, setLoading] = React.useState(true);
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
        subtitle="Setujui pengajuan, tolak pengajuan, atau nonaktifkan pekerja aktif."
      />
      <ErrorBanner message={error} />

      <SectionTitle title="Pengajuan Pekerja" />
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
  return formatMemberStatus(status);
}
