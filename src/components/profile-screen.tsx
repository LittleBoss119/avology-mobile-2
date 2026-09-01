import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { MEMBER_ROLE_LABELS, MEMBER_STATUS_LABELS } from '../constants/membership';
import { tokens } from '../constants/theme';
import { useAuth } from '../context/auth-context';
import { consumePendingFeedback } from '../lib/pendingFeedback';
import type { CurrentUserFarm } from '../types/domain';
import { formatPersonDisplayName, sanitizeDisplayValue } from '../utils/displayFormat';
import { isOwnerActive, isWorkerActive } from '../utils/routeGuard';
import { ConfirmDialog } from './bottom-sheet';
import { Avatar } from './member-row';
import { useSnackbar } from './snackbar';
import { Button, EmptyState, ErrorBanner, Screen, TopAppBar } from './ui';

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
      // Konfirmasi setelah simpan dari layar Edit profil / Ubah password:
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
  const farmName = sanitizeDisplayValue(currentFarm?.farm?.name);
  // Anggota kebun AKTIF membuka layar ini sebagai tujuan bottom nav; selain itu
  // (belum punya kebun, pending, ditolak, dinonaktifkan) layar ini dibuka lewat
  // push dari layar pilih akses atau layar pemberitahuan. Pembedaan itu dipakai
  // untuk memilih bentuk header.
  const isFarmMember = isOwnerActive(currentFarm) || isWorkerActive(currentFarm);

  return (
    <Screen
      // Dipasangkan dengan `header` di bawah, dan HARUS ikut bercabang bersamanya.
      // Cabang anggota kebun tidak punya header sama sekali, jadi tidak ada lagi
      // yang menerapkan safe-area atas dan Screen yang harus melakukannya. Cabang
      // onboarding masih punya TopAppBar, yang menerapkan insetnya SENDIRI —
      // menyalakan prop ini di sana berarti inset dihitung dua kali.
      applyTopInset={isFarmMember}
      header={
        // SATU bentuk header yang tersisa, dan ia hanya untuk jalur onboarding.
        //
        // Cabang anggota kebun aktif dulu memakai MainTabHeader; judulnya dibuang
        // bersama judul tiga tab root lain, karena tab bar di bawah sudah menamai
        // layar ini dan menyalakannya. Tidak ada tempat untuk "mundur" dari sebuah
        // tab, jadi tidak ada yang hilang selain judulnya.
        //
        // Di konteks onboarding layar ini dibuka lewat push dari layar pilih akses
        // atau layar pemberitahuan — bukan tab root — jadi headernya TETAP. Tanpa
        // chevron itu, user yang membukanya dari layar pilih akses terkurung sampai
        // menutup aplikasi. Mundur satu langkah sudah cukup; '/' hanya cadangan
        // kalau layar ini jadi entri pertama.
        isFarmMember ? null : (
          <TopAppBar
            title="Profil"
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
          {/* Blok identitas: lingkaran inisial, nama, email. TANPA kartu.
              Jarak sudah memisahkannya dari baris data di bawah, dan menurut
              urutan pemisah — jarak, lalu garis, lalu kotak — kotak di sini
              adalah tingkat ketiga untuk pekerjaan yang sudah selesai di
              tingkat pertama.

              Email pindah ke sini dari baris "Email login". Ia penanda AKUN,
              bukan data yang berdiri sejajar dengan nomor HP: ia yang dipakai
              masuk, dan ia tidak bisa diubah. Tempatnya di bawah nama. */}
          <View style={{ alignItems: 'center', gap: tokens.space.sm }}>
            <Avatar name={profile.fullName} size="lg" tone="accent" />
            {/* KONDISIONAL, bukan tanpa syarat. Di cabang anggota kebun judul
                layar sudah dibuang, jadi baris ini satu-satunya calon heading
                yang tersisa dan ia memang judul isi layar. Di cabang onboarding
                TopAppBar masih merender judul "Profil" dan sudah membawa peran
                heading sendiri — peran kedua di sini akan membuat layar itu
                punya dua heading. */}
            <Text
              accessibilityRole={isFarmMember ? 'header' : undefined}
              selectable
              style={{
                color: tokens.color.text.primary,
                fontSize: tokens.type.heading.fontSize,
                fontWeight: tokens.type.heading.fontWeight,
                lineHeight: tokens.type.heading.lineHeight,
                textAlign: 'center',
              }}
            >
              {displayName}
            </Text>
            {profile.email ? (
              <Text
                selectable
                style={{
                  color: tokens.color.text.secondary,
                  fontSize: tokens.type.bodySmall.fontSize,
                  lineHeight: tokens.type.bodySmall.lineHeight,
                  textAlign: 'center',
                }}
              >
                {profile.email}
              </Text>
            ) : null}
          </View>

          {/* Baris label-nilai, dipisah garis rambut, tanpa kartu. Label kiri,
              nilai kanan — bentuk yang terbaca sebagai daftar keterangan, bukan
              sebagai daftar yang bisa ditekan. Tidak satu pun baris di sini
              membuka apa pun, dan itu memang disengaja: aksinya semua sudah
              berkumpul sebagai tombol di bawah. */}
          <View>
            <AccountRow label="Nomor HP" value={profile.phone} />

            {/* Baris kebun tidak lagi dikunci pada keanggotaan AKTIF. Dulu
                syaratnya isFarmMember, sehingga orang yang pengajuannya sedang
                ditinjau — justru orang yang paling ingin tahu kebun mana yang
                sedang meninjaunya — tidak melihat namanya sama sekali. Nama
                kebun tersedia untuk semua status lewat kolom farm_name di
                get_current_user_access, jadi syaratnya cukup: ada namanya. */}
            {farmName ? <AccountRow label="Kebun" value={farmName} /> : null}

            {/* Peran hanya bermakna saat keanggotaannya aktif. Selama menunggu,
                ditolak, atau dinonaktifkan, yang perlu dibaca adalah STATUS-nya
                — menyebut orang "Pekerja" padahal pengajuannya belum disetujui
                adalah janji yang belum tentu ditepati. */}
            {currentFarm ? (
              isFarmMember ? (
                <AccountRow label="Peran" value={MEMBER_ROLE_LABELS[currentFarm.role]} />
              ) : (
                <AccountRow label="Status" value={MEMBER_STATUS_LABELS[currentFarm.status]} />
              )
            ) : null}
          </View>

          {/* Ruang kosong fleksibel: mendorong ketiga tombol ke dasar layar saat
              isinya pendek, tapi tetap boleh menyusut jadi nol saat font sistem
              dibesarkan sehingga tombolnya tidak pernah terdorong keluar dari
              area yang bisa digulung. */}
          <View style={{ flexGrow: 1 }} />

          {/* Tombol, bukan baris berchevron. Chevron adalah penanda yang harus
              dipelajari dulu; border dan label lebar penuh tidak. Keduanya
              berbobot SETARA — tidak ada alasan mendorong pengguna ke salah
              satu.

              Jarak antar keduanya space.sm (8), lebih rapat daripada jarak ke
              "Keluar akun" di bawah yang datang dari sectionGap Screen (18).
              Kerapatan itu yang mengelompokkan keduanya sebagai satu pasangan
              "ubah data akun", dan yang memisahkan keduanya dari aksi yang
              mengakhiri sesi. */}
          <View style={{ gap: tokens.space.sm }}>
            <Button
              title="Edit profil"
              variant="secondary"
              emphasis="strong"
              onPress={() => router.push(profileEditRoute)}
            />
            <Button
              title="Ubah password"
              variant="secondary"
              emphasis="strong"
              onPress={() => router.push(passwordRoute)}
            />
          </View>

          <Button title="Keluar akun" variant="danger" onPress={() => setConfirmLogout(true)} />
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

// Baris data akun: label kiri, nilai kanan, dipisah garis rambut di atasnya.
// Garisnya milik BARIS, bukan container, supaya baris yang tidak dirender tidak
// meninggalkan garis menggantung — jumlah baris di layar ini berubah menurut
// keadaan keanggotaan.
//
// Nilai kosong tetap tampil "Belum diisi" dengan warna muted, bukan "-",
// supaya terbaca sebagai ajakan mengisi. Perilaku ini tidak berubah dari bentuk
// sebelumnya.
function AccountRow({ label, value }: { label: string; value?: string | null }) {
  const safeValue = sanitizeDisplayValue(value);

  return (
    <View
      style={{
        alignItems: 'center',
        borderTopColor: tokens.color.line.hairline,
        borderTopWidth: 1,
        flexDirection: 'row',
        gap: tokens.space.md,
        justifyContent: 'space-between',
        paddingVertical: tokens.space.lg,
      }}
    >
      <Text
        selectable
        style={{
          color: tokens.color.text.secondary,
          fontSize: tokens.type.body.fontSize,
          lineHeight: tokens.type.body.lineHeight,
        }}
      >
        {label}
      </Text>
      <Text
        selectable
        style={{
          color: safeValue ? tokens.color.text.primary : tokens.color.text.tertiary,
          flexShrink: 1,
          fontSize: tokens.type.bodyStrong.fontSize,
          fontWeight: tokens.type.bodyStrong.fontWeight,
          lineHeight: tokens.type.bodyStrong.lineHeight,
          textAlign: 'right',
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
