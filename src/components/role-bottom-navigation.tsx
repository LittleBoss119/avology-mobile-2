import { router, usePathname } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

type NavigationItem = {
  label: string;
  href: string;
  match: string[];
};

export function RoleBottomNavigation({ role }: { role: 'owner' | 'worker' }) {
  const pathname = usePathname();
  const items = role === 'owner' ? ownerNavigationItems : workerNavigationItems;

  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderColor: '#DDE4DA',
        borderTopWidth: 1,
        flexDirection: 'row',
        gap: 4,
        paddingHorizontal: 8,
        paddingTop: 8,
        paddingBottom: 10,
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
              backgroundColor: isActive ? '#E7F6EC' : pressed ? '#F6F7F2' : '#FFFFFF',
              borderRadius: 8,
              flex: 1,
              minHeight: 44,
              justifyContent: 'center',
              paddingHorizontal: 6,
            })}
          >
            <Text
              selectable
              style={{
                color: isActive ? '#2F6F4E' : '#68746D',
                fontSize: 12,
                fontWeight: isActive ? '800' : '700',
                textAlign: 'center',
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const ownerNavigationItems: NavigationItem[] = [
  {
    href: '/owner',
    label: 'Beranda',
    match: ['/owner'],
  },
  {
    href: '/owner/trees',
    label: 'Pohon',
    match: ['/owner/trees'],
  },
  {
    href: '/owner/schedules',
    label: 'Jadwal',
    match: ['/owner/schedules', '/owner/tasks'],
  },
  {
    href: '/owner/reports',
    label: 'Laporan',
    match: ['/owner/reports'],
  },
  {
    href: '/owner/profile',
    label: 'Akun',
    match: ['/owner/profile'],
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
    label: 'Beranda',
    match: ['/worker'],
  },
  {
    href: '/worker/tasks',
    label: 'Tugas',
    match: ['/worker/tasks'],
  },
  {
    href: '/worker/trees',
    label: 'Pohon',
    match: ['/worker/trees'],
  },
  {
    href: '/worker/reports',
    label: 'Laporan',
    match: ['/worker/reports'],
  },
  {
    href: '/worker/profile',
    label: 'Akun',
    match: ['/worker/profile'],
  },
];
