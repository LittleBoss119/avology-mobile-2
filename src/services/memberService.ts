import { supabase } from '../lib/supabase';
import type {
  FarmMemberBasicProfile,
  FarmActorDisplayProfile,
  LeaveCurrentFarmInput,
  MembershipActionInput,
  MemberRole,
  MemberStatus,
  RequestJoinFarmData,
  RequestJoinFarmInput,
  ServiceResult,
  SuccessData,
  UUID,
  WorkerMembership,
} from '../types/domain';
import { fail, ok } from '../utils/serviceResult';

type PendingWorkerRow = {
  membership_id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  role: 'worker';
  status: 'pending';
  created_at: string;
};

type ActiveWorkerRow = {
  membership_id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  role: 'worker';
  status: 'active';
  joined_at: string | null;
};

type FarmMemberBasicProfileRow = {
  user_id: string;
  full_name: string;
  phone: string | null;
};

type FarmActorDisplayProfileRow = {
  user_id: string;
  full_name: string;
  role: MemberRole;
  status: MemberStatus;
};

type WorkerMembershipRow = {
  id: string;
  user_id: string;
  role: MemberRole;
  status: MemberStatus;
  created_at: string;
  updated_at: string | null;
  joined_at: string | null;
  removed_at?: string | null;
  removed_by?: string | null;
  removed_reason?: string | null;
};

export async function requestJoinFarm(
  input: RequestJoinFarmInput
): Promise<ServiceResult<RequestJoinFarmData>> {
  const joinCode = input.joinCode.trim().toUpperCase();

  if (!joinCode) {
    return fail(new Error('Kode kebun wajib diisi.'));
  }

  const { data, error } = await supabase.rpc('request_join_farm', {
    p_join_code: joinCode,
  });

  if (error) {
    return fail(error, 'Gagal mengajukan bergabung ke kebun.');
  }

  return ok({
    membershipId: data as UUID,
  });
}

export async function getPendingWorkers(
  farmId: UUID
): Promise<ServiceResult<WorkerMembership[]>> {
  const { data, error } = await supabase.rpc('get_pending_workers', {
    p_farm_id: farmId,
  });

  if (error) {
    return fail(error, 'Gagal memuat pengajuan pekerja.');
  }

  return ok(((data ?? []) as PendingWorkerRow[]).map(mapPendingWorker));
}

export async function getActiveWorkers(
  farmId: UUID
): Promise<ServiceResult<WorkerMembership[]>> {
  const { data, error } = await supabase.rpc('get_active_workers', {
    p_farm_id: farmId,
  });

  if (error) {
    return fail(error, 'Gagal memuat pekerja aktif.');
  }

  return ok(((data ?? []) as ActiveWorkerRow[]).map(mapActiveWorker));
}

export async function getFarmMemberBasicProfiles(
  farmId: UUID
): Promise<ServiceResult<FarmMemberBasicProfile[]>> {
  const { data, error } = await supabase.rpc('get_member_basic_profiles', {
    p_farm_id: farmId,
  });

  if (error) {
    return fail(error, 'Gagal memuat profil dasar anggota kebun.');
  }

  return ok(((data ?? []) as FarmMemberBasicProfileRow[]).map(mapFarmMemberBasicProfile));
}

export async function getFarmActorDisplayProfiles(
  farmId: UUID
): Promise<ServiceResult<FarmActorDisplayProfile[]>> {
  const { data, error } = await supabase.rpc('get_farm_actor_display_profiles', {
    p_farm_id: farmId,
  });

  if (error) {
    return fail(error, 'Gagal memuat nama aktor riwayat kebun.');
  }

  return ok(((data ?? []) as FarmActorDisplayProfileRow[]).map(mapFarmActorDisplayProfile));
}

export async function getWorkerMemberships(
  farmId: UUID
): Promise<ServiceResult<WorkerMembership[]>> {
  const [membersResult, profilesResult] = await Promise.all([
    supabase
      .from('farm_members')
      .select('id, user_id, role, status, created_at, updated_at, joined_at, removed_at, removed_by, removed_reason')
      .eq('farm_id', farmId)
      .eq('role', 'worker')
      .order('created_at', { ascending: false })
      .returns<WorkerMembershipRow[]>(),
    getFarmMemberBasicProfiles(farmId),
  ]);

  if (membersResult.error) {
    return fail(membersResult.error, 'Gagal memuat riwayat akses pekerja.');
  }

  if (profilesResult.error) {
    return fail(profilesResult.error);
  }

  const profileMap = new Map(
    profilesResult.data.map((profile) => [profile.userId, profile])
  );

  return ok(
    (membersResult.data ?? [])
      .filter((row) => row.role === 'worker')
      .map((row) => mapWorkerMembership(row, profileMap.get(row.user_id)))
  );
}

export async function approveWorker(
  input: MembershipActionInput
): Promise<ServiceResult<SuccessData>> {
  return updateWorkerMembership('approve_worker', input.membershipId, 'Gagal menyetujui pekerja.');
}

export async function rejectWorker(
  input: MembershipActionInput
): Promise<ServiceResult<SuccessData>> {
  return updateWorkerMembership('reject_worker', input.membershipId, 'Gagal menolak pekerja.');
}

export async function removeWorker(
  input: MembershipActionInput
): Promise<ServiceResult<SuccessData>> {
  return updateWorkerMembership('remove_worker', input.membershipId, 'Gagal mengeluarkan pekerja.');
}

export async function leaveCurrentFarm(
  input: LeaveCurrentFarmInput
): Promise<ServiceResult<SuccessData>> {
  const { error } = await supabase.rpc('leave_current_farm', {
    p_farm_id: input.farmId,
  });

  if (error) {
    return fail(new Error(mapLeaveCurrentFarmError(error)));
  }

  return ok({
    success: true,
  });
}

async function updateWorkerMembership(
  rpcName: 'approve_worker' | 'reject_worker' | 'remove_worker',
  membershipId: UUID,
  fallbackMessage: string
): Promise<ServiceResult<SuccessData>> {
  const { error } = await supabase.rpc(rpcName, {
    p_farm_member_id: membershipId,
  });

  if (error) {
    return fail(error, fallbackMessage);
  }

  return ok({
    success: true,
  });
}

function mapPendingWorker(row: PendingWorkerRow): WorkerMembership {
  return {
    membershipId: row.membership_id,
    userId: row.user_id,
    fullName: row.full_name,
    phone: row.phone,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapActiveWorker(row: ActiveWorkerRow): WorkerMembership {
  return {
    membershipId: row.membership_id,
    userId: row.user_id,
    fullName: row.full_name,
    phone: row.phone,
    role: row.role,
    status: row.status,
    joinedAt: row.joined_at,
  };
}

function mapFarmMemberBasicProfile(row: FarmMemberBasicProfileRow): FarmMemberBasicProfile {
  return {
    fullName: row.full_name,
    phone: row.phone,
    userId: row.user_id,
  };
}

function mapFarmActorDisplayProfile(row: FarmActorDisplayProfileRow): FarmActorDisplayProfile {
  return {
    fullName: row.full_name,
    role: row.role,
    status: row.status,
    userId: row.user_id,
  };
}

function mapWorkerMembership(
  row: WorkerMembershipRow,
  profile?: FarmMemberBasicProfile
): WorkerMembership {
  return {
    createdAt: row.created_at,
    fullName: profile?.fullName ?? 'Pengguna tidak tersedia',
    joinedAt: row.joined_at,
    membershipId: row.id,
    phone: profile?.phone ?? null,
    removedAt: row.removed_at,
    removedBy: row.removed_by,
    removedReason: row.removed_reason,
    role: 'worker',
    status: row.status,
    updatedAt: row.updated_at,
    userId: row.user_id,
  };
}

function mapLeaveCurrentFarmError(error: { code?: string; message?: string }): string {
  if (error.code === 'PGRST202') {
    return 'Fitur keluar dari kebun belum tersambung ke database. Jalankan pembaruan database lalu coba lagi.';
  }

  const message = error.message?.toLowerCase() ?? '';

  if (message.includes('active worker membership not found')) {
    return 'Akses pekerja aktif tidak ditemukan.';
  }

  if (message.includes('user is not authenticated')) {
    return 'Silakan login terlebih dahulu.';
  }

  if (message.includes('could not find the function')) {
    return 'Fitur keluar dari kebun belum tersambung ke database. Jalankan pembaruan database lalu coba lagi.';
  }

  return 'Gagal keluar dari kebun. Coba lagi.';
}
