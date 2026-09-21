import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { MEMBER_ROLE_LABELS, MEMBER_STATUS_LABELS } from '../constants/membership';
import { tokens } from '../constants/theme';
import { useAuth } from '../context/auth-context';
import { consumePendingFeedback } from '../lib/pendingFeedback';
import type { CurrentUserFarm } from '../types/domain';
import { formatPersonDisplayName, sanitizeDisplayValue } from '../utils/displayFormat';
import { getPendingWorkers } from '../services/memberService';
import { isOwnerActive, isWorkerActive } from '../utils/routeGuard';
import { ConfirmDialog } from './bottom-sheet';
import { Avatar } from './member-row';
import { useSnackbar } from './snackbar';
import {
  Button,
  EmptyState,
  ErrorBanner,
  MenuRow,
  MenuRowGroup,
  Screen,
  SectionLabel,
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
  // Jumlah pengajuan yang menunggu, HANYA untuk label sampingan baris Anggota
  // milik pemilik. 0 berarti "tidak ada ATAU belum/gagal terbaca" — ketiganya
  // menghasilkan hal yang sama di layar, yaitu labelnya tidak dirender.
  const [pendingCount, setPendingCount] = React.useState(0);

  const ownerFarmId = isOwnerActive(currentFarm) ? currentFarm?.farmId : undefined;

  // getPendingWorkers adalah RPC yang SUDAH ADA dan sudah dipakai layar
  // Anggota; tidak ada query, service, maupun agregat baru yang ditambahkan di
  // sini. Dipanggil hanya untuk pemilik aktif — pekerja tidak punya baris yang
  // memakainya, dan RPC-nya memang hanya melayani pemilik kebunnya.
  //
  // GAGAL DIAM-DIAM: tanpa ErrorBanner dan tanpa menyentuh formError. Yang
  // hilang saat gagal cuma label "N menunggu"; barisnya sendiri tetap berdiri
  // dan tetap mengantar ke layar yang menampilkan pengajuannya. Memunculkan
  // galat untuk itu berarti menakut-nakuti orang tentang hal yang tidak bisa ia
  // perbaiki.
  useFocusEffect(
    React.useCallback(() => {
      if (!ownerFarmId) {
        setPendingCount(0);
        return;
      }

      let active = true;

      void getPendingWorkers(ownerFarmId).then((result) => {
        if (active) {
          setPendingCount(result.error ? 0 : result.data.length);
        }
      });

      return () => {
        active = false;
      };
    }, [ownerFarmId])
  );

  useFocusEffect(
    React.useCallback(() => {
      // Konfirmasi setelah simpan dari layar Edit profil / Ganti password:
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
  // SATU baris untuk dua hal yang selalu dibaca bersama: siapa orang ini di
  // kebun, dan kebun mana.
  //
  // Peran hanya bermakna saat keanggotaannya aktif. Selama menunggu, ditolak,
  // atau dinonaktifkan, yang perlu dibaca adalah STATUS-nya — menyebut orang
  // "Pekerja" padahal pengajuannya belum disetujui adalah janji yang belum
  // tentu ditepati.
  //
  // Nama kebun ikut untuk SEMUA status, bukan hanya anggota aktif. Itu
  // perbaikan batch 3 yang DIPINDAH ke sini, bukan dicabut: orang yang
  // pengajuannya sedang ditinjau justru orang yang paling ingin tahu kebun mana
  // yang sedang meninjaunya.
  const membershipLine = [
    currentFarm
      ? isFarmMember
        ? MEMBER_ROLE_LABELS[currentFarm.role]
        : MEMBER_STATUS_LABELS[currentFarm.status]
      : undefined,
    farmName ?? undefined,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' · ');

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
          {/* Blok identitas: lingkaran inisial, nama, peran, email. TANPA kartu.
              Jarak sudah memisahkannya dari baris di bawah, dan menurut urutan
              pemisah — jarak, lalu garis, lalu kotak — kotak di sini adalah
              tingkat ketiga untuk pekerjaan yang sudah selesai di tingkat
              pertama.

              PERAN NAIK KE SINI dari daftar baris label-nilai, dan daftar itu
              ikut dicabut seluruhnya (batch 7a). Ketiga barisnya tidak bertahan
              dengan alasan masing-masing: "Nomor HP" adalah data yang diubah di
              Edit profil dan sudah terbaca di sana; "Kebun" dan "Peran" adalah
              keterangan tentang SIAPA yang sedang masuk, jadi tempatnya di bawah
              namanya. Sebagai daftar berbaris, ketiganya juga meniru bentuk
              baris yang bisa ditekan padahal tidak satu pun bisa.

              Email DIPERTAHANKAN di sini (batch 2). Ia penanda AKUN, bukan data
              yang berdiri sejajar dengan nomor HP: ia yang dipakai masuk, dan ia
              tidak bisa diubah. */}
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
            {membershipLine ? (
              <Text
                selectable
                style={{
                  color: tokens.color.text.secondary,
                  fontSize: tokens.type.body.fontSize,
                  lineHeight: tokens.type.body.lineHeight,
                  textAlign: 'center',
                }}
              >
                {membershipLine}
              </Text>
            ) : null}
            {profile.email ? (
              <Text
                selectable
                style={{
                  color: tokens.color.text.tertiary,
                  fontSize: tokens.type.meta.fontSize,
                  lineHeight: tokens.type.meta.lineHeight,
                  textAlign: 'center',
                }}
              >
                {profile.email}
              </Text>
            ) : null}
          </View>

          {/* DUA BARIS, bukan dua tombol berbingkai di kaki layar. Keduanya
              MENGANTAR ke layar lain, dan bentuk yang mengantar di aplikasi ini
              adalah baris berchevron — bentuk yang sama persis dengan baris
              seksi KEBUN tepat di bawahnya. Sebagai tombol di dasar layar
              keduanya dulu berdiri sebaris dengan "Keluar dari akun": dua aksi
              yang mengantar disandingkan dengan satu aksi yang mengakhiri sesi.

              TANPA label seksi di atasnya. Label "Akun" akan menamai hal yang
              sudah dinamai blok identitas tepat di atasnya; yang butuh nama
              hanyalah kelompok KEBUN, karena di sanalah isinya berpindah dari
              milik-saya ke milik-kebun. */}
          <MenuRowGroup>
            <MenuRow
              icon="user-edit"
              label="Edit profil"
              onPress={() => router.push(profileEditRoute)}
            />
            {/* "Ganti password", bukan "Edit password". Aturan bahasa proyek ini
                memakai "Edit" untuk data yang ditampilkan lalu disunting.
                Password tidak pernah ditampilkan: ia ditukar, bukan disunting. */}
            <MenuRow icon="lock" label="Ganti password" onPress={() => router.push(passwordRoute)} />
          </MenuRowGroup>

          {/* Seksi KEBUN. Ketiga barisnya PINDAH dari Beranda dan dari layar
              Anggota, bukan disalin: jalan lamanya dicabut di batch yang sama,
              jadi tidak ada satu pun dari ketiga layar itu yang kini punya dua
              pintu masuk.

              Kenapa pindah ke sini: ketiganya SETELAN kebun — dibuka sesekali,
              bukan ditengok tiap pagi — sementara Beranda adalah layar yang
              dilihat paling sering, dan ruang teratasnya milik hal yang berubah
              tiap hari.

              Isinya bercabang menurut PERAN, dan cabangnya soal rute, bukan
              soal tampilan: /owner/farm-profile dan /owner/workers hanya ada di
              sisi pemilik dan tidak punya padanan di sisi pekerja. Pekerja
              karena itu hanya punya baris Anggota.

              Seluruh seksi tidak dirender untuk orang yang keanggotaannya belum
              aktif (menunggu, ditolak, dinonaktifkan) — ketiga layarnya menuntut
              keanggotaan aktif, dan layar ini memang juga dibuka lewat jalur
              onboarding.

              UKURAN DENAH TIDAK PUNYA BARIS DI SINI, dan itu keputusan §36 yang
              ditegaskan batch 7a: satu pintu saja, lewat Data kebun. Ia setelan
              dari kebun yang sama, jadi menaruhnya sejajar dengan Data kebun
              akan membuat dua baris bersaing untuk satu benda. */}
          {isFarmMember ? (
            <View style={{ gap: tokens.space.sm }}>
              <SectionLabel title="Kebun" />
              <MenuRowGroup>
                {/* "Data kebun" PALING ATAS sejak batch 7a, mengikuti urutan
                    §36. Ia satu-satunya baris di seksi ini yang membuka KEBUNNYA
                    — nama, lokasi, kode, ukuran denah — sementara dua baris di
                    bawahnya membuka ORANG-ORANGNYA. Yang dinamai seksi ini
                    adalah kebunnya, jadi kebun yang duduk lebih dulu. */}
                {isOwnerActive(currentFarm) ? (
                  <MenuRow
                    icon="building-warehouse"
                    label="Data kebun"
                    onPress={() => router.push('/owner/farm-profile')}
                  />
                ) : null}
                <MenuRow
                  icon="user"
                  label="Anggota"
                  onPress={() =>
                    router.push(isOwnerActive(currentFarm) ? '/owner/farm' : '/worker/farm')
                  }
                  // "N menunggu", bukan jumlah anggota. Pengajuan menuntut
                  // keputusan pemilik; jumlah anggota tidak menuntut apa pun,
                  // dan angka yang tidak menuntut apa-apa di baris navigasi
                  // hanya melatih mata untuk mengabaikan tempat itu.
                  //
                  // `trailing`, bukan `meta`: ia keadaan yang berubah dari hari
                  // ke hari, bukan keterangan tetap tentang barisnya.
                  trailing={
                    pendingCount > 0 ? (
                      <Text
                        selectable={false}
                        style={{
                          color: tokens.color.status.warning.text,
                          fontSize: tokens.type.label.fontSize,
                          lineHeight: tokens.type.label.lineHeight,
                        }}
                      >
                        {`${pendingCount} menunggu`}
                      </Text>
                    ) : undefined
                  }
                />
                {isOwnerActive(currentFarm) ? (
                  <MenuRow
                    icon="clock"
                    label="Riwayat akses"
                    onPress={() => router.push('/owner/workers')}
                  />
                ) : null}
              </MenuRowGroup>
            </View>
          ) : null}

          {/* Ruang kosong fleksibel: mendorong tombolnya ke dasar layar saat
              isinya pendek, tapi tetap boleh menyusut jadi nol saat font sistem
              dibesarkan sehingga tombolnya tidak pernah terdorong keluar dari
              area yang bisa digulung. */}
          <View style={{ flexGrow: 1 }} />

          {/* 'neutral', bukan 'danger'. Keluar dari akun tidak menghapus apa
              pun: sesi berakhir, datanya utuh, dan orangnya bisa masuk lagi
              kapan saja. Merah disimpan untuk aksi yang benar-benar menutup
              sesuatu — termasuk "Keluar dari kebun", yang memang mengakhiri
              keanggotaan dan karena itu TETAP merah di tempat barunya.

              Labelnya "Keluar dari akun", bukan "Keluar": tanpa kata terakhir
              itu ia bisa dibaca sebagai "keluar dari layar ini".

              SATU-SATUNYA JALAN KELUAR DI LAYAR INI sejak "Keluar dari kebun"
              kembali ke kaki layar Anggota pekerja (pasca-batch 7, membatalkan
              keputusan batch 4a). Alasannya CAKUPAN: keluar dari akun urusan
              akun, keluar dari kebun urusan kebun. Berdampingan di sini,
              keduanya jadi dua tombol bergaris yang nyaris identik — dua jalan
              keluar yang sulit ditarik kembali, dibedakan satu kata. */}
          <Button
            title="Keluar dari akun"
            variant="neutral"
            onPress={() => setConfirmLogout(true)}
          />

        </>
      )}

      {/* Kata-katanya diseragamkan dengan lembar keluar di layar Pilih jalur,
          Menunggu, dan Ditolak — satu kalimat yang sama persis di keempatnya,
          supaya orang yang sudah pernah membacanya di satu tempat tidak perlu
          membacanya ulang di tempat lain.

          `tone="danger"` DIPERTAHANKAN meski tombol pemicunya kini netral:
          begitu lembarnya terbuka, tombol di dalamnya adalah konfirmasi
          terakhir, dan di situ penegasan memang berguna. */}
      <ConfirmDialog
        cancelLabel="Batal"
        confirmLabel="Keluar dari akun"
        loading={loggingOut}
        message="Kamu perlu masuk lagi untuk membuka aplikasi ini."
        onCancel={() => {
          if (!loggingOut) {
            setConfirmLogout(false);
          }
        }}
        onConfirm={() => void handleLogout()}
        title="Keluar dari akun?"
        tone="danger"
        visible={confirmLogout}
      />

    </Screen>
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
