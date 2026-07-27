import { router, usePathname } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing, tokens, typography } from '../constants/theme';
import { Icon, type IconName } from './icons';

type NavigationItem = {
  icon: NavigationIconName;
  label: string;
  href: string;
  match: string[];
};

type NavigationIconName = 'document' | 'farm' | 'home' | 'leaf' | 'checklist';

// Peta nama ikon navigasi (internal) → IconName Tabler di icons.tsx.
const NAV_ICON: Record<NavigationIconName, IconName> = {
  home: 'home',
  checklist: 'list-check',
  leaf: 'tree',
  document: 'file-text',
  farm: 'building-warehouse',
};

export function RoleBottomNavigation({ role }: { role: 'owner' | 'worker' }) {
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

const ownerNavigationItems: NavigationItem[] = [
  {
    href: '/owner',
    icon: 'home',
    label: 'Beranda',
    match: ['/owner'],
  },
  {
    href: '/owner/schedules',
    icon: 'checklist',
    label: 'Tugas',
    match: ['/owner/schedules', '/owner/tasks'],
  },
  {
    href: '/owner/trees',
    icon: 'leaf',
    label: 'Pohon',
    match: ['/owner/trees'],
  },
  {
    href: '/owner/reports',
    icon: 'document',
    label: 'Laporan',
    match: ['/owner/reports'],
  },
  {
    href: '/owner/farm',
    icon: 'farm',
    label: 'Kebun',
    match: ['/owner/farm', '/owner/profile', '/owner/farm-profile', '/owner/workers', '/owner/sops'],
  },
];

function isActivePath(pathname: string, match: string): boolean {
  if (match === '/owner' || match === '/worker') {
    return pathname === match;
  }

  return pathname === match || pathname.startsWith(`${match}/`);
}

const workerNavigationItems: NavigationItem[] = [
  {
    href: '/worker',
    icon: 'home',
    label: 'Beranda',
    match: ['/worker'],
  },
  {
    href: '/worker/tasks',
    icon: 'checklist',
    label: 'Tugas',
    match: ['/worker/tasks'],
  },
  {
    href: '/worker/trees',
    icon: 'leaf',
    label: 'Pohon',
    match: ['/worker/trees'],
  },
  {
    href: '/worker/reports',
    icon: 'document',
    label: 'Laporan',
    match: ['/worker/reports'],
  },
  {
    href: '/worker/farm',
    icon: 'farm',
    label: 'Kebun',
    match: ['/worker/farm', '/worker/profile'],
  },
];

function shouldShowBottomNavigation(pathname: string, role: 'owner' | 'worker'): boolean {
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
  '/owner/farm-profile',
  '/owner/workers',
  '/owner/sops',
];

const workerTopLevelPaths = [
  '/worker',
  '/worker/tasks',
  '/worker/trees',
  '/worker/reports',
  '/worker/farm',
  '/worker/profile',
];
