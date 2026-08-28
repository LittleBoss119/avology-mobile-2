import type { FarmAccessEvent, MemberRole, MemberStatus } from '../constants/membership';
import type { GradePanen } from '../constants/gradePanen';
import type { SatuanBahan } from '../constants/satuanBahan';

// Satuan takaran bahan dan grade panen hidup di src/constants/, pola yang sama
// dengan dua import di atas: diturunkan dari tuple readonly supaya daftarnya
// bisa diiterasi saat runtime. Di-re-export dari sini supaya pemakai cukup
// mengimpor dari '../types/domain' seperti tipe domain lainnya.
export type { GradePanen, SatuanBahan };

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

// 'row' dan 'column' dibuang di migrasi 047. Nilainya masih ada di enum
// public.target_type (PostgreSQL tidak punya `alter type ... drop value`),
// tapi ditutup CHECK constraint di kedua tabel, jadi tidak bisa lagi masuk.
export type TargetType = 'farm' | 'tree' | 'custom';

// Sepadan dengan CHECK care_schedules_date_basis_check (migrasi 048).
export type ScheduleDateBasis = 'jadwal' | 'realisasi';

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
  // Ukuran petak kebun: berapa baris dan berapa kolom posisi tanam yang ada.
  // Baris dilambangkan angka mulai 1, kolom satu huruf A-Z — jadi gridColumns
  // tidak pernah lebih dari 26 (farms_grid_columns_check, migrasi 054).
  //
  // Opsional untuk alasan yang SAMA PERSIS dengan joinCode di atas, bukan karena
  // nilainya boleh kosong di database: di sana keduanya NOT NULL dengan default
  // 26 dan 9. Yang opsional adalah PEMBACAANNYA — relasi non-aktif tidak boleh
  // membaca baris farms sama sekali, dan mapFarmNameOnly memang hanya bisa
  // mengisi nama. Pemakai wajib memperlakukan undefined sebagai "belum terbaca",
  // bukan sebagai nol.
  gridRows?: number;
  gridColumns?: number;
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
  // Diturunkan database sebagai kolom GENERATED sejak migrasi 054
  // (`row_position::text || '-' || column_position`). Read-only: mengirimnya di
  // INSERT/UPDATE ditolak Postgres.
  treeCode: string;
  // Baris = angka, kolom = satu huruf A-Z. Konvensinya dibalik di migrasi 054.
  rowPosition: number | null;
  columnPosition: string | null;
  // Siklus tanam yang sedang berjalan di posisi ini, atau null kalau posisinya
  // sedang kosong (siklus terakhirnya sudah ditutup).
  //
  // variety dan plantedAt DULU ada di sini. Keduanya pindah ke tree_plantings
  // di migrasi 055 karena satu posisi bisa ditanami berkali-kali: menyimpannya
  // di trees membuat penanaman ulang menimpa fakta penanaman sebelumnya.
  // Pemanggil yang butuh varietas membacanya lewat activePlanting?.variety --
  // bentuk yang sengaja tidak disembunyikan, supaya terlihat bahwa nilainya
  // milik siklus dan bisa tidak ada.
  activePlanting: TreePlanting | null;
  currentCondition: TreeConditionStatus;
  currentGrowthPhase: GrowthPhase | null;
  isArchived: boolean;
  createdAt?: string;
  updatedAt?: string | null;
};

// Cerminan CHECK tree_plantings_end_reason_check (migrasi 055).
export const TREE_PLANTING_END_REASONS = ['mati', 'dibongkar', 'diganti'] as const;

export type TreePlantingEndReason = (typeof TREE_PLANTING_END_REASONS)[number];

// Satu siklus tanam pada satu posisi. endedAt null berarti siklusnya masih
// berjalan, dan database menjamin paling banyak SATU baris seperti itu per
// pohon lewat partial unique index tree_plantings_one_active_per_tree.
export type TreePlanting = {
  id: UUID;
  treeId: UUID;
  farmId: UUID;
  cycleNo: number;
  variety: string | null;
  plantedAt: string | null;
  endedAt: string | null;
  endReason: TreePlantingEndReason | null;
  endedBy: UUID | null;
  createdBy: UUID;
  createdAt: string;
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

export type CareSchedule = {
  id: UUID;
  farmId: UUID;
  title: string;
  category: CareCategory;
  scheduledDate: string;
  targetType: TargetType;
  // BAYANGAN sejak migrasi 057, bukan sumber kebenaran. Jangan dipakai untuk
  // MENAMPILKAN apa pun -- ia hanya memuat satu pohon dari daftar, sehingga
  // jadwal tiga pohon akan terbaca sebagai satu. Yang benar targetTreeIds /
  // targetTreeCodes di bawah. Kolomnya sendiri dibuang setelah migrasi 059.
  targetTreeId: UUID | null;
  // Daftar pohon yang SUNGGUH disasar, dibaca dari care_schedule_trees.
  //
  // OPSIONAL dengan sengaja: hanya terisi kalau pemanggilnya memuatnya lewat
  // resolveTreeTargetCodes. Mapper dasar tidak mengisinya, karena membaca
  // jembatan menuntut kueri kedua yang tidak boleh dipaksakan ke setiap
  // pembaca. `undefined` berarti "belum dimuat", bukan "tidak punya pohon" --
  // dan di situlah tampilan jatuh balik ke bayangan.
  targetTreeIds?: UUID[];
  targetTreeCodes?: string[];
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
  // Diisi sweep_missed_schedules (migrasi 048) saat siklus jadwal ini
  // dinyatakan terlewat. Dipakai scheduleTimeBucket untuk mengklasifikasi
  // jadwal berulang yang belum pernah punya tugas.
  missedAt: string | null;
  // Masa toleransi keterlambatan dalam hari (migrasi 048). null = jadwal ini
  // tidak pernah dinyatakan terlewat.
  graceDays: number | null;
  // Dasar perhitungan tanggal penerus rantai (migrasi 048): 'jadwal' memakai
  // scheduled_date, 'realisasi' memakai tanggal pekerjaan diselesaikan.
  dateBasis: ScheduleDateBasis;
  createdBy?: UUID;
  createdAt?: string;
  updatedAt?: string | null;
};

export type CareTask = {
  id: UUID;
  farmId: UUID;
  careScheduleId: UUID | null;
  assignedTo: UUID;
  assignedBy: UUID;
  title: string;
  category: CareCategory | null;
  instruction: string | null;
  targetType: TargetType;
  // BAYANGAN sejak migrasi 057. Lihat catatan yang sama pada CareSchedule.
  targetTreeId: UUID | null;
  // Daftar pohon tugas ini, diambil lewat careScheduleId ke
  // care_schedule_trees. Tidak ada care_task_trees -- tugas tidak punya daftar
  // pohonnya sendiri, ia meminjam daftar milik jadwalnya.
  targetTreeIds?: UUID[];
  targetTreeCodes?: string[];
  customTargetNote: string | null;
  dueDate: string;
  status: TaskStatus;
  // Diisi sweep_missed_schedules (migrasi 048) saat tugas melewati masa
  // toleransi jadwal induknya. Status tugas TIDAK ikut berubah — pekerja masih
  // boleh mengerjakannya.
  missedAt: string | null;
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

// treeCode TIDAK ada di sini dan tidak boleh ditambahkan: kolomnya generated
// sejak migrasi 054, jadi ia diturunkan dari posisinya, bukan dikirim klien.
// rowPosition/columnPosition tetap string karena berasal dari field form;
// treeService yang mengubah barisnya jadi angka sebelum dikirim.
export type CreateTreeInput = {
  farmId: UUID;
  rowPosition?: string | null;
  columnPosition?: string | null;
  variety?: string | null;
  plantedAt?: string | null;
};

export type CreateTreeData = {
  treeId: UUID;
};

// ---- Pembuatan pohon massal (migrasi 062) ----
//
// positionCodes berisi KODE POSISI kanonik ('12-C'), bukan UUID: posisi yang
// belum pernah ditanami belum punya baris trees, jadi ia belum punya id. Itu
// yang membedakan jalur ini dari CreateTreeInput, yang menerima baris dan kolom
// terpisah dari field form.
//
// Kanonik berarti persis seperti tree_code menuliskannya (054:237): baris 1-999
// tanpa nol di depan, satu huruf kapital. RPC MENOLAK bentuk lain alih-alih
// merapikannya — '012-C' dan '12-c' ditolak, bukan diubah jadi '12-C'.
//
// variety dan plantedAt berlaku untuk SELURUH himpunan, dan keduanya boleh
// null. Layar tambah pohon satu-satu tetap mewajibkan varietas lewat
// validateTreeForm; yang melonggar hanya jalur massal, dan itu keputusan
// antarmuka, bukan keputusan database — RPC-nya menerima null sejak 055.
export type CreateTreesAtPositionsInput = {
  farmId: UUID;
  positionCodes: readonly string[];
  variety?: string | null;
  plantedAt?: string | null;
};

// Tujuh field kembalian create_trees_at_positions, dipetakan apa adanya.
//
// KETIGA EMBER PENOLAKAN SENGAJA TIDAK DIGABUNG. Migrasi 062 memilih tidak
// mengembalikan satu rejected_message justru supaya sisi aplikasi bisa
// menjelaskan tiap alasan dengan kalimatnya sendiri; menggabungkannya di sini
// akan membuang keputusan itu satu lapis lebih awal.
//
// duplicateCodes BUKAN penolakan. Kode yang dikirim dua kali TETAP DIBUAT satu
// kali dan ikut muncul di createdCodes. Ia dilaporkan supaya pemanggil yang
// mengira mengirim N tahu kenapa yang lahir kurang dari N.
//
// blankCount hanya angka: entri null atau berisi spasi tidak punya kode yang
// bisa disebutkan kembali ke pengguna.
export type CreateTreesAtPositionsData = {
  createdTreeIds: UUID[];
  createdCodes: string[];
  rejectedOccupied: string[];
  rejectedOutOfGrid: string[];
  rejectedMalformed: string[];
  duplicateCodes: string[];
  blankCount: number;
};

// Lihat catatan di CreateTreeInput soal ketiadaan treeCode.
//
// variety dan plantedAt KEMBALI sejak migrasi 056, tapi maknanya berbeda dari
// sebelum 055: keduanya MENGOREKSI siklus tanam yang sedang aktif, bukan
// membuka siklus baru. Salah ketik saat input adalah kesalahan pencatatan, dan
// memperbaikinya tidak boleh mengarang peristiwa penanaman ulang.
//
// Penanaman ulang yang SUNGGUHAN tetap lewat StartTreePlantingInput.
export type UpdateTreeInput = {
  treeId: UUID;
  rowPosition?: string | null;
  columnPosition?: string | null;
  variety?: string | null;
  plantedAt?: string | null;
};

// ---- Siklus tanam (migrasi 055) ----
// Ketiganya lewat RPC SECURITY DEFINER; tree_plantings tidak punya grant tulis
// untuk authenticated, jadi tidak ada jalur lain.

export type EndTreePlantingInput = {
  treeId: UUID;
  endReason: TreePlantingEndReason;
  // Kosong berarti hari ini (WIB), diputuskan di sisi database.
  endedAt?: string | null;
};

export type StartTreePlantingInput = {
  treeId: UUID;
  variety?: string | null;
  plantedAt?: string | null;
};

export type StartTreePlantingData = {
  plantingId: UUID;
};

// Seluruh siklus tanam sebuah posisi, termasuk yang SUDAH ditutup.
//
// Berbeda dari Tree.activePlanting, yang sengaja hanya membawa siklus berjalan.
// Dua hal butuh siklus lama: keterangan pada posisi yang sedang kosong (kapan
// dan kenapa pohon sebelumnya berakhir) dan pembatas siklus di riwayat pohon.
export type GetTreePlantingsInput = {
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
  // Satu sampai banyak pohon. Menggantikan targetTreeId tunggal: sejak migrasi
  // 057 daftar pohon sebuah jadwal ada di care_schedule_trees, dan
  // updateCareSchedule-lah yang menulis jembatan itu.
  targetTreeIds?: UUID[];
  customTargetNote?: string | null;
  instruction?: string | null;
  requiresPhoto?: boolean;
  // Masa toleransi (migrasi 048, dapat diubah sejak 049). Presedensinya sama
  // dengan create_manual_schedule: neverExpires menang, lalu graceDays. Kalau
  // KEDUANYA tidak dikirim, nilai lama dipertahankan — penyuntingan judul tidak
  // boleh diam-diam menghapus masa toleransi. Mengirim neverExpires bersama
  // graceDays DITOLAK, bukan salah satunya menang tanpa jejak.
  graceDays?: number | null;
  neverExpires?: boolean;
  dateBasis?: ScheduleDateBasis;
};

export type CreateManualScheduleInput = {
  farmId: UUID;
  title: string;
  category: CareCategory;
  scheduledDate: string;
  assignedWorkerId: UUID;
  targetType: TargetType;
  // Dikirim ke RPC sebagai p_target_tree_ids (migrasi 057). RPC yang memutuskan
  // mana yang sah, mengisi jembatan, dan menyetel kolom bayangan.
  targetTreeIds?: UUID[];
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
  // Ketiganya berasal dari create_manual_schedule (migrasi 057).
  //
  // rejectedMessage TIDAK sama dengan galat: jadwalnya tetap jadi untuk pohon
  // yang sah, dan pesan ini memberi tahu pemilik pohon mana yang tidak ikut
  // karena posisinya sedang tidak ditanami.
  scheduledTreeIds: UUID[];
  rejectedTreeIds: UUID[];
  rejectedMessage: string | null;
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
  // Hanya untuk baris yang ditunda. Kalau tidak dikirim, tanggal lama
  // dipertahankan — membetulkan salah ketik catatan tidak boleh memaksa
  // pekerja memilih ulang tanggalnya.
  postponedUntil?: string | null;
};

export type UpdateTaskRealizationData = {
  activityId: UUID;
  warningMessage?: string | null;
};

export type PostponeTaskInput = {
  taskId: UUID;
  note: string;
  // Wajib sejak migrasi 049. Harus SETELAH hari ini (WIB); RPC menolak
  // tanggal hari ini maupun masa lalu.
  postponedUntil: string;
};

export type PostponeTaskData = {
  activityId: UUID;
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

// Ukuran petak kebun. TERPISAH dari UpdateFarmProfileInput dengan sengaja:
// dimensinya diubah lewat RPC-nya sendiri (set_farm_grid, migrasi 054), bukan
// lewat update_farm_profile — menggabungkannya berarti menambah parameter pada
// RPC yang sudah dipanggil klien dengan signature tetap.
//
// rows dan columns bertipe number di sini walau kolomnya smallint di database:
// PostgREST menerima angka JSON dan Postgres yang mengecilkannya. Batas 1-999
// dan 1-26 ditegakkan RPC serta constraint tabel, bukan tipe ini.
export type SetFarmGridInput = {
  farmId: UUID;
  rows: number;
  columns: number;
};

export type SetFarmGridData = {
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
