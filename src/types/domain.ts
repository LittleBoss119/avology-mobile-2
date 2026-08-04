import type {
  OperationalReportCategory,
  OperationalReportResolution,
  OperationalReportStatus,
} from '../constants/operationalReport';

// Status/kategori/resolusi laporan hidup di src/constants/operationalReport.ts
// (satu sumber kebenaran, diturunkan dari tuple readonly). Di-re-export dari
// sini supaya import lama `from '../types/domain'` tidak perlu diubah.
export type {
  OperationalReportCategory,
  OperationalReportResolution,
  OperationalReportStatus,
};

export type UUID = string;

export type MemberRole = 'owner' | 'worker';

export type MemberStatus = 'pending' | 'active' | 'rejected' | 'removed';

export type TreeConditionStatus =
  | 'healthy'
  | 'needs_attention'
  | 'pest_attacked'
  | 'disease_indicated'
  | 'damaged'
  | 'dead';

export type GrowthPhase =
  | 'initial_planting'
  | 'vegetative'
  | 'flowering'
  | 'fruiting'
  | 'harvesting';

export type CareCategory =
  | 'watering'
  | 'fertilizing'
  | 'spraying'
  | 'weeding'
  | 'other';

export type TargetType = 'farm' | 'row' | 'column' | 'tree' | 'custom';

export type CareSOPDefaultTargetType = Exclude<TargetType, 'custom'>;

export type CareSOPNextScheduleStatus =
  | 'no_history'
  | 'no_interval'
  | 'upcoming'
  | 'due_today'
  | 'overdue';

export type TaskStatus = 'pending' | 'completed' | 'postponed';

export type ActivityStatus = 'completed' | 'postponed';

export type CareActivityOrigin = 'terjadwal' | 'inisiatif';

export type ServiceError = {
  message: string;
  code?: string;
  rawMessage?: string;
};

export type ServiceResult<T> =
  | {
      data: T;
      error: null;
    }
  | {
      data: null;
      error: ServiceError;
    };

export type Profile = {
  id: UUID;
  fullName: string;
  phone: string | null;
  email?: string | null;
  createdAt?: string;
  updatedAt?: string | null;
};

export type Farm = {
  id: UUID;
  name: string;
  location: string | null;
  areaSize: number | null;
  joinCode: string;
  createdBy?: UUID;
  createdAt?: string;
  updatedAt?: string | null;
};

export type CurrentUserFarm = {
  membershipId: UUID;
  farmId: UUID;
  userId: UUID;
  role: MemberRole;
  status: MemberStatus;
  joinedAt: string | null;
  createdAt?: string;
  updatedAt?: string | null;
  removedAt?: string | null;
  removedBy?: UUID | null;
  removedReason?: string | null;
  farm?: Farm;
};

export type WorkerMembership = {
  membershipId: UUID;
  userId: UUID;
  fullName: string;
  phone: string | null;
  role: 'worker';
  status: MemberStatus;
  createdAt?: string;
  updatedAt?: string | null;
  joinedAt?: string | null;
  removedAt?: string | null;
  removedBy?: UUID | null;
  removedReason?: string | null;
};

export type FarmMemberBasicProfile = {
  userId: UUID;
  fullName: string;
  phone: string | null;
};

export type FarmActorDisplayProfile = {
  userId: UUID;
  fullName: string;
  role: MemberRole;
  status: MemberStatus;
};

export type Tree = {
  id: UUID;
  farmId: UUID;
  treeCode: string;
  rowPosition: string | null;
  columnPosition: string | null;
  variety: string | null;
  plantedAt: string | null;
  currentCondition: TreeConditionStatus;
  currentGrowthPhase: GrowthPhase | null;
  isArchived: boolean;
  createdAt?: string;
  updatedAt?: string | null;
};

export type TreeConditionReport = {
  id: UUID;
  farmId: UUID;
  treeId: UUID;
  reportedBy: UUID;
  reportedByName?: string | null;
  reportedByRole?: MemberRole | null;
  conditionStatus: TreeConditionStatus;
  note: string | null;
  reportedAt: string;
  createdAt?: string;
  updatedAt?: string | null;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedBy?: UUID | null;
  deleteReason?: string | null;
  canEdit?: boolean;
};

export type GrowthPhaseRecord = {
  id: UUID;
  farmId: UUID;
  treeId: UUID;
  recordedBy: UUID;
  phase: GrowthPhase;
  note: string | null;
  recordedAt: string;
  createdAt?: string;
  updatedAt?: string | null;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedBy?: UUID | null;
  deleteReason?: string | null;
  canEdit?: boolean;
};

export type HarvestRecord = {
  id: UUID;
  farmId: UUID;
  treeId: UUID;
  harvestedBy: UUID;
  fruitCount: number;
  fruitCondition: string | null;
  note: string | null;
  harvestedAt: string;
  createdAt: string;
  updatedAt?: string | null;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedBy?: UUID | null;
  deleteReason?: string | null;
  canEdit?: boolean;
};

export type TreeHistoryType = 'condition' | 'phase' | 'care' | 'harvest';

export type TreeHistoryItem = {
  sourceId?: UUID | null;
  treeId: UUID;
  farmId: UUID;
  historyType: TreeHistoryType;
  title: string;
  description: string | null;
  actorId: UUID;
  actorName?: string | null;
  actorRole?: MemberRole | null;
  happenedAt: string;
  // Hanya terisi untuk historyType 'care'; sumber lain bernilai null.
  asal?: CareActivityOrigin | null;
  // Produk/merek perawatan (RF-12). Hanya terisi untuk historyType 'care'
  // yang mencatat produk; null untuk sumber lain atau care tanpa produk.
  produk: string | null;
};

export type OperationalReport = {
  id: UUID;
  farmId: UUID;
  reportedBy: UUID;
  category: OperationalReportCategory;
  locationNote: string | null;
  description: string | null;
  status: OperationalReportStatus;
  ownerResponseNote?: string | null;
  respondedBy?: UUID | null;
  respondedAt?: string | null;
  // Keputusan owner. Kombinasi status x resolution DIJAMIN database lewat
  // constraint `operational_reports_resolution_status_check` (migration 034):
  //   new         -> resolution null, resolvedAt null
  //   in_progress -> resolution 'task' | 'self_handled'
  //   resolved    -> resolution non-null
  //   rejected    -> resolution null, ownerResponseNote non-null
  // UI boleh mengandalkan invarian ini tanpa pengecekan defensif tambahan.
  resolution: OperationalReportResolution | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt?: string | null;
};

export type CareSOP = {
  id: UUID;
  farmId: UUID;
  name: string;
  category: CareCategory;
  intervalDays: number | null;
  defaultInstruction: string | null;
  defaultTargetType: CareSOPDefaultTargetType;
  defaultTargetRow: string | null;
  defaultTargetColumn: string | null;
  defaultTargetTreeId: UUID | null;
  isActive: boolean;
  createdBy?: UUID;
  createdAt?: string;
  updatedAt?: string | null;
};

export type CareSOPNextScheduleReference = {
  sopId: UUID;
  intervalDays: number | null;
  lastPerformedAt: string | null;
  nextDueDate: string | null;
  status: CareSOPNextScheduleStatus;
  daysUntilDue?: number;
  overdueDays?: number;
};

export type CareSchedule = {
  id: UUID;
  farmId: UUID;
  careSopId: UUID | null;
  title: string;
  category: CareCategory;
  scheduledDate: string;
  targetType: TargetType;
  targetRow: string | null;
  targetColumn: string | null;
  targetTreeId: UUID | null;
  customTargetNote: string | null;
  instruction: string | null;
  requiresPhoto: boolean;
  isCancelled?: boolean;
  cancelledAt?: string | null;
  cancelledBy?: UUID | null;
  cancelReason?: string | null;
  createdBy?: UUID;
  createdAt?: string;
  updatedAt?: string | null;
};

export type CareTask = {
  id: UUID;
  farmId: UUID;
  careScheduleId: UUID | null;
  operationalReportId: UUID | null;
  assignedTo: UUID;
  assignedBy: UUID;
  title: string;
  category: CareCategory | null;
  instruction: string | null;
  targetType: TargetType;
  targetRow: string | null;
  targetColumn: string | null;
  targetTreeId: UUID | null;
  customTargetNote: string | null;
  dueDate: string;
  status: TaskStatus;
  requiresPhoto: boolean;
  scheduleIsCancelled?: boolean;
  createdAt?: string;
  updatedAt?: string | null;
};

export type CareActivity = {
  id: UUID;
  farmId: UUID;
  // null untuk catatan inisiatif (asal='inisiatif'), yang tidak berasal dari tugas.
  careTaskId: UUID | null;
  performedBy: UUID;
  status: ActivityStatus;
  note: string | null;
  performedAt: string;
  asal: CareActivityOrigin;
  // Hanya terisi untuk catatan inisiatif; untuk 'terjadwal' kategori ada di care_tasks.
  category: CareCategory | null;
  produk: string | null;
};

// Detail read-only satu catatan perawatan (US-14 / Iterasi C).
export type CareActivityDetail = CareActivity & {
  // Judul tugas induk (asal='terjadwal'). null bila inisiatif ATAU tugas tak dapat
  // dibaca (RLS: worker hanya boleh baca tugas yang di-assign ke dirinya).
  taskTitle: string | null;
};

export type GetCareActivityDetailInput = {
  activityId: UUID;
};

export type CareScheduleDetail = CareSchedule & {
  tasks: CareTask[];
};

export type CareTaskDetail = CareTask & {
  activities: CareActivity[];
};

export type OwnerDashboardSummary = {
  totalTrees: number;
  healthyTrees: number;
  problemTrees: number;
  todayTasks: number;
  unfinishedTasks: number;
  overdueTasks: number;
  newOperationalReports: number;
  pendingWorkers: number;
  floweringTrees: number;
  fruitingTrees: number;
  dueOrOverdueSops: number;
};

export type WorkerDashboardSummary = {
  todayTasks: number;
  unfinishedTasks: number;
  completedTasks: number;
};

export type GetTreesInput = {
  farmId: UUID;
  search?: string;
  condition?: TreeConditionStatus | 'all';
  growthPhase?: GrowthPhase | 'all';
  archived?: boolean;
};

export type GetTreeDetailInput = {
  treeId: UUID;
};

export type CreateTreeInput = {
  farmId: UUID;
  treeCode?: string;
  rowPosition?: string | null;
  columnPosition?: string | null;
  variety?: string | null;
  plantedAt?: string | null;
};

export type CreateTreeData = {
  treeId: UUID;
};

export type UpdateTreeInput = {
  treeId: UUID;
  treeCode?: string;
  rowPosition?: string | null;
  columnPosition?: string | null;
  variety?: string | null;
  plantedAt?: string | null;
};

export type TreeArchiveInput = {
  treeId: UUID;
};

export type CreateTreeConditionReportInput = {
  farmId: UUID;
  treeId: UUID;
  conditionStatus: TreeConditionStatus;
  note?: string | null;
  reportedAt?: string | null;
};

export type CreateTreeConditionReportData = {
  reportId: UUID;
};

export type GetTreeConditionReportsInput = {
  treeId: UUID;
};

export type GetTreeConditionReportDetailInput = {
  reportId: UUID;
};

export type UpdateConditionReportInput = {
  reportId: UUID;
  conditionStatus: TreeConditionStatus;
  note?: string | null;
  reportedAt?: string | null;
};

export type CreateGrowthPhaseRecordInput = {
  farmId: UUID;
  treeId: UUID;
  phase: GrowthPhase;
  note?: string | null;
  recordedAt?: string | null;
};

export type CreateGrowthPhaseRecordData = {
  recordId: UUID;
};

export type GetGrowthPhaseRecordsInput = {
  treeId: UUID;
};

export type GetGrowthPhaseRecordDetailInput = {
  recordId: UUID;
};

export type UpdateGrowthPhaseRecordInput = {
  recordId: UUID;
  phase: GrowthPhase;
  note?: string | null;
  recordedAt?: string | null;
};

export type CreateHarvestRecordInput = {
  farmId: UUID;
  treeId: UUID;
  fruitCount: number;
  fruitCondition?: string | null;
  note?: string | null;
  harvestedAt?: string | null;
};

export type CreateHarvestRecordData = {
  recordId: UUID;
};

export type GetHarvestRecordsByTreeInput = {
  treeId: UUID;
};

export type GetHarvestRecordDetailInput = {
  recordId: UUID;
};

export type UpdateHarvestRecordInput = {
  recordId: UUID;
  fruitCount: number;
  fruitCondition?: string | null;
  note?: string | null;
  harvestedAt?: string | null;
};

// Pencatatan realisasi perawatan inisiatif. Satu catatan dapat berdampak ke
// banyak pohon, sehingga target berupa daftar treeIds (bukan satu pohon).
export type CreateCareActivityInput = {
  farmId: UUID;
  category: CareCategory;
  treeIds: UUID[];
  note?: string | null;
  produk?: string | null;
  performedAt?: string | null;
};

export type CreateCareActivityData = {
  activityId: UUID;
};

export type GetCareActivitiesByTreeInput = {
  treeId: UUID;
};

export type GetFloweringAndFruitingTreesInput = {
  farmId: UUID;
};

// Pohon fase berbunga/berbuah diperkaya recorded_at fase 'flowering' TERAKHIR
// (RF-11a). null bila pohon belum pernah punya catatan fase berbunga.
export type FloweringMonitoringTree = Tree & {
  lastFloweringAt: string | null;
};

export type GetTreeHistoryInput = {
  treeId: UUID;
};

export type GetOwnerDashboardSummaryInput = {
  farmId: UUID;
};

export type GetWorkerDashboardSummaryInput = {
  farmId: UUID;
  userId: UUID;
};

// `description` wajib, `locationNote` opsional. Aturan lama "salah satu dari
// keduanya" sudah tidak berlaku di client. RPC update_own_operational_report
// masih memakai aturan lama (either-or) — itu lebih longgar, jadi tidak konflik.
export type CreateOperationalReportInput = {
  farmId: UUID;
  category: OperationalReportCategory;
  description: string;
  locationNote?: string | null;
};

export type CreateOperationalReportData = {
  reportId: UUID;
};

// Filter status/kategori sengaja TIDAK ada di sini: daftar laporan menyaring
// seluruhnya di client (search + chip status + sheet kategori/pelapor) di atas
// satu set data yang sama, jadi filter server-side hanya jadi jalur mati.
// `reportedBy` tetap ada karena itu batas data, bukan filter tampilan.
export type GetOperationalReportsInput = {
  farmId: UUID;
  reportedBy?: UUID;
};

export type GetOperationalReportDetailInput = {
  operationalReportId: UUID;
};

export type GetOperationalReportFollowUpTasksInput = {
  operationalReportId: UUID;
};

// ---- Aksi keputusan owner (berbasis niat, bukan berbasis status) ----
// Semuanya bermuara ke RPC update_operational_report_status, kecuali
// resolveReportWithTask yang lewat create_task_from_operational_report.

export type HandleReportMyselfInput = {
  operationalReportId: UUID;
  // Wajib diisi: RPC menolak self_handled tanpa catatan.
  note: string;
};

export type MarkReportAlreadyResolvedInput = {
  operationalReportId: UUID;
  note?: string | null;
};

export type RejectReportInput = {
  operationalReportId: UUID;
  // Wajib diisi: RPC menolak penolakan tanpa alasan.
  reason: string;
};

export type CloseReportInput = {
  operationalReportId: UUID;
  note?: string | null;
};

export type OperationalReportEditEligibility = {
  canEdit: boolean;
  reason?: string | null;
};

export type GetOperationalReportEditEligibilityInput = {
  operationalReportId: UUID;
};

export type UpdateOwnOperationalReportInput = {
  operationalReportId: UUID;
  category: OperationalReportCategory;
  description: string;
  locationNote?: string | null;
};

export type UpdateOwnOperationalReportData = {
  reportId: UUID;
};

export type DeleteOwnOperationalReportInput = {
  farmId: UUID;
  operationalReportId: UUID;
};

export type GetCareSOPsInput = {
  farmId: UUID;
  activeOnly?: boolean;
};

export type GetCareSOPDetailInput = {
  sopId: UUID;
};

export type CreateCareSOPInput = {
  farmId: UUID;
  name: string;
  category: CareCategory;
  intervalDays?: number | null;
  defaultInstruction?: string | null;
  defaultTargetType: CareSOPDefaultTargetType;
  defaultTargetRow?: string | null;
  defaultTargetColumn?: string | null;
  defaultTargetTreeId?: UUID | null;
};

export type CreateCareSOPData = {
  sopId: UUID;
};

export type UpdateCareSOPInput = {
  sopId: UUID;
  name?: string;
  category?: CareCategory;
  intervalDays?: number | null;
  defaultInstruction?: string | null;
  defaultTargetType?: CareSOPDefaultTargetType;
  defaultTargetRow?: string | null;
  defaultTargetColumn?: string | null;
  defaultTargetTreeId?: UUID | null;
};

export type SetCareSOPActiveStatusInput = {
  sopId: UUID;
  isActive: boolean;
};

export type GetCareSOPNextScheduleReferenceInput = {
  sopId: UUID;
};

export type CreateScheduleFromSOPInput = {
  farmId: UUID;
  sopId: UUID;
  scheduledDate: string;
  assignedWorkerIds: UUID[];
  targetType?: CareSOPDefaultTargetType;
  targetRow?: string | null;
  targetColumn?: string | null;
  targetTreeId?: UUID | null;
  instruction?: string | null;
  requiresPhoto?: boolean;
};

export type CreateScheduleFromSOPData = {
  scheduleId: UUID;
  taskIds: UUID[];
};

export type GetCareSchedulesInput = {
  farmId: UUID;
};

export type GetCareScheduleDetailInput = {
  scheduleId: UUID;
};

export type CancelCareScheduleInput = {
  scheduleId: UUID;
  reason?: string | null;
};

export type CancelCareScheduleData = {
  success: boolean;
};

export type ScheduleEditEligibility = {
  canEdit: boolean;
  reason?: string | null;
};

export type GetScheduleEditEligibilityInput = {
  scheduleId: UUID;
};

export type UpdateCareScheduleInput = {
  scheduleId: UUID;
  title: string;
  category: CareCategory;
  scheduledDate: string;
  assignedWorkerId: UUID;
  targetType: TargetType;
  targetRow?: string | null;
  targetColumn?: string | null;
  targetTreeId?: UUID | null;
  customTargetNote?: string | null;
  instruction?: string | null;
  requiresPhoto?: boolean;
};

export type CreateManualScheduleInput = {
  farmId: UUID;
  title: string;
  category: CareCategory;
  scheduledDate: string;
  assignedWorkerId: UUID;
  targetType: TargetType;
  targetRow?: string | null;
  targetColumn?: string | null;
  targetTreeId?: UUID | null;
  customTargetNote?: string | null;
  instruction?: string | null;
  requiresPhoto?: boolean;
};

export type CreateManualScheduleData = {
  scheduleId: UUID;
  taskId: UUID;
};

export type GetWorkerTasksInput = {
  farmId: UUID;
};

export type GetFarmTasksInput = {
  farmId: UUID;
};

export type GetTaskDetailInput = {
  taskId: UUID;
};

export type CompleteTaskInput = {
  taskId: UUID;
  note?: string | null;
  produk?: string | null;
};

export type CompleteTaskData = {
  activityId: UUID;
};

export type RollbackCompletedTaskActivityInput = {
  activityId: UUID;
};

export type TaskRealizationProofPhotoInput = {
  uri: string;
  base64?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
};

export type UpdateLatestTaskRealizationInput = {
  taskId: UUID;
  activityId?: UUID;
  status: ActivityStatus;
  note?: string | null;
  // Opsional: bila undefined kolom produk tidak disentuh (perilaku lama). Bila
  // dikirim (string atau null), kolom produk pada baris care_activities diperbarui.
  produk?: string | null;
  proofPhoto?: TaskRealizationProofPhotoInput | null;
  removeExistingProof?: boolean;
};

export type UpdateLatestTaskRealizationData = {
  activityId: UUID;
  warningMessage?: string | null;
};

export type PostponeTaskInput = {
  taskId: UUID;
  note: string;
};

export type PostponeTaskData = {
  activityId: UUID;
};

// Keputusan "buat tugas". RPC create_task_from_operational_report menyetel
// status='in_progress' + resolution='task' secara atomik bersama insert tugas,
// jadi JANGAN panggil aksi status apa pun setelah ini.
export type ResolveReportWithTaskInput = {
  operationalReportId: UUID;
  assignedWorkerId: UUID;
  dueDate: string;
  title: string;
  instruction?: string | null;
  targetType: TargetType;
  targetRow?: string | null;
  targetColumn?: string | null;
  targetTreeId?: UUID | null;
  customTargetNote?: string | null;
  requiresPhoto?: boolean;
  category?: CareCategory | null;
  ownerResponseNote?: string | null;
};

export type ResolveReportWithTaskData = {
  taskId: UUID;
};

export type RegisterUserInput = {
  email: string;
  password: string;
  fullName: string;
  phone?: string | null;
};

export type UpdateProfileInput = {
  fullName: string;
  phone?: string | null;
};

export type UpdatePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

export type RegisterUserData = {
  userId: UUID;
  profile: Profile;
};

export type LoginUserInput = {
  email: string;
  password: string;
};

export type LoginUserData = {
  userId: UUID;
  currentFarm: CurrentUserFarm | null;
};

export type CreateFarmInput = {
  name: string;
  location?: string | null;
  areaSize?: number | null;
};

export type CreateFarmData = {
  farmId: UUID;
};

export type UpdateFarmProfileInput = {
  farmId: UUID;
  name: string;
  location?: string | null;
  areaSize?: number | null;
};

export type UpdateFarmProfileData = {
  success: true;
};

export type RequestJoinFarmInput = {
  joinCode: string;
};

export type RequestJoinFarmData = {
  membershipId: UUID;
};

export type MembershipActionInput = {
  membershipId: UUID;
};

export type LeaveCurrentFarmInput = {
  farmId: UUID;
};

export type SuccessData = {
  success: true;
};
