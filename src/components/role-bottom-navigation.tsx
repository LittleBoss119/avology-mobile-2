import { router, usePathname } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing, tokens, typography } from '../constants/theme';
import type { MemberRole } from '../types/domain';
import { Icon, type IconName } from './icons';

type NavigationItem = {
  icon: NavigationIconName;
  label: string;
  href: string;
  match: string[];
};

type NavigationIconName = 'document' | 'farm' | 'home' | 'leaf' | 'checklist' | 'user';

// Peta nama ikon navigasi (internal) → IconName Tabler di icons.tsx.
//
// 'document' dan 'farm' tidak lagi dipakai sejak item Laporan dan Kebun dicabut,
// tapi sengaja DIBIARKAN: keduanya masih ikon yang benar untuk kedua tujuan itu
// kalau suatu saat kembali ke bar, dan menghapusnya tidak menghemat apa pun.
const NAV_ICON: Record<NavigationIconName, IconName> = {
  home: 'home',
  checklist: 'list-check',
  leaf: 'tree',
  document: 'file-text',
  farm: 'building-warehouse',
  user: 'user',
};

export function RoleBottomNavigation({ role }: { role: MemberRole }) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const items = role === 'owner' ? ownerNavigationItems : workerNavigationItems;

  if (!shouldShowBottomNavigation(pathname, role)) {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor: colors.bg,
        paddingBottom: Math.max(insets.bottom, spacing.sm),
        paddingHorizontal: spacing.md,
        paddingTop: spacing.xs,
      }}
    >
      <View
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderCurve: 'continuous',
          borderRadius: radius.screenCard,
          borderWidth: 1,
          flexDirection: 'row',
          gap: 4,
          minHeight: 64,
          padding: 5,
        }}
      >
        {items.map((item) => {
          const isActive = item.match.some((match) => isActivePath(pathname, match));

          return (
            <Pressable
              key={item.href}
              onPress={() => router.replace(item.href)}
              style={{
                alignItems: 'center',
                backgroundColor: isActive ? tokens.color.brand.soft : 'transparent',
                borderCurve: 'continuous',
                borderRadius: tokens.radius.cardInner,
                flex: 1,
                gap: 2,
                justifyContent: 'center',
                minHeight: 52,
                paddingHorizontal: 4,
                paddingVertical: 5,
              }}
            >
              <Icon
                name={NAV_ICON[item.icon]}
                size={tokens.icon.lg}
                color={isActive ? tokens.color.brand.base : tokens.color.text.tertiary}
              />
              <Text
                selectable={false}
                numberOfLines={1}
                style={{
                  color: isActive ? tokens.color.brand.base : tokens.color.text.tertiary,
                  fontSize: typography.navLabel.fontSize,
                  fontWeight: isActive ? '500' : '400',
                  lineHeight: typography.navLabel.lineHeight,
                  textAlign: 'center',
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Empat item, bukan lima. Laporan dan Kebun dicabut dari bar dan pindah ke
// baris tujuan di dashboard (app/(owner)/owner/index.tsx) — keduanya layar yang
// dibuka sesekali, bukan tempat yang ditinggali sepanjang hari.
//
// Kebun dan Laporan kini hanya dicapai dari Beranda, jadi keduanya diperlakukan
// sebagai TURUNAN Beranda: path-nya masuk ke `match` item Beranda supaya ikon
// Beranda tetap tersorot selama user berada di cabang itu. `href`-nya tidak
// ikut berubah — menekan Beranda tetap membawa ke '/owner', bukan ke tempat
// terakhir di cabangnya.
//
// '/owner/farm-profile' dan '/owner/workers' harus disebut sendiri-sendiri:
// keduanya cabang dari layar Kebun tapi bukan subpath '/owner/farm/', sehingga
// aturan startsWith di isActivePath() tidak menjangkaunya.
//
// Daftar path tempat bar DITAMPILKAN (ownerTopLevelPaths di bawah) dibiarkan
// utuh.
const ownerNavigationItems: NavigationItem[] = [
  {
    href: '/owner',
    icon: 'home',
    label: 'Beranda',
    match: ['/owner', '/owner/farm', '/owner/farm-profile', '/owner/workers', '/owner/reports'],
  },
  {
    href: '/owner/trees',
    icon: 'leaf',
    label: 'Pohon',
    match: ['/owner/trees'],
  },
  {
    href: '/owner/schedules',
    icon: 'checklist',
    label: 'Perawatan',
    match: ['/owner/schedules', '/owner/tasks'],
  },
  {
    href: '/owner/profile',
    icon: 'user',
    label: 'Profil',
    match: ['/owner/profile'],
  },
];

function isActivePath(pathname: string, match: string): boolean {
  if (match === '/owner' || match === '/worker') {
    return pathname === match;
  }

  return pathname === match || pathname.startsWith(`${match}/`);
}

// Bentuknya sejajar dengan ownerNavigationItems di atas, termasuk alasannya.
//
// Label item ketiga "Perawatan", bukan "Tugas", meski href-nya '/worker/tasks'.
// Itu DISENGAJA: kedua peran menyebut hal yang sama dengan kata yang sama,
// walau pekerja masuk lewat daftar tugasnya sendiri dan pemilik lewat jadwal.
const workerNavigationItems: NavigationItem[] = [
  {
    href: '/worker',
    icon: 'home',
    label: 'Beranda',
    match: ['/worker', '/worker/farm', '/worker/reports'],
  },
  {
    href: '/worker/trees',
    icon: 'leaf',
    label: 'Pohon',
    match: ['/worker/trees'],
  },
  {
    href: '/worker/tasks',
    icon: 'checklist',
    label: 'Perawatan',
    match: ['/worker/tasks'],
  },
  {
    href: '/worker/profile',
    icon: 'user',
    label: 'Profil',
    match: ['/worker/profile'],
  },
];

function shouldShowBottomNavigation(pathname: string, role: MemberRole): boolean {
  const visiblePaths = role === 'owner' ? ownerTopLevelPaths : workerTopLevelPaths;
  return visiblePaths.includes(pathname);
}

const ownerTopLevelPaths = [
  '/owner',
  '/owner/trees',
  '/owner/schedules',
  '/owner/tasks',
  '/owner/reports',
  '/owner/farm',
  '/owner/profile',
];

const workerTopLevelPaths = [
  '/worker',
  '/worker/tasks',
  '/worker/trees',
  '/worker/reports',
  '/worker/farm',
  '/worker/profile',
];
