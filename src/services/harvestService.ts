import { supabase } from '../lib/supabase';
import { uploadHarvestRecordPhoto } from './photoAttachmentService';
import type {
  CreateHarvestRecordData,
  CreateHarvestRecordInput,
  GetHarvestRecordDetailInput,
  GetHarvestRecordsByTreeInput,
  HarvestRecord,
  MemberRole,
  MemberStatus,
  ServiceResult,
  SuccessData,
  UpdateHarvestRecordInput,
  UUID,
} from '../types/domain';
import { fail, ok } from '../utils/serviceResult';

const HARVEST_RECORD_SELECT =
  'id, farm_id, tree_id, harvested_by, fruit_count, fruit_condition, note, harvested_at, created_at, updated_at, is_deleted, deleted_at, deleted_by, delete_reason';

type HarvestRecordRow = {
  id: string;
  farm_id: string;
  tree_id: string;
  harvested_by: string;
  fruit_count: number;
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
  const fruitCount = normalizePositiveInteger(input.fruitCount);

  if (fruitCount instanceof Error) {
    return fail(fruitCount);
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
      fruit_condition: normalizeOptionalText(input.fruitCondition),
      fruit_count: fruitCount,
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

  if (input.photo?.uri) {
    const photoResult = await uploadHarvestRecordPhoto({
      base64: input.photo.base64,
      farmId: input.farmId,
      fileName: input.photo.fileName,
      harvestRecordId: data.id,
      localUri: input.photo.uri,
      mimeType: input.photo.mimeType,
    });

    if (photoResult.error) {
      return ok({
        recordId: data.id,
        warningMessage:
          'Catatan panen tersimpan, tetapi foto panen gagal diunggah. Periksa koneksi lalu coba unggah ulang nanti.',
      });
    }
  }

  return ok({
    recordId: data.id,
    warningMessage: null,
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

  const { data, error } = await supabase
    .from('harvest_records')
    .select(HARVEST_RECORD_SELECT)
    .eq('id', recordId)
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

  return ok({
    ...mapHarvestRecord(data),
    canEdit: data.harvested_by === currentUserIdResult.data && data.is_deleted !== true,
  });
}

export async function updateOwnHarvestRecord(
  input: UpdateHarvestRecordInput
): Promise<ServiceResult<SuccessData>> {
  const fruitCount = normalizePositiveInteger(input.fruitCount);

  if (fruitCount instanceof Error) {
    return fail(fruitCount);
  }

  const { error } = await supabase.rpc('update_own_harvest_record', {
    p_fruit_condition: normalizeOptionalText(input.fruitCondition),
    p_fruit_count: fruitCount,
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
    return fail(new Error('Hanya pemilik atau pekerja aktif yang dapat mencatat panen.'));
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

function mapHarvestRecord(row: HarvestRecordRow): HarvestRecord {
  return {
    createdAt: row.created_at,
    farmId: row.farm_id,
    fruitCondition: row.fruit_condition,
    fruitCount: row.fruit_count,
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

function normalizePositiveInteger(value: number): number | Error {
  if (!Number.isInteger(value) || value <= 0) {
    return new Error('Jumlah buah harus lebih dari 0.');
  }

  return value;
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
