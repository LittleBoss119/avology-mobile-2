import { supabase } from '../lib/supabase';
import type {
  CreateTreeData,
  CreateTreeInput,
  GetTreeDetailInput,
  GetTreesInput,
  GrowthPhase,
  MemberRole,
  MemberStatus,
  ServiceResult,
  SuccessData,
  Tree,
  TreeArchiveInput,
  TreeConditionStatus,
  UpdateTreeInput,
  UUID,
} from '../types/domain';
import { fail, ok } from '../utils/serviceResult';

const TREE_SELECT =
  'id, farm_id, tree_code, row_position, column_position, variety, planted_at, current_condition, current_growth_phase, is_archived, created_at, updated_at';

type TreeRow = {
  id: string;
  farm_id: string;
  tree_code: string;
  row_position: string | null;
  column_position: string | null;
  variety: string | null;
  planted_at: string | null;
  current_condition: TreeConditionStatus;
  current_growth_phase: GrowthPhase | null;
  is_archived: boolean;
  created_at?: string;
  updated_at?: string | null;
};

type TreeFarmRow = {
  id: string;
  farm_id: string;
};

type MembershipRow = {
  role: MemberRole;
  status: MemberStatus;
};

type TreeUpdateRow = Partial<{
  tree_code: string;
  row_position: string | null;
  column_position: string | null;
  variety: string | null;
  planted_at: string | null;
}>;

export async function getTrees(input: GetTreesInput): Promise<ServiceResult<Tree[]>> {
  const accessResult = await ensureActiveFarmMember(input.farmId);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  let query = supabase.from('trees').select(TREE_SELECT).eq('farm_id', input.farmId);

  const search = normalizeOptionalText(input.search);

  if (search) {
    const sanitizedSearch = sanitizeSearchTerm(search);

    if (sanitizedSearch) {
      const pattern = `%${sanitizedSearch}%`;
      query = query.or(
        [
          `tree_code.ilike.${pattern}`,
          `row_position.ilike.${pattern}`,
          `column_position.ilike.${pattern}`,
          `variety.ilike.${pattern}`,
        ].join(',')
      );
    }
  }

  if (input.condition && input.condition !== 'all') {
    query = query.eq('current_condition', input.condition);
  }

  if (input.growthPhase && input.growthPhase !== 'all') {
    query = query.eq('current_growth_phase', input.growthPhase);
  }

  if (typeof input.archived === 'boolean') {
    query = query.eq('is_archived', input.archived);
  }

  const { data, error } = await query
    .order('tree_code', { ascending: true })
    .order('created_at', { ascending: false })
    .returns<TreeRow[]>();

  if (error) {
    return fail(error, 'Gagal memuat daftar pohon.');
  }

  return ok((data ?? []).map(mapTree));
}

export async function getTreeDetail(
  input: GetTreeDetailInput
): Promise<ServiceResult<Tree>> {
  const { data, error } = await supabase
    .from('trees')
    .select(TREE_SELECT)
    .eq('id', input.treeId)
    .maybeSingle<TreeRow>();

  if (error) {
    return fail(error, 'Gagal memuat detail pohon.');
  }

  if (!data) {
    return fail(new Error('Data pohon tidak ditemukan atau tidak dapat diakses.'));
  }

  return ok(mapTree(data));
}

export async function createTree(
  input: CreateTreeInput
): Promise<ServiceResult<CreateTreeData>> {
  const treeCode = normalizeOptionalText(input.treeCode);

  if (!treeCode) {
    return fail(new Error('Kode pohon wajib diisi.'));
  }

  const accessResult = await ensureActiveOwner(input.farmId);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const { data, error } = await supabase
    .from('trees')
    .insert({
      farm_id: input.farmId,
      tree_code: treeCode,
      row_position: normalizeOptionalText(input.rowPosition),
      column_position: normalizeOptionalText(input.columnPosition),
      variety: normalizeOptionalText(input.variety),
      planted_at: normalizeOptionalText(input.plantedAt),
    })
    .select('id')
    .single<{ id: string }>();

  if (error) {
    return fail(error, 'Gagal menambahkan pohon.');
  }

  return ok({
    treeId: data.id,
  });
}

export async function updateTree(
  input: UpdateTreeInput
): Promise<ServiceResult<SuccessData>> {
  const farmIdResult = await getAccessibleTreeFarmId(input.treeId);

  if (farmIdResult.error) {
    return fail(farmIdResult.error);
  }

  const accessResult = await ensureActiveOwner(farmIdResult.data);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const updates = buildTreeUpdates(input);

  if (updates instanceof Error) {
    return fail(updates);
  }

  if (Object.keys(updates).length === 0) {
    return ok({
      success: true,
    });
  }

  const { error } = await supabase.from('trees').update(updates).eq('id', input.treeId);

  if (error) {
    return fail(error, 'Gagal memperbarui data pohon.');
  }

  return ok({
    success: true,
  });
}

export async function archiveTree(
  input: TreeArchiveInput
): Promise<ServiceResult<SuccessData>> {
  return setTreeArchived(input.treeId, true);
}

export async function restoreTree(
  input: TreeArchiveInput
): Promise<ServiceResult<SuccessData>> {
  return setTreeArchived(input.treeId, false);
}

async function setTreeArchived(
  treeId: UUID,
  isArchived: boolean
): Promise<ServiceResult<SuccessData>> {
  const farmIdResult = await getAccessibleTreeFarmId(treeId);

  if (farmIdResult.error) {
    return fail(farmIdResult.error);
  }

  const accessResult = await ensureActiveOwner(farmIdResult.data);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const { error } = await supabase.from('trees').update({ is_archived: isArchived }).eq('id', treeId);

  if (error) {
    return fail(error, isArchived ? 'Gagal mengarsipkan pohon.' : 'Gagal mengaktifkan kembali pohon.');
  }

  return ok({
    success: true,
  });
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
    return fail(new Error('Hanya anggota kebun aktif yang dapat mengakses data pohon.'));
  }

  return ok({
    success: true,
  });
}

async function ensureActiveOwner(farmId: UUID): Promise<ServiceResult<SuccessData>> {
  const membershipResult = await getCurrentUserMembership(farmId);

  if (membershipResult.error) {
    return fail(membershipResult.error);
  }

  if (membershipResult.data?.role !== 'owner' || membershipResult.data.status !== 'active') {
    return fail(new Error('Hanya pemilik aktif yang dapat mengelola data pohon.'));
  }

  return ok({
    success: true,
  });
}

async function getCurrentUserMembership(
  farmId: UUID
): Promise<ServiceResult<MembershipRow | null>> {
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

  const { data, error } = await supabase
    .from('farm_members')
    .select('role, status')
    .eq('farm_id', farmId)
    .eq('user_id', userId)
    .maybeSingle<MembershipRow>();

  if (error) {
    return fail(error, 'Gagal memeriksa akses kebun.');
  }

  return ok(data);
}

function buildTreeUpdates(input: UpdateTreeInput): TreeUpdateRow | Error {
  const updates: TreeUpdateRow = {};

  if (input.treeCode !== undefined) {
    const treeCode = normalizeOptionalText(input.treeCode);

    if (!treeCode) {
      return new Error('Kode pohon wajib diisi.');
    }

    updates.tree_code = treeCode;
  }

  if (input.rowPosition !== undefined) {
    updates.row_position = normalizeOptionalText(input.rowPosition);
  }

  if (input.columnPosition !== undefined) {
    updates.column_position = normalizeOptionalText(input.columnPosition);
  }

  if (input.variety !== undefined) {
    updates.variety = normalizeOptionalText(input.variety);
  }

  if (input.plantedAt !== undefined) {
    updates.planted_at = normalizeOptionalText(input.plantedAt);
  }

  return updates;
}

function mapTree(row: TreeRow): Tree {
  return {
    id: row.id,
    farmId: row.farm_id,
    treeCode: row.tree_code,
    rowPosition: row.row_position,
    columnPosition: row.column_position,
    variety: row.variety,
    plantedAt: row.planted_at,
    currentCondition: row.current_condition,
    currentGrowthPhase: row.current_growth_phase,
    isArchived: row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function sanitizeSearchTerm(value: string): string {
  return value.replace(/[%,()]/g, ' ').trim();
}

function isMissingSessionError(error: { message?: string; name?: string }): boolean {
  return (
    error.name === 'AuthSessionMissingError' ||
    error.message?.toLowerCase().includes('auth session missing') === true
  );
}
