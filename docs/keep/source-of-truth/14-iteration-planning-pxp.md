# Iteration Planning Avology V2

> **Catatan perubahan (migrasi 046 & 047).** Iteration 3 ("SOP Perawatan dan
> Acuan Jadwal Berikutnya", 23 SP) dihapus dan iterasi sesudahnya dinomori ulang
> menjadi Iteration 3–6. US-21, US-22, US-23, dan US-25 dikeluarkan dari backlog.
> Akibatnya total estimasi backlog turun dari 137 SP menjadi **119 SP**, dan
> total rencana iterasi dari 150 SP menjadi **127 SP**. Riwayat keputusannya ada
> di `decision-log.md`.

> **Catatan perubahan (migrasi 048–052).** Iteration 3 diperdalam tanpa
> penambahan user story: rantai jadwal, masa toleransi, penundaan bertanggal,
> penautan pohon, pelepasan tugas, dan pelonggaran penguncian jadwal semuanya
> memperbaiki US yang sudah ada. Daftar service iterasi itu bertambah, tetapi
> **estimasi story point tidak berubah** — backlog tetap 119 SP dan rencana
> iterasi tetap 127 SP. Riwayat keputusannya ada di `decision-log.md` (DL-034
> sampai DL-038).

## 1. Tujuan Iteration Planning

Iteration planning digunakan untuk membagi pengembangan Avology V2 ke dalam beberapa iterasi kerja berdasarkan metode Personal Extreme Programming (PXP).

Setiap iterasi memiliki fokus fitur, user story, prioritas, estimasi story point, output, dan pengujian black-box. Dengan perencanaan ini, pengembangan aplikasi dapat dilakukan secara bertahap dan tetap sesuai dengan kebutuhan sistem yang telah diturunkan dari hasil wawancara pemilik kebun MS Farm.

---

# 2. Dasar Perencanaan Iterasi

Iteration planning Avology V2 disusun berdasarkan dokumen berikut:

1. Problem Statement
2. MVP Scope
3. Kebutuhan Fungsional dan Non-Fungsional
4. User Story
5. Use Case
6. Activity Diagram
7. Data Model dan ERD
8. Logical Database Schema
9. SQL Schema Draft
10. Service Layer Design
11. Screen Inventory dan Navigation Flow

---

# 3. Metode Pengembangan

Metode pengembangan yang digunakan adalah **Personal Extreme Programming (PXP)**.

Tahapan PXP yang digunakan dalam setiap iterasi adalah:

1. Requirements
2. Planning
3. Iteration Initialization
4. Design
5. Implementation
6. System Testing
7. Retrospective

---

# 4. Prioritas NAT

Prioritas user story menggunakan pendekatan NAT:

| Prioritas        | Keterangan                                                                    |
| ---------------- | ----------------------------------------------------------------------------- |
| NAT 3 / Critical | Wajib ada dalam MVP karena berhubungan langsung dengan kebutuhan utama sistem |
| NAT 2 / Standard | Penting, tetapi masih dapat disederhanakan jika waktu terbatas                |
| NAT 1 / Optional | Fitur pendukung atau pengembangan lanjutan                                    |

---

# 5. Skala Story Point

Story point digunakan untuk memperkirakan kompleksitas pengerjaan fitur.

| Story Point | Keterangan                            |
| ----------- | ------------------------------------- |
| 1 SP        | Sangat sederhana                      |
| 2 SP        | Sederhana                             |
| 3 SP        | Sedang                                |
| 5 SP        | Cukup kompleks                        |
| 8 SP        | Kompleks                              |
| 13 SP       | Sangat kompleks dan sebaiknya dipecah |

Catatan:
Story point tidak selalu sama dengan durasi waktu. Story point digunakan untuk memperkirakan tingkat kesulitan berdasarkan kompleksitas logic, database, UI, validasi, testing, dan risiko error.

---

# 6. Product Backlog Avology V2

| Kode  | User Story                                          | Prioritas | Story Point |
| ----- | --------------------------------------------------- | --------: | ----------: |
| US-01 | Registrasi Pengguna                                 |     NAT 3 |           2 |
| US-02 | Login Pengguna                                      |     NAT 3 |           3 |
| US-03 | Logout Pengguna                                     |     NAT 3 |           1 |
| US-04 | Owner Membuat Kebun                                 |     NAT 3 |           5 |
| US-05 | Sistem Membuat Kode Bergabung Kebun                 |     NAT 3 |           2 |
| US-06 | Worker Mengajukan Bergabung ke Kebun                |     NAT 3 |           3 |
| US-07 | Owner Menyetujui Worker                             |     NAT 3 |           3 |
| US-08 | Owner Menolak Pengajuan Worker                      |     NAT 3 |           2 |
| US-09 | Owner Menghapus Worker dari Kebun                   |     NAT 3 |           3 |
| US-10 | Owner Menambah Data Pohon                           |     NAT 3 |           5 |
| US-11 | Owner Mengubah Data Pohon                           |     NAT 3 |           3 |
| US-12 | Owner Mengarsipkan Pohon                            |     NAT 3 |           3 |
| US-13 | Owner atau Worker Melihat Detail Pohon              |     NAT 3 |           3 |
| US-14 | Worker Mencatat Kondisi Pohon                       |     NAT 3 |           3 |
| US-15 | Owner Mencatat Kondisi Pohon                        |     NAT 3 |           3 |
| US-16 | Pengguna Melihat Riwayat Kondisi Pohon              |     NAT 3 |           3 |
| US-17 | Worker Membuat Laporan Operasional Kebun            |     NAT 3 |           3 |
| US-18 | Owner Melihat Laporan Operasional Kebun             |     NAT 3 |           3 |
| US-19 | Owner Mengubah Status Laporan Operasional           |     NAT 3 |           2 |
| US-20 | Owner Membuat Tugas dari Laporan Operasional        |     NAT 3 |           5 |
| US-24 | Sistem Melanjutkan Jadwal Berulang | NAT 3 | 5 |
| US-26 | Owner Membuat Jadwal Manual                         |     NAT 2 |           5 |
| US-27 | Owner Menentukan Target Jadwal                      |     NAT 3 |           3 |
| US-28 | Worker Melihat Daftar Tugas                         |     NAT 3 |           3 |
| US-29 | Worker Melihat Detail Tugas                         |     NAT 3 |           2 |
| US-30 | Worker Menyelesaikan Tugas                          |     NAT 3 |           3 |
| US-31 | Worker Menunda Tugas                                |     NAT 3 |           3 |
| US-32 | Worker Mencatat Fase Pertumbuhan Pohon              |     NAT 3 |           3 |
| US-33 | Owner Mencatat Fase Pertumbuhan Pohon               |     NAT 3 |           3 |
| US-34 | Pengguna Melihat Riwayat Fase Pertumbuhan           |     NAT 3 |           2 |
| US-35 | Owner Melihat Pohon Berbunga atau Berbuah           |     NAT 3 |           3 |
| US-36 | Pengguna Melihat Riwayat Terintegrasi Pohon         |     NAT 3 |           5 |
| US-37 | Owner Melihat Dashboard Kebun                       |     NAT 3 |           8 |
| US-38 | Worker Melihat Dashboard Tugas                      |     NAT 3 |           5 |
| US-39 | Owner Mengakses Fitur Pengelolaan Kebun             |     NAT 3 |           3 |
| US-40 | Worker Mengakses Fitur Operasional Terbatas         |     NAT 3 |           3 |

## Total Estimasi Story Point

Total estimasi seluruh user story MVP:

```txt
119 Story Point
```

---

# 7. Strategi Iterasi

Karena Avology V2 dikembangkan secara individual, iterasi dibagi berdasarkan dependency fitur.

Urutan dependency utama:

```txt
Auth dan Kebun
↓
Keanggotaan Worker
↓
Data Pohon
↓
Laporan Kondisi
↓
Jadwal
↓
Tugas Worker
↓
Laporan Operasional
↓
Fase Pertumbuhan
↓
Riwayat
↓
Dashboard
```

Fitur yang menjadi pondasi harus dikerjakan lebih awal. Contohnya, dashboard tidak boleh dikerjakan sebelum data pohon, tugas, dan laporan tersedia. Dashboard tanpa data sumber cuma hiasan statistik palsu, alias dekorasi kebohongan digital.

---

# 8. Rencana Iterasi Avology V2

## Iteration 0 - Project Foundation

### Fokus

Menyiapkan pondasi awal project, database, struktur folder, konfigurasi Supabase, dan dokumen sumber kebenaran.

### User Story Terkait

Tidak langsung terkait user story, tetapi menjadi pondasi seluruh iterasi.

### Task Utama

1. Membuat project baru Avology V2.
2. Menyiapkan struktur folder frontend.
3. Menyiapkan Supabase project.
4. Menjalankan SQL schema draft secara bertahap.
5. Menyiapkan authentication Supabase.
6. Menyiapkan RLS dasar.
7. Menyiapkan service layer skeleton.
8. Menyiapkan navigation skeleton.
9. Menyiapkan komponen UI dasar.

### Output

* Project Avology V2 siap dikembangkan.
* Database awal tersedia.
* Struktur service tersedia.
* Struktur navigasi awal tersedia.
* Komponen UI dasar tersedia.

### Estimasi

13 SP

### Pengujian

* Project dapat dijalankan.
* Aplikasi dapat terhubung ke Supabase.
* Tabel database berhasil dibuat.
* Auth Supabase dapat digunakan.
* Tidak ada error utama saat app dibuka.

---

## Iteration 1 - Auth, Kebun, dan Keanggotaan Worker

### Fokus

Membangun alur autentikasi, pembuatan kebun, join worker, approve/reject/remove worker.

### User Story Terkait

| Kode  | User Story                           | Story Point |
| ----- | ------------------------------------ | ----------: |
| US-01 | Registrasi Pengguna                  |           2 |
| US-02 | Login Pengguna                       |           3 |
| US-03 | Logout Pengguna                      |           1 |
| US-04 | Owner Membuat Kebun                  |           5 |
| US-05 | Sistem Membuat Kode Bergabung Kebun  |           2 |
| US-06 | Worker Mengajukan Bergabung ke Kebun |           3 |
| US-07 | Owner Menyetujui Worker              |           3 |
| US-08 | Owner Menolak Pengajuan Worker       |           2 |
| US-09 | Owner Menghapus Worker dari Kebun    |           3 |

### Total Story Point

24 SP

### Service yang Dibuat

* `registerUser`
* `loginUser`
* `logoutUser`
* `getCurrentProfile`
* `createFarm`
* `getCurrentUserFarm`
* `requestJoinFarm`
* `getPendingWorkers`
* `getActiveWorkers`
* `approveWorker`
* `rejectWorker`
* `removeWorker`

### Screen yang Dibuat

* Get Started Screen
* Register Screen
* Login Screen
* Onboarding Decision Screen
* Create Farm Screen
* Join Farm Screen
* Pending Approval Screen
* Rejected Screen
* Removed Access Screen
* Worker Management Screen
* Profile Screen

### Output

* User dapat register, login, logout.
* Owner dapat membuat kebun.
* Sistem menghasilkan kode bergabung.
* Worker dapat request join.
* Owner dapat approve, reject, dan remove worker.
* Role owner dan worker mulai berjalan.

### Black-box Testing

1. Register dengan data valid berhasil.
2. Register dengan email kosong gagal.
3. Login dengan akun valid berhasil.
4. Login dengan password salah gagal.
5. Owner membuat kebun berhasil.
6. Join code kebun muncul.
7. Worker memasukkan join code valid berhasil menjadi pending.
8. Worker memasukkan join code salah gagal.
9. Owner approve worker berhasil.
10. Owner reject worker berhasil.
11. Owner remove worker aktif berhasil.
12. Worker rejected diarahkan ke Rejected Screen.
13. Worker removed diarahkan ke Removed Access Screen.

### Retrospective

* Apakah flow auth dan onboarding sudah jelas?
* Apakah role guard sudah berjalan?
* Apakah worker pending/rejected/removed diarahkan ke halaman yang benar?
* Apakah RLS membership sudah aman?

---

## Iteration 2 - Manajemen Pohon dan Laporan Kondisi

### Fokus

Membangun fitur data pohon individual dan laporan kondisi pohon.

### User Story Terkait

| Kode  | User Story                             | Story Point |
| ----- | -------------------------------------- | ----------: |
| US-10 | Owner Menambah Data Pohon              |           5 |
| US-11 | Owner Mengubah Data Pohon              |           3 |
| US-12 | Owner Mengarsipkan Pohon               |           3 |
| US-13 | Owner atau Worker Melihat Detail Pohon |           3 |
| US-14 | Worker Mencatat Kondisi Pohon          |           3 |
| US-15 | Owner Mencatat Kondisi Pohon           |           3 |
| US-16 | Pengguna Melihat Riwayat Kondisi Pohon |           3 |

### Total Story Point

23 SP

### Service yang Dibuat

* `getTrees`
* `getTreeDetail`
* `createTree`
* `updateTree`
* `archiveTree`
* `restoreTree`
* `createTreeConditionReport`
* `getTreeConditionReports`

### Screen yang Dibuat

* Owner Tree List Screen
* Worker Tree List Screen
* Tree Detail Screen
* Create Tree Screen
* Edit Tree Screen
* Create Tree Condition Report Screen

### Output

* Owner dapat menambah, mengubah, dan mengarsipkan pohon.
* Owner dan worker dapat melihat daftar/detail pohon.
* Owner dan worker dapat mencatat kondisi pohon.
* Kondisi terbaru pohon otomatis diperbarui.
* Riwayat kondisi pohon dapat dilihat.

### Black-box Testing

1. Owner menambah pohon dengan data valid berhasil.
2. Owner menambah pohon dengan kode duplikat gagal.
3. Owner mengubah data pohon berhasil.
4. Owner mengarsipkan pohon berhasil.
5. Worker tidak dapat menambah pohon.
6. Worker dapat melihat daftar pohon.
7. Worker dapat mencatat kondisi pohon.
8. Owner dapat mencatat kondisi pohon.
9. Setelah laporan kondisi dibuat, kondisi terbaru pohon berubah.
10. Riwayat kondisi tampil berdasarkan waktu.

### Retrospective

* Apakah data pohon sudah cukup sederhana?
* Apakah worker tidak diberi akses edit pohon?
* Apakah kondisi terbaru sinkron dengan laporan terbaru?
* Apakah form kondisi sudah minim teks?

---

## Iteration 3 - Jadwal Perawatan dan Realisasi Tugas Worker

### Fokus

Membangun jadwal manual, daftar tugas worker, detail tugas, selesai tugas, dan tunda tugas.

Iterasi ini kemudian diperdalam lewat migrasi 048–052: rantai jadwal berulang beserta masa toleransi keterlambatan, penundaan yang wajib bertanggal, penautan pohon pada realisasi tugas, pelepasan tugas saat keanggotaan berakhir, dan pelonggaran aturan penguncian jadwal. Pekerjaan itu tidak menambah user story baru — seluruhnya memperbaiki US-24 dan US-26 sampai US-31 yang sudah ada, sehingga estimasi story point iterasi tidak berubah.

### User Story Terkait

| Kode  | User Story                     | Story Point |
| ----- | ------------------------------ | ----------: |
| US-26 | Owner Membuat Jadwal Manual    |           5 |
| US-27 | Owner Menentukan Target Jadwal |           3 |
| US-28 | Worker Melihat Daftar Tugas    |           3 |
| US-29 | Worker Melihat Detail Tugas    |           2 |
| US-30 | Worker Menyelesaikan Tugas     |           3 |
| US-31 | Worker Menunda Tugas           |           3 |

### Total Story Point

19 SP

### Service yang Dibuat

* `createManualSchedule`
* `getCareSchedules`
* `getCareScheduleDetail`
* `getWorkerTasks`
* `getFarmTasks`
* `getTaskDetail`
* `completeTask`
* `postponeTask`
* `getScheduleEditEligibility`
* `cancelCareSchedule`
* `assignWorkerToSchedule`
* `stopScheduleRepeat`
* `sweepMissedSchedules`
* `leaveCurrentFarm`

### Screen yang Dibuat

* Care Schedule List Screen
* Care Schedule Detail Screen
* Create Manual Schedule Screen
* Worker Task List Screen
* Worker Task Detail Screen
* Owner Task List Screen
* Owner Task Detail Screen

### Output

* Owner dapat membuat jadwal manual.
* Jadwal manual menghasilkan tugas worker.
* Worker dapat melihat daftar tugas.
* Worker dapat melihat detail tugas.
* Worker dapat menyelesaikan tugas.
* Worker dapat menunda tugas.
* Realisasi tugas tersimpan sebagai aktivitas.

### Black-box Testing

1. Owner membuat jadwal manual berhasil.
2. Jadwal manual menghasilkan task.
3. Worker hanya melihat tugas miliknya.
4. Worker membuka detail tugas berhasil.
5. Worker menyelesaikan tugas berhasil.
6. Status tugas berubah menjadi completed.
7. Worker menunda tugas berhasil.
8. Status tugas berubah menjadi postponed.
9. Owner dapat melihat tugas tertunda.
10. Aktivitas tugas tersimpan sebagai riwayat.

### Retrospective

* Apakah worker mudah memahami tugas?
* Apakah tombol selesai/tunda cukup jelas?
* Apakah catatan tunda wajib atau opsional?
* Apakah target tugas sudah mudah dipahami?

---

## Iteration 4 - Laporan Operasional Kebun dan Tindak Lanjut

### Fokus

Membangun fitur laporan operasional kebun dan tugas tindak lanjut dari laporan.

### User Story Terkait

| Kode  | User Story                                   | Story Point |
| ----- | -------------------------------------------- | ----------: |
| US-17 | Worker Membuat Laporan Operasional Kebun     |           3 |
| US-18 | Owner Melihat Laporan Operasional Kebun      |           3 |
| US-19 | Owner Mengubah Status Laporan Operasional    |           2 |
| US-20 | Owner Membuat Tugas dari Laporan Operasional |           5 |

### Total Story Point

13 SP

### Service yang Dibuat

* `createOperationalReport`
* `getOperationalReports`
* `getOperationalReportDetail`
* `updateOperationalReportStatus`
* `createTaskFromOperationalReport`

### Screen yang Dibuat

* Worker Create Operational Report Screen
* Worker Operational Report List Screen
* Operational Report List Screen
* Operational Report Detail Screen
* Create Task From Operational Report Screen

### Output

* Worker dapat membuat laporan operasional.
* Owner dapat melihat laporan operasional.
* Owner dapat mengubah status laporan.
* Owner dapat membuat tugas tindak lanjut dari laporan.
* Worker dapat menerima tugas tindak lanjut.

### Black-box Testing

1. Worker membuat laporan operasional berhasil.
2. Laporan baru memiliki status new.
3. Owner dapat melihat laporan masuk.
4. Owner dapat membuka detail laporan.
5. Owner mengubah status laporan berhasil.
6. Owner membuat tugas dari laporan berhasil.
7. Status laporan berubah menjadi in_progress.
8. Tugas muncul pada daftar tugas worker.

### Retrospective

* Apakah kategori laporan sudah cukup?
* Apakah laporan operasional tidak bercampur dengan laporan kondisi pohon?
* Apakah alur tindak lanjut laporan mudah dipahami owner?
* Apakah worker perlu melihat riwayat laporan miliknya di MVP penuh?

---

## Iteration 5 - Fase Pertumbuhan dan Riwayat Pohon

### Fokus

Membangun pencatatan fase pertumbuhan, monitoring pohon berbunga/berbuah, dan riwayat pohon terintegrasi.

### User Story Terkait

| Kode  | User Story                                  | Story Point |
| ----- | ------------------------------------------- | ----------: |
| US-32 | Worker Mencatat Fase Pertumbuhan Pohon      |           3 |
| US-33 | Owner Mencatat Fase Pertumbuhan Pohon       |           3 |
| US-34 | Pengguna Melihat Riwayat Fase Pertumbuhan   |           2 |
| US-35 | Owner Melihat Pohon Berbunga atau Berbuah   |           3 |
| US-36 | Pengguna Melihat Riwayat Terintegrasi Pohon |           5 |

### Total Story Point

16 SP

### Service yang Dibuat

* `createGrowthPhaseRecord`
* `getGrowthPhaseRecords`
* `getFloweringAndFruitingTrees`
* `getTreeHistory`

### Screen yang Dibuat

* Create Growth Phase Record Screen
* Growth Monitoring Screen
* Tree History Section
* Tree History Full Screen jika diperlukan

### Output

* Owner dan worker dapat mencatat fase pertumbuhan.
* Fase terbaru pohon otomatis diperbarui.
* Riwayat fase dapat dilihat.
* Owner dapat melihat pohon berbunga dan berbuah.
* Riwayat pohon menampilkan kondisi, fase, dan perawatan dalam satu timeline.

### Black-box Testing

1. Worker mencatat fase pohon berhasil.
2. Owner mencatat fase pohon berhasil.
3. Fase terbaru pohon berubah setelah catatan fase dibuat.
4. Riwayat fase tampil berdasarkan waktu.
5. Pohon flowering muncul di monitoring berbunga.
6. Pohon fruiting muncul di monitoring berbuah.
7. Riwayat terintegrasi menampilkan kondisi, fase, dan perawatan.
8. Sistem tidak menampilkan prediksi panen otomatis.

### Retrospective

* Apakah istilah fase mudah dipahami?
* Apakah monitoring berbunga/berbuah cukup membantu owner?
* Apakah timeline riwayat pohon mudah dibaca?
* Apakah ada risiko pengguna mengira sistem memprediksi panen?

---

## Iteration 6 - Dashboard, Role Guard, dan Final MVP Polish

### Fokus

Menyelesaikan dashboard owner, dashboard worker, role guard, navigasi akhir, dan penyempurnaan MVP.

### User Story Terkait

| Kode  | User Story                                  | Story Point |
| ----- | ------------------------------------------- | ----------: |
| US-37 | Owner Melihat Dashboard Kebun               |           8 |
| US-38 | Worker Melihat Dashboard Tugas              |           5 |
| US-39 | Owner Mengakses Fitur Pengelolaan Kebun     |           3 |
| US-40 | Worker Mengakses Fitur Operasional Terbatas |           3 |

### Total Story Point

19 SP

### Service yang Dibuat

* `getOwnerDashboardSummary`
* `getWorkerDashboardSummary`
* Role guard helper
* Navigation guard helper

### Screen yang Dibuat

* Owner Dashboard Screen final
* Worker Dashboard Screen final
* Final Profile Screen
* Empty state/error state/loading state
* Navigasi owner final
* Navigasi worker final

### Output

* Owner dashboard menampilkan ringkasan kebun.
* Worker dashboard menampilkan ringkasan tugas.
* Owner hanya masuk ke area owner.
* Worker hanya masuk ke area worker.
* Worker pending/rejected/removed tidak dapat masuk ke area operasional.
* UI dasar sudah konsisten.
* MVP siap diuji black-box penuh dan UAT awal.

### Black-box Testing

1. Dashboard owner menampilkan total pohon.
2. Dashboard owner menampilkan pohon bermasalah.
3. Dashboard owner menampilkan tugas hari ini.
4. Dashboard owner menampilkan laporan operasional baru.
5. Dashboard owner menampilkan worker pending.
6. Dashboard owner menampilkan jadwal terlambat/jatuh tempo.
7. Dashboard worker menampilkan tugas hari ini.
8. Dashboard worker menampilkan tugas belum selesai.
9. Worker tidak dapat membuka fitur owner.
10. Owner dapat membuka fitur pengelolaan kebun.
11. Worker removed tidak dapat mengakses dashboard worker.
12. Empty state tampil saat data kosong.
13. Loading state tampil saat data sedang dimuat.
14. Error state tampil saat data gagal dimuat.

### Retrospective

* Apakah dashboard owner benar-benar membantu decision making cepat?
* Apakah dashboard worker cukup sederhana?
* Apakah navigasi owner dan worker sudah jelas?
* Apakah masih ada fitur yang tidak sesuai scope MVP?
* Apakah MVP siap masuk pengujian pengguna?

---

# 9. Ringkasan Iterasi

| Iterasi     | Fokus                                   | Story Point |
| ----------- | --------------------------------------- | ----------: |
| Iteration 0 | Project Foundation                      |          13 |
| Iteration 1 | Auth, Kebun, dan Keanggotaan Worker     |          24 |
| Iteration 2 | Manajemen Pohon dan Laporan Kondisi     |          23 |
| Iteration 3 | Jadwal Perawatan dan Realisasi Tugas    |          19 |
| Iteration 4 | Laporan Operasional dan Tindak Lanjut   |          13 |
| Iteration 5 | Fase Pertumbuhan dan Riwayat Pohon      |          16 |
| Iteration 6 | Dashboard, Role Guard, dan Final Polish |          19 |

## Total Story Point MVP

```txt
127 Story Point
```

Catatan:
Total ini mencakup 137 SP dari user story utama dan 13 SP dari Iteration 0 sebagai pondasi project.

---

# 10. Velocity Awal

Karena proyek ini dikerjakan secara personal, velocity awal ditetapkan secara konservatif.

## Velocity Awal

```txt
± 15-25 Story Point per iterasi
```

Velocity ini dapat berubah setelah retrospective setiap iterasi.

Jika satu iterasi terlalu berat, fitur dapat dipindahkan ke iterasi berikutnya. Kalau tetap dipaksa, hasilnya biasanya bukan “produktif”, tapi “membuka cabang baru penderitaan”.

---

# 11. Definition of Done

Sebuah user story dianggap selesai jika memenuhi kriteria berikut:

1. Fitur sudah dapat digunakan dari UI.
2. Data berhasil disimpan atau ditampilkan dari Supabase.
3. Role access sudah sesuai.
4. Error dasar sudah ditangani.
5. Empty state dan loading state tersedia jika dibutuhkan.
6. Tidak ada error utama di console.
7. Black-box testing untuk fitur tersebut berhasil.
8. Fitur sesuai dengan requirement dan scope MVP.
9. Tidak ada fitur tambahan di luar scope tanpa decision log.
10. Perubahan penting sudah dicatat dalam dokumentasi.

---

# 12. Definition of Ready

Sebuah user story boleh masuk implementasi jika:

1. Requirement terkait sudah jelas.
2. Acceptance criteria tersedia.
3. Service yang dibutuhkan sudah diketahui.
4. Screen yang dibutuhkan sudah diketahui.
5. Tabel database yang dibutuhkan sudah tersedia.
6. Role pengguna sudah jelas.
7. Risiko utama sudah diketahui.
8. Tidak ada pertanyaan scope besar yang belum diputuskan.

---

# 13. Risiko Pengembangan

| Risiko                            | Dampak                                     | Mitigasi                                      |
| --------------------------------- | ------------------------------------------ | --------------------------------------------- |
| Scope melebar                     | MVP tidak selesai                          | Gunakan MVP Scope dan Decision Log            |
| RLS Supabase rumit                | User tidak bisa akses data atau data bocor | Uji RLS per tabel dan per role                |
| Jadwal dan tugas terlalu kompleks | Iterasi jadwal/task molor | Hitung rantai pada jalur baca, bukan lewat penjadwal latar |
| Dashboard lambat                  | UX buruk                                   | Gunakan query ringkasan dan index             |
| Worker flow terlalu rumit         | Aplikasi tidak sesuai kebutuhan lapangan   | Form minim teks dan pilihan kategori          |
| Data histori kacau                | Riwayat pohon tidak akurat                 | Gunakan tabel riwayat terpisah dan view       |
| UI terlalu banyak halaman         | Navigasi membingungkan                     | Ikuti screen inventory dan prioritas          |
| Coding keluar dari dokumen        | Project melenceng seperti versi lama       | Semua perubahan scope dicatat di decision log |

---

# 14. Strategi Pengujian per Iterasi

Setiap iterasi harus diakhiri dengan pengujian black-box.

Format pengujian minimal:

| ID Test | Fitur      | Skenario           | Input      | Output yang Diharapkan | Status    |
| ------- | ---------- | ------------------ | ---------- | ---------------------- | --------- |
| TC-XX   | Nama fitur | Skenario pengujian | Data input | Hasil yang diharapkan  | Pass/Fail |

Contoh:

| ID Test | Fitur       | Skenario                     | Input                    | Output yang Diharapkan                        | Status |
| ------- | ----------- | ---------------------------- | ------------------------ | --------------------------------------------- | ------ |
| TC-01   | Login       | User login dengan akun valid | Email dan password valid | User masuk ke dashboard sesuai role           | Pass   |
| TC-02   | Join Farm   | Worker memasukkan kode salah | Kode tidak valid         | Sistem menampilkan pesan kode tidak ditemukan | Pass   |
| TC-03   | Create Tree | Owner menambah pohon         | Kode pohon P-01          | Pohon berhasil tersimpan                      | Pass   |

---

# 15. Retrospective per Iterasi

Setelah setiap iterasi, lakukan retrospective singkat.

## Template Retrospective

```txt
Iteration:
Tanggal:
Story Point direncanakan:
Story Point selesai:

Apa yang berjalan baik?
-

Apa yang bermasalah?
-

Apa yang perlu diperbaiki?
-

Apakah ada perubahan scope?
-

Keputusan untuk iterasi berikutnya:
-
```

---

# 16. Output Akhir Setiap Iterasi

Setiap iterasi harus menghasilkan:

1. Fitur yang bisa diuji.
2. Service function yang relevan.
3. Screen yang relevan.
4. Database/RLS yang dibutuhkan.
5. Black-box testing result.
6. Catatan retrospective.
7. Update decision log jika ada perubahan scope.

---

# 17. Urutan Implementasi yang Direkomendasikan

Urutan implementasi Avology V2:

```txt
Iteration 0 - Project Foundation
↓
Iteration 1 - Auth, Kebun, dan Keanggotaan Worker
↓
Iteration 2 - Manajemen Pohon dan Laporan Kondisi
↓
Iteration 3 - Jadwal Perawatan dan Realisasi Tugas
↓
Iteration 4 - Laporan Operasional dan Tindak Lanjut
↓
Iteration 5 - Fase Pertumbuhan dan Riwayat Pohon
↓
Iteration 6 - Dashboard, Role Guard, dan Final Polish
```

---

# 18. Catatan Scope

Iteration planning ini tidak mencakup fitur berikut:

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

Fitur-fitur tersebut masuk backlog pengembangan lanjutan dan tidak dikerjakan pada MVP Avology V2.

---

# 19. Kesimpulan

Iteration planning Avology V2 membagi pengembangan MVP ke dalam delapan iterasi, mulai dari pondasi project hingga dashboard dan final polish.

Dengan pembagian ini, pengembangan aplikasi menjadi lebih terarah, terukur, dan sesuai dengan kebutuhan lapangan MS Farm.

Fokus utama MVP adalah membangun sistem informasi operasional kebun alpukat yang mendukung:

1. Manajemen kebun dan worker
2. Pencatatan pohon individual
3. Laporan kondisi pohon
4. Laporan operasional kebun
5. Pengulangan jadwal perawatan sebagai rantai jadwal
6. Jadwal dan tugas worker
7. Realisasi perawatan
8. Fase pertumbuhan pohon
9. Riwayat pohon
10. Dashboard owner dan worker
