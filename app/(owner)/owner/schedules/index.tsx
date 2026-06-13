import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { CareScheduleCard } from '../../../../src/components/care-schedule-components';
import {
  Button,
  EmptyState,
  ErrorBanner,
  LoadingState,
  PageIntro,
  Screen,
} from '../../../../src/components/ui';
import { useAuth } from '../../../../src/context/auth-context';
import { getCareSchedules } from '../../../../src/services/careScheduleService';
import type { CareSchedule } from '../../../../src/types/domain';

export default function CareScheduleListScreen() {
  const { currentFarm, refresh } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [schedules, setSchedules] = React.useState<CareSchedule[]>([]);

  const farmId = currentFarm?.farmId;

  const loadSchedules = React.useCallback(async () => {
    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setSchedules([]);
      return;
    }

    setError(null);

    const result = await getCareSchedules({ farmId });

    if (result.error) {
      setError(result.error.message);
      setSchedules([]);
      return;
    }

    setSchedules(result.data);
  }, [farmId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadSchedules().finally(() => setLoading(false));
    }, [loadSchedules])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    await loadSchedules();
    setRefreshing(false);
  }

  if (loading) {
    return <LoadingState message="Memuat jadwal perawatan..." />;
  }

  return (
    <Screen
      footer={
        <>
          <Button title="Buat Jadwal Manual" onPress={() => router.push('/owner/schedules/create')} />
          <Button title="Refresh" variant="secondary" loading={refreshing} onPress={handleRefresh} />
        </>
      }
    >
      <PageIntro title="Jadwal Perawatan" subtitle="Lihat jadwal kerja manual dan jadwal perawatan kebun." />
      <ErrorBanner message={error} />

      {schedules.length === 0 ? (
        <EmptyState
          title="Belum ada jadwal"
          subtitle="Buat jadwal manual untuk menghasilkan tugas worker."
        />
      ) : (
        <View style={{ gap: 12 }}>
          {schedules.map((schedule) => (
            <CareScheduleCard
              key={schedule.id}
              schedule={schedule}
              onPress={() => router.push(`/owner/schedules/${schedule.id}`)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
