import { router, usePathname } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing, typography } from '../constants/theme';

type NavigationItem = {
  icon: NavigationIconName;
  label: string;
  href: string;
  match: string[];
};

type NavigationIconName = 'calendar' | 'document' | 'farm' | 'home' | 'leaf' | 'user' | 'checklist';

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
              style={({ pressed }) => ({
                alignItems: 'center',
                backgroundColor: isActive ? colors.primarySoft : pressed ? colors.surfaceMuted : colors.surface,
                borderCurve: 'continuous',
                borderRadius: radius.lg,
                flex: 1,
                gap: 4,
                justifyContent: 'center',
                minHeight: 52,
                paddingHorizontal: 4,
                paddingVertical: 5,
              })}
            >
              <View
                style={{
                  alignItems: 'center',
                  backgroundColor: isActive ? colors.primary : colors.surfaceMuted,
                  borderRadius: radius.round,
                  height: 25,
                  justifyContent: 'center',
                  width: 25,
                }}
              >
                <NavigationIcon active={isActive} name={item.icon} />
              </View>
              <Text
                selectable={false}
                numberOfLines={1}
                style={{
                  color: isActive ? colors.primary : colors.textMuted,
                  fontSize: typography.navLabel.fontSize,
                  fontWeight: isActive ? '900' : '700',
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

function NavigationIcon({ active, name }: { active: boolean; name: NavigationIconName }) {
  const color = active ? colors.surface : colors.textMuted;

  if (name === 'home') {
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            borderColor: color,
            borderLeftWidth: 2,
            borderTopWidth: 2,
            height: 10,
            transform: [{ rotate: '45deg' }],
            width: 10,
          }}
        />
        <View style={{ borderColor: color, borderWidth: 2, height: 8, marginTop: -3, width: 11 }} />
      </View>
    );
  }

  if (name === 'leaf') {
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            borderColor: color,
            borderRadius: 999,
            borderWidth: 2,
            height: 14,
            transform: [{ rotate: '-35deg' }],
            width: 9,
          }}
        />
        <View style={{ backgroundColor: color, height: 10, marginTop: -3, width: 2 }} />
      </View>
    );
  }

  if (name === 'calendar') {
    return (
      <View style={{ borderColor: color, borderRadius: 3, borderWidth: 2, height: 16, width: 15 }}>
        <View style={{ backgroundColor: color, height: 2, marginTop: 3 }} />
      </View>
    );
  }

  if (name === 'checklist') {
    return (
      <View style={{ gap: 3 }}>
        {[0, 1, 2].map((item) => (
          <View key={item} style={{ alignItems: 'center', flexDirection: 'row', gap: 2 }}>
            <View style={{ borderColor: color, borderRadius: 2, borderWidth: 1.5, height: 4, width: 4 }} />
            <View style={{ backgroundColor: color, borderRadius: 999, height: 2, width: 10 }} />
          </View>
        ))}
      </View>
    );
  }

  if (name === 'document') {
    return (
      <View style={{ borderColor: color, borderRadius: 3, borderWidth: 2, gap: 2, height: 16, padding: 3, width: 13 }}>
        <View style={{ backgroundColor: color, borderRadius: 999, height: 2, width: 6 }} />
        <View style={{ backgroundColor: color, borderRadius: 999, height: 2, width: 5 }} />
      </View>
    );
  }

  if (name === 'farm') {
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ borderColor: color, borderRadius: 3, borderWidth: 2, height: 13, width: 17 }} />
        <View
          style={{
            backgroundColor: color,
            height: 10,
            marginTop: -11,
            transform: [{ rotate: '-30deg' }],
            width: 2,
          }}
        />
        <View style={{ backgroundColor: color, height: 2, marginTop: 2, width: 12 }} />
      </View>
    );
  }

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ borderColor: color, borderRadius: 999, borderWidth: 2, height: 8, width: 8 }} />
      <View style={{ borderColor: color, borderRadius: 999, borderWidth: 2, height: 8, marginTop: -1, width: 14 }} />
    </View>
  );
}
