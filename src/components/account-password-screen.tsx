import { router } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';

import { tokens } from '../constants/theme';
import { setPendingFeedback } from '../lib/pendingFeedback';
import {
  INVALID_CURRENT_PASSWORD_CODE,
  PASSWORD_VERIFY_RATE_LIMITED_CODE,
  updatePassword,
} from '../services/authService';
import { Icon } from './icons';
import { Button, ErrorBanner, Field, Screen, TopAppBar } from './ui';

type PasswordFieldErrors = {
  confirmPassword?: string;
  currentPassword?: string;
  newPassword?: string;
};

const MIN_PASSWORD_LENGTH = 6;

export function AccountPasswordScreen() {
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [serverErrors, setServerErrors] = React.useState<PasswordFieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  // Pola submitted + computeFieldErrors mengikuti owner/farm-profile.tsx: error
  // baru muncul setelah percobaan simpan pertama, lalu hilang sendiri begitu
  // field-nya dibetulkan. Error dari server ditumpuk di atasnya dan dibersihkan
  // saat field yang bersangkutan diketik ulang.
  const fieldErrors = submitted
    ? { ...computeFieldErrors(currentPassword, newPassword, confirmPassword), ...serverErrors }
    : serverErrors;

  function handleCurrentPasswordChange(value: string) {
    setCurrentPassword(value);
    setServerErrors((previous) => ({ ...previous, currentPassword: undefined }));
    setFormError(null);
  }

  async function handleSubmit() {
    setSubmitted(true);
    setServerErrors({});
    setFormError(null);

    const errors = computeFieldErrors(currentPassword, newPassword, confirmPassword);

    if (Object.keys(errors).length > 0) {
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
        // Pola yang sama persis dengan cabang TopAppBar di profile-screen.tsx:
        // mundur satu langkah sudah cukup, dan '/' hanya cadangan kalau layar ini
        // jadi entri pertama stack. Tanpa cadangan itu router.back() melempar
        // "GO_BACK was not handled" dan tombol kembalinya diam saja — layar ini
        // dipakai tiga rute pembungkus, jadi bentuk stack-nya tidak seragam.
        <TopAppBar
          title="Ubah password"
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      }
      stickyFooter={<Button title="Simpan password" loading={saving} onPress={handleSubmit} />}
    >
      <ErrorBanner message={formError} />

      {/* Kartu pembungkus dicabut, alasan yang sama dengan layar Edit profil:
          kotak yang berarti "di sini bisa diketik" adalah kotak kolomnya
          sendiri, dan kartu di sekelilingnya cuma menambah kotak kedua yang
          tidak menandai apa pun. Susunan dan jumlah kolomnya tidak berubah. */}
      <View style={{ gap: tokens.space.xl }}>
        <PasswordField
          error={fieldErrors.currentPassword}
          label="Password saat ini"
          placeholder="Password yang dipakai sekarang"
          value={currentPassword}
          onChangeText={handleCurrentPasswordChange}
        />
        <PasswordField
          error={fieldErrors.newPassword}
          helperText={`Minimal ${MIN_PASSWORD_LENGTH} karakter.`}
          label="Password baru"
          placeholder="Password baru"
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <PasswordField
          error={fieldErrors.confirmPassword}
          label="Ulangi password baru"
          placeholder="Ulangi password baru"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
      </View>
    </Screen>
  );
}

// Tiap field memegang state show/hide-nya sendiri — membuka satu field tidak
// ikut membuka dua lainnya.
function PasswordField({
  error,
  helperText,
  label,
  onChangeText,
  placeholder,
  value,
}: {
  error?: string;
  helperText?: string;
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const [visible, setVisible] = React.useState(false);

  return (
    <Field
      error={error}
      helperText={helperText}
      label={label}
      placeholder={placeholder}
      secureTextEntry={!visible}
      value={value}
      onChangeText={onChangeText}
      trailing={
        <Pressable
          accessibilityLabel={
            visible ? `Sembunyikan ${label.toLowerCase()}` : `Tampilkan ${label.toLowerCase()}`
          }
          accessibilityRole="button"
          accessibilityState={{ selected: visible }}
          onPress={() => setVisible((previous) => !previous)}
          // Meregang mengisi slot 44x44 milik Field, bukan sekadar seukuran ikon
          // dan bukan hitSlop — hitSlop akan meluber ke TextInput di sebelahnya.
          style={({ pressed }) => ({
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: tokens.layout.tapTarget,
            minWidth: tokens.layout.tapTarget,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Icon
            name={visible ? 'eye-off' : 'eye'}
            size={tokens.icon.md}
            color={tokens.color.text.tertiary}
          />
        </Pressable>
      }
    />
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
