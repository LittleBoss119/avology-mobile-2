import { supabase } from '../lib/supabase';
import type {
  CareCategory,
  CareSchedule,
  CareScheduleDetail,
  CareSOPDefaultTargetType,
  CareTask,
  CreateManualScheduleData,
  CreateManualScheduleInput,
  CreateScheduleFromSOPData,
  CreateScheduleFromSOPInput,
  GetCareScheduleDetailInput,
  GetCareSchedulesInput,
  MemberRole,
  MemberStatus,
  ServiceResult,
  SuccessData,
  TargetType,
  TaskStatus,
  UUID,
} from '../types/domain';
import { fail, ok } from '../utils/serviceResult';

const CARE_SCHEDULE_SELECT =
  'id, farm_id, care_sop_id, title, category, scheduled_date, target_type, target_row, target_column, target_tree_id, custom_target_note, instruction, created_by, created_at, updated_at';

const CARE_TASK_SELECT =
  'id, farm_id, care_schedule_id, operational_report_id, assigned_to, assigned_by, title, category, instruction, target_type, target_row, target_column, target_tree_id, custom_target_note, due_date, status, created_at, updated_at';

const careCategories: CareCategory[] = [
  'watering',
  'fertilizing',
  'spraying',
  'weeding',
  'other',
];

type CareSOPScheduleSourceRow = {
  id: string;
  farm_id: string;
  name: string;
  category: CareCategory;
  default_instruction: string | null;
  default_target_type: CareSOPDefaultTargetType;
  default_target_row: string | null;
  default_target_column: string | null;
  default_target_tree_id: string | null;
  is_active: boolean;
};

type MembershipRow = {
  role: MemberRole;
  status: MemberStatus;
};

type ActiveWorkerPickerRow = {
  user_id: string;
  full_name: string;
};

type ScheduleTaskRpcRow = {
  schedule_id: string;
  task_id: string;
};

type CareScheduleRow = {
  id: string;
  farm_id: string;
  care_sop_id: string | null;
  title: string;
  category: CareCategory;
  scheduled_date: string;
  target_type: TargetType;
  target_row: string | null;
  target_column: string | null;
  target_tree_id: string | null;
  custom_target_note: string | null;
  instruction: string | null;
  created_by?: string;
  created_at?: string;
  updated_at?: string | null;
};

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

type ScheduleInsertRow = {
  farm_id: string;
  care_sop_id: string;
  title: string;
  category: CareCategory;
  scheduled_date: string;
  target_type: CareSOPDefaultTargetType;
  target_row: string | null;
  target_column: string | null;
  target_tree_id: string | null;
  custom_target_note: null;
  instruction: string | null;
  created_by: string;
};

type TaskInsertRow = {
  farm_id: string;
  care_schedule_id: string;
  assigned_to: string;
  assigned_by: string;
  title: string;
  category: CareCategory;
  instruction: string | null;
  target_type: CareSOPDefaultTargetType;
  target_row: string | null;
  target_column: string | null;
  target_tree_id: string | null;
  custom_target_note: null;
  due_date: string;
};

type NormalizedTarget = {
  targetType: CareSOPDefaultTargetType;
  targetRow: string | null;
  targetColumn: string | null;
  targetTreeId: string | null;
};

type NormalizedManualTarget = {
  targetType: TargetType;
  targetRow: string | null;
  targetColumn: string | null;
  targetTreeId: string | null;
  customTargetNote: string | null;
};

export async function createScheduleFromSOP(
  input: CreateScheduleFromSOPInput
): Promise<ServiceResult<CreateScheduleFromSOPData>> {
  const scheduledDate = normalizeScheduleDate(input.scheduledDate);

  if (scheduledDate instanceof Error) {
    return fail(scheduledDate);
  }

  const workerIds = normalizeWorkerIds(input.assignedWorkerIds);

  if (workerIds instanceof Error) {
    return fail(workerIds);
  }

  const sopResult = await getActiveCareSOPForSchedule(input.farmId, input.sopId);

  if (sopResult.error) {
    return fail(sopResult.error);
  }

  const accessResult = await ensureActiveOwner(input.farmId);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const userIdResult = await getCurrentUserId();

  if (userIdResult.error) {
    return fail(userIdResult.error);
  }

  const workersResult = await ensureActiveWorkers(input.farmId, workerIds);

  if (workersResult.error) {
    return fail(workersResult.error);
  }

  const target = normalizeTarget({
    targetType: input.targetType ?? sopResult.data.default_target_type,
    targetRow: input.targetType ? input.targetRow : sopResult.data.default_target_row,
    targetColumn: input.targetType ? input.targetColumn : sopResult.data.default_target_column,
    targetTreeId: input.targetType ? input.targetTreeId : sopResult.data.default_target_tree_id,
  });

  if (target instanceof Error) {
    return fail(target);
  }

  const instruction =
    normalizeOptionalText(input.instruction) ?? sopResult.data.default_instruction;

  if (workerIds.length === 1) {
    return createSingleWorkerScheduleWithRpc({
      farmId: input.farmId,
      instruction,
      scheduledDate,
      sopId: input.sopId,
      target,
      workerId: workerIds[0],
    });
  }

  return createMultiWorkerScheduleWithDirectInsert({
    createdBy: userIdResult.data,
    farmId: input.farmId,
    instruction,
    scheduledDate,
    sop: sopResult.data,
    target,
    workerIds,
  });
}

export async function createManualSchedule(
  input: CreateManualScheduleInput
): Promise<ServiceResult<CreateManualScheduleData>> {
  const title = normalizeOptionalText(input.title);

  if (!title) {
    return fail(new Error('Judul jadwal wajib diisi.'));
  }

  const category = validateCareCategory(input.category);

  if (category instanceof Error) {
    return fail(category);
  }

  const scheduledDate = normalizeScheduleDate(input.scheduledDate);

  if (scheduledDate instanceof Error) {
    return fail(scheduledDate);
  }

  const workerIds = normalizeWorkerIds([input.assignedWorkerId]);

  if (workerIds instanceof Error) {
    return fail(workerIds);
  }

  const target = normalizeManualTarget({
    customTargetNote: input.customTargetNote,
    targetColumn: input.targetColumn,
    targetRow: input.targetRow,
    targetTreeId: input.targetTreeId,
    targetType: input.targetType,
  });

  if (target instanceof Error) {
    return fail(target);
  }

  const accessResult = await ensureActiveOwner(
    input.farmId,
    'Hanya pemilik aktif yang dapat membuat jadwal manual.'
  );

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const workersResult = await ensureActiveWorkers(input.farmId, workerIds);

  if (workersResult.error) {
    return fail(workersResult.error);
  }

  const { data, error } = await supabase.rpc('create_manual_schedule', {
    p_assigned_worker_id: workerIds[0],
    p_category: category,
    p_custom_target_note: target.customTargetNote,
    p_farm_id: input.farmId,
    p_instruction: normalizeOptionalText(input.instruction),
    p_scheduled_date: scheduledDate,
    p_target_column: target.targetColumn,
    p_target_row: target.targetRow,
    p_target_tree_id: target.targetTreeId,
    p_target_type: target.targetType,
    p_title: title,
  });

  if (error) {
    return fail(error, 'Gagal membuat jadwal manual dan tugas pekerja.');
  }

  const row = ((data ?? []) as ScheduleTaskRpcRow[])[0];

  if (!row?.schedule_id || !row.task_id) {
    return fail(new Error('RPC create_manual_schedule tidak mengembalikan schedule dan task.'));
  }

  return ok({
    scheduleId: row.schedule_id,
    taskId: row.task_id,
  });
}

export async function getCareSchedules(
  input: GetCareSchedulesInput
): Promise<ServiceResult<CareSchedule[]>> {
  const accessResult = await ensureActiveOwner(
    input.farmId,
    'Hanya pemilik aktif yang dapat melihat jadwal perawatan.'
  );

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const { data, error } = await supabase
    .from('care_schedules')
    .select(CARE_SCHEDULE_SELECT)
    .eq('farm_id', input.farmId)
    .order('scheduled_date', { ascending: false })
    .order('created_at', { ascending: false })
    .returns<CareScheduleRow[]>();

  if (error) {
    return fail(error, 'Gagal memuat daftar jadwal perawatan.');
  }

  return ok((data ?? []).map(mapCareSchedule));
}

export async function getCareScheduleDetail(
  input: GetCareScheduleDetailInput
): Promise<ServiceResult<CareScheduleDetail>> {
  const scheduleResult = await supabase
    .from('care_schedules')
    .select(CARE_SCHEDULE_SELECT)
    .eq('id', input.scheduleId)
    .maybeSingle<CareScheduleRow>();

  if (scheduleResult.error) {
    return fail(scheduleResult.error, 'Gagal memuat detail jadwal perawatan.');
  }

  if (!scheduleResult.data) {
    return fail(new Error('Jadwal perawatan tidak ditemukan atau tidak dapat diakses.'));
  }

  const accessResult = await ensureActiveOwner(
    scheduleResult.data.farm_id,
    'Hanya pemilik aktif yang dapat melihat jadwal perawatan.'
  );

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const tasksResult = await supabase
    .from('care_tasks')
    .select(CARE_TASK_SELECT)
    .eq('care_schedule_id', input.scheduleId)
    .order('due_date', { ascending: true })
    .order('created_at', { ascending: true })
    .returns<CareTaskRow[]>();

  if (tasksResult.error) {
    return fail(tasksResult.error, 'Gagal memuat tugas dari jadwal.');
  }

  return ok({
    ...mapCareSchedule(scheduleResult.data),
    tasks: (tasksResult.data ?? []).map(mapCareTask),
  });
}

async function createSingleWorkerScheduleWithRpc(input: {
  farmId: UUID;
  instruction: string | null;
  scheduledDate: string;
  sopId: UUID;
  target: NormalizedTarget;
  workerId: UUID;
}): Promise<ServiceResult<CreateScheduleFromSOPData>> {
  const { data, error } = await supabase.rpc('create_schedule_from_sop', {
    p_assigned_worker_id: input.workerId,
    p_care_sop_id: input.sopId,
    p_farm_id: input.farmId,
    p_instruction: input.instruction,
    p_scheduled_date: input.scheduledDate,
    p_target_column: input.target.targetColumn,
    p_target_row: input.target.targetRow,
    p_target_tree_id: input.target.targetTreeId,
    p_target_type: input.target.targetType,
  });

  if (error) {
    return fail(error, 'Gagal membuat jadwal dan tugas dari SOP.');
  }

  const row = ((data ?? []) as ScheduleTaskRpcRow[])[0];

  if (!row?.schedule_id || !row.task_id) {
    return fail(new Error('RPC create_schedule_from_sop tidak mengembalikan schedule dan task.'));
  }

  return ok({
    scheduleId: row.schedule_id,
    taskIds: [row.task_id],
  });
}

async function createMultiWorkerScheduleWithDirectInsert(input: {
  createdBy: UUID;
  farmId: UUID;
  instruction: string | null;
  scheduledDate: string;
  sop: CareSOPScheduleSourceRow;
  target: NormalizedTarget;
  workerIds: UUID[];
}): Promise<ServiceResult<CreateScheduleFromSOPData>> {
  const scheduleRow: ScheduleInsertRow = {
    care_sop_id: input.sop.id,
    category: input.sop.category,
    created_by: input.createdBy,
    custom_target_note: null,
    farm_id: input.farmId,
    instruction: input.instruction,
    scheduled_date: input.scheduledDate,
    target_column: input.target.targetColumn,
    target_row: input.target.targetRow,
    target_tree_id: input.target.targetTreeId,
    target_type: input.target.targetType,
    title: input.sop.name,
  };

  const scheduleResult = await supabase
    .from('care_schedules')
    .insert(scheduleRow)
    .select('id')
    .single<{ id: string }>();

  if (scheduleResult.error) {
    return fail(scheduleResult.error, 'Gagal membuat jadwal dari SOP.');
  }

  const taskRows: TaskInsertRow[] = input.workerIds.map((workerId) => ({
    assigned_by: input.createdBy,
    assigned_to: workerId,
    care_schedule_id: scheduleResult.data.id,
    category: input.sop.category,
    custom_target_note: null,
    due_date: input.scheduledDate,
    farm_id: input.farmId,
    instruction: input.instruction,
    target_column: input.target.targetColumn,
    target_row: input.target.targetRow,
    target_tree_id: input.target.targetTreeId,
    target_type: input.target.targetType,
    title: input.sop.name,
  }));

  const tasksResult = await supabase
    .from('care_tasks')
    .insert(taskRows)
    .select('id')
    .returns<Array<{ id: string }>>();

  if (tasksResult.error) {
    return fail(
      tasksResult.error,
      'Jadwal berhasil dibuat, tetapi tugas pekerja gagal dibuat. Periksa data jadwal sebelum mencoba lagi.'
    );
  }

  const taskIds = (tasksResult.data ?? []).map((row) => row.id);

  if (taskIds.length !== input.workerIds.length) {
    return fail(new Error('Jumlah tugas yang dibuat tidak sesuai jumlah pekerja yang dipilih.'));
  }

  return ok({
    scheduleId: scheduleResult.data.id,
    taskIds,
  });
}

async function getActiveCareSOPForSchedule(
  farmId: UUID,
  sopId: UUID
): Promise<ServiceResult<CareSOPScheduleSourceRow>> {
  const { data, error } = await supabase
    .from('care_sops')
    .select(
      'id, farm_id, name, category, default_instruction, default_target_type, default_target_row, default_target_column, default_target_tree_id, is_active'
    )
    .eq('id', sopId)
    .eq('farm_id', farmId)
    .maybeSingle<CareSOPScheduleSourceRow>();

  if (error) {
    return fail(error, 'Gagal memuat SOP untuk jadwal.');
  }

  if (!data) {
    return fail(new Error('SOP tidak ditemukan pada kebun aktif.'));
  }

  if (!data.is_active) {
    return fail(new Error('SOP nonaktif tidak dapat digunakan untuk membuat jadwal.'));
  }

  return ok(data);
}

async function ensureActiveOwner(
  farmId: UUID,
  forbiddenMessage = 'Hanya pemilik aktif yang dapat membuat jadwal dari SOP.'
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

function validateCareCategory(category: CareCategory | undefined | null): CareCategory | Error {
  if (!category) {
    return new Error('Kategori jadwal wajib dipilih.');
  }

  if (!careCategories.includes(category)) {
    return new Error('Kategori jadwal tidak valid.');
  }

  return category;
}

async function ensureActiveWorkers(
  farmId: UUID,
  workerIds: UUID[]
): Promise<ServiceResult<SuccessData>> {
  const { data, error } = await supabase.rpc('get_active_workers_for_task_picker', {
    p_farm_id: farmId,
  });

  if (error) {
    return fail(error, 'Gagal memuat pekerja aktif.');
  }

  const activeWorkerIds = new Set(
    ((data ?? []) as ActiveWorkerPickerRow[]).map((worker) => worker.user_id)
  );
  const invalidWorkerIds = workerIds.filter((workerId) => !activeWorkerIds.has(workerId));

  if (invalidWorkerIds.length > 0) {
    return fail(new Error('Tugas hanya dapat diberikan kepada pekerja aktif pada kebun ini.'));
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

function normalizeWorkerIds(workerIds: UUID[]): UUID[] | Error {
  const uniqueWorkerIds = Array.from(
    new Set(workerIds.map((workerId) => workerId.trim()).filter(Boolean))
  );

  if (uniqueWorkerIds.length === 0) {
    return new Error('Pilih minimal satu pekerja aktif.');
  }

  return uniqueWorkerIds;
}

function normalizeScheduleDate(value: string): string | Error {
  const normalized = value.trim();

  if (!normalized) {
    return new Error('Tanggal jadwal wajib diisi.');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return new Error('Tanggal jadwal harus memakai format YYYY-MM-DD.');
  }

  const date = new Date(`${normalized}T00:00:00`);

  if (Number.isNaN(date.getTime()) || toLocalIsoDate(date) !== normalized) {
    return new Error('Tanggal jadwal tidak valid.');
  }

  return normalized;
}

function normalizeTarget(input: {
  targetType: CareSOPDefaultTargetType | string | null | undefined;
  targetRow?: string | null;
  targetColumn?: string | null;
  targetTreeId?: string | null;
}): NormalizedTarget | Error {
  if (!input.targetType) {
    return new Error('Target jadwal wajib dipilih.');
  }

  if (input.targetType === 'custom') {
    return new Error('Jadwal dari SOP tidak boleh memakai target khusus.');
  }

  if (!['farm', 'row', 'column', 'tree'].includes(input.targetType)) {
    return new Error('Target jadwal tidak valid.');
  }

  if (input.targetType === 'farm') {
    return {
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
      targetColumn: column,
      targetRow: null,
      targetTreeId: null,
      targetType: 'column',
    };
  }

  const treeId = normalizeOptionalText(input.targetTreeId);

  if (!treeId) {
    return new Error('Pohon target wajib dipilih.');
  }

  return {
    targetColumn: null,
    targetRow: null,
    targetTreeId: treeId,
    targetType: 'tree',
  };
}

function normalizeManualTarget(input: {
  targetType: TargetType | string | null | undefined;
  targetRow?: string | null;
  targetColumn?: string | null;
  targetTreeId?: string | null;
  customTargetNote?: string | null;
}): NormalizedManualTarget | Error {
  if (!input.targetType) {
    return new Error('Target jadwal wajib dipilih.');
  }

  if (!['farm', 'row', 'column', 'tree', 'custom'].includes(input.targetType)) {
    return new Error('Target jadwal tidak valid.');
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

function mapCareSchedule(row: CareScheduleRow): CareSchedule {
  return {
    careSopId: row.care_sop_id,
    category: row.category,
    createdAt: row.created_at,
    createdBy: row.created_by,
    customTargetNote: row.custom_target_note,
    farmId: row.farm_id,
    id: row.id,
    instruction: row.instruction,
    scheduledDate: row.scheduled_date,
    targetColumn: row.target_column,
    targetRow: row.target_row,
    targetTreeId: row.target_tree_id,
    targetType: row.target_type,
    title: row.title,
    updatedAt: row.updated_at,
  };
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
