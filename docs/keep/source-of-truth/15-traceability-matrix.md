# Traceability Matrix Avology V2

> **Catatan perubahan (migrasi 046 & 047).** Baris keterlacakan untuk **FR-13**
> (SOP Perawatan) dan **FR-14** (Jadwal Perawatan dari SOP) dihapus, begitu juga
> modul "SOP Perawatan" dan test case `TC-SOP-*`. Modul jadwal digabung dan
> dinomori ulang. Masalah lapangan **P-02** tetap dipertahankan apa adanya:
> itu temuan wawancara tentang praktik kerja di kebun, bukan spesifikasi fitur —
> kebutuhannya kini dijawab FR-15/FR-16/FR-17. Riwayat keputusannya ada di
> `decision-log.md`.

> **Catatan perubahan (migrasi 048–052).** Baris keterlacakan FR-15, FR-17,
> FR-20, dan FR-21 diperluas mengikuti test case baru, dan satu baris FR-06
> ditambahkan karena pelepasan tugas menghubungkan manajemen pekerja dengan
> `care_tasks`. Kolom Database pada baris FR-21 kini menyebut
> `care_activity_trees`. Tidak ada FR, US, atau UC yang berubah nomor. Riwayat
> keputusannya ada di `decision-log.md` (DL-034 sampai DL-038).

## 1. Tujuan Traceability Matrix

Traceability matrix digunakan untuk menelusuri keterkaitan antara masalah lapangan, kebutuhan sistem, user story, use case, screen aplikasi, struktur database, dan skenario pengujian.

Dokumen ini disusun agar setiap fitur dalam Avology V2 memiliki dasar yang jelas dari hasil wawancara dengan pemilik kebun alpukat MS Farm.

Dengan traceability matrix, pengembangan aplikasi dapat tetap sesuai dengan scope MVP dan tidak melenceng ke fitur yang tidak memiliki dasar kebutuhan.

---

# 2. Sumber Masalah dari Wawancara

Berdasarkan wawancara dengan pemilik kebun MS Farm, ditemukan beberapa masalah utama:

| Kode Masalah | Masalah Lapangan                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| P-01         | Belum ada pencatatan treatment kebun secara terstruktur                                                           |
| P-02         | SOP perawatan seperti semprot, pupuk, siram, dan gulma berisiko tidak disiplin                                    |
| P-03         | Riwayat obat atau treatment yang efektif sering terlupakan                                                        |
| P-04         | Setiap pohon memiliki kondisi dan perkembangan berbeda                                                            |
| P-05         | Pohon dapat terkena hama, penyakit, rusak, atau mati jika tidak dipantau                                          |
| P-06         | Pemilik tidak selalu berada di kebun sehingga butuh monitoring jarak jauh                                         |
| P-07         | Pekerja membutuhkan aplikasi yang sederhana, minim teks, dan berbasis klik                                        |
| P-08         | Tanggal berbunga dan fase berbuah tidak tercatat sehingga panen masih bergantung pada perkiraan fisik             |
| P-09         | Kejadian operasional kebun seperti kerusakan lahan, alat rusak, stok habis, atau kebutuhan pekerja belum tercatat |
| P-10         | Owner perlu mengelola pekerja yang memiliki akses ke data kebun                                                   |
| P-11         | Owner membutuhkan dashboard ringkas untuk mengambil keputusan cepat                                               |
| P-12         | Data riwayat kondisi, fase, dan perawatan pohon perlu ditelusuri kembali                                          |

---

# 3. Traceability Matrix Utama

| Masalah          | Kebutuhan Fungsional                                   | User Story                        | Use Case                          | Screen                                                                               | Database                                                                              | Black-box Testing              |
| ---------------- | ------------------------------------------------------ | --------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------ |
| P-01, P-02       | FR-17 Acuan Jadwal Berikutnya Berdasarkan Interval Pengulangan | US-24 | UC-19 | Care Schedule List, Care Schedule Detail, Owner Dashboard | care_schedules, care_tasks, care_activities | TC-SCH-05 sampai TC-SCH-08 |
| P-01, P-02       | FR-15 Jadwal Perawatan Manual                          | US-26                             | UC-21                             | Create Manual Schedule, Care Schedule Detail                                          | care_schedules, care_tasks, care_activities                                            | TC-SCH-01 sampai TC-SCH-02, TC-SCH-09 sampai TC-SCH-10 |
| P-01, P-03       | FR-20 Realisasi Tugas Worker                           | US-30, US-31                      | UC-24, UC-25                      | Worker Task Detail                                                                   | care_tasks, care_activities                                                           | TC-TASK-01 sampai TC-TASK-08   |
| P-01, P-03, P-12 | FR-21 Riwayat Perawatan                                | US-36                             | UC-28                             | Tree Detail, Tree History Section                                                    | care_activities, care_activity_trees, care_tasks, tree_history_view                    | TC-HIS-01 sampai TC-HIS-05     |
| P-08             | FR-06 Manajemen Pekerja                                | US-09                             | UC-09                             | Worker Management, Care Schedule Detail                                              | farm_members, care_tasks                                                              | TC-MEM-07, TC-MEM-10 sampai TC-MEM-11 |
| P-04             | FR-07 Manajemen Data Pohon                             | US-10, US-11, US-12               | UC-10                             | Owner Tree List, Create Tree, Edit Tree, Tree Detail                                 | trees                                                                                 | TC-TREE-01 sampai TC-TREE-05   |
| P-04             | FR-08 Identifikasi Pohon Individual                    | US-10, US-13                      | UC-10, UC-11                      | Owner Tree List, Worker Tree List, Tree Detail                                       | trees                                                                                 | TC-TREE-06 sampai TC-TREE-08   |
| P-05             | FR-09 Laporan Kondisi Pohon                            | US-14, US-15                      | UC-12                             | Create Condition Report                                                              | tree_condition_reports, trees                                                         | TC-COND-01 sampai TC-COND-04   |
| P-05, P-12       | FR-10 Riwayat Kondisi Pohon                            | US-16                             | UC-13                             | Tree Detail, Tree History Section                                                    | tree_condition_reports, tree_history_view                                             | TC-COND-05 sampai TC-COND-06   |
| P-06, P-09       | FR-11 Laporan Operasional Kebun                        | US-17, US-18                      | UC-14, UC-15                      | Worker Create Operational Report, Operational Report List, Operational Report Detail | operational_reports                                                                   | TC-OPR-01 sampai TC-OPR-04     |
| P-06, P-09       | FR-12 Tindak Lanjut Laporan Operasional                | US-19, US-20                      | UC-16, UC-17                      | Operational Report Detail, Create Task From Operational Report                       | operational_reports, care_tasks                                                       | TC-OPR-05 sampai TC-OPR-08     |
| P-07             | NFR-01 Kemudahan Penggunaan                            | US-38, US-40                      | UC-30                             | Worker Dashboard, Worker Task List, Worker Report Form                               | Seluruh tabel operasional worker                                                      | TC-UX-01 sampai TC-UX-03       |
| P-07             | NFR-02 Input Minim Teks                                | US-14, US-17, US-30, US-31, US-32 | UC-12, UC-14, UC-24, UC-25, UC-26 | Form Kondisi, Form Laporan Operasional, Task Detail, Form Fase                       | tree_condition_reports, operational_reports, care_activities, growth_phase_records    | TC-UX-04 sampai TC-UX-07       |
| P-08             | FR-22 Fase Pertumbuhan Pohon                           | US-32, US-33                      | UC-26                             | Create Growth Phase Record                                                           | growth_phase_records, trees                                                           | TC-PHASE-01 sampai TC-PHASE-04 |
| P-08             | FR-23 Riwayat Fase Pertumbuhan                         | US-34, US-35                      | UC-27                             | Tree Detail, Growth Monitoring                                                       | growth_phase_records, trees                                                           | TC-PHASE-05 sampai TC-PHASE-08 |
| P-10             | FR-04 Kode Bergabung Kebun                             | US-05, US-06                      | UC-05, UC-06                      | Join Farm, Farm Detail                                                               | farms, farm_members                                                                   | TC-MEM-01 sampai TC-MEM-03     |
| P-10             | FR-05 Persetujuan Worker                               | US-07, US-08                      | UC-07, UC-08                      | Worker Management                                                                    | farm_members                                                                          | TC-MEM-04 sampai TC-MEM-06     |
| P-10             | FR-06 Manajemen Pekerja                                | US-09                             | UC-09                             | Worker Management                                                                    | farm_members                                                                          | TC-MEM-07 sampai TC-MEM-09     |
| P-11             | FR-25 Dashboard Owner                                  | US-37                             | UC-29                             | Owner Dashboard                                                                      | trees, care_tasks, operational_reports, farm_members, growth_phase_records | TC-DASH-01 sampai TC-DASH-08   |
| P-07, P-11       | FR-26 Dashboard Worker                                 | US-38                             | UC-30                             | Worker Dashboard                                                                     | care_tasks                                                                            | TC-DASH-09 sampai TC-DASH-11   |
| P-06, P-10       | FR-27 Pembatasan Fitur Berdasarkan Role                | US-39, US-40                      | UC-29, UC-30                      | Owner Area, Worker Area, Guard Screen                                                | farm_members, RLS policies                                                            | TC-ROLE-01 sampai TC-ROLE-06   |
| P-06, P-10       | FR-01 Autentikasi Pengguna                             | US-01, US-02, US-03               | UC-01, UC-02, UC-03               | Register, Login, Profile                                                             | auth.users, profiles                                                                  | TC-AUTH-01 sampai TC-AUTH-06   |
| P-06, P-10       | FR-02 Role Pengguna                                    | US-02, US-39, US-40               | UC-02, UC-29, UC-30               | Owner Navigation, Worker Navigation                                                  | farm_members                                                                          | TC-ROLE-01 sampai TC-ROLE-06   |
| P-06, P-10       | FR-03 Manajemen Kebun                                  | US-04                             | UC-04                             | Create Farm, Farm Detail                                                             | farms, farm_members                                                                   | TC-FARM-01 sampai TC-FARM-04   |

---

# 4. Traceability Berdasarkan Modul

## 4.1 Modul Auth dan Onboarding

| Item        | Detail                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------- |
| Masalah     | Owner dan worker membutuhkan akses berbeda ke sistem                                        |
| Requirement | FR-01, FR-02, FR-03, FR-04, FR-05                                                           |
| User Story  | US-01 sampai US-08                                                                          |
| Use Case    | UC-01 sampai UC-08                                                                          |
| Screen      | Get Started, Register, Login, Onboarding Decision, Create Farm, Join Farm, Pending Approval |
| Service     | registerUser, loginUser, logoutUser, createFarm, requestJoinFarm                            |
| Database    | auth.users, profiles, farms, farm_members                                                   |
| Testing     | TC-AUTH, TC-FARM, TC-MEM                                                                    |

---

## 4.2 Modul Manajemen Worker

| Item        | Detail                                                                         |
| ----------- | ------------------------------------------------------------------------------ |
| Masalah     | Owner perlu mengelola pekerja yang memiliki akses ke kebun                     |
| Requirement | FR-05, FR-06                                                                   |
| User Story  | US-07, US-08, US-09                                                            |
| Use Case    | UC-07, UC-08, UC-09                                                            |
| Screen      | Worker Management                                                              |
| Service     | getPendingWorkers, getActiveWorkers, approveWorker, rejectWorker, removeWorker |
| Database    | farm_members, profiles                                                         |
| Testing     | TC-MEM-04 sampai TC-MEM-09                                                     |

---

## 4.3 Modul Manajemen Pohon

| Item        | Detail                                                                    |
| ----------- | ------------------------------------------------------------------------- |
| Masalah     | Setiap pohon memiliki kondisi dan perkembangan berbeda                    |
| Requirement | FR-07, FR-08                                                              |
| User Story  | US-10, US-11, US-12, US-13                                                |
| Use Case    | UC-10, UC-11                                                              |
| Screen      | Owner Tree List, Worker Tree List, Tree Detail, Create Tree, Edit Tree    |
| Service     | getTrees, getTreeDetail, createTree, updateTree, archiveTree, restoreTree |
| Database    | trees                                                                     |
| Testing     | TC-TREE-01 sampai TC-TREE-08                                              |

---

## 4.4 Modul Laporan Kondisi Pohon

| Item        | Detail                                                                  |
| ----------- | ----------------------------------------------------------------------- |
| Masalah     | Pohon dapat sakit, terserang hama, rusak, atau mati jika tidak dipantau |
| Requirement | FR-09, FR-10                                                            |
| User Story  | US-14, US-15, US-16                                                     |
| Use Case    | UC-12, UC-13                                                            |
| Screen      | Create Condition Report, Tree Detail                                    |
| Service     | createTreeConditionReport, getTreeConditionReports                      |
| Database    | tree_condition_reports, trees                                           |
| Testing     | TC-COND-01 sampai TC-COND-06                                            |

---

## 4.5 Modul Laporan Operasional Kebun

| Item        | Detail                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Masalah     | Kejadian umum kebun seperti kerusakan lahan, alat rusak, stok habis, atau kebutuhan pekerja belum tercatat                                 |
| Requirement | FR-11, FR-12                                                                                                                               |
| User Story  | US-17, US-18, US-19, US-20                                                                                                                 |
| Use Case    | UC-14, UC-15, UC-16, UC-17                                                                                                                 |
| Screen      | Worker Create Operational Report, Operational Report List, Operational Report Detail, Create Task From Operational Report                  |
| Service     | createOperationalReport, getOperationalReports, getOperationalReportDetail, updateOperationalReportStatus, createTaskFromOperationalReport |
| Database    | operational_reports, care_tasks                                                                                                            |
| Testing     | TC-OPR-01 sampai TC-OPR-08                                                                                                                 |

---

## 4.6 Modul Jadwal dan Tugas Worker

| Item        | Detail                                                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Masalah     | Jadwal treatment mundur dan realisasi pekerjaan tidak terdokumentasi                                                                   |
| Requirement | FR-15, FR-16, FR-17, FR-18, FR-19, FR-20, FR-21                                                                                        |
| User Story  | US-24, US-26 sampai US-31                                                                                                              |
| Use Case    | UC-19, UC-21 sampai UC-25                                                                                                              |
| Screen      | Create Manual Schedule, Care Schedule List, Care Schedule Detail, Worker Task List, Worker Task Detail, Owner Task List                |
| Service     | createManualSchedule, getCareSchedules, getCareScheduleDetail, getWorkerTasks, getFarmTasks, getTaskDetail, completeTask, postponeTask |
| Database    | care_schedules, care_tasks, care_activities                                                                                            |
| Testing     | TC-SCH, TC-TASK                                                                                                                        |

---

## 4.7 Modul Fase Pertumbuhan

| Item        | Detail                                                                                                |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| Masalah     | Tanggal berbunga dan fase berbuah tidak tercatat sehingga panen masih bergantung pada perkiraan fisik |
| Requirement | FR-22, FR-23                                                                                          |
| User Story  | US-32, US-33, US-34, US-35                                                                            |
| Use Case    | UC-26, UC-27                                                                                          |
| Screen      | Create Growth Phase Record, Tree Detail, Growth Monitoring                                            |
| Service     | createGrowthPhaseRecord, getGrowthPhaseRecords, getFloweringAndFruitingTrees                          |
| Database    | growth_phase_records, trees                                                                           |
| Testing     | TC-PHASE-01 sampai TC-PHASE-08                                                                        |

---

## 4.8 Modul Riwayat Pohon

| Item        | Detail                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------- |
| Masalah     | Riwayat kondisi, treatment, dan fase pohon perlu ditelusuri kembali                          |
| Requirement | FR-24                                                                                        |
| User Story  | US-36                                                                                        |
| Use Case    | UC-28                                                                                        |
| Screen      | Tree Detail, Tree History Section                                                            |
| Service     | getTreeHistory                                                                               |
| Database    | tree_history_view, tree_condition_reports, growth_phase_records, care_tasks, care_activities |
| Testing     | TC-HIS-01 sampai TC-HIS-03                                                                   |

---

## 4.9 Modul Dashboard

| Item        | Detail                                                                                |
| ----------- | ------------------------------------------------------------------------------------- |
| Masalah     | Owner membutuhkan ringkasan kondisi kebun untuk mengambil keputusan cepat             |
| Requirement | FR-25, FR-26                                                                          |
| User Story  | US-37, US-38                                                                          |
| Use Case    | UC-29, UC-30                                                                          |
| Screen      | Owner Dashboard, Worker Dashboard                                                     |
| Service     | getOwnerDashboardSummary, getWorkerDashboardSummary                                   |
| Database    | trees, care_tasks, operational_reports, farm_members, growth_phase_records |
| Testing     | TC-DASH-01 sampai TC-DASH-11                                                          |

---

# 5. Traceability Non-Fungsional

| NFR                                          | Dasar Masalah                  | Dampak ke Desain                                                        | Screen Terkait                       | Testing                      |
| -------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------- | ------------------------------------ | ---------------------------- |
| NFR-01 Kemudahan Penggunaan                  | P-07                           | Alur sederhana, navigasi jelas, halaman worker tidak terlalu kompleks   | Semua screen worker                  | TC-UX-01                     |
| NFR-02 Input Minim Teks                      | P-07                           | Form memakai kategori, tombol, pilihan status, catatan singkat opsional | Form laporan, task detail, form fase | TC-UX-02                     |
| NFR-03 Mobile First                          | Kondisi penggunaan di kebun    | Layout dioptimalkan untuk HP                                            | Semua screen                         | TC-UX-03                     |
| NFR-04 Konsistensi Data dan Satuan           | Kebutuhan data rapi            | Interval memakai hari, status memakai enum, tanggal konsisten           | Form jadwal, tugas | TC-DATA-01                   |
| NFR-05 Keamanan Akses Berdasarkan Role       | P-10                           | Owner dan worker dipisahkan melalui role guard dan RLS                  | Owner Area, Worker Area              | TC-ROLE-01 sampai TC-ROLE-06 |
| NFR-06 Data Terstruktur dan Dapat Ditelusuri | P-12                           | Data kondisi, fase, tugas, dan aktivitas disimpan sebagai riwayat       | Tree Detail, History                 | TC-HIS-01 sampai TC-HIS-03   |
| NFR-07 Dashboard Ringkas                     | P-11                           | Dashboard hanya berisi ringkasan penting                                | Owner Dashboard, Worker Dashboard    | TC-DASH                      |
| NFR-08 Fleksibilitas Jadwal                  | P-02                           | Jadwal dibuat manual dengan opsi pengulangan | Schedule Screen                      | TC-SCH                       |
| NFR-09 Tidak Overclaim Prediksi              | P-08                           | Tidak ada fitur prediksi panen otomatis                                 | Growth Monitoring                    | TC-PHASE-08                  |
| NFR-10 Kesesuaian Lapangan                   | P-07                           | Worker flow cepat dan praktis                                           | Worker Dashboard, Task, Report       | TC-UX                        |
| NFR-11 Maintainability                       | Risiko teknis                  | Service layer modular, komponen reusable                                | Struktur kode                        | Review kode                  |
| NFR-12 Scalability Terbatas                  | Pengembangan lanjutan          | Struktur data tetap memungkinkan modul lanjutan                         | Database schema                      | Review schema                |
| NFR-13 Reliabilitas Data Operasional         | P-12                           | Worker removed, pohon archived, data histori tidak dihapus              | Worker, Tree, History                | TC-DATA-02                   |
| NFR-14 Performa Dasar                        | Dashboard dan list harus cepat | Index database, query per farm                                          | Dashboard, list pohon, list task     | TC-PERF-01                   |
| NFR-15 Konsistensi Antarmuka                 | UX aplikasi                    | Komponen UI reusable                                                    | Semua screen                         | TC-UI-01                     |

---

# 6. Daftar Test Case Berdasarkan Traceability

## 6.1 Auth dan Role

| Test Case  | Skenario                            | Expected Result                     |
| ---------- | ----------------------------------- | ----------------------------------- |
| TC-AUTH-01 | User registrasi dengan data valid   | Akun berhasil dibuat                |
| TC-AUTH-02 | User registrasi dengan email kosong | Sistem menampilkan error            |
| TC-AUTH-03 | User login dengan akun valid        | User masuk ke halaman sesuai status |
| TC-AUTH-04 | User login dengan password salah    | Sistem menampilkan error            |
| TC-AUTH-05 | User logout                         | User keluar dari aplikasi           |
| TC-AUTH-06 | User belum punya kebun login        | User diarahkan ke onboarding        |

---

## 6.2 Farm dan Membership

| Test Case  | Skenario                                   | Expected Result                                 |
| ---------- | ------------------------------------------ | ----------------------------------------------- |
| TC-FARM-01 | Owner membuat kebun valid                  | Kebun berhasil dibuat                           |
| TC-FARM-02 | Owner membuat kebun tanpa nama             | Sistem menampilkan error                        |
| TC-FARM-03 | Sistem membuat join code                   | Join code muncul dan unik                       |
| TC-FARM-04 | Owner otomatis menjadi member owner active | Membership owner tersimpan                      |
| TC-MEM-01  | Worker memasukkan join code valid          | Pengajuan pending dibuat                        |
| TC-MEM-02  | Worker memasukkan join code salah          | Sistem menampilkan error                        |
| TC-MEM-03  | Worker pending login                       | Worker masuk halaman pending                    |
| TC-MEM-04  | Owner approve worker pending               | Status worker menjadi active                    |
| TC-MEM-05  | Owner reject worker pending                | Status worker menjadi rejected                  |
| TC-MEM-06  | Worker rejected login                      | Worker tidak dapat mengakses kebun              |
| TC-MEM-07  | Owner remove worker active                 | Status worker menjadi removed                   |
| TC-MEM-08  | Worker removed login                       | Worker tidak dapat mengakses kebun              |
| TC-MEM-09  | Riwayat worker removed tetap ada           | Tugas/laporan lama tetap tampil sebagai histori |

---

## 6.3 Pohon

| Test Case  | Skenario                                  | Expected Result                 |
| ---------- | ----------------------------------------- | ------------------------------- |
| TC-TREE-01 | Owner menambah pohon valid                | Pohon berhasil tersimpan        |
| TC-TREE-02 | Owner menambah pohon dengan kode kosong   | Sistem menampilkan error        |
| TC-TREE-03 | Owner menambah pohon dengan kode duplikat | Sistem menampilkan error        |
| TC-TREE-04 | Owner mengubah data pohon                 | Data pohon berubah              |
| TC-TREE-05 | Owner mengarsipkan pohon                  | Pohon masuk arsip               |
| TC-TREE-06 | Worker membuka daftar pohon               | Worker dapat melihat pohon      |
| TC-TREE-07 | Worker mencoba edit pohon                 | Akses ditolak                   |
| TC-TREE-08 | User membuka detail pohon                 | Detail dan riwayat pohon tampil |

---

## 6.4 Laporan Kondisi Pohon

| Test Case  | Skenario                             | Expected Result                                |
| ---------- | ------------------------------------ | ---------------------------------------------- |
| TC-COND-01 | Worker membuat laporan kondisi valid | Laporan berhasil tersimpan                     |
| TC-COND-02 | Owner membuat laporan kondisi valid  | Laporan berhasil tersimpan                     |
| TC-COND-03 | Laporan kondisi dibuat               | Kondisi terbaru pohon berubah                  |
| TC-COND-04 | Laporan tanpa kategori kondisi       | Sistem menampilkan error                       |
| TC-COND-05 | User membuka riwayat kondisi         | Riwayat kondisi tampil                         |
| TC-COND-06 | Riwayat kondisi diurutkan waktu      | Riwayat tampil dari terbaru atau sesuai desain |

---

## 6.5 Laporan Operasional Kebun

| Test Case | Skenario                                 | Expected Result                    |
| --------- | ---------------------------------------- | ---------------------------------- |
| TC-OPR-01 | Worker membuat laporan operasional valid | Laporan tersimpan                  |
| TC-OPR-02 | Laporan operasional dibuat               | Status awal menjadi new            |
| TC-OPR-03 | Owner melihat daftar laporan             | Daftar laporan tampil              |
| TC-OPR-04 | Owner membuka detail laporan             | Detail laporan tampil              |
| TC-OPR-05 | Owner mengubah status laporan            | Status laporan berubah             |
| TC-OPR-06 | Owner membuat tugas dari laporan         | Tugas berhasil dibuat              |
| TC-OPR-07 | Tugas dibuat dari laporan                | Status laporan menjadi in_progress |
| TC-OPR-08 | Worker melihat tugas tindak lanjut       | Tugas muncul di daftar worker      |

---

## 6.6 Jadwal Perawatan

| Test Case | Skenario                           | Expected Result                      |
| --------- | ---------------------------------- | ------------------------------------ |
| TC-SCH-01 | Owner membuat jadwal manual        | Jadwal manual berhasil dibuat        |
| TC-SCH-02 | Jadwal manual dibuat               | Task worker dibuat                   |
| TC-SCH-03 | Target jadwal tree dipilih         | Task terhubung ke pohon              |
| TC-SCH-04 | Target jadwal custom tanpa catatan | Sistem menampilkan error             |
| TC-SCH-05 | Worker melihat tugas dari jadwal   | Tugas tampil di daftar worker        |

---

## 6.7 Tugas Worker

| Test Case  | Skenario                               | Expected Result                  |
| ---------- | -------------------------------------- | -------------------------------- |
| TC-TASK-01 | Worker membuka daftar tugas            | Tugas miliknya tampil            |
| TC-TASK-02 | Worker membuka detail tugas            | Detail tugas tampil              |
| TC-TASK-03 | Worker menyelesaikan tugas             | Status tugas menjadi completed   |
| TC-TASK-04 | Worker menunda tugas                   | Status tugas menjadi postponed   |
| TC-TASK-05 | Worker menunda tugas dengan catatan    | Catatan tersimpan pada aktivitas |
| TC-TASK-06 | Worker mencoba akses tugas worker lain | Akses ditolak                    |
| TC-TASK-07 | Owner melihat tugas kebun              | Semua tugas kebun tampil         |

---

## 6.8 Fase Pertumbuhan

| Test Case   | Skenario                     | Expected Result                         |
| ----------- | ---------------------------- | --------------------------------------- |
| TC-PHASE-01 | Worker mencatat fase pohon   | Catatan fase tersimpan                  |
| TC-PHASE-02 | Owner mencatat fase pohon    | Catatan fase tersimpan                  |
| TC-PHASE-03 | Fase dicatat                 | Fase terbaru pohon berubah              |
| TC-PHASE-04 | Fase tanpa pilihan           | Sistem menampilkan error                |
| TC-PHASE-05 | User membuka riwayat fase    | Riwayat fase tampil                     |
| TC-PHASE-06 | Pohon fase flowering         | Muncul dalam monitoring berbunga        |
| TC-PHASE-07 | Pohon fase fruiting          | Muncul dalam monitoring berbuah         |
| TC-PHASE-08 | User membuka monitoring fase | Tidak ada klaim prediksi panen otomatis |

---

## 6.9 Riwayat Pohon

| Test Case | Skenario                               | Expected Result                      |
| --------- | -------------------------------------- | ------------------------------------ |
| TC-HIS-01 | Pohon memiliki laporan kondisi         | Riwayat kondisi muncul di timeline   |
| TC-HIS-02 | Pohon memiliki catatan fase            | Riwayat fase muncul di timeline      |
| TC-HIS-03 | Pohon memiliki tugas perawatan selesai | Riwayat perawatan muncul di timeline |

---

## 6.10 Dashboard

| Test Case  | Skenario                       | Expected Result                            |
| ---------- | ------------------------------ | ------------------------------------------ |
| TC-DASH-01 | Owner membuka dashboard        | Ringkasan kebun tampil                     |
| TC-DASH-02 | Ada pohon bermasalah           | Jumlah pohon bermasalah tampil benar       |
| TC-DASH-03 | Ada tugas hari ini             | Jumlah tugas hari ini tampil benar         |
| TC-DASH-04 | Ada tugas pending              | Jumlah tugas belum selesai tampil benar    |
| TC-DASH-05 | Ada laporan operasional baru   | Jumlah laporan baru tampil benar           |
| TC-DASH-06 | Ada worker pending             | Jumlah worker pending tampil benar         |
| TC-DASH-07 | Ada pohon berbunga/berbuah     | Jumlah pohon berbunga/berbuah tampil benar |
| TC-DASH-08 | Ada jadwal overdue | Jumlah jadwal terlambat tampil benar |
| TC-DASH-09 | Worker membuka dashboard       | Ringkasan tugas worker tampil              |
| TC-DASH-10 | Worker memiliki tugas hari ini | Jumlah tugas hari ini tampil benar         |
| TC-DASH-11 | Worker tidak punya tugas       | Empty state tampil                         |

---

## 6.11 Role dan Akses

| Test Case  | Skenario                                        | Expected Result |
| ---------- | ----------------------------------------------- | --------------- |
| TC-ROLE-01 | Owner membuka owner area                        | Akses berhasil  |
| TC-ROLE-02 | Worker membuka owner area                       | Akses ditolak   |
| TC-ROLE-03 | Worker pending membuka worker dashboard         | Akses ditolak   |
| TC-ROLE-04 | Worker active membuka worker dashboard          | Akses berhasil  |
| TC-ROLE-05 | Worker removed membuka data kebun               | Akses ditolak   |
| TC-ROLE-06 | User dari kebun lain membuka data kebun berbeda | Akses ditolak   |

---

## 6.12 UX dan Data

| Test Case  | Skenario                           | Expected Result                                                    |
| ---------- | ---------------------------------- | ------------------------------------------------------------------ |
| TC-UX-01   | Worker membuka dashboard           | Aksi utama terlihat jelas                                          |
| TC-UX-02   | Worker mengisi laporan kondisi     | Input utama menggunakan pilihan kategori                           |
| TC-UX-03   | Aplikasi dibuka di layar mobile    | Layout tampil sesuai mobile                                        |
| TC-UX-04   | Worker membuat laporan operasional | Form singkat dan mudah dipahami                                    |
| TC-UX-05   | Worker menyelesaikan tugas         | Aksi selesai mudah ditemukan                                       |
| TC-UX-06   | Worker menunda tugas               | Catatan alasan dapat diisi singkat                                 |
| TC-UX-07   | Worker mencatat fase               | Pilihan fase mudah dipilih                                         |
| TC-DATA-01 | Sistem menyimpan interval pengulangan jadwal | Interval memakai satuan hari |
| TC-DATA-02 | Data histori user/pohon lama       | Riwayat tetap tersimpan setelah worker removed atau pohon archived |
| TC-PERF-01 | User membuka dashboard             | Data ringkasan tampil dalam waktu wajar                            |
| TC-UI-01   | User berpindah halaman             | Komponen dan style tetap konsisten                                 |

---

# 7. Keputusan Traceability

Berdasarkan traceability matrix, seluruh fitur MVP Avology V2 memiliki dasar dari masalah wawancara, kebutuhan sistem, dan user story.

Fitur yang tidak memiliki dasar langsung dari wawancara atau tidak termasuk MVP tidak dimasukkan ke dalam implementasi awal.

Fitur yang secara eksplisit tidak termasuk MVP:

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

---

# 8. Kesimpulan

Traceability matrix Avology V2 menunjukkan bahwa setiap fitur dalam MVP dapat ditelusuri dari masalah lapangan yang ditemukan melalui wawancara dengan pemilik kebun MS Farm.

Matriks ini menjadi pengendali scope agar pengembangan Avology V2 tetap fokus pada pencatatan, monitoring, jadwal perawatan, tugas worker, laporan operasional, fase pertumbuhan, riwayat pohon, dan dashboard kebun.

Dengan dokumen ini, Avology V2 memiliki dasar pengembangan yang lebih kuat dan dapat dipertanggungjawabkan secara akademik.
