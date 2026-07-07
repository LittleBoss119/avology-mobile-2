# Screen Inventory dan Navigation Flow Avology V2

## 1. Tujuan Screen Inventory dan Navigation Flow

Screen inventory digunakan untuk menentukan daftar halaman yang dibutuhkan dalam aplikasi Avology V2 berdasarkan MVP Scope, kebutuhan fungsional, user story, use case, activity diagram, data model, dan service layer.

Navigation flow digunakan untuk menggambarkan alur perpindahan halaman antara owner, worker, dan sistem.

Tahap ini penting agar desain UI dan implementasi tidak melebar ke halaman yang tidak memiliki dasar kebutuhan. Dengan kata lain, ini pagar sebelum tangan developer mulai menciptakan halaman-halaman liar yang nantinya tidak dipakai siapa pun, termasuk pembuatnya sendiri.

---

# 2. Prinsip Perancangan Screen

Perancangan halaman Avology V2 menggunakan prinsip berikut:

1. Halaman harus berasal dari kebutuhan fungsional atau user story.
2. Halaman owner dan worker harus dipisahkan berdasarkan hak akses.
3. Worker harus memiliki alur yang lebih sederhana daripada owner.
4. Form worker harus minim input teks.
5. Dashboard menjadi pintu masuk utama setelah login.
6. Detail data penting harus menyediakan aksi lanjutan yang relevan.
7. Halaman tidak boleh dibuat hanya karena “kayaknya perlu”.
8. Fitur di luar MVP tidak dibuatkan halaman.
9. Navigasi harus mobile-first.
10. Halaman yang fungsinya mirip sebaiknya memakai komponen reusable.

---

# 3. Struktur Navigasi Utama

Avology V2 memiliki beberapa area utama:

1. Public / Auth Area
2. Onboarding Area
3. Owner Area
4. Worker Area
5. Shared Detail Area

---

# 4. Public / Auth Area

Public area adalah halaman yang dapat diakses sebelum pengguna masuk ke aplikasi.

## 4.1 Get Started Screen

### Fungsi

Halaman awal aplikasi sebelum pengguna login atau register.

### Isi Utama

* Nama aplikasi Avology
* Deskripsi singkat aplikasi
* Tombol login
* Tombol register

### Aktor

* Owner
* Worker

### Service Terkait

* Tidak ada service utama

---

## 4.2 Login Screen

### Fungsi

Halaman untuk masuk ke aplikasi.

### Isi Utama

* Input email
* Input password
* Tombol login
* Link register

### Aktor

* Owner
* Worker

### Service Terkait

* `loginUser`
* `getCurrentUserFarm`

### Alur Setelah Login

* Jika user adalah owner active, masuk ke Owner Dashboard.
* Jika user adalah worker active, masuk ke Worker Dashboard.
* Jika worker pending, masuk ke Pending Approval Screen.
* Jika worker rejected, masuk ke Rejected Screen.
* Jika worker removed, masuk ke Removed Access Screen.
* Jika user belum punya kebun atau membership, masuk ke Role/Onboarding Decision Screen.

---

## 4.3 Register Screen

### Fungsi

Halaman untuk membuat akun baru.

### Isi Utama

* Input nama lengkap
* Input email
* Input nomor telepon
* Input password
* Tombol register
* Link login

### Aktor

* Owner
* Worker

### Service Terkait

* `registerUser`

### Alur Setelah Register

Setelah register berhasil, pengguna diarahkan ke Onboarding Decision Screen untuk memilih membuat kebun atau bergabung ke kebun.

---

# 5. Onboarding Area

Onboarding area digunakan ketika user sudah login tetapi belum memiliki kebun aktif.

## 5.1 Onboarding Decision Screen

### Fungsi

Halaman untuk menentukan apakah pengguna akan menjadi owner atau worker.

### Isi Utama

* Pilihan “Buat Kebun”
* Pilihan “Gabung Kebun”
* Penjelasan singkat per pilihan

### Aktor

* Owner
* Worker

### Alur

* Jika memilih Buat Kebun, masuk ke Create Farm Screen.
* Jika memilih Gabung Kebun, masuk ke Join Farm Screen.

---

## 5.2 Create Farm Screen

### Fungsi

Owner membuat data kebun pertama.

### Isi Utama

* Input nama kebun
* Input lokasi kebun
* Input luas kebun
* Tombol buat kebun

### Aktor

* Owner

### Service Terkait

* `createFarm`

### Alur Setelah Berhasil

* Sistem membuat kebun.
* Sistem membuat membership owner active.
* User diarahkan ke Owner Dashboard.

---

## 5.3 Join Farm Screen

### Fungsi

Worker mengajukan bergabung ke kebun menggunakan kode bergabung.

### Isi Utama

* Input kode bergabung
* Tombol ajukan bergabung

### Aktor

* Worker

### Service Terkait

* `requestJoinFarm`

### Alur Setelah Berhasil

* Sistem membuat membership worker dengan status pending.
* User diarahkan ke Pending Approval Screen.

---

## 5.4 Pending Approval Screen

### Fungsi

Menampilkan status bahwa worker sedang menunggu persetujuan owner.

### Isi Utama

* Informasi status pending
* Nama kebun jika tersedia
* Tombol refresh status
* Tombol logout

### Aktor

* Worker

### Service Terkait

* `getCurrentUserFarm`

---

## 5.5 Rejected Screen

### Fungsi

Menampilkan informasi bahwa pengajuan worker ditolak.

### Isi Utama

* Pesan pengajuan ditolak
* Tombol kembali ke onboarding
* Tombol logout

### Aktor

* Worker

### Service Terkait

* `getCurrentUserFarm`

---

## 5.6 Removed Access Screen

### Fungsi

Menampilkan informasi bahwa akses worker ke kebun telah dinonaktifkan.

### Isi Utama

* Pesan akses dinonaktifkan
* Tombol kembali ke onboarding jika ingin gabung kebun lain
* Tombol logout

### Aktor

* Worker

### Service Terkait

* `getCurrentUserFarm`

---

# 6. Owner Area

Owner area adalah halaman yang hanya dapat diakses oleh owner active.

## 6.1 Owner Dashboard Screen

### Fungsi

Menampilkan ringkasan kondisi kebun untuk pengambilan keputusan cepat.

### Isi Utama

* Total pohon
* Pohon sehat
* Pohon bermasalah
* Tugas hari ini
* Tugas belum selesai
* Laporan operasional baru
* Worker pending
* Pohon berbunga
* Pohon berbuah
* SOP jatuh tempo atau terlambat

### Aktor

* Owner

### Service Terkait

* `getOwnerDashboardSummary`

### Navigasi dari Dashboard

* Ke Tree List Screen
* Ke Task List Screen
* Ke Operational Report List Screen
* Ke Worker Management Screen
* Ke Care SOP List Screen
* Ke Growth Monitoring Screen

---

## 6.2 Owner Tree List Screen

### Fungsi

Menampilkan daftar pohon dalam kebun.

### Isi Utama

* Search pohon
* Filter kondisi
* Filter fase pertumbuhan
* Filter aktif/arsip
* Daftar pohon
* Tombol tambah pohon

### Aktor

* Owner

### Service Terkait

* `getTrees`

### Navigasi

* Tambah pohon ke Create Tree Screen
* Pilih pohon ke Tree Detail Screen
* Edit pohon dari Tree Detail Screen

---

## 6.3 Create Tree Screen

### Fungsi

Owner menambahkan data pohon baru.

### Isi Utama

* Input kode pohon
* Input baris
* Input kolom
* Input varietas
* Input tanggal tanam
* Tombol simpan

### Aktor

* Owner

### Service Terkait

* `createTree`

---

## 6.4 Edit Tree Screen

### Fungsi

Owner mengubah data pohon.

### Isi Utama

* Input kode pohon
* Input baris
* Input kolom
* Input varietas
* Input tanggal tanam
* Tombol simpan perubahan

### Aktor

* Owner

### Service Terkait

* `updateTree`

---

## 6.5 Tree Detail Screen

### Fungsi

Menampilkan detail pohon dan riwayat pohon.

### Isi Utama

* Kode pohon
* Baris dan kolom
* Varietas
* Tanggal tanam
* Kondisi terbaru
* Fase terbaru
* Riwayat terintegrasi
* Tombol catat kondisi
* Tombol catat fase
* Tombol edit pohon
* Tombol arsipkan pohon

### Aktor

* Owner
* Worker

### Service Terkait

* `getTreeDetail`
* `getTreeHistory`
* `archiveTree`
* `restoreTree`

### Catatan Hak Akses

* Owner dapat edit dan arsip pohon.
* Worker hanya dapat melihat detail, catat kondisi, dan catat fase.

---

## 6.6 Create Tree Condition Report Screen

### Fungsi

Mencatat kondisi pohon.

### Isi Utama

* Pilihan pohon
* Pilihan kondisi
* Catatan singkat
* Tombol simpan

### Aktor

* Owner
* Worker

### Service Terkait

* `createTreeConditionReport`

---

## 6.7 Create Growth Phase Record Screen

### Fungsi

Mencatat fase pertumbuhan pohon.

### Isi Utama

* Pilihan pohon
* Pilihan fase
* Catatan singkat
* Tombol simpan

### Aktor

* Owner
* Worker

### Service Terkait

* `createGrowthPhaseRecord`

---

## 6.8 Growth Monitoring Screen

### Fungsi

Menampilkan daftar pohon yang sedang berbunga atau berbuah.

### Isi Utama

* Jumlah pohon berbunga
* Jumlah pohon berbuah
* Daftar pohon berbunga
* Daftar pohon berbuah

### Aktor

* Owner

### Service Terkait

* `getFloweringAndFruitingTrees`

### Catatan

Halaman ini bukan halaman prediksi panen. Halaman ini hanya membantu owner memonitor fase pohon. Jangan kasih label “Prediksi Panen”, kecuali tujuan hidupnya memang mengundang pertanyaan penguji.

---

# 7. Owner Worker Management Area

## 7.1 Worker Management Screen

### Fungsi

Owner mengelola pekerja kebun.

### Isi Utama

* Daftar worker pending
* Daftar worker active
* Daftar worker rejected/removed jika diperlukan
* Tombol approve worker
* Tombol reject worker
* Tombol remove worker

### Aktor

* Owner

### Service Terkait

* `getPendingWorkers`
* `getActiveWorkers`
* `approveWorker`
* `rejectWorker`
* `removeWorker`

---

# 8. Owner Operational Report Area

## 8.1 Operational Report List Screen

### Fungsi

Owner melihat daftar laporan operasional kebun.

### Isi Utama

* Filter status laporan
* Filter kategori laporan
* Daftar laporan operasional
* Badge status laporan

### Aktor

* Owner

### Service Terkait

* `getOperationalReports`

---

## 8.2 Operational Report Detail Screen

### Fungsi

Owner melihat detail laporan operasional dan menindaklanjutinya.

### Isi Utama

* Kategori laporan
* Lokasi/catatan lokasi
* Deskripsi laporan
* Pelapor
* Tanggal laporan
* Status laporan
* Tombol ubah status
* Tombol buat tugas tindak lanjut

### Aktor

* Owner

### Service Terkait

* `getOperationalReportDetail`
* `updateOperationalReportStatus`
* `createTaskFromOperationalReport`

---

## 8.3 Create Task From Operational Report Screen

### Fungsi

Owner membuat tugas tindak lanjut berdasarkan laporan operasional.

### Isi Utama

* Referensi laporan
* Input judul tugas
* Pilihan worker
* Tanggal tugas
* Target tugas
* Instruksi tugas
* Tombol buat tugas

### Aktor

* Owner

### Service Terkait

* `createTaskFromOperationalReport`

---

# 9. Owner SOP and Schedule Area

## 9.1 Care SOP List Screen

### Fungsi

Owner melihat daftar SOP perawatan.

### Isi Utama

* Daftar SOP aktif
* Daftar SOP tidak aktif jika dibutuhkan
* Kategori SOP
* Interval hari
* Status acuan jadwal berikutnya
* Tombol tambah SOP

### Aktor

* Owner

### Service Terkait

* `getCareSOPs`
* `getCareSOPNextScheduleReference`

---

## 9.2 Care SOP Detail Screen

### Fungsi

Owner melihat detail SOP dan acuan jadwal berikutnya.

### Isi Utama

* Nama SOP
* Kategori
* Interval hari
* Instruksi default
* Target default
* Status aktif
* Realisasi terakhir
* Acuan jadwal berikutnya
* Status jatuh tempo
* Tombol buat jadwal dari SOP
* Tombol edit SOP
* Tombol aktif/nonaktif

### Aktor

* Owner

### Service Terkait

* `getCareSOPDetail`
* `getCareSOPNextScheduleReference`
* `setCareSOPActiveStatus`

---

## 9.3 Create Care SOP Screen

### Fungsi

Owner membuat SOP perawatan baru.

### Isi Utama

* Input nama SOP
* Pilihan kategori
* Input interval hari
* Input instruksi default
* Pilihan target default
* Tombol simpan

### Aktor

* Owner

### Service Terkait

* `createCareSOP`

---

## 9.4 Edit Care SOP Screen

### Fungsi

Owner mengubah SOP perawatan.

### Isi Utama

* Input nama SOP
* Pilihan kategori
* Input interval hari
* Input instruksi default
* Pilihan target default
* Tombol simpan perubahan

### Aktor

* Owner

### Service Terkait

* `updateCareSOP`

---

## 9.5 Care Schedule List Screen

### Fungsi

Owner melihat daftar jadwal perawatan.

### Isi Utama

* Filter tanggal
* Filter kategori
* Daftar jadwal
* Tombol buat jadwal dari SOP
* Tombol buat jadwal manual

### Aktor

* Owner

### Service Terkait

* `getCareSchedules`

---

## 9.6 Care Schedule Detail Screen

### Fungsi

Owner melihat detail jadwal perawatan.

### Isi Utama

* Judul jadwal
* Kategori
* Tanggal jadwal
* Target
* Instruksi
* SOP terkait jika ada
* Tugas worker yang dihasilkan

### Aktor

* Owner

### Service Terkait

* `getCareScheduleDetail`
* `getFarmTasks`

---

## 9.7 Create Schedule From SOP Screen

### Fungsi

Owner membuat jadwal dari SOP.

### Isi Utama

* SOP yang dipilih
* Acuan tanggal berikutnya
* Input tanggal jadwal
* Pilihan worker
* Pilihan target
* Instruksi dari SOP
* Tombol buat jadwal dan tugas

### Aktor

* Owner

### Service Terkait

* `createScheduleFromSOP`
* `getCareSOPDetail`
* `getActiveWorkers`

---

## 9.8 Create Manual Schedule Screen

### Fungsi

Owner membuat jadwal manual tanpa SOP.

### Isi Utama

* Input judul jadwal
* Pilihan kategori
* Input tanggal jadwal
* Pilihan worker
* Pilihan target
* Instruksi
* Tombol buat jadwal dan tugas

### Aktor

* Owner

### Service Terkait

* `createManualSchedule`
* `getActiveWorkers`

---

# 10. Owner Task Area

## 10.1 Owner Task List Screen

### Fungsi

Owner melihat daftar tugas dalam kebun.

### Isi Utama

* Filter status
* Filter tanggal
* Filter worker
* Daftar tugas
* Badge status tugas

### Aktor

* Owner

### Service Terkait

* `getFarmTasks`

---

## 10.2 Owner Task Detail Screen

### Fungsi

Owner melihat detail tugas dan realisasinya.

### Isi Utama

* Judul tugas
* Worker penerima
* Tanggal tugas
* Status tugas
* Target tugas
* Instruksi tugas
* Riwayat aktivitas tugas

### Aktor

* Owner

### Service Terkait

* `getTaskDetail`

---

# 11. Worker Area

Worker area harus lebih sederhana daripada owner area. Worker tidak perlu melihat semua pengaturan karena tugasnya adalah menjalankan pekerjaan dan membuat laporan lapangan. Jangan beri worker dashboard penuh tombol seperti kokpit pesawat, dia mau kerja di kebun, bukan menerbangkan alpukat.

## 11.1 Worker Dashboard Screen

### Fungsi

Menampilkan ringkasan tugas worker dan shortcut laporan.

### Isi Utama

* Tugas hari ini
* Tugas belum selesai
* Tugas selesai
* Shortcut lihat tugas
* Shortcut lapor kondisi pohon
* Shortcut buat laporan operasional

### Aktor

* Worker

### Service Terkait

* `getWorkerDashboardSummary`

---

## 11.2 Worker Task List Screen

### Fungsi

Worker melihat daftar tugas miliknya.

### Isi Utama

* Tugas hari ini
* Tugas belum selesai
* Tugas tertunda
* Tugas selesai
* Filter tanggal/status sederhana

### Aktor

* Worker

### Service Terkait

* `getWorkerTasks`

---

## 11.3 Worker Task Detail Screen

### Fungsi

Worker melihat detail tugas dan memperbarui statusnya.

### Isi Utama

* Judul tugas
* Tanggal tugas
* Target tugas
* Instruksi
* Status tugas
* Tombol selesai
* Tombol tunda
* Input catatan singkat

### Aktor

* Worker

### Service Terkait

* `getTaskDetail`
* `completeTask`
* `postponeTask`

---

## 11.4 Worker Tree List Screen

### Fungsi

Worker melihat daftar pohon secara terbatas.

### Isi Utama

* Search pohon
* Filter kondisi
* Daftar pohon
* Tombol lapor kondisi
* Tombol catat fase

### Aktor

* Worker

### Service Terkait

* `getTrees`

### Catatan

Worker tidak memiliki tombol tambah, edit, hapus, atau arsip pohon.

---

## 11.5 Worker Tree Detail Screen

### Fungsi

Worker melihat detail pohon dan mencatat kondisi/fase.

### Isi Utama

* Identitas pohon
* Kondisi terbaru
* Fase terbaru
* Riwayat pohon
* Tombol catat kondisi
* Tombol catat fase

### Aktor

* Worker

### Service Terkait

* `getTreeDetail`
* `getTreeHistory`

---

## 11.6 Worker Create Condition Report Screen

### Fungsi

Worker mencatat kondisi pohon.

### Isi Utama

* Pilihan pohon
* Pilihan kondisi
* Catatan singkat opsional
* Tombol simpan

### Aktor

* Worker

### Service Terkait

* `createTreeConditionReport`

---

## 11.7 Worker Create Growth Phase Screen

### Fungsi

Worker mencatat fase pertumbuhan pohon.

### Isi Utama

* Pilihan pohon
* Pilihan fase
* Catatan singkat opsional
* Tombol simpan

### Aktor

* Worker

### Service Terkait

* `createGrowthPhaseRecord`

---

## 11.8 Worker Create Operational Report Screen

### Fungsi

Worker membuat laporan operasional kebun.

### Isi Utama

* Pilihan kategori laporan
* Input lokasi singkat
* Input catatan singkat
* Tombol simpan laporan

### Aktor

* Worker

### Service Terkait

* `createOperationalReport`

---

## 11.9 Worker Operational Report List Screen

### Fungsi

Worker melihat laporan operasional yang pernah dibuatnya.

### Isi Utama

* Daftar laporan
* Status laporan
* Tanggal laporan

### Aktor

* Worker

### Service Terkait

* `getOperationalReports`

### Catatan

Jika ingin lebih sederhana untuk MVP, halaman ini bisa dibuat setelah fitur utama worker selesai. Minimal worker harus bisa membuat laporan, sedangkan daftar laporan miliknya bisa masuk prioritas Standard.

---

# 12. Shared Profile Area

## 12.1 Profile Screen

### Fungsi

Menampilkan profil pengguna dan informasi akses kebun.

### Isi Utama

* Nama pengguna
* Nomor telepon
* Role
* Status membership
* Nama kebun
* Tombol logout

### Aktor

* Owner
* Worker

### Service Terkait

* `getCurrentProfile`
* `getCurrentUserFarm`
* `logoutUser`

---

## 12.2 Edit Profile Screen

### Fungsi

Mengubah data profil dasar pengguna.

### Isi Utama

* Input nama
* Input nomor telepon
* Tombol simpan

### Aktor

* Owner
* Worker

### Service Terkait

* `getCurrentProfile`

### Catatan

Untuk MVP, edit profile bisa masuk prioritas Standard. Jangan sampai edit profile mengalahkan fitur inti seperti tugas worker. Manusia memang suka mempercantik kartu nama sebelum punya isi kerja, tapi aplikasi ini jangan ikut-ikutan.

---

# 13. Bottom Navigation Owner

Owner memiliki navigasi utama:

1. Dashboard
2. Pohon
3. Jadwal
4. Laporan
5. Kebun/Profile

## 13.1 Struktur

```txt
Owner Tabs
├── Dashboard
├── Pohon
├── Jadwal
├── Laporan
└── Kebun/Profile
```

## 13.2 Isi Setiap Tab

### Dashboard

* Owner Dashboard Screen

### Pohon

* Owner Tree List Screen
* Tree Detail Screen
* Create Tree Screen
* Edit Tree Screen
* Create Condition Report Screen
* Create Growth Phase Record Screen
* Growth Monitoring Screen

### Jadwal

* Care Schedule List Screen
* Care Schedule Detail Screen
* Create Schedule From SOP Screen
* Create Manual Schedule Screen
* Owner Task List Screen
* Owner Task Detail Screen

### Laporan

* Operational Report List Screen
* Operational Report Detail Screen
* Create Task From Operational Report Screen

### Kebun/Profile

* Farm Detail Screen
* Worker Management Screen
* Care SOP List Screen
* Care SOP Detail Screen
* Create Care SOP Screen
* Edit Care SOP Screen
* Profile Screen
* Edit Profile Screen

---

# 14. Bottom Navigation Worker

Worker memiliki navigasi utama:

1. Dashboard
2. Tugas
3. Pohon
4. Laporan
5. Profile

## 14.1 Struktur

```txt
Worker Tabs
├── Dashboard
├── Tugas
├── Pohon
├── Laporan
└── Profile
```

## 14.2 Isi Setiap Tab

### Dashboard

* Worker Dashboard Screen

### Tugas

* Worker Task List Screen
* Worker Task Detail Screen

### Pohon

* Worker Tree List Screen
* Worker Tree Detail Screen
* Worker Create Condition Report Screen
* Worker Create Growth Phase Screen

### Laporan

* Worker Create Operational Report Screen
* Worker Operational Report List Screen

### Profile

* Profile Screen
* Edit Profile Screen

---

# 15. Navigation Flow Utama

## 15.1 Flow Auth dan Onboarding

```txt
Get Started
↓
Login / Register
↓
Cek session dan membership
↓
Jika belum punya membership:
  Onboarding Decision
  ├── Buat Kebun → Create Farm → Owner Dashboard
  └── Gabung Kebun → Join Farm → Pending Approval
↓
Jika owner active:
  Owner Dashboard
↓
Jika worker active:
  Worker Dashboard
↓
Jika worker pending:
  Pending Approval
↓
Jika worker rejected:
  Rejected Screen
↓
Jika worker removed:
  Removed Access Screen
```

---

## 15.2 Flow Owner Mengelola Pohon

```txt
Owner Dashboard / Tab Pohon
↓
Owner Tree List
↓
Pilih aksi:
  ├── Tambah Pohon → Create Tree → Tree List
  ├── Pilih Pohon → Tree Detail
  │     ├── Edit Pohon → Edit Tree → Tree Detail
  │     ├── Catat Kondisi → Create Condition Report → Tree Detail
  │     ├── Catat Fase → Create Growth Phase → Tree Detail
  │     └── Arsipkan Pohon → Tree List
  └── Filter/Search Pohon → Tree List
```

---

## 15.3 Flow Worker Melaporkan Kondisi Pohon

```txt
Worker Dashboard / Tab Pohon
↓
Worker Tree List
↓
Pilih Pohon
↓
Tree Detail
↓
Catat Kondisi
↓
Create Condition Report
↓
Simpan
↓
Sistem memperbarui kondisi terbaru pohon
↓
Kembali ke Tree Detail
```

---

## 15.4 Flow Worker Mencatat Fase Pohon

```txt
Worker Dashboard / Tab Pohon
↓
Worker Tree List
↓
Pilih Pohon
↓
Tree Detail
↓
Catat Fase
↓
Create Growth Phase
↓
Simpan
↓
Sistem memperbarui fase terbaru pohon
↓
Kembali ke Tree Detail
```

---

## 15.5 Flow Worker Membuat Laporan Operasional

```txt
Worker Dashboard / Tab Laporan
↓
Create Operational Report
↓
Pilih kategori laporan
↓
Isi lokasi/catatan singkat
↓
Simpan laporan
↓
Sistem menyimpan status laporan = baru
↓
Owner dapat melihat laporan di Operational Report List
```

---

## 15.6 Flow Owner Menindaklanjuti Laporan Operasional

```txt
Owner Dashboard / Tab Laporan
↓
Operational Report List
↓
Operational Report Detail
↓
Pilih tindakan:
  ├── Ubah status laporan
  │     ├── Baru
  │     ├── Diproses
  │     ├── Selesai
  │     └── Ditolak
  └── Buat tugas tindak lanjut
        ↓
        Create Task From Operational Report
        ↓
        Pilih worker, tanggal, target, instruksi
        ↓
        Simpan tugas
        ↓
        Worker melihat tugas di daftar tugas
```

---

## 15.7 Flow Owner Membuat SOP

```txt
Owner Tab Kebun/Profile
↓
Care SOP List
↓
Create Care SOP
↓
Isi nama SOP, kategori, interval, instruksi, target default
↓
Simpan SOP
↓
SOP muncul di Care SOP List
```

---

## 15.8 Flow Owner Membuat Jadwal dari SOP

```txt
Owner Tab Jadwal / Care SOP Detail
↓
Pilih SOP
↓
Sistem menampilkan acuan jadwal berikutnya
↓
Owner memilih Buat Jadwal dari SOP
↓
Create Schedule From SOP
↓
Sistem mengisi kategori dan instruksi dari SOP
↓
Owner memilih tanggal, worker, target, instruksi
↓
Simpan jadwal
↓
Sistem membuat Care Schedule
↓
Sistem membuat Care Task
↓
Worker melihat tugas di Worker Task List
```

---

## 15.9 Flow Owner Membuat Jadwal Manual

```txt
Owner Tab Jadwal
↓
Care Schedule List
↓
Create Manual Schedule
↓
Isi judul, kategori, tanggal, worker, target, instruksi
↓
Simpan jadwal
↓
Sistem membuat Care Schedule
↓
Sistem membuat Care Task
↓
Worker melihat tugas di Worker Task List
```

---

## 15.10 Flow Worker Merealisasikan Tugas

```txt
Worker Dashboard / Tab Tugas
↓
Worker Task List
↓
Worker Task Detail
↓
Pilih aksi:
  ├── Selesai
  │     ↓
  │   Isi catatan opsional
  │     ↓
  │   Sistem membuat Care Activity status completed
  │     ↓
  │   Sistem memperbarui Care Task status completed
  │
  └── Tunda
        ↓
      Isi alasan/catatan
        ↓
      Sistem membuat Care Activity status postponed
        ↓
      Sistem memperbarui Care Task status postponed
```

---

## 15.11 Flow Owner Mengelola Worker

```txt
Owner Tab Kebun/Profile
↓
Worker Management
↓
Pilih daftar:
  ├── Worker Pending
  │     ├── Approve → status active
  │     └── Reject → status rejected
  │
  └── Worker Active
        └── Remove Worker → status removed
```

---

# 16. Screen Prioritization

Karena MVP tetap harus realistis, halaman dapat diprioritaskan dalam beberapa level.

## 16.1 Priority 1 / Wajib untuk MVP Dasar

| Screen                   | Aktor         |
| ------------------------ | ------------- |
| Get Started              | Owner, Worker |
| Login                    | Owner, Worker |
| Register                 | Owner, Worker |
| Onboarding Decision      | Owner, Worker |
| Create Farm              | Owner         |
| Join Farm                | Worker        |
| Pending Approval         | Worker        |
| Rejected Screen          | Worker        |
| Removed Access           | Worker        |
| Owner Dashboard          | Owner         |
| Worker Dashboard         | Worker        |
| Owner Tree List          | Owner         |
| Worker Tree List         | Worker        |
| Tree Detail              | Owner, Worker |
| Create Tree              | Owner         |
| Create Condition Report  | Owner, Worker |
| Worker Task List         | Worker        |
| Worker Task Detail       | Worker        |
| Care Schedule List       | Owner         |
| Create Schedule From SOP | Owner         |
| Care SOP List            | Owner         |
| Create Care SOP          | Owner         |
| Create Growth Phase Record | Owner, Worker |
| Growth Monitoring        | Owner         |
| Profile                  | Owner, Worker |

---

## 16.2 Priority 2 / Penting untuk MVP Lengkap

| Screen                              | Aktor         |
| ----------------------------------- | ------------- |
| Edit Tree                           | Owner         |
| Archived Tree List                  | Owner         |
| Worker Management                   | Owner         |
| Operational Report List             | Owner         |
| Operational Report Detail           | Owner         |
| Create Operational Report           | Worker        |
| Create Task From Operational Report | Owner         |
| Create Manual Schedule              | Owner         |
| Care SOP Detail                     | Owner         |
| Edit Care SOP                       | Owner         |
| Owner Task List                     | Owner         |
| Owner Task Detail                   | Owner         |
| Tree History Full Screen            | Owner, Worker |

---

## 16.3 Priority 3 / Bisa Setelah MVP Stabil

| Screen                         | Aktor         |
| ------------------------------ | ------------- |
| Worker Operational Report List | Worker        |
| Edit Profile                   | Owner, Worker |
| Care Schedule Detail           | Owner         |
| Farm Detail                    | Owner         |
| Advanced Filter Tree           | Owner, Worker |
| Advanced Filter Task           | Owner, Worker |

---

# 17. Reusable Screen Components

Agar UI tidak dibuat ulang seperti manusia yang baru pertama kali menemukan tombol, komponen berikut sebaiknya reusable.

## 17.1 Layout Components

| Komponen       | Fungsi                        |
| -------------- | ----------------------------- |
| `AppScreen`    | Wrapper halaman utama         |
| `ScreenHeader` | Header halaman                |
| `BottomTabs`   | Navigasi bawah                |
| `SectionCard`  | Card untuk kelompok informasi |
| `EmptyState`   | Tampilan ketika data kosong   |
| `LoadingState` | Tampilan loading              |
| `ErrorState`   | Tampilan error                |

---

## 17.2 Data Display Components

| Komponen              | Fungsi                      |
| --------------------- | --------------------------- |
| `TreeCard`            | Card daftar pohon           |
| `TaskCard`            | Card daftar tugas           |
| `ReportCard`          | Card laporan operasional    |
| `SOPCard`             | Card SOP                    |
| `WorkerCard`          | Card pekerja                |
| `DashboardStatCard`   | Card statistik dashboard    |
| `HistoryTimelineItem` | Item timeline riwayat pohon |
| `StatusBadge`         | Badge status                |

---

## 17.3 Form Components

| Komponen          | Fungsi                                       |
| ----------------- | -------------------------------------------- |
| `TextField`       | Input teks                                   |
| `SelectField`     | Pilihan kategori/status                      |
| `DatePickerField` | Input tanggal                                |
| `TargetPicker`    | Pilihan target farm/baris/kolom/pohon; custom hanya untuk jadwal atau tugas manual |
| `WorkerPicker`    | Pilihan worker                               |
| `TreePicker`      | Pilihan pohon                                |
| `SubmitButton`    | Tombol submit                                |
| `ConfirmDialog`   | Dialog konfirmasi                            |

---

# 18. Screen yang Tidak Dibuat dalam MVP

Halaman berikut tidak dibuat dalam MVP Avology V2:

1. Prediksi panen
2. Machine learning dashboard
3. Push notification settings
4. IoT sensor dashboard
5. Weather dashboard
6. Chat owner-worker
7. Financial report
8. PDF report generator
9. Integrated farming dashboard
10. Livestock management
11. Marketplace
12. Fruit grading
13. Farmer group management
14. Supply chain management
15. Restaurant/warung management

Halaman-halaman ini berada di luar scope MVP. Menaruhnya sekarang hanya akan membuat aplikasi tampak ambisius sambil diam-diam membakar waktu pengembangan.

---

# 19. Ringkasan Screen Final

## Public / Auth

1. Get Started
2. Login
3. Register

## Onboarding

1. Onboarding Decision
2. Create Farm
3. Join Farm
4. Pending Approval
5. Rejected
6. Removed Access

## Owner

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

## Worker

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

---

# 20. Ringkasan Navigasi Final

Avology V2 menggunakan navigasi berbasis role:

## Owner Navigation

```txt
Owner
├── Dashboard
├── Pohon
│   ├── Tree List
│   ├── Tree Detail
│   ├── Create Tree
│   ├── Edit Tree
│   ├── Create Condition Report
│   └── Create Growth Phase
├── Jadwal
│   ├── Care Schedule List
│   ├── Care Schedule Detail
│   ├── Create Schedule From SOP
│   ├── Create Manual Schedule
│   ├── Owner Task List
│   └── Owner Task Detail
├── Laporan
│   ├── Operational Report List
│   ├── Operational Report Detail
│   └── Create Task From Report
└── Kebun/Profile
    ├── Worker Management
    ├── Care SOP List
    ├── Care SOP Detail
    ├── Create Care SOP
    ├── Edit Care SOP
    ├── Farm Detail
    └── Profile
```

## Worker Navigation

```txt
Worker
├── Dashboard
├── Tugas
│   ├── Task List
│   └── Task Detail
├── Pohon
│   ├── Tree List
│   ├── Tree Detail
│   ├── Create Condition Report
│   └── Create Growth Phase
├── Laporan
│   ├── Create Operational Report
│   └── Operational Report List
└── Profile
```

---

# 21. Kesimpulan

Screen inventory dan navigation flow Avology V2 disusun berdasarkan kebutuhan sistem, bukan berdasarkan keinginan menambah halaman sebanyak mungkin.

Halaman owner difokuskan pada pengelolaan dan monitoring kebun, sedangkan halaman worker difokuskan pada tugas dan laporan lapangan.

Dengan struktur ini, Avology V2 memiliki navigasi yang jelas, modular, dan siap dilanjutkan ke tahap desain UI/wireframe serta implementasi frontend.
