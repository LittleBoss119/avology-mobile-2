import type { UUID } from './domain';

export type PhotoAttachmentEntityType =
  | 'tree_main'
  | 'condition_record'
  | 'task_proof'
  // Bukti kerja perawatan INISIATIF (migrasi 060). Sengaja terpisah dari
  // 'task_proof': aktivitas inisiatif tidak punya care_task_id, sedangkan path
  // 'task-proofs' menuntut id tugas di segmen keempatnya.
  | 'initiative_care_proof'
  // Catatan fase pertumbuhan dan panen (migrasi 061). Keduanya mengikuti pola
  // 'condition_record', BUKAN 'task_proof': fase dan panen adalah catatan
  // kebun, bukan bukti kerja seseorang, jadi fotonya terbuka ke seluruh
  // anggota aktif. Path-nya empat segmen seperti condition-reports.
  | 'growth_phase_record'
  | 'harvest_record';

export type PhotoAttachmentPathFolder =
  | 'trees'
  | 'condition-reports'
  | 'task-proofs'
  | 'initiative-care-proofs'
  | 'growth-phase-records'
  | 'harvest-records';

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
  // Siklus tanam pemilik foto (migrasi 059). NULL = siklus TIDAK DIKETAHUI,
  // bukan milik siklus lain -- foto ber-NULL tetap wajib ditampilkan. Selalu
  // NULL untuk task_proof; untuk initiative_care_proof terisi bila aktivitasnya
  // menaut TEPAT SATU pohon dan NULL bila lebih (migrasi 060).
  // Satu-satunya penyaringnya: isPhotoVisibleInCycle().
  plantingId: UUID | null;
  createdAt: string;
};

export type UploadPhotoAttachmentInput = {
  farmId: UUID;
  entityType: PhotoAttachmentEntityType;
  entityId: UUID;
  localUri: string;
  base64?: string | null;
  taskId?: UUID | null;
  fileName?: string | null;
  mimeType?: string | null;
  caption?: string | null;
  isPrimary?: boolean;
};

export type UploadPhotoAttachmentData = {
  attachment: PhotoAttachment;
};

export type PhotoAttachmentWithSignedUrl = {
  attachment: PhotoAttachment;
  signedUrl: string;
};

export type UploadEntityPhotoInput = UploadPhotoAttachmentInput;

export type ListEntityPhotosInput = ListPhotoAttachmentsInput;

export type ReplaceSinglePhotoAttachmentInput = UploadPhotoAttachmentInput;

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
  base64?: string | null;
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
  base64?: string | null;
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
  // Siklus yang sedang dilihat. WAJIB — bukan opsional, supaya pemanggil baru
  // tidak diam-diam mendapat perilaku lama yang mencampur siklus. null berarti
  // posisinya sedang kosong. Lihat isPhotoVisibleInCycle().
  activePlantingId: UUID | null;
};

export type TaskProofPhoto = {
  attachment: PhotoAttachment;
  signedUrl: string;
};

export type TaskProofPhotoMap = Record<UUID, TaskProofPhoto>;

export type UploadTaskProofPhotoInput = {
  farmId: UUID;
  taskId: UUID;
  activityId: UUID;
  localUri: string;
  base64?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  caption?: string | null;
};

export type GetTaskProofPhotosInput = {
  farmId: UUID;
  activityId: UUID;
};

export type ListTaskProofPhotosForActivitiesInput = {
  farmId: UUID;
  activityIds: UUID[];
};

// Bukti kerja perawatan inisiatif (migrasi 060). Bentuknya sengaja menyamai
// ConditionRecordPhoto dan BUKAN TaskProofPhoto: tidak ada taskId di mana pun,
// karena aktivitas inisiatif memang tidak punya tugas induk. Kalau suatu saat
// ada yang tergoda menyatukan keduanya, itulah medan ranjaunya.
export type InitiativeCareProofPhoto = {
  attachment: PhotoAttachment;
  signedUrl: string;
};

export type UploadInitiativeCareProofPhotoInput = {
  farmId: UUID;
  activityId: UUID;
  localUri: string;
  base64?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  caption?: string | null;
};

export type GetInitiativeCareProofPhotosInput = {
  farmId: UUID;
  activityId: UUID;
};

// Foto catatan fase pertumbuhan dan panen (migrasi 061).
//
// Bentuk keduanya sengaja menyamai ConditionRecordPhoto sampai ke nama
// medannya: ketiga catatan ini terikat satu tree_id, ditulis satu pencatat,
// dan fotonya tunduk pada aturan akses yang sama persis. Yang membedakannya
// dari TaskProofPhoto: tidak ada taskId di mana pun, karena tidak ada tugas
// induk.
export type GrowthPhaseRecordPhoto = {
  attachment: PhotoAttachment;
  signedUrl: string;
};

export type UploadGrowthPhaseRecordPhotoInput = {
  farmId: UUID;
  growthPhaseRecordId: UUID;
  localUri: string;
  base64?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  caption?: string | null;
};

export type GetGrowthPhaseRecordPhotosInput = {
  farmId: UUID;
  growthPhaseRecordId: UUID;
};

export type HarvestRecordPhoto = {
  attachment: PhotoAttachment;
  signedUrl: string;
};

export type UploadHarvestRecordPhotoInput = {
  farmId: UUID;
  harvestRecordId: UUID;
  localUri: string;
  base64?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  caption?: string | null;
};

export type GetHarvestRecordPhotosInput = {
  farmId: UUID;
  harvestRecordId: UUID;
};

export type PhotoAttachmentPreviewItem = {
  id?: UUID | null;
  url: string;
  caption?: string | null;
};

export type PickedPhotoAsset = {
  uri: string;
  assetId: string | null;
  base64: string | null;
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
