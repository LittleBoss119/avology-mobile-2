import { supabase } from '../lib/supabase';
import type { ServiceResult, SuccessData, UUID } from '../types/domain';
import type {
  ConditionRecordPhoto,
  ConditionRecordPhotoMap,
  DeleteTreeMainPhotoInput,
  DeletePhotoAttachmentInput,
  GetConditionRecordPhotosInput,
  GetTreeMainPhotoData,
  GetPhotoSignedUrlData,
  ListConditionRecordPhotosForTreeInput,
  ListOperationalReportPhotosForReportsInput,
  ListPhotoAttachmentsInput,
  ListTaskProofPhotosForActivitiesInput,
  OperationalReportPhoto,
  OperationalReportPhotoMap,
  PhotoAttachment,
  PhotoAttachmentEntityType,
  PhotoAttachmentPathFolder,
  TaskProofPhoto,
  TaskProofPhotoMap,
  TreeMainPhoto,
  TreeMainPhotoMap,
  UploadConditionRecordPhotoInput,
  UploadOperationalReportPhotoInput,
  UploadTaskProofPhotoInput,
  UploadTreeMainPhotoInput,
  UploadPhotoAttachmentData,
  UploadPhotoAttachmentInput,
  GetOperationalReportPhotosInput,
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

type MembershipRow = {
  role: 'owner' | 'worker';
  status: 'pending' | 'active' | 'rejected' | 'removed';
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
    taskId: normalized.taskId,
  });

  const finalFileName = normalized.fileName ?? storagePath.split('/').at(-1) ?? null;

  const uploadResult = await supabase.storage
    .from(PHOTO_STORAGE_BUCKET)
    .upload(storagePath, fileResult.data.blob, {
      contentType: fileResult.data.mimeType,
      upsert: false,
    });

  if (uploadResult.error) {
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
    await removeStorageObjectBestEffort(storagePath);
    return fail(insertResult.error, 'Foto terunggah, tetapi metadata gagal disimpan.');
  }

  return ok({
    attachment: mapPhotoAttachment(insertResult.data),
  });
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

export async function uploadOperationalReportPhoto(
  input: UploadOperationalReportPhotoInput
): Promise<ServiceResult<OperationalReportPhoto>> {
  const farmId = normalizeRequiredText(input.farmId, 'Kebun tidak valid.');
  const reportId = normalizeRequiredText(input.reportId, 'Laporan operasional tidak valid.');

  if (farmId instanceof Error) {
    return fail(farmId);
  }

  if (reportId instanceof Error) {
    return fail(reportId);
  }

  const reportAccessResult = await ensureOperationalReportAccessibleForPhoto(farmId, reportId);

  if (reportAccessResult.error) {
    return fail(reportAccessResult.error);
  }

  const uploadResult = await uploadPhotoAttachment({
    caption: input.caption,
    entityId: reportId,
    entityType: 'operational_report',
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

export async function getOperationalReportPhotos(
  input: GetOperationalReportPhotosInput
): Promise<ServiceResult<OperationalReportPhoto[]>> {
  const reportAccessResult = await ensureOperationalReportAccessibleForPhoto(
    input.farmId,
    input.reportId
  );

  if (reportAccessResult.error) {
    return fail(reportAccessResult.error);
  }

  const photoResult = await listPhotoAttachments({
    entityId: input.reportId,
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

  return ok(
    photos.filter((photo): photo is OperationalReportPhoto => photo !== null)
  );
}

export async function listOperationalReportPhotosForReports(
  input: ListOperationalReportPhotosForReportsInput
): Promise<ServiceResult<OperationalReportPhotoMap>> {
  const farmId = normalizeRequiredText(input.farmId, 'Kebun tidak valid.');
  const reportIds = Array.from(new Set(input.reportIds.filter(Boolean)));

  if (farmId instanceof Error) {
    return fail(farmId);
  }

  if (reportIds.length === 0) {
    return ok({});
  }

  const validReportResult = await supabase
    .from('operational_reports')
    .select('id')
    .eq('farm_id', farmId)
    .in('id', reportIds)
    .returns<Array<{ id: string }>>();

  if (validReportResult.error) {
    return fail(validReportResult.error, 'Gagal memeriksa laporan operasional.');
  }

  const validReportIds = (validReportResult.data ?? []).map((row) => row.id);

  if (validReportIds.length === 0) {
    return ok({});
  }

  const { data, error } = await supabase
    .from('photo_attachments')
    .select(PHOTO_ATTACHMENT_SELECT)
    .eq('farm_id', farmId)
    .eq('entity_type', 'operational_report')
    .in('entity_id', validReportIds)
    .order('created_at', { ascending: false })
    .returns<PhotoAttachmentRow[]>();

  if (error) {
    return fail(error, 'Gagal memuat foto laporan.');
  }

  const uniqueRowsByReport = new Map<string, PhotoAttachmentRow>();

  for (const row of data ?? []) {
    if (!uniqueRowsByReport.has(row.entity_id)) {
      uniqueRowsByReport.set(row.entity_id, row);
    }
  }

  const entries = await Promise.all(
    Array.from(uniqueRowsByReport.entries()).map(async ([reportId, row]) => {
      const signedUrlResult = await getPhotoSignedUrl(row.storage_path);

      if (signedUrlResult.error) {
        return null;
      }

      return [
        reportId,
        {
          attachment: mapPhotoAttachment(row),
          signedUrl: signedUrlResult.data.signedUrl,
        },
      ] as const;
    })
  );

  return ok(
    Object.fromEntries(
      entries.filter((entry): entry is [string, OperationalReportPhoto] => entry !== null)
    )
  );
}

export async function uploadTaskProofPhoto(
  input: UploadTaskProofPhotoInput
): Promise<ServiceResult<TaskProofPhoto>> {
  const farmId = normalizeRequiredText(input.farmId, 'Kebun tidak valid.');
  const taskId = normalizeRequiredText(input.taskId, 'Tugas tidak valid.');
  const activityId = normalizeRequiredText(input.activityId, 'Realisasi tugas tidak valid.');

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
    return fail(validActivityResult.error, 'Gagal memeriksa realisasi tugas.');
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
      return fail(new Error('Ukuran foto terlalu besar.'));
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

async function ensureOperationalReportAccessibleForPhoto(
  farmId: UUID,
  reportId: UUID
): Promise<ServiceResult<SuccessData>> {
  const { data, error } = await supabase
    .from('operational_reports')
    .select('id, farm_id')
    .eq('id', reportId)
    .eq('farm_id', farmId)
    .maybeSingle<{ id: string; farm_id: string }>();

  if (error) {
    return fail(error, 'Gagal memeriksa akses laporan operasional.');
  }

  if (!data) {
    return fail(new Error('Laporan operasional tidak ditemukan atau tidak dapat diakses.'));
  }

  return ok({
    success: true,
  });
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
