import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { BrandMark, Button, Card, PageIntro, Screen } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/constants/theme';

export default function GetStartedScreen() {
  return (
    <Screen
      footer={
        <>
          <Button title="Mulai" onPress={() => router.push('/register')} />
          <Button title="Masuk" variant="secondary" onPress={() => router.push('/login')} />
        </>
      }
    >
      <View style={{ gap: spacing['3xl'], paddingTop: spacing['2xl'] }}>
        <BrandMark />
        <PageIntro
          title="Kelola kebun alpukat dari genggaman"
          subtitle="Pantau pohon, tugas perawatan, laporan lapangan, dan akses pekerja dalam satu ruang kerja."
        />
      </View>

      <Card variant="highlight">
        <Text selectable style={{ color: colors.text, fontSize: typography.h3.fontSize, fontWeight: '800' }}>
          Operasional kebun alpukat
        </Text>
        <Text selectable style={{ color: colors.textMuted, lineHeight: 22 }}>
          Kelola pohon, jadwal, laporan, dan pekerja dengan alur sederhana.
        </Text>
      </Card>
    </Screen>
  );
}
