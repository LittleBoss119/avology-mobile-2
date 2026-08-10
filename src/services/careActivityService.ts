import { supabase } from '../lib/supabase';
import type {
  CareActivity,
  CareActivityDetail,
  CareCategory,
  CreateCareActivityData,
  CreateCareActivityInput,
  GetCareActivityDetailInput,
  ServiceResult,
  UUID,
} from '../types/domain';
import {
  CARE_ACTIVITY_SELECT,
  mapCareActivity,
  type CareActivityRow,
} from './careActivityShared';
import { fail, ok } from '../utils/serviceResult';

// Pencatatan hasil kerja perawatan (care_activities), baik yang berasal dari
// tugas terjadwal maupun inisiatif. Menggantikan manualCareService.
//
// Tanggung jawab penjadwalan (jadwal -> tugas) tetap di careTaskService dan
// careScheduleService; service ini khusus pencatatan hasilnya.
//
// DISENGAJA: tidak ada update/soft-delete untuk catatan inisiatif.
// care_activities tidak punya is_deleted/updated_at dan grant-nya hanya
// select+insert (lihat migrasi 027). Penyederhanaan ini menggantikan
// update_own_manual_care_record / soft_delete_own_manual_care_record dan akan
// dievaluasi ulang setelah uji pakai user.

// CARE_ACTIVITY_SELECT, CareActivityRow, dan mapCareActivity kini hidup di
// ./careActivityShared dan dipakai bersama careTaskService. Jangan
// mendefinisikan ulang di sini.

const careCategories: CareCategory[] = [
  'watering',
  'fertilizing',
  'spraying',
  'weeding',
  'other',
];

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

// getCareActivitiesByTree() dihapus: nol pemanggil sejak riwayat per pohon
// pindah ke tree_history_view (migrasi 028). Fungsi itu satu-satunya pembaca
// care_activity_trees dari sisi klien; sekarang tabel jembatan itu hanya
// ditulis lewat RPC create_care_activity dan dibaca lewat view.

// Detail read-only satu catatan perawatan (US-14 / Iterasi C). Untuk asal='terjadwal',
// judul & kategori diambil dari tugas induk; kalau RLS menolak worker membaca tugas
// milik orang lain, taskTitle dibiarkan null (bukan error) dan baris terkait di-skip.
export async function getCareActivityDetail(
  input: GetCareActivityDetailInput | UUID
): Promise<ServiceResult<CareActivityDetail>> {
  const activityId = typeof input === 'string' ? input : input.activityId;

  const { data, error } = await supabase
    .from('care_activities')
    .select(CARE_ACTIVITY_SELECT)
    .eq('id', activityId)
    .maybeSingle<CareActivityRow>();

  if (error) {
    return fail(error, 'Gagal memuat detail catatan perawatan.');
  }

  if (!data) {
    return fail(new Error('Catatan perawatan tidak ditemukan atau tidak dapat diakses.'));
  }

  const activity = mapCareActivity(data);

  let taskTitle: string | null = null;
  let category = activity.category;

  if (activity.asal === 'terjadwal' && activity.careTaskId) {
    // maybeSingle: kalau RLS menyaring tugas milik orang lain, hasilnya 0 baris
    // (data null, tanpa error) -> taskTitle & kategori tetap null, ditangani anggun.
    const taskResult = await supabase
      .from('care_tasks')
      .select('title, category')
      .eq('id', activity.careTaskId)
      .maybeSingle<{ title: string | null; category: CareCategory | null }>();

    if (!taskResult.error && taskResult.data) {
      taskTitle = normalizeOptionalText(taskResult.data.title);
      category = taskResult.data.category ?? null;
    }
  }

  return ok({
    ...activity,
    category,
    taskTitle,
  });
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
