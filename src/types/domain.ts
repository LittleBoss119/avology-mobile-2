import type { FarmAccessEvent, MemberRole, MemberStatus } from '../constants/membership';
import type {
  OperationalReportCategory,
  OperationalReportResolution,
  OperationalReportStatus,
} from '../constants/operationalReport';
import type { GradePanen } from '../constants/gradePanen';
import type { SatuanBahan } from '../constants/satuanBahan';

// Satuan takaran bahan dan grade panen hidup di src/constants/, pola yang sama
// dengan dua import di atas: diturunkan dari tuple readonly supaya daftarnya
// bisa diiterasi saat runtime. Di-re-export dari sini supaya pemakai cukup
// mengimpor dari '../types/domain' seperti tipe domain lainnya.
export type { GradePanen, SatuanBahan };

// Status/kategori/resolusi laporan hidup di src/constants/operationalReport.ts
// (satu sumber kebenaran, diturunkan dari tuple readonly). Di-re-export dari
// sini supaya import lama `from '../types/domain'` tidak perlu diubah.
export type {
  OperationalReportCategory,
  OperationalReportResolution,
  OperationalReportStatus,
};

// Peran, status keanggotaan, dan jenis event akses hidup di
// src/constants/membership.ts — pola yang sama, diturunkan dari tuple readonly
// sehingga nilainya bisa diiterasi dan divalidasi saat runtime, bukan cuma union
// tipe telanjang. Di-re-export dari sini supaya ±20 import lama
// `from '../types/domain'` tidak perlu diubah.
export type { FarmAccessEvent, MemberRole, MemberStatus };

export type UUID = string;

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
  // Opsional karena relasi non-aktif (pending/rejected/removed) memang TIDAK
  // boleh tahu kode kebun: policy "Active members can view farm" (migration 007)
  // menutup tabel farms untuk mereka, dan get_current_user_access hanya
  // mengembalikan namanya. Sebelumnya kolom ini diisi string kosong supaya tipe
  // terpenuhi — nilai yang benar secara maksud tapi bohong secara tipe.
  joinCode?: string;
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
  // Sejak migrasi 045 keduanya opsional, tapi constraint
  // harvest_records_amount_present_check menjamin minimal SALAH SATU terisi.
  // Jumlah buah tidak bisa dikonversi ke kilogram — berat alpukat terlalu
  // bervariasi — jadi keduanya berdiri sendiri, bukan saling menggantikan.
  fruitCount: number | null;
  // harvestWeightKg SUDAH dikonversi ke number oleh mapHarvestRecord. Kolom
  // aslinya numeric(10,2) dan PostgREST mengirimnya sebagai string; jangan
  // membaca baris mentah tanpa lewat mapper itu.
  harvestWeightKg: number | null;
  // Grade mutu. Nilai lama di luar daftar (12 baris teks bebas yang belum
  // dibersihkan) dipetakan jadi null oleh mapper, bukan dibiarkan bocor.
  fruitCondition: GradePanen | null;
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
  // Pengulangan (migration 040). repeatEveryDays null = jadwal sekali jalan.
  // seriesId mengikat satu rantai (jadwal pertama memakai id dirinya sendiri);
  // parentScheduleId menunjuk jadwal sebelumnya, null untuk jadwal pertama.
  repeatEveryDays: number | null;
  seriesId: UUID | null;
  parentScheduleId: UUID | null;
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
  // Takaran bahan (migrasi 043). Selalu berpasangan: dua-duanya null, atau
  // dua-duanya terisi — dijaga constraint care_activities_produk_qty_pair_check,
  // yang juga mewajibkan `produk` ada isinya bila takaran diisi.
  //
  // produkJumlah SUDAH dikonversi ke number oleh mapCareActivity. Kolom aslinya
  // numeric(10,2) dan PostgREST mengirimnya sebagai string; jangan membaca baris
  // mentah langsung tanpa lewat mapper itu.
  produkJumlah: number | null;
  produkSatuan: SatuanBahan | null;
  // Kapan catatan terakhir diperbaiki lewat update_task_realization.
  // null = belum pernah diperbaiki. BUKAN pengganti performedAt.
  editedAt: string | null;
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
  // Minimal salah satu dari fruitCount / harvestWeightKg wajib terisi —
  // ditegakkan layanan sebelum insert, dan oleh constraint
  // harvest_records_amount_present_check sebagai penjaga terakhir.
  fruitCount?: number | null;
  harvestWeightKg?: number | null;
  fruitCondition?: GradePanen | null;
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

// RPC update_own_harvest_record bersifat MENGGANTI, bukan menambal: nilai yang
// tidak dikirim akan mengosongkan kolomnya. Kirim seluruh keadaan form.
export type UpdateHarvestRecordInput = {
  recordId: UUID;
  fruitCount?: number | null;
  harvestWeightKg?: number | null;
  fruitCondition?: GradePanen | null;
  note?: string | null;
  harvestedAt?: string | null;
};

// Pencatatan hasil kerja perawatan inisiatif. Satu catatan dapat berdampak ke
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

// Tanpa satu pun field opsional diisi, hasilnya adalah seluruh jadwal kebun
// tanpa penyaringan.
export type GetCareSchedulesWithTasksInput = {
  farmId: UUID;
  // Buang jadwal yang PUNYA tugas dan semuanya sudah 'completed'. Jadwal tanpa
  // tugas tidak pernah ikut terbuang — justru itu yang menunggu penugasan.
  excludeCompleted?: boolean;
  // Batas bawah scheduled_date ('YYYY-MM-DD'), inklusif.
  scheduledFrom?: string | null;
  // Hanya berlaku bersama scheduledFrom. Ikut menyertakan jadwal yang LEBIH TUA
  // dari batas itu tapi tugasnya masih terbuka, supaya pekerjaan tertunggak
  // tidak pernah hilang dari daftar hanya karena tanggalnya sudah lewat jauh.
  includeOlderOpenWork?: boolean;
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

export type AssignWorkerToScheduleInput = {
  scheduleId: UUID;
  workerId: UUID;
};

export type AssignWorkerToScheduleData = {
  taskId: UUID;
};

export type StopScheduleRepeatInput = {
  scheduleId: UUID;
};

export type StopScheduleRepeatData = {
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
  // Opsional sejak sebuah jadwal boleh punya NOL tugas. Kalau diisi, tugas yang
  // ada dipindahtangankan seperti biasa. Kalau diisi TAPI jadwalnya belum punya
  // tugas, updateCareSchedule MENOLAK — tidak ada tugas untuk dipindahkan, dan
  // penugasan pekerja pertama jalurnya assignWorkerToSchedule. Kalau dikosongkan,
  // field jadwal lain tetap bisa diubah tanpa menyentuh penugasan.
  assignedWorkerId?: UUID | null;
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
  // Jarak hari ke jadwal berikutnya. Diabaikan (dikirim null) kalau bukan
  // bilangan positif — lihat normalizeRepeatEveryDays di careScheduleService.
  repeatEveryDays?: number | null;
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
  // Takaran bahan. Harus dikirim berpasangan — RPC complete_task menolak salah
  // satunya saja dengan 'Takaran dan satuan harus diisi berdua.', dan menolak
  // takaran tanpa nama bahan dengan 'Nama bahan wajib diisi kalau takaran diisi.'
  produkJumlah?: number | null;
  produkSatuan?: SatuanBahan | null;
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

// Masukan untuk "perbaiki catatan" (RPC update_task_realization, migrasi 043).
//
// TIDAK ADA field `status` di sini, dan itu disengaja: memperbaiki catatan
// menurut definisinya tidak mengubah hasil kerja. Status hanya berpindah lewat
// baris BARU (complete_task / postpone_task), karena mesin rantai jadwal
// berulang berbunyi AFTER INSERT — status yang berubah lewat UPDATE membuat
// jadwal penerus tidak pernah dibuat dan rantainya putus diam-diam.
//
// taskId juga tidak diminta lagi: RPC hanya butuh activityId, dan taskId
// diturunkan dari baris realisasinya sendiri supaya tidak mungkin tidak cocok.
export type UpdateTaskRealizationInput = {
  activityId: UUID;
  note?: string | null;
  produk?: string | null;
  produkJumlah?: number | null;
  produkSatuan?: SatuanBahan | null;
  proofPhoto?: TaskRealizationProofPhotoInput | null;
  removeExistingProof?: boolean;
};

export type UpdateTaskRealizationData = {
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

export type PreviewFarmByJoinCodeInput = {
  joinCode: string;
};

// Pratinjau kebun untuk calon pemohon yang BELUM jadi anggota. Sengaja cuma tiga
// field: RPC-nya SECURITY DEFINER dan menembus RLS, jadi setiap field tambahan
// adalah kebocoran ke siapa pun yang menebak kode. Lihat migration 037.
export type FarmPreview = {
  farmName: string;
  location: string | null;
  ownerName: string | null;
};

// Satu baris riwayat akses kebun, dari tabel append-only farm_access_events
// (migration 036). `actorName` null berarti pelakunya memang tidak pernah
// tercatat — event warisan dari sebelum migration 020, bukan data hilang.
export type FarmAccessEventEntry = {
  id: UUID;
  userId: UUID;
  fullName: string;
  event: FarmAccessEvent;
  actorId: UUID | null;
  actorName: string | null;
  reason: string | null;
  createdAt: string;
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
