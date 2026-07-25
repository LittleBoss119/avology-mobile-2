import { Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';

import { colors, radius, spacing } from '../constants/theme';
import type { GrowthPhase } from '../types/domain';
import { daysSinceLocal } from '../utils/dateDiff';
import { FlowerIcon, FlowerOffIcon } from './icons';

// RF-11a: pita "N hari sejak berbunga". NON-PREDIKTIF — hanya menampilkan
// jumlah hari sejak fase berbunga terakhir, tanpa klaim estimasi/kesiapan panen.
//
// Dipakai bersama oleh detail pohon dan monitoring fase. Gating fase membuatnya
// aman dipasang di mana pun: hanya muncul untuk fase berbunga/berbuah, hilang
// total saat panen atau fase lebih awal.
export function FloweringAgeMarker({
  currentGrowthPhase,
  lastFloweringAt,
}: {
  currentGrowthPhase: GrowthPhase | null;
  lastFloweringAt: string | null;
}) {
  if (currentGrowthPhase !== 'flowering' && currentGrowthPhase !== 'fruiting') {
    return null;
  }

  const days = lastFloweringAt ? daysSinceLocal(lastFloweringAt) : null;

  if (days === null) {
    // Fase berbunga/berbuah tapi belum ada catatan fase 'flowering' — versi netral.
    return (
      <View style={[markerBase, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
        <FlowerOffIcon color={colors.textSoft} size={18} />
        <Text selectable style={{ color: colors.textMuted, fontSize: 14, fontWeight: '700' }}>
          Belum ada catatan berbunga
        </Text>
      </View>
    );
  }

  return (
    <View style={[markerBase, { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder }]}>
      <FlowerIcon color={colors.primary} size={18} />
      <Text selectable style={{ color: colors.primary, fontSize: 14, fontWeight: '800' }}>
        {days} hari sejak berbunga
      </Text>
    </View>
  );
}

const markerBase: ViewStyle = {
  alignItems: 'center',
  borderCurve: 'continuous',
  borderRadius: radius.lg,
  borderWidth: 1,
  flexDirection: 'row',
  gap: spacing.sm,
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.md,
};
