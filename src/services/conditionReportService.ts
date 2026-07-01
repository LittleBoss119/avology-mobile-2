import { supabase } from '../lib/supabase';
import { getCurrentProfile } from './authService';
import { getFarmActorDisplayProfiles, getFarmMemberBasicProfiles } from './memberService';
import type {
  CreateTreeConditionReportData,
  CreateTreeConditionReportInput,
  GetTreeConditionReportDetailInput,
  GetTreeConditionReportsInput,
  MemberRole,
  MemberStatus,
  ServiceResult,
  SoftDeleteConditionReportInput,
  SuccessData,
  TreeConditionReport,
  TreeConditionStatus,
  UpdateConditionReportInput,
  UUID,
} from '../types/domain';
import { fail, ok } from '../utils/serviceResult';

const REPORT_SELECT =
  'id, farm_id, tree_id, reported_by, condition_status, note, reported_at, created_at, updated_at, is_deleted, deleted_at, deleted_by, delete_reason';

type TreeConditionReportRow = {
  id: string;
  farm_id: string;
  tree_id: string;
  reported_by: string;
  condition_status: TreeConditionStatus;
  note: string | null;
  reported_at: string;
  created_at?: string;
  updated_at?: string | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
  delete_reason?: string | null;
};

type TreeFarmRow = {
  id: string;
  farm_id: string;
};

type MembershipRow = {
  status: MemberStatus;
};

type ReporterDisplay = {
  fullName: string | null;
  role: MemberRole | null;
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
      reported_at: normalizeOptionalText(input.reportedAt) ?? new Date().toISOString(),
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
    .eq('is_deleted', false)
    .order('reported_at', { ascending: false })
    .returns<TreeConditionReportRow[]>();

  if (error) {
    return fail(error, 'Gagal memuat riwayat kondisi pohon.');
  }

  const reports = (data ?? []).map(mapTreeConditionReport);
  const reporterDisplays = await getConditionReporterDisplays(
    treeFarmIdResult.data,
    reports.map((report) => report.reportedBy)
  );

  return ok(
    reports.map((report) => ({
      ...report,
      reportedByName: reporterDisplays[report.reportedBy]?.fullName ?? null,
      reportedByRole: reporterDisplays[report.reportedBy]?.role ?? null,
    }))
  );
}

export async function getConditionReportDetail(
  input: GetTreeConditionReportDetailInput | UUID
): Promise<ServiceResult<TreeConditionReport>> {
  const reportId = typeof input === 'string' ? input : input.reportId;
  const currentUserIdResult = await getCurrentUserId();

  if (currentUserIdResult.error) {
    return fail(currentUserIdResult.error);
  }

  const { data, error } = await supabase
    .from('tree_condition_reports')
    .select(REPORT_SELECT)
    .eq('id', reportId)
    .maybeSingle<TreeConditionReportRow>();

  if (error) {
    return fail(error, 'Gagal memuat detail laporan kondisi pohon.');
  }

  if (!data) {
    return fail(new Error('Laporan kondisi pohon tidak ditemukan atau tidak dapat diakses.'));
  }

  const accessResult = await ensureActiveFarmMember(data.farm_id);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  return ok({
    ...mapTreeConditionReport(data),
    canEdit: data.reported_by === currentUserIdResult.data && data.is_deleted !== true,
  });
}

export async function updateOwnConditionReport(
  input: UpdateConditionReportInput
): Promise<ServiceResult<SuccessData>> {
  if (!input.conditionStatus) {
    return fail(new Error('Kondisi pohon wajib dipilih.'));
  }

  const { error } = await supabase.rpc('update_own_tree_condition_report', {
    p_condition_status: input.conditionStatus,
    p_note: normalizeOptionalText(input.note),
    p_report_id: input.reportId,
    p_reported_at: normalizeOptionalText(input.reportedAt),
  });

  if (error) {
    return fail(error, 'Laporan kondisi pohon gagal diperbarui.');
  }

  return ok({ success: true });
}

export async function softDeleteOwnConditionReport(
  input: SoftDeleteConditionReportInput
): Promise<ServiceResult<SuccessData>> {
  const { error } = await supabase.rpc('soft_delete_own_tree_condition_report', {
    p_reason: normalizeOptionalText(input.reason),
    p_report_id: input.reportId,
  });

  if (error) {
    return fail(error, 'Laporan kondisi pohon gagal dihapus.');
  }

  return ok({ success: true });
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
    reportedByRole: null,
    conditionStatus: row.condition_status,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by,
    deleteReason: row.delete_reason,
    note: row.note,
    reportedAt: row.reported_at,
    updatedAt: row.updated_at,
    isDeleted: row.is_deleted ?? false,
  };
}

async function getConditionReporterDisplays(
  farmId: UUID,
  reporterIds: UUID[]
): Promise<Record<string, ReporterDisplay>> {
  const uniqueReporterIds = Array.from(new Set(reporterIds));

  if (uniqueReporterIds.length === 0) {
    return {};
  }

  const reporterDisplays: Record<string, ReporterDisplay> = {};

  const profileResult = await getCurrentProfile();

  if (profileResult.data?.fullName) {
    reporterDisplays[profileResult.data.id] = {
      fullName: profileResult.data.fullName,
      role: null,
    };
  }

  const actorProfilesResult = await getFarmActorDisplayProfiles(farmId);

  if (actorProfilesResult.data) {
    for (const profile of actorProfilesResult.data) {
      reporterDisplays[profile.userId] = {
        fullName: profile.fullName,
        role: profile.role,
      };
    }
  } else {
    const memberProfilesResult = await getFarmMemberBasicProfiles(farmId);

    if (memberProfilesResult.data) {
      for (const profile of memberProfilesResult.data) {
        reporterDisplays[profile.userId] = {
          fullName: profile.fullName,
          role: null,
        };
      }
    }
  }

  return Object.fromEntries(
    uniqueReporterIds
      .map((reporterId) => [reporterId, reporterDisplays[reporterId]])
      .filter((entry): entry is [string, ReporterDisplay] => Boolean(entry[1]))
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
