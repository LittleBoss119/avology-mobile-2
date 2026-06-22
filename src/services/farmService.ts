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

  const userId = userResult.data.user?.id;

  if (!userId) {
    return ok(null);
  }

  const accessResult = await getCurrentUserAccessFromRpc();

  if (accessResult.error && !isMissingRpcError(accessResult.error)) {
    return fail(accessResult.error, 'Gagal memuat data akses pengguna.');
  }

  if (!accessResult.error) {
    return mapCurrentUserAccessResult(accessResult.data);
  }

  const { data, error } = await supabase
    .from('farm_members')
    .select('id, farm_id, user_id, role, status, joined_at, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .returns<CurrentUserFarmRow[]>();

  if (error) {
    return fail(error, 'Gagal memuat data kebun pengguna.');
  }

  const currentMembership = chooseMostRecentMembership(data ?? []);

  if (!currentMembership) {
    return ok(null);
  }

  if (currentMembership.status !== 'active') {
    return ok(mapCurrentUserFarm(currentMembership));
  }

  const farmResult = await getFarmDetail(currentMembership.farm_id);

  if (farmResult.error) {
    return fail(farmResult.error);
  }

  return ok(mapCurrentUserFarm(currentMembership, farmResult.data));
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

  const membership = mapCurrentUserFarm({
    id: row.membership_id,
    farm_id: row.farm_id,
    user_id: row.user_id,
    role: row.role,
    status: row.status,
    joined_at: row.joined_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });

  if (membership.status !== 'active') {
    return ok(membership);
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

function mapCurrentUserFarm(row: CurrentUserFarmRow, farm?: Farm): CurrentUserFarm {
  return {
    membershipId: row.id,
    farmId: row.farm_id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
    joinedAt: row.joined_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    farm,
  };
}

function chooseMostRecentMembership(rows: CurrentUserFarmRow[]): CurrentUserFarmRow | null {
  return [...rows].sort((first, second) => {
    const firstTime = new Date(first.updated_at ?? first.created_at ?? 0).getTime();
    const secondTime = new Date(second.updated_at ?? second.created_at ?? 0).getTime();

    return secondTime - firstTime;
  })[0] ?? null;
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

function isMissingRpcError(error: { code?: string; message?: string; rawMessage?: string }): boolean {
  const message = `${error.message ?? ''} ${error.rawMessage ?? ''}`.toLowerCase();

  return (
    error.code === 'PGRST202' ||
    error.code === 'PGRST205' ||
    message.includes('get_current_user_access') &&
      (message.includes('not found') ||
        message.includes('schema cache') ||
        message.includes('does not exist'))
  );
}
