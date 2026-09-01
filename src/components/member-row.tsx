import React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { tokens } from '../constants/theme';

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
  const palette = AVATAR_TONE[tone];
  const box = AVATAR_SIZE[size];
  const textStyle = size === 'lg' ? tokens.type.heading : tokens.type.caption;

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: palette.background,
        borderRadius: tokens.radius.pill,
        height: box,
        justifyContent: 'center',
        width: box,
      }}
    >
      <Text selectable={false} style={{ color: palette.text, fontSize: textStyle.fontSize, fontWeight: '700' }}>
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
            color: tokens.color.text.primary,
            fontSize: tokens.type.bodyStrong.fontSize,
            fontWeight: '700',
            lineHeight: tokens.type.bodyStrong.lineHeight,
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
              color: tokens.color.text.secondary,
              fontSize: tokens.type.meta.fontSize,
              lineHeight: tokens.type.meta.lineHeight,
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
