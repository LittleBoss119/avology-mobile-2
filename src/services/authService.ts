import { supabase } from '../lib/supabase';
import { getCurrentUserFarm } from './farmService';
import type {
  LoginUserData,
  LoginUserInput,
  Profile,
  RegisterUserData,
  RegisterUserInput,
  ServiceResult,
  SuccessData,
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
