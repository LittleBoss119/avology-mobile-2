import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { tokens } from '../constants/theme';
import { setPendingFeedback } from '../lib/pendingFeedback';
import {
  INVALID_CURRENT_PASSWORD_CODE,
  PASSWORD_VERIFY_RATE_LIMITED_CODE,
  updatePassword,
} from '../services/authService';
import { Button, ErrorBanner, PasswordField, Screen, TopAppBar } from './ui';

type PasswordFieldErrors = {
  confirmPassword?: string;
  currentPassword?: string;
  newPassword?: string;
};

// ENAM, bukan delapan. Spek §38 menulis 8; yang menegakkan aturannya adalah
// Supabase Auth, dan di proyek ini ambangnya 6. Angka yang sama dipakai layar
// Daftar Akun (app/(auth)/register.tsx), dan keduanya harus tetap sama: kalau
// layar ini meminta 8 sementara pendaftaran menerima 6, setiap orang yang
// mendaftar dengan password 6 huruf akan diberi tahu bahwa passwordnya sendiri
// tidak memenuhi syarat begitu ia mencoba menggantinya.
//
// Koreksi ini ditetapkan di batch 2. Jangan menulis 8 di mana pun selama backend
// masih menerima 6.
const MIN_PASSWORD_LENGTH = 6;

export function AccountPasswordScreen() {
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [serverErrors, setServerErrors] = React.useState<PasswordFieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  const localErrors = computeFieldErrors(currentPassword, newPassword, confirmPassword);
  // TOMBOL NONAKTIF SAMPAI VALID (§38), dan konsekuensinya diurus di baris
  // berikutnya. Tombol mati yang tidak mengatakan apa-apa adalah jalan buntu:
  // orang menekannya, tidak terjadi apa pun, dan tidak ada satu pun kalimat di
  // layar yang menerangkan kenapa. Karena itu keadaan mati DIPASANGKAN dengan
  // galat yang muncul SENDIRI — tanpa menunggu percobaan simpan yang memang
  // tidak akan pernah terjadi.
  const disabled = Object.keys(localErrors).length > 0;

  // Galat sebaris ditampilkan untuk kolom yang SUDAH DIISI, bukan untuk semua
  // kolom sekaligus. Bedanya nyata: tanpa syarat itu, formulir kosong yang baru
  // dibuka langsung memerahkan ketiga kolomnya dan menegur orang atas sesuatu
  // yang belum sempat ia kerjakan. Dengan syarat itu, yang ditegur hanya kolom
  // yang benar-benar salah isi — "Konfirmasi password baru tidak sama" muncul
  // tepat saat ulangannya meleset, dan itulah satu-satunya penjelasan yang
  // dibutuhkan untuk tombol yang masih mati.
  //
  // `submitted` DIPERTAHANKAN sebagai jalur kedua. Ia tidak lagi menyangkut
  // tombol — tombolnya mati sebelum sampai ke sana — tapi galat dari SERVER
  // masih datang lewat percobaan simpan, dan pola lama layar ini tetap berlaku
  // untuk itu.
  //
  // Galat server MENANG atas galat lokal, dan ia digabung per-kolom dengan `??`
  // alih-alih disebar dengan `...serverErrors`. Sebaran objek akan menimpa
  // dengan `undefined`: handleCurrentPasswordChange menyetel
  // { currentPassword: undefined } untuk membersihkan galat server, dan sebaran
  // itu ikut menghapus galat LOKAL kolom yang sama.
  const fieldErrors: PasswordFieldErrors = {
    confirmPassword:
      serverErrors.confirmPassword ??
      (submitted || confirmPassword ? localErrors.confirmPassword : undefined),
    currentPassword:
      serverErrors.currentPassword ??
      (submitted || currentPassword ? localErrors.currentPassword : undefined),
    newPassword:
      serverErrors.newPassword ?? (submitted || newPassword ? localErrors.newPassword : undefined),
  };

  function handleCurrentPasswordChange(value: string) {
    setCurrentPassword(value);
    setServerErrors((previous) => ({ ...previous, currentPassword: undefined }));
    setFormError(null);
  }

  async function handleSubmit() {
    setSubmitted(true);
    setServerErrors({});
    setFormError(null);

    if (disabled) {
      return;
    }

    setSaving(true);

    const result = await updatePassword({
      currentPassword,
      newPassword,
    });

    if (result.error) {
      setSaving(false);

      // Password lama salah dan rate limit sama-sama menempel di field "Password
      // saat ini" — keduanya soal input itu, bukan soal password baru.
      if (
        result.error.code === INVALID_CURRENT_PASSWORD_CODE ||
        result.error.code === PASSWORD_VERIFY_RATE_LIMITED_CODE
      ) {
        setServerErrors({ currentPassword: result.error.message });
        return;
      }

      setFormError(result.error.message);
      return;
    }

    setSaving(false);
    setPendingFeedback('password_updated');
    router.back();
  }

  return (
    <Screen
      header={
        // Judul "Ganti password", bukan "Edit password". Aturan bahasa proyek ini
        // memakai "Edit" untuk data yang ditampilkan lalu disunting; password
        // tidak pernah ditampilkan, ia ditukar. §36 dan §38 dua-duanya menulis
        // "Ganti password", dan itu yang berlaku — sama dengan label barisnya di
        // layar Profil.
        //
        // Pola yang sama persis dengan cabang TopAppBar di profile-screen.tsx:
        // mundur satu langkah sudah cukup, dan '/' hanya cadangan kalau layar ini
        // jadi entri pertama stack. Tanpa cadangan itu router.back() melempar
        // "GO_BACK was not handled" dan tombol kembalinya diam saja — layar ini
        // dipakai tiga rute pembungkus, jadi bentuk stack-nya tidak seragam.
        <TopAppBar
          title="Ganti password"
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      }
      stickyFooter={
        <Button
          title="Simpan password"
          disabled={disabled}
          loading={saving}
          onPress={handleSubmit}
        />
      }
    >
      <ErrorBanner message={formError} />

      {/* Kartu pembungkus dicabut, alasan yang sama dengan layar Edit profil:
          kotak yang berarti "di sini bisa diketik" adalah kotak kolomnya
          sendiri, dan kartu di sekelilingnya cuma menambah kotak kedua yang
          tidak menandai apa pun. Susunan dan jumlah kolomnya tidak berubah:
          password sekarang, password baru, ulangi.

          PasswordField BERSAMA dari ui.tsx, menggantikan salinan lokal yang
          sengaja ditinggalkan utuh di batch 1a supaya layar ini tidak ikut
          bergerak sebelum gilirannya. Gilirannya sekarang. Yang berubah terlihat
          di kolomnya: tombol pengungkap berbunyi "Lihat"/"Tutup" alih-alih ikon
          mata, dan target sentuhnya 48 — dua perbaikan yang sudah dipakai
          seluruh layar auth dan tidak ada alasan untuk berhenti di pintu ini. */}
      <View style={{ gap: tokens.space.xl }}>
        <PasswordField
          autoComplete="current-password"
          error={fieldErrors.currentPassword}
          label="Password sekarang"
          placeholder="Password yang dipakai sekarang"
          textContentType="password"
          value={currentPassword}
          onChangeText={handleCurrentPasswordChange}
        />
        <PasswordField
          autoComplete="new-password"
          error={fieldErrors.newPassword}
          helperText={`Minimal ${MIN_PASSWORD_LENGTH} karakter.`}
          label="Password baru"
          placeholder="Password baru"
          textContentType="newPassword"
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <PasswordField
          autoComplete="new-password"
          error={fieldErrors.confirmPassword}
          label="Ulangi password baru"
          placeholder="Ulangi password baru"
          textContentType="newPassword"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
      </View>
    </Screen>
  );
}

function computeFieldErrors(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): PasswordFieldErrors {
  const errors: PasswordFieldErrors = {};

  if (!currentPassword) {
    errors.currentPassword = 'Password saat ini wajib diisi.';
  }

  if (!newPassword) {
    errors.newPassword = 'Password baru wajib diisi.';
  } else if (newPassword.length < MIN_PASSWORD_LENGTH) {
    errors.newPassword = `Password minimal ${MIN_PASSWORD_LENGTH} karakter.`;
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Konfirmasi password baru wajib diisi.';
  } else if (newPassword !== confirmPassword) {
    errors.confirmPassword = 'Konfirmasi password baru tidak sama.';
  }

  return errors;
}
