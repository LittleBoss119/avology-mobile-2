import { supabase } from '../lib/supabase';
import { supabasePasswordVerifier } from '../lib/supabasePasswordVerifier';
import { getCurrentUserFarm } from './farmService';
import type {
  LoginUserData,
  LoginUserInput,
  Profile,
  RegisterUserData,
  RegisterUserInput,
  ServiceResult,
  SuccessData,
  UpdatePasswordInput,
  UpdateProfileInput,
} from '../types/domain';
import { fail, ok } from '../utils/serviceResult';

type ProfileRow = {
  id: string;
  full_name: string;
  phone: string | null;
  created_at?: string;
  updated_at?: string | null;
};

export async function registerUser(
  input: RegisterUserInput
): Promise<ServiceResult<RegisterUserData>> {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  const phone = normalizeOptionalText(input.phone);

  if (!email) {
    return fail(new Error('Email wajib diisi.'));
  }

  if (!input.password) {
    return fail(new Error('Password wajib diisi.'));
  }

  if (!fullName) {
    return fail(new Error('Nama lengkap wajib diisi.'));
  }

  // Nomor HP wajib saat pendaftaran, meski tipenya tetap opsional di
  // RegisterUserInput — kolom profiles.phone memang nullable dan
  // updateCurrentProfile masih boleh mengosongkannya. Yang ditegakkan di sini
  // hanya aturan pendaftaran, bukan bentuk datanya.
  if (!phone) {
    return fail(new Error('Nomor HP wajib diisi.'));
  }

  const signUpResult = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      data: {
        full_name: fullName,
        phone,
      },
    },
  });

  if (signUpResult.error) {
    return fail(signUpResult.error, 'Gagal mendaftarkan akun.');
  }

  const userId = signUpResult.data.user?.id;

  if (!userId) {
    return fail(new Error('Gagal mendapatkan ID pengguna setelah registrasi.'));
  }

  const profileResult = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        full_name: fullName,
        phone,
      },
      { onConflict: 'id' }
    )
    .select('id, full_name, phone, created_at, updated_at')
    .single<ProfileRow>();

  if (profileResult.error) {
    return fail(
      profileResult.error,
      'Akun berhasil dibuat, tetapi profil belum dapat disimpan. Silakan login kembali.'
    );
  }

  return ok({
    userId,
    profile: mapProfile(profileResult.data),
  });
}

export async function loginUser(input: LoginUserInput): Promise<ServiceResult<LoginUserData>> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });

  if (error) {
    return fail(error, 'Gagal login. Periksa email dan password Anda.');
  }

  const userId = data.user?.id;

  if (!userId) {
    return fail(new Error('Gagal mendapatkan ID pengguna setelah login.'));
  }

  const currentFarmResult = await getCurrentUserFarm();

  if (currentFarmResult.error) {
    return fail(currentFarmResult.error, 'Login berhasil, tetapi data kebun gagal dimuat.');
  }

  return ok({
    userId,
    currentFarm: currentFarmResult.data,
  });
}

export async function logoutUser(): Promise<ServiceResult<SuccessData>> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    return fail(error, 'Gagal logout. Silakan coba lagi.');
  }

  return ok({
    success: true,
  });
}

export async function getCurrentProfile(): Promise<ServiceResult<Profile | null>> {
  const userResult = await supabase.auth.getUser();

  if (userResult.error) {
    if (isMissingSessionError(userResult.error)) {
      return ok(null);
    }

    return fail(userResult.error, 'Gagal memuat pengguna saat ini.');
  }

  const userId = userResult.data.user?.id;

  if (!userId) {
    return ok(null);
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, created_at, updated_at')
    .eq('id', userId)
    .single<ProfileRow>();

  if (error) {
    return fail(error, 'Gagal memuat profil pengguna.');
  }

  return ok(mapProfile(data, userResult.data.user.email ?? null));
}

export async function updateCurrentProfile(
  input: UpdateProfileInput
): Promise<ServiceResult<Profile>> {
  const fullName = input.fullName.trim();
  const phone = normalizeOptionalText(input.phone);

  if (!fullName) {
    return fail(new Error('Nama lengkap wajib diisi.'));
  }

  const userResult = await supabase.auth.getUser();

  if (userResult.error) {
    return fail(userResult.error, 'Gagal memuat pengguna saat ini.');
  }

  const userId = userResult.data.user?.id;

  if (!userId) {
    return fail(new Error('Sesi tidak ditemukan. Silakan login kembali.'));
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      phone,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('id, full_name, phone, created_at, updated_at')
    .single<ProfileRow>();

  if (error) {
    return fail(error, 'Gagal menyimpan profil. Silakan coba lagi.');
  }

  return ok(mapProfile(data, userResult.data.user.email ?? null));
}

// Kode error yang bisa dibedakan UI, supaya "password saat ini salah" tidak
// tenggelam jadi pesan generik "Password gagal diperbarui".
export const INVALID_CURRENT_PASSWORD_CODE = 'invalid_current_password';
export const PASSWORD_VERIFY_RATE_LIMITED_CODE = 'password_verify_rate_limited';

export async function updatePassword(
  input: UpdatePasswordInput
): Promise<ServiceResult<SuccessData>> {
  if (!input.currentPassword) {
    return fail(new Error('Password saat ini wajib diisi.'));
  }

  if (!input.newPassword) {
    return fail(new Error('Password baru wajib diisi.'));
  }

  if (input.newPassword.length < 6) {
    return fail(new Error('Password minimal 6 karakter.'));
  }

  const userResult = await supabase.auth.getUser();

  if (userResult.error || !userResult.data.user) {
    return fail(new Error('Sesi login tidak ditemukan. Silakan login ulang.'));
  }

  const email = userResult.data.user.email;

  if (!email) {
    return fail(new Error('Akun ini tidak memiliki email login, password tidak dapat diubah dari aplikasi.'));
  }

  const verificationError = await verifyCurrentPassword(email, input.currentPassword);

  if (verificationError) {
    return fail(verificationError);
  }

  const { error } = await supabase.auth.updateUser({
    password: input.newPassword,
  });

  if (error) {
    return fail(new Error(mapUpdatePasswordError(error)));
  }

  return ok({
    success: true,
  });
}

// Membuktikan pemegang HP tahu password sekarang, lewat client kedua supaya sesi
// utama tidak tersentuh. Sesi bayangan hasil login ini TIDAK dipakai untuk apa pun
// dan langsung dibuang; perubahan password tetap berjalan di client utama.
async function verifyCurrentPassword(
  email: string,
  currentPassword: string
): Promise<{ code: string; message: string } | null> {
  const { error } = await supabasePasswordVerifier.auth.signInWithPassword({
    email,
    password: currentPassword,
  });

  // scope 'local' — hanya membersihkan sesi bayangan di memori client kedua.
  // JANGAN 'global': itu akan mencabut semua sesi user, termasuk sesi utama.
  await supabasePasswordVerifier.auth.signOut({ scope: 'local' }).catch(() => undefined);

  if (!error) {
    return null;
  }

  if (isRateLimitError(error)) {
    return {
      code: PASSWORD_VERIFY_RATE_LIMITED_CODE,
      message: 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.',
    };
  }

  return {
    code: INVALID_CURRENT_PASSWORD_CODE,
    message: 'Password saat ini salah.',
  };
}

function isRateLimitError(error: { code?: string; status?: number }): boolean {
  return error.code === 'over_request_rate_limit' || error.status === 429;
}

function mapProfile(row: ProfileRow, email?: string | null): Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function isMissingSessionError(error: { message?: string; name?: string }): boolean {
  return (
    error.name === 'AuthSessionMissingError' ||
    error.message?.toLowerCase().includes('auth session missing') === true
  );
}

function mapUpdatePasswordError(error: { message?: string; name?: string }): string {
  if (isMissingSessionError(error)) {
    return 'Sesi login tidak ditemukan. Silakan login ulang.';
  }

  const message = error.message?.toLowerCase() ?? '';

  if (message.includes('password') && message.includes('6')) {
    return 'Password minimal 6 karakter.';
  }

  return 'Password gagal diperbarui. Coba lagi.';
}
