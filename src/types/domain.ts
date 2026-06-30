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

export type OperationalReportCategory =
  | 'land_damage'
  | 'broken_tool'
  | 'out_of_stock'
  | 'area_pest_disease'
  | 'disaster_weather'
  | 'worker_need'
  | 'other';

export type OperationalReportStatus =
  | 'new'
  | 'in_progress'
  | 'resolved'
  | 'rejected';

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
};

export type GrowthPhaseRecord = {
  id: UUID;
  farmId: UUID;
  treeId: UUID;
  recordedBy: UUID;
  phase: GrowthPhase;
  note: string | null;
  recordedAt: string;
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
};

export type ManualCareRecord = {
  id: UUID;
  farmId: UUID;
  recordedBy: UUID;
  category: CareCategory;
  targetType: TargetType;
  targetRow: string | null;
  targetColumn: string | null;
  targetTreeId: UUID | null;
  customTargetNote: string | null;
  note: string | null;
  performedAt: string;
  createdAt: string;
  updatedAt?: string | null;
};

export type TreeHistoryType = 'condition' | 'phase' | 'care' | 'harvest' | 'manual_care';

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
  careTaskId: UUID;
  performedBy: UUID;
  status: ActivityStatus;
  note: string | null;
  performedAt: string;
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
};

export type CreateTreeConditionReportData = {
  reportId: UUID;
};

export type GetTreeConditionReportsInput = {
  treeId: UUID;
};

export type CreateGrowthPhaseRecordInput = {
  farmId: UUID;
  treeId: UUID;
  phase: GrowthPhase;
  note?: string | null;
};

export type CreateGrowthPhaseRecordData = {
  recordId: UUID;
};

export type GetGrowthPhaseRecordsInput = {
  treeId: UUID;
};

export type CreateHarvestRecordInput = {
  farmId: UUID;
  treeId: UUID;
  fruitCount: number;
  fruitCondition?: string | null;
  note?: string | null;
  harvestedAt?: string | null;
  photo?: {
    uri: string;
    base64?: string | null;
    fileName?: string | null;
    mimeType?: string | null;
  } | null;
};

export type CreateHarvestRecordData = {
  recordId: UUID;
  warningMessage?: string | null;
};

export type GetHarvestRecordsByTreeInput = {
  treeId: UUID;
};

export type CreateManualCareRecordInput = {
  farmId: UUID;
  targetType: TargetType;
  category: CareCategory;
  targetRow?: string | null;
  targetColumn?: string | null;
  targetTreeId?: UUID | null;
  customTargetNote?: string | null;
  note?: string | null;
  performedAt?: string | null;
  photo?: {
    uri: string;
    base64?: string | null;
    fileName?: string | null;
    mimeType?: string | null;
  } | null;
};

export type CreateManualCareRecordData = {
  recordId: UUID;
  warningMessage?: string | null;
};

export type GetManualCareRecordsByTreeInput = {
  treeId: UUID;
};

export type GetFloweringAndFruitingTreesInput = {
  farmId: UUID;
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

export type CreateOperationalReportInput = {
  farmId: UUID;
  category: OperationalReportCategory;
  locationNote?: string | null;
  description?: string | null;
};

export type CreateOperationalReportData = {
  reportId: UUID;
};

export type GetOperationalReportsInput = {
  farmId: UUID;
  status?: OperationalReportStatus | 'all';
  category?: OperationalReportCategory | 'all';
  reportedBy?: UUID;
};

export type GetOperationalReportDetailInput = {
  operationalReportId: UUID;
};

export type GetOperationalReportFollowUpTasksInput = {
  operationalReportId: UUID;
};

export type UpdateOperationalReportStatusInput = {
  operationalReportId: UUID;
  ownerResponseNote?: string | null;
  status: OperationalReportStatus;
};

export type ReopenOperationalReportInput = {
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

export type OperationalReportPhotoInput = {
  uri: string;
  base64?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
};

export type UpdateOwnOperationalReportInput = {
  operationalReportId: UUID;
  category: OperationalReportCategory;
  locationNote?: string | null;
  description?: string | null;
  photo?: OperationalReportPhotoInput | null;
  removeExistingPhoto?: boolean;
};

export type UpdateOwnOperationalReportData = {
  reportId: UUID;
  warningMessage?: string | null;
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

export type CreateTaskFromOperationalReportInput = {
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
};

export type CreateTaskFromOperationalReportData = {
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

export type SuccessData = {
  success: true;
};
