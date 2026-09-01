import { isGradePanen, MAX_BERAT_PANEN_KG, type GradePanen } from '../constants/gradePanen';
import { supabase } from '../lib/supabase';
import type {
  CreateHarvestRecordData,
  CreateHarvestRecordInput,
  GetHarvestRecordDetailInput,
  GetHarvestRecordsByTreeInput,
  HarvestRecord,
  MemberRole,
  MemberStatus,
  ServiceResult,
  SoftDeleteRecordInput,
  SuccessData,
  UpdateHarvestRecordInput,
  UUID,
} from '../types/domain';
import { fail, ok } from '../utils/serviceResult';

const HARVEST_RECORD_SELECT =
  'id, farm_id, tree_id, harvested_by, fruit_count, harvest_weight_kg, fruit_condition, note, harvested_at, created_at, updated_at, is_deleted, deleted_at, deleted_by, delete_reason';

type HarvestRecordRow = {
  id: string;
  farm_id: string;
  tree_id: string;
  harvested_by: string;
  // Nullable sejak migrasi 045: panen boleh dicatat lewat berat saja.
  fruit_count: number | null;
  // numeric(10,2) di database. PostgREST mengirim numeric sebagai STRING, bukan
  // number, supaya presisinya tidak rusak oleh float JavaScript. Tipenya
  // ditulis sebagai union apa adanya supaya tidak ada yang tergoda memakainya
  // langsung sebagai angka — konversinya dilakukan mapper di bawah. Pola yang
  // sama dengan produk_jumlah di careActivityShared.ts.
  harvest_weight_kg: string | number | null;
  fruit_condition: string | null;
  note: string | null;
  harvested_at: string;
  created_at: string;
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
  role: MemberRole;
  status: MemberStatus;
};

export async function createHarvestRecord(
  input: CreateHarvestRecordInput
): Promise<ServiceResult<CreateHarvestRecordData>> {
  const amountResult = normalizeHarvestAmount(input.fruitCount, input.harvestWeightKg);

  if (amountResult instanceof Error) {
    return fail(amountResult);
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
    .from('harvest_records')
    .insert({
      farm_id: input.farmId,
      fruit_condition: input.fruitCondition ?? null,
      fruit_count: amountResult.fruitCount,
      harvest_weight_kg: amountResult.harvestWeightKg,
      harvested_at: normalizeOptionalText(input.harvestedAt) ?? new Date().toISOString(),
      harvested_by: userIdResult.data,
      note: normalizeOptionalText(input.note),
      tree_id: input.treeId,
    })
    .select('id')
    .single<{ id: string }>();

  if (error) {
    return fail(error, 'Gagal menyimpan catatan panen.');
  }

  return ok({
    recordId: data.id,
  });
}

export async function getHarvestRecordsByTree(
  input: GetHarvestRecordsByTreeInput | UUID
): Promise<ServiceResult<HarvestRecord[]>> {
  const treeId = typeof input === 'string' ? input : input.treeId;
  const treeFarmIdResult = await getAccessibleTreeFarmId(treeId);

  if (treeFarmIdResult.error) {
    return fail(treeFarmIdResult.error);
  }

  const accessResult = await ensureActiveOwnerOrWorker(treeFarmIdResult.data);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const { data, error } = await supabase
    .from('harvest_records')
    .select(HARVEST_RECORD_SELECT)
    .eq('tree_id', treeId)
    .eq('is_deleted', false)
    .order('harvested_at', { ascending: false })
    .returns<HarvestRecordRow[]>();

  if (error) {
    return fail(error, 'Gagal memuat riwayat panen.');
  }

  return ok((data ?? []).map(mapHarvestRecord));
}

export async function getHarvestRecordDetail(
  input: GetHarvestRecordDetailInput | UUID
): Promise<ServiceResult<HarvestRecord>> {
  const recordId = typeof input === 'string' ? input : input.recordId;
  const currentUserIdResult = await getCurrentUserId();

  if (currentUserIdResult.error) {
    return fail(currentUserIdResult.error);
  }

  // is_deleted disaring di query; alasannya sama dengan
  // getConditionReportDetail.
  const { data, error } = await supabase
    .from('harvest_records')
    .select(HARVEST_RECORD_SELECT)
    .eq('id', recordId)
    .eq('is_deleted', false)
    .maybeSingle<HarvestRecordRow>();

  if (error) {
    return fail(error, 'Gagal memuat detail panen.');
  }

  if (!data) {
    return fail(new Error('Catatan panen tidak ditemukan atau tidak dapat diakses.'));
  }

  const accessResult = await ensureActiveOwnerOrWorker(data.farm_id);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const isAuthor = data.harvested_by === currentUserIdResult.data;

  return ok({
    ...mapHarvestRecord(data),
    canEdit: isAuthor && data.is_deleted !== true,
    canDelete: (isAuthor || accessResult.data.role === 'owner') && data.is_deleted !== true,
  });
}

// Hapus lunak. Izinnya ditegakkan RPC (migrasi 067). Tidak ada recalculate yang
// menyusul: tidak satu pun kolom turunan di trees berasal dari harvest_records.
export async function softDeleteHarvestRecord(
  input: SoftDeleteRecordInput | UUID
): Promise<ServiceResult<SuccessData>> {
  const recordId = typeof input === 'string' ? input : input.recordId;
  const reason = typeof input === 'string' ? null : input.reason ?? null;

  const { error } = await supabase.rpc('soft_delete_harvest_record', {
    p_reason: normalizeOptionalText(reason),
    p_record_id: recordId,
  });

  if (error) {
    return fail(error, 'Catatan panen gagal dihapus.');
  }

  return ok({ success: true });
}

export async function updateOwnHarvestRecord(
  input: UpdateHarvestRecordInput
): Promise<ServiceResult<SuccessData>> {
  const amountResult = normalizeHarvestAmount(input.fruitCount, input.harvestWeightKg);

  if (amountResult instanceof Error) {
    return fail(amountResult);
  }

  const { error } = await supabase.rpc('update_own_harvest_record', {
    p_fruit_condition: input.fruitCondition ?? null,
    p_fruit_count: amountResult.fruitCount,
    p_harvest_weight_kg: amountResult.harvestWeightKg,
    p_harvested_at: normalizeOptionalText(input.harvestedAt),
    p_note: normalizeOptionalText(input.note),
    p_record_id: input.recordId,
  });

  if (error) {
    return fail(error, 'Catatan panen gagal diperbarui.');
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

// Mengembalikan KEANGGOTAANNYA, bukan sekadar SuccessData. Pemanggil lama hanya
// memeriksa `.error` dan tidak berubah; getHarvestRecordDetail memakai `role` di
// dalamnya untuk memutuskan canDelete tanpa query kedua — barisnya memang sudah
// diambil di sini sebagai pemeriksaan akses.
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
    return fail(new Error('Hanya pemilik atau pekerja aktif yang dapat mencatat panen.'));
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

function mapHarvestRecord(row: HarvestRecordRow): HarvestRecord {
  return {
    createdAt: row.created_at,
    farmId: row.farm_id,
    fruitCondition: toNullableGradePanen(row.fruit_condition),
    fruitCount: row.fruit_count,
    harvestWeightKg: toNullableNumber(row.harvest_weight_kg),
    harvestedAt: row.harvested_at,
    harvestedBy: row.harvested_by,
    id: row.id,
    isDeleted: row.is_deleted ?? false,
    note: row.note,
    treeId: row.tree_id,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by,
    deleteReason: row.delete_reason,
  };
}

// Menerima string ('12.50') maupun number, dan menolak apa pun yang bukan angka
// terhingga. Nilai yang tidak bisa dibaca dijadikan null, bukan NaN — NaN akan
// lolos sampai ke layar dan tampil sebagai teks aneh, bukan error yang
// kelihatan. Pola yang sama dengan produk_jumlah di careActivityShared.ts.
function toNullableNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

// Grade di luar daftar yang dikenal klien diperlakukan sebagai "tidak dinilai".
//
// Ini BUKAN sekadar jaring pengaman teoritis. Constraint grade di database
// dipasang NOT VALID (migrasi 045), jadi 12 baris lama yang berisi "Bagus",
// "Baik", "Good", dan "Good test harvest" MASIH ADA apa adanya sampai
// dibersihkan terpisah. Tanpa penyaringan ini, nilai-nilai itu bocor ke tipe
// GradePanen dan layar yang memetakan grade ke label akan menghasilkan
// undefined di tengah teks.
function toNullableGradePanen(value: string | null | undefined): GradePanen | null {
  return isGradePanen(value) ? value : null;
}

// "Minimal salah satu terisi" menggantikan "jumlah buah wajib". Cerminan
// constraint harvest_records_amount_present_check, dan RPC
// update_own_harvest_record menegakkan aturan yang sama di sisi database.
//
// Mengembalikan pasangan yang sudah bersih supaya pemanggil tidak perlu
// menormalkan dua kali.
function normalizeHarvestAmount(
  fruitCount: number | null | undefined,
  harvestWeightKg: number | null | undefined
): { fruitCount: number | null; harvestWeightKg: number | null } | Error {
  const normalizedCount = fruitCount ?? null;
  const normalizedWeight = harvestWeightKg ?? null;

  if (normalizedCount === null && normalizedWeight === null) {
    return new Error('Isi jumlah buah atau berat panen, minimal salah satu.');
  }

  if (normalizedCount !== null && (!Number.isInteger(normalizedCount) || normalizedCount <= 0)) {
    return new Error('Jumlah buah harus lebih dari 0.');
  }

  if (normalizedWeight !== null && (!Number.isFinite(normalizedWeight) || normalizedWeight <= 0)) {
    return new Error('Berat panen harus lebih dari 0.');
  }

  if (normalizedWeight !== null && normalizedWeight > MAX_BERAT_PANEN_KG) {
    return new Error('Berat panen terlalu besar.');
  }

  return {
    fruitCount: normalizedCount,
    harvestWeightKg: normalizedWeight,
  };
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
