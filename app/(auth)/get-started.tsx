import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, Screen } from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/constants/theme';

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
      <View style={{ alignItems: 'center', flex: 1, gap: spacing.lg, justifyContent: 'center', paddingBottom: spacing['4xl'] }}>
        <View
          style={{
            alignItems: 'center',
            backgroundColor: colors.primary,
            borderColor: colors.primaryBorder,
            borderCurve: 'continuous',
            borderRadius: radius['2xl'],
            borderWidth: 1,
            height: 74,
            justifyContent: 'center',
            width: 74,
          }}
        >
          <Text selectable={false} style={{ color: colors.surface, fontSize: 34, fontWeight: '900' }}>
            A
          </Text>
        </View>
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <Text selectable style={{ color: colors.text, fontSize: typography.display.fontSize, fontWeight: '900', lineHeight: typography.display.lineHeight }}>
            Avology
          </Text>
          <Text selectable style={{ color: colors.textMuted, fontSize: 16, lineHeight: 23, textAlign: 'center' }}>
            Kelola kebun alpukat dengan lebih rapi.
          </Text>
        </View>
      </View>
    </Screen>
  );
}
