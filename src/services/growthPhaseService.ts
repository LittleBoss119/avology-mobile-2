import { supabase } from '../lib/supabase';
import type {
  CreateGrowthPhaseRecordData,
  CreateGrowthPhaseRecordInput,
  GetFloweringAndFruitingTreesInput,
  GetGrowthPhaseRecordsInput,
  GrowthPhase,
  GrowthPhaseRecord,
  MemberRole,
  MemberStatus,
  ServiceResult,
  SuccessData,
  Tree,
  TreeConditionStatus,
  UUID,
} from '../types/domain';
import { fail, ok } from '../utils/serviceResult';

const GROWTH_PHASE_RECORD_SELECT =
  'id, farm_id, tree_id, recorded_by, phase, note, recorded_at';

const TREE_SELECT =
  'id, farm_id, tree_code, row_position, column_position, variety, planted_at, current_condition, current_growth_phase, is_archived, created_at, updated_at';

const growthPhases: GrowthPhase[] = [
  'initial_planting',
  'vegetative',
  'flowering',
  'fruiting',
  'harvesting',
];

type GrowthPhaseRecordRow = {
  id: string;
  farm_id: string;
  tree_id: string;
  recorded_by: string;
  phase: GrowthPhase;
  note: string | null;
  recorded_at: string;
};

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

export async function createGrowthPhaseRecord(
  input: CreateGrowthPhaseRecordInput
): Promise<ServiceResult<CreateGrowthPhaseRecordData>> {
  if (!isGrowthPhase(input.phase)) {
    return fail(new Error('Fase pertumbuhan wajib dipilih dengan nilai yang valid.'));
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

  const accessResult = await ensureActiveOwnerOrWorker(input.farmId);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const { data, error } = await supabase
    .from('growth_phase_records')
    .insert({
      farm_id: input.farmId,
      tree_id: input.treeId,
      recorded_by: userIdResult.data,
      phase: input.phase,
      note: normalizeOptionalText(input.note),
    })
    .select('id')
    .single<{ id: string }>();

  if (error) {
    return fail(error, 'Gagal menyimpan catatan fase pertumbuhan.');
  }

  return ok({
    recordId: data.id,
  });
}

export async function getGrowthPhaseRecords(
  input: GetGrowthPhaseRecordsInput
): Promise<ServiceResult<GrowthPhaseRecord[]>> {
  const treeFarmIdResult = await getAccessibleTreeFarmId(input.treeId);

  if (treeFarmIdResult.error) {
    return fail(treeFarmIdResult.error);
  }

  const accessResult = await ensureActiveOwnerOrWorker(treeFarmIdResult.data);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const { data, error } = await supabase
    .from('growth_phase_records')
    .select(GROWTH_PHASE_RECORD_SELECT)
    .eq('tree_id', input.treeId)
    .order('recorded_at', { ascending: false })
    .returns<GrowthPhaseRecordRow[]>();

  if (error) {
    return fail(error, 'Gagal memuat riwayat fase pertumbuhan.');
  }

  return ok((data ?? []).map(mapGrowthPhaseRecord));
}

export async function getFloweringAndFruitingTrees(
  input: GetFloweringAndFruitingTreesInput
): Promise<ServiceResult<Tree[]>> {
  const accessResult = await ensureActiveOwner(input.farmId);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const { data, error } = await supabase
    .from('trees')
    .select(TREE_SELECT)
    .eq('farm_id', input.farmId)
    .eq('is_archived', false)
    .in('current_growth_phase', ['flowering', 'fruiting'])
    .order('current_growth_phase', { ascending: true })
    .order('tree_code', { ascending: true })
    .returns<TreeRow[]>();

  if (error) {
    return fail(error, 'Gagal memuat monitoring fase berbunga dan berbuah.');
  }

  return ok((data ?? []).map(mapTree));
}

async function ensureActiveOwner(farmId: UUID): Promise<ServiceResult<SuccessData>> {
  const membershipResult = await getCurrentUserMembership(farmId);

  if (membershipResult.error) {
    return fail(membershipResult.error);
  }

  if (membershipResult.data?.role !== 'owner' || membershipResult.data.status !== 'active') {
    return fail(new Error('Hanya pemilik aktif yang dapat mengakses monitoring fase.'));
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

async function ensureActiveOwnerOrWorker(farmId: UUID): Promise<ServiceResult<SuccessData>> {
  const membershipResult = await getCurrentUserMembership(farmId);

  if (membershipResult.error) {
    return fail(membershipResult.error);
  }

  const membership = membershipResult.data;

  if (
    !membership ||
    membership.status !== 'active' ||
    (membership.role !== 'owner' && membership.role !== 'worker')
  ) {
    return fail(new Error('Hanya pemilik atau pekerja aktif yang dapat mengakses fase pertumbuhan.'));
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

function mapGrowthPhaseRecord(row: GrowthPhaseRecordRow): GrowthPhaseRecord {
  return {
    id: row.id,
    farmId: row.farm_id,
    treeId: row.tree_id,
    recordedBy: row.recorded_by,
    phase: row.phase,
    note: row.note,
    recordedAt: row.recorded_at,
  };
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

function isGrowthPhase(value: string): value is GrowthPhase {
  return growthPhases.includes(value as GrowthPhase);
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
