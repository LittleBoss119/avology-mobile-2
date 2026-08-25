import { supabase } from '../lib/supabase';
import type {
  GetOwnerDashboardSummaryInput,
  GetWorkerDashboardSummaryInput,
  OwnerDashboardSummary,
  ServiceResult,
  WorkerDashboardSummary,
} from '../types/domain';
import { sweepMissedSchedules } from './missedScheduleSweep';
import { fail, ok } from '../utils/serviceResult';
import { getTodayIsoDate } from '../utils/taskDueDate';

type CountResult = {
  count: number | null;
  error: { message?: string } | null;
};

type WorkerTaskCountRow = {
  care_schedule_id: string | null;
  id: string;
};

type ScheduleCancellationRow = {
  id: string;
  is_cancelled: boolean | null;
};

export async function getOwnerDashboardSummary(
  input: GetOwnerDashboardSummaryInput
): Promise<ServiceResult<OwnerDashboardSummary>> {
  // Angka dashboard ikut terpengaruh penandaan terlewat, jadi disapu dulu.
  await sweepMissedSchedules(input.farmId);

  const today = getTodayIsoDate();

  const [
    totalTrees,
    healthyTrees,
    problemTrees,
    todayTasks,
    unfinishedTasks,
    overdueTasks,
    pendingWorkers,
    floweringTrees,
    fruitingTrees,
  ] = await Promise.all([
    countActiveTrees(input.farmId),
    countHealthyTrees(input.farmId),
    countProblemTrees(input.farmId),
    countFarmTasksDueToday(input.farmId, today),
    countFarmUnfinishedTasks(input.farmId),
    countFarmOverdueTasks(input.farmId),
    countPendingWorkers(input.farmId),
    countTreesByGrowthPhase(input.farmId, 'flowering'),
    countTreesByGrowthPhase(input.farmId, 'fruiting'),
  ]);

  const failure = findFailedCount([
    ['total pohon', totalTrees],
    ['pohon sehat', healthyTrees],
    ['pohon bermasalah', problemTrees],
    ['tugas hari ini', todayTasks],
    ['tugas belum selesai', unfinishedTasks],
    ['tugas terlambat', overdueTasks],
    ['worker pending', pendingWorkers],
    ['pohon flowering', floweringTrees],
    ['pohon fruiting', fruitingTrees],
  ]);

  if (failure) {
    return fail(
      new Error(
        `Gagal memuat ringkasan dashboard owner: ${failure.label}. ${failure.error.message}`
      )
    );
  }

  return ok({
    totalTrees: readCount(totalTrees),
    healthyTrees: readCount(healthyTrees),
    problemTrees: readCount(problemTrees),
    todayTasks: readCount(todayTasks),
    unfinishedTasks: readCount(unfinishedTasks),
    overdueTasks: readCount(overdueTasks),
    pendingWorkers: readCount(pendingWorkers),
    floweringTrees: readCount(floweringTrees),
    fruitingTrees: readCount(fruitingTrees),
  });
}

export async function getWorkerDashboardSummary(
  input: GetWorkerDashboardSummaryInput
): Promise<ServiceResult<WorkerDashboardSummary>> {
  await sweepMissedSchedules(input.farmId);

  const today = getTodayIsoDate();

  const [todayTasks, unfinishedTasks, completedTasks] = await Promise.all([
    countWorkerTasksDueToday(input.farmId, input.userId, today),
    countWorkerUnfinishedTasks(input.farmId, input.userId),
    countWorkerCompletedTasks(input.farmId, input.userId),
  ]);

  const failure = findFailedCount([
    ['tugas hari ini', todayTasks],
    ['tugas belum selesai', unfinishedTasks],
    ['tugas selesai', completedTasks],
  ]);

  if (failure) {
    return fail(
      new Error(
        `Gagal memuat ringkasan dashboard worker: ${failure.label}. ${failure.error.message}`
      )
    );
  }

  return ok({
    todayTasks: readCount(todayTasks),
    unfinishedTasks: readCount(unfinishedTasks),
    completedTasks: readCount(completedTasks),
  });
}

async function countActiveTrees(farmId: string): Promise<CountResult> {
  return supabase
    .from('trees')
    .select('id', { count: 'exact', head: true })
    .eq('farm_id', farmId)
    .eq('is_archived', false);
}

async function countHealthyTrees(farmId: string): Promise<CountResult> {
  return supabase
    .from('trees')
    .select('id', { count: 'exact', head: true })
    .eq('farm_id', farmId)
    .eq('is_archived', false)
    .eq('current_condition', 'healthy');
}

async function countProblemTrees(farmId: string): Promise<CountResult> {
  return supabase
    .from('trees')
    .select('id', { count: 'exact', head: true })
    .eq('farm_id', farmId)
    .eq('is_archived', false)
    .neq('current_condition', 'healthy');
}

async function countTreesByGrowthPhase(
  farmId: string,
  growthPhase: 'flowering' | 'fruiting'
): Promise<CountResult> {
  return supabase
    .from('trees')
    .select('id', { count: 'exact', head: true })
    .eq('farm_id', farmId)
    .eq('is_archived', false)
    .eq('current_growth_phase', growthPhase);
}

async function countFarmTasksDueToday(
  farmId: string,
  today: string
): Promise<CountResult> {
  // Jatuh tempo hari ini & masih 'pending'. task_status tidak punya nilai
  // 'cancelled' (migrasi 001), jadi completed/postponed cukup dibuang lewat
  // status='pending'. Pembatalan hanya di level jadwal (care_schedules
  // .is_cancelled), disaring countActiveWorkerTaskRows. Sejak migrasi 053 tidak
  // ada lagi task tanpa schedule: care_tasks_source_check mewajibkan
  // care_schedule_id terisi, jadi cabang NULL di penyaring itu tidak terpakai.
  return countActiveWorkerTaskRows(
    supabase
      .from('care_tasks')
      .select('id, care_schedule_id')
      .eq('farm_id', farmId)
      .eq('due_date', today)
      .eq('status', 'pending')
      .is('missed_at', null)
      // Tugas yang dilepas saat pekerjanya keluar dari kebun (migrasi 051)
      // TETAP berstatus 'pending' — pelepasan sengaja tidak menyentuh status
      // supaya sebabnya bisa dibedakan dari 'terlewat'. Karena itu ia hanya
      // terbuang lewat filter ini, dan tanpanya kartu beranda owner tetap
      // menghitung pekerjaan yang sudah tidak jadi tanggungan siapa pun.
      .is('released_at', null)
  );
}

async function countFarmUnfinishedTasks(farmId: string): Promise<CountResult> {
  // 'Belum selesai' = pending saja (sebelumnya keliru ikut 'postponed').
  // Kecualikan task dari jadwal yang dibatalkan via countActiveWorkerTaskRows.
  // Lihat countFarmTasksDueToday soal task tanpa schedule sejak migrasi 053.
  return countActiveWorkerTaskRows(
    supabase
      .from('care_tasks')
      .select('id, care_schedule_id')
      .eq('farm_id', farmId)
      .eq('status', 'pending')
      .is('missed_at', null)
      // Lihat countFarmTasksDueToday: tugas terlepas masih 'pending'.
      .is('released_at', null)
  );
}

// Terlambat = due_date < hari ini & masih pending, minus jadwal dibatalkan.
// Diekspor untuk dipakai nanti (P-4); belum disambungkan ke OwnerDashboardSummary.
// Menghitung 'today' sendiri via getTodayIsoDate() agar berdiri sendiri, memakai
// sumber tanggal yang sama (WIB) dengan seluruh klasifikasi RF-11b.
export async function countFarmOverdueTasks(farmId: string): Promise<CountResult> {
  const today = getTodayIsoDate();

  return countActiveWorkerTaskRows(
    supabase
      .from('care_tasks')
      .select('id, care_schedule_id')
      .eq('farm_id', farmId)
      .lt('due_date', today)
      .eq('status', 'pending')
      .is('missed_at', null)
      // Penghitung "terlambat" inilah yang paling kentara salah sebelum
      // migrasi 051: tugas milik mantan pekerja menumpuk di sini tanpa ada
      // seorang pun yang bisa menyelesaikannya.
      .is('released_at', null)
  );
}

async function countPendingWorkers(farmId: string): Promise<CountResult> {
  return supabase
    .from('farm_members')
    .select('id', { count: 'exact', head: true })
    .eq('farm_id', farmId)
    .eq('role', 'worker')
    .eq('status', 'pending');
}

// Jatuh tempo hari ini DAN masih menunggu dikerjakan. Sebelumnya tanpa filter
// status sama sekali, sehingga tugas yang sudah selesai hari ini tetap terhitung
// — kartu beranda bisa bilang "3" sementara section "Hari ini" di layar tugas
// hanya berisi 1.
//
// Definisinya sengaja dipatok ke chip "Belum selesai" di layar tugas pekerja,
// yaitu status BUKAN 'completed'. Karena itu 'postponed' ikut dihitung, tidak
// seperti padanan owner countFarmTasksDueToday yang memakai pending saja: di
// sisi pekerja tugas yang ditunda masih pekerjaan yang menunggu dirinya, dan
// countWorkerUnfinishedTasks di bawah sudah memperlakukannya begitu sejak awal.
async function countWorkerTasksDueToday(
  farmId: string,
  userId: string,
  today: string
): Promise<CountResult> {
  return countActiveWorkerTaskRows(
    supabase
    .from('care_tasks')
    .select('id, care_schedule_id')
    .eq('farm_id', farmId)
    .eq('assigned_to', userId)
    .eq('due_date', today)
    .in('status', ['pending', 'postponed'])
    .is('missed_at', null)
    // Penting untuk kasus bergabung kembali: request_join_farm memakai ULANG
    // baris keanggotaan yang sama (036:237), jadi begitu mantan pekerja aktif
    // lagi di kebun ini, tugas lamanya lolos RLS dan akan terhitung lagi.
    .is('released_at', null)
  );
}

async function countWorkerUnfinishedTasks(
  farmId: string,
  userId: string
): Promise<CountResult> {
  return countActiveWorkerTaskRows(
    supabase
    .from('care_tasks')
    .select('id, care_schedule_id')
    .eq('farm_id', farmId)
    .eq('assigned_to', userId)
    .in('status', ['pending', 'postponed'])
    .is('missed_at', null)
    // Lihat countWorkerTasksDueToday: kasus bergabung kembali.
    .is('released_at', null)
  );
}

// SENGAJA tanpa filter `missed_at is null`, berbeda dari lima penghitung
// tunggakan di atas. Tugas yang sempat hangus lalu tetap dikerjakan pekerja
// punya missed_at terisi DAN status 'completed' — dan itu benar-benar pekerjaan
// yang selesai. Membuangnya dari angka "sudah selesai" akan menghapus jejak
// kerja yang nyata dilakukan.
async function countWorkerCompletedTasks(
  farmId: string,
  userId: string
): Promise<CountResult> {
  return countActiveWorkerTaskRows(
    supabase
    .from('care_tasks')
    .select('id, care_schedule_id')
    .eq('farm_id', farmId)
    .eq('assigned_to', userId)
    .eq('status', 'completed')
  );
}

async function countActiveWorkerTaskRows(
  query: PromiseLike<{ data: WorkerTaskCountRow[] | null; error: { message?: string } | null }>
): Promise<CountResult> {
  const { data, error } = await query;

  if (error) {
    return {
      count: null,
      error,
    };
  }

  const tasks = data ?? [];
  const scheduleIds = Array.from(
    new Set(
      tasks
        .map((task) => task.care_schedule_id)
        .filter((scheduleId): scheduleId is string => Boolean(scheduleId))
    )
  );

  if (scheduleIds.length === 0) {
    return {
      count: tasks.length,
      error: null,
    };
  }

  const schedulesResult = await supabase
    .from('care_schedules')
    .select('id, is_cancelled')
    .in('id', scheduleIds)
    .returns<ScheduleCancellationRow[]>();

  if (schedulesResult.error) {
    return {
      count: null,
      error: schedulesResult.error,
    };
  }

  const cancelledScheduleIds = new Set(
    (schedulesResult.data ?? [])
      .filter((schedule) => schedule.is_cancelled)
      .map((schedule) => schedule.id)
  );

  return {
    count: tasks.filter((task) => !task.care_schedule_id || !cancelledScheduleIds.has(task.care_schedule_id)).length,
    error: null,
  };
}

function findFailedCount(
  results: Array<[label: string, result: CountResult]>
): { label: string; error: Error } | null {
  const failedResult = results.find(([, result]) => result.error);

  if (!failedResult) {
    return null;
  }

  const [label, result] = failedResult;
  return {
    label,
    error: new Error(result.error?.message ?? 'Query agregasi dashboard gagal.'),
  };
}

function readCount(result: CountResult): number {
  return result.count ?? 0;
}
