import React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { tokens } from '../constants/theme';
import { colors as palette, fonts, touch } from '../theme/tokens';

// Primitive baris anggota bersama untuk tab Kebun & arsip riwayat akses.
// Warna diambil dari design token (bukan hardcode). Baris TIDAK menggambar
// border sendiri — pemisah antar baris diurus container layar.

type MemberRowTone = 'accent' | 'warning' | 'neutral';

const AVATAR_TONE: Record<MemberRowTone, { background: string; text: string }> = {
  accent: { background: tokens.color.brand.soft, text: tokens.color.brand.base },
  warning: { background: tokens.color.status.warning.bg, text: tokens.color.status.warning.text },
  neutral: { background: tokens.color.surface.subtle, text: tokens.color.text.secondary },
};

// DUA ukuran, dengan pola yang sama seperti `size` di Button dan
// TreeConditionSummary: 'sm' adalah bentuk lama PERSIS (34, caption) sehingga
// setiap pemanggil yang ada — MemberRow di berkas ini, dan owner/farm.tsx —
// tidak bergeser sepiksel pun. 'lg' dipakai blok identitas di layar Profil,
// tempat lingkaran inisial berdiri sendiri sebagai elemen paling atas dan
// bukan penghias baris daftar. Angka 64 bukan angka baru: ia ukuran lingkaran
// yang sama dengan modal di access-status-screen dan create-farm.
const AVATAR_SIZE = { sm: 34, lg: 64 } as const;

export function Avatar({
  name,
  size = 'sm',
  tone = 'neutral',
}: {
  name?: string | null;
  size?: 'sm' | 'lg';
  tone?: MemberRowTone;
}) {
  // Dinamai avatarTone, bukan palette: `palette` kini nama impor token warna di
  // tingkat modul, dan membiarkan nama lokal ini menutupinya membuat dua hal
  // yang sangat berbeda terbaca sama di dalam satu berkas.
  const avatarTone = AVATAR_TONE[tone];
  const box = AVATAR_SIZE[size];
  const textStyle = size === 'lg' ? tokens.type.heading : tokens.type.caption;

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: avatarTone.background,
        borderRadius: tokens.radius.pill,
        height: box,
        justifyContent: 'center',
        width: box,
      }}
    >
      {/* fontFamily dipasang supaya inisial memakai muka huruf yang sama dengan
          nama di sebelahnya. Tanpa itu ia jatuh ke font sistem, dan dua teks
          yang bersebelahan di dalam satu baris terlihat dari keluarga berbeda. */}
      <Text
        selectable={false}
        style={{
          color: avatarTone.text,
          fontFamily: fonts.sansSemiBold,
          fontSize: textStyle.fontSize,
        }}
      >
        {getInitials(name)}
      </Text>
    </View>
  );
}

export function MemberRow({
  meta,
  name,
  onPress,
  tone = 'neutral',
  trailing,
}: {
  meta?: string;
  name: string;
  onPress?: () => void;
  tone?: MemberRowTone;
  trailing?: React.ReactNode;
}) {
  const rowStyle: StyleProp<ViewStyle> = {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.space.md,
    // minHeight ditambahkan di batch 1a. paddingVertical 12 saja tidak
    // menjamin apa pun: baris tanpa `meta` hanya setinggi satu baris teks
    // (~23) + 24 = 47, tepat di bawah target sentuh 48. Selisih satu piksel,
    // tapi ia justru pada baris yang paling sering ada — anggota tanpa
    // keterangan.
    minHeight: touch.row,
    paddingVertical: tokens.space.md,
  };

  const content = (
    <>
      <Avatar name={name} tone={tone} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          selectable={false}
          numberOfLines={1}
          style={{
            color: palette.textPrimary,
            // 17/600 lewat keluarga font, sejajar dengan MenuRow. fontWeight
            // dicabut: Android tidak mensintesis berat untuk font kustom.
            fontFamily: fonts.sansSemiBold,
            fontSize: 17,
            lineHeight: 23,
          }}
        >
          {name}
        </Text>
        {meta ? (
          <Text
            selectable={false}
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{
              color: palette.textMuted,
              fontFamily: fonts.sans,
              // 14, naik dari meta 13. Sejajar dengan meta di MenuRow: dua
              // bentuk baris daftar yang berdampingan di layar yang sama tidak
              // boleh memakai dua ukuran keterangan.
              fontSize: 14,
              lineHeight: 20,
            }}
          >
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={{ flexShrink: 0 }}>{trailing}</View> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [rowStyle, { opacity: pressed ? 0.6 : 1 }]}>
        {content}
      </Pressable>
    );
  }

  return <View style={rowStyle}>{content}</View>;
}

function getInitials(name?: string | null): string {
  const trimmed = name?.trim();

  if (!trimmed) {
    return '?';
  }

  const initials = trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();

  return initials || '?';
}
