import { router, usePathname } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

type NavigationItem = {
  icon: string;
  label: string;
  href: string;
  match: string[];
};

export function RoleBottomNavigation({ role }: { role: 'owner' | 'worker' }) {
  const pathname = usePathname();
  const items = role === 'owner' ? ownerNavigationItems : workerNavigationItems;

  if (!shouldShowBottomNavigation(pathname, role)) {
    return null;
  }

  return (
    <View style={{ backgroundColor: '#F7FAF3', paddingHorizontal: 12, paddingBottom: 10, paddingTop: 4 }}>
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderColor: '#DCE7D5',
          borderCurve: 'continuous',
          borderRadius: 22,
          borderWidth: 1,
          flexDirection: 'row',
          gap: 4,
          padding: 6,
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
                backgroundColor: isActive ? '#E7F3EA' : pressed ? '#F7FAF3' : '#FFFFFF',
                borderCurve: 'continuous',
                borderRadius: 17,
                flex: 1,
                gap: 3,
                minHeight: 56,
                justifyContent: 'center',
                paddingHorizontal: 4,
                paddingVertical: 6,
              })}
            >
              <View
                style={{
                  alignItems: 'center',
                  backgroundColor: isActive ? '#065F2E' : '#EEF4EA',
                  borderRadius: 999,
                  height: 24,
                  justifyContent: 'center',
                  width: 24,
                }}
              >
                <Text
                  selectable
                  style={{
                    color: isActive ? '#FFFFFF' : '#68746D',
                    fontSize: 11,
                    fontWeight: '900',
                    textAlign: 'center',
                  }}
                >
                  {item.icon}
                </Text>
              </View>
              <Text
                selectable
                numberOfLines={1}
                style={{
                  color: isActive ? '#065F2E' : '#68746D',
                  fontSize: 11,
                  fontWeight: isActive ? '900' : '700',
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
    icon: 'B',
    label: 'Beranda',
    match: ['/owner'],
  },
  {
    href: '/owner/trees',
    icon: 'P',
    label: 'Pohon',
    match: ['/owner/trees'],
  },
  {
    href: '/owner/schedules',
    icon: 'J',
    label: 'Jadwal',
    match: ['/owner/schedules', '/owner/tasks'],
  },
  {
    href: '/owner/reports',
    icon: 'L',
    label: 'Laporan',
    match: ['/owner/reports'],
  },
  {
    href: '/owner/profile',
    icon: 'A',
    label: 'Akun',
    match: ['/owner/profile', '/owner/farm-profile', '/owner/workers', '/owner/sops'],
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
    icon: 'B',
    label: 'Beranda',
    match: ['/worker'],
  },
  {
    href: '/worker/tasks',
    icon: 'T',
    label: 'Tugas',
    match: ['/worker/tasks'],
  },
  {
    href: '/worker/trees',
    icon: 'P',
    label: 'Pohon',
    match: ['/worker/trees'],
  },
  {
    href: '/worker/reports',
    icon: 'L',
    label: 'Laporan',
    match: ['/worker/reports'],
  },
  {
    href: '/worker/profile',
    icon: 'A',
    label: 'Akun',
    match: ['/worker/profile'],
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
  '/worker/profile',
];
