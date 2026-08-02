import { supabase } from '../lib/supabase';
import type {
  ActivityStatus,
  CareActivity,
  CareActivityOrigin,
  CareCategory,
  CareTask,
  CareTaskDetail,
  CreateTaskFromOperationalReportData,
  CreateTaskFromOperationalReportInput,
  CompleteTaskData,
  CompleteTaskInput,
  GetFarmTasksInput,
  GetOperationalReportFollowUpTasksInput,
  GetTaskDetailInput,
  GetWorkerTasksInput,
  MemberRole,
  MemberStatus,
  OperationalReportStatus,
  PostponeTaskData,
  PostponeTaskInput,
  RollbackCompletedTaskActivityInput,
  ServiceResult,
  SuccessData,
  TargetType,
  UpdateLatestTaskRealizationData,
  UpdateLatestTaskRealizationInput,
  TaskStatus,
  UUID,
} from '../types/domain';
import {
  deletePhotoAttachment,
  getTaskProofPhotos,
  uploadTaskProofPhoto,
} from './photoAttachmentService';
import type { TaskProofPhoto } from '../types/media';
import { fail, ok } from '../utils/serviceResult';

const CARE_TASK_SELECT =
  'id, farm_id, care_schedule_id, operational_report_id, assigned_to, assigned_by, title, category, instruction, target_type, target_row, target_column, target_tree_id, custom_target_note, due_date, status, requires_photo, created_at, updated_at';

const CARE_ACTIVITY_SELECT =
  'id, farm_id, care_task_id, performed_by, status, note, performed_at, asal, category, produk';

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

type CareActivityRow = {
  id: string;
  farm_id: string;
  care_task_id: string | null;
  performed_by: string;
  status: ActivityStatus;
  note: string | null;
  performed_at: string;
  asal: CareActivityOrigin;
  category: CareCategory | null;
  produk: string | null;
};

type MembershipRow = {
  role: MemberRole;
  status: MemberStatus;
};

type OperationalReportSourceRow = {
  id: string;
  farm_id: string;
  status: OperationalReportStatus;
};

type ExistingFollowUpTaskRow = {
  id: string;
  status: TaskStatus;
  title: string;
};

type ScheduleCancellationRow = {
  id: string;
  is_cancelled: boolean | null;
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

  const activeTasksResult = await filterCancelledScheduleTasks(data ?? []);

  if (activeTasksResult.error) {
    return fail(activeTasksResult.error);
  }

  return ok(activeTasksResult.data.map((task) => mapCareTask(task)));
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

  return ok((data ?? []).map((task) => mapCareTask(task)));
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

  const scheduleCancellationResult = await getTaskScheduleCancellationStatus(taskResult.data);

  if (scheduleCancellationResult.error) {
    return fail(scheduleCancellationResult.error);
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
    ...mapCareTask(taskResult.data, {
      scheduleIsCancelled: scheduleCancellationResult.data,
    }),
    activities: (activitiesResult.data ?? []).map(mapCareActivity),
  });
}

export async function getOperationalReportFollowUpTasks(
  input: GetOperationalReportFollowUpTasksInput
): Promise<ServiceResult<CareTaskDetail[]>> {
  const reportId = normalizeRequiredText(
    input.operationalReportId,
    'Laporan operasional tidak ditemukan.'
  );

  if (reportId instanceof Error) {
    return fail(reportId);
  }

  const reportResult = await getAccessibleOperationalReportSource(reportId);

  if (reportResult.error) {
    return fail(reportResult.error);
  }

  const tasksResult = await supabase
    .from('care_tasks')
    .select(CARE_TASK_SELECT)
    .eq('operational_report_id', reportId)
    .order('due_date', { ascending: true })
    .order('created_at', { ascending: false })
    .returns<CareTaskRow[]>();

  if (tasksResult.error) {
    return fail(tasksResult.error, 'Gagal memuat tugas tindak lanjut laporan.');
  }

  const tasks = tasksResult.data ?? [];

  if (tasks.length === 0) {
    return ok([]);
  }

  const taskIds = tasks.map((task) => task.id);
  const activitiesResult = await supabase
    .from('care_activities')
    .select(CARE_ACTIVITY_SELECT)
    .in('care_task_id', taskIds)
    .order('performed_at', { ascending: false })
    .returns<CareActivityRow[]>();

  if (activitiesResult.error) {
    return fail(activitiesResult.error, 'Gagal memuat realisasi tindak lanjut laporan.');
  }

  const activitiesByTaskId = new Map<string, CareActivity[]>();

  for (const activity of activitiesResult.data ?? []) {
    const mappedActivity = mapCareActivity(activity);

    // Catatan inisiatif tidak punya tugas induk, jadi tidak ikut dikelompokkan.
    if (!mappedActivity.careTaskId) {
      continue;
    }

    const existingActivities = activitiesByTaskId.get(mappedActivity.careTaskId) ?? [];
    existingActivities.push(mappedActivity);
    activitiesByTaskId.set(mappedActivity.careTaskId, existingActivities);
  }

  return ok(
    tasks.map((task) => ({
      ...mapCareTask(task),
      activities: activitiesByTaskId.get(task.id) ?? [],
    }))
  );
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

  if (!canCreateTaskFromReportStatus(reportResult.data.status)) {
    return fail(new Error(getClosedReportTaskMessage(reportResult.data.status)));
  }

  const existingTaskResult = await getExistingActiveFollowUpTask(reportId);

  if (existingTaskResult.error) {
    return fail(existingTaskResult.error);
  }

  if (existingTaskResult.data) {
    return fail(
      new Error('Laporan ini sudah memiliki tugas tindak lanjut aktif. Buka detail laporan untuk melihat tugas tersebut.')
    );
  }

  const { data, error } = await supabase.rpc('create_task_from_operational_report', {
    p_assigned_worker_id: workerId,
    p_custom_target_note: target.customTargetNote,
    p_due_date: dueDate,
    p_instruction: normalizeOptionalText(input.instruction),
    p_operational_report_id: reportId,
    p_requires_photo: input.requiresPhoto ?? false,
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

  return ok({
    taskId: data as UUID,
  });
}

export async function completeTask(
  input: CompleteTaskInput
): Promise<ServiceResult<CompleteTaskData>> {
  const cancellationResult = await ensureTaskScheduleIsNotCancelled(input.taskId);

  if (cancellationResult.error) {
    return fail(cancellationResult.error);
  }

  const { data, error } = await supabase.rpc('complete_task', {
    p_note: normalizeOptionalText(input.note),
    p_produk: normalizeOptionalText(input.produk),
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
  const cancellationResult = await ensureTaskScheduleIsNotCancelled(input.taskId);

  if (cancellationResult.error) {
    return fail(cancellationResult.error);
  }

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

export async function rollbackCompletedTaskActivity(
  input: RollbackCompletedTaskActivityInput
): Promise<ServiceResult<SuccessData>> {
  const activityId = normalizeRequiredText(
    input.activityId,
    'Realisasi tugas tidak ditemukan.'
  );

  if (activityId instanceof Error) {
    return fail(activityId);
  }

  const { error } = await supabase.rpc('rollback_completed_task_activity', {
    p_activity_id: activityId,
  });

  if (error) {
    return fail(error, 'Gagal membatalkan penyelesaian tugas tanpa bukti foto.');
  }

  return ok({
    success: true,
  });
}

export async function updateLatestTaskRealization(
  input: UpdateLatestTaskRealizationInput
): Promise<ServiceResult<UpdateLatestTaskRealizationData>> {
  if (input.status !== 'completed' && input.status !== 'postponed') {
    return fail(new Error('Status realisasi tidak valid.'));
  }

  const taskResult = await supabase
    .from('care_tasks')
    .select(CARE_TASK_SELECT)
    .eq('id', input.taskId)
    .maybeSingle<CareTaskRow>();

  if (taskResult.error) {
    return fail(taskResult.error, 'Gagal memeriksa tugas.');
  }

  if (!taskResult.data) {
    return fail(new Error('Tugas tidak ditemukan atau tidak dapat diakses.'));
  }

  const accessResult = await ensureActiveAssignedWorker(taskResult.data);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const cancellationResult = await getTaskScheduleCancellationStatus(taskResult.data);

  if (cancellationResult.error) {
    return fail(cancellationResult.error);
  }

  if (cancellationResult.data) {
    return fail(new Error('Tugas ini sudah dibatalkan oleh owner.'));
  }

  const latestActivityResult = await getLatestActivityForTask(input.taskId);

  if (latestActivityResult.error) {
    return fail(latestActivityResult.error);
  }

  const latestActivity = latestActivityResult.data;

  if (!latestActivity) {
    return fail(new Error('Realisasi tugas belum tersedia untuk diedit.'));
  }

  if (input.activityId && input.activityId !== latestActivity.id) {
    return fail(new Error('Hanya realisasi terbaru yang dapat diedit.'));
  }

  const proofResult = await getTaskProofPhotos({
    activityId: latestActivity.id,
    farmId: taskResult.data.farm_id,
  });
  const existingProofs = proofResult.data ?? [];
  const hasExistingProof = existingProofs.length > 0;
  const hasNewProof = Boolean(input.proofPhoto?.uri);
  const willRemoveExistingProof = input.removeExistingProof === true;

  if (
    taskResult.data.requires_photo
    && input.status === 'completed'
    && !hasNewProof
    && (!hasExistingProof || willRemoveExistingProof)
  ) {
    return fail(new Error('Foto wajib untuk menyelesaikan tugas ini.'));
  }

  if (input.status === 'postponed' && !normalizeOptionalText(input.note)) {
    return fail(new Error('Catatan penundaan wajib diisi.'));
  }

  if (taskResult.data.status !== input.status) {
    const updateTaskResult = await supabase
      .from('care_tasks')
      .update({
        status: input.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskResult.data.id);

    if (updateTaskResult.error) {
      return fail(updateTaskResult.error, 'Gagal memperbarui status tugas.');
    }
  }

  const nextNote = normalizeOptionalText(input.note);
  const produkProvided = input.produk !== undefined;
  const nextProduk = produkProvided ? normalizeOptionalText(input.produk) : undefined;

  const noteChanged = latestActivity.note !== nextNote;
  const statusChanged = latestActivity.status !== input.status;
  const produkChanged = produkProvided && latestActivity.produk !== nextProduk;

  if (statusChanged || noteChanged || produkChanged) {
    const activityUpdate: { note: string | null; status: ActivityStatus; produk?: string | null } = {
      note: nextNote,
      status: input.status,
    };

    // Kolom produk hanya disentuh bila pemanggil mengirimnya (perilaku lama dijaga).
    if (produkProvided) {
      activityUpdate.produk = nextProduk;
    }

    const updateActivityResult = await supabase
      .from('care_activities')
      .update(activityUpdate)
      .eq('id', latestActivity.id);

    if (updateActivityResult.error) {
      return fail(updateActivityResult.error, 'Gagal memperbarui realisasi tugas.');
    }
  }

  const warningMessage = await updateTaskProofPhoto({
    activityId: latestActivity.id,
    existingProofs,
    farmId: taskResult.data.farm_id,
    proofPhoto: input.proofPhoto,
    removeExistingProof: willRemoveExistingProof,
    taskId: taskResult.data.id,
  });

  return ok({
    activityId: latestActivity.id,
    warningMessage,
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

async function filterCancelledScheduleTasks(
  tasks: CareTaskRow[]
): Promise<ServiceResult<CareTaskRow[]>> {
  const scheduleIds = Array.from(
    new Set(
      tasks
        .map((task) => task.care_schedule_id)
        .filter((scheduleId): scheduleId is string => Boolean(scheduleId))
    )
  );

  if (scheduleIds.length === 0) {
    return ok(tasks);
  }

  const { data, error } = await supabase
    .from('care_schedules')
    .select('id, is_cancelled')
    .in('id', scheduleIds)
    .returns<ScheduleCancellationRow[]>();

  if (error) {
    return fail(error, 'Gagal memeriksa status jadwal tugas.');
  }

  const cancelledScheduleIds = new Set(
    (data ?? [])
      .filter((schedule) => schedule.is_cancelled)
      .map((schedule) => schedule.id)
  );

  return ok(tasks.filter((task) => !task.care_schedule_id || !cancelledScheduleIds.has(task.care_schedule_id)));
}

async function ensureTaskScheduleIsNotCancelled(taskId: UUID): Promise<ServiceResult<SuccessData>> {
  const taskResult = await supabase
    .from('care_tasks')
    .select(CARE_TASK_SELECT)
    .eq('id', taskId)
    .maybeSingle<CareTaskRow>();

  if (taskResult.error) {
    return fail(taskResult.error, 'Gagal memeriksa status jadwal tugas.');
  }

  if (!taskResult.data) {
    return fail(new Error('Tugas tidak ditemukan atau tidak dapat diakses.'));
  }

  const cancellationResult = await getTaskScheduleCancellationStatus(taskResult.data);

  if (cancellationResult.error) {
    return fail(cancellationResult.error);
  }

  if (cancellationResult.data) {
    return fail(new Error('Tugas ini sudah dibatalkan oleh owner.'));
  }

  return ok({
    success: true,
  });
}

async function getTaskScheduleCancellationStatus(task: CareTaskRow): Promise<ServiceResult<boolean>> {
  if (!task.care_schedule_id) {
    return ok(false);
  }

  const { data, error } = await supabase
    .from('care_schedules')
    .select('id, is_cancelled')
    .eq('id', task.care_schedule_id)
    .maybeSingle<ScheduleCancellationRow>();

  if (error) {
    return fail(error, 'Gagal memeriksa status jadwal tugas.');
  }

  return ok(data?.is_cancelled === true);
}

async function getAccessibleOperationalReportSource(
  operationalReportId: UUID
): Promise<ServiceResult<OperationalReportSourceRow>> {
  const { data, error } = await supabase
    .from('operational_reports')
    .select('id, farm_id, status')
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

function canCreateTaskFromReportStatus(status: OperationalReportStatus): boolean {
  return status !== 'resolved' && status !== 'rejected';
}

function getClosedReportTaskMessage(status: OperationalReportStatus): string {
  if (status === 'resolved') {
    return 'Laporan yang sudah selesai tidak dapat dibuatkan tugas tindak lanjut.';
  }

  return 'Laporan yang ditolak tidak dapat dibuatkan tugas tindak lanjut.';
}

async function getExistingActiveFollowUpTask(
  operationalReportId: UUID
): Promise<ServiceResult<ExistingFollowUpTaskRow | null>> {
  const { data, error } = await supabase
    .from('care_tasks')
    .select('id, status, title')
    .eq('operational_report_id', operationalReportId)
    .in('status', ['pending', 'postponed'])
    .limit(1)
    .maybeSingle<ExistingFollowUpTaskRow>();

  if (error) {
    return fail(error, 'Gagal memeriksa tugas tindak lanjut aktif.');
  }

  return ok(data);
}

async function getLatestActivityForTask(
  taskId: UUID
): Promise<ServiceResult<CareActivity | null>> {
  const { data, error } = await supabase
    .from('care_activities')
    .select(CARE_ACTIVITY_SELECT)
    .eq('care_task_id', taskId)
    .order('performed_at', { ascending: false })
    .limit(1)
    .maybeSingle<CareActivityRow>();

  if (error) {
    return fail(error, 'Gagal memuat realisasi terbaru.');
  }

  return ok(data ? mapCareActivity(data) : null);
}

async function updateTaskProofPhoto(input: {
  activityId: UUID;
  existingProofs: TaskProofPhoto[];
  farmId: UUID;
  proofPhoto?: UpdateLatestTaskRealizationInput['proofPhoto'];
  removeExistingProof: boolean;
  taskId: UUID;
}): Promise<string | null> {
  if (!input.proofPhoto?.uri && !input.removeExistingProof) {
    return null;
  }

  if (input.proofPhoto?.uri) {
    const uploadResult = await uploadTaskProofPhoto({
      activityId: input.activityId,
      base64: input.proofPhoto.base64,
      farmId: input.farmId,
      fileName: input.proofPhoto.fileName,
      localUri: input.proofPhoto.uri,
      mimeType: input.proofPhoto.mimeType,
      taskId: input.taskId,
    });

    if (uploadResult.error) {
      return 'Realisasi berhasil diperbarui, tetapi foto bukti gagal diunggah.';
    }

    const deleteWarning = await deleteTaskProofPhotos(
      input.existingProofs.filter((photo) => photo.attachment.id !== uploadResult.data.attachment.id)
    );

    return deleteWarning;
  }

  return deleteTaskProofPhotos(input.existingProofs);
}

async function deleteTaskProofPhotos(photos: TaskProofPhoto[]): Promise<string | null> {
  const deleteResults = await Promise.all(
    photos.map((photo) => deletePhotoAttachment({ photoId: photo.attachment.id }))
  );
  const failedDelete = deleteResults.find((result) => result.error);

  return failedDelete?.error
    ? 'Realisasi berhasil diperbarui, tetapi foto bukti lama belum dapat dihapus.'
    : null;
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

async function ensureActiveAssignedWorker(
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

  const isAssignedActiveWorker =
    membershipResult.data?.role === 'worker'
    && membershipResult.data.status === 'active'
    && task.assigned_to === userIdResult.data;

  if (!isAssignedActiveWorker) {
    return fail(new Error('Hanya pekerja yang ditugaskan yang dapat mengedit realisasi ini.'));
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

function mapCareTask(
  row: CareTaskRow,
  options: { scheduleIsCancelled?: boolean } = {}
): CareTask {
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
    scheduleIsCancelled: options.scheduleIsCancelled,
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
    asal: row.asal,
    careTaskId: row.care_task_id,
    category: row.category,
    farmId: row.farm_id,
    id: row.id,
    note: row.note,
    performedAt: row.performed_at,
    performedBy: row.performed_by,
    produk: row.produk,
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
