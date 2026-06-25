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
