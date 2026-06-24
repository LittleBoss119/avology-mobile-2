import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { CareSOPCard } from '../../../../src/components/care-sop-components';
import {
  appTheme,
  EmptyState,
  ErrorBanner,
  LoadingState,
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
      floatingAction={<FloatingAddButton onPress={() => router.push('/owner/sops/create')} />}
      floatingActionBottom={86}
    >
      <View style={{ gap: 5, paddingTop: 6 }}>
        <Text selectable style={{ color: appTheme.primary, fontSize: 31, fontWeight: '900', letterSpacing: 0 }}>
          Template SOP
        </Text>
        <Text selectable style={{ color: appTheme.muted, fontSize: 15, lineHeight: 22 }}>
          Simpan template perawatan untuk membuat jadwal lebih cepat.
        </Text>
      </View>
      <ErrorBanner message={error} />

      <SOPSummary
        active={sops.filter((sop) => sop.isActive).length}
        inactive={sops.filter((sop) => !sop.isActive).length}
        total={sops.length}
      />

      <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text selectable style={{ color: appTheme.text, fontSize: 19, fontWeight: '900' }}>
          Daftar SOP
        </Text>
        <Text selectable style={{ color: appTheme.primary, fontSize: 13, fontWeight: '800' }}>
          Perawatan
        </Text>
      </View>

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

function SOPSummary({
  active,
  inactive,
  total,
}: {
  active: number;
  inactive: number;
  total: number;
}) {
  return (
    <View
      style={{
        backgroundColor: appTheme.primary,
        borderRadius: 18,
        gap: 14,
        padding: 18,
      }}
    >
      <Text selectable style={{ color: '#DDEFE2', fontSize: 15, fontWeight: '800' }}>
        SOP Perawatan
      </Text>
      <Text selectable style={{ color: '#FFFFFF', fontSize: 28, fontVariant: ['tabular-nums'], fontWeight: '900' }}>
        {total} template
      </Text>
      <View style={{ flexDirection: 'row', gap: 9 }}>
        <SummaryPill label="Aktif" value={active} />
        <SummaryPill label="Nonaktif" value={inactive} />
      </View>
    </View>
  );
}

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
    <View
      style={{
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderColor: 'rgba(255,255,255,0.22)',
        borderRadius: 14,
        borderWidth: 1,
        flex: 1,
        gap: 3,
        padding: 11,
      }}
    >
      <Text selectable style={{ color: '#DDEFE2', fontSize: 12, fontWeight: '800' }}>
        {label}
      </Text>
      <Text selectable style={{ color: '#A6D96A', fontSize: 23, fontVariant: ['tabular-nums'], fontWeight: '900' }}>
        {value}
      </Text>
    </View>
  );
}

function FloatingAddButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Tambah SOP"
      accessibilityRole="button"
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: appTheme.primary,
        borderColor: '#B8D8BF',
        borderRadius: 999,
        borderWidth: 1,
        height: 58,
        justifyContent: 'center',
        width: 58,
      }}
    >
      <Text selectable style={{ color: '#FFFFFF', fontSize: 36, fontWeight: '400', lineHeight: 40 }}>
        +
      </Text>
    </Pressable>
  );
}
