import { useFocusEffect } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { MemberRow } from '../../../src/components/member-row';
import { Card, EmptyState, ErrorBanner, LoadingState, Screen } from '../../../src/components/ui';
import { colors } from '../../../src/constants/theme';
import { useAuth } from '../../../src/context/auth-context';
import { getWorkerMemberships } from '../../../src/services/memberService';
import type { WorkerMembership } from '../../../src/types/domain';

export default function WorkerAccessHistoryScreen() {
  const { currentFarm } = useAuth();
  const [workers, setWorkers] = React.useState<WorkerMembership[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const farmId = currentFarm?.farmId;
  const history = workers
    .filter((worker) => worker.status === 'rejected' || worker.status === 'removed')
    .sort((first, second) => relevantTime(second) - relevantTime(first));

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

  if (loading) {
    return <LoadingState message="Memuat riwayat akses..." />;
  }

  return (
    <Screen applyTopInset>
      <ErrorBanner message={error} />
      {history.length === 0 ? (
        <EmptyState title="Belum ada riwayat akses." />
      ) : (
        <Card>
          <View>
            {history.map((worker, index) => (
              <View
                key={worker.membershipId}
                style={index > 0 ? { borderTopColor: colors.divider, borderTopWidth: 1 } : undefined}
              >
                <MemberRow name={worker.fullName} meta={buildHistoryMeta(worker)} tone="neutral" />
              </View>
            ))}
          </View>
        </Card>
      )}
    </Screen>
  );
}

function buildHistoryMeta(worker: WorkerMembership): string {
  const label = worker.status === 'rejected' ? 'Ditolak' : 'Dinonaktifkan';
  return `${label} · ${formatDate(relevantDate(worker))}`;
}

function relevantDate(worker: WorkerMembership): string | null {
  if (worker.status === 'removed') {
    return worker.removedAt ?? worker.updatedAt ?? worker.createdAt ?? null;
  }

  return worker.updatedAt ?? worker.createdAt ?? null;
}

function relevantTime(worker: WorkerMembership): number {
  const value = relevantDate(worker);

  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function formatDate(value: string | null): string {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
