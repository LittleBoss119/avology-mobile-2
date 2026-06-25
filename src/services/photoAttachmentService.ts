import { supabase } from '../lib/supabase';
import type { ServiceResult, SuccessData, UUID } from '../types/domain';
import type {
  DeletePhotoAttachmentInput,
  GetPhotoSignedUrlData,
  ListPhotoAttachmentsInput,
  PhotoAttachment,
  PhotoAttachmentEntityType,
  PhotoAttachmentPathFolder,
  UploadPhotoAttachmentData,
  UploadPhotoAttachmentInput,
} from '../types/media';
import { fail, ok } from '../utils/serviceResult';

export const PHOTO_STORAGE_BUCKET = 'avology-photos';
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

const PHOTO_ATTACHMENT_SELECT =
  'id, farm_id, uploaded_by, entity_type, entity_id, bucket, storage_path, file_name, mime_type, file_size, caption, is_primary, created_at';

const allowedEntityTypes: PhotoAttachmentEntityType[] = [
  'tree_main',
  'condition_record',
  'operational_report',
  'task_proof',
];

const entityPathFolders: Record<PhotoAttachmentEntityType, PhotoAttachmentPathFolder> = {
  condition_record: 'condition-reports',
  operational_report: 'operational-reports',
  task_proof: 'task-proofs',
  tree_main: 'trees',
};

type PhotoAttachmentRow = {
  id: string;
  farm_id: string;
  uploaded_by: string;
  entity_type: PhotoAttachmentEntityType;
  entity_id: string;
  bucket: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  caption: string | null;
  is_primary: boolean;
  created_at: string;
};

export async function uploadPhotoAttachment(
  input: UploadPhotoAttachmentInput
): Promise<ServiceResult<UploadPhotoAttachmentData>> {
  const normalized = normalizeUploadInput(input);

  if (normalized instanceof Error) {
    return fail(normalized);
  }

  const userIdResult = await getCurrentUserId();

  if (userIdResult.error) {
    return fail(userIdResult.error);
  }

  const fileResult = await loadLocalImageFile(normalized.localUri, normalized.mimeType);

  if (fileResult.error) {
    return fail(fileResult.error);
  }

  const storagePath = buildPhotoStoragePath({
    entityId: normalized.entityId,
    entityType: normalized.entityType,
    extension: resolveFileExtension(normalized.fileName, fileResult.data.mimeType),
    farmId: normalized.farmId,
  });

  const finalFileName = normalized.fileName ?? storagePath.split('/').at(-1) ?? null;

  const uploadResult = await supabase.storage
    .from(PHOTO_STORAGE_BUCKET)
    .upload(storagePath, fileResult.data.blob, {
      contentType: fileResult.data.mimeType,
      upsert: false,
    });

  if (uploadResult.error) {
    return fail(uploadResult.error, 'Gagal mengunggah foto. Periksa koneksi lalu coba lagi.');
  }

  const insertResult = await supabase
    .from('photo_attachments')
    .insert({
      bucket: PHOTO_STORAGE_BUCKET,
      caption: normalized.caption,
      entity_id: normalized.entityId,
      entity_type: normalized.entityType,
      farm_id: normalized.farmId,
      file_name: finalFileName,
      file_size: fileResult.data.fileSize,
      is_primary: normalized.isPrimary,
      mime_type: fileResult.data.mimeType,
      storage_path: storagePath,
      uploaded_by: userIdResult.data,
    })
    .select(PHOTO_ATTACHMENT_SELECT)
    .single<PhotoAttachmentRow>();

  if (insertResult.error) {
    await removeStorageObjectBestEffort(storagePath);
    return fail(insertResult.error, 'Foto terunggah, tetapi metadata gagal disimpan.');
  }

  return ok({
    attachment: mapPhotoAttachment(insertResult.data),
  });
}

export async function listPhotoAttachments(
  input: ListPhotoAttachmentsInput
): Promise<ServiceResult<PhotoAttachment[]>> {
  const normalized = normalizeListInput(input);

  if (normalized instanceof Error) {
    return fail(normalized);
  }

  const { data, error } = await supabase
    .from('photo_attachments')
    .select(PHOTO_ATTACHMENT_SELECT)
    .eq('farm_id', normalized.farmId)
    .eq('entity_type', normalized.entityType)
    .eq('entity_id', normalized.entityId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: false })
    .returns<PhotoAttachmentRow[]>();

  if (error) {
    return fail(error, 'Gagal memuat daftar foto.');
  }

  return ok((data ?? []).map(mapPhotoAttachment));
}

export async function getPhotoSignedUrl(
  storagePath: string,
  expiresIn = 60 * 10
): Promise<ServiceResult<GetPhotoSignedUrlData>> {
  const path = normalizeRequiredText(storagePath, 'Path foto tidak valid.');

  if (path instanceof Error) {
    return fail(path);
  }

  const { data, error } = await supabase.storage
    .from(PHOTO_STORAGE_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error) {
    return fail(error, 'Gagal membuat akses sementara foto.');
  }

  return ok({
    expiresIn,
    signedUrl: data.signedUrl,
  });
}

export async function deletePhotoAttachment(
  input: DeletePhotoAttachmentInput
): Promise<ServiceResult<SuccessData>> {
  const photoId = normalizeRequiredText(input.photoId, 'Foto tidak ditemukan.');

  if (photoId instanceof Error) {
    return fail(photoId);
  }

  const { data, error } = await supabase
    .from('photo_attachments')
    .select(PHOTO_ATTACHMENT_SELECT)
    .eq('id', photoId)
    .maybeSingle<PhotoAttachmentRow>();

  if (error) {
    return fail(error, 'Gagal memeriksa data foto.');
  }

  if (!data) {
    return fail(new Error('Foto tidak ditemukan atau tidak dapat diakses.'));
  }

  const removeResult = await supabase.storage
    .from(data.bucket)
    .remove([data.storage_path]);

  if (removeResult.error) {
    return fail(removeResult.error, 'Gagal menghapus file foto.');
  }

  const deleteResult = await supabase
    .from('photo_attachments')
    .delete()
    .eq('id', data.id);

  if (deleteResult.error) {
    return fail(deleteResult.error, 'File foto terhapus, tetapi metadata gagal dihapus.');
  }

  return ok({
    success: true,
  });
}

function normalizeUploadInput(
  input: UploadPhotoAttachmentInput
): Required<UploadPhotoAttachmentInput> | Error {
  const farmId = normalizeRequiredText(input.farmId, 'Kebun tidak valid.');
  const entityId = normalizeRequiredText(input.entityId, 'Target foto tidak valid.');
  const localUri = normalizeRequiredText(input.localUri, 'File foto tidak valid.');

  if (farmId instanceof Error) {
    return farmId;
  }

  if (entityId instanceof Error) {
    return entityId;
  }

  if (localUri instanceof Error) {
    return localUri;
  }

  const entityType = validateEntityType(input.entityType);

  if (entityType instanceof Error) {
    return entityType;
  }

  return {
    caption: normalizeOptionalText(input.caption),
    entityId,
    entityType,
    farmId,
    fileName: normalizeOptionalText(input.fileName),
    isPrimary: input.isPrimary ?? false,
    localUri,
    mimeType: normalizeOptionalText(input.mimeType),
  };
}

function normalizeListInput(
  input: ListPhotoAttachmentsInput
): Required<ListPhotoAttachmentsInput> | Error {
  const farmId = normalizeRequiredText(input.farmId, 'Kebun tidak valid.');
  const entityId = normalizeRequiredText(input.entityId, 'Target foto tidak valid.');

  if (farmId instanceof Error) {
    return farmId;
  }

  if (entityId instanceof Error) {
    return entityId;
  }

  const entityType = validateEntityType(input.entityType);

  if (entityType instanceof Error) {
    return entityType;
  }

  return {
    entityId,
    entityType,
    farmId,
  };
}

async function loadLocalImageFile(
  localUri: string,
  fallbackMimeType: string | null
): Promise<ServiceResult<{ blob: Blob; fileSize: number; mimeType: string }>> {
  try {
    const response = await fetch(localUri);

    if (!response.ok) {
      return fail(new Error('File foto tidak dapat dibaca.'));
    }

    const blob = await response.blob();
    const mimeType = normalizeMimeType(blob.type || fallbackMimeType);

    if (!mimeType) {
      return fail(new Error('Tipe file foto tidak dikenali.'));
    }

    if (!isImageMimeType(mimeType)) {
      return fail(new Error('File yang dipilih harus berupa gambar.'));
    }

    if (blob.size <= 0) {
      return fail(new Error('File foto kosong atau tidak dapat dibaca.'));
    }

    if (blob.size > MAX_PHOTO_SIZE_BYTES) {
      return fail(new Error('Ukuran foto maksimal 5MB.'));
    }

    return ok({
      blob,
      fileSize: blob.size,
      mimeType,
    });
  } catch {
    return fail(new Error('Gagal membaca file foto dari perangkat.'));
  }
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

function buildPhotoStoragePath(input: {
  farmId: UUID;
  entityType: PhotoAttachmentEntityType;
  entityId: UUID;
  extension: string;
}): string {
  const folder = entityPathFolders[input.entityType];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const random = Math.random().toString(36).slice(2, 10);

  return `farms/${input.farmId}/${folder}/${input.entityId}/${timestamp}-${random}.${input.extension}`;
}

function validateEntityType(value: PhotoAttachmentEntityType | null | undefined):
  | PhotoAttachmentEntityType
  | Error {
  if (!value || !allowedEntityTypes.includes(value)) {
    return new Error('Jenis target foto tidak valid.');
  }

  return value;
}

function resolveFileExtension(fileName: string | null, mimeType: string): string {
  const nameExtension = fileName?.split('.').pop()?.toLowerCase();

  if (nameExtension && /^[a-z0-9]+$/.test(nameExtension)) {
    return normalizeExtension(nameExtension);
  }

  if (mimeType === 'image/png') {
    return 'png';
  }

  if (mimeType === 'image/webp') {
    return 'webp';
  }

  if (mimeType === 'image/heic') {
    return 'heic';
  }

  if (mimeType === 'image/heif') {
    return 'heif';
  }

  return 'jpg';
}

function normalizeExtension(extension: string): string {
  if (extension === 'jpeg') {
    return 'jpg';
  }

  return extension;
}

function normalizeMimeType(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

function isImageMimeType(value: string): boolean {
  return value.startsWith('image/');
}

function mapPhotoAttachment(row: PhotoAttachmentRow): PhotoAttachment {
  return {
    bucket: row.bucket,
    caption: row.caption,
    createdAt: row.created_at,
    entityId: row.entity_id,
    entityType: row.entity_type,
    farmId: row.farm_id,
    fileName: row.file_name,
    fileSize: row.file_size,
    id: row.id,
    isPrimary: row.is_primary,
    mimeType: row.mime_type,
    storagePath: row.storage_path,
    uploadedBy: row.uploaded_by,
  };
}

async function removeStorageObjectBestEffort(storagePath: string): Promise<void> {
  await supabase.storage.from(PHOTO_STORAGE_BUCKET).remove([storagePath]);
}

function normalizeRequiredText(value: string | null | undefined, message: string): string | Error {
  const normalized = value?.trim();
  return normalized ? normalized : new Error(message);
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
