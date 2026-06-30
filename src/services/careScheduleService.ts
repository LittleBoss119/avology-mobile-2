import { supabase } from '../lib/supabase';
import type {
  CareCategory,
  CareSchedule,
  CareScheduleDetail,
  CareSOPDefaultTargetType,
  CareTask,
  CancelCareScheduleData,
  CancelCareScheduleInput,
  CreateManualScheduleData,
  CreateManualScheduleInput,
  CreateScheduleFromSOPData,
  CreateScheduleFromSOPInput,
  GetCareScheduleDetailInput,
  GetCareSchedulesInput,
  GetScheduleEditEligibilityInput,
  MemberRole,
  MemberStatus,
  ScheduleEditEligibility,
  ServiceResult,
  SuccessData,
  TargetType,
  TaskStatus,
  UpdateCareScheduleInput,
  UUID,
} from '../types/domain';
import { fail, ok } from '../utils/serviceResult';

const CARE_SCHEDULE_SELECT =
  'id, farm_id, care_sop_id, title, category, scheduled_date, target_type, target_row, target_column, target_tree_id, custom_target_note, instruction, requires_photo, is_cancelled, cancelled_at, cancelled_by, cancel_reason, created_by, created_at, updated_at';

const CARE_TASK_SELECT =
  'id, farm_id, care_schedule_id, operational_report_id, assigned_to, assigned_by, title, category, instruction, target_type, target_row, target_column, target_tree_id, custom_target_note, due_date, status, requires_photo, created_at, updated_at';

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
  requires_photo: boolean | null;
  is_cancelled?: boolean | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancel_reason?: string | null;
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
  requires_photo: boolean | null;
  created_at?: string;
  updated_at?: string | null;
};

type CareActivityIdRow = {
  id: string;
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

type EditableScheduleUpdate = {
  assignedWorkerId: UUID;
  category: CareCategory;
  customTargetNote: string | null;
  instruction: string | null;
  requiresPhoto: boolean;
  scheduledDate: string;
  targetColumn: string | null;
  targetRow: string | null;
  targetTreeId: string | null;
  targetType: TargetType;
  title: string;
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

  if (workerIds.length !== 1) {
    return fail(new Error('Pilih satu pekerja aktif untuk membuat jadwal dari SOP.'));
  }

  const sopResult = await getActiveCareSOPForSchedule(input.farmId, input.sopId);

  if (sopResult.error) {
    return fail(sopResult.error);
  }

  const accessResult = await ensureActiveOwner(input.farmId);

  if (accessResult.error) {
    return fail(accessResult.error);
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

  return createSingleWorkerScheduleWithRpc({
    farmId: input.farmId,
    instruction,
    requiresPhoto: input.requiresPhoto ?? false,
    scheduledDate,
    sopId: input.sopId,
    target,
    workerId: workerIds[0],
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
    p_requires_photo: input.requiresPhoto ?? false,
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

export async function cancelCareSchedule(
  input: CancelCareScheduleInput
): Promise<ServiceResult<CancelCareScheduleData>> {
  const scheduleId = normalizeOptionalText(input.scheduleId);

  if (!scheduleId) {
    return fail(new Error('Jadwal perawatan tidak ditemukan.'));
  }

  const { error } = await supabase.rpc('cancel_care_schedule', {
    p_reason: normalizeOptionalText(input.reason),
    p_schedule_id: scheduleId,
  });

  if (error) {
    return fail(new Error(mapCancelScheduleError(error)));
  }

  return ok({
    success: true,
  });
}

export async function getScheduleEditEligibility(
  input: GetScheduleEditEligibilityInput
): Promise<ServiceResult<ScheduleEditEligibility>> {
  const scheduleResult = await getCareScheduleDetail({
    scheduleId: input.scheduleId,
  });

  if (scheduleResult.error) {
    return fail(scheduleResult.error);
  }

  return getScheduleEditEligibilityFromDetail(scheduleResult.data);
}

export async function updateCareSchedule(
  input: UpdateCareScheduleInput
): Promise<ServiceResult<SuccessData>> {
  const scheduleResult = await getCareScheduleDetail({
    scheduleId: input.scheduleId,
  });

  if (scheduleResult.error) {
    return fail(scheduleResult.error);
  }

  const schedule = scheduleResult.data;
  const eligibilityResult = await getScheduleEditEligibilityFromDetail(schedule);

  if (eligibilityResult.error) {
    return fail(eligibilityResult.error);
  }

  if (!eligibilityResult.data.canEdit) {
    return fail(new Error(eligibilityResult.data.reason ?? 'Jadwal ini tidak bisa diedit.'));
  }

  const normalized = normalizeScheduleUpdateInput(input);

  if (normalized instanceof Error) {
    return fail(normalized);
  }

  const workersResult = await ensureActiveWorkers(schedule.farmId, [normalized.assignedWorkerId]);

  if (workersResult.error) {
    return fail(workersResult.error);
  }

  const now = new Date().toISOString();
  const scheduleUpdate = {
    category: normalized.category,
    custom_target_note: normalized.customTargetNote,
    instruction: normalized.instruction,
    requires_photo: normalized.requiresPhoto,
    scheduled_date: normalized.scheduledDate,
    target_column: normalized.targetColumn,
    target_row: normalized.targetRow,
    target_tree_id: normalized.targetTreeId,
    target_type: normalized.targetType,
    title: normalized.title,
    updated_at: now,
  };

  const scheduleUpdateResult = await supabase
    .from('care_schedules')
    .update(scheduleUpdate)
    .eq('id', schedule.id);

  if (scheduleUpdateResult.error) {
    return fail(scheduleUpdateResult.error, 'Gagal memperbarui jadwal perawatan.');
  }

  if (schedule.tasks.length > 0) {
    const taskIds = schedule.tasks.map((task) => task.id);
    const taskUpdateResult = await supabase
      .from('care_tasks')
      .update({
        assigned_to: normalized.assignedWorkerId,
        category: normalized.category,
        custom_target_note: normalized.customTargetNote,
        due_date: normalized.scheduledDate,
        instruction: normalized.instruction,
        requires_photo: normalized.requiresPhoto,
        target_column: normalized.targetColumn,
        target_row: normalized.targetRow,
        target_tree_id: normalized.targetTreeId,
        target_type: normalized.targetType,
        title: normalized.title,
        updated_at: now,
      })
      .in('id', taskIds);

    if (taskUpdateResult.error) {
      return fail(taskUpdateResult.error, 'Jadwal diperbarui, tetapi tugas pekerja belum dapat disinkronkan.');
    }
  }

  return ok({
    success: true,
  });
}

async function createSingleWorkerScheduleWithRpc(input: {
  farmId: UUID;
  instruction: string | null;
  requiresPhoto: boolean;
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
    p_requires_photo: input.requiresPhoto,
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

async function getScheduleEditEligibilityFromDetail(
  schedule: CareScheduleDetail
): Promise<ServiceResult<ScheduleEditEligibility>> {
  const accessResult = await ensureActiveOwner(
    schedule.farmId,
    'Hanya owner aktif yang dapat mengubah jadwal.'
  );

  if (accessResult.error) {
    return ok({
      canEdit: false,
      reason: accessResult.error.message,
    });
  }

  if (schedule.isCancelled) {
    return ok({
      canEdit: false,
      reason: 'Jadwal yang sudah dibatalkan tidak bisa diedit.',
    });
  }

  const taskIds = schedule.tasks.map((task) => task.id);

  if (taskIds.length === 0) {
    return ok({
      canEdit: true,
      reason: null,
    });
  }

  const { data, error } = await supabase
    .from('care_activities')
    .select('id')
    .in('care_task_id', taskIds)
    .limit(1)
    .returns<CareActivityIdRow[]>();

  if (error) {
    return fail(error, 'Gagal memeriksa realisasi tugas jadwal.');
  }

  if ((data ?? []).length > 0) {
    return ok({
      canEdit: false,
      reason: 'Jadwal ini sudah memiliki realisasi tugas, jadi tidak bisa diedit.',
    });
  }

  return ok({
    canEdit: true,
    reason: null,
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

function normalizeScheduleUpdateInput(input: UpdateCareScheduleInput): EditableScheduleUpdate | Error {
  const title = normalizeOptionalText(input.title);

  if (!title) {
    return new Error('Judul jadwal wajib diisi.');
  }

  const category = validateCareCategory(input.category);

  if (category instanceof Error) {
    return category;
  }

  const scheduledDate = normalizeScheduleDate(input.scheduledDate);

  if (scheduledDate instanceof Error) {
    return scheduledDate;
  }

  const workerIds = normalizeWorkerIds([input.assignedWorkerId]);

  if (workerIds instanceof Error) {
    return workerIds;
  }

  const target = normalizeManualTarget({
    customTargetNote: input.customTargetNote,
    targetColumn: input.targetColumn,
    targetRow: input.targetRow,
    targetTreeId: input.targetTreeId,
    targetType: input.targetType,
  });

  if (target instanceof Error) {
    return target;
  }

  return {
    assignedWorkerId: workerIds[0],
    category,
    customTargetNote: target.customTargetNote,
    instruction: normalizeOptionalText(input.instruction),
    requiresPhoto: input.requiresPhoto ?? false,
    scheduledDate,
    targetColumn: target.targetColumn,
    targetRow: target.targetRow,
    targetTreeId: target.targetTreeId,
    targetType: target.targetType,
    title,
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
    isCancelled: row.is_cancelled ?? false,
    requiresPhoto: row.requires_photo ?? false,
    scheduledDate: row.scheduled_date,
    cancelledAt: row.cancelled_at,
    cancelledBy: row.cancelled_by,
    cancelReason: row.cancel_reason,
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
    requiresPhoto: row.requires_photo ?? false,
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

function mapCancelScheduleError(error: { message?: string }): string {
  const message = error.message?.toLowerCase() ?? '';

  if (message.includes('already cancelled')) {
    return 'Jadwal ini sudah dibatalkan.';
  }

  if (message.includes('task realization exists')) {
    return 'Jadwal tidak dapat dibatalkan karena sudah ada realisasi tugas.';
  }

  if (message.includes('only active owners')) {
    return 'Hanya pemilik aktif yang dapat membatalkan jadwal.';
  }

  if (message.includes('not found')) {
    return 'Jadwal perawatan tidak ditemukan atau tidak dapat diakses.';
  }

  return 'Gagal membatalkan jadwal perawatan.';
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
