import { supabase } from '../lib/supabase';
import type {
  ActivityStatus,
  CareActivity,
  CareCategory,
  CareTask,
  CareTaskDetail,
  CreateTaskFromOperationalReportData,
  CreateTaskFromOperationalReportInput,
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
  'id, farm_id, care_schedule_id, operational_report_id, assigned_to, assigned_by, title, category, instruction, target_type, target_row, target_column, target_tree_id, custom_target_note, due_date, status, created_at, updated_at';

const CARE_ACTIVITY_SELECT =
  'id, farm_id, care_task_id, performed_by, status, note, performed_at';

type CareTaskRow = {
  id: string;
  farm_id: string;
  care_schedule_id: string | null;
  operational_report_id: string | null;
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

type OperationalReportSourceRow = {
  id: string;
  farm_id: string;
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
    return fail(error, 'Gagal memuat daftar tugas pekerja.');
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

export async function createTaskFromOperationalReport(
  input: CreateTaskFromOperationalReportInput
): Promise<ServiceResult<CreateTaskFromOperationalReportData>> {
  const reportId = normalizeRequiredText(
    input.operationalReportId,
    'Laporan operasional tidak ditemukan.'
  );

  if (reportId instanceof Error) {
    return fail(reportId);
  }

  const workerId = normalizeRequiredText(
    input.assignedWorkerId,
    'Pekerja aktif wajib dipilih.'
  );

  if (workerId instanceof Error) {
    return fail(workerId);
  }

  const dueDate = normalizeTaskDate(input.dueDate);

  if (dueDate instanceof Error) {
    return fail(dueDate);
  }

  const title = normalizeRequiredText(input.title, 'Judul tugas wajib diisi.');

  if (title instanceof Error) {
    return fail(title);
  }

  const target = normalizeTaskTarget({
    customTargetNote: input.customTargetNote,
    targetColumn: input.targetColumn,
    targetRow: input.targetRow,
    targetTreeId: input.targetTreeId,
    targetType: input.targetType,
  });

  if (target instanceof Error) {
    return fail(target);
  }

  const reportResult = await getAccessibleOperationalReportSource(reportId);

  if (reportResult.error) {
    return fail(reportResult.error);
  }

  const accessResult = await ensureActiveOwner(
    reportResult.data.farm_id,
    'Hanya pemilik aktif yang dapat membuat tindak lanjut laporan operasional.'
  );

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const { data, error } = await supabase.rpc('create_task_from_operational_report', {
    p_assigned_worker_id: workerId,
    p_custom_target_note: target.customTargetNote,
    p_due_date: dueDate,
    p_instruction: normalizeOptionalText(input.instruction),
    p_operational_report_id: reportId,
    p_target_column: target.targetColumn,
    p_target_row: target.targetRow,
    p_target_tree_id: target.targetTreeId,
    p_target_type: target.targetType,
    p_title: title,
  });

  if (error) {
    return fail(error, 'Gagal membuat tugas tindak lanjut laporan operasional.');
  }

  if (!data) {
    return fail(new Error('RPC create_task_from_operational_report tidak mengembalikan task id.'));
  }

  const statusResult = await supabase.rpc('update_operational_report_status', {
    p_operational_report_id: reportId,
    p_status: 'in_progress',
  });

  if (statusResult.error) {
    return fail(statusResult.error, 'Task dibuat, tetapi status laporan gagal diperbarui.');
  }

  return ok({
    taskId: data as UUID,
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

async function ensureActiveOwner(
  farmId: UUID,
  forbiddenMessage = 'Hanya pemilik aktif yang dapat melihat tugas kebun.'
): Promise<ServiceResult<SuccessData>> {
  const membershipResult = await getCurrentUserMembership(farmId);

  if (membershipResult.error) {
    return fail(membershipResult.error);
  }

  if (membershipResult.data?.role !== 'owner' || membershipResult.data.status !== 'active') {
    return fail(new Error(forbiddenMessage));
  }

  return ok({
    success: true,
  });
}

async function getAccessibleOperationalReportSource(
  operationalReportId: UUID
): Promise<ServiceResult<OperationalReportSourceRow>> {
  const { data, error } = await supabase
    .from('operational_reports')
    .select('id, farm_id')
    .eq('id', operationalReportId)
    .maybeSingle<OperationalReportSourceRow>();

  if (error) {
    return fail(error, 'Gagal memeriksa laporan operasional.');
  }

  if (!data) {
    return fail(new Error('Laporan operasional tidak ditemukan atau tidak dapat diakses.'));
  }

  return ok(data);
}

async function ensureActiveWorker(farmId: UUID): Promise<ServiceResult<SuccessData>> {
  const membershipResult = await getCurrentUserMembership(farmId);

  if (membershipResult.error) {
    return fail(membershipResult.error);
  }

  if (membershipResult.data?.role !== 'worker' || membershipResult.data.status !== 'active') {
    return fail(new Error('Hanya pekerja aktif yang dapat melihat tugasnya.'));
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
    operationalReportId: row.operational_report_id,
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

function normalizeRequiredText(value: string, message: string): string | Error {
  const normalized = value.trim();
  return normalized ? normalized : new Error(message);
}

function normalizeTaskDate(value: string): string | Error {
  const normalized = value.trim();

  if (!normalized) {
    return new Error('Tanggal jatuh tempo wajib diisi.');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return new Error('Tanggal jatuh tempo harus memakai format YYYY-MM-DD.');
  }

  const date = new Date(`${normalized}T00:00:00`);

  if (Number.isNaN(date.getTime()) || toLocalIsoDate(date) !== normalized) {
    return new Error('Tanggal jatuh tempo tidak valid.');
  }

  return normalized;
}

function normalizeTaskTarget(input: {
  targetType: TargetType | string | null | undefined;
  targetRow?: string | null;
  targetColumn?: string | null;
  targetTreeId?: string | null;
  customTargetNote?: string | null;
}):
  | {
      targetType: TargetType;
      targetRow: string | null;
      targetColumn: string | null;
      targetTreeId: string | null;
      customTargetNote: string | null;
    }
  | Error {
  if (!input.targetType) {
    return new Error('Target tugas wajib dipilih.');
  }

  if (!['farm', 'row', 'column', 'tree', 'custom'].includes(input.targetType)) {
    return new Error('Target tugas tidak valid.');
  }

  if (input.targetType === 'farm') {
    return {
      customTargetNote: null,
      targetColumn: null,
      targetRow: null,
      targetTreeId: null,
      targetType: 'farm',
    };
  }

  if (input.targetType === 'row') {
    const row = normalizeOptionalText(input.targetRow);

    if (!row) {
      return new Error('Baris target wajib diisi.');
    }

    return {
      customTargetNote: null,
      targetColumn: null,
      targetRow: row,
      targetTreeId: null,
      targetType: 'row',
    };
  }

  if (input.targetType === 'column') {
    const column = normalizeOptionalText(input.targetColumn);

    if (!column) {
      return new Error('Kolom target wajib diisi.');
    }

    return {
      customTargetNote: null,
      targetColumn: column,
      targetRow: null,
      targetTreeId: null,
      targetType: 'column',
    };
  }

  if (input.targetType === 'tree') {
    const treeId = normalizeOptionalText(input.targetTreeId);

    if (!treeId) {
      return new Error('Pohon target wajib dipilih.');
    }

    return {
      customTargetNote: null,
      targetColumn: null,
      targetRow: null,
      targetTreeId: treeId,
      targetType: 'tree',
    };
  }

  const customTargetNote = normalizeOptionalText(input.customTargetNote);

  if (!customTargetNote) {
    return new Error('Catatan target khusus wajib diisi.');
  }

  return {
    customTargetNote,
    targetColumn: null,
    targetRow: null,
    targetTreeId: null,
    targetType: 'custom',
  };
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isMissingSessionError(error: { message?: string; name?: string }): boolean {
  return (
    error.name === 'AuthSessionMissingError' ||
    error.message?.toLowerCase().includes('auth session missing') === true
  );
}
