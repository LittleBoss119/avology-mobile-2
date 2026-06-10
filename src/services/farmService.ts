import { supabase } from '../lib/supabase';
import type {
  CreateFarmData,
  CreateFarmInput,
  CurrentUserFarm,
  Farm,
  ServiceResult,
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

type CurrentUserFarmRow = {
  id: string;
  farm_id: string;
  user_id: string;
  role: CurrentUserFarm['role'];
  status: CurrentUserFarm['status'];
  joined_at: string | null;
  created_at?: string;
  updated_at?: string | null;
  farms?: FarmRow | FarmRow[] | null;
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

  const userId = userResult.data.user?.id;

  if (!userId) {
    return ok(null);
  }

  const { data, error } = await supabase
    .from('farm_members')
    .select(
      `
        id,
        farm_id,
        user_id,
        role,
        status,
        joined_at,
        created_at,
        updated_at,
        farms (
          id,
          name,
          location,
          area_size,
          join_code,
          created_by,
          created_at,
          updated_at
        )
      `
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<CurrentUserFarmRow>();

  if (error) {
    return fail(error, 'Gagal memuat data kebun pengguna.');
  }

  return ok(data ? mapCurrentUserFarm(data) : null);
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

function mapCurrentUserFarm(row: CurrentUserFarmRow): CurrentUserFarm {
  const farmRow = Array.isArray(row.farms) ? row.farms[0] : row.farms;

  return {
    membershipId: row.id,
    farmId: row.farm_id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
    joinedAt: row.joined_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    farm: farmRow ? mapFarm(farmRow) : undefined,
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
