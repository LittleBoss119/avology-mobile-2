import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Badge, Button, Card, ErrorBanner, MetaRow, Screen } from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/constants/theme';
import { useAuth } from '../../src/context/auth-context';

export default function OnboardingDecisionScreen() {
  const { currentFarm, error, profile, signOut } = useAuth();
  const isInactiveRecovery = currentFarm?.status === 'rejected' || currentFarm?.status === 'removed';
  const inactiveRecoveryParams = isInactiveRecovery ? { inactiveRecovery: '1' } : undefined;

  async function handleLogout() {
    const signOutError = await signOut();

    if (!signOutError) {
      router.replace('/get-started');
    }
  }

  const displayName = profile?.fullName?.trim() || 'Pengguna Avology';
  const initial = displayName.charAt(0).toUpperCase() || 'A';

  return (
    <Screen>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
        <View
          style={{
            alignItems: 'center',
            backgroundColor: colors.primarySoft,
            borderColor: colors.primaryBorder,
            borderRadius: radius.round,
            borderWidth: 1,
            height: 48,
            justifyContent: 'center',
            width: 48,
          }}
        >
          <Text selectable style={{ color: colors.primary, fontSize: 20, fontWeight: '900' }}>
            {initial}
          </Text>
        </View>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text selectable style={{ color: colors.text, fontSize: typography.h1.fontSize, fontWeight: '800', lineHeight: typography.h1.lineHeight }}>
            Halo, {displayName}
          </Text>
          <Text selectable style={{ color: colors.textMuted, fontSize: 16, lineHeight: 23 }}>
            Hubungkan akun dengan kebun untuk mulai bekerja.
          </Text>
        </View>
      </View>

      <ErrorBanner message={error?.message} />

      <Card variant="highlight">
        <View style={{ gap: spacing.sm }}>
          <Badge label="Pemilik" tone="info" />
          <Text selectable style={{ color: colors.text, fontSize: typography.h3.fontSize, fontWeight: '800' }}>
            Buat Kebun
          </Text>
          <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
            Untuk pemilik yang ingin mengelola kebun baru. Buat data kebun dan dapatkan kode untuk mengundang pekerja.
          </Text>
          <Button
            title="Buat Kebun"
            onPress={() =>
              router.push({
                pathname: '/create-farm',
                params: inactiveRecoveryParams,
              })
            }
          />
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.sm }}>
          <Badge label="Pekerja" tone="neutral" />
          <Text selectable style={{ color: colors.text, fontSize: typography.h3.fontSize, fontWeight: '800' }}>
            Gabung Kebun
          </Text>
          <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
            Untuk pekerja yang menerima kode dari pemilik. Ajukan akses, lalu tunggu persetujuan pemilik.
          </Text>
          <Button
            title="Gabung Kebun"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: '/join-farm',
                params: inactiveRecoveryParams,
              })
            }
          />
        </View>
      </Card>

      <Card>
        <Text selectable style={{ color: colors.text, fontSize: typography.h3.fontSize, fontWeight: '800' }}>
          Akun Saya
        </Text>
        <MetaRow label="Nama" value={profile?.fullName} />
        <MetaRow label="Nomor HP" value={profile?.phone} />
        {profile?.email ? <MetaRow label="Email login" value={profile.email} /> : null}
        <View style={{ gap: spacing.md }}>
          <Button title="Profil Akun" variant="secondary" size="small" onPress={() => router.push('/profile')} />
          <Button title="Keluar Akun" variant="secondary" onPress={handleLogout} />
        </View>
      </Card>
    </Screen>
  );
}
