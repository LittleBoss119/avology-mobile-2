import { supabase } from '../lib/supabase';
import { getCurrentProfile } from './authService';
import { getActiveWorkers } from './memberService';
import type {
  CreateTreeConditionReportData,
  CreateTreeConditionReportInput,
  GetTreeConditionReportsInput,
  MemberStatus,
  ServiceResult,
  SuccessData,
  TreeConditionReport,
  TreeConditionStatus,
  UUID,
  WorkerMembership,
} from '../types/domain';
import { fail, ok } from '../utils/serviceResult';

const REPORT_SELECT =
  'id, farm_id, tree_id, reported_by, condition_status, note, reported_at';

type TreeConditionReportRow = {
  id: string;
  farm_id: string;
  tree_id: string;
  reported_by: string;
  condition_status: TreeConditionStatus;
  note: string | null;
  reported_at: string;
};

type TreeFarmRow = {
  id: string;
  farm_id: string;
};

type MembershipRow = {
  status: MemberStatus;
};

export async function createTreeConditionReport(
  input: CreateTreeConditionReportInput
): Promise<ServiceResult<CreateTreeConditionReportData>> {
  if (!input.conditionStatus) {
    return fail(new Error('Kondisi pohon wajib dipilih.'));
  }

  const userIdResult = await getCurrentUserId();

  if (userIdResult.error) {
    return fail(userIdResult.error);
  }

  const treeFarmIdResult = await getAccessibleTreeFarmId(input.treeId);

  if (treeFarmIdResult.error) {
    return fail(treeFarmIdResult.error);
  }

  if (treeFarmIdResult.data !== input.farmId) {
    return fail(new Error('Pohon tidak terdaftar pada kebun yang dipilih.'));
  }

  const accessResult = await ensureActiveFarmMember(input.farmId);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const { data, error } = await supabase
    .from('tree_condition_reports')
    .insert({
      farm_id: input.farmId,
      tree_id: input.treeId,
      reported_by: userIdResult.data,
      condition_status: input.conditionStatus,
      note: normalizeOptionalText(input.note),
    })
    .select('id')
    .single<{ id: string }>();

  if (error) {
    return fail(error, 'Gagal menyimpan laporan kondisi pohon.');
  }

  return ok({
    reportId: data.id,
  });
}

export async function getTreeConditionReports(
  input: GetTreeConditionReportsInput
): Promise<ServiceResult<TreeConditionReport[]>> {
  const treeFarmIdResult = await getAccessibleTreeFarmId(input.treeId);

  if (treeFarmIdResult.error) {
    return fail(treeFarmIdResult.error);
  }

  const accessResult = await ensureActiveFarmMember(treeFarmIdResult.data);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const { data, error } = await supabase
    .from('tree_condition_reports')
    .select(REPORT_SELECT)
    .eq('tree_id', input.treeId)
    .order('reported_at', { ascending: false })
    .returns<TreeConditionReportRow[]>();

  if (error) {
    return fail(error, 'Gagal memuat riwayat kondisi pohon.');
  }

  const reports = (data ?? []).map(mapTreeConditionReport);
  const reporterNames = await getConditionReporterNames(
    treeFarmIdResult.data,
    reports.map((report) => report.reportedBy)
  );

  return ok(
    reports.map((report) => ({
      ...report,
      reportedByName: reporterNames[report.reportedBy] ?? null,
    }))
  );
}

async function getAccessibleTreeFarmId(treeId: UUID): Promise<ServiceResult<UUID>> {
  const { data, error } = await supabase
    .from('trees')
    .select('id, farm_id')
    .eq('id', treeId)
    .maybeSingle<TreeFarmRow>();

  if (error) {
    return fail(error, 'Gagal memeriksa akses pohon.');
  }

  if (!data) {
    return fail(new Error('Data pohon tidak ditemukan atau tidak dapat diakses.'));
  }

  return ok(data.farm_id);
}

async function ensureActiveFarmMember(farmId: UUID): Promise<ServiceResult<SuccessData>> {
  const membershipResult = await getCurrentUserMembership(farmId);

  if (membershipResult.error) {
    return fail(membershipResult.error);
  }

  if (membershipResult.data?.status !== 'active') {
    return fail(new Error('Hanya anggota kebun aktif yang dapat mengakses laporan kondisi pohon.'));
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
    .select('status')
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

function mapTreeConditionReport(row: TreeConditionReportRow): TreeConditionReport {
  return {
    id: row.id,
    farmId: row.farm_id,
    treeId: row.tree_id,
    reportedBy: row.reported_by,
    reportedByName: null,
    conditionStatus: row.condition_status,
    note: row.note,
    reportedAt: row.reported_at,
  };
}

async function getConditionReporterNames(
  farmId: UUID,
  reporterIds: UUID[]
): Promise<Record<string, string>> {
  const uniqueReporterIds = Array.from(new Set(reporterIds));

  if (uniqueReporterIds.length === 0) {
    return {};
  }

  const reporterNames: Record<string, string> = {};

  const profileResult = await getCurrentProfile();

  if (profileResult.data?.fullName) {
    reporterNames[profileResult.data.id] = profileResult.data.fullName;
  }

  const workersResult = await getActiveWorkers(farmId);

  if (workersResult.data) {
    for (const worker of workersResult.data as WorkerMembership[]) {
      if (worker.fullName) {
        reporterNames[worker.userId] = worker.fullName;
      }
    }
  }

  return Object.fromEntries(
    uniqueReporterIds
      .map((reporterId) => [reporterId, reporterNames[reporterId]])
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
  );
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
