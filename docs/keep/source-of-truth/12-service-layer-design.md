# Service Layer Design Avology V2

## 1. Tujuan Service Layer

Service layer digunakan sebagai lapisan penghubung antara antarmuka aplikasi dengan database Supabase. Tujuan utama service layer adalah agar logic bisnis tidak langsung ditulis di komponen UI.

Dengan adanya service layer, setiap fitur utama memiliki fungsi yang jelas, seperti membuat kebun, mengajukan join kebun, membuat laporan kondisi pohon, membuat jadwal dari SOP, menyelesaikan tugas, dan mengambil data dashboard.

Service layer membantu menjaga struktur kode agar lebih rapi, mudah diuji, dan mudah dikembangkan.

---

# 2. Prinsip Service Layer Avology V2

Service layer Avology V2 menggunakan prinsip berikut:

1. Komponen UI hanya bertugas menampilkan data dan menerima input pengguna.
2. Logic pengambilan, penyimpanan, validasi dasar, dan pemanggilan RPC dilakukan di service layer.
3. Operasi yang memiliki side effect penting sebaiknya menggunakan RPC Supabase.
4. Operasi sederhana seperti mengambil daftar data dapat menggunakan query langsung.
5. Semua service harus menghormati role pengguna.
6. Semua data utama harus terkait dengan `farm_id`.
7. Worker tidak boleh menjalankan fungsi owner.
8. Owner tidak boleh kehilangan histori data saat mengeluarkan worker atau mengarsipkan pohon.
9. Fungsi service harus diberi nama jelas dan sesuai aksi bisnis.
10. Error dari Supabase harus ditangani agar UI dapat menampilkan pesan yang dapat dipahami pengguna.

---

# 3. Struktur Folder Service yang Disarankan

```txt
src/
  services/
    authService.ts
    farmService.ts
    memberService.ts
    treeService.ts
    conditionReportService.ts
    operationalReportService.ts
    careSopService.ts
    careScheduleService.ts
    careTaskService.ts
    growthPhaseService.ts
    dashboardService.ts
    historyService.ts
  lib/
    supabase.ts
  types/
    database.ts
    domain.ts
```

## Penjelasan

| Folder/File                   | Fungsi                                        |
| ----------------------------- | --------------------------------------------- |
| `authService.ts`              | Mengatur register, login, logout, dan profil  |
| `farmService.ts`              | Mengatur pembuatan dan pengambilan data kebun |
| `memberService.ts`            | Mengatur worker join, approve, reject, remove |
| `treeService.ts`              | Mengatur data pohon                           |
| `conditionReportService.ts`   | Mengatur laporan kondisi pohon                |
| `operationalReportService.ts` | Mengatur laporan operasional kebun            |
| `careSopService.ts`           | Mengatur template SOP perawatan               |
| `careScheduleService.ts`      | Mengatur jadwal perawatan                     |
| `careTaskService.ts`          | Mengatur tugas worker dan realisasi tugas     |
| `growthPhaseService.ts`       | Mengatur fase pertumbuhan pohon               |
| `dashboardService.ts`         | Mengambil ringkasan data dashboard            |
| `historyService.ts`           | Mengambil riwayat pohon terintegrasi          |
| `supabase.ts`                 | Konfigurasi client Supabase                   |
| `database.ts`                 | Type hasil generate dari Supabase             |
| `domain.ts`                   | Type tambahan untuk kebutuhan aplikasi        |

---

# 4. Service Auth

## 4.1 `registerUser`

### Tujuan

Mendaftarkan pengguna baru ke aplikasi.

### Digunakan oleh

* Register Screen

### Input

```ts
{
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}
```

### Output

```ts
{
  userId: string;
}
```

### Proses

1. Memanggil Supabase Auth sign up.
2. Membuat data profil di tabel `profiles`.
3. Mengembalikan ID pengguna.

### Catatan

Jika profile dibuat otomatis melalui trigger Supabase, maka service hanya perlu memanggil sign up. Namun untuk kontrol yang lebih jelas, pembuatan profile bisa dilakukan setelah sign up.

---

## 4.2 `loginUser`

### Tujuan

Login pengguna ke aplikasi.

### Digunakan oleh

* Login Screen

### Input

```ts
{
  email: string;
  password: string;
}
```

### Output

```ts
{
  userId: string;
}
```

### Proses

1. Memanggil Supabase Auth sign in.
2. Mengambil data keanggotaan pengguna.
3. Mengarahkan pengguna berdasarkan status:

   * owner active
   * worker active
   * worker pending
   * worker rejected
   * worker removed
   * belum tergabung kebun

---

## 4.3 `logoutUser`

### Tujuan

Mengeluarkan pengguna dari aplikasi.

### Digunakan oleh

* Profile Screen
* Settings Screen

### Input

Tidak ada.

### Output

```ts
{
  success: boolean;
}
```

### Proses

1. Memanggil Supabase Auth sign out.
2. Menghapus state session lokal.

---

## 4.4 `getCurrentProfile`

### Tujuan

Mengambil profil pengguna yang sedang login.

### Digunakan oleh

* App Guard
* Profile Screen
* Header

### Input

Tidak ada.

### Output

```ts
{
  id: string;
  fullName: string;
  phone?: string;
}
```

---

# 5. Service Farm

## 5.1 `createFarm`

### Tujuan

Membuat kebun baru dan menjadikan pengguna sebagai owner aktif.

### Digunakan oleh

* Create Farm Screen

### Input

```ts
{
  name: string;
  location?: string;
  areaSize?: number;
}
```

### Output

```ts
{
  farmId: string;
}
```

### Proses

1. Memanggil RPC `create_farm_with_owner`.
2. RPC membuat data `farms`.
3. RPC membuat data `farm_members` dengan role owner dan status active.
4. Mengembalikan `farmId`.

### Catatan

Fungsi ini sebaiknya tidak dilakukan dengan insert manual dari frontend karena harus membuat farm dan membership sekaligus.

---

## 5.2 `getCurrentUserFarm`

### Tujuan

Mengambil kebun aktif milik pengguna saat ini.

### Digunakan oleh

* App Guard
* Dashboard Owner
* Dashboard Worker
* Semua halaman operasional

### Input

Tidak ada.

### Output

```ts
{
  farmId: string;
  role: 'owner' | 'worker';
  status: 'pending' | 'active' | 'rejected' | 'removed';
  farm?: {
    id: string;
    name: string;
    location?: string;
    areaSize?: number;
    joinCode?: string;
  };
}
```

### Proses

1. Mengambil data dari `farm_members`.
2. Join dengan `farms`.
3. Mengembalikan role dan status user.

---

## 5.3 `getFarmDetail`

### Tujuan

Mengambil detail kebun.

### Digunakan oleh

* Farm Detail Screen
* Owner Farm Screen

### Input

```ts
{
  farmId: string;
}
```

### Output

```ts
{
  id: string;
  name: string;
  location?: string;
  areaSize?: number;
  joinCode: string;
}
```

---

# 6. Service Farm Member

## 6.1 `requestJoinFarm`

### Tujuan

Worker mengajukan bergabung ke kebun menggunakan kode.

### Digunakan oleh

* Join Farm Screen

### Input

```ts
{
  joinCode: string;
}
```

### Output

```ts
{
  membershipId: string;
}
```

### Proses

1. Memanggil RPC `request_join_farm`.
2. RPC memvalidasi join code.
3. RPC membuat atau memperbarui membership worker menjadi pending.

---

## 6.2 `getPendingWorkers`

### Tujuan

Owner mengambil daftar worker yang sedang mengajukan bergabung.

### Digunakan oleh

* Worker Management Screen
* Owner Dashboard

### Input

```ts
{
  farmId: string;
}
```

### Output

```ts
Array<{
  membershipId: string;
  userId: string;
  fullName: string;
  phone?: string;
  status: 'pending';
  createdAt: string;
}>
```

### Catatan RLS

Data profil worker diambil melalui query/view/RPC yang mengikuti policy `profiles`: owner active dapat melihat profil dasar worker dalam farm yang sama, sedangkan worker tidak dapat melihat profil user di luar farm-nya.

---

## 6.3 `getActiveWorkers`

### Tujuan

Owner mengambil daftar worker aktif dalam kebun.

### Digunakan oleh

* Worker Management Screen
* Create Schedule Screen
* Create Task Screen

### Input

```ts
{
  farmId: string;
}
```

### Output

```ts
Array<{
  membershipId: string;
  userId: string;
  fullName: string;
  phone?: string;
  status: 'active';
}>
```

### Catatan RLS

Data profil worker diambil melalui query/view/RPC yang mengikuti policy `profiles`: owner active dapat melihat profil dasar worker dalam farm yang sama, sedangkan worker tidak dapat melihat profil user di luar farm-nya.

---

## 6.4 `approveWorker`

### Tujuan

Owner menyetujui pengajuan worker.

### Digunakan oleh

* Worker Management Screen

### Input

```ts
{
  membershipId: string;
}
```

### Output

```ts
{
  success: boolean;
}
```

### Proses

1. Memanggil RPC `approve_worker`.
2. Status worker berubah menjadi active.

---

## 6.5 `rejectWorker`

### Tujuan

Owner menolak pengajuan worker.

### Digunakan oleh

* Worker Management Screen

### Input

```ts
{
  membershipId: string;
}
```

### Output

```ts
{
  success: boolean;
}
```

### Proses

1. Memanggil RPC `reject_worker`.
2. Status worker berubah menjadi rejected.

---

## 6.6 `removeWorker`

### Tujuan

Owner mengeluarkan worker aktif dari kebun.

### Digunakan oleh

* Worker Management Screen

### Input

```ts
{
  membershipId: string;
}
```

### Output

```ts
{
  success: boolean;
}
```

### Proses

1. Memanggil RPC `remove_worker`.
2. Status worker berubah menjadi removed.
3. Riwayat tugas dan laporan worker tetap tersimpan.

---

# 7. Service Tree

## 7.1 `getTrees`

### Tujuan

Mengambil daftar pohon dalam kebun.

### Digunakan oleh

* Tree List Screen
* Create Condition Report Screen
* Create Growth Phase Screen
* Create Schedule Target Picker

### Input

```ts
{
  farmId: string;
  search?: string;
  condition?: string;
  growthPhase?: string;
  archived?: boolean;
}
```

### Output

```ts
Array<{
  id: string;
  treeCode: string;
  rowPosition?: string;
  columnPosition?: string;
  variety?: string;
  plantedAt?: string;
  currentCondition: string;
  currentGrowthPhase?: string;
  isArchived: boolean;
}>
```

---

## 7.2 `getTreeDetail`

### Tujuan

Mengambil detail pohon tertentu.

### Digunakan oleh

* Tree Detail Screen

### Input

```ts
{
  treeId: string;
}
```

### Output

```ts
{
  id: string;
  farmId: string;
  treeCode: string;
  rowPosition?: string;
  columnPosition?: string;
  variety?: string;
  plantedAt?: string;
  currentCondition: string;
  currentGrowthPhase?: string;
  isArchived: boolean;
}
```

---

## 7.3 `createTree`

### Tujuan

Owner menambah data pohon.

### Digunakan oleh

* Create Tree Screen

### Input

```ts
{
  farmId: string;
  treeCode: string;
  rowPosition?: string;
  columnPosition?: string;
  variety?: string;
  plantedAt?: string;
}
```

### Output

```ts
{
  treeId: string;
}
```

### Validasi

* `treeCode` wajib diisi.
* `treeCode` tidak boleh duplikat dalam satu kebun.
* Hanya owner aktif yang boleh membuat pohon.

---

## 7.4 `updateTree`

### Tujuan

Owner mengubah data pohon.

### Digunakan oleh

* Edit Tree Screen

### Input

```ts
{
  treeId: string;
  treeCode?: string;
  rowPosition?: string;
  columnPosition?: string;
  variety?: string;
  plantedAt?: string;
}
```

### Output

```ts
{
  success: boolean;
}
```

---

## 7.5 `archiveTree`

### Tujuan

Owner mengarsipkan pohon.

### Digunakan oleh

* Tree Detail Screen
* Tree List Screen

### Input

```ts
{
  treeId: string;
}
```

### Output

```ts
{
  success: boolean;
}
```

### Proses

1. Mengubah `is_archived` menjadi `true`.
2. Riwayat pohon tetap tersimpan.

---

## 7.6 `restoreTree`

### Tujuan

Owner mengembalikan pohon dari arsip.

### Digunakan oleh

* Archived Tree Screen

### Input

```ts
{
  treeId: string;
}
```

### Output

```ts
{
  success: boolean;
}
```

---

# 8. Service Condition Report

## 8.1 `createTreeConditionReport`

### Tujuan

Owner atau worker mencatat kondisi pohon.

### Digunakan oleh

* Create Condition Report Screen
* Tree Detail Screen

### Input

```ts
{
  farmId: string;
  treeId: string;
  conditionStatus:
    | 'healthy'
    | 'needs_attention'
    | 'pest_attacked'
    | 'disease_indicated'
    | 'damaged'
    | 'dead';
  note?: string;
}
```

### Output

```ts
{
  reportId: string;
}
```

### Proses

1. Insert ke `tree_condition_reports`.
2. Trigger database memperbarui `trees.current_condition`.

### Validasi

* User harus active member pada kebun terkait.
* Worker removed, rejected, atau pending tidak boleh membuat laporan.

---

## 8.2 `getTreeConditionReports`

### Tujuan

Mengambil riwayat kondisi pohon.

### Digunakan oleh

* Tree Detail Screen
* Tree History Screen

### Input

```ts
{
  treeId: string;
}
```

### Output

```ts
Array<{
  id: string;
  conditionStatus: string;
  note?: string;
  reportedBy: string;
  reportedAt: string;
}>
```

---

# 9. Service Operational Report

## 9.1 `createOperationalReport`

### Tujuan

Worker membuat laporan operasional kebun.

### Digunakan oleh

* Create Operational Report Screen
* Worker Dashboard

### Input

```ts
{
  farmId: string;
  category:
    | 'land_damage'
    | 'broken_tool'
    | 'out_of_stock'
    | 'area_pest_disease'
    | 'disaster_weather'
    | 'worker_need'
    | 'other';
  locationNote?: string;
  description?: string;
}
```

### Output

```ts
{
  reportId: string;
}
```

### Validasi

* Hanya worker active yang boleh membuat laporan operasional.
* Kategori laporan wajib dipilih.
* Catatan lokasi atau deskripsi sebaiknya diisi minimal salah satu.

---

## 9.2 `getOperationalReports`

### Tujuan

Owner mengambil daftar laporan operasional kebun.

### Digunakan oleh

* Operational Report List Screen
* Owner Dashboard

### Input

```ts
{
  farmId: string;
  status?: 'new' | 'in_progress' | 'resolved' | 'rejected';
}
```

### Output

```ts
Array<{
  id: string;
  category: string;
  locationNote?: string;
  description?: string;
  status: string;
  reportedBy: string;
  createdAt: string;
}>
```

---

## 9.3 `getOperationalReportDetail`

### Tujuan

Owner melihat detail laporan operasional.

### Digunakan oleh

* Operational Report Detail Screen

### Input

```ts
{
  reportId: string;
}
```

### Output

```ts
{
  id: string;
  farmId: string;
  category: string;
  locationNote?: string;
  description?: string;
  status: string;
  reportedBy: string;
  createdAt: string;
}
```

---

## 9.4 `updateOperationalReportStatus`

### Tujuan

Owner mengubah status laporan operasional.

### Digunakan oleh

* Operational Report Detail Screen

### Input

```ts
{
  reportId: string;
  status: 'new' | 'in_progress' | 'resolved' | 'rejected';
}
```

### Output

```ts
{
  success: boolean;
}
```

---

# 10. Service Care SOP

## 10.1 `getCareSOPs`

### Tujuan

Mengambil daftar SOP perawatan.

### Digunakan oleh

* Care SOP List Screen
* Create Schedule Screen
* Owner Dashboard

### Input

```ts
{
  farmId: string;
  activeOnly?: boolean;
}
```

### Output

```ts
Array<{
  id: string;
  name: string;
  category: string;
  intervalDays?: number;
  defaultInstruction?: string;
  defaultTargetType: 'farm' | 'row' | 'column' | 'tree';
  isActive: boolean;
}>
```

---

## 10.2 `getCareSOPDetail`

### Tujuan

Mengambil detail SOP.

### Digunakan oleh

* Care SOP Detail Screen
* Edit Care SOP Screen

### Input

```ts
{
  sopId: string;
}
```

### Output

```ts
{
  id: string;
  farmId: string;
  name: string;
  category: string;
  intervalDays?: number;
  defaultInstruction?: string;
  defaultTargetType: 'farm' | 'row' | 'column' | 'tree';
  defaultTargetRow?: string;
  defaultTargetColumn?: string;
  defaultTargetTreeId?: string;
  isActive: boolean;
}
```

---

## 10.3 `createCareSOP`

### Tujuan

Owner membuat template SOP perawatan.

### Digunakan oleh

* Create Care SOP Screen

### Input

```ts
{
  farmId: string;
  name: string;
  category: 'watering' | 'fertilizing' | 'spraying' | 'weeding' | 'other';
  intervalDays?: number;
  defaultInstruction?: string;
  defaultTargetType: 'farm' | 'row' | 'column' | 'tree';
  defaultTargetRow?: string;
  defaultTargetColumn?: string;
  defaultTargetTreeId?: string;
}
```

### Output

```ts
{
  sopId: string;
}
```

### Validasi

* Hanya owner active yang boleh membuat SOP.
* `name` wajib diisi.
* `category` wajib dipilih.
* Jika `intervalDays` diisi, nilainya harus lebih dari 0.
* Target harus sesuai dengan `defaultTargetType`.
* `defaultTargetType` tidak boleh `custom` pada MVP.

---

## 10.4 `updateCareSOP`

### Tujuan

Owner mengubah template SOP perawatan.

### Digunakan oleh

* Edit Care SOP Screen

### Input

```ts
{
  sopId: string;
  name?: string;
  category?: string;
  intervalDays?: number;
  defaultInstruction?: string;
  defaultTargetType?: 'farm' | 'row' | 'column' | 'tree';
  defaultTargetRow?: string;
  defaultTargetColumn?: string;
  defaultTargetTreeId?: string;
}
```

### Output

```ts
{
  success: boolean;
}
```

---

## 10.5 `setCareSOPActiveStatus`

### Tujuan

Owner mengaktifkan atau menonaktifkan SOP.

### Digunakan oleh

* Care SOP Detail Screen

### Input

```ts
{
  sopId: string;
  isActive: boolean;
}
```

### Output

```ts
{
  success: boolean;
}
```

---

## 10.6 `getCareSOPNextScheduleReference`

### Tujuan

Menghitung acuan jadwal berikutnya berdasarkan interval SOP dan realisasi terakhir.

### Digunakan oleh

* Care SOP List Screen
* Care SOP Detail Screen
* Owner Dashboard

### Input

```ts
{
  sopId: string;
}
```

### Output

```ts
{
  sopId: string;
  intervalDays?: number;
  lastPerformedAt?: string;
  nextDueDate?: string;
  status: 'no_interval' | 'no_history' | 'not_due' | 'due_today' | 'overdue';
  overdueDays?: number;
}
```

### Proses

1. Mengambil data SOP.
2. Mengambil realisasi terakhir dari task yang berasal dari jadwal dengan `care_sop_id` tersebut.
3. Jika belum ada histori, status menjadi `no_history`.
4. Jika ada histori dan interval, sistem menghitung:

```txt
lastPerformedAt + intervalDays
```

5. Sistem menentukan status:

   * `not_due`
   * `due_today`
   * `overdue`

### Catatan

Fungsi ini tidak membuat tugas otomatis. Fungsi ini hanya memberi acuan kepada owner.

---

# 11. Service Care Schedule

## 11.1 `createScheduleFromSOP`

### Tujuan

Owner membuat jadwal perawatan dari SOP dan menghasilkan tugas worker.

### Digunakan oleh

* Create Schedule From SOP Screen
* Care SOP Detail Screen

### Input

```ts
{
  farmId: string;
  sopId: string;
  scheduledDate: string;
  assignedWorkerId: string;
  targetType: 'farm' | 'row' | 'column' | 'tree';
  targetRow?: string;
  targetColumn?: string;
  targetTreeId?: string;
  instruction?: string;
}
```

### Output

```ts
{
  scheduleId: string;
  taskId: string;
}
```

### Proses

1. Mengambil data SOP.
2. Membuat `care_schedules`.
3. Membuat `care_tasks`.
4. Tugas muncul pada daftar tugas worker.

### Catatan

Fungsi ini sebaiknya menggunakan RPC agar pembuatan schedule dan task terjadi dalam satu transaksi. Kalau jadwal berhasil dibuat tapi task gagal, database akan punya separuh kenyataan. Itu tidak filosofis, itu bug.

Jadwal dari SOP hanya boleh memakai target terstruktur. Target `custom` hanya berlaku untuk jadwal manual atau tugas tindak lanjut yang dibuat manual oleh owner.

---

## 11.2 `createManualSchedule`

### Tujuan

Owner membuat jadwal manual tanpa SOP dan menghasilkan tugas worker.

### Digunakan oleh

* Create Manual Schedule Screen

### Input

```ts
{
  farmId: string;
  title: string;
  category: 'watering' | 'fertilizing' | 'spraying' | 'weeding' | 'other';
  scheduledDate: string;
  assignedWorkerId: string;
  targetType: 'farm' | 'row' | 'column' | 'tree' | 'custom';
  targetRow?: string;
  targetColumn?: string;
  targetTreeId?: string;
  customTargetNote?: string;
  instruction?: string;
}
```

### Output

```ts
{
  scheduleId: string;
  taskId: string;
}
```

### Proses

1. Membuat `care_schedules` tanpa `care_sop_id`.
2. Membuat `care_tasks`.
3. Mengembalikan `scheduleId` dan `taskId`.

### Catatan

Sebaiknya juga menggunakan RPC agar schedule dan task dibuat secara konsisten.

---

## 11.3 `getCareSchedules`

### Tujuan

Mengambil daftar jadwal perawatan.

### Digunakan oleh

* Care Schedule List Screen
* Owner Schedule Screen

### Input

```ts
{
  farmId: string;
  date?: string;
  category?: string;
}
```

### Output

```ts
Array<{
  id: string;
  title: string;
  category: string;
  scheduledDate: string;
  targetType: string;
  instruction?: string;
  careSopId?: string;
}>
```

---

## 11.4 `getCareScheduleDetail`

### Tujuan

Mengambil detail jadwal perawatan.

### Digunakan oleh

* Care Schedule Detail Screen

### Input

```ts
{
  scheduleId: string;
}
```

### Output

```ts
{
  id: string;
  farmId: string;
  careSopId?: string;
  title: string;
  category: string;
  scheduledDate: string;
  targetType: string;
  targetRow?: string;
  targetColumn?: string;
  targetTreeId?: string;
  customTargetNote?: string;
  instruction?: string;
  createdBy: string;
}
```

---

# 12. Service Care Task

## 12.1 `getWorkerTasks`

### Tujuan

Worker mengambil daftar tugas miliknya.

### Digunakan oleh

* Worker Dashboard
* Worker Task List Screen

### Input

```ts
{
  workerId: string;
  date?: string;
  status?: 'pending' | 'completed' | 'postponed';
}
```

### Output

```ts
Array<{
  id: string;
  title: string;
  category?: string;
  dueDate: string;
  status: string;
  targetType: string;
  instruction?: string;
}>
```

### Catatan

Dalam implementasi, `workerId` sebaiknya berasal dari `auth.uid()`, bukan bebas dikirim frontend. Karena memberi frontend kendali penuh atas ID worker adalah cara cepat mengundang kekacauan.

---

## 12.2 `getFarmTasks`

### Tujuan

Owner mengambil daftar tugas dalam kebun.

### Digunakan oleh

* Owner Dashboard
* Owner Task List Screen
* Schedule Detail Screen

### Input

```ts
{
  farmId: string;
  date?: string;
  status?: 'pending' | 'completed' | 'postponed';
  assignedTo?: string;
}
```

### Output

```ts
Array<{
  id: string;
  title: string;
  assignedTo: string;
  dueDate: string;
  status: string;
  targetType: string;
}>
```

---

## 12.3 `getTaskDetail`

### Tujuan

Mengambil detail tugas.

### Digunakan oleh

* Task Detail Screen

### Input

```ts
{
  taskId: string;
}
```

### Output

```ts
{
  id: string;
  farmId: string;
  title: string;
  category?: string;
  instruction?: string;
  targetType: string;
  targetRow?: string;
  targetColumn?: string;
  targetTreeId?: string;
  customTargetNote?: string;
  dueDate: string;
  status: string;
  assignedTo: string;
  assignedBy: string;
  careScheduleId?: string;
  operationalReportId?: string;
}
```

---

## 12.4 `completeTask`

### Tujuan

Worker menandai tugas sebagai selesai dan membuat aktivitas realisasi.

### Digunakan oleh

* Task Detail Screen

### Input

```ts
{
  taskId: string;
  note?: string;
}
```

### Output

```ts
{
  activityId: string;
}
```

### Proses

1. Memastikan task milik worker aktif.
2. Insert ke `care_activities` dengan status `completed`.
3. Trigger memperbarui status task menjadi `completed`.

### Catatan

Fungsi ini sebaiknya menggunakan RPC. Jangan biarkan frontend insert activity dan update task secara terpisah seperti manusia yang percaya “nanti juga sinkron sendiri”.

---

## 12.5 `postponeTask`

### Tujuan

Worker menandai tugas sebagai tertunda dan mencatat alasan.

### Digunakan oleh

* Task Detail Screen

### Input

```ts
{
  taskId: string;
  note: string;
}
```

### Output

```ts
{
  activityId: string;
}
```

### Proses

1. Memastikan task milik worker aktif.
2. Insert ke `care_activities` dengan status `postponed`.
3. Trigger memperbarui status task menjadi `postponed`.

---

## 12.6 `createTaskFromOperationalReport`

### Tujuan

Owner membuat tugas tindak lanjut dari laporan operasional.

### Digunakan oleh

* Operational Report Detail Screen

### Input

```ts
{
  reportId: string;
  assignedWorkerId: string;
  dueDate: string;
  title: string;
  instruction?: string;
  targetType: 'farm' | 'row' | 'column' | 'tree' | 'custom';
  targetRow?: string;
  targetColumn?: string;
  targetTreeId?: string;
  customTargetNote?: string;
}
```

### Catatan

Tugas tindak lanjut dibuat manual oleh owner. Karena itu `targetType = custom` boleh digunakan jika `customTargetNote` diisi.

### Output

```ts
{
  taskId: string;
}
```

### Proses

1. Memastikan owner active pada kebun laporan.
2. Membuat `care_tasks` dengan `operational_report_id`.
3. Mengubah status laporan menjadi `in_progress`.

### Catatan

Fungsi ini sebaiknya menggunakan RPC.

---

# 13. Service Growth Phase

## 13.1 `createGrowthPhaseRecord`

### Tujuan

Owner atau worker mencatat fase pertumbuhan pohon.

### Digunakan oleh

* Create Growth Phase Screen
* Tree Detail Screen

### Input

```ts
{
  farmId: string;
  treeId: string;
  phase:
    | 'initial_planting'
    | 'vegetative'
    | 'flowering'
    | 'fruiting'
    | 'harvesting';
  note?: string;
}
```

### Output

```ts
{
  recordId: string;
}
```

### Proses

1. Insert ke `growth_phase_records`.
2. Trigger memperbarui `trees.current_growth_phase`.

---

## 13.2 `getGrowthPhaseRecords`

### Tujuan

Mengambil riwayat fase pertumbuhan pohon.

### Digunakan oleh

* Tree Detail Screen
* Tree History Screen

### Input

```ts
{
  treeId: string;
}
```

### Output

```ts
Array<{
  id: string;
  phase: string;
  note?: string;
  recordedBy: string;
  recordedAt: string;
}>
```

---

## 13.3 `getFloweringAndFruitingTrees`

### Tujuan

Owner mengambil daftar pohon yang sedang berbunga atau berbuah.

### Digunakan oleh

* Owner Dashboard
* Growth Monitoring Screen

### Input

```ts
{
  farmId: string;
}
```

### Output

```ts
Array<{
  id: string;
  treeCode: string;
  variety?: string;
  currentGrowthPhase: 'flowering' | 'fruiting';
}>
```

### Catatan

Fungsi ini bukan prediksi panen. Ini hanya monitoring fase pohon. Tolong jangan kasih nama `predictHarvest`, nanti penguji bisa mencium darah.

---

# 14. Service History

## 14.1 `getTreeHistory`

### Tujuan

Mengambil riwayat terintegrasi pohon.

### Digunakan oleh

* Tree Detail Screen
* Tree History Screen

### Input

```ts
{
  treeId: string;
}
```

### Output

```ts
Array<{
  treeId: string;
  historyType: 'condition' | 'phase' | 'care';
  title: string;
  description?: string;
  actorId: string;
  happenedAt: string;
}>
```

### Proses

1. Mengambil data dari `tree_history_view`.
2. Filter berdasarkan `tree_id`.
3. Urutkan berdasarkan `happened_at` terbaru.

---

# 15. Service Dashboard

## 15.1 `getOwnerDashboardSummary`

### Tujuan

Mengambil ringkasan dashboard owner.

### Digunakan oleh

* Owner Dashboard

### Input

```ts
{
  farmId: string;
}
```

### Output

```ts
{
  totalTrees: number;
  healthyTrees: number;
  problemTrees: number;
  todayTasks: number;
  unfinishedTasks: number;
  newOperationalReports: number;
  pendingWorkers: number;
  floweringTrees: number;
  fruitingTrees: number;
  overdueSOPs: number;
}
```

### Data Sumber

| Ringkasan             | Sumber Data                              |
| --------------------- | ---------------------------------------- |
| totalTrees            | `trees`                                  |
| healthyTrees          | `trees.current_condition`                |
| problemTrees          | `trees.current_condition` selain healthy |
| todayTasks            | `care_tasks.due_date`                    |
| unfinishedTasks       | `care_tasks.status = pending/postponed`  |
| newOperationalReports | `operational_reports.status = new`       |
| pendingWorkers        | `farm_members.status = pending`          |
| floweringTrees        | `trees.current_growth_phase = flowering` |
| fruitingTrees         | `trees.current_growth_phase = fruiting`  |
| overdueSOPs           | hasil perhitungan interval SOP           |

---

## 15.2 `getWorkerDashboardSummary`

### Tujuan

Mengambil ringkasan dashboard worker.

### Digunakan oleh

* Worker Dashboard

### Input

```ts
{
  farmId: string;
}
```

### Output

```ts
{
  todayTasks: number;
  unfinishedTasks: number;
  completedTasks: number;
}
```

### Catatan

Data tugas worker harus berdasarkan `auth.uid()` agar worker hanya melihat tugasnya sendiri.

---

# 16. Service yang Disarankan Menggunakan RPC

Beberapa operasi sebaiknya menggunakan RPC karena melibatkan banyak langkah atau validasi role penting.

| Service Function                  | Alasan Menggunakan RPC                         |
| --------------------------------- | ---------------------------------------------- |
| `createFarm`                      | Membuat farm dan owner membership sekaligus    |
| `requestJoinFarm`                 | Validasi join code dan membership              |
| `approveWorker`                   | Hanya owner active yang boleh approve          |
| `rejectWorker`                    | Hanya owner active yang boleh reject           |
| `removeWorker`                    | Hanya owner active yang boleh remove           |
| `createScheduleFromSOP`           | Membuat schedule dan task dalam satu transaksi |
| `createManualSchedule`            | Membuat schedule dan task dalam satu transaksi |
| `createTaskFromOperationalReport` | Membuat task dan update report status          |
| `completeTask`                    | Insert activity dan update status task         |
| `postponeTask`                    | Insert activity dan update status task         |

---

# 17. Service yang Bisa Menggunakan Query Langsung

| Service Function          | Query                                   |
| ------------------------- | --------------------------------------- |
| `getCurrentProfile`       | Select dari `profiles`                  |
| `getCurrentUserFarm`      | Select dari `farm_members` join `farms` |
| `getTrees`                | Select dari `trees`                     |
| `getTreeDetail`           | Select dari `trees`                     |
| `getTreeConditionReports` | Select dari `tree_condition_reports`    |
| `getOperationalReports`   | Select dari `operational_reports`       |
| `getCareSOPs`             | Select dari `care_sops`                 |
| `getCareSchedules`        | Select dari `care_schedules`            |
| `getWorkerTasks`          | Select dari `care_tasks`                |
| `getFarmTasks`            | Select dari `care_tasks`                |
| `getGrowthPhaseRecords`   | Select dari `growth_phase_records`      |
| `getTreeHistory`          | Select dari `tree_history_view`         |

---

# 18. Standar Error Handling

Setiap service sebaiknya mengembalikan format error yang konsisten.

## Format Sukses

```ts
{
  data: T;
  error: null;
}
```

## Format Gagal

```ts
{
  data: null;
  error: {
    message: string;
    code?: string;
  };
}
```

## Contoh Pesan Error User-Friendly

| Kondisi                  | Pesan untuk User                                                  |
| ------------------------ | ----------------------------------------------------------------- |
| Join code salah          | Kode kebun tidak ditemukan. Periksa kembali kode yang dimasukkan. |
| Worker belum disetujui   | Pengajuan Anda masih menunggu persetujuan owner.                  |
| Worker removed           | Akses Anda ke kebun ini sudah dinonaktifkan.                      |
| Tree code duplikat       | Kode pohon sudah digunakan di kebun ini.                          |
| SOP interval tidak valid | Interval perawatan harus lebih dari 0 hari.                       |
| Task bukan milik worker  | Anda tidak memiliki akses ke tugas ini.                           |
| Gagal koneksi            | Gagal memuat data. Periksa koneksi internet Anda.                 |

---

# 19. Standar Naming Function

Gunakan nama fungsi berdasarkan aksi bisnis, bukan berdasarkan tabel mentah.

## Disarankan

```ts
createFarm()
requestJoinFarm()
approveWorker()
createTreeConditionReport()
createScheduleFromSOP()
completeTask()
getOwnerDashboardSummary()
```

## Tidak Disarankan

```ts
insertFarmRow()
updateMemberStatus()
selectTreeData()
insertTaskActivity()
```

Nama kedua terlalu database-oriented. Boleh dipakai di dalam service, tapi jangan jadi nama API bisnis utama.

---

# 20. Prioritas Implementasi Service

Service sebaiknya dibuat berdasarkan urutan dependency sistem.

## Iterasi 1: Auth dan Kebun

1. `registerUser`
2. `loginUser`
3. `logoutUser`
4. `getCurrentProfile`
5. `createFarm`
6. `getCurrentUserFarm`
7. `requestJoinFarm`
8. `approveWorker`
9. `rejectWorker`
10. `removeWorker`

## Iterasi 2: Pohon dan Laporan Kondisi

1. `getTrees`
2. `getTreeDetail`
3. `createTree`
4. `updateTree`
5. `archiveTree`
6. `restoreTree`
7. `createTreeConditionReport`
8. `getTreeConditionReports`

## Iterasi 3: SOP Perawatan dan Acuan Jadwal Berikutnya

1. `getCareSOPs`
2. `getCareSOPDetail`
3. `createCareSOP`
4. `updateCareSOP`
5. `setCareSOPActiveStatus`
6. `getCareSOPNextScheduleReference`
7. `createScheduleFromSOP`

## Iterasi 4: Jadwal Manual dan Realisasi Tugas

1. `createManualSchedule`
2. `getWorkerTasks`
3. `getTaskDetail`
4. `completeTask`
5. `postponeTask`

## Iterasi 5: Laporan Operasional Kebun dan Tindak Lanjut

1. `createOperationalReport`
2. `getOperationalReports`
3. `getOperationalReportDetail`
4. `updateOperationalReportStatus`
5. `createTaskFromOperationalReport`

## Iterasi 6: Fase Pertumbuhan dan Riwayat Pohon

1. `createGrowthPhaseRecord`
2. `getGrowthPhaseRecords`
3. `getFloweringAndFruitingTrees`
4. `getTreeHistory`

## Iterasi 7: Dashboard dan Final MVP Polish

1. `getOwnerDashboardSummary`
2. `getWorkerDashboardSummary`

---

# 21. Ringkasan Service Layer Final

| Modul                      | Fungsi Utama                               |
| -------------------------- | ------------------------------------------ |
| Auth Service               | Register, login, logout, profil            |
| Farm Service               | Membuat dan mengambil data kebun           |
| Member Service             | Join farm, approve, reject, remove worker  |
| Tree Service               | CRUD pohon dan arsip pohon                 |
| Condition Report Service   | Laporan dan riwayat kondisi pohon          |
| Operational Report Service | Laporan umum kebun dan status laporan      |
| Care SOP Service           | Template SOP dan acuan jadwal berikutnya   |
| Care Schedule Service      | Jadwal dari SOP dan jadwal manual          |
| Care Task Service          | Daftar tugas, detail tugas, selesai, tunda |
| Growth Phase Service       | Catat dan lihat fase pertumbuhan           |
| History Service            | Riwayat pohon terintegrasi                 |
| Dashboard Service          | Ringkasan dashboard owner dan worker       |

---

# 22. Batasan Service Layer MVP

Service layer MVP tidak mencakup:

1. Prediksi panen otomatis
2. Machine learning
3. Push notification
4. IoT atau sensor
5. API cuaca
6. Chat owner-worker
7. Akuntansi lengkap
8. Laporan PDF otomatis
9. Integrated farming
10. Marketplace
11. Grading buah
12. Sistem kelompok tani
13. Recurring task otomatis penuh
14. Peternakan
15. Supply chain restoran atau warung

Fitur-fitur tersebut dapat ditambahkan pada pengembangan lanjutan jika MVP sudah stabil.
