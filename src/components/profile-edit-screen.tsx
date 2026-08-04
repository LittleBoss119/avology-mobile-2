import { router } from 'expo-router';
import React from 'react';

import { useAuth } from '../context/auth-context';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import { setPendingFeedback } from '../lib/pendingFeedback';
import { updateCurrentProfile } from '../services/authService';
import { ConfirmDialog } from './bottom-sheet';
import { Button, Card, EmptyState, ErrorBanner, Field, Screen, TopAppBar } from './ui';

type ProfileFieldErrors = {
  fullName?: string;
  phone?: string;
};

const MIN_PHONE_DIGITS = 9;
const MAX_PHONE_DIGITS = 15;

export function ProfileEditScreen() {
  const { error, profile, refresh } = useAuth();
  const [fullName, setFullName] = React.useState(profile?.fullName ?? '');
  const [phone, setPhone] = React.useState(profile?.phone ?? '');
  const [baseline, setBaseline] = React.useState({
    fullName: profile?.fullName ?? '',
    phone: profile?.phone ?? '',
  });
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const hydratedRef = React.useRef(profile !== null);

  // Hidrasi SEKALI saja. Layout owner/worker memanggil refresh() tiap fokus, dan
  // menyalin ulang profile ke state form tiap kali `profile` berubah bisa menimpa
  // ketikan user. Baseline pembanding "ada perubahan" diisi di saat yang sama,
  // supaya titik nolnya persis nilai yang pertama kali ditampilkan.
  React.useEffect(() => {
    if (hydratedRef.current || !profile) {
      return;
    }

    hydratedRef.current = true;
    setFullName(profile.fullName ?? '');
    setPhone(profile.phone ?? '');
    setBaseline({ fullName: profile.fullName ?? '', phone: profile.phone ?? '' });
  }, [profile]);

  // Dibandingkan dalam bentuk ternormalisasi, bukan mentah: menambah lalu menghapus
  // satu spasi tidak boleh dianggap perubahan, dan "0812-3456" sama dengan
  // "0812 3456" karena keduanya disimpan sama.
  const hasUnsavedChanges =
    normalizeName(fullName) !== normalizeName(baseline.fullName) ||
    normalizePhone(phone) !== normalizePhone(baseline.phone);

  const { handleBackPress } = useUnsavedChangesGuard({
    // Saat penyimpanan berjalan, dialog tidak ditawarkan: tidak ada gunanya
    // menanyakan "buang perubahan" untuk perubahan yang sedang dikirim ke server.
    hasUnsavedChanges: hasUnsavedChanges && !saving,
    onBlocked: () => setConfirmDiscard(true),
    onLeave: () => {
      // Selama menyimpan, back sengaja tidak melakukan apa-apa. Kalau dibiarkan
      // keluar, handleSave yang selesai belakangan memanggil router.back() KEDUA
      // dan memantul melewati layar profil. Tombol Simpan sudah dalam keadaan
      // loading, jadi penantiannya singkat dan terlihat.
      if (saving) {
        return;
      }

      router.back();
    },
  });

  const fieldErrors = submitted ? computeFieldErrors(fullName, phone) : {};

  async function handleSave() {
    setSubmitted(true);
    setFormError(null);

    const errors = computeFieldErrors(fullName, phone);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setSaving(true);

    const result = await updateCurrentProfile({
      fullName: fullName.trim(),
      phone: normalizePhone(phone),
    });

    if (result.error) {
      setFormError(result.error.message);
      setSaving(false);
      return;
    }

    await refresh();
    setSaving(false);
    setPendingFeedback('profile_updated');
    router.back();
  }

  return (
    <Screen
      header={<TopAppBar title="Edit Profil" onBack={handleBackPress} />}
      stickyFooter={<Button title="Simpan perubahan" loading={saving} onPress={handleSave} />}
    >
      <ErrorBanner message={formError ?? error?.message} />

      {!profile ? (
        <EmptyState title="Profil tidak tersedia" subtitle="Masuk ulang jika data akun belum muncul." />
      ) : (
        <Card>
          <Field
            error={fieldErrors.fullName}
            label="Nama lengkap"
            placeholder="Nama lengkap"
            value={fullName}
            onChangeText={setFullName}
          />
          <Field
            error={fieldErrors.phone}
            helperText="Dipakai kalau ada yang perlu menghubungi kamu."
            keyboardType="phone-pad"
            label="Nomor HP"
            placeholder="Nomor HP"
            value={phone}
            onChangeText={setPhone}
          />
          {/* Tidak ada data, tidak ada elemen — sama seperti chip role di layar
              profil. Field abu-abu kosong berikut helper text-nya tidak memberi
              informasi apa pun, cuma menambah baris yang harus dibaca. */}
          {profile.email ? (
            <Field
              helperText="Email dipakai untuk masuk dan tidak bisa diubah."
              label="Email login"
              locked
              value={profile.email}
            />
          ) : null}
        </Card>
      )}

      <ConfirmDialog
        cancelLabel="Buang perubahan"
        cancelTone="danger"
        confirmLabel="Lanjut isi"
        icon="alert-triangle"
        message="Perubahan pada profil belum disimpan. Kalau keluar sekarang, perubahan itu hilang."
        onCancel={() => {
          setConfirmDiscard(false);
          router.back();
        }}
        onConfirm={() => setConfirmDiscard(false)}
        title="Perubahan belum disimpan"
        visible={confirmDiscard}
      />
    </Screen>
  );
}

function computeFieldErrors(fullName: string, phone: string): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {};

  if (!fullName.trim()) {
    errors.fullName = 'Nama lengkap wajib diisi.';
  }

  const normalizedPhone = normalizePhone(phone);

  // Nomor HP opsional. Yang ditolak hanya isian yang jelas bukan nomor — format
  // lama yang sudah tersimpan (berspasi, bertanda hubung, berawalan +62) tetap
  // lolos karena dinormalisasi dulu, bukan divalidasi mentah-mentah.
  if (normalizedPhone && !isValidPhone(normalizedPhone)) {
    errors.phone = `Nomor HP harus ${MIN_PHONE_DIGITS}-${MAX_PHONE_DIGITS} digit.`;
  }

  return errors;
}

function normalizeName(value: string): string {
  return value.trim();
}

// Pemisah yang lazim dipakai orang mengetik nomor: spasi, tanda hubung, kurung,
// dan titik. Semuanya dibuang, bukan ditolak — nomor lama yang sudah tersimpan
// dengan format apa pun di antaranya tetap bisa disimpan ulang. Awalan + tetap
// diterima karena ia bagian dari nomornya, bukan pemisah.
function normalizePhone(value: string): string {
  return value.replace(/[\s().-]/g, '');
}

function isValidPhone(normalizedPhone: string): boolean {
  return new RegExp(`^\\+?\\d{${MIN_PHONE_DIGITS},${MAX_PHONE_DIGITS}}$`).test(normalizedPhone);
}
