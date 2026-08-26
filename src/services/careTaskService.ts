import { supabase } from '../lib/supabase';
import type {
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
  RollbackCompletedTaskActivityInput,
  ServiceResult,
  SuccessData,
  TargetType,
  UpdateTaskRealizationData,
  UpdateTaskRealizationInput,
  TaskStatus,
  UUID,
} from '../types/domain';
import {
  CARE_ACTIVITY_SELECT,
  mapCareActivity,
  type CareActivityRow,
} from './careActivityShared';
import {
  deletePhotoAttachment,
  getTaskProofPhotos,
  uploadTaskProofPhoto,
} from './photoAttachmentService';
import type { TaskProofPhoto } from '../types/media';
import { sweepMissedSchedules } from './missedScheduleSweep';
import { resolveTreeTargetCodes } from './scheduleTreeService';
import { fail, ok } from '../utils/serviceResult';

const CARE_TASK_SELECT =
  'id, farm_id, care_schedule_id, assigned_to, assigned_by, title, category, instruction, target_type, target_tree_id, custom_target_note, due_date, status, missed_at, requires_photo, created_at, updated_at';

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
  target_tree_id: string | null;
  custom_target_note: string | null;
  due_date: string;
  status: TaskStatus;
  missed_at?: string | null;
  requires_photo: boolean | null;
  created_at?: string;
  updated_at?: string | null;
};

type MembershipRow = {
  role: MemberRole;
  status: MemberStatus;
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

  await sweepMissedSchedules(input.farmId);

  const { data, error } = await supabase
    .from('care_tasks')
    .select(CARE_TASK_SELECT)
    .eq('farm_id', input.farmId)
    .eq('assigned_to', userIdResult.data)
    // Tugas yang dilepas saat pekerja ini pernah keluar dari kebun (migrasi
    // 051) tidak boleh muncul kembali kalau ia bergabung lagi. Baris
    // keanggotaannya dipakai ulang oleh request_join_farm, jadi user_id-nya
    // sama persis dan tugas lamanya akan lolos RLS begitu ia aktif kembali.
    .is('released_at', null)
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

  return ok(await attachTaskTreeTargets(activeTasksResult.data.map((task) => mapCareTask(task))));
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
    // Tugas yang dilepas (migrasi 051) dibuang dari daftar tugas owner dengan
    // alasan yang sama seperti di layar Jadwal: ia akan terbaca sebagai
    // tunggakan atas nama orang yang sudah tidak ada di kebun ini, dan itulah
    // gejala yang diperbaiki 051.
    .is('released_at', null)
    .order('due_date', { ascending: true })
    .order('created_at', { ascending: false })
    .returns<CareTaskRow[]>();

  if (error) {
    return fail(error, 'Gagal memuat daftar tugas kebun.');
  }

  return ok(await attachTaskTreeTargets((data ?? []).map((task) => mapCareTask(task))));
}

// Mengisi daftar pohon untuk sekumpulan tugas SEKALIGUS, lewat
// care_schedule_id ke care_schedule_trees.
//
// Tidak ada care_task_trees: tugas meminjam daftar milik jadwalnya. Dua tugas
// dari jadwal yang sama karenanya berbagi satu pembacaan.
//
// SENGAJA TIDAK mengembalikan galat -- lihat alasan yang sama di
// attachTreeTargets (careScheduleService). Daftar tugas pekerja tidak boleh
// gagal total hanya karena kode pohonnya tidak terbaca; tampilannya jatuh
// balik ke bayangan lewat formatCareTarget.
async function attachTaskTreeTargets(tasks: CareTask[]): Promise<CareTask[]> {
  // Hanya tugas bertarget pohon yang punya daftar untuk dibaca. Tugas 'farm'
  // dan 'custom' tidak menyentuh jembatan sama sekali, jadi tidak ikut masuk
  // ke query string .in().
  const treeTasks = tasks.filter((task) => task.targetType === 'tree');

  if (treeTasks.length === 0) {
    return tasks;
  }

  const result = await resolveTreeTargetCodes(
    treeTasks.map((task) => ({
      key: task.id,
      scheduleId: task.careScheduleId,
      fallbackTreeId: task.targetTreeId,
    }))
  );

  const resolved = result.data ?? {};

  return tasks.map((task) => ({
    ...task,
    targetTreeIds: resolved[task.id]?.treeIds,
    targetTreeCodes: resolved[task.id]?.treeCodes,
  }));
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
    return fail(activitiesResult.error, 'Gagal memuat hasil kerja tugas.');
  }

  const task = mapCareTask(taskResult.data, {
    scheduleIsCancelled: scheduleCancellationResult.data,
  });
  const [taskWithTrees] = await attachTaskTreeTargets([task]);

  return ok({
    ...taskWithTrees,
    // scheduleIsCancelled tidak ikut terbawa attachTaskTreeTargets karena ia
    // bukan bagian dari CareTask dasar; dikembalikan eksplisit di sini.
    scheduleIsCancelled: task.scheduleIsCancelled,
    activities: (activitiesResult.data ?? []).map(mapCareActivity),
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
    // Takaran dikirim apa adanya. Validasi pasangannya (jumlah tanpa satuan,
    // takaran tanpa nama bahan) sengaja diserahkan ke RPC — pesan errornya
    // sudah berbahasa Indonesia dan sampai ke layar lewat toServiceError.
    p_produk_jumlah: input.produkJumlah ?? null,
    p_produk_satuan: input.produkSatuan ?? null,
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

  const postponedUntil = normalizeOptionalText(input.postponedUntil);

  if (!postponedUntil) {
    return fail(new Error('Tanggal penundaan wajib diisi.'));
  }

  const { data, error } = await supabase.rpc('postpone_task', {
    p_note: note,
    p_postponed_until: postponedUntil,
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
    'Hasil kerja tidak ditemukan.'
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

// "Perbaiki catatan" — hanya membetulkan isi baris realisasi TERAKHIR.
//
// Menggantikan updateLatestTaskRealization, yang dulu menulis sendiri ke
// care_tasks dan care_activities lewat .update(). Dua jalur tulis itu SUDAH
// DIBUANG dan tidak boleh kembali:
//   * UPDATE care_tasks   -> melanggar aturan log-vs-state, dan sekarang juga
//     ditolak karena policy-nya owner-only.
//   * UPDATE care_activities -> grant UPDATE-nya dicabut migrasi 043, jadi
//     sekarang berujung error keras.
// Keduanya digantikan RPC update_task_realization (migrasi 043).
//
// Namanya tidak lagi menyebut "latest" karena fungsi ini tidak lagi menebak
// baris mana yang terbaru: activityId dikirim eksplisit dan DB yang
// memverifikasi (dengan tie-breaker `performed_at desc, id desc`).
//
// PEMBAGIAN TUGAS VERIFIKASI — sengaja tidak diduplikasi di sini:
//   RPC yang menegakkan: baris ada, bukan catatan inisiatif, pemanggil adalah
//   pencatatnya, pekerja masih aktif, baris ini yang terbaru, jadwal induk tidak
//   dibatalkan, catatan penundaan wajib diisi, dan pasangan takaran bahan.
//   Semua pesannya sudah berbahasa Indonesia dan lolos apa adanya lewat
//   toServiceError, jadi menyalinnya ke sini hanya menambah round-trip dan
//   risiko dua kalimat yang berbeda untuk kegagalan yang sama.
//
//   Klien yang menegakkan: HANYA aturan foto wajib. RPC tidak tahu apa-apa soal
//   photo_attachments, jadi aturan ini tidak punya penjaga lain.
export async function updateTaskRealization(
  input: UpdateTaskRealizationInput
): Promise<ServiceResult<UpdateTaskRealizationData>> {
  const activityId = normalizeRequiredText(
    input.activityId,
    'Hasil kerja tidak ditemukan.'
  );

  if (activityId instanceof Error) {
    return fail(activityId);
  }

  // Baris realisasi dibaca sekali untuk tiga hal yang TIDAK diketahui RPC:
  // farm_id dan care_task_id untuk jalur foto, serta status untuk memutuskan
  // apakah aturan foto wajib berlaku. Bukan untuk memeriksa akses.
  const activityResult = await supabase
    .from('care_activities')
    .select(CARE_ACTIVITY_SELECT)
    .eq('id', activityId)
    .maybeSingle<CareActivityRow>();

  if (activityResult.error) {
    return fail(activityResult.error, 'Gagal memuat catatan hasil kerja.');
  }

  if (!activityResult.data) {
    return fail(new Error('Catatan tidak ditemukan.'));
  }

  const activity = mapCareActivity(activityResult.data);

  if (!activity.careTaskId) {
    return fail(new Error('Catatan ini bukan hasil kerja dari tugas.'));
  }

  const taskResult = await supabase
    .from('care_tasks')
    .select(CARE_TASK_SELECT)
    .eq('id', activity.careTaskId)
    .maybeSingle<CareTaskRow>();

  if (taskResult.error) {
    return fail(taskResult.error, 'Gagal memeriksa tugas.');
  }

  if (!taskResult.data) {
    return fail(new Error('Tugas tidak ditemukan atau tidak dapat diakses.'));
  }

  const proofResult = await getTaskProofPhotos({
    activityId: activity.id,
    farmId: activity.farmId,
  });
  const existingProofs = proofResult.data ?? [];
  const hasExistingProof = existingProofs.length > 0;
  const hasNewProof = Boolean(input.proofPhoto?.uri);
  const willRemoveExistingProof = input.removeExistingProof === true;

  // Status dibaca dari BARIS-nya, bukan dari input — "perbaiki catatan" tidak
  // pernah mengubah status, jadi aturan foto wajib hanya relevan untuk baris
  // yang memang berstatus selesai.
  if (
    taskResult.data.requires_photo
    && activity.status === 'completed'
    && !hasNewProof
    && (!hasExistingProof || willRemoveExistingProof)
  ) {
    return fail(new Error('Foto wajib untuk menyelesaikan tugas ini.'));
  }

  const { error } = await supabase.rpc('update_task_realization', {
    p_activity_id: activity.id,
    p_note: normalizeOptionalText(input.note),
    p_produk: normalizeOptionalText(input.produk),
    p_produk_jumlah: input.produkJumlah ?? null,
    p_produk_satuan: input.produkSatuan ?? null,
  });

  if (error) {
    return fail(error, 'Gagal memperbarui catatan hasil kerja.');
  }

  // Penanganan foto tetap di sisi klien: unggahan storage tidak bisa ikut
  // transaksi RPC, jadi kegagalannya dilaporkan sebagai peringatan, bukan
  // membatalkan perbaikan catatan yang sudah berhasil.
  const warningMessage = await updateTaskProofPhoto({
    activityId: activity.id,
    existingProofs,
    farmId: activity.farmId,
    proofPhoto: input.proofPhoto,
    removeExistingProof: willRemoveExistingProof,
    taskId: taskResult.data.id,
  });

  return ok({
    activityId: activity.id,
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

// getLatestActivityForTask() dihapus bersama updateLatestTaskRealization.
// Penentuan "baris terakhir per tugas" kini sepenuhnya milik RPC
// update_task_realization, lengkap dengan tie-breaker `id desc` yang tidak
// pernah dimiliki versi klien.

async function updateTaskProofPhoto(input: {
  activityId: UUID;
  existingProofs: TaskProofPhoto[];
  farmId: UUID;
  proofPhoto?: UpdateTaskRealizationInput['proofPhoto'];
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
      return 'Catatan berhasil diperbarui, tetapi foto bukti gagal diunggah.';
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
    ? 'Catatan berhasil diperbarui, tetapi foto bukti lama belum dapat dihapus.'
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

// ensureActiveAssignedWorker() dihapus bersama updateLatestTaskRealization.
// Pemeriksaan yang sama kini dilakukan RPC update_task_realization, dengan
// pesan 'Hanya pencatat yang bisa memperbaiki catatan ini.' dan 'Hanya pekerja
// aktif yang bisa memperbaiki catatan.' — dan RPC memeriksa performed_by,
// yang lebih tepat daripada assigned_to yang dipakai versi klien.

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
    missedAt: row.missed_at ?? null,
    farmId: row.farm_id,
    id: row.id,
    instruction: row.instruction,
    requiresPhoto: row.requires_photo ?? false,
    scheduleIsCancelled: options.scheduleIsCancelled,
    status: row.status,
    targetTreeId: row.target_tree_id,
    targetType: row.target_type,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

function normalizeRequiredText(value: string, message: string): string | Error {
  const normalized = value.trim();
  return normalized ? normalized : new Error(message);
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
