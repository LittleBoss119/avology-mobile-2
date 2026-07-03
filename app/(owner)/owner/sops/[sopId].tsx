import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, Modal, Pressable, Text, View } from 'react-native';

import {
  formatCareCategory,
  formatCareSOPTarget,
  formatIntervalDays,
  ScheduleReferenceSummary,
} from '../../../../src/components/care-sop-components';
import {
  Badge,
  Button,
  Card,
  CompactMetaItem,
  EmptyState,
  ErrorBanner,
  LoadingState,
  Screen,
  TopAppBar,
} from '../../../../src/components/ui';
import { colors, radius, spacing, typography } from '../../../../src/constants/theme';
import {
  getCareSOPDetail,
  getCareSOPNextScheduleReference,
  setCareSOPActiveStatus,
} from '../../../../src/services/careSopService';
import type { CareSOP, CareSOPNextScheduleReference } from '../../../../src/types/domain';

export default function CareSOPDetailScreen() {
  const { sopId } = useLocalSearchParams<{ sopId: string }>();
  const [actionLoading, setActionLoading] = React.useState(false);
  const [actionMenuOpen, setActionMenuOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [reference, setReference] = React.useState<CareSOPNextScheduleReference | null>(null);
  const [sop, setSop] = React.useState<CareSOP | null>(null);

  const loadDetail = React.useCallback(async () => {
    const normalizedSopId = sopId?.trim();

    if (!normalizedSopId) {
      setError('Data SOP tidak ditemukan.');
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

    setActionMenuOpen(false);
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
      <Screen>
        <TopAppBar title="Detail SOP" onBack={() => router.back()} />
        <ErrorBanner message={error} />
        <EmptyState title="SOP tidak ditemukan" subtitle="SOP mungkin sudah tidak tersedia atau akses ditolak." />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <View style={{ gap: spacing.sm }}>
          <Button
            title="Buat jadwal dari SOP ini"
            disabled={!sop.isActive}
            onPress={() => router.push(`/owner/sops/${sop.id}/schedule`)}
          />
        </View>
      }
    >
      <TopAppBar
        right={<MenuButton onPress={() => setActionMenuOpen(true)} />}
        title="Detail SOP"
        onBack={() => router.back()}
      />
      <SOPActionMenu
        actionLoading={actionLoading}
        isActive={sop.isActive}
        onClose={() => setActionMenuOpen(false)}
        onEdit={() => {
          setActionMenuOpen(false);
          router.push(`/owner/sops/${sop.id}/edit`);
        }}
        onToggle={handleActiveToggle}
        visible={actionMenuOpen}
      />
      <ErrorBanner message={error} />

      {!sop.isActive ? (
        <Card variant="warning">
          <Text selectable style={{ color: colors.warning, fontSize: 16, fontWeight: '800', lineHeight: 22 }}>
            SOP ini nonaktif. Aktifkan kembali sebelum digunakan untuk jadwal baru.
          </Text>
        </Card>
      ) : null}

      <Card variant="softGreen">
        <Text
          selectable
          style={{
            color: colors.text,
            fontSize: typography.h2.fontSize,
            fontWeight: typography.h2.fontWeight,
            lineHeight: typography.h2.lineHeight,
          }}
        >
          {sop.name}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          <Badge label={sop.isActive ? 'Aktif' : 'Nonaktif'} tone={sop.isActive ? 'success' : 'muted'} />
          <Badge label={formatCareCategory(sop.category)} tone="success" />
        </View>
        <View style={{ alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          <CompactMetaItem icon="calendar" label={formatIntervalDays(sop.intervalDays)} />
          <CompactMetaItem icon="target" label={formatCareSOPTarget(sop)} />
        </View>
      </Card>

      <Card>
        <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
          Instruksi Default
        </Text>
        <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
          {sop.defaultInstruction || 'Belum ada instruksi default.'}
        </Text>
      </Card>

      <Card>
        <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
          Acuan Jadwal
        </Text>
        {reference ? (
          <ScheduleReferenceSummary reference={reference} />
        ) : (
          <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
            Acuan jadwal belum dapat dimuat.
          </Text>
        )}
      </Card>
    </Screen>
  );
}

function MenuButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Buka aksi SOP"
      accessibilityRole="button"
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radius.round,
        borderWidth: 1,
        height: 44,
        justifyContent: 'center',
        width: 44,
      }}
    >
      <KebabGlyph />
    </Pressable>
  );
}

function KebabGlyph() {
  return (
    <View style={{ alignItems: 'center', gap: 3 }}>
      <View style={{ backgroundColor: colors.primary, borderRadius: 999, height: 4, width: 4 }} />
      <View style={{ backgroundColor: colors.primary, borderRadius: 999, height: 4, width: 4 }} />
      <View style={{ backgroundColor: colors.primary, borderRadius: 999, height: 4, width: 4 }} />
    </View>
  );
}

function SOPActionMenu({
  actionLoading,
  isActive,
  onClose,
  onEdit,
  onToggle,
  visible,
}: {
  actionLoading: boolean;
  isActive: boolean;
  onClose: () => void;
  onEdit: () => void;
  onToggle: () => void;
  visible: boolean;
}) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={{ flex: 1 }} onPress={onClose}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radius.lg,
            borderWidth: 1,
            gap: 4,
            padding: 6,
            position: 'absolute',
            right: 20,
            top: 76,
            width: 190,
          }}
        >
          <MenuActionItem label="Edit SOP" onPress={onEdit} />
          <MenuActionItem
            disabled={actionLoading}
            label={isActive ? 'Nonaktifkan SOP' : 'Aktifkan SOP'}
            tone={isActive ? 'danger' : 'default'}
            onPress={onToggle}
          />
        </View>
      </Pressable>
    </Modal>
  );
}

function MenuActionItem({
  disabled,
  label,
  onPress,
  tone = 'default',
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  tone?: 'danger' | 'default';
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.primarySoft : colors.surface,
        borderRadius: radius.md,
        opacity: disabled ? 0.6 : 1,
        paddingHorizontal: 12,
        paddingVertical: 11,
      })}
    >
      <Text selectable style={{ color: tone === 'danger' ? colors.danger : colors.text, fontSize: 14, fontWeight: '800' }}>
        {label}
      </Text>
    </Pressable>
  );
}
