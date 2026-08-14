import {
  canCreateTaskFromReportStatus,
  getClosedReportTaskMessage,
} from '../constants/operationalReport';
import { supabase } from '../lib/supabase';
import type {
  CareActivity,
  CareCategory,
  CareTask,
  CareTaskDetail,
  ResolveReportWithTaskData,
  ResolveReportWithTaskInput,
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
import { fail, ok } from '../utils/serviceResult';

const CARE_TASK_SELECT =
  'id, farm_id, care_schedule_id, operational_report_id, assigned_to, assigned_by, title, category, instruction, target_type, target_tree_id, custom_target_note, due_date, status, missed_at, requires_photo, created_at, updated_at';

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
    return fail(activitiesResult.error, 'Gagal memuat hasil kerja tugas.');
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

  // BUKAN duplikasi dari baris laporan yang sudah dipegang layar — ini PENJAGA
  // AKSES, dan datanya memang tidak dipakai di bawah. Tanpa dia, laporan yang
  // tidak boleh diakses pemanggil akan lolos ke query care_tasks yang juga
  // ber-RLS dan balik sebagai daftar kosong, bukan error — "tidak punya tugas"
  // jadi tak terbedakan dari "tidak boleh kamu lihat". Jangan dihapus.
  const reportResult = await getAccessibleOperationalReportSource(reportId);

  if (reportResult.error) {
    return fail(reportResult.error);
  }

  const tasksResult = await supabase
    .from('care_tasks')
    .select(CARE_TASK_SELECT)
    .eq('operational_report_id', reportId)
    // Sejalan dengan getExistingActiveFollowUpTask di bawah, yang sejak migrasi
    // 051 tidak lagi menganggap tugas terlepas sebagai tindak lanjut aktif.
    // Kalau daftar ini tetap menampilkannya, owner melihat dua tugas tindak
    // lanjut untuk satu laporan padahal hanya satu yang hidup.
    .is('released_at', null)
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
    return fail(activitiesResult.error, 'Gagal memuat hasil kerja tindak lanjut laporan.');
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

// Keputusan owner "buat tugas tindak lanjut".
//
// RPC create_task_from_operational_report (migration 034) meng-insert tugas
// DAN menyetel status='in_progress' + resolution='task' pada laporan dalam satu
// transaksi. JANGAN memanggil aksi status apa pun setelah ini — laporan sudah
// berada di keadaan akhir yang benar.
export async function resolveReportWithTask(
  input: ResolveReportWithTaskInput
): Promise<ServiceResult<ResolveReportWithTaskData>> {
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

  // Kategori wajib sejak migrasi 047. Ditolak di sini supaya pesannya terbaca;
  // tanpa ini pemanggil hanya melihat exception mentah dari RPC.
  if (!input.category) {
    return fail(new Error('Kategori perawatan wajib dipilih.'));
  }

  const target = normalizeTaskTarget({
    customTargetNote: input.customTargetNote,
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
    p_category: input.category,
    p_custom_target_note: target.customTargetNote,
    p_due_date: dueDate,
    p_instruction: normalizeOptionalText(input.instruction),
    p_operational_report_id: reportId,
    // null = pertahankan catatan lama, '' = hapus catatan, teks = ganti catatan.
    p_owner_response_note:
      input.ownerResponseNote === null || input.ownerResponseNote === undefined
        ? null
        : input.ownerResponseNote.trim(),
    p_requires_photo: input.requiresPhoto ?? false,
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

async function getExistingActiveFollowUpTask(
  operationalReportId: UUID
): Promise<ServiceResult<ExistingFollowUpTaskRow | null>> {
  const { data, error } = await supabase
    .from('care_tasks')
    .select('id, status, title')
    .eq('operational_report_id', operationalReportId)
    .in('status', ['pending', 'postponed'])
    // Defensif saja: tugas tindak lanjut laporan punya care_schedule_id NULL,
    // dan sweep_missed_schedules (migrasi 048) hanya menandai tugas yang
    // ter-join ke sebuah jadwal — jadi baris di sini tidak pernah terlewat.
    // Filter dipasang agar tetap benar seandainya suatu saat ada tugas yang
    // punya kedua sumber sekaligus.
    .is('missed_at', null)
    // Bukan defensif: tugas tindak lanjut laporan IKUT dilepas saat pekerjanya
    // keluar (migrasi 051). Tanpa baris ini, klien tetap melaporkan "sudah ada
    // tindak lanjut aktif" dan menghalangi owner sebelum RPC-nya sempat
    // dipanggil — padahal penjaga di sisi database sudah dilonggarkan.
    .is('released_at', null)
    .limit(1)
    .maybeSingle<ExistingFollowUpTaskRow>();

  if (error) {
    return fail(error, 'Gagal memeriksa tugas tindak lanjut aktif.');
  }

  return ok(data);
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
    operationalReportId: row.operational_report_id,
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
  targetTreeId?: string | null;
  customTargetNote?: string | null;
}):
  | {
      targetType: TargetType;
      targetTreeId: string | null;
      customTargetNote: string | null;
    }
  | Error {
  if (!input.targetType) {
    return new Error('Target tugas wajib dipilih.');
  }

  // Lihat catatan yang sama di normalizeManualTarget (careScheduleService):
  // 'row'/'column' ditutup CHECK di database sejak migrasi 047.
  if (!['farm', 'tree', 'custom'].includes(input.targetType)) {
    return new Error('Target tugas tidak valid.');
  }

  if (input.targetType === 'farm') {
    return {
      customTargetNote: null,
      targetTreeId: null,
      targetType: 'farm',
    };
  }

  if (input.targetType === 'tree') {
    const treeId = normalizeOptionalText(input.targetTreeId);

    if (!treeId) {
      return new Error('Pohon target wajib dipilih.');
    }

    return {
      customTargetNote: null,
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
