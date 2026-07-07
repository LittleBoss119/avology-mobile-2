# Implementation Master Plan Avology V2

Dokumen ini adalah rencana implementasi final Avology V2 berdasarkan seluruh dokumen `docs/source-of-truth` yang sudah disinkronkan. Dokumen ini tidak membuat fitur baru, tidak membuat UI, dan tidak membuat migration SQL. Jika ada perbedaan antar dokumen lama, decision log menjadi acuan final.

---

# 1. Ringkasan Scope MVP Final

Avology V2 adalah aplikasi mobile sistem informasi operasional kebun alpukat untuk MS Farm. Fokus MVP adalah membantu owner dan worker mencatat data kebun secara terstruktur, menjalankan SOP perawatan, mengelola jadwal dan tugas, mencatat kondisi pohon, mencatat fase pertumbuhan, membuat laporan operasional, melihat riwayat pohon, dan memantau dashboard ringkas.

MVP ini bukan sistem prediksi panen, bukan sistem estimasi panen otomatis, bukan aplikasi IoT, bukan aplikasi akuntansi, dan bukan backend custom. Sistem hanya menggunakan Supabase sebagai backend utama melalui Auth, PostgreSQL, RLS, RPC, trigger, view, dan service layer di aplikasi frontend.

Tujuan utama MVP:

1. Memastikan data pohon dicatat secara individual.
2. Memastikan kondisi, fase pertumbuhan, treatment, dan tugas worker dapat ditelusuri.
3. Membantu owner menjaga konsistensi perawatan melalui SOP template dan acuan jadwal berikutnya.
4. Membantu worker menjalankan tugas dan membuat laporan lapangan dengan flow sederhana.
5. Memberi dashboard ringkas untuk decision making cepat.

---

# 2. Fitur yang Masuk MVP

1. Autentikasi pengguna: register, login, logout.
2. Role pengguna: owner dan worker, berbasis `farm_members`.
3. Manajemen kebun: owner membuat kebun, sistem membuat join code.
4. Join worker: worker request join memakai join code.
5. Manajemen worker: approve, reject, remove, dan status pending/active/rejected/removed.
6. Manajemen pohon: tambah, ubah, detail, archive, unarchive.
7. Laporan kondisi pohon: catat kondisi, update kondisi terbaru, riwayat kondisi.
8. Laporan operasional kebun: worker membuat laporan umum, owner melihat dan mengubah status.
9. Tindak lanjut laporan operasional: owner membuat task dari laporan.
10. SOP perawatan sebagai template standar.
11. Acuan jadwal berikutnya berdasarkan interval SOP dan realisasi terakhir.
12. Jadwal perawatan dari SOP.
13. Jadwal perawatan manual.
14. Target jadwal/task: farm, row, column, tree, dan custom khusus jadwal/task manual jika didukung schema.
15. Tugas worker: lihat tugas, detail tugas, selesai, tunda.
16. Realisasi perawatan melalui `care_activities`.
17. Fase pertumbuhan pohon: initial planting, vegetative, flowering, fruiting, harvesting.
18. Monitoring fase pertumbuhan untuk pohon berbunga dan berbuah.
19. Riwayat pohon terintegrasi dari kondisi, fase, dan perawatan.
20. Dashboard owner.
21. Dashboard worker.
22. Guard akses untuk pending, rejected, removed, owner active, dan worker active.

---

# 3. Fitur yang Tidak Masuk MVP

1. Prediksi panen otomatis.
2. Estimasi panen otomatis.
3. Machine learning untuk prediksi panen.
4. Push notification atau alarm otomatis.
5. IoT atau sensor.
6. API cuaca.
7. Chat owner-worker.
8. Backend custom.
9. Akuntansi lengkap atau laporan laba-rugi lengkap.
10. Laporan PDF otomatis.
11. Integrated farming.
12. Peternakan dan bank pakan.
13. Supply chain restoran atau warung.
14. Marketplace hasil panen.
15. Grading buah A1, A2, A3.
16. Sistem kelompok tani.
17. Multi-owner kompleks.
18. Role admin global.
19. Recurring task full otomatis tanpa konfirmasi owner.
20. Permanent delete pohon.
21. Custom target pada default target SOP.

---

# 4. Aturan Implementasi Final Berdasarkan Decision Log

Aturan berikut wajib menjadi pagar implementasi:

1. Tidak ada prediksi panen otomatis.
2. Tidak ada estimasi panen otomatis.
3. Monitoring panen hanya melalui fase pertumbuhan, terutama fase berbunga dan berbuah.
4. Growth phase tetap fitur critical MVP dan masuk Iteration 6.
5. Tidak ada label, screen, service, atau function bernama `predictHarvest` atau setara.
6. Pohon memakai archive/unarchive melalui `trees.is_archived`, bukan permanent delete.
7. Worker removed tidak dihapus permanen. Status membership berubah menjadi `removed`.
8. Worker `pending`, `rejected`, dan `removed` tidak boleh mengakses data operasional.
9. Rejected Screen dan Removed Access Screen minimal ada sejak Iteration 1.
10. SOP adalah template standar, bukan dokumen prosedur panjang.
11. SOP default target tidak memakai `custom`.
12. Custom target hanya boleh untuk jadwal/task manual atau tindak lanjut laporan jika schema mendukung.
13. Jadwal dari SOP hanya memakai target terstruktur: `farm`, `row`, `column`, `tree`.
14. Sistem tidak membuat tugas otomatis tanpa konfirmasi owner.
15. Laporan kondisi pohon dan laporan operasional kebun tetap dipisah.
16. Laporan operasional masuk Iteration 5.
17. Tidak ada backend custom. Gunakan Supabase, service layer frontend, RLS, RPC, trigger, dan view.
18. Tidak ada push notification.
19. Tidak ada IoT.
20. Dashboard bukan tabel sendiri; dashboard memakai query agregasi dari tabel operasional.
21. Owner active dapat melihat profil dasar member dalam farm miliknya untuk status `pending`, `active`, `rejected`, dan `removed` melalui RPC atau view aman. Data yang boleh ditampilkan hanya `user_id`, `full_name`, dan `phone`.
22. Worker hanya dapat melihat profil dirinya sendiri dan tidak dapat melihat profil user lain di luar dirinya.
23. Untuk schedule/task picker, hanya worker `active` yang boleh dipilih.
24. Worker flow harus sederhana, minim input teks, dan memakai pilihan kategori/status sebisa mungkin.

---

# 5. Database Schema Final

## 5.1 Tabel Final

| Tabel | Fungsi |
| --- | --- |
| `profiles` | Profil dasar user yang terhubung ke Supabase Auth |
| `farms` | Data kebun dan join code |
| `farm_members` | Role dan status user dalam kebun |
| `trees` | Data pohon alpukat individual |
| `tree_condition_reports` | Riwayat laporan kondisi pohon |
| `operational_reports` | Laporan operasional kebun |
| `care_sops` | Template SOP perawatan |
| `care_schedules` | Jadwal perawatan dari SOP atau manual |
| `care_tasks` | Tugas worker dari jadwal atau laporan operasional |
| `care_activities` | Aktivitas/realisasi tugas worker |
| `growth_phase_records` | Riwayat fase pertumbuhan pohon |
| `tree_history_view` | View timeline riwayat pohon |

## 5.2 Kolom Penting per Tabel

| Tabel | Kolom penting |
| --- | --- |
| `profiles` | `id`, `full_name`, `phone`, `created_at`, `updated_at` |
| `farms` | `id`, `name`, `location`, `area_size`, `join_code`, `created_by`, `created_at`, `updated_at` |
| `farm_members` | `id`, `farm_id`, `user_id`, `role`, `status`, `joined_at`, `created_at`, `updated_at` |
| `trees` | `id`, `farm_id`, `tree_code`, `row_position`, `column_position`, `variety`, `planted_at`, `current_condition`, `current_growth_phase`, `is_archived`, `created_at`, `updated_at` |
| `tree_condition_reports` | `id`, `farm_id`, `tree_id`, `reported_by`, `condition_status`, `note`, `reported_at` |
| `operational_reports` | `id`, `farm_id`, `reported_by`, `category`, `location_note`, `description`, `status`, `created_at`, `updated_at` |
| `care_sops` | `id`, `farm_id`, `name`, `category`, `interval_days`, `default_instruction`, `default_target_type`, `default_target_row`, `default_target_column`, `default_target_tree_id`, `is_active`, `created_by`, `created_at`, `updated_at` |
| `care_schedules` | `id`, `farm_id`, `care_sop_id`, `title`, `category`, `scheduled_date`, `target_type`, `target_row`, `target_column`, `target_tree_id`, `custom_target_note`, `instruction`, `created_by`, `created_at`, `updated_at` |
| `care_tasks` | `id`, `farm_id`, `care_schedule_id`, `operational_report_id`, `assigned_to`, `assigned_by`, `title`, `category`, `instruction`, `target_type`, `target_row`, `target_column`, `target_tree_id`, `custom_target_note`, `due_date`, `status`, `created_at`, `updated_at` |
| `care_activities` | `id`, `farm_id`, `care_task_id`, `performed_by`, `status`, `note`, `performed_at` |
| `growth_phase_records` | `id`, `farm_id`, `tree_id`, `recorded_by`, `phase`, `note`, `recorded_at` |
| `tree_history_view` | `tree_id`, `farm_id`, `history_type`, `title`, `description`, `actor_id`, `happened_at` |

## 5.3 Relasi

| Relasi | Kardinalitas |
| --- | --- |
| `profiles.id` ke `farm_members.user_id` | 1..N |
| `farms.id` ke `farm_members.farm_id` | 1..N |
| `farms.id` ke `trees.farm_id` | 1..N |
| `trees.id` ke `tree_condition_reports.tree_id` | 1..N |
| `farms.id` ke `operational_reports.farm_id` | 1..N |
| `farms.id` ke `care_sops.farm_id` | 1..N |
| `care_sops.id` ke `care_schedules.care_sop_id` | 1..N, nullable untuk jadwal manual |
| `care_schedules.id` ke `care_tasks.care_schedule_id` | 1..N |
| `operational_reports.id` ke `care_tasks.operational_report_id` | 0..N |
| `care_tasks.id` ke `care_activities.care_task_id` | 0..N |
| `trees.id` ke `growth_phase_records.tree_id` | 1..N |
| `care_tasks.target_tree_id` ke `trees.id` | nullable, untuk riwayat care pada pohon tertentu |

## 5.4 Constraint Penting

| Tabel | Constraint |
| --- | --- |
| `profiles` | `id` PK dan FK ke `auth.users.id` |
| `farms` | `join_code` unique not null; `area_size` null atau lebih dari 0 |
| `farm_members` | unique `farm_id, user_id`; owner pembuat kebun harus `role = owner`, `status = active` |
| `trees` | unique `farm_id, tree_code`; tidak ada permanent delete; archive memakai `is_archived` |
| `care_sops` | `interval_days` null atau lebih dari 0; `default_target_type` hanya `farm`, `row`, `column`, `tree`; tidak menerima `custom` |
| `care_schedules` | target harus konsisten dengan `target_type`; `custom` hanya jika `care_sop_id` null dan `custom_target_note` terisi |
| `care_tasks` | minimal sumber tugas dari `care_schedule_id` atau `operational_report_id`; target harus konsisten; `custom_target_note` wajib jika `target_type = custom` |
| `care_activities` | satu task dapat memiliki banyak activity |
| `tree_condition_reports` | insert laporan menyinkronkan `trees.current_condition` |
| `growth_phase_records` | insert fase menyinkronkan `trees.current_growth_phase` |

## 5.5 Index Penting

| Tabel | Index |
| --- | --- |
| `farm_members` | `(farm_id, user_id)`, `(farm_id, status)` |
| `trees` | `(farm_id)`, `(farm_id, is_archived)`, `(farm_id, current_condition)`, `(farm_id, current_growth_phase)` |
| `tree_condition_reports` | `(tree_id, reported_at desc)` |
| `operational_reports` | `(farm_id, status)` |
| `care_sops` | `(farm_id, is_active)` |
| `care_schedules` | `(farm_id, scheduled_date)` |
| `care_tasks` | `(assigned_to, due_date)`, `(farm_id, status)` |
| `care_activities` | `(care_task_id)` |
| `growth_phase_records` | `(tree_id, recorded_at desc)` |

---

# 6. Enum Final

| Enum | Nilai |
| --- | --- |
| `member_role` | `owner`, `worker` |
| `member_status` | `pending`, `active`, `rejected`, `removed` |
| `tree_condition_status` | `healthy`, `needs_attention`, `pest_attacked`, `disease_indicated`, `damaged`, `dead` |
| `growth_phase` | `initial_planting`, `vegetative`, `flowering`, `fruiting`, `harvesting` |
| `operational_report_category` | `land_damage`, `broken_tool`, `out_of_stock`, `area_pest_disease`, `disaster_weather`, `worker_need`, `other` |
| `operational_report_status` | `new`, `in_progress`, `resolved`, `rejected` |
| `care_category` | `watering`, `fertilizing`, `spraying`, `weeding`, `other` |
| `target_type` | `farm`, `row`, `column`, `tree`, `custom` |
| `task_status` | `pending`, `completed`, `postponed` |
| `activity_status` | `completed`, `postponed` |

Catatan penting: `target_type.custom` tetap ada karena dipakai untuk jadwal/task manual jika schema mendukung. Namun `care_sops.default_target_type` tidak boleh memakai `custom`.

---

# 7. RLS Policy yang Dibutuhkan

## 7.1 Helper RLS

1. `is_active_farm_member(p_farm_id, p_user_id)`
2. `is_active_owner(p_farm_id, p_user_id)`
3. `is_active_worker(p_farm_id, p_user_id)`
4. `can_view_profile(p_profile_id, p_user_id)`

## 7.2 Prinsip RLS

1. User hanya bisa melihat data dari farm tempat dia menjadi member active.
2. Owner active dapat mengelola data kebun miliknya.
3. Worker active hanya dapat mengakses fitur operasional yang diizinkan.
4. Worker pending, rejected, dan removed tidak boleh mengakses data operasional.
5. Data antar farm tidak boleh saling terlihat.
6. Owner active dapat melihat profil dasar member dalam farm miliknya untuk status `pending`, `active`, `rejected`, dan `removed`.
7. Worker hanya dapat melihat profil dirinya sendiri dan tidak dapat melihat profil user lain di luar dirinya.
8. Implementasi database yang direkomendasikan untuk kebutuhan daftar member adalah RPC atau view aman, bukan membuka tabel `profiles` secara bebas.

## 7.3 Profile Visibility Final

Aturan final akses profil:

1. Owner active dapat melihat profil dasar member dalam farm miliknya untuk status `pending`, `active`, `rejected`, dan `removed`.
2. Akses ini digunakan untuk Worker Management, `getPendingWorkers`, `getActiveWorkers`, dan jika dibutuhkan daftar rejected/removed.
3. Data profil yang boleh ditampilkan hanya data dasar yang relevan:
   - `user_id`
   - `full_name`
   - `phone`
4. Worker hanya dapat melihat profil dirinya sendiri.
5. Worker tidak dapat melihat profil user lain di luar dirinya.
6. Implementasi database yang direkomendasikan adalah RPC atau view aman, bukan membuka tabel `profiles` secara bebas.
7. `getPendingWorkers` harus bisa mengambil `fullName` dan `phone` worker pending.
8. `getActiveWorkers` harus bisa mengambil `fullName` dan `phone` worker active.
9. Untuk schedule/task picker, hanya worker active yang boleh dipilih.
10. Worker pending, rejected, dan removed tetap tidak boleh mengakses data operasional kebun.

## 7.4 Policy per Tabel

| Tabel | Policy yang dibutuhkan |
| --- | --- |
| `profiles` | User melihat profil sendiri; worker tidak melihat profil user lain; kebutuhan owner melihat profil dasar member farm untuk status pending/active/rejected/removed direkomendasikan lewat RPC atau view aman yang hanya mengekspos `user_id`, `full_name`, dan `phone`; user update profil sendiri |
| `farms` | Active member select farm; active owner update farm; insert disarankan lewat RPC `create_farm_with_owner` |
| `farm_members` | Active member select member farm; active owner update farm member; join/approve/reject/remove lewat RPC |
| `trees` | Active member select trees; active owner insert/update trees; archive/unarchive lewat update `is_archived` |
| `tree_condition_reports` | Active member select; active member insert dengan `reported_by = auth.uid()` |
| `operational_reports` | Active member select; active worker insert dengan `reported_by = auth.uid()`; active owner update status |
| `care_sops` | Active member select; active owner insert/update dengan `created_by = auth.uid()` |
| `care_schedules` | Active member select; active owner insert/update dengan `created_by = auth.uid()` |
| `care_tasks` | Owner melihat semua task farm; worker hanya melihat task miliknya; owner insert task; owner update task farm; worker update task miliknya secara terbatas atau lewat RPC |
| `care_activities` | Owner melihat activity farm; worker melihat activity miliknya; worker insert activity untuk task miliknya |
| `growth_phase_records` | Active member select; active member insert dengan `recorded_by = auth.uid()` |

---

# 8. RPC dan Function yang Dibutuhkan

## 8.1 Function Database dan Trigger

| Function | Fungsi |
| --- | --- |
| `set_updated_at()` | Mengisi `updated_at` saat row di-update |
| `sync_tree_current_condition()` | Update `trees.current_condition` setelah insert laporan kondisi |
| `sync_tree_current_growth_phase()` | Update `trees.current_growth_phase` setelah insert fase |
| `sync_task_status_from_activity()` | Update `care_tasks.status` setelah insert activity |
| `generate_join_code()` | Membuat join code farm yang unik |

## 8.2 RPC Membership

| RPC | Fungsi |
| --- | --- |
| `create_farm_with_owner(p_name, p_location, p_area_size)` | Membuat farm sekaligus owner membership active |
| `request_join_farm(p_join_code)` | Worker request join dan menjadi pending |
| `approve_worker(p_farm_member_id)` | Owner approve worker pending |
| `reject_worker(p_farm_member_id)` | Owner reject worker pending |
| `remove_worker(p_farm_member_id)` | Owner mengubah worker active menjadi removed |

## 8.3 RPC Operasi Transaksional yang Disarankan

Operasi berikut sebaiknya memakai RPC agar validasi role dan transaksi lebih aman:

1. `create_schedule_from_sop`
2. `create_manual_schedule`
3. `create_task_from_operational_report`
4. `complete_task`
5. `postpone_task`

## 8.4 View

| View | Fungsi |
| --- | --- |
| `tree_history_view` | Menggabungkan riwayat kondisi, fase, dan aktivitas perawatan yang targetnya pohon |

---

# 9. Service Layer Final

Service layer wajib menjadi penghubung antara screen dan Supabase. Komponen UI tidak boleh langsung menaruh logic bisnis kompleks.

| Service | Fungsi utama |
| --- | --- |
| `authService` | `registerUser`, `loginUser`, `logoutUser`, `getCurrentProfile` |
| `farmService` | `createFarm`, `getCurrentUserFarm`, `getFarmDetail` |
| `memberService` | `requestJoinFarm`, `getPendingWorkers`, `getActiveWorkers`, `approveWorker`, `rejectWorker`, `removeWorker` |
| `treeService` | `getTrees`, `getTreeDetail`, `createTree`, `updateTree`, `archiveTree`, `restoreTree` |
| `conditionReportService` | `createTreeConditionReport`, `getTreeConditionReports` |
| `operationalReportService` | `createOperationalReport`, `getOperationalReports`, `getOperationalReportDetail`, `updateOperationalReportStatus` |
| `careSopService` | `getCareSOPs`, `getCareSOPDetail`, `createCareSOP`, `updateCareSOP`, `setCareSOPActiveStatus`, `getCareSOPNextScheduleReference` |
| `careScheduleService` | `createScheduleFromSOP`, `createManualSchedule`, `getCareSchedules`, `getCareScheduleDetail` |
| `careTaskService` | `getWorkerTasks`, `getFarmTasks`, `getTaskDetail`, `completeTask`, `postponeTask`, `createTaskFromOperationalReport` |
| `growthPhaseService` | `createGrowthPhaseRecord`, `getGrowthPhaseRecords`, `getFloweringAndFruitingTrees` |
| `historyService` | `getTreeHistory` dari `tree_history_view` |
| `dashboardService` | `getOwnerDashboardSummary`, `getWorkerDashboardSummary` |

Service yang sebaiknya memakai RPC: `createFarm`, `requestJoinFarm`, `approveWorker`, `rejectWorker`, `removeWorker`, `createScheduleFromSOP`, `createManualSchedule`, `createTaskFromOperationalReport`, `completeTask`, `postponeTask`.

Service yang bisa query langsung: profile, current farm, list/detail trees, condition reports, operational reports, SOP, schedules, tasks, growth phase records, tree history, dan dashboard agregasi.

Catatan final untuk `memberService`:

1. `getPendingWorkers` harus bisa mengambil `fullName` dan `phone` worker pending melalui RPC atau view aman.
2. `getActiveWorkers` harus bisa mengambil `fullName` dan `phone` worker active melalui RPC atau view aman.
3. Worker Management boleh memakai data dasar member dengan status `pending`, `active`, `rejected`, dan `removed` jika dibutuhkan.
4. Schedule/task picker hanya boleh memakai worker dengan status `active`.
5. Worker pending, rejected, dan removed tetap tidak boleh mengakses data operasional kebun.

---

# 10. Screen Inventory Final Berdasarkan Role

## 10.1 Public/Auth

1. Get Started
2. Login
3. Register

## 10.2 Onboarding dan Access State

1. Onboarding Decision
2. Create Farm
3. Join Farm
4. Pending Approval
5. Rejected
6. Removed Access

## 10.3 Owner

1. Owner Dashboard
2. Owner Tree List
3. Create Tree
4. Edit Tree
5. Tree Detail
6. Create Condition Report
7. Create Growth Phase Record
8. Growth Monitoring
9. Worker Management
10. Operational Report List
11. Operational Report Detail
12. Create Task From Operational Report
13. Care SOP List
14. Care SOP Detail
15. Create Care SOP
16. Edit Care SOP
17. Care Schedule List
18. Care Schedule Detail
19. Create Schedule From SOP
20. Create Manual Schedule
21. Owner Task List
22. Owner Task Detail
23. Profile
24. Edit Profile

## 10.4 Worker

1. Worker Dashboard
2. Worker Task List
3. Worker Task Detail
4. Worker Tree List
5. Worker Tree Detail
6. Worker Create Condition Report
7. Worker Create Growth Phase
8. Worker Create Operational Report
9. Worker Operational Report List
10. Profile
11. Edit Profile

## 10.5 Screen yang Tidak Dibuat

Tidak dibuat screen untuk prediksi panen, estimasi panen otomatis, ML dashboard, push notification settings, IoT dashboard, weather dashboard, chat, financial report, PDF generator, integrated farming, livestock, marketplace, fruit grading, farmer group, dan supply chain.

---

# 11. Struktur Folder React Native Expo yang Disarankan

Struktur ini mengikuti screen inventory, navigation role, dan service layer source-of-truth. Nama folder dapat disesuaikan dengan pola Expo Router yang dipakai saat implementasi.

```txt
src/
  app/
    (auth)/
      get-started.tsx
      login.tsx
      register.tsx
    (onboarding)/
      index.tsx
      create-farm.tsx
      join-farm.tsx
      pending-approval.tsx
      rejected.tsx
      removed-access.tsx
    (owner)/
      dashboard.tsx
      trees/
      workers/
      reports/
      sops/
      schedules/
      tasks/
      profile.tsx
    (worker)/
      dashboard.tsx
      tasks/
      trees/
      reports/
      profile.tsx
  components/
    layout/
    data-display/
    forms/
    feedback/
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
    historyService.ts
    dashboardService.ts
  lib/
    supabase.ts
  types/
    database.ts
    domain.ts
  utils/
    date.ts
    target.ts
    errors.ts
  hooks/
    useAuthGuard.ts
    useCurrentFarm.ts
```

Komponen reusable yang disarankan:

1. Layout: `AppScreen`, `ScreenHeader`, `BottomTabs`.
2. Feedback: `EmptyState`, `LoadingState`, `ErrorState`.
3. Data display: `TreeCard`, `TaskCard`, `ReportCard`, `SOPCard`, `WorkerCard`, `DashboardStatCard`, `HistoryTimelineItem`, `StatusBadge`.
4. Form: `TextField`, `SelectField`, `DatePickerField`, `TargetPicker`, `WorkerPicker`, `TreePicker`, `SubmitButton`, `ConfirmDialog`.

---

# 12. Roadmap Implementasi Iteration 0 sampai Iteration 7

| Iterasi | Fokus | Output utama | SP |
| --- | --- | --- | ---: |
| Iteration 0 | Project Foundation | Project, Supabase, schema awal, RLS dasar, service skeleton, navigation skeleton, komponen dasar | 13 |
| Iteration 1 | Auth, Kebun, Keanggotaan Worker | Register/login/logout, create farm, join farm, approve/reject/remove, rejected/removed screen, profile | 24 |
| Iteration 2 | Manajemen Pohon dan Laporan Kondisi | CRUD pohon terbatas owner, archive/unarchive, tree list/detail, condition report, riwayat kondisi | 23 |
| Iteration 3 | SOP Perawatan dan Acuan Jadwal Berikutnya | SOP CRUD, active/inactive, acuan jadwal berikutnya, create schedule from SOP | 23 |
| Iteration 4 | Jadwal Manual dan Realisasi Tugas | Manual schedule, task list/detail, complete task, postpone task, activity history | 19 |
| Iteration 5 | Laporan Operasional dan Tindak Lanjut | Worker create operational report, owner list/detail/status, create task from report | 13 |
| Iteration 6 | Fase Pertumbuhan dan Riwayat Pohon | Create growth phase, monitoring flowering/fruiting, tree history integrated | 16 |
| Iteration 7 | Dashboard, Role Guard, Final Polish | Owner dashboard, worker dashboard, final role guard, loading/empty/error state, MVP testing prep | 19 |

Total MVP: 150 story point, terdiri dari 137 story point user story utama dan 13 story point foundation.

---

# 13. Urutan Implementasi Database Supabase

Urutan ini mengikuti SQL schema draft, tetapi dokumen ini tidak membuat migration SQL.

1. Extension `pgcrypto`.
2. Enum types.
3. Function `set_updated_at`.
4. Tabel `profiles`.
5. Tabel `farms`.
6. Tabel `farm_members`.
7. Tabel `trees`.
8. Tabel `tree_condition_reports`.
9. Tabel `operational_reports`.
10. Tabel `care_sops`.
11. Tabel `care_schedules`.
12. Tabel `care_tasks`.
13. Tabel `care_activities`.
14. Tabel `growth_phase_records`.
15. Trigger sinkronisasi: condition, growth phase, task status.
16. Function join code dan membership.
17. View `tree_history_view`.
18. Index.
19. Helper function RLS, termasuk `can_view_profile`.
20. Enable RLS.
21. Policies.

Validasi setelah database dibuat:

1. Owner bisa membuat farm dan otomatis menjadi owner active.
2. Worker bisa request join dan menjadi pending.
3. Owner bisa approve/reject/remove worker.
4. Worker rejected/removed tidak bisa membaca data operasional.
5. Tree code unique per farm.
6. Insert condition report mengubah `trees.current_condition`.
7. Insert growth phase mengubah `trees.current_growth_phase`.
8. Insert care activity mengubah `care_tasks.status`.
9. Custom target ditolak pada SOP default target.
10. Custom target diterima hanya pada jadwal/task manual sesuai constraint.
11. Owner active dapat mengambil `user_id`, `full_name`, dan `phone` member farm berstatus pending/active/rejected/removed melalui RPC atau view aman.
12. Worker hanya dapat mengambil profil dirinya sendiri.
13. Worker pending/rejected/removed tetap tidak dapat membaca data operasional kebun.
14. Schedule/task picker hanya mengembalikan worker active.

---

# 14. Risiko Implementasi yang Perlu Dijaga

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Scope melebar | MVP tidak selesai | Selalu cek MVP Scope dan Decision Log sebelum menambah fitur |
| Overclaim panen | Klaim sistem tidak sesuai keputusan | Jangan buat prediksi/estimasi panen; gunakan istilah monitoring fase |
| RLS terlalu longgar | Data antar farm bocor | Test akses per role, status, dan farm |
| RLS terlalu ketat | User sah tidak bisa memakai fitur | Test owner active dan worker active di setiap tabel |
| Worker removed masih bisa akses | Pelanggaran decision log dan security | Auth guard dan RLS wajib membaca `farm_members.status` |
| Permanent delete pohon | Riwayat pohon rusak | Gunakan `is_archived` dan fitur archive/unarchive |
| Custom target salah tempat | SOP menjadi tidak sesuai decision log | Validasi form dan constraint: SOP tidak boleh custom |
| Jadwal/task tidak sinkron | Schedule terbentuk tetapi task gagal | Gunakan RPC untuk operasi yang membuat schedule dan task |
| Activity task menimpa histori | Riwayat tunda/selesai hilang | Satu task boleh punya banyak `care_activities` |
| Dashboard lambat | UX buruk | Gunakan index dan query agregasi terkontrol |
| Worker flow terlalu kompleks | Worker sulit memakai aplikasi di lapangan | Form minim teks, kategori jelas, shortcut utama |
| Laporan kondisi bercampur laporan operasional | Riwayat dan tindak lanjut membingungkan | Tetap pisahkan `tree_condition_reports` dan `operational_reports` |
| Growth phase dianggap prediksi | Salah pemahaman fitur | Label screen sebagai Growth Monitoring, bukan Prediksi Panen |
| Backend custom muncul di tengah jalan | Scope dan arsitektur melebar | Tetap gunakan Supabase, service layer, RLS, RPC, trigger, view |
| Push notification/IoT masuk MVP | Scope melebar | Masukkan sebagai pengembangan lanjutan, bukan MVP |

---

# 15. Kesimpulan Implementasi

Implementasi Avology V2 harus bergerak dari pondasi database dan auth, lalu membership, pohon, kondisi, SOP, jadwal, tugas, laporan operasional, fase pertumbuhan, riwayat, dan dashboard. Semua fitur harus tetap berada dalam scope sistem informasi operasional kebun alpukat.

Keputusan final yang paling penting untuk dijaga adalah: tidak ada prediksi atau estimasi panen otomatis, growth phase adalah monitoring critical MVP, pohon tidak dihapus permanen, worker removed tidak dihapus, SOP default target tidak memakai custom, laporan operasional masuk Iteration 5, dan tidak ada backend custom, push notification, maupun IoT pada MVP.
