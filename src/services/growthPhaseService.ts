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
  SoftDeleteRecordInput,
  SuccessData,
  Tree,
  TreeConditionStatus,
  UpdateGrowthPhaseRecordInput,
  UUID,
} from '../types/domain';
import {
  readActivePlanting,
  TREE_SELECT_WITH_ACTIVE_PLANTING,
  type TreePlantingRow,
} from './treePlantingShared';
import { fail, ok } from '../utils/serviceResult';

const GROWTH_PHASE_RECORD_SELECT =
  'id, farm_id, tree_id, recorded_by, phase, note, recorded_at, created_at, updated_at, is_deleted, deleted_at, deleted_by, delete_reason';

// Bentuknya sama persis dengan treeService — sengaja dari satu sumber, bukan
// disalin. Ingat: select ini tidak membatasi ke siklus aktif; filter
// `.is('tree_plantings.ended_at', null)` di query yang melakukannya.
const TREE_SELECT = TREE_SELECT_WITH_ACTIVE_PLANTING;

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
  // Kolom generated (migrasi 054) — hanya dibaca.
  tree_code: string;
  // smallint di database; PostgREST mengirimnya sebagai number.
  row_position: number | null;
  column_position: string | null;
  // Sudah tersaring ke siklus aktif oleh filter di query; paling banyak satu.
  tree_plantings: TreePlantingRow[] | null;
  current_condition: TreeConditionStatus;
  current_growth_phase: GrowthPhase | null;
  // date di database (migrasi 066); PostgREST mengirimnya 'YYYY-MM-DD'.
  //
  // Ikut di sini karena TREE_SELECT_WITH_ACTIVE_PLANTING dipakai bersama dengan
  // treeService. Layar monitoring fase kini MEMAKAINYA sebagai satu-satunya
  // sumber umur fase — sama dengan layar detail pohon — menggantikan query
  // kedua getLastFloweringByTree yang dicabut bersama perubahan itu.
  current_growth_phase_since: string | null;
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

  // is_deleted disaring di query; alasannya sama dengan
  // getConditionReportDetail — catatan terhapus dan id yang tidak ada memberi
  // jawaban yang sama, dengan galat yang sudah dipakai fungsi ini sejak dulu.
  const { data, error } = await supabase
    .from('growth_phase_records')
    .select(GROWTH_PHASE_RECORD_SELECT)
    .eq('id', recordId)
    .eq('is_deleted', false)
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

  const isAuthor = data.recorded_by === currentUserIdResult.data;

  return ok({
    ...mapGrowthPhaseRecord(data),
    canEdit: isAuthor && data.is_deleted !== true,
    canDelete: (isAuthor || accessResult.data.role === 'owner') && data.is_deleted !== true,
  });
}

// Hapus lunak. Izinnya ditegakkan RPC (migrasi 067). Setelah sukses, RPC juga
// memanggil recalculate_tree_current_growth_phase, sehingga trees.
// current_growth_phase dan current_growth_phase_since mundur ke catatan
// sebelumnya di siklus yang sama.
export async function softDeleteGrowthPhaseRecord(
  input: SoftDeleteRecordInput | UUID
): Promise<ServiceResult<SuccessData>> {
  const recordId = typeof input === 'string' ? input : input.recordId;
  const reason = typeof input === 'string' ? null : input.reason ?? null;

  const { error } = await supabase.rpc('soft_delete_growth_phase_record', {
    p_reason: normalizeOptionalText(reason),
    p_record_id: recordId,
  });

  if (error) {
    return fail(error, 'Catatan fase gagal dihapus.');
  }

  return ok({ success: true });
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
    .is('tree_plantings.ended_at', null)
    .in('current_growth_phase', ['flowering', 'fruiting'])
    .order('current_growth_phase', { ascending: true })
    .order('tree_code', { ascending: true })
    .returns<TreeRow[]>();

  if (error) {
    return fail(error, 'Gagal memuat monitoring fase berbunga dan berbuah.');
  }

  // QUERY KEDUA DICABUT. Umur fase kini datang dari kolom
  // current_growth_phase_since yang sudah ikut TREE_SELECT di atas.
  //
  // Sebelumnya di sini ada getLastFloweringByTree: satu query tambahan yang
  // mengambil seluruh catatan fase 'flowering' milik pohon-pohon ini, lalu
  // memakai yang terbaru per pohon. Ia salah dalam dua hal sekaligus.
  //
  // (1) TIDAK MENYARING SIKLUS TANAM. Posisi yang ditanami ulang membuatnya
  //     menghitung dari tanggal berbunga pohon yang SUDAH MATI — angka yang
  //     salah yang terlihat persis seperti angka yang benar. Migrasi 064 dan
  //     066 menutup lubang itu di sisi database untuk current_growth_phase;
  //     query ini berdiri di luar perbaikan itu.
  //
  // (2) MENGUKUR HAL LAIN dari yang ditampilkan layar detail pohon. Ia selalu
  //     mencari fase 'flowering', sedangkan chip di layar detail menghitung umur
  //     fase yang SEDANG BERLAKU. Untuk pohon berbuah keduanya menjawab
  //     pertanyaan berbeda, dan dua layar menampilkan dua angka untuk pohon yang
  //     sama tanpa apa pun yang menjelaskan kenapa.
  //
  // current_growth_phase_since lahir dari baris catatan yang sama yang
  // menetapkan current_growth_phase (migrasi 066), jadi keduanya tidak bisa
  // bercerita berbeda — dan kini kedua layar membaca kolom yang sama.
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

// Mengembalikan KEANGGOTAANNYA, bukan sekadar SuccessData. Pemanggil lama hanya
// memeriksa `.error` dan tidak berubah; getGrowthPhaseRecordDetail memakai
// `role` di dalamnya untuk memutuskan canDelete tanpa query kedua — barisnya
// memang sudah diambil di sini sebagai pemeriksaan akses.
async function ensureActiveOwnerOrWorker(farmId: UUID): Promise<ServiceResult<MembershipRow>> {
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

  return ok(membership);
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
    activePlanting: readActivePlanting(row.tree_plantings),
    currentCondition: row.current_condition,
    currentGrowthPhase: row.current_growth_phase,
    currentGrowthPhaseSince: row.current_growth_phase_since,
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
