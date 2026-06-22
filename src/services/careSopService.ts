import { supabase } from '../lib/supabase';
import type {
  CareCategory,
  CareSOP,
  CareSOPDefaultTargetType,
  CareSOPNextScheduleReference,
  CreateCareSOPData,
  CreateCareSOPInput,
  GetCareSOPDetailInput,
  GetCareSOPNextScheduleReferenceInput,
  GetCareSOPsInput,
  MemberRole,
  MemberStatus,
  ServiceResult,
  SetCareSOPActiveStatusInput,
  SuccessData,
  UpdateCareSOPInput,
  UUID,
} from '../types/domain';
import { fail, ok } from '../utils/serviceResult';

const CARE_SOP_SELECT =
  'id, farm_id, name, category, interval_days, default_instruction, default_target_type, default_target_row, default_target_column, default_target_tree_id, is_active, created_by, created_at, updated_at';

const careCategories: CareCategory[] = [
  'watering',
  'fertilizing',
  'spraying',
  'weeding',
  'other',
];

const careSopTargetTypes: CareSOPDefaultTargetType[] = [
  'farm',
  'row',
  'column',
  'tree',
];

type CareSOPRow = {
  id: string;
  farm_id: string;
  name: string;
  category: CareCategory;
  interval_days: number | null;
  default_instruction: string | null;
  default_target_type: CareSOPDefaultTargetType;
  default_target_row: string | null;
  default_target_column: string | null;
  default_target_tree_id: string | null;
  is_active: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string | null;
};

type CareSOPInsertRow = {
  farm_id: string;
  name: string;
  category: CareCategory;
  interval_days: number | null;
  default_instruction: string | null;
  default_target_type: CareSOPDefaultTargetType;
  default_target_row: string | null;
  default_target_column: string | null;
  default_target_tree_id: string | null;
  created_by: string;
};

type CareSOPUpdateRow = Partial<{
  name: string;
  category: CareCategory;
  interval_days: number | null;
  default_instruction: string | null;
  default_target_type: CareSOPDefaultTargetType;
  default_target_row: string | null;
  default_target_column: string | null;
  default_target_tree_id: string | null;
  is_active: boolean;
}>;

type MembershipRow = {
  role: MemberRole;
  status: MemberStatus;
};

type IdRow = {
  id: string;
};

type ActivityRow = {
  performed_at: string;
};

type NormalizedTarget = {
  defaultTargetType: CareSOPDefaultTargetType;
  defaultTargetRow: string | null;
  defaultTargetColumn: string | null;
  defaultTargetTreeId: UUID | null;
};

export async function getCareSOPs(
  input: GetCareSOPsInput
): Promise<ServiceResult<CareSOP[]>> {
  let query = supabase.from('care_sops').select(CARE_SOP_SELECT).eq('farm_id', input.farmId);

  if (input.activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query
    .order('is_active', { ascending: false })
    .order('name', { ascending: true })
    .returns<CareSOPRow[]>();

  if (error) {
    return fail(error, 'Gagal memuat daftar SOP perawatan.');
  }

  return ok((data ?? []).map(mapCareSOP));
}

export async function getCareSOPDetail(
  input: GetCareSOPDetailInput
): Promise<ServiceResult<CareSOP>> {
  return getAccessibleCareSOP(input.sopId);
}

export async function createCareSOP(
  input: CreateCareSOPInput
): Promise<ServiceResult<CreateCareSOPData>> {
  const normalized = validateCreateInput(input);

  if (normalized instanceof Error) {
    return fail(normalized);
  }

  const accessResult = await ensureActiveOwner(input.farmId);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const userIdResult = await getCurrentUserId();

  if (userIdResult.error) {
    return fail(userIdResult.error);
  }

  const insertRow: CareSOPInsertRow = {
    farm_id: input.farmId,
    name: normalized.name,
    category: normalized.category,
    interval_days: normalized.intervalDays,
    default_instruction: normalized.defaultInstruction,
    default_target_type: normalized.target.defaultTargetType,
    default_target_row: normalized.target.defaultTargetRow,
    default_target_column: normalized.target.defaultTargetColumn,
    default_target_tree_id: normalized.target.defaultTargetTreeId,
    created_by: userIdResult.data,
  };

  const { data, error } = await supabase
    .from('care_sops')
    .insert(insertRow)
    .select('id')
    .single<{ id: string }>();

  if (error) {
    return fail(error, 'Gagal membuat SOP perawatan.');
  }

  return ok({
    sopId: data.id,
  });
}

export async function updateCareSOP(
  input: UpdateCareSOPInput
): Promise<ServiceResult<SuccessData>> {
  const sopResult = await getAccessibleCareSOP(input.sopId);

  if (sopResult.error) {
    return fail(sopResult.error);
  }

  const accessResult = await ensureActiveOwner(sopResult.data.farmId);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const updates = validateUpdateInput(input, sopResult.data);

  if (updates instanceof Error) {
    return fail(updates);
  }

  if (Object.keys(updates).length === 0) {
    return ok({
      success: true,
    });
  }

  const { error } = await supabase.from('care_sops').update(updates).eq('id', input.sopId);

  if (error) {
    return fail(error, 'Gagal memperbarui SOP perawatan.');
  }

  return ok({
    success: true,
  });
}

export async function setCareSOPActiveStatus(
  input: SetCareSOPActiveStatusInput
): Promise<ServiceResult<SuccessData>> {
  const sopResult = await getAccessibleCareSOP(input.sopId);

  if (sopResult.error) {
    return fail(sopResult.error);
  }

  const accessResult = await ensureActiveOwner(sopResult.data.farmId);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const { error } = await supabase
    .from('care_sops')
    .update({ is_active: input.isActive })
    .eq('id', input.sopId);

  if (error) {
    return fail(
      error,
      input.isActive
        ? 'Gagal mengaktifkan SOP perawatan.'
        : 'Gagal menonaktifkan SOP perawatan.'
    );
  }

  return ok({
    success: true,
  });
}

export async function getCareSOPNextScheduleReference(
  input: GetCareSOPNextScheduleReferenceInput
): Promise<ServiceResult<CareSOPNextScheduleReference>> {
  const sopResult = await getAccessibleCareSOP(input.sopId);

  if (sopResult.error) {
    return fail(sopResult.error);
  }

  const lastPerformedAtResult = await getLastCompletedActivityAt(input.sopId);

  if (lastPerformedAtResult.error) {
    return fail(lastPerformedAtResult.error);
  }

  const lastPerformedAt = lastPerformedAtResult.data;
  const intervalDays = sopResult.data.intervalDays;

  if (!lastPerformedAt) {
    return ok({
      sopId: input.sopId,
      intervalDays,
      lastPerformedAt: null,
      nextDueDate: null,
      status: 'no_history',
    });
  }

  if (!intervalDays || intervalDays <= 0) {
    return ok({
      sopId: input.sopId,
      intervalDays,
      lastPerformedAt,
      nextDueDate: null,
      status: 'no_interval',
    });
  }

  const nextDueDate = addDaysAsIsoDate(lastPerformedAt, intervalDays);
  const today = toLocalIsoDate(new Date());
  const overdueDays = daysBetween(nextDueDate, today);
  const status =
    nextDueDate > today ? 'upcoming' : nextDueDate === today ? 'due_today' : 'overdue';

  return ok({
    sopId: input.sopId,
    intervalDays,
    lastPerformedAt,
    nextDueDate,
    status,
    ...(status === 'overdue' ? { overdueDays } : {}),
  });
}

async function getAccessibleCareSOP(sopId: UUID): Promise<ServiceResult<CareSOP>> {
  const { data, error } = await supabase
    .from('care_sops')
    .select(CARE_SOP_SELECT)
    .eq('id', sopId)
    .maybeSingle<CareSOPRow>();

  if (error) {
    return fail(error, 'Gagal memuat SOP perawatan.');
  }

  if (!data) {
    return fail(new Error('SOP perawatan tidak ditemukan atau tidak dapat diakses.'));
  }

  return ok(mapCareSOP(data));
}

async function getLastCompletedActivityAt(
  sopId: UUID
): Promise<ServiceResult<string | null>> {
  const schedulesResult = await supabase
    .from('care_schedules')
    .select('id')
    .eq('care_sop_id', sopId)
    .returns<IdRow[]>();

  if (schedulesResult.error) {
    return fail(schedulesResult.error, 'Gagal memeriksa jadwal dari SOP.');
  }

  const scheduleIds = (schedulesResult.data ?? []).map((row) => row.id);

  if (scheduleIds.length === 0) {
    return ok(null);
  }

  const tasksResult = await supabase
    .from('care_tasks')
    .select('id')
    .in('care_schedule_id', scheduleIds)
    .returns<IdRow[]>();

  if (tasksResult.error) {
    return fail(tasksResult.error, 'Gagal memeriksa task dari SOP.');
  }

  const taskIds = (tasksResult.data ?? []).map((row) => row.id);

  if (taskIds.length === 0) {
    return ok(null);
  }

  const { data, error } = await supabase
    .from('care_activities')
    .select('performed_at')
    .in('care_task_id', taskIds)
    .eq('status', 'completed')
    .order('performed_at', { ascending: false })
    .limit(1)
    .maybeSingle<ActivityRow>();

  if (error) {
    return fail(error, 'Gagal memuat realisasi terakhir SOP.');
  }

  return ok(data?.performed_at ?? null);
}

async function ensureActiveOwner(farmId: UUID): Promise<ServiceResult<SuccessData>> {
  const membershipResult = await getCurrentUserMembership(farmId);

  if (membershipResult.error) {
    return fail(membershipResult.error);
  }

  if (membershipResult.data?.role !== 'owner' || membershipResult.data.status !== 'active') {
    return fail(new Error('Hanya pemilik aktif yang dapat mengelola SOP perawatan.'));
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

function validateCreateInput(input: CreateCareSOPInput):
  | {
      name: string;
      category: CareCategory;
      intervalDays: number | null;
      defaultInstruction: string | null;
      target: NormalizedTarget;
    }
  | Error {
  const name = normalizeOptionalText(input.name);

  if (!name) {
    return new Error('Nama SOP wajib diisi.');
  }

  const category = validateCategory(input.category);

  if (category instanceof Error) {
    return category;
  }

  const intervalDays = normalizeIntervalDays(input.intervalDays);

  if (intervalDays instanceof Error) {
    return intervalDays;
  }

  const target = normalizeTarget({
    defaultTargetType: input.defaultTargetType ?? 'farm',
    defaultTargetRow: input.defaultTargetRow,
    defaultTargetColumn: input.defaultTargetColumn,
    defaultTargetTreeId: input.defaultTargetTreeId,
  });

  if (target instanceof Error) {
    return target;
  }

  return {
    name,
    category,
    intervalDays,
    defaultInstruction: normalizeOptionalText(input.defaultInstruction),
    target,
  };
}

function validateUpdateInput(
  input: UpdateCareSOPInput,
  current: CareSOP
): CareSOPUpdateRow | Error {
  const updates: CareSOPUpdateRow = {};

  if (input.name !== undefined) {
    const name = normalizeOptionalText(input.name);

    if (!name) {
      return new Error('Nama SOP wajib diisi.');
    }

    updates.name = name;
  }

  if (input.category !== undefined) {
    const category = validateCategory(input.category);

    if (category instanceof Error) {
      return category;
    }

    updates.category = category;
  }

  if (input.intervalDays !== undefined) {
    const intervalDays = normalizeIntervalDays(input.intervalDays);

    if (intervalDays instanceof Error) {
      return intervalDays;
    }

    updates.interval_days = intervalDays;
  }

  if (input.defaultInstruction !== undefined) {
    updates.default_instruction = normalizeOptionalText(input.defaultInstruction);
  }

  if (hasTargetInput(input)) {
    const target = normalizeTarget({
      defaultTargetType: input.defaultTargetType ?? current.defaultTargetType,
      defaultTargetRow:
        input.defaultTargetRow !== undefined
          ? input.defaultTargetRow
          : current.defaultTargetRow,
      defaultTargetColumn:
        input.defaultTargetColumn !== undefined
          ? input.defaultTargetColumn
          : current.defaultTargetColumn,
      defaultTargetTreeId:
        input.defaultTargetTreeId !== undefined
          ? input.defaultTargetTreeId
          : current.defaultTargetTreeId,
    });

    if (target instanceof Error) {
      return target;
    }

    updates.default_target_type = target.defaultTargetType;
    updates.default_target_row = target.defaultTargetRow;
    updates.default_target_column = target.defaultTargetColumn;
    updates.default_target_tree_id = target.defaultTargetTreeId;
  }

  return updates;
}

function validateCategory(category: CareCategory | undefined | null): CareCategory | Error {
  if (!category) {
    return new Error('Kategori SOP wajib dipilih.');
  }

  if (!careCategories.includes(category)) {
    return new Error('Kategori SOP tidak valid.');
  }

  return category;
}

function normalizeTarget(input: {
  defaultTargetType: CareSOPDefaultTargetType | string | null | undefined;
  defaultTargetRow?: string | null;
  defaultTargetColumn?: string | null;
  defaultTargetTreeId?: string | null;
}): NormalizedTarget | Error {
  const targetType = input.defaultTargetType;

  if (!targetType) {
    return new Error('Target bawaan SOP wajib dipilih.');
  }

  if (targetType === 'custom') {
    return new Error('Target khusus tidak boleh digunakan pada SOP perawatan.');
  }

  if (!careSopTargetTypes.includes(targetType as CareSOPDefaultTargetType)) {
    return new Error('Target bawaan SOP tidak valid.');
  }

  if (targetType === 'farm') {
    return {
      defaultTargetType: 'farm',
      defaultTargetRow: null,
      defaultTargetColumn: null,
      defaultTargetTreeId: null,
    };
  }

  if (targetType === 'row') {
    const row = normalizeOptionalText(input.defaultTargetRow);

    if (!row) {
      return new Error('Baris target wajib diisi untuk target SOP per baris.');
    }

    return {
      defaultTargetType: 'row',
      defaultTargetRow: row,
      defaultTargetColumn: null,
      defaultTargetTreeId: null,
    };
  }

  if (targetType === 'column') {
    const column = normalizeOptionalText(input.defaultTargetColumn);

    if (!column) {
      return new Error('Kolom target wajib diisi untuk target SOP per kolom.');
    }

    return {
      defaultTargetType: 'column',
      defaultTargetRow: null,
      defaultTargetColumn: column,
      defaultTargetTreeId: null,
    };
  }

  const treeId = normalizeOptionalText(input.defaultTargetTreeId);

  if (!treeId) {
    return new Error('Pohon target wajib dipilih untuk target SOP per pohon.');
  }

  return {
    defaultTargetType: 'tree',
    defaultTargetRow: null,
    defaultTargetColumn: null,
    defaultTargetTreeId: treeId,
  };
}

function normalizeIntervalDays(value: number | null | undefined): number | null | Error {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    return new Error('Interval perawatan SOP harus berupa angka bulat lebih dari 0 hari.');
  }

  return value;
}

function hasTargetInput(input: UpdateCareSOPInput): boolean {
  return (
    input.defaultTargetType !== undefined ||
    input.defaultTargetRow !== undefined ||
    input.defaultTargetColumn !== undefined ||
    input.defaultTargetTreeId !== undefined
  );
}

function mapCareSOP(row: CareSOPRow): CareSOP {
  return {
    id: row.id,
    farmId: row.farm_id,
    name: row.name,
    category: row.category,
    intervalDays: row.interval_days,
    defaultInstruction: row.default_instruction,
    defaultTargetType: row.default_target_type,
    defaultTargetRow: row.default_target_row,
    defaultTargetColumn: row.default_target_column,
    defaultTargetTreeId: row.default_target_tree_id,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function addDaysAsIsoDate(value: string, days: number): string {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return toLocalIsoDate(date);
}

function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysBetween(startIsoDate: string, endIsoDate: string): number {
  const start = isoDateToUtcTime(startIsoDate);
  const end = isoDateToUtcTime(endIsoDate);
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

function isoDateToUtcTime(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function isMissingSessionError(error: { message?: string; name?: string }): boolean {
  return (
    error.name === 'AuthSessionMissingError' ||
    error.message?.toLowerCase().includes('auth session missing') === true
  );
}
