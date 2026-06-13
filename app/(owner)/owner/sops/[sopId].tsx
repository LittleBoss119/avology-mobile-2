import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, Text } from 'react-native';

import {
  formatCareCategory,
  formatCareSOPTarget,
  formatIntervalDays,
  ScheduleReferenceSummary,
} from '../../../../src/components/care-sop-components';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  MetaRow,
  PageIntro,
  Screen,
} from '../../../../src/components/ui';
import {
  getCareSOPDetail,
  getCareSOPNextScheduleReference,
  setCareSOPActiveStatus,
} from '../../../../src/services/careSopService';
import type { CareSOP, CareSOPNextScheduleReference } from '../../../../src/types/domain';

export default function CareSOPDetailScreen() {
  const { sopId } = useLocalSearchParams<{ sopId: string }>();
  const [actionLoading, setActionLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [reference, setReference] = React.useState<CareSOPNextScheduleReference | null>(null);
  const [sop, setSop] = React.useState<CareSOP | null>(null);

  const loadDetail = React.useCallback(async () => {
    const normalizedSopId = sopId?.trim();

    if (!normalizedSopId) {
      setError('SOP ID tidak ditemukan.');
      setSop(null);
      setReference(null);
      return;
    }

    setError(null);

    const [sopResult, referenceResult] = await Promise.all([
      getCareSOPDetail({ sopId: normalizedSopId }),
      getCareSOPNextScheduleReference({ sopId: normalizedSopId }),
    ]);

    if (sopResult.error) {
      setError(sopResult.error.message);
      setSop(null);
      setReference(null);
      return;
    }

    setSop(sopResult.data);

    if (referenceResult.error) {
      setError(referenceResult.error.message);
      setReference(null);
    } else {
      setReference(referenceResult.data);
    }
  }, [sopId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadDetail().finally(() => setLoading(false));
    }, [loadDetail])
  );

  function handleActiveToggle() {
    if (!sop) {
      return;
    }

    const nextIsActive = !sop.isActive;

    Alert.alert(
      nextIsActive ? 'Aktifkan SOP?' : 'Nonaktifkan SOP?',
      nextIsActive
        ? 'SOP akan dapat dipakai kembali untuk membuat jadwal.'
        : 'SOP tetap tersimpan, tetapi tidak dipakai sebagai SOP aktif.',
      [
        {
          text: 'Batal',
          style: 'cancel',
        },
        {
          text: nextIsActive ? 'Aktifkan' : 'Nonaktifkan',
          style: nextIsActive ? 'default' : 'destructive',
          onPress: () => {
            runActiveToggle(nextIsActive);
          },
        },
      ]
    );
  }

  async function runActiveToggle(isActive: boolean) {
    if (!sop) {
      return;
    }

    setActionLoading(true);
    setError(null);

    const result = await setCareSOPActiveStatus({
      isActive,
      sopId: sop.id,
    });

    if (result.error) {
      setError(result.error.message);
      setActionLoading(false);
      return;
    }

    await loadDetail();
    setActionLoading(false);
  }

  if (loading) {
    return <LoadingState message="Memuat detail SOP..." />;
  }

  if (!sop) {
    return (
      <Screen footer={<Button title="Kembali" variant="secondary" onPress={() => router.replace('/owner/sops')} />}>
        <PageIntro title="Detail SOP" subtitle="Data SOP tidak dapat dimuat." />
        <ErrorBanner message={error} />
        <EmptyState title="SOP tidak ditemukan" subtitle="SOP mungkin sudah tidak tersedia atau akses ditolak." />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <>
          <Button
            title="Buat Jadwal dari SOP"
            disabled={!sop.isActive}
            onPress={() => router.push(`/owner/sops/${sop.id}/schedule`)}
          />
          <Button title="Edit SOP" variant="secondary" onPress={() => router.push(`/owner/sops/${sop.id}/edit`)} />
          <Button
            title={sop.isActive ? 'Nonaktifkan SOP' : 'Aktifkan SOP'}
            variant={sop.isActive ? 'danger' : 'secondary'}
            loading={actionLoading}
            onPress={handleActiveToggle}
          />
        </>
      }
    >
      <PageIntro title={sop.name} subtitle="Detail template perawatan dan acuan jadwal berikutnya." />
      <ErrorBanner message={error} />

      <Card>
        <MetaRow label="Kategori" value={formatCareCategory(sop.category)} />
        <MetaRow label="Interval" value={formatIntervalDays(sop.intervalDays)} />
        <MetaRow label="Target default" value={formatCareSOPTarget(sop)} />
        <MetaRow label="Status" value={sop.isActive ? 'Aktif' : 'Nonaktif'} />
      </Card>

      <Card>
        <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '700' }}>
          Instruksi Default
        </Text>
        <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
          {sop.defaultInstruction || 'Instruksi belum diisi.'}
        </Text>
      </Card>

      <Card>
        <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '700' }}>
          Acuan Jadwal
        </Text>
        {reference ? (
          <ScheduleReferenceSummary reference={reference} />
        ) : (
          <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
            Acuan jadwal belum dapat dimuat.
          </Text>
        )}
      </Card>
    </Screen>
  );
}
