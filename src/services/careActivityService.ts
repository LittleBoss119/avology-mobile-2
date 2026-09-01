import { supabase } from '../lib/supabase';
import type {
  CareActivity,
  CareActivityDetail,
  CareCategory,
  CreateCareActivityData,
  CreateCareActivityInput,
  GetCareActivityDetailInput,
  GetRecentFarmCareActivitiesInput,
  MemberRole,
  MemberStatus,
  RecentFarmCareActivity,
  ServiceResult,
  SoftDeleteRecordInput,
  SuccessData,
  UUID,
} from '../types/domain';
import {
  CARE_ACTIVITY_SELECT,
  mapCareActivity,
  type CareActivityRow,
} from './careActivityShared';
import { getFarmActorDisplayProfiles } from './memberService';
import { fail, ok } from '../utils/serviceResult';

// Pencatatan hasil kerja perawatan (care_activities), baik yang berasal dari
// tugas terjadwal maupun inisiatif. Menggantikan manualCareService.
//
// Tanggung jawab penjadwalan (jadwal -> tugas) tetap di careTaskService dan
// careScheduleService; service ini khusus pencatatan hasilnya.
//
// TIDAK ADA UPDATE, dan itu tetap disengaja: care_activities append-only, tidak
// punya kolom updated_at, dan grant-nya hanya select+insert (migrasi 027).
// Catatan perawatan tidak bisa dikoreksi isinya oleh siapa pun.
//
// SOFT DELETE ADA sejak migrasi 067, dan tidak melanggar hal di atas: ia UPDATE
// pada kolom PENANDA (is_deleted dan tiga kolom pendampingnya), bukan perubahan
// isi dan bukan DELETE. Grant select+insert pun tidak dilonggarkan — jalurnya
// lewat RPC SECURITY DEFINER, jadi klien tetap tidak bisa menulis ke tabel ini
// langsung. Hanya perawatan INISIATIF yang bisa dihapus; yang terjadwal
// dibatalkan lewat rollback_completed_task_activity.

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

  // is_deleted disaring di query. Kolomnya baru lahir di migrasi 067, jadi
  // sebelum ini fungsi ini memang tidak punya cara tahu — dan penyaringnya
  // ditulis di tempat yang sama dengan tiga service catatan lain, dengan galat
  // yang sudah dipakai fungsi ini sejak dulu.
  const { data, error } = await supabase
    .from('care_activities')
    .select(CARE_ACTIVITY_SELECT)
    .eq('id', activityId)
    .eq('is_deleted', false)
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
    canDelete: await resolveCareActivityCanDelete(activity),
    category,
    taskTitle,
  });
}

// canDelete untuk perawatan. Cerminan persis penjaga di dalam
// soft_delete_care_activity (migrasi 067): asal harus 'inisiatif', dan
// pemanggil harus pencatatnya ATAU pemilik aktif kebun.
//
// URUTANNYA MENENTUKAN BERAPA QUERY YANG DIJALANKAN, dan itu disengaja:
//
//   1. Bukan inisiatif  -> false, TANPA menyentuh jaringan sama sekali. Ini
//      jalur setiap perawatan terjadwal, dan ia berhenti paling awal.
//   2. Pemanggil = pencatatnya -> true, cukup satu auth.getUser(). Ini jalur
//      pekerja yang membuka catatannya sendiri, yang paling sering terjadi.
//   3. Selain itu -> baru satu query farm_members untuk memeriksa apakah ia
//      pemilik kebun. Jalur ini hanya ditempuh pemilik yang membuka catatan
//      orang lain.
//
// Tiga service catatan lain tidak perlu cabang seperti ini: keduanya sudah
// mengambil baris keanggotaan sebagai pemeriksaan akses, jadi `role` sudah ada
// di tangan tanpa biaya. getCareActivityDetail tidak punya pemeriksaan akses
// sama sekali (ia bersandar pada RLS), dan menambahkannya di sini akan mengubah
// perilaku fungsi ini di luar yang diminta.
async function resolveCareActivityCanDelete(activity: CareActivity): Promise<boolean> {
  if (activity.asal !== 'inisiatif') {
    return false;
  }

  const userResult = await supabase.auth.getUser();
  const currentUserId = userResult.data.user?.id;

  if (!currentUserId) {
    return false;
  }

  if (activity.performedBy === currentUserId) {
    return true;
  }

  const { data } = await supabase
    .from('farm_members')
    .select('role, status')
    .eq('farm_id', activity.farmId)
    .eq('user_id', currentUserId)
    .maybeSingle<{ role: MemberRole; status: MemberStatus }>();

  return data?.role === 'owner' && data.status === 'active';
}

// Hapus lunak. Izinnya ditegakkan RPC (migrasi 067), termasuk penolakan untuk
// perawatan TERJADWAL — yang pembatalannya lewat rollback_completed_task_activity,
// bukan lewat sini.
export async function softDeleteCareActivity(
  input: SoftDeleteRecordInput | UUID
): Promise<ServiceResult<SuccessData>> {
  const activityId = typeof input === 'string' ? input : input.recordId;
  const reason = typeof input === 'string' ? null : input.reason ?? null;

  const { error } = await supabase.rpc('soft_delete_care_activity', {
    p_activity_id: activityId,
    p_reason: normalizeOptionalText(reason),
  });

  if (error) {
    return fail(error, 'Catatan perawatan gagal dihapus.');
  }

  return ok({ success: true });
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

// ---------------------------------------------------------------------------
// Tiga perawatan terakhir SATU KEBUN, untuk kartu "Terakhir dikerjakan" di
// Beranda pemilik.
//
// FUNGSI BACA BARU, tidak ada yang lama disentuh. Ia tinggal di sini, bukan di
// dashboardService, karena dashboardService seluruhnya penghitung agregat
// (CountResult, `head: true`, tanpa satu pun pemetaan baris) sementara ini
// mengembalikan DAFTAR baris care_activities — pekerjaan yang sudah jadi milik
// berkas ini beserta konvensi baris dan mappernya.
//
// KENAPA QUERY LANGSUNG, bukan view. tree_history_view punya farm_id dan sudah
// menyaring is_deleted, tapi cabang perawatannya join ke care_activity_trees —
// jadi ia menghasilkan SATU BARIS PER PASANGAN aktivitas-pohon. `limit 3` di
// sana membatasi tautan pohon, bukan aktivitas, dan satu aktivitas atas 196
// pohon akan memenuhi seluruh limitnya sendirian.
//
// SUBJEKNYA PEKERJAAN, BUKAN ORANG. Nama pencatat ikut, tapi sebagai atribusi —
// urutan bidang di RecentFarmCareActivity dan urutan baris di kartunya
// mengikuti itu, dan jangan dibalik. Aplikasi ini manajemen kebun, bukan
// manajemen pekerja.
const RECENT_CARE_ACTIVITY_LIMIT = 3;

type RecentCareActivityRow = {
  id: string;
  asal: string;
  category: CareCategory | null;
  care_task_id: string | null;
  performed_at: string;
  performed_by: string;
  // Embedded, satu baris per pohon yang tercakup aktivitas ini. Hanya
  // JUMLAHNYA yang dipakai; tree_id-nya sendiri tidak pernah dibaca.
  care_activity_trees: { tree_id: string }[] | null;
};

type RecentCareTaskRow = {
  id: string;
  title: string | null;
  category: CareCategory | null;
};

export async function getRecentFarmCareActivities(
  input: GetRecentFarmCareActivitiesInput
): Promise<ServiceResult<RecentFarmCareActivity[]>> {
  // Urutan keduanya cerminan getTreeHistory: performed_at adalah KAPAN
  // KEJADIANNYA (dipilih pencatat, boleh dimundurkan, dan untuk sebagian besar
  // jalur tulis ia tanggal-saja yang jadi tengah malam), created_at adalah
  // kapan barisnya ditulis. Tanpa pemecah seri kedua, dua catatan pada hari
  // yang sama punya performed_at IDENTIK dan urutannya tidak dijanjikan apa pun.
  const { data, error } = await supabase
    .from('care_activities')
    .select('id, asal, category, care_task_id, performed_at, performed_by, care_activity_trees(tree_id)')
    .eq('farm_id', input.farmId)
    .eq('is_deleted', false)
    .order('performed_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(RECENT_CARE_ACTIVITY_LIMIT)
    .returns<RecentCareActivityRow[]>();

  if (error) {
    return fail(error, 'Gagal memuat perawatan terakhir.');
  }

  const rows = data ?? [];

  if (rows.length === 0) {
    return ok([]);
  }

  const [taskById, nameByUserId] = await Promise.all([
    fetchCareTaskLabels(rows),
    fetchPerformerNames(input.farmId),
  ]);

  return ok(
    rows.map((row) => {
      const task = row.care_task_id ? taskById[row.care_task_id] : undefined;

      return {
        // category baris 'inisiatif' DIJAMIN terisi oleh
        // care_activities_asal_source_check (migrasi 025). Baris 'terjadwal'
        // boleh NULL, dan jenisnya ada di care_tasks — karena itu fallback ke
        // task.category, bukan ke judulnya.
        category: row.category ?? task?.category ?? null,
        id: row.id,
        performedAt: row.performed_at,
        performerName: nameByUserId[row.performed_by] ?? null,
        // Cadangan TERAKHIR untuk jenis pekerjaan, dipakai hanya kalau kedua
        // kolom category kosong. Judul ini DIKETIK PEMILIK dan panjangnya tidak
        // terkendali, jadi pemakainya wajib memotongnya.
        taskTitle: normalizeOptionalText(task?.title),
        treeCount: (row.care_activity_trees ?? []).length,
      };
    })
  );
}

// Satu query untuk seluruh tugas yang dirujuk ketiga baris, bukan satu query
// per baris. Baris 'inisiatif' tidak punya care_task_id (dijamin constraint),
// jadi kebun yang seluruh perawatannya inisiatif tidak menyentuh jaringan sama
// sekali di sini.
//
// Galatnya DITELAN, bukan dinaikkan: judul dan kategori tugas hanya melengkapi
// label, dan kartu yang kehilangan satu label masih jauh lebih berguna daripada
// kartu yang hilang seluruhnya. Polanya sama dengan getCareActivityDetail, yang
// membiarkan taskTitle null saat tugasnya tidak terbaca.
async function fetchCareTaskLabels(
  rows: RecentCareActivityRow[]
): Promise<Record<string, RecentCareTaskRow>> {
  const taskIds = Array.from(
    new Set(rows.map((row) => row.care_task_id).filter((taskId): taskId is string => Boolean(taskId)))
  );

  if (taskIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from('care_tasks')
    .select('id, title, category')
    .in('id', taskIds)
    .returns<RecentCareTaskRow[]>();

  if (error) {
    return {};
  }

  return Object.fromEntries((data ?? []).map((task) => [task.id, task]));
}

// Nama pencatat lewat RPC, BUKAN join ke profiles. Policy profiles
// (can_view_profile, migrasi 007) hanya mengizinkan seseorang membaca profilnya
// SENDIRI, jadi join akan mengembalikan nama kosong pada setiap baris —
// kegagalan diam-diam yang pernah benar-benar terjadi dan ditambal migrasi 033.
//
// get_farm_actor_display_profiles dijaga is_active_farm_member, jadi pemilik
// aktif berhak memanggilnya. Polanya disalin dari getHistoryActorDisplays di
// historyService; galatnya ditelan dengan alasan yang sama seperti di atas —
// baris tanpa nama masih menyampaikan pekerjaan apa atas berapa pohon.
async function fetchPerformerNames(farmId: UUID): Promise<Record<string, string>> {
  const result = await getFarmActorDisplayProfiles(farmId);

  if (result.error) {
    return {};
  }

  return Object.fromEntries(result.data.map((profile) => [profile.userId, profile.fullName]));
}
