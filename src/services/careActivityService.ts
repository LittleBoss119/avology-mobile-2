import { supabase } from '../lib/supabase';
import type {
  CareActivity,
  CareCategory,
  CreateCareActivityData,
  CreateCareActivityInput,
  GetCareActivitiesByTreeInput,
  ServiceResult,
  UUID,
} from '../types/domain';
import { fail, ok } from '../utils/serviceResult';

// Pencatatan realisasi perawatan (care_activities), baik yang berasal dari
// tugas terjadwal maupun inisiatif. Menggantikan manualCareService.
//
// Tanggung jawab penjadwalan (SOP -> jadwal -> tugas) tetap di careTaskService
// dan careScheduleService; service ini khusus realisasi.
//
// DISENGAJA: tidak ada update/soft-delete untuk catatan inisiatif.
// care_activities tidak punya is_deleted/updated_at dan grant-nya hanya
// select+insert (lihat migrasi 027). Penyederhanaan ini menggantikan
// update_own_manual_care_record / soft_delete_own_manual_care_record dan akan
// dievaluasi ulang setelah uji pakai user.

const CARE_ACTIVITY_SELECT =
  'id, farm_id, care_task_id, performed_by, status, note, performed_at, asal, category, produk';

const careCategories: CareCategory[] = [
  'watering',
  'fertilizing',
  'spraying',
  'weeding',
  'other',
];

type CareActivityRow = {
  id: string;
  farm_id: string;
  care_task_id: string | null;
  performed_by: string;
  status: CareActivity['status'];
  note: string | null;
  performed_at: string;
  asal: CareActivity['asal'];
  category: CareCategory | null;
  produk: string | null;
};

export async function createCareActivity(
  input: CreateCareActivityInput
): Promise<ServiceResult<CreateCareActivityData>> {
  if (!isCareCategory(input.category)) {
    return fail(new Error('Jenis perawatan wajib dipilih.'));
  }

  const treeIds = normalizeTreeIds(input.treeIds);

  if (treeIds.length === 0) {
    return fail(new Error('Minimal satu pohon harus dipilih.'));
  }

  // Satu baris care_activities + N baris care_activity_trees harus atomik.
  // Klien Supabase tidak bisa membungkus banyak statement dalam satu
  // transaksi, jadi penulisan dilakukan lewat RPC (migrasi 027).
  const { data, error } = await supabase.rpc('create_care_activity', {
    p_category: input.category,
    p_farm_id: input.farmId,
    p_note: normalizeOptionalText(input.note),
    p_performed_at: normalizeOptionalText(input.performedAt),
    p_produk: normalizeOptionalText(input.produk),
    p_tree_ids: treeIds,
  });

  if (error) {
    return fail(error, 'Gagal menyimpan catatan perawatan.');
  }

  return ok({ activityId: data as UUID });
}

export async function getCareActivitiesByTree(
  input: GetCareActivitiesByTreeInput | UUID
): Promise<ServiceResult<CareActivity[]>> {
  const treeId = typeof input === 'string' ? input : input.treeId;

  const { data, error } = await supabase
    .from('care_activities')
    .select(`${CARE_ACTIVITY_SELECT}, care_activity_trees!inner(tree_id)`)
    .eq('care_activity_trees.tree_id', treeId)
    .order('performed_at', { ascending: false })
    .returns<CareActivityRow[]>();

  if (error) {
    return fail(error, 'Gagal memuat riwayat perawatan.');
  }

  return ok((data ?? []).map(mapCareActivity));
}

function mapCareActivity(row: CareActivityRow): CareActivity {
  return {
    asal: row.asal,
    careTaskId: row.care_task_id,
    category: row.category,
    farmId: row.farm_id,
    id: row.id,
    note: row.note,
    performedAt: row.performed_at,
    performedBy: row.performed_by,
    produk: row.produk,
    status: row.status,
  };
}

function normalizeTreeIds(treeIds: UUID[] | null | undefined): UUID[] {
  if (!Array.isArray(treeIds)) {
    return [];
  }

  // Dedup di klien juga; RPC tetap memakai `select distinct` sebagai jaring
  // pengaman terhadap tabrakan primary key jembatan.
  return Array.from(
    new Set(treeIds.map((treeId) => treeId?.trim()).filter((treeId): treeId is UUID => Boolean(treeId)))
  );
}

function isCareCategory(value: string | null | undefined): value is CareCategory {
  return careCategories.includes(value as CareCategory);
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
