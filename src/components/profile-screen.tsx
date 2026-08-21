import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { tokens } from '../constants/theme';
import { useAuth } from '../context/auth-context';
import { consumePendingFeedback } from '../lib/pendingFeedback';
import type { CurrentUserFarm } from '../types/domain';
import { formatPersonDisplayName, sanitizeDisplayValue } from '../utils/displayFormat';
import { isOwnerActive, isWorkerActive } from '../utils/routeGuard';
import { ConfirmDialog } from './bottom-sheet';
import { useSnackbar } from './snackbar';
import {
  Card,
  EmptyState,
  ErrorBanner,
  MainTabHeader,
  MenuRow,
  MenuRowGroup,
  Screen,
  TopAppBar,
} from './ui';

const PENDING_FEEDBACK_MESSAGES: Record<string, string | undefined> = {
  password_updated: 'Password diperbarui',
  profile_updated: 'Profil akun diperbarui',
};

export function ProfileScreen() {
  const { currentFarm, error, profile, signOut } = useAuth();
  const showSnackbar = useSnackbar();
  const [confirmLogout, setConfirmLogout] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      // Konfirmasi setelah simpan dari layar Edit Profil / Ubah Password:
      // baca-sekaligus-hapus penanda, lalu tampilkan snackbar global sekali.
      // Kembali tanpa menyimpan tidak meninggalkan penanda, jadi tidak ada
      // snackbar yang muncul.
      const message = PENDING_FEEDBACK_MESSAGES[consumePendingFeedback() ?? ''];

      if (message) {
        showSnackbar(message);
      }
    }, [showSnackbar])
  );

  async function handleLogout() {
    setLoggingOut(true);
    setFormError(null);

    const result = await signOut();

    if (result) {
      setFormError(result.message);
      setLoggingOut(false);
      setConfirmLogout(false);
      return;
    }

    setLoggingOut(false);
    setConfirmLogout(false);
    router.replace('/get-started');
  }

  const passwordRoute = getPasswordRoute(currentFarm);
  const profileEditRoute = getProfileEditRoute(currentFarm);
  const displayName = formatPersonDisplayName(profile?.fullName, 'Pengguna Avology');
  const farmName = currentFarm?.farm?.name ?? null;
  // Anggota kebun AKTIF membuka layar ini sebagai tujuan bottom nav; selain itu
  // (belum punya kebun, pending, ditolak, dinonaktifkan) layar ini dibuka lewat
  // push dari layar pilih akses atau layar pemberitahuan. Pembedaan itu dipakai
  // dua kali di bawah: untuk tombol back, dan untuk baris nama kebun.
  const isFarmMember = isOwnerActive(currentFarm) || isWorkerActive(currentFarm);
  // Nama kebun hanya bermakna untuk anggota kebun aktif. Di konteks onboarding
  // ia tidak dirender sama sekali — bukan baris kosong, bukan placeholder,
  // bukan "-".
  const showMembershipMeta = isFarmMember && Boolean(farmName);
  // expoConfig bisa null di runtime tertentu (mis. konteks tanpa manifest). Baris
  // versi disembunyikan seluruhnya dalam kasus itu — lebih baik tidak ada daripada
  // memajang penanda kosong yang tidak berarti apa-apa bagi pengguna.
  const appVersion = Constants.expoConfig?.version ?? null;

  return (
    <Screen
      header={
        // DUA bentuk header, dipisah oleh isFarmMember — bukan satu TopAppBar
        // yang di-tweak.
        //
        // Anggota kebun aktif membuka layar ini sebagai tujuan bottom nav, jadi
        // ia memakai MainTabHeader yang sama persis dengan Beranda, Pohon, dan
        // Perawatan: judul rata kiri, tanpa tombol kembali. Tidak ada tempat
        // untuk "mundur" dari sebuah tab, dan judul yang rata tengah membuat
        // satu dari empat destinasi terlihat seperti layar turunan.
        //
        // Di konteks onboarding layar ini tetap dibuka lewat push, jadi
        // bentuknya tetap layar turunan: judul rata tengah dengan chevron.
        // Tanpa chevron itu, user yang membukanya dari layar pilih akses
        // terkurung sampai menutup aplikasi. Mundur satu langkah sudah cukup;
        // '/' hanya cadangan kalau layar ini jadi entri pertama.
        isFarmMember ? (
          <MainTabHeader title="Profil Akun" />
        ) : (
          <TopAppBar
            title="Profil Akun"
            onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        )
      }
    >
      <ErrorBanner message={formError ?? error?.message} />

      {!profile ? (
        <EmptyState title="Profil tidak tersedia" subtitle="Masuk ulang jika data akun belum muncul." />
      ) : (
        <>
          <View style={{ gap: tokens.space.sm }}>
            <Text
              selectable
              style={{
                color: tokens.color.text.primary,
                fontSize: tokens.type.title.fontSize,
                fontWeight: tokens.type.title.fontWeight,
                lineHeight: tokens.type.title.lineHeight,
              }}
            >
              {displayName}
            </Text>
            {showMembershipMeta ? (
              <View
                style={{
                  alignItems: 'center',
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: tokens.space.sm,
                }}
              >
                {/* Badge peran dicabut, sejalan dengan pencabutannya di
                    MainTabHeader: peran tidak berubah sepanjang sesi dan tidak
                    pernah jadi bahan keputusan di layar ini. Nama kebun tetap —
                    itu yang membedakan satu akun dari akun lain. */}
                <Text
                  selectable
                  numberOfLines={1}
                  style={{
                    color: tokens.color.text.secondary,
                    flexShrink: 1,
                    fontSize: tokens.type.bodySmall.fontSize,
                    lineHeight: tokens.type.bodySmall.lineHeight,
                  }}
                >
                  {farmName}
                </Text>
              </View>
            ) : null}
          </View>

          <Card>
            <AccountRow label="Nama lengkap" value={profile.fullName} />
            <AccountRow label="Nomor HP" value={profile.phone} />
            <AccountRow label="Email login" value={profile.email} />
          </Card>

          <Card>
            <MenuRowGroup>
              <MenuRow
                icon="user-edit"
                label="Edit profil"
                onPress={() => router.push(profileEditRoute)}
              />
              <MenuRow icon="lock" label="Ubah password" onPress={() => router.push(passwordRoute)} />
            </MenuRowGroup>
          </Card>

          <Card>
            <MenuRow danger icon="logout" label="Keluar akun" onPress={() => setConfirmLogout(true)} />
          </Card>

          {appVersion ? (
            <Text
              selectable={false}
              style={{
                color: tokens.color.text.tertiary,
                fontSize: tokens.type.meta.fontSize,
                lineHeight: tokens.type.meta.lineHeight,
                textAlign: 'center',
              }}
            >
              Versi {appVersion}
            </Text>
          ) : null}
        </>
      )}

      <ConfirmDialog
        cancelLabel="Batal"
        confirmLabel="Keluar"
        loading={loggingOut}
        message="Kamu perlu masuk lagi untuk membuka Avology."
        onCancel={() => {
          if (!loggingOut) {
            setConfirmLogout(false);
          }
        }}
        onConfirm={() => void handleLogout()}
        title="Keluar akun?"
        tone="danger"
        visible={confirmLogout}
      />
    </Screen>
  );
}

// Baris data akun: label kecil di atas nilai. Nilai kosong tampil "Belum diisi"
// dengan warna muted, bukan "-", supaya terbaca sebagai ajakan mengisi.
function AccountRow({ label, value }: { label: string; value?: string | null }) {
  const safeValue = sanitizeDisplayValue(value);

  return (
    <View style={{ gap: tokens.space.xs }}>
      <Text
        selectable
        style={{
          color: tokens.color.text.tertiary,
          fontSize: tokens.type.meta.fontSize,
          lineHeight: tokens.type.meta.lineHeight,
        }}
      >
        {label}
      </Text>
      <Text
        selectable
        style={{
          color: safeValue ? tokens.color.text.primary : tokens.color.text.tertiary,
          fontSize: tokens.type.bodyStrong.fontSize,
          fontWeight: tokens.type.bodyStrong.fontWeight,
          lineHeight: tokens.type.bodyStrong.lineHeight,
        }}
      >
        {safeValue ?? 'Belum diisi'}
      </Text>
    </View>
  );
}

function getPasswordRoute(currentFarm: CurrentUserFarm | null): '/owner/profile-password' | '/password' | '/worker/profile-password' {
  if (isOwnerActive(currentFarm)) {
    return '/owner/profile-password';
  }

  if (isWorkerActive(currentFarm)) {
    return '/worker/profile-password';
  }

  return '/password';
}

function getProfileEditRoute(
  currentFarm: CurrentUserFarm | null
): '/owner/profile-edit' | '/profile-edit' | '/worker/profile-edit' {
  if (isOwnerActive(currentFarm)) {
    return '/owner/profile-edit';
  }

  if (isWorkerActive(currentFarm)) {
    return '/worker/profile-edit';
  }

  return '/profile-edit';
}
