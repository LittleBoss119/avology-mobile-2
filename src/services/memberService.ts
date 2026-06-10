import { supabase } from '../lib/supabase';
import type {
  MembershipActionInput,
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
    return fail(error, 'Gagal memuat pengajuan worker.');
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
    return fail(error, 'Gagal memuat worker aktif.');
  }

  return ok(((data ?? []) as ActiveWorkerRow[]).map(mapActiveWorker));
}

export async function approveWorker(
  input: MembershipActionInput
): Promise<ServiceResult<SuccessData>> {
  return updateWorkerMembership('approve_worker', input.membershipId, 'Gagal menyetujui worker.');
}

export async function rejectWorker(
  input: MembershipActionInput
): Promise<ServiceResult<SuccessData>> {
  return updateWorkerMembership('reject_worker', input.membershipId, 'Gagal menolak worker.');
}

export async function removeWorker(
  input: MembershipActionInput
): Promise<ServiceResult<SuccessData>> {
  return updateWorkerMembership('remove_worker', input.membershipId, 'Gagal mengeluarkan worker.');
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
