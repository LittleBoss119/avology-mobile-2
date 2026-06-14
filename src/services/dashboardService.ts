import { supabase } from '../lib/supabase';
import {
  getCareSOPNextScheduleReference,
  getCareSOPs,
} from './careSopService';
import type {
  GetOwnerDashboardSummaryInput,
  GetWorkerDashboardSummaryInput,
  OwnerDashboardSummary,
  ServiceResult,
  WorkerDashboardSummary,
} from '../types/domain';
import { fail, ok } from '../utils/serviceResult';

type CountResult = {
  count: number | null;
  error: { message?: string } | null;
};

export async function getOwnerDashboardSummary(
  input: GetOwnerDashboardSummaryInput
): Promise<ServiceResult<OwnerDashboardSummary>> {
  const today = getTodayIsoDate();

  const [
    totalTrees,
    healthyTrees,
    problemTrees,
    todayTasks,
    unfinishedTasks,
    newOperationalReports,
    pendingWorkers,
    floweringTrees,
    fruitingTrees,
    dueOrOverdueSops,
  ] = await Promise.all([
    countActiveTrees(input.farmId),
    countHealthyTrees(input.farmId),
    countProblemTrees(input.farmId),
    countFarmTasksDueToday(input.farmId, today),
    countFarmUnfinishedTasks(input.farmId),
    countNewOperationalReports(input.farmId),
    countPendingWorkers(input.farmId),
    countTreesByGrowthPhase(input.farmId, 'flowering'),
    countTreesByGrowthPhase(input.farmId, 'fruiting'),
    countDueOrOverdueSops(input.farmId),
  ]);

  const failure = findFailedCount([
    ['total pohon', totalTrees],
    ['pohon sehat', healthyTrees],
    ['pohon bermasalah', problemTrees],
    ['tugas hari ini', todayTasks],
    ['tugas belum selesai', unfinishedTasks],
    ['laporan operasional baru', newOperationalReports],
    ['worker pending', pendingWorkers],
    ['pohon flowering', floweringTrees],
    ['pohon fruiting', fruitingTrees],
    ['SOP jatuh tempo atau terlambat', dueOrOverdueSops],
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
    newOperationalReports: readCount(newOperationalReports),
    pendingWorkers: readCount(pendingWorkers),
    floweringTrees: readCount(floweringTrees),
    fruitingTrees: readCount(fruitingTrees),
    dueOrOverdueSops: readCount(dueOrOverdueSops),
  });
}

export async function getWorkerDashboardSummary(
  input: GetWorkerDashboardSummaryInput
): Promise<ServiceResult<WorkerDashboardSummary>> {
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
  return supabase
    .from('care_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('farm_id', farmId)
    .eq('due_date', today);
}

async function countFarmUnfinishedTasks(farmId: string): Promise<CountResult> {
  return supabase
    .from('care_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('farm_id', farmId)
    .in('status', ['pending', 'postponed']);
}

async function countNewOperationalReports(farmId: string): Promise<CountResult> {
  return supabase
    .from('operational_reports')
    .select('id', { count: 'exact', head: true })
    .eq('farm_id', farmId)
    .eq('status', 'new');
}

async function countPendingWorkers(farmId: string): Promise<CountResult> {
  return supabase
    .from('farm_members')
    .select('id', { count: 'exact', head: true })
    .eq('farm_id', farmId)
    .eq('role', 'worker')
    .eq('status', 'pending');
}

async function countWorkerTasksDueToday(
  farmId: string,
  userId: string,
  today: string
): Promise<CountResult> {
  return supabase
    .from('care_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('farm_id', farmId)
    .eq('assigned_to', userId)
    .eq('due_date', today);
}

async function countWorkerUnfinishedTasks(
  farmId: string,
  userId: string
): Promise<CountResult> {
  return supabase
    .from('care_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('farm_id', farmId)
    .eq('assigned_to', userId)
    .in('status', ['pending', 'postponed']);
}

async function countWorkerCompletedTasks(
  farmId: string,
  userId: string
): Promise<CountResult> {
  return supabase
    .from('care_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('farm_id', farmId)
    .eq('assigned_to', userId)
    .eq('status', 'completed');
}

async function countDueOrOverdueSops(farmId: string): Promise<CountResult> {
  const sopsResult = await getCareSOPs({
    activeOnly: true,
    farmId,
  });

  if (sopsResult.error) {
    return {
      count: null,
      error: new Error(sopsResult.error.message),
    };
  }

  const references = await Promise.all(
    sopsResult.data.map((sop) => getCareSOPNextScheduleReference({ sopId: sop.id }))
  );

  const failedReference = references.find((reference) => reference.error);

  if (failedReference?.error) {
    return {
      count: null,
      error: new Error(failedReference.error.message),
    };
  }

  return {
    count: references.filter(
      (reference) =>
        reference.data?.status === 'due_today' || reference.data?.status === 'overdue'
    ).length,
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

function getTodayIsoDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
