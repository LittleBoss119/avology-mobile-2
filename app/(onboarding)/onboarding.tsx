import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Badge, Button, Card, ErrorBanner, Screen, TopAppBar } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/constants/theme';
import { useAuth } from '../../src/context/auth-context';

export default function OnboardingDecisionScreen() {
  const { currentFarm, error } = useAuth();
  const isInactiveRecovery = currentFarm?.status === 'rejected' || currentFarm?.status === 'removed';
  const inactiveRecoveryParams = isInactiveRecovery ? { inactiveRecovery: '1' } : undefined;

  return (
    <Screen>
      <TopAppBar
        title="Pilih Akses"
        variant="main"
        right={
          <Button
            title="Profil"
            size="small"
            variant="quiet"
            onPress={() => router.push('/profile')}
          />
        }
      />

      <ErrorBanner message={error?.message} />

      <Card variant="highlight">
        <View style={{ gap: spacing.sm }}>
          <Badge label="Pemilik" tone="info" />
          <Text selectable style={{ color: colors.text, fontSize: typography.h3.fontSize, fontWeight: '800' }}>
            Buat Kebun
          </Text>
          <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
            Buat ruang kerja kebun baru.
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
            Masukkan kode dari pemilik.
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
    </Screen>
  );
}
