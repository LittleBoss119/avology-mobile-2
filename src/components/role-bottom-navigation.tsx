import { router, usePathname } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, tokens } from '../constants/theme';
import { useDoubleBackToExit } from '../hooks/useDoubleBackToExit';
import { colors as palette, fonts, radius as shapeRadius, touch } from '../theme/tokens';
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
// 'farm' tidak lagi dipakai sejak item Kebun dicabut dari bar, tapi sengaja
// DIBIARKAN: ia masih ikon yang benar untuk tujuan itu kalau suatu saat kembali
// ke bar, dan menghapusnya tidak menghemat apa pun.
//
// 'document' juga dibiarkan walau modul laporan sudah dibuang (migrasi 053) —
// ia ikon generik untuk dokumen, bukan milik laporan operasional.
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

  // "Tekan sekali lagi untuk keluar" di KEEMPAT layar root tab saja — tujuan
  // `href` bar ini, bukan seluruh ownerTopLevelPaths. Daftar itu juga memuat
  // /owner/tasks dan /owner/farm, dua layar yang DIDORONG ke tumpukan dan harus
  // kembali seperti biasa.
  //
  // Dipasang di sini, di bar yang dimuat bersama layout peran, dan dipanggil
  // SEBELUM return null di bawah: aturan hook melarang memanggilnya bersyarat,
  // dan keputusan "sedang di root tab atau tidak" dikirim lewat argumennya.
  useDoubleBackToExit(items.some((item) => item.href === pathname));

  if (!shouldShowBottomNavigation(pathname, role)) {
    return null;
  }

  return (
    // Bar tepi-ke-tepi, bukan kartu melayang. Kartu ber-radius 18 dengan margin
    // di ketiga sisinya membuat bar terbaca sebagai benda yang MENUMPANG di atas
    // layar; bar navigasi bukan benda yang menumpang, ia batas bawah aplikasi.
    // Yang memisahkannya dari isi sekarang satu garis atas 1px, sejalan dengan
    // bar aksi bawah di <Screen>.
    <View
      style={{
        // LATAR HALAMAN, bukan surfaceRaised (batch 3) — perubahan yang sama
        // dan dengan alasan yang sama seperti bar aksi di <Screen>.
        //
        // Yang memaksanya: tab Pohon punya bar aksi "Tambah pohon" DAN bar ini
        // sekaligus, bertumpuk di tepi bawah layar yang sama. Selama keduanya
        // memakai putih yang berbeda, batas bawah aplikasi terbaca sebagai dua
        // pita berlainan warna yang saling menempel — dan tak satu pun dari
        // keduanya menandai apa pun dengan perbedaan itu.
        //
        // Pil surfaceSunken di balik tab aktif TIDAK ikut berubah: ia kini
        // satu-satunya bidang di dalam bar, dan justru lebih terbaca di atas
        // surface daripada di atas surfaceRaised.
        backgroundColor: palette.surface,
        // borderStrong, sejalan dengan bar aksi: sejak latar bar sama dengan
        // latar halaman, garis ini satu-satunya yang menyatakan batasnya.
        borderTopColor: palette.borderStrong,
        borderTopWidth: 1,
        paddingBottom: Math.max(insets.bottom, spacing.sm),
        paddingHorizontal: spacing.sm,
        paddingTop: spacing.sm,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          gap: spacing.xs,
        }}
      >
        {items.map((item) => {
          const isActive = item.match.some((match) => isActivePath(pathname, match));

          return (
            <Pressable
              key={item.href}
              onPress={() => router.replace(item.href)}
              // PIL BERLATAR DI BALIK TAB AKTIF DIPERTAHANKAN, dan itu
              // disengaja meski spek tidak menyebutnya.
              //
              // Tanpa pil, satu-satunya pembeda aktif dan nonaktif tinggal
              // WARNA — persis yang dilarang aturan spek sendiri. Bagi mata yang
              // tidak membedakan jingga dari abu, keempat tab jadi identik dan
              // tidak ada lagi yang memberi tahu sedang berada di mana. Pil
              // adalah pembeda berbasis BIDANG, alasan yang sama persis dengan
              // penanda bentuk pada badge di batch 1a.
              //
              // Latarnya surfaceSunken, bukan brand.soft: bidang netral yang
              // menyatakan "di sini", bukan bidang berwarna yang menyatakan
              // "ada masalah".
              style={{
                alignItems: 'center',
                backgroundColor: isActive ? palette.surfaceSunken : 'transparent',
                borderCurve: 'continuous',
                borderRadius: shapeRadius.control,
                flex: 1,
                gap: 2,
                justifyContent: 'center',
                minHeight: touch.row,
                paddingHorizontal: spacing.xs,
                paddingVertical: 5,
              }}
            >
              <Icon
                name={NAV_ICON[item.icon]}
                size={tokens.icon.lg}
                color={isActive ? palette.accent : palette.tabInactive}
              />
              <Text
                selectable={false}
                numberOfLines={1}
                style={{
                  // accentText, BUKAN accent. Label 12px adalah bentuk huruf
                  // tipis, bukan bidang seperti ikon di atasnya — ia butuh
                  // varian yang digelapkan untuk lolos ambang kontras terhadap
                  // pil surfaceSunken di belakangnya.
                  color: isActive ? palette.accentText : palette.tabInactive,
                  // Berat dibawa keluarga huruf; fontWeight dicabut.
                  fontFamily: isActive ? fonts.sansSemiBold : fonts.sans,
                  fontSize: 12,
                  lineHeight: 16,
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

// Empat item. Kebun dicabut dari bar sejak putaran sebelumnya — layar yang
// dibuka sesekali, bukan tempat yang ditinggali sepanjang hari. Laporan dulu
// diperlakukan sama; modulnya dibuang seluruhnya di migrasi 053.
//
// KETIGA CABANG KEBUN PINDAH DARI 'Beranda' KE 'Profil' (batch 3), mengikuti
// pintu masuknya. '/owner/farm', '/owner/farm-profile', dan '/owner/workers'
// kini dicapai lewat seksi KEBUN di tab Profil, bukan lagi dari baris navigasi
// di Beranda. Kalau ketiganya dibiarkan di `match` Beranda, pemilik yang
// menekan Profil lalu "Data kebun" akan melihat sorotan melompat kembali ke
// Beranda — tab yang justru tidak pernah ia sentuh.
//
// `href` tidak ikut berubah: menekan Profil tetap membawa ke '/owner/profile',
// bukan ke tempat terakhir di cabangnya.
//
// '/owner/farm-profile' dan '/owner/workers' harus disebut sendiri-sendiri:
// keduanya cabang dari layar Kebun tapi bukan subpath '/owner/farm/', sehingga
// aturan startsWith di isActivePath() tidak menjangkaunya.
//
// '/owner/farm-grid' ikut pindah bersama ketiganya: ia cabang dari Data kebun
// (pengaturan ukuran denah). Ia tidak ada di ownerTopLevelPaths, jadi barnya
// memang tidak dirender di sana — entri ini menjaga agar aturannya tetap benar
// kalau kelak ia dimasukkan.
//
// Daftar path tempat bar DITAMPILKAN (ownerTopLevelPaths di bawah) dibiarkan
// utuh.
const ownerNavigationItems: NavigationItem[] = [
  {
    href: '/owner',
    icon: 'home',
    label: 'Beranda',
    match: ['/owner'],
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
    match: [
      '/owner/profile',
      '/owner/farm',
      '/owner/farm-grid',
      '/owner/farm-profile',
      '/owner/workers',
    ],
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
// Label item ketiga "Tugas", bukan "Perawatan" seperti padanannya di sisi
// pemilik. Itu DISENGAJA, dan ia MENGGANTIKAN aturan lama yang menyeragamkan
// kedua peran pada satu kata.
//
// Aturan lama itu masuk akal selama judul layar pekerja juga berbunyi
// "Perawatan"; begitu judulnya jadi "Tugas", label tab yang masih berbunyi
// "Perawatan" mengantar ke layar berjudul lain, dan tab yang tidak menyebut
// nama tempat yang ditujunya adalah kesalahan yang lebih besar daripada dua
// peran memakai dua kata.
//
// Yang membuat perbedaan kata ini aman: seorang pengguna hanya pernah memegang
// SATU peran dalam satu kebun, jadi tidak ada layar yang menampilkan kedua
// navigasi sekaligus dan tidak ada seorang pun yang melihat keduanya
// berdampingan. Masing-masing memakai kata yang dipakai perannya sendiri —
// pemilik menyusun perawatan, pekerja mengerjakan tugas.
const workerNavigationItems: NavigationItem[] = [
  {
    href: '/worker',
    icon: 'home',
    label: 'Beranda',
    match: ['/worker'],
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
    label: 'Tugas',
    match: ['/worker/tasks'],
  },
  {
    href: '/worker/profile',
    icon: 'user',
    label: 'Profil',
    // '/worker/farm' ikut pindah ke sini bersama baris "Anggota" yang dicabut
    // dari Beranda pekerja — alasannya sama persis dengan sisi pemilik.
    match: ['/worker/profile', '/worker/farm'],
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
  '/owner/farm',
  '/owner/profile',
];

const workerTopLevelPaths = [
  '/worker',
  '/worker/tasks',
  '/worker/trees',
  '/worker/farm',
  '/worker/profile',
];
