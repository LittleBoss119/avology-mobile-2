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
  joinedAt?: string | null;
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
  currentGrowthPhase: string | null;
  isArchived: boolean;
  createdAt?: string;
  updatedAt?: string | null;
};

export type TreeConditionReport = {
  id: UUID;
  farmId: UUID;
  treeId: UUID;
  reportedBy: UUID;
  conditionStatus: TreeConditionStatus;
  note: string | null;
  reportedAt: string;
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
  createdBy?: UUID;
  createdAt?: string;
  updatedAt?: string | null;
};

export type GetTreesInput = {
  farmId: UUID;
  search?: string;
  condition?: TreeConditionStatus | 'all';
  growthPhase?: string | 'all';
  archived?: boolean;
};

export type GetTreeDetailInput = {
  treeId: UUID;
};

export type CreateTreeInput = {
  farmId: UUID;
  treeCode: string;
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
};

export type CreateScheduleFromSOPData = {
  scheduleId: UUID;
  taskIds: UUID[];
};

export type RegisterUserInput = {
  email: string;
  password: string;
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
