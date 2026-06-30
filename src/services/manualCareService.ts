import { supabase } from '../lib/supabase';
import { uploadManualCareRecordPhoto } from './photoAttachmentService';
import type {
  CareCategory,
  CreateManualCareRecordData,
  CreateManualCareRecordInput,
  GetManualCareRecordsByTreeInput,
  ManualCareRecord,
  MemberRole,
  MemberStatus,
  ServiceResult,
  SuccessData,
  TargetType,
  UUID,
} from '../types/domain';
import { fail, ok } from '../utils/serviceResult';

const MANUAL_CARE_RECORD_SELECT =
  'id, farm_id, recorded_by, category, target_type, target_row, target_column, target_tree_id, custom_target_note, note, performed_at, created_at, updated_at';

const careCategories: CareCategory[] = [
  'watering',
  'fertilizing',
  'spraying',
  'weeding',
  'other',
];

type ManualCareRecordRow = {
  id: string;
  farm_id: string;
  recorded_by: string;
  category: CareCategory;
  target_type: TargetType;
  target_row: string | null;
  target_column: string | null;
  target_tree_id: string | null;
  custom_target_note: string | null;
  note: string | null;
  performed_at: string;
  created_at: string;
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

type NormalizedManualCareTarget = {
  customTargetNote: string | null;
  targetColumn: string | null;
  targetRow: string | null;
  targetTreeId: string | null;
};

export async function createManualCareRecord(
  input: CreateManualCareRecordInput
): Promise<ServiceResult<CreateManualCareRecordData>> {
  if (!isCareCategory(input.category)) {
    return fail(new Error('Jenis perawatan wajib dipilih.'));
  }

  const targetResult = normalizeManualCareTarget(input);

  if (targetResult instanceof Error) {
    return fail(targetResult);
  }

  const userIdResult = await getCurrentUserId();

  if (userIdResult.error) {
    return fail(userIdResult.error);
  }

  if (input.targetType === 'tree') {
    const treeFarmIdResult = await getAccessibleTreeFarmId(targetResult.targetTreeId ?? '');

    if (treeFarmIdResult.error) {
      return fail(treeFarmIdResult.error);
    }

    if (treeFarmIdResult.data !== input.farmId) {
      return fail(new Error('Pohon tidak terdaftar pada kebun yang dipilih.'));
    }
  }

  const accessResult = await ensureActiveOwnerOrWorker(input.farmId);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const { data, error } = await supabase
    .from('manual_care_records')
    .insert({
      category: input.category,
      custom_target_note: targetResult.customTargetNote,
      farm_id: input.farmId,
      note: normalizeOptionalText(input.note),
      performed_at: normalizeOptionalText(input.performedAt) ?? new Date().toISOString(),
      recorded_by: userIdResult.data,
      target_column: targetResult.targetColumn,
      target_row: targetResult.targetRow,
      target_tree_id: targetResult.targetTreeId,
      target_type: input.targetType,
    })
    .select('id')
    .single<{ id: string }>();

  if (error) {
    return fail(error, 'Gagal menyimpan catatan perawatan.');
  }

  if (input.photo?.uri) {
    const photoResult = await uploadManualCareRecordPhoto({
      base64: input.photo.base64,
      farmId: input.farmId,
      fileName: input.photo.fileName,
      localUri: input.photo.uri,
      manualCareRecordId: data.id,
      mimeType: input.photo.mimeType,
    });

    if (photoResult.error) {
      return ok({
        recordId: data.id,
        warningMessage:
          'Catatan perawatan tersimpan, tetapi foto perawatan gagal diunggah. Periksa koneksi lalu coba unggah ulang nanti.',
      });
    }
  }

  return ok({
    recordId: data.id,
    warningMessage: null,
  });
}

export async function getManualCareRecordsByTree(
  input: GetManualCareRecordsByTreeInput | UUID
): Promise<ServiceResult<ManualCareRecord[]>> {
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
    .from('manual_care_records')
    .select(MANUAL_CARE_RECORD_SELECT)
    .eq('target_type', 'tree')
    .eq('target_tree_id', treeId)
    .order('performed_at', { ascending: false })
    .returns<ManualCareRecordRow[]>();

  if (error) {
    return fail(error, 'Gagal memuat riwayat perawatan.');
  }

  return ok((data ?? []).map(mapManualCareRecord));
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
    return fail(new Error('Hanya pemilik atau pekerja aktif yang dapat mencatat perawatan.'));
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

function normalizeManualCareTarget(
  input: CreateManualCareRecordInput
): NormalizedManualCareTarget | Error {
  const targetRow = normalizeOptionalText(input.targetRow);
  const targetColumn = normalizeOptionalText(input.targetColumn);
  const targetTreeId = normalizeOptionalText(input.targetTreeId);
  const customTargetNote = normalizeOptionalText(input.customTargetNote);

  if (input.targetType === 'farm') {
    return {
      customTargetNote: null,
      targetColumn: null,
      targetRow: null,
      targetTreeId: null,
    };
  }

  if (input.targetType === 'row') {
    if (!targetRow) {
      return new Error('Baris target wajib diisi.');
    }

    return {
      customTargetNote: null,
      targetColumn: null,
      targetRow,
      targetTreeId: null,
    };
  }

  if (input.targetType === 'column') {
    if (!targetColumn) {
      return new Error('Kolom target wajib diisi.');
    }

    return {
      customTargetNote: null,
      targetColumn,
      targetRow: null,
      targetTreeId: null,
    };
  }

  if (input.targetType === 'tree') {
    if (!targetTreeId) {
      return new Error('Pohon target wajib dipilih.');
    }

    return {
      customTargetNote: null,
      targetColumn: null,
      targetRow: null,
      targetTreeId,
    };
  }

  if (input.targetType === 'custom') {
    if (!customTargetNote) {
      return new Error('Catatan target khusus wajib diisi.');
    }

    return {
      customTargetNote,
      targetColumn: null,
      targetRow: null,
      targetTreeId: null,
    };
  }

  return new Error('Target perawatan tidak valid.');
}

function mapManualCareRecord(row: ManualCareRecordRow): ManualCareRecord {
  return {
    category: row.category,
    createdAt: row.created_at,
    customTargetNote: row.custom_target_note,
    farmId: row.farm_id,
    id: row.id,
    note: row.note,
    performedAt: row.performed_at,
    recordedBy: row.recorded_by,
    targetColumn: row.target_column,
    targetRow: row.target_row,
    targetTreeId: row.target_tree_id,
    targetType: row.target_type,
    updatedAt: row.updated_at,
  };
}

function isCareCategory(value: string | null | undefined): value is CareCategory {
  return careCategories.includes(value as CareCategory);
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
