import { supabase } from '../lib/supabase';
import type {
  ActivityStatus,
  CareActivity,
  CareCategory,
  CareTask,
  CareTaskDetail,
  CompleteTaskData,
  CompleteTaskInput,
  GetFarmTasksInput,
  GetTaskDetailInput,
  GetWorkerTasksInput,
  MemberRole,
  MemberStatus,
  PostponeTaskData,
  PostponeTaskInput,
  ServiceResult,
  SuccessData,
  TargetType,
  TaskStatus,
  UUID,
} from '../types/domain';
import { fail, ok } from '../utils/serviceResult';

const CARE_TASK_SELECT =
  'id, farm_id, care_schedule_id, assigned_to, assigned_by, title, category, instruction, target_type, target_row, target_column, target_tree_id, custom_target_note, due_date, status, created_at, updated_at';

const CARE_ACTIVITY_SELECT =
  'id, farm_id, care_task_id, performed_by, status, note, performed_at';

type CareTaskRow = {
  id: string;
  farm_id: string;
  care_schedule_id: string | null;
  assigned_to: string;
  assigned_by: string;
  title: string;
  category: CareCategory | null;
  instruction: string | null;
  target_type: TargetType;
  target_row: string | null;
  target_column: string | null;
  target_tree_id: string | null;
  custom_target_note: string | null;
  due_date: string;
  status: TaskStatus;
  created_at?: string;
  updated_at?: string | null;
};

type CareActivityRow = {
  id: string;
  farm_id: string;
  care_task_id: string;
  performed_by: string;
  status: ActivityStatus;
  note: string | null;
  performed_at: string;
};

type MembershipRow = {
  role: MemberRole;
  status: MemberStatus;
};

export async function getWorkerTasks(
  input: GetWorkerTasksInput
): Promise<ServiceResult<CareTask[]>> {
  const userIdResult = await getCurrentUserId();

  if (userIdResult.error) {
    return fail(userIdResult.error);
  }

  const accessResult = await ensureActiveWorker(input.farmId);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const { data, error } = await supabase
    .from('care_tasks')
    .select(CARE_TASK_SELECT)
    .eq('farm_id', input.farmId)
    .eq('assigned_to', userIdResult.data)
    .order('due_date', { ascending: true })
    .order('created_at', { ascending: false })
    .returns<CareTaskRow[]>();

  if (error) {
    return fail(error, 'Gagal memuat daftar tugas worker.');
  }

  return ok((data ?? []).map(mapCareTask));
}

export async function getFarmTasks(
  input: GetFarmTasksInput
): Promise<ServiceResult<CareTask[]>> {
  const accessResult = await ensureActiveOwner(input.farmId);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const { data, error } = await supabase
    .from('care_tasks')
    .select(CARE_TASK_SELECT)
    .eq('farm_id', input.farmId)
    .order('due_date', { ascending: true })
    .order('created_at', { ascending: false })
    .returns<CareTaskRow[]>();

  if (error) {
    return fail(error, 'Gagal memuat daftar tugas kebun.');
  }

  return ok((data ?? []).map(mapCareTask));
}

export async function getTaskDetail(
  input: GetTaskDetailInput
): Promise<ServiceResult<CareTaskDetail>> {
  const taskResult = await supabase
    .from('care_tasks')
    .select(CARE_TASK_SELECT)
    .eq('id', input.taskId)
    .maybeSingle<CareTaskRow>();

  if (taskResult.error) {
    return fail(taskResult.error, 'Gagal memuat detail tugas.');
  }

  if (!taskResult.data) {
    return fail(new Error('Tugas tidak ditemukan atau tidak dapat diakses.'));
  }

  const accessResult = await ensureActiveOwnerOrAssignedWorker(taskResult.data);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const activitiesResult = await supabase
    .from('care_activities')
    .select(CARE_ACTIVITY_SELECT)
    .eq('care_task_id', input.taskId)
    .order('performed_at', { ascending: false })
    .returns<CareActivityRow[]>();

  if (activitiesResult.error) {
    return fail(activitiesResult.error, 'Gagal memuat realisasi tugas.');
  }

  return ok({
    ...mapCareTask(taskResult.data),
    activities: (activitiesResult.data ?? []).map(mapCareActivity),
  });
}

export async function completeTask(
  input: CompleteTaskInput
): Promise<ServiceResult<CompleteTaskData>> {
  const { data, error } = await supabase.rpc('complete_task', {
    p_note: normalizeOptionalText(input.note),
    p_task_id: input.taskId,
  });

  if (error) {
    return fail(error, 'Gagal menyelesaikan tugas.');
  }

  if (!data) {
    return fail(new Error('RPC complete_task tidak mengembalikan activity id.'));
  }

  return ok({
    activityId: data as UUID,
  });
}

export async function postponeTask(
  input: PostponeTaskInput
): Promise<ServiceResult<PostponeTaskData>> {
  const note = normalizeOptionalText(input.note);

  if (!note) {
    return fail(new Error('Catatan penundaan wajib diisi.'));
  }

  const { data, error } = await supabase.rpc('postpone_task', {
    p_note: note,
    p_task_id: input.taskId,
  });

  if (error) {
    return fail(error, 'Gagal menunda tugas.');
  }

  if (!data) {
    return fail(new Error('RPC postpone_task tidak mengembalikan activity id.'));
  }

  return ok({
    activityId: data as UUID,
  });
}

async function ensureActiveOwner(farmId: UUID): Promise<ServiceResult<SuccessData>> {
  const membershipResult = await getCurrentUserMembership(farmId);

  if (membershipResult.error) {
    return fail(membershipResult.error);
  }

  if (membershipResult.data?.role !== 'owner' || membershipResult.data.status !== 'active') {
    return fail(new Error('Hanya owner aktif yang dapat melihat tugas kebun.'));
  }

  return ok({
    success: true,
  });
}

async function ensureActiveWorker(farmId: UUID): Promise<ServiceResult<SuccessData>> {
  const membershipResult = await getCurrentUserMembership(farmId);

  if (membershipResult.error) {
    return fail(membershipResult.error);
  }

  if (membershipResult.data?.role !== 'worker' || membershipResult.data.status !== 'active') {
    return fail(new Error('Hanya worker aktif yang dapat melihat tugasnya.'));
  }

  return ok({
    success: true,
  });
}

async function ensureActiveOwnerOrAssignedWorker(
  task: CareTaskRow
): Promise<ServiceResult<SuccessData>> {
  const userIdResult = await getCurrentUserId();

  if (userIdResult.error) {
    return fail(userIdResult.error);
  }

  const membershipResult = await getCurrentUserMembership(task.farm_id);

  if (membershipResult.error) {
    return fail(membershipResult.error);
  }

  const membership = membershipResult.data;
  const isActiveOwner = membership?.role === 'owner' && membership.status === 'active';
  const isAssignedActiveWorker =
    membership?.role === 'worker'
    && membership.status === 'active'
    && task.assigned_to === userIdResult.data;

  if (!isActiveOwner && !isAssignedActiveWorker) {
    return fail(new Error('Tugas tidak ditemukan atau tidak dapat diakses.'));
  }

  return ok({
    success: true,
  });
}

async function getCurrentUserMembership(
  farmId: UUID
): Promise<ServiceResult<MembershipRow | null>> {
  const userIdResult = await getCurrentUserId();

  if (userIdResult.error) {
    return fail(userIdResult.error);
  }

  const { data, error } = await supabase
    .from('farm_members')
    .select('role, status')
    .eq('farm_id', farmId)
    .eq('user_id', userIdResult.data)
    .maybeSingle<MembershipRow>();

  if (error) {
    return fail(error, 'Gagal memeriksa akses kebun.');
  }

  return ok(data);
}

async function getCurrentUserId(): Promise<ServiceResult<UUID>> {
  const userResult = await supabase.auth.getUser();

  if (userResult.error) {
    if (isMissingSessionError(userResult.error)) {
      return fail(new Error('Silakan login terlebih dahulu.'));
    }

    return fail(userResult.error, 'Gagal memuat pengguna saat ini.');
  }

  const userId = userResult.data.user?.id;

  if (!userId) {
    return fail(new Error('Silakan login terlebih dahulu.'));
  }

  return ok(userId);
}

function mapCareTask(row: CareTaskRow): CareTask {
  return {
    assignedBy: row.assigned_by,
    assignedTo: row.assigned_to,
    careScheduleId: row.care_schedule_id,
    category: row.category,
    createdAt: row.created_at,
    customTargetNote: row.custom_target_note,
    dueDate: row.due_date,
    farmId: row.farm_id,
    id: row.id,
    instruction: row.instruction,
    status: row.status,
    targetColumn: row.target_column,
    targetRow: row.target_row,
    targetTreeId: row.target_tree_id,
    targetType: row.target_type,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

function mapCareActivity(row: CareActivityRow): CareActivity {
  return {
    careTaskId: row.care_task_id,
    farmId: row.farm_id,
    id: row.id,
    note: row.note,
    performedAt: row.performed_at,
    performedBy: row.performed_by,
    status: row.status,
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
