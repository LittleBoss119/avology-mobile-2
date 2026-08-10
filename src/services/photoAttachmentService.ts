import * as FileSystem from 'expo-file-system/legacy';

import { supabase } from '../lib/supabase';
import type { MemberRole, MemberStatus, ServiceResult, SuccessData, UUID } from '../types/domain';
import type {
  ConditionRecordPhoto,
  ConditionRecordPhotoMap,
  CountOperationalReportPhotosInput,
  OperationalReportPhotoCountMap,
  DeleteOperationalReportPhotoObjectsInput,
  DeleteTreeMainPhotoInput,
  DeletePhotoAttachmentInput,
  GetConditionRecordPhotosInput,
  ListOperationalReportPhotosInput,
  OperationalReportPhoto,
  UploadOperationalReportPhotoInput,
  GetTreeMainPhotoData,
  GetPhotoSignedUrlData,
  ListConditionRecordPhotosForTreeInput,
  ListEntityPhotosInput,
  ListPhotoAttachmentsInput,
  ListTaskProofPhotosForActivitiesInput,
  PhotoAttachment,
  PhotoAttachmentEntityType,
  PhotoAttachmentPathFolder,
  PhotoAttachmentWithSignedUrl,
  ReplaceSinglePhotoAttachmentInput,
  TaskProofPhoto,
  TaskProofPhotoMap,
  TreeMainPhoto,
  TreeMainPhotoMap,
  UploadConditionRecordPhotoInput,
  UploadEntityPhotoInput,
  UploadTaskProofPhotoInput,
  UploadTreeMainPhotoInput,
  UploadPhotoAttachmentData,
  UploadPhotoAttachmentInput,
  GetTaskProofPhotosInput,
} from '../types/media';
import { fail, ok } from '../utils/serviceResult';

export const PHOTO_STORAGE_BUCKET = 'avology-photos';
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

const PHOTO_ATTACHMENT_SELECT =
  'id, farm_id, uploaded_by, entity_type, entity_id, bucket, storage_path, file_name, mime_type, file_size, caption, is_primary, created_at';

const allowedEntityTypes: PhotoAttachmentEntityType[] = [
  'tree_main',
  'condition_record',
  'task_proof',
  'operational_report',
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

type MembershipRow = {
  role: MemberRole;
  status: MemberStatus;
};

type PhotoUploadDebugError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
  name?: string;
  status?: number;
  statusCode?: string;
};

type PhotoUploadDebugInput = {
  entityId: UUID;
  entityType: PhotoAttachmentEntityType;
  error?: unknown;
  farmId: UUID;
  fileName?: string | null;
  fileSize?: number | null;
  localUri?: string | null;
  mimeType?: string | null;
  readAttempts?: string[] | null;
  readMethod?: LocalImageFileData['readMethod'] | null;
  storagePath: string;
  taskId?: UUID | null;
};

type LocalImageFileData = {
  uploadBody: ArrayBuffer | Blob;
  fileSize: number;
  mimeType: string;
  readAttempts: string[];
  readMethod: 'base64' | 'expo-file-system-base64' | 'fetch-blob';
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

  const fileResult = await loadLocalImageFile({
    fallbackBase64: normalized.base64,
    fallbackMimeType: normalized.mimeType,
    fileName: normalized.fileName,
    localUri: normalized.localUri,
  });

  if (fileResult.error) {
    return fail(fileResult.error);
  }

  const storagePath = buildPhotoStoragePath({
    entityId: normalized.entityId,
    entityType: normalized.entityType,
    extension: resolveFileExtension(normalized.fileName, fileResult.data.mimeType),
    farmId: normalized.farmId,
    taskId: normalized.taskId,
  });

  const finalFileName = normalized.fileName ?? storagePath.split('/').at(-1) ?? null;

  logPhotoUploadDebug('upload-start', {
    entityId: normalized.entityId,
    entityType: normalized.entityType,
    farmId: normalized.farmId,
    fileName: finalFileName,
    fileSize: fileResult.data.fileSize,
    localUri: normalized.localUri,
    mimeType: fileResult.data.mimeType,
    readAttempts: fileResult.data.readAttempts,
    readMethod: fileResult.data.readMethod,
    storagePath,
    taskId: normalized.taskId,
  });

  const uploadResult = await supabase.storage
    .from(PHOTO_STORAGE_BUCKET)
    .upload(storagePath, fileResult.data.uploadBody, {
      contentType: fileResult.data.mimeType,
      upsert: false,
    });

  if (uploadResult.error) {
    logPhotoUploadDebug('storage-upload-failed', {
      entityId: normalized.entityId,
      entityType: normalized.entityType,
      error: uploadResult.error,
      farmId: normalized.farmId,
      fileName: finalFileName,
      fileSize: fileResult.data.fileSize,
      localUri: normalized.localUri,
      mimeType: fileResult.data.mimeType,
      readAttempts: fileResult.data.readAttempts,
      readMethod: fileResult.data.readMethod,
      storagePath,
      taskId: normalized.taskId,
    });
    return fail(new Error('Foto gagal diunggah.'));
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
    logPhotoUploadDebug('metadata-insert-failed', {
      entityId: normalized.entityId,
      entityType: normalized.entityType,
      error: insertResult.error,
      farmId: normalized.farmId,
      fileName: finalFileName,
      fileSize: fileResult.data.fileSize,
      localUri: normalized.localUri,
      mimeType: fileResult.data.mimeType,
      readAttempts: fileResult.data.readAttempts,
      readMethod: fileResult.data.readMethod,
      storagePath,
      taskId: normalized.taskId,
    });
    await removeStorageObjectBestEffort(storagePath, {
      entityId: normalized.entityId,
      entityType: normalized.entityType,
      farmId: normalized.farmId,
      fileName: finalFileName,
      fileSize: fileResult.data.fileSize,
      localUri: normalized.localUri,
      mimeType: fileResult.data.mimeType,
      readAttempts: fileResult.data.readAttempts,
      readMethod: fileResult.data.readMethod,
      storagePath,
      taskId: normalized.taskId,
    });
    return fail(insertResult.error, 'Foto terunggah, tetapi metadata gagal disimpan.');
  }

  return ok({
    attachment: mapPhotoAttachment(insertResult.data),
  });
}

export async function uploadEntityPhoto(
  input: UploadEntityPhotoInput
): Promise<ServiceResult<PhotoAttachmentWithSignedUrl>> {
  const uploadResult = await uploadPhotoAttachment(input);

  if (uploadResult.error) {
    return fail(uploadResult.error, 'Foto gagal diunggah.');
  }

  const signedUrlResult = await getPhotoSignedUrl(uploadResult.data.attachment.storagePath);

  if (signedUrlResult.error) {
    return fail(signedUrlResult.error, 'Foto berhasil diunggah, tetapi pratinjau gagal dimuat.');
  }

  return ok({
    attachment: uploadResult.data.attachment,
    signedUrl: signedUrlResult.data.signedUrl,
  });
}

export async function listEntityPhotos(
  input: ListEntityPhotosInput
): Promise<ServiceResult<PhotoAttachmentWithSignedUrl[]>> {
  const photoResult = await listPhotoAttachments(input);

  if (photoResult.error) {
    return fail(photoResult.error, 'Gagal memuat daftar foto.');
  }

  return photosWithSignedUrls(photoResult.data);
}

export async function replaceSinglePhotoAttachment(
  input: ReplaceSinglePhotoAttachmentInput
): Promise<ServiceResult<PhotoAttachmentWithSignedUrl>> {
  const previousPhotosResult = await listPhotoAttachments({
    entityId: input.entityId,
    entityType: input.entityType,
    farmId: input.farmId,
  });

  if (previousPhotosResult.error) {
    return fail(previousPhotosResult.error, 'Gagal memeriksa foto sebelumnya.');
  }

  const uploadResult = await uploadEntityPhoto({
    ...input,
    isPrimary: input.isPrimary ?? true,
  });

  if (uploadResult.error) {
    return fail(uploadResult.error);
  }

  const deleteResults = await Promise.all(
    previousPhotosResult.data
      .filter((photo) => photo.id !== uploadResult.data.attachment.id)
      .map((photo) => deletePhotoAttachment({ photoId: photo.id }))
  );
  const failedDelete = deleteResults.find((result) => result.error);

  if (failedDelete?.error) {
    return fail(
      failedDelete.error,
      'Foto pengganti berhasil diunggah, tetapi foto lama belum dapat dihapus.'
    );
  }

  return ok(uploadResult.data);
}

export async function getTreeMainPhoto(
  farmId: UUID,
  treeId: UUID
): Promise<ServiceResult<GetTreeMainPhotoData>> {
  const photoResult = await getPrimaryTreeMainPhotoRow(farmId, treeId);

  if (photoResult.error) {
    return fail(photoResult.error);
  }

  if (!photoResult.data) {
    return ok(null);
  }

  const signedUrlResult = await getPhotoSignedUrl(photoResult.data.storage_path);

  if (signedUrlResult.error) {
    return fail(signedUrlResult.error, 'Gagal memuat foto pohon.');
  }

  return ok({
    attachment: mapPhotoAttachment(photoResult.data),
    signedUrl: signedUrlResult.data.signedUrl,
  });
}

export async function uploadTreeMainPhoto(
  input: UploadTreeMainPhotoInput
): Promise<ServiceResult<TreeMainPhoto>> {
  const farmId = normalizeRequiredText(input.farmId, 'Kebun tidak valid.');
  const treeId = normalizeRequiredText(input.treeId, 'Pohon tidak valid.');

  if (farmId instanceof Error) {
    return fail(farmId);
  }

  if (treeId instanceof Error) {
    return fail(treeId);
  }

  const accessResult = await ensureActiveOwner(farmId);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const previousPhotosResult = await listTreeMainPhotoRows(farmId, treeId);

  if (previousPhotosResult.error) {
    return fail(previousPhotosResult.error);
  }

  const uploadResult = await uploadPhotoAttachment({
    base64: input.base64,
    entityId: treeId,
    entityType: 'tree_main',
    farmId,
    fileName: input.fileName,
    isPrimary: true,
    localUri: input.localUri,
    mimeType: input.mimeType,
  });

  if (uploadResult.error) {
    return fail(uploadResult.error, 'Foto gagal diunggah.');
  }

  await deleteSupersededTreeMainPhotos(
    previousPhotosResult.data.map((photo) => mapPhotoAttachment(photo)),
    uploadResult.data.attachment.id
  );

  const signedUrlResult = await getPhotoSignedUrl(uploadResult.data.attachment.storagePath);

  if (signedUrlResult.error) {
    return fail(signedUrlResult.error, 'Foto berhasil diunggah, tetapi pratinjau gagal dimuat.');
  }

  return ok({
    attachment: uploadResult.data.attachment,
    signedUrl: signedUrlResult.data.signedUrl,
  });
}

export async function deleteTreeMainPhoto(
  input: DeleteTreeMainPhotoInput
): Promise<ServiceResult<SuccessData>> {
  const farmId = normalizeRequiredText(input.farmId, 'Kebun tidak valid.');
  const treeId = normalizeRequiredText(input.treeId, 'Pohon tidak valid.');

  if (farmId instanceof Error) {
    return fail(farmId);
  }

  if (treeId instanceof Error) {
    return fail(treeId);
  }

  const accessResult = await ensureActiveOwner(farmId);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const photosResult = await listTreeMainPhotoRows(farmId, treeId);

  if (photosResult.error) {
    return fail(photosResult.error);
  }

  if (photosResult.data.length === 0) {
    return ok({
      success: true,
    });
  }

  const deleteResults = await Promise.all(
    photosResult.data.map((photo) => deletePhotoAttachment({ photoId: photo.id }))
  );
  const failedDelete = deleteResults.find((result) => result.error);

  if (failedDelete?.error) {
    return fail(failedDelete.error, 'Gagal menghapus foto pohon.');
  }

  return ok({
    success: true,
  });
}

export async function listTreeMainPhotosForFarm(
  farmId: UUID
): Promise<ServiceResult<TreeMainPhotoMap>> {
  const normalizedFarmId = normalizeRequiredText(farmId, 'Kebun tidak valid.');

  if (normalizedFarmId instanceof Error) {
    return fail(normalizedFarmId);
  }

  const { data, error } = await supabase
    .from('photo_attachments')
    .select(PHOTO_ATTACHMENT_SELECT)
    .eq('farm_id', normalizedFarmId)
    .eq('entity_type', 'tree_main')
    .eq('is_primary', true)
    .order('created_at', { ascending: false })
    .returns<PhotoAttachmentRow[]>();

  if (error) {
    return fail(error, 'Gagal memuat foto pohon.');
  }

  const uniqueRowsByTree = new Map<string, PhotoAttachmentRow>();

  for (const row of data ?? []) {
    if (!uniqueRowsByTree.has(row.entity_id)) {
      uniqueRowsByTree.set(row.entity_id, row);
    }
  }

  const entries = await Promise.all(
    Array.from(uniqueRowsByTree.entries()).map(async ([treeId, row]) => {
      const signedUrlResult = await getPhotoSignedUrl(row.storage_path);

      if (signedUrlResult.error) {
        return null;
      }

      return [
        treeId,
        {
          attachment: mapPhotoAttachment(row),
          signedUrl: signedUrlResult.data.signedUrl,
        },
      ] as const;
    })
  );

  return ok(
    Object.fromEntries(
      entries.filter((entry): entry is [string, TreeMainPhoto] => entry !== null)
    )
  );
}

export async function uploadConditionRecordPhoto(
  input: UploadConditionRecordPhotoInput
): Promise<ServiceResult<ConditionRecordPhoto>> {
  const farmId = normalizeRequiredText(input.farmId, 'Kebun tidak valid.');
  const conditionRecordId = normalizeRequiredText(
    input.conditionRecordId,
    'Laporan kondisi tidak valid.'
  );

  if (farmId instanceof Error) {
    return fail(farmId);
  }

  if (conditionRecordId instanceof Error) {
    return fail(conditionRecordId);
  }

  const uploadResult = await uploadPhotoAttachment({
    base64: input.base64,
    caption: input.caption,
    entityId: conditionRecordId,
    entityType: 'condition_record',
    farmId,
    fileName: input.fileName,
    isPrimary: false,
    localUri: input.localUri,
    mimeType: input.mimeType,
  });

  if (uploadResult.error) {
    return fail(uploadResult.error, 'Foto gagal diunggah.');
  }

  const signedUrlResult = await getPhotoSignedUrl(uploadResult.data.attachment.storagePath);

  if (signedUrlResult.error) {
    return fail(signedUrlResult.error, 'Foto berhasil diunggah, tetapi pratinjau gagal dimuat.');
  }

  return ok({
    attachment: uploadResult.data.attachment,
    signedUrl: signedUrlResult.data.signedUrl,
  });
}

export async function getConditionRecordPhotos(
  input: GetConditionRecordPhotosInput
): Promise<ServiceResult<ConditionRecordPhoto[]>> {
  const photoResult = await listPhotoAttachments({
    entityId: input.conditionRecordId,
    entityType: 'condition_record',
    farmId: input.farmId,
  });

  if (photoResult.error) {
    return fail(photoResult.error, 'Gagal memuat foto kondisi.');
  }

  const photos = await Promise.all(
    photoResult.data.map(async (attachment) => {
      const signedUrlResult = await getPhotoSignedUrl(attachment.storagePath);

      if (signedUrlResult.error) {
        return null;
      }

      return {
        attachment,
        signedUrl: signedUrlResult.data.signedUrl,
      };
    })
  );

  return ok(
    photos.filter((photo): photo is ConditionRecordPhoto => photo !== null)
  );
}

export async function listConditionRecordPhotosForTree(
  input: ListConditionRecordPhotosForTreeInput
): Promise<ServiceResult<ConditionRecordPhotoMap>> {
  const farmId = normalizeRequiredText(input.farmId, 'Kebun tidak valid.');
  const treeId = normalizeRequiredText(input.treeId, 'Pohon tidak valid.');
  const conditionRecordIds = Array.from(new Set(input.conditionRecordIds.filter(Boolean)));

  if (farmId instanceof Error) {
    return fail(farmId);
  }

  if (treeId instanceof Error) {
    return fail(treeId);
  }

  if (conditionRecordIds.length === 0) {
    return ok({});
  }

  const validRecordResult = await supabase
    .from('tree_condition_reports')
    .select('id')
    .eq('farm_id', farmId)
    .eq('tree_id', treeId)
    .in('id', conditionRecordIds)
    .returns<Array<{ id: string }>>();

  if (validRecordResult.error) {
    return fail(validRecordResult.error, 'Gagal memeriksa laporan kondisi.');
  }

  const validConditionRecordIds = (validRecordResult.data ?? []).map((row) => row.id);

  if (validConditionRecordIds.length === 0) {
    return ok({});
  }

  const { data, error } = await supabase
    .from('photo_attachments')
    .select(PHOTO_ATTACHMENT_SELECT)
    .eq('farm_id', farmId)
    .eq('entity_type', 'condition_record')
    .in('entity_id', validConditionRecordIds)
    .order('created_at', { ascending: false })
    .returns<PhotoAttachmentRow[]>();

  if (error) {
    return fail(error, 'Gagal memuat foto kondisi.');
  }

  const uniqueRowsByRecord = new Map<string, PhotoAttachmentRow>();

  for (const row of data ?? []) {
    if (!uniqueRowsByRecord.has(row.entity_id)) {
      uniqueRowsByRecord.set(row.entity_id, row);
    }
  }

  const entries = await Promise.all(
    Array.from(uniqueRowsByRecord.entries()).map(async ([conditionRecordId, row]) => {
      const signedUrlResult = await getPhotoSignedUrl(row.storage_path);

      if (signedUrlResult.error) {
        return null;
      }

      return [
        conditionRecordId,
        {
          attachment: mapPhotoAttachment(row),
          signedUrl: signedUrlResult.data.signedUrl,
        },
      ] as const;
    })
  );

  return ok(
    Object.fromEntries(
      entries.filter((entry): entry is [string, ConditionRecordPhoto] => entry !== null)
    )
  );
}

export async function uploadTaskProofPhoto(
  input: UploadTaskProofPhotoInput
): Promise<ServiceResult<TaskProofPhoto>> {
  const farmId = normalizeRequiredText(input.farmId, 'Kebun tidak valid.');
  const taskId = normalizeRequiredText(input.taskId, 'Tugas tidak valid.');
  const activityId = normalizeRequiredText(input.activityId, 'Hasil kerja tidak valid.');

  if (farmId instanceof Error) {
    return fail(farmId);
  }

  if (taskId instanceof Error) {
    return fail(taskId);
  }

  if (activityId instanceof Error) {
    return fail(activityId);
  }

  const uploadResult = await uploadPhotoAttachment({
    base64: input.base64,
    caption: input.caption,
    entityId: activityId,
    entityType: 'task_proof',
    farmId,
    fileName: input.fileName,
    isPrimary: false,
    localUri: input.localUri,
    mimeType: input.mimeType,
    taskId,
  });

  if (uploadResult.error) {
    return fail(uploadResult.error, 'Foto bukti gagal diunggah.');
  }

  const signedUrlResult = await getPhotoSignedUrl(uploadResult.data.attachment.storagePath);

  if (signedUrlResult.error) {
    return fail(signedUrlResult.error, 'Foto bukti berhasil diunggah, tetapi pratinjau gagal dimuat.');
  }

  return ok({
    attachment: uploadResult.data.attachment,
    signedUrl: signedUrlResult.data.signedUrl,
  });
}

export async function getTaskProofPhotos(
  input: GetTaskProofPhotosInput
): Promise<ServiceResult<TaskProofPhoto[]>> {
  const photoResult = await listPhotoAttachments({
    entityId: input.activityId,
    entityType: 'task_proof',
    farmId: input.farmId,
  });

  if (photoResult.error) {
    return fail(photoResult.error, 'Gagal memuat bukti foto tugas.');
  }

  const photos = await Promise.all(
    photoResult.data.map(async (attachment) => {
      const signedUrlResult = await getPhotoSignedUrl(attachment.storagePath);

      if (signedUrlResult.error) {
        return null;
      }

      return {
        attachment,
        signedUrl: signedUrlResult.data.signedUrl,
      };
    })
  );

  return ok(
    photos.filter((photo): photo is TaskProofPhoto => photo !== null)
  );
}

export async function listTaskProofPhotosForActivities(
  input: ListTaskProofPhotosForActivitiesInput
): Promise<ServiceResult<TaskProofPhotoMap>> {
  const farmId = normalizeRequiredText(input.farmId, 'Kebun tidak valid.');
  const activityIds = Array.from(new Set(input.activityIds.filter(Boolean)));

  if (farmId instanceof Error) {
    return fail(farmId);
  }

  if (activityIds.length === 0) {
    return ok({});
  }

  const validActivityResult = await supabase
    .from('care_activities')
    .select('id')
    .eq('farm_id', farmId)
    .in('id', activityIds)
    .returns<Array<{ id: string }>>();

  if (validActivityResult.error) {
    return fail(validActivityResult.error, 'Gagal memeriksa hasil kerja.');
  }

  const validActivityIds = (validActivityResult.data ?? []).map((row) => row.id);

  if (validActivityIds.length === 0) {
    return ok({});
  }

  const { data, error } = await supabase
    .from('photo_attachments')
    .select(PHOTO_ATTACHMENT_SELECT)
    .eq('farm_id', farmId)
    .eq('entity_type', 'task_proof')
    .in('entity_id', validActivityIds)
    .order('created_at', { ascending: false })
    .returns<PhotoAttachmentRow[]>();

  if (error) {
    return fail(error, 'Gagal memuat bukti foto tugas.');
  }

  const uniqueRowsByActivity = new Map<string, PhotoAttachmentRow>();

  for (const row of data ?? []) {
    if (!uniqueRowsByActivity.has(row.entity_id)) {
      uniqueRowsByActivity.set(row.entity_id, row);
    }
  }

  const entries = await Promise.all(
    Array.from(uniqueRowsByActivity.entries()).map(async ([activityId, row]) => {
      const signedUrlResult = await getPhotoSignedUrl(row.storage_path);

      if (signedUrlResult.error) {
        return null;
      }

      return [
        activityId,
        {
          attachment: mapPhotoAttachment(row),
          signedUrl: signedUrlResult.data.signedUrl,
        },
      ] as const;
    })
  );

  return ok(
    Object.fromEntries(
      entries.filter((entry): entry is [string, TaskProofPhoto] => entry !== null)
    )
  );
}

// ---------------------------------------------------------------------------
// Foto laporan operasional
// ---------------------------------------------------------------------------
// Batasan yang DITEGAKKAN RLS (migration 035) — UI harus mengikuti ini, jangan
// berasumsi lain:
//   - HANYA pekerja pembuat laporan yang boleh upload dan hapus.
//   - HANYA selama laporan masih berstatus 'new' DAN belum disentuh owner sama
//     sekali (responded_by, responded_at, owner_response_note semuanya kosong).
//     Begitu owner merespons, upload dan hapus langsung ditolak database.
//   - Owner boleh MEMBACA, tidak boleh upload.
//   - Laporan HARUS sudah ada sebelum upload, karena entity_id = report.id dan
//     policy memverifikasinya ke tabel operational_reports. Jadi di form "Buat
//     Laporan": insert laporan dulu, baru upload foto.
//   - Kalau upload gagal, JANGAN rollback laporannya. Foto laporan bersifat
//     opsional (beda dengan task_proof yang bisa wajib) — cukup peringatkan
//     pekerja bahwa fotonya tidak terkirim.
//
// Path storage: farms/{farmId}/operational-reports/{reportId}/{ts}-{rand}.{ext}
// (cabang generik buildPhotoStoragePath; sudah cocok dengan fungsi SQL
// avology_storage_path_farm_id / _entity_folder / _entity_id).

export async function uploadOperationalReportPhoto(
  input: UploadOperationalReportPhotoInput
): Promise<ServiceResult<OperationalReportPhoto>> {
  const farmId = normalizeRequiredText(input.farmId, 'Kebun tidak valid.');
  const operationalReportId = normalizeRequiredText(
    input.operationalReportId,
    'Laporan operasional tidak valid.'
  );

  if (farmId instanceof Error) {
    return fail(farmId);
  }

  if (operationalReportId instanceof Error) {
    return fail(operationalReportId);
  }

  const uploadResult = await uploadPhotoAttachment({
    base64: input.base64,
    caption: input.caption,
    entityId: operationalReportId,
    entityType: 'operational_report',
    farmId,
    fileName: input.fileName,
    isPrimary: false,
    localUri: input.localUri,
    mimeType: input.mimeType,
  });

  if (uploadResult.error) {
    return fail(uploadResult.error, 'Foto laporan gagal diunggah.');
  }

  const signedUrlResult = await getPhotoSignedUrl(uploadResult.data.attachment.storagePath);

  if (signedUrlResult.error) {
    return fail(
      signedUrlResult.error,
      'Foto laporan berhasil diunggah, tetapi pratinjau gagal dimuat.'
    );
  }

  return ok({
    attachment: uploadResult.data.attachment,
    signedUrl: signedUrlResult.data.signedUrl,
  });
}

export async function listOperationalReportPhotos(
  input: ListOperationalReportPhotosInput
): Promise<ServiceResult<OperationalReportPhoto[]>> {
  const photoResult = await listPhotoAttachments({
    entityId: input.operationalReportId,
    entityType: 'operational_report',
    farmId: input.farmId,
  });

  if (photoResult.error) {
    return fail(photoResult.error, 'Gagal memuat foto laporan.');
  }

  const photos = await Promise.all(
    photoResult.data.map(async (attachment) => {
      const signedUrlResult = await getPhotoSignedUrl(attachment.storagePath);

      if (signedUrlResult.error) {
        return null;
      }

      return {
        attachment,
        signedUrl: signedUrlResult.data.signedUrl,
      };
    })
  );

  return ok(photos.filter((photo): photo is OperationalReportPhoto => photo !== null));
}

// Jumlah foto untuk BANYAK laporan sekaligus — satu query, bukan N+1.
// Sengaja tidak membuat signed URL: daftar laporan hanya butuh angkanya, dan
// signed URL itu yang mahal (satu round-trip per foto). RLS tetap memfilter
// baris, jadi pekerja hanya menghitung foto laporannya sendiri.
export async function countOperationalReportPhotos(
  input: CountOperationalReportPhotosInput
): Promise<ServiceResult<OperationalReportPhotoCountMap>> {
  const farmId = normalizeRequiredText(input.farmId, 'Kebun tidak valid.');
  const reportIds = Array.from(new Set(input.operationalReportIds.filter(Boolean)));

  if (farmId instanceof Error) {
    return fail(farmId);
  }

  if (reportIds.length === 0) {
    return ok({});
  }

  const { data, error } = await supabase
    .from('photo_attachments')
    .select('entity_id')
    .eq('farm_id', farmId)
    .eq('entity_type', 'operational_report')
    .in('entity_id', reportIds)
    .returns<Array<{ entity_id: string }>>();

  if (error) {
    return fail(error, 'Gagal memuat jumlah foto laporan.');
  }

  const counts: OperationalReportPhotoCountMap = {};

  for (const row of data ?? []) {
    counts[row.entity_id] = (counts[row.entity_id] ?? 0) + 1;
  }

  return ok(counts);
}

// Hapus satu foto laporan (objek storage dulu, baru baris metadata — urutan itu
// sudah benar di deletePhotoAttachment dan penting karena policy DELETE storage
// memakai baris photo_attachments sebagai bukti kepemilikan).
export async function deleteOperationalReportPhoto(
  input: DeletePhotoAttachmentInput
): Promise<ServiceResult<SuccessData>> {
  const result = await deletePhotoAttachment(input);

  if (result.error) {
    return fail(result.error, 'Foto laporan gagal dihapus.');
  }

  return ok(result.data);
}

// Bersih-bersih objek storage SEBELUM RPC delete_own_operational_report jalan.
// RPC itu menghapus baris photo_attachments DAN baris laporannya sekaligus;
// setelah itu tidak ada lagi yang membuktikan kepemilikan file ke policy DELETE
// storage, jadi file yang belum sempat dihapus jadi yatim permanen.
//
// Sengaja TIDAK menghapus baris photo_attachments di sini — biar RPC yang
// melakukannya secara transaksional bersama laporannya.
export async function deleteOperationalReportPhotoObjects(
  input: DeleteOperationalReportPhotoObjectsInput
): Promise<ServiceResult<SuccessData>> {
  const photoResult = await listPhotoAttachments({
    entityId: input.operationalReportId,
    entityType: 'operational_report',
    farmId: input.farmId,
  });

  if (photoResult.error) {
    logOperationalReportPhotoCleanupWarning('list-failed', {
      message: photoResult.error.message,
      operationalReportId: input.operationalReportId,
    });

    return fail(photoResult.error, 'Gagal memeriksa foto laporan.');
  }

  const storagePaths = photoResult.data.map((attachment) => attachment.storagePath);

  if (storagePaths.length === 0) {
    return ok({
      success: true,
    });
  }

  const removeResult = await supabase.storage.from(PHOTO_STORAGE_BUCKET).remove(storagePaths);

  if (removeResult.error) {
    logOperationalReportPhotoCleanupWarning('remove-failed', {
      message: removeResult.error.message,
      operationalReportId: input.operationalReportId,
      requested: storagePaths.length,
    });

    return fail(removeResult.error, 'Sebagian file foto laporan gagal dihapus.');
  }

  const removedCount = removeResult.data?.length ?? 0;

  if (removedCount < storagePaths.length) {
    logOperationalReportPhotoCleanupWarning('remove-partial', {
      operationalReportId: input.operationalReportId,
      removed: removedCount,
      requested: storagePaths.length,
    });
  }

  return ok({
    success: true,
  });
}

function logOperationalReportPhotoCleanupWarning(
  stage: string,
  payload: Record<string, unknown>
): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  console.warn('[operational-report-photo-cleanup]', stage, payload);
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
    return fail(new Error('Gagal memuat foto.'));
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

  const taskId = normalizeOptionalText(input.taskId);

  if (entityType === 'task_proof' && !taskId) {
    return new Error('Tugas untuk bukti foto tidak valid.');
  }

  return {
    caption: normalizeOptionalText(input.caption),
    entityId,
    entityType,
    farmId,
    fileName: normalizeOptionalText(input.fileName),
    isPrimary: input.isPrimary ?? false,
    localUri,
    base64: normalizeOptionalText(input.base64),
    mimeType: normalizeOptionalText(input.mimeType),
    taskId,
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

async function loadLocalImageFile(input: {
  fallbackBase64: string | null;
  fallbackMimeType: string | null;
  fileName: string | null;
  localUri: string;
}): Promise<ServiceResult<LocalImageFileData>> {
  const readAttempts: string[] = [];
  const base64Result = readImageFileFromBase64(input, readAttempts);

  if (!(base64Result instanceof Error)) {
    return ok(base64Result);
  }

  logLocalPhotoReadDebug('local-read-base64-failed', input, base64Result, readAttempts);

  const fileSystemResult = await readImageFileWithExpoFileSystem(input, readAttempts);

  if (!(fileSystemResult instanceof Error)) {
    return ok(fileSystemResult);
  }

  logLocalPhotoReadDebug('local-read-filesystem-failed', input, fileSystemResult, readAttempts);

  const fetchResult = await readImageFileWithFetch(input, readAttempts);

  if (!(fetchResult instanceof Error)) {
    return ok(fetchResult);
  }

  logLocalPhotoReadDebug('local-read-fetch-failed', input, fetchResult, readAttempts);

  return fail(new Error('File foto tidak dapat dibaca.'));
}

async function readImageFileWithFetch(input: {
  fallbackMimeType: string | null;
  fileName: string | null;
  localUri: string;
}, readAttempts: string[]): Promise<LocalImageFileData | Error> {
  try {
    const response = await fetch(input.localUri);

    if (!response.ok) {
      const message = `fetch_blob_failed: Fetch local photo returned ${response.status}.`;
      readAttempts.push(message);
      return new Error(message);
    }

    const blob = await response.blob();
    return validateLocalImageUploadBody({
      blob,
      fallbackMimeType: input.fallbackMimeType,
      fileName: input.fileName,
      localUri: input.localUri,
      readAttempts,
      readMethod: 'fetch-blob',
    });
  } catch (error) {
    const message = `fetch_blob_failed: ${getErrorMessage(error)}`;
    readAttempts.push(message);
    return new Error(message);
  }
}

async function readImageFileWithExpoFileSystem(input: {
  fallbackMimeType: string | null;
  fileName: string | null;
  localUri: string;
}, readAttempts: string[]): Promise<LocalImageFileData | Error> {
  try {
    const base64 = await FileSystem.readAsStringAsync(input.localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const mimeType = resolveLocalImageMimeType({
      fallbackMimeType: input.fallbackMimeType,
      fileName: input.fileName,
      localUri: input.localUri,
    });

    if (!mimeType) {
      const message = 'filesystem_read_failed: Photo MIME type could not be resolved.';
      readAttempts.push(message);
      return new Error(message);
    }

    return validateLocalImageUploadBody({
      arrayBuffer: base64ToArrayBuffer(base64),
      fallbackMimeType: mimeType,
      fileName: input.fileName,
      localUri: input.localUri,
      readAttempts,
      readMethod: 'expo-file-system-base64',
    });
  } catch (error) {
    const message = `filesystem_read_failed: ${getErrorMessage(error)}`;
    readAttempts.push(message);
    return new Error(message);
  }
}

function readImageFileFromBase64(input: {
  fallbackBase64: string | null;
  fallbackMimeType: string | null;
  fileName: string | null;
  localUri: string;
}, readAttempts: string[]): LocalImageFileData | Error {
  try {
    if (!input.fallbackBase64) {
      readAttempts.push('base64_missing');
      return new Error('base64_missing');
    }

    const mimeType = resolveLocalImageMimeType({
      fallbackMimeType: input.fallbackMimeType,
      fileName: input.fileName,
      localUri: input.localUri,
    });

    if (!mimeType) {
      const message = 'base64_failed: Photo MIME type could not be resolved.';
      readAttempts.push(message);
      return new Error(message);
    }

    return validateLocalImageUploadBody({
      arrayBuffer: base64ToArrayBuffer(input.fallbackBase64),
      fallbackMimeType: mimeType,
      fileName: input.fileName,
      localUri: input.localUri,
      readAttempts,
      readMethod: 'base64',
    });
  } catch (error) {
    const message = `base64_failed: ${getErrorMessage(error)}`;
    readAttempts.push(message);
    return new Error(message);
  }
}

function validateLocalImageUploadBody(input: {
  arrayBuffer?: ArrayBuffer;
  blob?: Blob;
  fallbackMimeType: string | null;
  fileName: string | null;
  localUri: string;
  readAttempts: string[];
  readMethod: LocalImageFileData['readMethod'];
}): LocalImageFileData | Error {
  const mimeType = resolveLocalImageMimeType({
    blobType: input.blob?.type,
    fallbackMimeType: input.fallbackMimeType,
    fileName: input.fileName,
    localUri: input.localUri,
  });

  if (!mimeType) {
    return new Error('Tipe file foto tidak dikenali.');
  }

  if (!isImageMimeType(mimeType)) {
    return new Error('File yang dipilih harus berupa gambar.');
  }

  const fileSize = input.arrayBuffer?.byteLength ?? input.blob?.size ?? 0;

  if (fileSize <= 0) {
    return new Error('File foto kosong atau tidak dapat dibaca.');
  }

  if (fileSize > MAX_PHOTO_SIZE_BYTES) {
    return new Error('Ukuran foto terlalu besar.');
  }

  if (input.arrayBuffer) {
    return {
      uploadBody: input.arrayBuffer,
      fileSize,
      mimeType,
      readAttempts: [...input.readAttempts],
      readMethod: input.readMethod,
    };
  }

  if (!input.blob) {
    return new Error('File foto kosong atau tidak dapat dibaca.');
  }

  if (input.blob.type === mimeType) {
    return {
      uploadBody: input.blob,
      fileSize,
      mimeType,
      readAttempts: [...input.readAttempts],
      readMethod: input.readMethod,
    };
  }

  return {
    uploadBody: input.blob.slice(0, input.blob.size, mimeType),
    fileSize,
    mimeType,
    readAttempts: [...input.readAttempts],
    readMethod: input.readMethod,
  };
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
  taskId: UUID | null;
}): string {
  const folder = entityPathFolders[input.entityType];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const random = Math.random().toString(36).slice(2, 10);

  if (input.entityType === 'tree_main') {
    return `farms/${input.farmId}/${folder}/${input.entityId}/main/${timestamp}-${random}.${input.extension}`;
  }

  if (input.entityType === 'task_proof') {
    return `farms/${input.farmId}/${folder}/${input.taskId}/${input.entityId}/${timestamp}-${random}.${input.extension}`;
  }

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

function resolveLocalImageMimeType(input: {
  blobType?: string | null;
  fallbackMimeType?: string | null;
  fileName?: string | null;
  localUri?: string | null;
}): string | null {
  const explicitMimeType = normalizeMimeType(input.blobType || input.fallbackMimeType);

  if (explicitMimeType) {
    return explicitMimeType;
  }

  const extension = input.fileName?.split('.').pop()?.toLowerCase()
    ?? input.localUri?.split('?')[0]?.split('.').pop()?.toLowerCase();

  if (extension === 'png') {
    return 'image/png';
  }

  if (extension === 'webp') {
    return 'image/webp';
  }

  if (extension === 'heic') {
    return 'image/heic';
  }

  if (extension === 'heif') {
    return 'image/heif';
  }

  if (extension === 'jpg' || extension === 'jpeg') {
    return 'image/jpeg';
  }

  return 'image/jpeg';
}

function base64ToUint8Array(base64: string): Uint8Array {
  const cleanBase64 = (base64.includes(',') ? base64.split(',').pop() ?? '' : base64)
    .replace(/\s/g, '');
  const padding = cleanBase64.endsWith('==') ? 2 : cleanBase64.endsWith('=') ? 1 : 0;
  const byteLength = Math.floor((cleanBase64.length * 3) / 4) - padding;
  const bytes = new Uint8Array(byteLength);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let byteIndex = 0;

  for (let index = 0; index < cleanBase64.length; index += 4) {
    const first = alphabet.indexOf(cleanBase64[index] ?? 'A');
    const second = alphabet.indexOf(cleanBase64[index + 1] ?? 'A');
    const thirdChar = cleanBase64[index + 2];
    const fourthChar = cleanBase64[index + 3];
    const third = thirdChar && thirdChar !== '=' ? alphabet.indexOf(thirdChar) : 0;
    const fourth = fourthChar && fourthChar !== '=' ? alphabet.indexOf(fourthChar) : 0;

    if (first < 0 || second < 0 || third < 0 || fourth < 0) {
      throw new Error('Base64 foto tidak valid.');
    }

    const chunk = (first << 18) | (second << 12) | (third << 6) | fourth;

    if (byteIndex < byteLength) {
      bytes[byteIndex] = (chunk >> 16) & 255;
      byteIndex += 1;
    }

    if (byteIndex < byteLength) {
      bytes[byteIndex] = (chunk >> 8) & 255;
      byteIndex += 1;
    }

    if (byteIndex < byteLength) {
      bytes[byteIndex] = chunk & 255;
      byteIndex += 1;
    }
  }

  return bytes;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const bytes = base64ToUint8Array(base64);
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown error';
}

function isImageMimeType(value: string): boolean {
  return value.startsWith('image/');
}

async function photosWithSignedUrls(
  attachments: PhotoAttachment[]
): Promise<ServiceResult<PhotoAttachmentWithSignedUrl[]>> {
  const photos = await Promise.all(
    attachments.map(async (attachment) => {
      const signedUrlResult = await getPhotoSignedUrl(attachment.storagePath);

      if (signedUrlResult.error) {
        return null;
      }

      return {
        attachment,
        signedUrl: signedUrlResult.data.signedUrl,
      };
    })
  );

  return ok(
    photos.filter((photo): photo is PhotoAttachmentWithSignedUrl => photo !== null)
  );
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

function logPhotoUploadDebug(
  stage: string,
  input: PhotoUploadDebugInput
): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  const errorLike = input.error as PhotoUploadDebugError | null | undefined;
  const log = input.error ? console.warn : console.debug;

  log('[photo-upload]', {
    code: errorLike?.code ?? null,
    details: errorLike?.details ?? null,
    entityId: input.entityId,
    entityType: input.entityType,
    farmId: input.farmId,
    fileName: input.fileName ?? null,
    fileSize: input.fileSize ?? null,
    hint: errorLike?.hint ?? null,
    localUri: input.localUri ?? null,
    message: input.error ? errorLike?.message ?? String(input.error) : null,
    mimeType: input.mimeType ?? null,
    name: errorLike?.name ?? null,
    readAttempts: input.readAttempts ?? null,
    readMethod: input.readMethod ?? null,
    stage,
    status: errorLike?.status ?? errorLike?.statusCode ?? null,
    storagePath: input.storagePath,
    taskId: input.taskId ?? null,
  });
}

function logLocalPhotoReadDebug(
  stage: string,
  input: {
    fallbackBase64?: string | null;
    fallbackMimeType?: string | null;
    fileName?: string | null;
    localUri: string;
  },
  error: Error,
  readAttempts: string[]
): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  console.warn('[photo-local-read]', {
    base64Length: input.fallbackBase64?.length ?? null,
    fileName: input.fileName ?? null,
    hasBase64: Boolean(input.fallbackBase64),
    message: error.message,
    mimeType: input.fallbackMimeType ?? null,
    name: error.name,
    readAttempts,
    stage,
    uriPrefix: input.localUri.slice(0, 32),
  });
}

async function removeStorageObjectBestEffort(
  storagePath: string,
  debugInput?: PhotoUploadDebugInput
): Promise<void> {
  const result = await supabase.storage.from(PHOTO_STORAGE_BUCKET).remove([storagePath]);

  if (result.error && debugInput) {
    logPhotoUploadDebug('cleanup-failed', {
      ...debugInput,
      error: result.error,
    });
  }
}

async function listTreeMainPhotoRows(
  farmId: UUID,
  treeId: UUID
): Promise<ServiceResult<PhotoAttachmentRow[]>> {
  const { data, error } = await supabase
    .from('photo_attachments')
    .select(PHOTO_ATTACHMENT_SELECT)
    .eq('farm_id', farmId)
    .eq('entity_type', 'tree_main')
    .eq('entity_id', treeId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: false })
    .returns<PhotoAttachmentRow[]>();

  if (error) {
    return fail(error, 'Gagal memuat foto pohon.');
  }

  return ok(data ?? []);
}

async function getPrimaryTreeMainPhotoRow(
  farmId: UUID,
  treeId: UUID
): Promise<ServiceResult<PhotoAttachmentRow | null>> {
  const photosResult = await listTreeMainPhotoRows(farmId, treeId);

  if (photosResult.error) {
    return fail(photosResult.error);
  }

  return ok(photosResult.data.find((photo) => photo.is_primary) ?? photosResult.data[0] ?? null);
}

async function deleteSupersededTreeMainPhotos(
  previousPhotos: PhotoAttachment[],
  currentPhotoId: UUID
): Promise<void> {
  await Promise.all(
    previousPhotos
      .filter((photo) => photo.id !== currentPhotoId)
      .map((photo) => deletePhotoAttachment({ photoId: photo.id }))
  );
}

async function ensureActiveOwner(farmId: UUID): Promise<ServiceResult<SuccessData>> {
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

  if (data?.role !== 'owner' || data.status !== 'active') {
    return fail(new Error('Hanya pemilik aktif yang dapat mengelola foto pohon.'));
  }

  return ok({
    success: true,
  });
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
