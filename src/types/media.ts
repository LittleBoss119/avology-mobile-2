import type { UUID } from './domain';

export type PhotoAttachmentEntityType =
  | 'tree_main'
  | 'condition_record'
  | 'operational_report'
  | 'task_proof';

export type PhotoAttachmentPathFolder =
  | 'trees'
  | 'condition-reports'
  | 'operational-reports'
  | 'task-proofs';

export type PhotoAttachment = {
  id: UUID;
  farmId: UUID;
  uploadedBy: UUID;
  entityType: PhotoAttachmentEntityType;
  entityId: UUID;
  bucket: string;
  storagePath: string;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  caption: string | null;
  isPrimary: boolean;
  createdAt: string;
};

export type UploadPhotoAttachmentInput = {
  farmId: UUID;
  entityType: PhotoAttachmentEntityType;
  entityId: UUID;
  localUri: string;
  fileName?: string | null;
  mimeType?: string | null;
  caption?: string | null;
  isPrimary?: boolean;
};

export type UploadPhotoAttachmentData = {
  attachment: PhotoAttachment;
};

export type ListPhotoAttachmentsInput = {
  farmId: UUID;
  entityType: PhotoAttachmentEntityType;
  entityId: UUID;
};

export type DeletePhotoAttachmentInput = {
  photoId: UUID;
};

export type GetPhotoSignedUrlData = {
  signedUrl: string;
  expiresIn: number;
};

export type TreeMainPhoto = {
  attachment: PhotoAttachment;
  signedUrl: string;
};

export type TreeMainPhotoMap = Record<UUID, TreeMainPhoto>;

export type GetTreeMainPhotoData = TreeMainPhoto | null;

export type UploadTreeMainPhotoInput = {
  farmId: UUID;
  treeId: UUID;
  localUri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export type DeleteTreeMainPhotoInput = {
  farmId: UUID;
  treeId: UUID;
};

export type ConditionRecordPhoto = {
  attachment: PhotoAttachment;
  signedUrl: string;
};

export type ConditionRecordPhotoMap = Record<UUID, ConditionRecordPhoto>;

export type UploadConditionRecordPhotoInput = {
  farmId: UUID;
  conditionRecordId: UUID;
  localUri: string;
  fileName?: string | null;
  mimeType?: string | null;
  caption?: string | null;
};

export type GetConditionRecordPhotosInput = {
  farmId: UUID;
  conditionRecordId: UUID;
};

export type ListConditionRecordPhotosForTreeInput = {
  farmId: UUID;
  treeId: UUID;
  conditionRecordIds: UUID[];
};

export type PickedPhotoAsset = {
  uri: string;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  width: number | null;
  height: number | null;
};

export type MediaPermissionResult = {
  granted: boolean;
  message: string | null;
};
