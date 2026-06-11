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
