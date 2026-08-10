import { supabase } from '../lib/supabase';
import type {
  AssignWorkerToScheduleData,
  AssignWorkerToScheduleInput,
  CareCategory,
  CareSchedule,
  CareScheduleDetail,
  CareTask,
  CancelCareScheduleData,
  CancelCareScheduleInput,
  CreateManualScheduleData,
  CreateManualScheduleInput,
  GetCareScheduleDetailInput,
  GetCareSchedulesWithTasksInput,
  GetScheduleEditEligibilityInput,
  MemberRole,
  MemberStatus,
  ScheduleEditEligibility,
  ServiceResult,
  StopScheduleRepeatData,
  StopScheduleRepeatInput,
  SuccessData,
  TargetType,
  TaskStatus,
  UpdateCareScheduleInput,
  UUID,
} from '../types/domain';
import { fail, ok } from '../utils/serviceResult';

const CARE_SCHEDULE_SELECT =
  'id, farm_id, care_sop_id, title, category, scheduled_date, target_type, target_row, target_column, target_tree_id, custom_target_note, instruction, requires_photo, is_cancelled, cancelled_at, cancelled_by, cancel_reason, repeat_every_days, series_id, parent_schedule_id, created_by, created_at, updated_at';

// Batas id per query .in(). PostgREST menaruh seluruh daftar id di query string,
// jadi satu .in() dengan ratusan uuid membuat URL melewati batas panjang server.
const SCHEDULE_TASK_BATCH_SIZE = 100;

const CARE_TASK_SELECT =
  'id, farm_id, care_schedule_id, operational_report_id, assigned_to, assigned_by, title, category, instruction, target_type, target_row, target_column, target_tree_id, custom_target_note, due_date, status, requires_photo, created_at, updated_at';

const careCategories: CareCategory[] = [
  'watering',
  'fertilizing',
  'spraying',
  'weeding',
  'other',
];

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
  repeat_every_days?: number | null;
  series_id?: string | null;
  parent_schedule_id?: string | null;
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

type NormalizedManualTarget = {
  targetType: TargetType;
  targetRow: string | null;
  targetColumn: string | null;
  targetTreeId: string | null;
  customTargetNote: string | null;
};

type EditableScheduleUpdate = {
  assignedWorkerId: UUID | null;
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
    p_repeat_every_days: normalizeRepeatEveryDays(input.repeatEveryDays),
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

// Versi daftar yang sudah membawa tugasnya. Menggantikan pola lama "ambil
// daftar, lalu getCareScheduleDetail satu per satu": pola itu memanggil
// ensureActiveOwner untuk SETIAP jadwal, sehingga jumlah request tumbuh linear
// terhadap jumlah jadwal — dan sejak jadwal berulang ada (migration 041),
// jumlah jadwal tumbuh sendiri seiring waktu tanpa campur tangan owner.
//
// Di sini otorisasi dicek SEKALI, jadwal diambil sekali, dan tugasnya diambil
// dalam satu query per batch id. Jumlah request jadi tetap (lihat
// SCHEDULE_TASK_BATCH_SIZE), berapa pun jumlah jadwalnya.
//
// getCareScheduleDetail sengaja dibiarkan hidup untuk layar detail, yang memang
// hanya butuh satu jadwal.
export async function getCareSchedulesWithTasks(
  input: GetCareSchedulesWithTasksInput
): Promise<ServiceResult<CareScheduleDetail[]>> {
  const accessResult = await ensureActiveOwner(
    input.farmId,
    'Hanya pemilik aktif yang dapat melihat jadwal perawatan.'
  );

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const scheduledFrom = normalizeOptionalText(input.scheduledFrom);
  let scheduleQuery = supabase
    .from('care_schedules')
    .select(CARE_SCHEDULE_SELECT)
    .eq('farm_id', input.farmId);

  // Satu-satunya penyaringan yang benar-benar terjadi di server. Ini yang
  // memotong pertumbuhan baris saat rantai berulang sudah berjalan lama.
  if (scheduledFrom) {
    scheduleQuery = scheduleQuery.gte('scheduled_date', scheduledFrom);
  }

  const { data, error } = await scheduleQuery
    .order('scheduled_date', { ascending: false })
    .order('created_at', { ascending: false })
    .returns<CareScheduleRow[]>();

  if (error) {
    return fail(error, 'Gagal memuat daftar jadwal perawatan.');
  }

  const scheduleRows = data ?? [];

  if (scheduledFrom && input.includeOlderOpenWork) {
    const tailResult = await getOlderOpenScheduleRows(
      input.farmId,
      scheduledFrom,
      new Set(scheduleRows.map((row) => row.id))
    );

    if (tailResult.error) {
      return fail(tailResult.error);
    }

    scheduleRows.push(...tailResult.data);
    // Urutan kontraknya tetap scheduled_date menurun, created_at menurun —
    // baris susulan disisipkan lewat sort, bukan ditempel di ekor.
    scheduleRows.sort(compareScheduleRowsDescending);
  }

  const schedules = scheduleRows.map(mapCareSchedule);
  const tasksResult = await getTasksByScheduleId(schedules.map((schedule) => schedule.id));

  if (tasksResult.error) {
    return fail(tasksResult.error);
  }

  const withTasks = schedules.map((schedule) => ({
    ...schedule,
    // Sejak migration 041 sebuah jadwal boleh punya NOL tugas: penerus rantai
    // dibuat tanpa tugas kalau pekerjanya sudah keluar dari kebun.
    tasks: tasksResult.data.get(schedule.id) ?? [],
  }));

  if (!input.excludeCompleted) {
    return ok(withTasks);
  }

  // Disaring di klien, BUKAN di server. "Semua tugasnya completed" tidak bisa
  // dinyatakan sebagai filter care_schedules tanpa join ke care_tasks, dan
  // embed inner join PostgREST justru akan MEMBUANG jadwal tanpa tugas —
  // persis baris yang paling tidak boleh hilang. Filter server yang benar
  // butuh view atau RPC baru, dan tahap ini tidak boleh menyentuh migrasi.
  // Jadi ini mengurangi baris yang dirender, bukan baris yang diambil.
  return ok(
    withTasks.filter(
      (schedule) =>
        schedule.tasks.length === 0 ||
        !schedule.tasks.every((task) => task.status === 'completed')
    )
  );
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
    return fail(error, 'Gagal membatalkan jadwal perawatan.');
  }

  return ok({
    success: true,
  });
}

// Jalur resmi untuk jadwal yang belum punya tugas (penerus rantai yang lahir
// saat pekerjanya sudah keluar). RPC-nya menolak jadwal yang sudah punya tugas,
// jadi ini bukan pengganti updateCareSchedule.
export async function assignWorkerToSchedule(
  input: AssignWorkerToScheduleInput
): Promise<ServiceResult<AssignWorkerToScheduleData>> {
  const scheduleId = normalizeOptionalText(input.scheduleId);

  if (!scheduleId) {
    return fail(new Error('Jadwal perawatan tidak ditemukan.'));
  }

  const workerId = normalizeOptionalText(input.workerId);

  if (!workerId) {
    return fail(new Error('Pilih satu pekerja aktif.'));
  }

  const { data, error } = await supabase.rpc('assign_worker_to_care_schedule', {
    p_schedule_id: scheduleId,
    p_worker_id: workerId,
  });

  if (error) {
    return fail(error, 'Gagal menugaskan pekerja ke jadwal.');
  }

  const taskId = typeof data === 'string' ? normalizeOptionalText(data) : null;

  if (!taskId) {
    return fail(new Error('RPC assign_worker_to_care_schedule tidak mengembalikan tugas baru.'));
  }

  return ok({
    taskId,
  });
}

// Menghentikan kelanjutan rantai TANPA membatalkan jadwal yang sedang berjalan
// — berbeda dari cancelCareSchedule, tugas yang sudah ada tetap harus dikerjakan.
export async function stopScheduleRepeat(
  input: StopScheduleRepeatInput
): Promise<ServiceResult<StopScheduleRepeatData>> {
  const scheduleId = normalizeOptionalText(input.scheduleId);

  if (!scheduleId) {
    return fail(new Error('Jadwal perawatan tidak ditemukan.'));
  }

  const { error } = await supabase.rpc('stop_care_schedule_repeat', {
    p_schedule_id: scheduleId,
  });

  if (error) {
    return fail(error, 'Gagal menghentikan pengulangan jadwal.');
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

  // Jadwal tanpa tugas tidak punya apa pun untuk dipindahtangankan. Dulu blok
  // update tugas di bawah dilewati diam-diam sementara fungsi ini tetap
  // melaporkan sukses, jadi owner melihat "Perubahan tersimpan" padahal pekerja
  // yang dia pilih tidak pernah tersimpan di mana pun. Ditolak sebelum satu pun
  // penulisan terjadi, supaya tidak ada perubahan separuh jalan.
  if (normalized.assignedWorkerId && schedule.tasks.length === 0) {
    return fail(
      new Error(
        'Jadwal ini belum punya tugas. Tugaskan pekerja lebih dulu dari halaman detail jadwal.'
      )
    );
  }

  if (normalized.assignedWorkerId) {
    const workersResult = await ensureActiveWorkers(schedule.farmId, [normalized.assignedWorkerId]);

    if (workersResult.error) {
      return fail(workersResult.error);
    }
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
        // Hanya dipindahtangankan kalau pemanggil memang menyertakan pekerja.
        ...(normalized.assignedWorkerId ? { assigned_to: normalized.assignedWorkerId } : {}),
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

// Jaring pengaman untuk scheduledFrom: memungut jadwal di LUAR jendela tanggal
// yang tugasnya masih terbuka, supaya pekerjaan tertunggak tidak pernah hilang
// dari daftar hanya karena tanggalnya sudah lewat jauh.
//
// Berangkat dari care_tasks, bukan care_schedules: himpunan tugas yang masih
// pending/postponed di masa lalu terbatas pada pekerjaan yang benar-benar
// mandek (biasanya nol sampai segelintir), sementara "semua jadwal sebelum
// tanggal X" justru himpunan tak terbatas yang sedang kita hindari.
//
// LUBANG YANG DIKETAHUI: jadwal yang belum punya tugas sama sekali tidak punya
// baris care_tasks, jadi tidak terjangkau dari sini. Selama jadwal seperti itu
// masih di dalam jendela tanggal ia tetap muncul; kalau menua melewati batas
// tanpa pernah ditugaskan, ia lolos. Menutupnya butuh anti-join (view atau RPC)
// yang tidak bisa dibuat tanpa migrasi baru.
async function getOlderOpenScheduleRows(
  farmId: UUID,
  scheduledFrom: string,
  alreadyLoadedIds: Set<UUID>
): Promise<ServiceResult<CareScheduleRow[]>> {
  const openTasksResult = await supabase
    .from('care_tasks')
    .select('care_schedule_id')
    .eq('farm_id', farmId)
    .lt('due_date', scheduledFrom)
    .in('status', ['pending', 'postponed'])
    .returns<{ care_schedule_id: string | null }[]>();

  if (openTasksResult.error) {
    return fail(openTasksResult.error, 'Gagal memeriksa tugas yang masih tertunggak.');
  }

  const tailIds = Array.from(
    new Set(
      (openTasksResult.data ?? [])
        .map((row) => row.care_schedule_id)
        .filter((scheduleId): scheduleId is string => Boolean(scheduleId))
        .filter((scheduleId) => !alreadyLoadedIds.has(scheduleId))
    )
  );

  if (tailIds.length === 0) {
    return ok([]);
  }

  const rows: CareScheduleRow[] = [];

  for (let index = 0; index < tailIds.length; index += SCHEDULE_TASK_BATCH_SIZE) {
    const batch = tailIds.slice(index, index + SCHEDULE_TASK_BATCH_SIZE);
    const { data, error } = await supabase
      .from('care_schedules')
      .select(CARE_SCHEDULE_SELECT)
      .in('id', batch)
      .returns<CareScheduleRow[]>();

    if (error) {
      return fail(error, 'Gagal memuat jadwal yang masih tertunggak.');
    }

    rows.push(...(data ?? []));
  }

  return ok(rows);
}

function compareScheduleRowsDescending(a: CareScheduleRow, b: CareScheduleRow): number {
  if (a.scheduled_date !== b.scheduled_date) {
    return a.scheduled_date < b.scheduled_date ? 1 : -1;
  }

  const aCreatedAt = a.created_at ?? '';
  const bCreatedAt = b.created_at ?? '';

  if (aCreatedAt === bCreatedAt) {
    return 0;
  }

  return aCreatedAt < bCreatedAt ? 1 : -1;
}

// Mengambil tugas untuk banyak jadwal sekaligus, dipecah per batch supaya URL
// PostgREST tidak kepanjangan. Batch dijalankan paralel; setiap jadwal selalu
// jatuh utuh ke satu batch, jadi urutan due_date/created_at per jadwal tetap
// sama dengan getCareScheduleDetail.
async function getTasksByScheduleId(
  scheduleIds: UUID[]
): Promise<ServiceResult<Map<UUID, CareTask[]>>> {
  const tasksByScheduleId = new Map<UUID, CareTask[]>();

  if (scheduleIds.length === 0) {
    return ok(tasksByScheduleId);
  }

  const batches: UUID[][] = [];

  for (let index = 0; index < scheduleIds.length; index += SCHEDULE_TASK_BATCH_SIZE) {
    batches.push(scheduleIds.slice(index, index + SCHEDULE_TASK_BATCH_SIZE));
  }

  const batchResults = await Promise.all(
    batches.map((batch) =>
      supabase
        .from('care_tasks')
        .select(CARE_TASK_SELECT)
        .in('care_schedule_id', batch)
        .order('due_date', { ascending: true })
        .order('created_at', { ascending: true })
        .returns<CareTaskRow[]>()
    )
  );

  const failedBatch = batchResults.find((result) => result.error);

  if (failedBatch?.error) {
    return fail(failedBatch.error, 'Gagal memuat tugas dari jadwal.');
  }

  for (const batchResult of batchResults) {
    for (const row of batchResult.data ?? []) {
      if (!row.care_schedule_id) {
        continue;
      }

      const existing = tasksByScheduleId.get(row.care_schedule_id);

      if (existing) {
        existing.push(mapCareTask(row));
      } else {
        tasksByScheduleId.set(row.care_schedule_id, [mapCareTask(row)]);
      }
    }
  }

  return ok(tasksByScheduleId);
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
    return fail(error, 'Gagal memeriksa hasil kerja pada jadwal.');
  }

  if ((data ?? []).length > 0) {
    return ok({
      canEdit: false,
      reason: 'Jadwal ini sudah punya hasil kerja, jadi tidak bisa diedit.',
    });
  }

  return ok({
    canEdit: true,
    reason: null,
  });
}

async function ensureActiveOwner(
  farmId: UUID,
  forbiddenMessage = 'Hanya pemilik aktif yang dapat mengelola jadwal perawatan.'
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

// Interval hanya dikirim kalau bilangan bulat positif; undefined/null/0/negatif
// -> null (jadwal sekali jalan). Math.trunc menjaga pecahan tidak sampai ke
// parameter integer RPC. RPC-nya menjepit ulang nilai ini, jadi ini penjaga
// sisi klien supaya pesan errornya tidak pernah jadi galat tipe Postgres.
function normalizeRepeatEveryDays(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const days = Math.trunc(value);

  return days > 0 ? days : null;
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

  // Boleh kosong: jadwal tanpa tugas tetap bisa diubah judul/tanggal/targetnya.
  // Penolakan "diisi tapi jadwalnya belum punya tugas" ditangani pemanggil,
  // yang punya akses ke schedule.tasks.
  const assignedWorkerId = normalizeOptionalText(input.assignedWorkerId);

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
    assignedWorkerId,
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
    parentScheduleId: row.parent_schedule_id ?? null,
    repeatEveryDays: row.repeat_every_days ?? null,
    requiresPhoto: row.requires_photo ?? false,
    scheduledDate: row.scheduled_date,
    seriesId: row.series_id ?? null,
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
