import { supabase } from '../lib/supabase';
import type {
  CreateFarmData,
  CreateFarmInput,
  CurrentUserFarm,
  Farm,
  ServiceResult,
  UpdateFarmProfileData,
  UpdateFarmProfileInput,
  UUID,
} from '../types/domain';
import { fail, ok } from '../utils/serviceResult';

type FarmRow = {
  id: string;
  name: string;
  location: string | null;
  area_size: number | string | null;
  join_code: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string | null;
};

type CurrentUserAccessRow = {
  membership_id: string;
  farm_id: string;
  user_id: string;
  role: CurrentUserFarm['role'];
  status: CurrentUserFarm['status'];
  joined_at: string | null;
  created_at?: string;
  updated_at?: string | null;
  removed_at?: string | null;
  removed_by?: string | null;
  removed_reason?: string | null;
  farm_name?: string | null;
};

export async function createFarm(input: CreateFarmInput): Promise<ServiceResult<CreateFarmData>> {
  const name = input.name.trim();

  if (!name) {
    return fail(new Error('Nama kebun wajib diisi.'));
  }

  const { data, error } = await supabase.rpc('create_farm_with_owner', {
    p_name: name,
    p_location: normalizeOptionalText(input.location),
    p_area_size: input.areaSize ?? null,
  });

  if (error) {
    return fail(error, 'Gagal membuat kebun. Silakan coba lagi.');
  }

  return ok({
    farmId: data as UUID,
  });
}

export async function getCurrentUserFarm(): Promise<ServiceResult<CurrentUserFarm | null>> {
  const userResult = await supabase.auth.getUser();

  if (userResult.error) {
    if (isMissingSessionError(userResult.error)) {
      return ok(null);
    }

    return fail(userResult.error, 'Gagal memuat pengguna saat ini.');
  }

  if (!userResult.data.user?.id) {
    return ok(null);
  }

  // SATU jalur saja, sengaja tanpa cadangan. Dulu ada jalur cadangan yang
  // membaca farm_members langsung kalau RPC-nya tidak ditemukan
  // (PGRST202/PGRST205 — praktisnya cache skema PostgREST yang basi sesaat
  // setelah db push). Jalur itu memilih baris dengan urutan waktu MURNI, tanpa
  // prioritas status yang ditambahkan migration 036 ke get_current_user_access.
  // Artinya kalau ia sampai menyala, ia menghidupkan lagi bug yang diperbaiki
  // di sana: baris rejected yang lebih baru mengalahkan relasi active, dan user
  // terlempar ke layar penolakan untuk kebun yang sudah tidak ada urusannya.
  //
  // Galat yang terlihat dan hilang saat dicoba lagi lebih baik daripada routing
  // yang salah secara diam-diam.
  const accessResult = await getCurrentUserAccessFromRpc();

  if (accessResult.error) {
    return fail(accessResult.error, 'Gagal memuat data akses pengguna.');
  }

  return mapCurrentUserAccessResult(accessResult.data);
}

async function getCurrentUserAccessFromRpc(): Promise<ServiceResult<CurrentUserAccessRow | null>> {
  const { data, error } = await supabase.rpc('get_current_user_access');

  if (error) {
    return fail(error);
  }

  const rows = (data ?? []) as CurrentUserAccessRow[];

  return ok(rows[0] ?? null);
}

async function mapCurrentUserAccessResult(
  row: CurrentUserAccessRow | null
): Promise<ServiceResult<CurrentUserFarm | null>> {
  if (!row) {
    return ok(null);
  }

  const membership: CurrentUserFarm = {
    membershipId: row.membership_id,
    farmId: row.farm_id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
    joinedAt: row.joined_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    removedAt: row.removed_at,
    removedBy: row.removed_by,
    removedReason: row.removed_reason,
  };

  // Status non-aktif (pending/rejected/removed) tidak boleh membaca tabel `farms`
  // — policy "Active members can view farm" (migration 007) menutupnya. Tapi RPC
  // get_current_user_access sudah ikut mengembalikan `farm_name` justru untuk
  // kasus ini, dan sebelumnya kolom itu tidak pernah dibaca sehingga layar
  // tunggu/ditolak/dinonaktifkan selalu menulis "Belum tersedia" (temuan R-04).
  if (membership.status !== 'active') {
    return ok({
      ...membership,
      farm: mapFarmNameOnly(membership.farmId, row.farm_name),
    });
  }

  const farmResult = await getFarmDetail(membership.farmId);

  if (farmResult.error) {
    return fail(farmResult.error);
  }

  return ok({
    ...membership,
    farm: farmResult.data,
  });
}

export async function getFarmDetail(farmId: UUID): Promise<ServiceResult<Farm>> {
  const { data, error } = await supabase
    .from('farms')
    .select('id, name, location, area_size, join_code, created_by, created_at, updated_at')
    .eq('id', farmId)
    .single<FarmRow>();

  if (error) {
    return fail(error, 'Gagal memuat detail kebun.');
  }

  return ok(mapFarm(data));
}

export async function updateFarmProfile(
  input: UpdateFarmProfileInput
): Promise<ServiceResult<UpdateFarmProfileData>> {
  const name = input.name.trim();

  if (!name) {
    return fail(new Error('Nama kebun wajib diisi.'));
  }

  if (input.areaSize !== null && input.areaSize !== undefined && input.areaSize <= 0) {
    return fail(new Error('Luas kebun harus lebih dari 0.'));
  }

  const { error } = await supabase.rpc('update_farm_profile', {
    p_area_size: input.areaSize ?? null,
    p_farm_id: input.farmId,
    p_location: normalizeOptionalText(input.location),
    p_name: name,
  });

  if (error) {
    return fail(new Error(mapUpdateFarmProfileError(error)));
  }

  return ok({
    success: true,
  });
}

// Kebun versi "cuma nama", untuk relasi yang belum/tidak aktif. Satu-satunya
// field yang benar-benar diketahui adalah namanya; sisanya memang tidak terbaca
// oleh non-anggota, bukan hilang. joinCode sengaja TIDAK diisi sama sekali —
// bukan string kosong yang menyamar sebagai kode.
function mapFarmNameOnly(farmId: UUID, farmName?: string | null): Farm {
  return {
    id: farmId,
    name: farmName ?? '',
    location: null,
    areaSize: null,
  };
}

function mapFarm(row: FarmRow): Farm {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    areaSize: row.area_size === null ? null : Number(row.area_size),
    joinCode: row.join_code,
    createdBy: row.created_by,
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

function mapUpdateFarmProfileError(error: { code?: string; message?: string }): string {
  if (error.code === 'PGRST202') {
    return 'Fitur edit kebun belum tersambung ke database. Jalankan pembaruan database lalu coba lagi.';
  }

  const message = error.message?.toLowerCase() ?? '';

  if (message.includes('farm name is required')) {
    return 'Nama kebun wajib diisi.';
  }

  if (message.includes('area_size') || message.includes('farms_area_size_check')) {
    return 'Luas kebun harus lebih dari 0.';
  }

  if (message.includes('only active owners')) {
    return 'Hanya owner aktif yang dapat mengubah data kebun.';
  }

  if (message.includes('not found') || message.includes('schema cache')) {
    return 'Data kebun tidak ditemukan atau akses tidak aktif.';
  }

  return 'Data kebun gagal diperbarui. Coba lagi.';
}
