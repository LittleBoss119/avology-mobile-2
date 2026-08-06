import { supabase } from '../lib/supabase';
import type {
  FarmAccessEvent,
  FarmAccessEventEntry,
  FarmMemberBasicProfile,
  FarmActorDisplayProfile,
  FarmPreview,
  LeaveCurrentFarmInput,
  MembershipActionInput,
  MemberRole,
  MemberStatus,
  PreviewFarmByJoinCodeInput,
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

type FarmPreviewRow = {
  farm_name: string;
  farm_location: string | null;
  owner_name: string | null;
};

type FarmAccessEventRow = {
  id: string;
  user_id: string;
  full_name: string;
  event: FarmAccessEvent;
  actor_id: string | null;
  actor_name: string | null;
  reason: string | null;
  created_at: string;
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

// Langkah pertama alur gabung dua langkah: validasi kode sekaligus ambil
// pratinjau kebun. Guard di RPC-nya identik dengan request_join_farm, jadi kode
// yang lolos di sini dijamin bisa diajukan di langkah kedua.
// Belum dipanggil dari layar mana pun — layarnya dikerjakan di Fase 3.
export async function previewFarmByJoinCode(
  input: PreviewFarmByJoinCodeInput
): Promise<ServiceResult<FarmPreview>> {
  const joinCode = input.joinCode.trim().toUpperCase();

  if (!joinCode) {
    return fail(new Error('Kode kebun wajib diisi.'));
  }

  const { data, error } = await supabase.rpc('preview_farm_by_join_code', {
    p_join_code: joinCode,
  });

  if (error) {
    return fail(error, 'Gagal memeriksa kode kebun.');
  }

  const row = ((data ?? []) as FarmPreviewRow[])[0];

  if (!row) {
    return fail(new Error('Kode kebun tidak ditemukan. Periksa kembali kode yang dimasukkan.'));
  }

  return ok(mapFarmPreview(row));
}

// Menutup pemberitahuan penolakan/penonaktifan milik pemanggil sendiri. Seluruh
// baris rejected/removed miliknya dihapus sekali panggil; riwayatnya tetap utuh
// di farm_access_events.
// Belum dipanggil dari layar mana pun — layarnya dikerjakan di Fase 3.
export async function acknowledgeAccessNotice(): Promise<ServiceResult<SuccessData>> {
  const { error } = await supabase.rpc('acknowledge_access_notice');

  if (error) {
    return fail(error, 'Gagal menutup pemberitahuan akses.');
  }

  return ok({
    success: true,
  });
}

// Membatalkan pengajuan milik pemanggil sendiri. Tanpa parameter: RPC-nya yang
// mencari baris pending milik auth.uid(). Baris farm_members-nya dihapus, tapi
// jejaknya tetap tercatat sebagai event 'cancelled' di farm_access_events.
// Belum dipanggil dari layar mana pun — layarnya dikerjakan di Fase 3.
export async function cancelJoinRequest(): Promise<ServiceResult<SuccessData>> {
  const { error } = await supabase.rpc('cancel_join_request');

  if (error) {
    return fail(error, 'Gagal membatalkan pengajuan.');
  }

  return ok({
    success: true,
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

// Riwayat akses kebun dari tabel append-only farm_access_events. Lewat RPC,
// bukan query langsung, karena policy profiles hanya mengizinkan seseorang
// membaca profilnya sendiri — query langsung akan kehilangan seluruh nama.
export async function getFarmAccessEvents(
  farmId: UUID
): Promise<ServiceResult<FarmAccessEventEntry[]>> {
  const { data, error } = await supabase.rpc('get_farm_access_events', {
    p_farm_id: farmId,
  });

  if (error) {
    return fail(error, 'Gagal memuat riwayat akses kebun.');
  }

  return ok(((data ?? []) as FarmAccessEventRow[]).map(mapFarmAccessEventEntry));
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

function mapFarmPreview(row: FarmPreviewRow): FarmPreview {
  return {
    farmName: row.farm_name,
    location: row.farm_location,
    ownerName: row.owner_name,
  };
}

function mapFarmAccessEventEntry(row: FarmAccessEventRow): FarmAccessEventEntry {
  return {
    actorId: row.actor_id,
    actorName: row.actor_name,
    createdAt: row.created_at,
    event: row.event,
    fullName: row.full_name,
    id: row.id,
    reason: row.reason,
    userId: row.user_id,
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
