import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { CareSOPCard } from '../../../../src/components/care-sop-components';
import {
  Button,
  EmptyState,
  ErrorBanner,
  LoadingState,
  PageIntro,
  Screen,
} from '../../../../src/components/ui';
import { useAuth } from '../../../../src/context/auth-context';
import {
  getCareSOPNextScheduleReference,
  getCareSOPs,
} from '../../../../src/services/careSopService';
import type { CareSOP, CareSOPNextScheduleReference } from '../../../../src/types/domain';

export default function CareSOPListScreen() {
  const { currentFarm } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [references, setReferences] = React.useState<Record<string, CareSOPNextScheduleReference>>({});
  const [sops, setSops] = React.useState<CareSOP[]>([]);

  const farmId = currentFarm?.farmId;

  const loadSops = React.useCallback(async () => {
    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setSops([]);
      setReferences({});
      return;
    }

    setError(null);

    const result = await getCareSOPs({ farmId });

    if (result.error) {
      setError(result.error.message);
      setSops([]);
      setReferences({});
      return;
    }

    setSops(result.data);

    const referenceEntries = await Promise.all(
      result.data.map(async (sop) => {
        const referenceResult = await getCareSOPNextScheduleReference({ sopId: sop.id });
        return [sop.id, referenceResult.error ? null : referenceResult.data] as const;
      })
    );

    setReferences(
      Object.fromEntries(
        referenceEntries.filter((entry): entry is readonly [string, CareSOPNextScheduleReference] =>
          Boolean(entry[1])
        )
      )
    );
  }, [farmId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadSops().finally(() => setLoading(false));
    }, [loadSops])
  );

  if (loading) {
    return <LoadingState message="Memuat SOP perawatan..." />;
  }

  return (
    <Screen
      footer={
        <>
          <Button title="Tambah SOP" onPress={() => router.push('/owner/sops/create')} />
        </>
      }
    >
      <PageIntro title="SOP Perawatan" subtitle="Kelola template perawatan untuk membuat jadwal kerja." />
      <ErrorBanner message={error} />

      {sops.length === 0 ? (
        <EmptyState
          title="Belum ada SOP"
          subtitle="Tambahkan SOP perawatan pertama untuk menyimpan instruksi dan interval kerja."
        />
      ) : (
        <View style={{ gap: 12 }}>
          {sops.map((sop) => (
            <CareSOPCard
              key={sop.id}
              reference={references[sop.id]}
              sop={sop}
              onPress={() => router.push(`/owner/sops/${sop.id}`)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
