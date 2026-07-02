import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { colors, spacing, typography } from '../constants/theme';
import { useAuth } from '../context/auth-context';
import { formatMemberStatus, formatRole } from '../utils/displayFormat';
import { Badge, Button, Card, ErrorBanner, LoadingState, MetaRow, Screen } from './ui';

export function AccessStatusScreen({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  const { currentFarm, error, profile, refresh } = useAuth();
  const [refreshing, setRefreshing] = React.useState(false);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;

      setRefreshing(true);
      refresh().finally(() => {
        if (isActive) {
          setRefreshing(false);
        }
      });

      return () => {
        isActive = false;
      };
    }, [refresh])
  );

  if (!currentFarm) {
    return <LoadingState message="Memuat status akses..." />;
  }

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
    router.replace('/');
  }

  const canReturnToAccessFlow = currentFarm.status === 'rejected' || currentFarm.status === 'removed';
  const canManuallyCheckStatus = currentFarm.status === 'pending';
  const inactiveRecoveryParams = { inactiveRecovery: '1' };
  const displayName = profile?.fullName?.trim() || 'Pengguna Avology';
  const statusTone = getStatusTone(currentFarm.status);
  const statusCardVariant = currentFarm.status === 'pending' ? 'warning' : 'danger';
  const noticeText = getNoticeText(currentFarm.status);
  const statusTitle = currentFarm.status === 'pending' ? 'Status Pengajuan' : title;

  return (
    <Screen
      footer={
        <>
          {canManuallyCheckStatus ? (
            <Button title="Cek Status" loading={refreshing} onPress={handleRefresh} />
          ) : null}
          {canReturnToAccessFlow ? (
            <>
              <Button
                title="Kembali ke Pilih Akses"
                variant="secondary"
                onPress={() =>
                  router.replace({
                    pathname: '/onboarding',
                    params: inactiveRecoveryParams,
                  })
                }
              />
              <Button
                title="Gabung Kebun Lagi"
                variant="secondary"
                onPress={() =>
                  router.replace({
                    pathname: '/join-farm',
                    params: inactiveRecoveryParams,
                  })
                }
              />
            </>
          ) : null}
          <Button title="Profil Akun" variant="secondary" size="small" onPress={() => router.push('/profile')} />
        </>
      }
    >
      <View style={{ gap: spacing.sm }}>
        <View style={{ alignItems: 'flex-start' }}>
          <Badge label={formatRole(currentFarm.role)} tone="info" />
        </View>
        <Text selectable style={{ color: colors.text, fontSize: typography.h1.fontSize, fontWeight: '800', lineHeight: typography.h1.lineHeight }}>
          Halo, {displayName}
        </Text>
        <Text selectable style={{ color: colors.textMuted, fontSize: 16, lineHeight: 23 }}>
          {subtitle}
        </Text>
      </View>
      <ErrorBanner message={error?.message} />
      <Card variant={statusCardVariant}>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' }}>
          <Text selectable style={{ color: colors.text, flex: 1, fontSize: typography.h3.fontSize, fontWeight: '800' }}>
            {statusTitle}
          </Text>
          <Badge label={formatMemberStatus(currentFarm.status)} tone={statusTone} />
        </View>
        <MetaRow label="Kebun tujuan" value={currentFarm.farm?.name ?? 'Belum tersedia'} />
        <MetaRow label="Peran" value={formatRole(currentFarm.role)} />
        <MetaRow label="Status" value={formatMemberStatus(currentFarm.status)} />
      </Card>
      <Card variant={currentFarm.status === 'pending' ? 'info' : 'danger'}>
        <Text selectable style={{ color: currentFarm.status === 'pending' ? colors.info : colors.danger, fontWeight: '800', lineHeight: 21 }}>
          {noticeText}
        </Text>
      </Card>
    </Screen>
  );
}

function getStatusTone(status: string): 'danger' | 'pending' {
  return status === 'pending' ? 'pending' : 'danger';
}

function getNoticeText(status: string): string {
  if (status === 'pending') {
    return 'Perbarui status setelah pemilik memproses pengajuan. Selama menunggu, data kebun belum dapat diakses.';
  }

  if (status === 'removed') {
    return 'Akses kebun sudah dinonaktifkan. Kamu dapat kembali ke pilihan akses untuk membuat kebun sendiri atau mengajukan akses baru.';
  }

  return 'Pengajuan akses ditolak. Kamu dapat kembali ke pilihan akses atau menggunakan kode kebun lain jika tersedia.';
}
