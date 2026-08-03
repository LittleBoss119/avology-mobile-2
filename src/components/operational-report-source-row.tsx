import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { colors, spacing, tokens } from '../constants/theme';
import { Card } from './ui';
import { Icon } from './icons';

// Satu baris "dari laporan" di layar detail tugas — owner maupun pekerja.
// Sengaja TIDAK menyalin ulang kategori/lokasi/pelapor/status laporan: semua
// itu ada di layar tujuan, dan menduplikasinya berarti dua tempat yang harus
// dijaga sinkron.
//
// `onPress` boleh kosong. Pekerja hanya bisa membaca laporan yang dia buat
// sendiri (RLS operational_reports), jadi tugas yang berasal dari laporan
// pekerja lain ditampilkan sebagai teks saja — lebih baik daripada link yang
// pasti berakhir di layar "laporan tidak ditemukan".
export function ReportSourceRow({
  description,
  onPress,
}: {
  description?: string | null;
  onPress?: () => void;
}) {
  const trimmedDescription = description?.trim();
  const label = trimmedDescription
    ? `Dari laporan: ${trimmedDescription}`
    : 'Dari laporan operasional';

  const content = (
    <Card padding={spacing.md}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
        <Icon name="file-text" size={tokens.icon.sm} color={colors.textSoft} />
        <Text
          selectable={false}
          ellipsizeMode="tail"
          numberOfLines={1}
          style={{ color: colors.textSecondary, flex: 1, fontSize: 13, lineHeight: 18 }}
        >
          {label}
        </Text>
        {onPress ? (
          <Icon name="chevron-right" size={tokens.icon.sm} color={colors.textSoft} />
        ) : null}
      </View>
    </Card>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {content}
    </Pressable>
  );
}
