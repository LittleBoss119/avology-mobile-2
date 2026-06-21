# UI/UX Polish Decision Avology V2

Dokumen ini berisi keputusan final UI/UX polish Avology V2 berdasarkan review aplikasi Iteration 7 dan diskusi desain. Dokumen ini menjadi acuan implementasi Codex agar perubahan UI konsisten, tidak melebar, dan tidak merusak logic aplikasi yang sudah berjalan.

---

## 1. Tujuan UI/UX Polish

UI/UX polish dilakukan karena aplikasi Avology V2 secara fungsi sudah berjalan, tetapi tampilan masih terlalu polos, terasa generik, dan belum cukup kuat sebagai aplikasi mobile yang siap diuji pengguna.

Fokus polish:

1. Membuat tampilan lebih profesional dan tidak terlihat seperti UI hasil generate mentah.
2. Membuat navigasi lebih jelas untuk owner dan worker.
3. Membuat dashboard benar-benar memberi insight, bukan hanya angka mentah.
4. Membuat halaman list, detail, dan form memiliki pola desain yang konsisten.
5. Mengurangi tombol yang tidak perlu seperti tombol refresh manual.
6. Menghilangkan tampilan data teknis seperti UUID dari UI user.
7. Memastikan worker flow tetap sederhana dan minim input teks.
8. Menjaga agar perubahan awal hanya menyentuh UI, bukan database, RLS, atau service besar.

---

## 2. Prinsip Desain Global

Avology V2 menggunakan pendekatan mobile-first dengan tampilan bersih, natural, dan sederhana.

Prinsip utama:

1. Setiap halaman memakai layout konsisten.
2. Setiap role memiliki navigasi yang jelas.
3. Owner boleh memiliki fitur lebih banyak, tetapi tetap harus terstruktur.
4. Worker harus memiliki flow yang lebih sederhana.
5. Form worker harus minim input teks.
6. Action penting tidak boleh tersembunyi di bawah halaman.
7. Data teknis seperti ID database tidak boleh tampil ke user.
8. Refresh data dilakukan secara natural melalui pull-to-refresh atau reload saat halaman dibuka.
9. Tombol refresh manual dihapus dari halaman utama.
10. Halaman dengan fungsi mirip wajib memakai komponen reusable.

---

## 3. Visual Direction

Arah visual Avology:

* Natural
* Bersih
* Modern
* Agricultural
* Tidak terlalu ramai
* Tidak terlalu corporate
* Tidak terlihat seperti template AI mentah

Logo Avology yang sudah dibuat user harus digunakan terutama pada:

1. Get Started
2. Login
3. Register
4. Header dashboard jika cocok
5. Empty state tertentu jika relevan

---

## 4. Color Palette

Gunakan warna berikut sebagai acuan utama.

```txt
Primary Green: #065F2E
Primary Green Dark: #044722
Primary Green Light: #E7F5EC

Background: #F7FAF3
Surface/Card: #FFFFFF
Surface Soft: #F1F6EA

Text Primary: #17231B
Text Secondary: #5B6B60
Text Muted: #8A978D

Border: #DDE8D8
Divider: #E8EFE4

Success: #16803C
Warning: #B7791F
Danger: #C2410C
Info: #2563EB

Archived/Disabled: #6B7280
```

---

## 5. Komponen UI yang Harus Dipakai

Project saat ini memiliki UI foundation di file `ui.tsx`. Gunakan komponen yang sudah tersedia dan jangan membuat komponen duplikat jika tidak diperlukan.

Komponen utama:

1. AppScreen
2. ScreenHeader
3. AppCard
4. AppButton
5. AppTextInput
6. PasswordInput
7. StatusBadge
8. EmptyState
9. LoadingState
10. ErrorState
11. SearchFilterBar
12. FloatingActionButton
13. SectionHeader
14. InfoRow
15. ConfirmDialog

Jika komponen belum lengkap, lengkapi di `ui.tsx` tanpa mengubah service, database, atau routing besar.

---

## 6. Pola Halaman

### 6.1 Auth Screen

Berlaku untuk:

* Get Started
* Login
* Register

Pola desain:

1. Logo Avology di area atas.
2. Headline singkat.
3. Deskripsi singkat.
4. Card form atau card CTA.
5. Tombol utama jelas.
6. Link antar auth dibuat sebagai teks natural.

Contoh copy:

* Login: `Belum punya akun? Buat akun`
* Register: `Sudah punya akun? Masuk`

Password wajib memiliki fitur lihat/sembunyikan password.

Register wajib memiliki confirm password dengan validasi lokal sebelum submit.

---

### 6.2 Onboarding Screen

Berlaku untuk:

* Onboarding Decision
* Buat Kebun
* Gabung Kebun
* Pending Approval
* Rejected
* Removed Access

Keputusan:

1. Onboarding Decision tidak boleh hanya berupa dua tombol polos.
2. Pilihan dibuat sebagai dua card:

   * Buat Kebun sebagai Owner
   * Gabung Kebun sebagai Worker
3. Create Farm tetap memakai input sederhana:

   * nama kebun
   * lokasi
   * luas kebun
4. Luas kebun harus menampilkan satuan m².
5. Create Farm perlu confirmation dialog sebelum submit.
6. Join Farm tidak perlu histori kebun dulu.
7. Pending/Rejected/Removed dibuat sebagai status screen yang rapi.
8. User yang belum punya role boleh mengakses profile user dasar untuk edit nama/nomor dan logout, tetapi tidak boleh mengakses data operasional kebun.

---

### 6.3 Dashboard

Dashboard tidak boleh hanya menampilkan kumpulan angka mentah.

#### Dashboard Owner

Dashboard owner harus memberi insight cepat untuk pengambilan keputusan.

Isi utama:

1. Sapaan dan nama kebun.
2. Ringkasan kondisi hari ini.
3. Insight penting:

   * tugas hari ini
   * tugas belum selesai
   * laporan operasional baru
   * pohon butuh perhatian
   * SOP jatuh tempo atau terlambat
   * pohon berbunga
   * pohon berbuah
4. Quick action:

   * tambah pohon
   * buat jadwal
   * lihat laporan baru
   * catat kondisi
5. Tidak ada tombol refresh manual.

#### Dashboard Worker

Dashboard worker fokus pada pekerjaan hari ini.

Isi utama:

1. Sapaan dan nama kebun.
2. Tugas hari ini.
3. Tugas belum selesai.
4. Shortcut:

   * lihat tugas
   * catat kondisi pohon
   * catat fase pohon
   * buat laporan operasional
5. Tidak perlu terlalu banyak angka.
6. Tidak ada tombol refresh manual.

---

## 7. Bottom Navigation

Navigasi dashboard tidak boleh berupa tumpukan tombol.

### Owner Bottom Navigation

Gunakan tab:

1. Dashboard
2. Pohon
3. Jadwal
4. Laporan
5. Kebun

Catatan:

* Worker Management, SOP, Join Code, Farm Profile, dan pengaturan kebun masuk ke tab Kebun.
* Profile user dapat diakses dari tab Kebun atau header/profile entry.

### Worker Bottom Navigation

Gunakan tab:

1. Dashboard
2. Tugas
3. Pohon
4. Laporan
5. Profile

Catatan:

* Worker tidak perlu tombol terpisah untuk Catat Kondisi dan Catat Fase di dashboard jika keduanya hanya mengarah ke halaman Pohon.
* Aksi catat kondisi/fase cukup tersedia dari list/detail pohon atau quick action yang jelas.

---

## 8. List Page Pattern

Berlaku untuk:

* Pohon
* Jadwal Perawatan
* Tugas Worker
* Laporan Operasional
* Worker Management
* SOP Perawatan

Pola:

1. ScreenHeader
2. SearchFilterBar jika data banyak atau perlu pencarian
3. Filter horizontal/chip, bukan vertical list
4. Card list konsisten
5. EmptyState jika data kosong
6. Pull-to-refresh jika perlu refresh data
7. Tidak ada tombol refresh manual

### Pohon

Pohon menggunakan grid 2 kolom.

Card pohon menampilkan:

1. Foto pohon atau placeholder
2. Kode lokasi pohon
3. Varietas
4. Kondisi terbaru
5. Fase terbaru
6. Badge status jika arsip

Tambah pohon menggunakan FloatingActionButton.

### Jadwal, Tugas, Laporan, SOP

Tetap 1 kolom, tetapi card harus lebih ramping dan mudah discroll.

Card sebaiknya menampilkan:

1. Judul utama
2. Status badge
3. Tanggal
4. Target
5. Info ringkas lain sesuai konteks

---

## 9. Detail Page Pattern

Berlaku untuk:

* Detail Pohon
* Detail Jadwal
* Detail Tugas
* Detail Laporan Operasional
* Detail SOP

Pola header:

```txt
Back Button | Judul Halaman | Menu Titik Tiga
```

Menu titik tiga dipakai untuk action sekunder seperti:

* edit
* arsipkan
* nonaktifkan
* buat jadwal dari SOP
* hapus draft jika aman

Tombol seperti `Kembali ke Jadwal`, `Kembali ke Tugas`, dan tombol refresh manual dihapus karena sudah ada back navigation.

---

## 10. Detail Pohon

Keputusan:

1. Detail pohon menggunakan hero image di bagian atas.
2. Jika belum ada foto, tampilkan placeholder.
3. Kode pohon sebaiknya dihasilkan dari lokasi, bukan input nama bebas.
4. Tampilkan umur pohon berdasarkan tanggal tanam:

   * kurang dari 1 bulan: tampilkan hari
   * kurang dari 1 tahun: tampilkan bulan
   * lebih dari atau sama dengan 1 tahun: tampilkan tahun
5. Riwayat pohon harus berbentuk timeline, bukan kotak-kotak biasa.
6. Bahasa timeline harus konsisten, gunakan Bahasa Indonesia.
7. `reported_by` atau actor tidak boleh tampil sebagai UUID, harus nama user.
8. Catatan kosong ditampilkan sebagai `-`.
9. Worker detail pohon tidak memiliki edit, arsip, atau hapus.
10. Owner detail pohon memiliki action di menu titik tiga.

---

## 11. Kode Pohon

Kode pohon tidak ideal jika diketik manual sebagai nama bebas.

Keputusan awal:

1. User mengisi baris dan kolom.
2. Sistem membuat kode lokasi pohon dari baris dan kolom.
3. Contoh format:

   * `A-01`
   * `B-12`
   * `21-A`
4. Format final mengikuti struktur data yang paling aman di project.

Catatan penting:

Permanent delete pohon tidak dikerjakan dulu. Jika pohon mati atau diganti, gunakan archive. Jika perlu menanam pohon baru pada lokasi yang sama, perlu strategi generasi tanam seperti:

```txt
A-01-G2
```

Implementasi kode otomatis boleh ditunda jika membutuhkan perubahan database atau migrasi besar.

---

## 12. Form Page Pattern

Berlaku untuk:

* Tambah Pohon
* Edit Pohon
* Catat Kondisi
* Catat Fase
* Buat Jadwal Manual
* Buat Jadwal dari SOP
* Edit SOP
* Buat Laporan Worker
* Edit Profile
* Ubah Password

Pola:

1. ScreenHeader
2. AppCard untuk form
3. Label input jelas
4. DatePicker untuk tanggal
5. Picker/chip untuk pilihan status/kategori
6. Textarea hanya jika perlu
7. Submit button jelas
8. Confirmation dialog untuk aksi penting
9. Form owner boleh lebih lengkap
10. Form worker harus sederhana dan minim teks

Tanggal tidak boleh diketik manual jika bisa dibuat memakai datepicker.

---

## 13. Profile dan Kebun

Profile user dan profile kebun sebaiknya dipisah.

### Profile User

Berisi:

1. Nama
2. Email
3. Nomor HP
4. Edit profile
5. Ubah password
6. Logout

### Profile/Kebun

Berisi:

1. Nama kebun
2. Lokasi kebun
3. Luas kebun
4. Join code
5. Copy join code
6. Worker Management
7. SOP Perawatan
8. Pengaturan kebun lain jika diperlukan

Untuk owner, tab `Kebun` menjadi pusat manajemen kebun.

Untuk worker, profile cukup menampilkan data user dan status kebun secara sederhana.

---

## 14. Fitur yang Ditunda

Fitur berikut tidak dikerjakan pada tahap UI polish awal karena membutuhkan perubahan database, storage, atau logic besar:

1. Upload foto pohon.
2. Upload foto laporan operasional.
3. Bukti foto realisasi tugas.
4. Field `requires_photo`.
5. Multi-select pohon pada jadwal.
6. Histori kebun worker.
7. Permanent delete pohon.
8. Perubahan besar schema target jadwal.
9. Multi-farm complex flow.

Fitur ini boleh dikerjakan setelah UI dasar stabil.

---

## 15. Keputusan Tentang Foto

Foto penting untuk Avology, tetapi tidak masuk tahap polish awal.

Rencana tahap berikutnya:

1. Foto utama pohon.
2. Foto laporan operasional opsional.
3. Foto bukti tugas jika tugas membutuhkan bukti.
4. Foto laporan kondisi opsional.

Implementasi foto harus dilakukan sebagai mini-iteration tersendiri karena membutuhkan Supabase Storage, permission, upload handling, fallback image, dan kemungkinan tabel attachment.

---

## 16. Keputusan Tentang Delete Pohon

Permanent delete pohon tidak dikerjakan pada tahap ini.

Alasan:

1. Riwayat pohon harus tetap aman.
2. Pohon yang sudah punya laporan, fase, tugas, atau aktivitas tidak boleh dihapus sembarangan.
3. Archive lebih sesuai untuk menjaga histori.

Jika nanti tetap ingin ada delete, hanya boleh untuk data salah input yang belum punya histori sama sekali. Ini perlu validasi service terpisah dan tidak dikerjakan sekarang.

---

## 17. Urutan Implementasi UI Polish

Implementasi harus bertahap.

### Tahap 1 - Auth dan Onboarding

Screen:

1. Get Started
2. Login
3. Register
4. Onboarding Decision
5. Create Farm
6. Join Farm
7. Pending Approval
8. Rejected
9. Removed Access

Target:

* Logo tampil
* Layout auth lebih profesional
* Password eye toggle
* Confirm password
* Onboarding pakai option card
* Create farm pakai satuan m² dan confirm dialog
* Status screen lebih rapi

---

### Tahap 2 - Bottom Navigation

Target:

* Owner bottom nav
* Worker bottom nav
* Tombol navigasi bertumpuk di dashboard dihapus
* Route guard tetap aman

---

### Tahap 3 - Dashboard

Target:

* Dashboard owner menjadi insight-based
* Dashboard worker fokus tugas hari ini
* Quick action rapi
* Refresh manual dihapus

---

### Tahap 4 - List Pages

Screen:

1. Pohon Owner
2. Pohon Worker
3. Jadwal Perawatan Owner
4. Tugas Worker Owner
5. Tugas Saya Worker
6. Laporan Operasional Owner
7. Worker Management
8. SOP Perawatan

Target:

* Search/filter konsisten
* Pohon grid 2 kolom
* Card ramping
* FAB untuk tambah data
* Refresh manual dihapus

---

### Tahap 5 - Detail Pages

Screen:

1. Detail Pohon Owner
2. Detail Pohon Worker
3. Detail Jadwal
4. Detail Tugas Owner
5. Detail Tugas Worker
6. Detail SOP
7. Detail Laporan Operasional

Target:

* Header back-title-menu
* Action masuk menu titik tiga
* UUID diganti nama/kode
* Timeline pohon dibuat rapi
* Tombol kembali manual dihapus
* Refresh manual dihapus

---

### Tahap 6 - Form Pages

Screen:

1. Tambah Pohon
2. Edit Pohon
3. Catat Kondisi
4. Catat Fase
5. Buat Jadwal Manual
6. Buat Jadwal dari SOP
7. Edit SOP
8. Buat Laporan Worker

Target:

* Form lebih rapi
* Datepicker untuk tanggal
* Input pilihan lebih mudah
* Worker form minim teks
* Submit button jelas

---

### Tahap 7 - Profile dan Kebun

Target:

* Profile user dipisah dari profile kebun
* Edit profile
* Ubah password
* Copy join code
* Worker management masuk area Kebun untuk owner
* Refresh manual dihapus

---

### Tahap 8 - Media Features

Dikerjakan belakangan setelah UI stabil.

Target:

* Foto pohon
* Foto laporan
* Bukti tugas
* Storage Supabase
* Validasi attachment

---

## 18. Larangan Implementasi Tahap UI Polish Awal

Codex tidak boleh:

1. Mengubah database.
2. Mengubah RLS.
3. Mengubah RPC.
4. Mengubah service layer besar.
5. Menghapus fitur yang sudah berjalan.
6. Mengimplementasikan permanent delete pohon.
7. Mengimplementasikan upload foto.
8. Mengimplementasikan histori kebun worker.
9. Mengimplementasikan multi-select pohon.
10. Mengubah guard role secara besar.
11. Membuat komponen UI duplikat tanpa alasan.
12. Mengubah semua screen sekaligus.

---

## 19. Testing Setelah Setiap Tahap

Setelah setiap tahap, wajib cek:

1. TypeScript tidak error.
2. App bisa dibuka di Expo.
3. Login owner masih bisa.
4. Login worker masih bisa.
5. Route guard tidak rusak.
6. Data dari Supabase tetap tampil.
7. Submit form utama masih berjalan.
8. Tidak ada screen blank.
9. Tidak ada tombol penting yang hilang.
10. Tidak ada UUID yang tampil ke user pada screen yang sudah dipolish.

---

## 20. Catatan Final

UI polish ini bertujuan memperbaiki tampilan dan pengalaman pengguna tanpa mengubah pondasi fitur yang sudah selesai.

Fokus sekarang bukan menambah fitur besar, tetapi membuat Avology V2 terlihat layak sebagai aplikasi mobile untuk UAT dan presentasi skripsi.

Fitur besar seperti foto, bukti tugas, dan perubahan struktur data harus masuk mini-iteration terpisah setelah UI dasar stabil.
