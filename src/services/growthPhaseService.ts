import { supabase } from '../lib/supabase';
import type {
  CreateGrowthPhaseRecordData,
  CreateGrowthPhaseRecordInput,
  FloweringMonitoringTree,
  GetFloweringAndFruitingTreesInput,
  GetGrowthPhaseRecordDetailInput,
  GetGrowthPhaseRecordsInput,
  GrowthPhase,
  GrowthPhaseRecord,
  MemberRole,
  MemberStatus,
  ServiceResult,
  SuccessData,
  Tree,
  TreeConditionStatus,
  UpdateGrowthPhaseRecordInput,
  UUID,
} from '../types/domain';
import { fail, ok } from '../utils/serviceResult';

const GROWTH_PHASE_RECORD_SELECT =
  'id, farm_id, tree_id, recorded_by, phase, note, recorded_at, created_at, updated_at, is_deleted, deleted_at, deleted_by, delete_reason';

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
  created_at?: string;
  updated_at?: string | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
  delete_reason?: string | null;
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
      recorded_at: normalizeOptionalText(input.recordedAt) ?? new Date().toISOString(),
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
    .eq('is_deleted', false)
    .order('recorded_at', { ascending: false })
    .returns<GrowthPhaseRecordRow[]>();

  if (error) {
    return fail(error, 'Gagal memuat riwayat fase pertumbuhan.');
  }

  return ok((data ?? []).map(mapGrowthPhaseRecord));
}

export async function getGrowthPhaseRecordDetail(
  input: GetGrowthPhaseRecordDetailInput | UUID
): Promise<ServiceResult<GrowthPhaseRecord>> {
  const recordId = typeof input === 'string' ? input : input.recordId;
  const currentUserIdResult = await getCurrentUserId();

  if (currentUserIdResult.error) {
    return fail(currentUserIdResult.error);
  }

  const { data, error } = await supabase
    .from('growth_phase_records')
    .select(GROWTH_PHASE_RECORD_SELECT)
    .eq('id', recordId)
    .maybeSingle<GrowthPhaseRecordRow>();

  if (error) {
    return fail(error, 'Gagal memuat detail fase pertumbuhan.');
  }

  if (!data) {
    return fail(new Error('Catatan fase pertumbuhan tidak ditemukan atau tidak dapat diakses.'));
  }

  const accessResult = await ensureActiveOwnerOrWorker(data.farm_id);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  return ok({
    ...mapGrowthPhaseRecord(data),
    canEdit: data.recorded_by === currentUserIdResult.data && data.is_deleted !== true,
  });
}

export async function updateOwnGrowthPhaseRecord(
  input: UpdateGrowthPhaseRecordInput
): Promise<ServiceResult<SuccessData>> {
  if (!isGrowthPhase(input.phase)) {
    return fail(new Error('Fase pertumbuhan wajib dipilih dengan nilai yang valid.'));
  }

  const { error } = await supabase.rpc('update_own_growth_phase_record', {
    p_note: normalizeOptionalText(input.note),
    p_phase: input.phase,
    p_record_id: input.recordId,
    p_recorded_at: normalizeOptionalText(input.recordedAt),
  });

  if (error) {
    return fail(error, 'Catatan fase pertumbuhan gagal diperbarui.');
  }

  return ok({ success: true });
}

export async function getFloweringAndFruitingTrees(
  input: GetFloweringAndFruitingTreesInput
): Promise<ServiceResult<FloweringMonitoringTree[]>> {
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

  const treeRows = data ?? [];

  // RF-11a: perkaya tiap pohon dengan recorded_at fase 'flowering' terakhir.
  const lastFloweringResult = await getLastFloweringByTree(treeRows.map((row) => row.id));

  if (lastFloweringResult.error) {
    return fail(lastFloweringResult.error);
  }

  const lastFloweringByTree = lastFloweringResult.data;

  return ok(
    treeRows.map((row) => ({
      ...mapTree(row),
      lastFloweringAt: lastFloweringByTree.get(row.id) ?? null,
    }))
  );
}

// Query kedua (pola secondary-query yang sudah dipakai di repo): ambil semua
// record fase 'flowering' untuk pohon-pohon tsb, terurut recorded_at desc,
// lalu ambil kemunculan pertama per pohon = tanggal berbunga TERAKHIR.
async function getLastFloweringByTree(
  treeIds: string[]
): Promise<ServiceResult<Map<string, string>>> {
  if (treeIds.length === 0) {
    return ok(new Map());
  }

  const { data, error } = await supabase
    .from('growth_phase_records')
    .select('tree_id, recorded_at')
    .in('tree_id', treeIds)
    .eq('phase', 'flowering')
    .eq('is_deleted', false)
    .order('recorded_at', { ascending: false })
    .returns<{ tree_id: string; recorded_at: string }[]>();

  if (error) {
    return fail(error, 'Gagal memuat tanggal berbunga terakhir.');
  }

  const lastFloweringByTree = new Map<string, string>();

  for (const row of data ?? []) {
    if (!lastFloweringByTree.has(row.tree_id)) {
      lastFloweringByTree.set(row.tree_id, row.recorded_at);
    }
  }

  return ok(lastFloweringByTree);
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isDeleted: row.is_deleted ?? false,
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by,
    deleteReason: row.delete_reason,
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
