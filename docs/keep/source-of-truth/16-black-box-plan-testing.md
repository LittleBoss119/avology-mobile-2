# Black-box Testing Plan Avology V2

## 1. Tujuan Pengujian

Black-box testing digunakan untuk menguji apakah fitur-fitur pada aplikasi Avology V2 berjalan sesuai dengan kebutuhan fungsional yang telah ditentukan.

Pengujian dilakukan dari sisi pengguna tanpa melihat struktur kode program. Fokus pengujian adalah input, proses sistem, dan output yang dihasilkan.

Pengujian ini bertujuan untuk memastikan bahwa fitur utama seperti autentikasi, manajemen kebun, manajemen worker, data pohon, laporan kondisi, laporan operasional, SOP, jadwal, tugas worker, fase pertumbuhan, riwayat pohon, dan dashboard dapat berjalan sesuai rancangan.

---

## 2. Ruang Lingkup Pengujian

Pengujian black-box Avology V2 mencakup modul berikut:

1. Autentikasi dan role pengguna
2. Manajemen kebun
3. Manajemen worker
4. Manajemen data pohon
5. Laporan kondisi pohon
6. Laporan operasional kebun
7. SOP perawatan
8. Jadwal perawatan
9. Tugas worker
10. Fase pertumbuhan pohon
11. Riwayat pohon
12. Dashboard owner
13. Dashboard worker
14. Pembatasan akses berdasarkan role
15. UX dasar dan konsistensi data

---

## 3. Metode Pengujian

Metode pengujian yang digunakan adalah **black-box testing** dengan pendekatan skenario uji.

Setiap skenario pengujian berisi:

* ID test case
* Modul
* Skenario pengujian
* Prasyarat
* Langkah pengujian
* Data input
* Hasil yang diharapkan
* Hasil aktual
* Status pengujian

Status pengujian dapat berupa:

| Status  | Keterangan                                             |
| ------- | ------------------------------------------------------ |
| Pass    | Hasil aktual sesuai dengan hasil yang diharapkan       |
| Fail    | Hasil aktual tidak sesuai dengan hasil yang diharapkan |
| Pending | Pengujian belum dilakukan atau perlu diuji ulang       |

---

## 4. Format Tabel Pengujian

Format tabel pengujian yang digunakan:

| ID Test | Modul | Skenario | Prasyarat | Langkah Pengujian | Input | Expected Result | Actual Result | Status |
| ------- | ----- | -------- | --------- | ----------------- | ----- | --------------- | ------------- | ------ |

Catatan:

Kolom **Actual Result** dan **Status** diisi setelah pengujian dilakukan pada aplikasi.

---

# 5. Test Case Autentikasi

## TC-AUTH-01 Register dengan Data Valid

| Item              | Detail                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| ID Test           | TC-AUTH-01                                                                                           |
| Modul             | Autentikasi                                                                                          |
| Skenario          | User melakukan registrasi dengan data valid                                                          |
| Prasyarat         | User belum memiliki akun                                                                             |
| Langkah Pengujian | 1. Buka halaman Register. 2. Isi nama, email, nomor telepon, dan password. 3. Tekan tombol Register. |
| Input             | Nama: Abah, Email: [abah@example.com](mailto:abah@example.com), Password: password123                |
| Expected Result   | Akun berhasil dibuat dan user diarahkan ke halaman onboarding atau login                             |
| Actual Result     |                                                                                                      |
| Status            |                                                                                                      |

---

## TC-AUTH-02 Register dengan Email Kosong

| Item              | Detail                                                                 |
| ----------------- | ---------------------------------------------------------------------- |
| ID Test           | TC-AUTH-02                                                             |
| Modul             | Autentikasi                                                            |
| Skenario          | User melakukan registrasi tanpa mengisi email                          |
| Prasyarat         | User berada di halaman Register                                        |
| Langkah Pengujian | 1. Kosongkan field email. 2. Isi field lain. 3. Tekan tombol Register. |
| Input             | Nama: Abah, Email: kosong, Password: password123                       |
| Expected Result   | Sistem menampilkan pesan kesalahan bahwa email wajib diisi             |
| Actual Result     |                                                                        |
| Status            |                                                                        |

---

## TC-AUTH-03 Login dengan Akun Valid

| Item              | Detail                                                                              |
| ----------------- | ----------------------------------------------------------------------------------- |
| ID Test           | TC-AUTH-03                                                                          |
| Modul             | Autentikasi                                                                         |
| Skenario          | User login dengan akun valid                                                        |
| Prasyarat         | User sudah memiliki akun                                                            |
| Langkah Pengujian | 1. Buka halaman Login. 2. Masukkan email dan password valid. 3. Tekan tombol Login. |
| Input             | Email dan password valid                                                            |
| Expected Result   | User berhasil login dan diarahkan sesuai role/status                                |
| Actual Result     |                                                                                     |
| Status            |                                                                                     |

---

## TC-AUTH-04 Login dengan Password Salah

| Item              | Detail                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------- |
| ID Test           | TC-AUTH-04                                                                                |
| Modul             | Autentikasi                                                                               |
| Skenario          | User login dengan password salah                                                          |
| Prasyarat         | User sudah memiliki akun                                                                  |
| Langkah Pengujian | 1. Buka halaman Login. 2. Masukkan email valid dan password salah. 3. Tekan tombol Login. |
| Input             | Email valid, password salah                                                               |
| Expected Result   | Sistem menampilkan pesan login gagal                                                      |
| Actual Result     |                                                                                           |
| Status            |                                                                                           |

---

## TC-AUTH-05 Logout Pengguna

| Item              | Detail                                                               |
| ----------------- | -------------------------------------------------------------------- |
| ID Test           | TC-AUTH-05                                                           |
| Modul             | Autentikasi                                                          |
| Skenario          | User keluar dari akun                                                |
| Prasyarat         | User sudah login                                                     |
| Langkah Pengujian | 1. Buka halaman Profile. 2. Tekan tombol Logout.                     |
| Input             | Tombol Logout                                                        |
| Expected Result   | User berhasil logout dan diarahkan ke halaman Login atau Get Started |
| Actual Result     |                                                                      |
| Status            |                                                                      |

---

## TC-AUTH-06 User Belum Memiliki Kebun Login

| Item              | Detail                                                 |
| ----------------- | ------------------------------------------------------ |
| ID Test           | TC-AUTH-06                                             |
| Modul             | Autentikasi dan Onboarding                             |
| Skenario          | User login tetapi belum memiliki membership kebun      |
| Prasyarat         | User sudah login dan belum tergabung ke kebun mana pun |
| Langkah Pengujian | 1. Login menggunakan akun yang belum memiliki kebun.   |
| Input             | Akun tanpa membership                                  |
| Expected Result   | Sistem mengarahkan user ke Onboarding Decision Screen  |
| Actual Result     |                                                        |
| Status            |                                                        |

---

# 6. Test Case Manajemen Kebun dan Membership

## TC-FARM-01 Owner Membuat Kebun dengan Data Valid

| Item              | Detail                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------- |
| ID Test           | TC-FARM-01                                                                               |
| Modul             | Manajemen Kebun                                                                          |
| Skenario          | Owner membuat data kebun                                                                 |
| Prasyarat         | User sudah login dan memilih Buat Kebun                                                  |
| Langkah Pengujian | 1. Buka Create Farm Screen. 2. Isi nama kebun, lokasi, dan luas. 3. Tekan tombol Simpan. |
| Input             | Nama: MS Farm, Lokasi: Tegal, Luas: 6500                                                 |
| Expected Result   | Data kebun berhasil dibuat dan user menjadi owner active                                 |
| Actual Result     |                                                                                          |
| Status            |                                                                                          |

---

## TC-FARM-02 Owner Membuat Kebun tanpa Nama

| Item              | Detail                                                             |
| ----------------- | ------------------------------------------------------------------ |
| ID Test           | TC-FARM-02                                                         |
| Modul             | Manajemen Kebun                                                    |
| Skenario          | Owner membuat kebun tanpa mengisi nama                             |
| Prasyarat         | User berada di Create Farm Screen                                  |
| Langkah Pengujian | 1. Kosongkan nama kebun. 2. Isi data lain. 3. Tekan tombol Simpan. |
| Input             | Nama kosong                                                        |
| Expected Result   | Sistem menampilkan pesan bahwa nama kebun wajib diisi              |
| Actual Result     |                                                                    |
| Status            |                                                                    |

---

## TC-FARM-03 Sistem Membuat Join Code

| Item              | Detail                                                           |
| ----------------- | ---------------------------------------------------------------- |
| ID Test           | TC-FARM-03                                                       |
| Modul             | Manajemen Kebun                                                  |
| Skenario          | Sistem membuat kode bergabung setelah kebun dibuat               |
| Prasyarat         | Owner berhasil membuat kebun                                     |
| Langkah Pengujian | 1. Buka halaman Farm Detail atau Kebun. 2. Lihat kode bergabung. |
| Input             | Data kebun valid                                                 |
| Expected Result   | Join code muncul dan bersifat unik                               |
| Actual Result     |                                                                  |
| Status            |                                                                  |

---

## TC-FARM-04 Owner Otomatis Menjadi Member Active

| Item              | Detail                                                              |
| ----------------- | ------------------------------------------------------------------- |
| ID Test           | TC-FARM-04                                                          |
| Modul             | Manajemen Kebun                                                     |
| Skenario          | Owner otomatis tergabung sebagai owner active setelah membuat kebun |
| Prasyarat         | Owner berhasil membuat kebun                                        |
| Langkah Pengujian | 1. Buat kebun. 2. Periksa akses dashboard owner.                    |
| Input             | Data kebun valid                                                    |
| Expected Result   | Owner dapat mengakses Owner Dashboard dan data kebun                |
| Actual Result     |                                                                     |
| Status            |                                                                     |

---

## TC-MEM-01 Worker Memasukkan Join Code Valid

| Item              | Detail                                                                            |
| ----------------- | --------------------------------------------------------------------------------- |
| ID Test           | TC-MEM-01                                                                         |
| Modul             | Membership                                                                        |
| Skenario          | Worker mengajukan bergabung dengan kode valid                                     |
| Prasyarat         | Worker sudah login dan memiliki join code                                         |
| Langkah Pengujian | 1. Buka Join Farm Screen. 2. Masukkan join code valid. 3. Tekan Ajukan Bergabung. |
| Input             | Join code valid                                                                   |
| Expected Result   | Pengajuan worker berhasil dibuat dengan status pending                            |
| Actual Result     |                                                                                   |
| Status            |                                                                                   |

---

## TC-MEM-02 Worker Memasukkan Join Code Salah

| Item              | Detail                                                    |
| ----------------- | --------------------------------------------------------- |
| ID Test           | TC-MEM-02                                                 |
| Modul             | Membership                                                |
| Skenario          | Worker mengajukan bergabung dengan kode tidak valid       |
| Prasyarat         | Worker berada di Join Farm Screen                         |
| Langkah Pengujian | 1. Masukkan kode salah. 2. Tekan Ajukan Bergabung.        |
| Input             | Join code salah                                           |
| Expected Result   | Sistem menampilkan pesan bahwa kode kebun tidak ditemukan |
| Actual Result     |                                                           |
| Status            |                                                           |

---

## TC-MEM-03 Worker Pending Login

| Item              | Detail                                                |
| ----------------- | ----------------------------------------------------- |
| ID Test           | TC-MEM-03                                             |
| Modul             | Membership                                            |
| Skenario          | Worker pending login ke aplikasi                      |
| Prasyarat         | Worker sudah mengajukan bergabung dan belum disetujui |
| Langkah Pengujian | 1. Login sebagai worker pending.                      |
| Input             | Akun worker pending                                   |
| Expected Result   | Worker diarahkan ke Pending Approval Screen           |
| Actual Result     |                                                       |
| Status            |                                                       |

---

## TC-MEM-04 Owner Approve Worker Pending

| Item              | Detail                                                                         |
| ----------------- | ------------------------------------------------------------------------------ |
| ID Test           | TC-MEM-04                                                                      |
| Modul             | Manajemen Worker                                                               |
| Skenario          | Owner menyetujui pengajuan worker                                              |
| Prasyarat         | Terdapat worker pending                                                        |
| Langkah Pengujian | 1. Owner membuka Worker Management. 2. Pilih worker pending. 3. Tekan Approve. |
| Input             | Worker pending                                                                 |
| Expected Result   | Status worker berubah menjadi active                                           |
| Actual Result     |                                                                                |
| Status            |                                                                                |

---

## TC-MEM-05 Owner Reject Worker Pending

| Item              | Detail                                                                        |
| ----------------- | ----------------------------------------------------------------------------- |
| ID Test           | TC-MEM-05                                                                     |
| Modul             | Manajemen Worker                                                              |
| Skenario          | Owner menolak pengajuan worker                                                |
| Prasyarat         | Terdapat worker pending                                                       |
| Langkah Pengujian | 1. Owner membuka Worker Management. 2. Pilih worker pending. 3. Tekan Reject. |
| Input             | Worker pending                                                                |
| Expected Result   | Status worker berubah menjadi rejected                                        |
| Actual Result     |                                                                               |
| Status            |                                                                               |

---

## TC-MEM-06 Worker Rejected Login

| Item              | Detail                                                                   |
| ----------------- | ------------------------------------------------------------------------ |
| ID Test           | TC-MEM-06                                                                |
| Modul             | Membership                                                               |
| Skenario          | Worker rejected login ke aplikasi                                        |
| Prasyarat         | Worker memiliki status rejected                                          |
| Langkah Pengujian | 1. Login sebagai worker rejected.                                        |
| Input             | Akun worker rejected                                                     |
| Expected Result   | Worker tidak dapat mengakses data kebun dan diarahkan ke Rejected Screen |
| Actual Result     |                                                                          |
| Status            |                                                                          |

---

## TC-MEM-07 Owner Remove Worker Active

| Item              | Detail                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| ID Test           | TC-MEM-07                                                                                               |
| Modul             | Manajemen Worker                                                                                        |
| Skenario          | Owner mengeluarkan worker aktif dari kebun                                                              |
| Prasyarat         | Terdapat worker active                                                                                  |
| Langkah Pengujian | 1. Owner membuka Worker Management. 2. Pilih worker active. 3. Tekan Remove Worker. 4. Konfirmasi aksi. |
| Input             | Worker active                                                                                           |
| Expected Result   | Status worker berubah menjadi removed                                                                   |
| Actual Result     |                                                                                                         |
| Status            |                                                                                                         |

---

## TC-MEM-08 Worker Removed Login

| Item              | Detail                                                                         |
| ----------------- | ------------------------------------------------------------------------------ |
| ID Test           | TC-MEM-08                                                                      |
| Modul             | Membership                                                                     |
| Skenario          | Worker removed mencoba login                                                   |
| Prasyarat         | Worker memiliki status removed                                                 |
| Langkah Pengujian | 1. Login sebagai worker removed.                                               |
| Input             | Akun worker removed                                                            |
| Expected Result   | Worker tidak dapat mengakses data kebun dan diarahkan ke Removed Access Screen |
| Actual Result     |                                                                                |
| Status            |                                                                                |

---

## TC-MEM-09 Riwayat Worker Removed Tetap Ada

| Item              | Detail                                                                               |
| ----------------- | ------------------------------------------------------------------------------------ |
| ID Test           | TC-MEM-09                                                                            |
| Modul             | Manajemen Worker                                                                     |
| Skenario          | Riwayat tugas/laporan worker yang dihapus tetap tersimpan                            |
| Prasyarat         | Worker pernah membuat tugas/laporan lalu di-remove                                   |
| Langkah Pengujian | 1. Owner membuka riwayat tugas/laporan lama. 2. Cek data yang dibuat worker removed. |
| Input             | Worker removed dengan histori                                                        |
| Expected Result   | Histori tetap tampil dan tidak hilang                                                |
| Actual Result     |                                                                                      |
| Status            |                                                                                      |

---

# 7. Test Case Manajemen Pohon

## TC-TREE-01 Owner Menambah Pohon Valid

| Item              | Detail                                                                              |
| ----------------- | ----------------------------------------------------------------------------------- |
| ID Test           | TC-TREE-01                                                                          |
| Modul             | Manajemen Pohon                                                                     |
| Skenario          | Owner menambahkan data pohon dengan data valid                                      |
| Prasyarat         | Owner sudah login dan memiliki kebun                                                |
| Langkah Pengujian | 1. Buka Owner Tree List. 2. Tekan Tambah Pohon. 3. Isi data pohon. 4. Tekan Simpan. |
| Input             | Kode: P-01, Baris: A, Kolom: 01, Varietas: Miki                                     |
| Expected Result   | Pohon berhasil tersimpan dan muncul di daftar pohon                                 |
| Actual Result     |                                                                                     |
| Status            |                                                                                     |

---

## TC-TREE-02 Owner Menambah Pohon dengan Kode Kosong

| Item              | Detail                                                       |
| ----------------- | ------------------------------------------------------------ |
| ID Test           | TC-TREE-02                                                   |
| Modul             | Manajemen Pohon                                              |
| Skenario          | Owner menambahkan pohon tanpa kode pohon                     |
| Prasyarat         | Owner berada di Create Tree Screen                           |
| Langkah Pengujian | 1. Kosongkan kode pohon. 2. Isi field lain. 3. Tekan Simpan. |
| Input             | Kode pohon kosong                                            |
| Expected Result   | Sistem menampilkan pesan bahwa kode pohon wajib diisi        |
| Actual Result     |                                                              |
| Status            |                                                              |

---

## TC-TREE-03 Owner Menambah Pohon dengan Kode Duplikat

| Item              | Detail                                                    |
| ----------------- | --------------------------------------------------------- |
| ID Test           | TC-TREE-03                                                |
| Modul             | Manajemen Pohon                                           |
| Skenario          | Owner menambahkan pohon dengan kode yang sudah digunakan  |
| Prasyarat         | Sudah ada pohon dengan kode P-01                          |
| Langkah Pengujian | 1. Tambah pohon baru. 2. Isi kode P-01. 3. Tekan Simpan.  |
| Input             | Kode: P-01                                                |
| Expected Result   | Sistem menampilkan pesan bahwa kode pohon sudah digunakan |
| Actual Result     |                                                           |
| Status            |                                                           |

---

## TC-TREE-04 Owner Mengubah Data Pohon

| Item              | Detail                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------- |
| ID Test           | TC-TREE-04                                                                             |
| Modul             | Manajemen Pohon                                                                        |
| Skenario          | Owner mengubah data pohon                                                              |
| Prasyarat         | Data pohon sudah tersedia                                                              |
| Langkah Pengujian | 1. Buka Tree Detail. 2. Tekan Edit. 3. Ubah varietas atau posisi. 4. Simpan perubahan. |
| Input             | Varietas diubah menjadi Aligator                                                       |
| Expected Result   | Data pohon berhasil diperbarui                                                         |
| Actual Result     |                                                                                        |
| Status            |                                                                                        |

---

## TC-TREE-05 Owner Mengarsipkan Pohon

| Item              | Detail                                                       |
| ----------------- | ------------------------------------------------------------ |
| ID Test           | TC-TREE-05                                                   |
| Modul             | Manajemen Pohon                                              |
| Skenario          | Owner mengarsipkan pohon                                     |
| Prasyarat         | Data pohon tersedia                                          |
| Langkah Pengujian | 1. Buka Tree Detail. 2. Tekan Arsipkan. 3. Konfirmasi aksi.  |
| Input             | Pohon aktif                                                  |
| Expected Result   | Pohon berubah menjadi arsip dan tidak tampil di daftar utama |
| Actual Result     |                                                              |
| Status            |                                                              |

---

## TC-TREE-06 Worker Membuka Daftar Pohon

| Item              | Detail                                      |
| ----------------- | ------------------------------------------- |
| ID Test           | TC-TREE-06                                  |
| Modul             | Manajemen Pohon                             |
| Skenario          | Worker melihat daftar pohon                 |
| Prasyarat         | Worker active dan data pohon tersedia       |
| Langkah Pengujian | 1. Login sebagai worker. 2. Buka tab Pohon. |
| Input             | Akun worker active                          |
| Expected Result   | Worker dapat melihat daftar pohon           |
| Actual Result     |                                             |
| Status            |                                             |

---

## TC-TREE-07 Worker Mencoba Edit Pohon

| Item              | Detail                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| ID Test           | TC-TREE-07                                                                                                            |
| Modul             | Role Access                                                                                                           |
| Skenario          | Worker mencoba mengakses fitur edit pohon                                                                             |
| Prasyarat         | Worker active                                                                                                         |
| Langkah Pengujian | 1. Login sebagai worker. 2. Buka detail pohon. 3. Cek apakah tombol edit tersedia atau akses edit dilakukan langsung. |
| Input             | Akun worker                                                                                                           |
| Expected Result   | Worker tidak dapat mengedit pohon                                                                                     |
| Actual Result     |                                                                                                                       |
| Status            |                                                                                                                       |

---

## TC-TREE-08 User Membuka Detail Pohon

| Item              | Detail                                                          |
| ----------------- | --------------------------------------------------------------- |
| ID Test           | TC-TREE-08                                                      |
| Modul             | Manajemen Pohon                                                 |
| Skenario          | User membuka detail pohon                                       |
| Prasyarat         | Data pohon tersedia                                             |
| Langkah Pengujian | 1. Buka daftar pohon. 2. Pilih salah satu pohon.                |
| Input             | ID pohon valid                                                  |
| Expected Result   | Detail pohon, kondisi terbaru, fase terbaru, dan riwayat tampil |
| Actual Result     |                                                                 |
| Status            |                                                                 |

---

## TC-TREE-09 Owner Mengembalikan Pohon dari Arsip

| Item              | Detail                                                                 |
| ----------------- | ---------------------------------------------------------------------- |
| ID Test           | TC-TREE-09                                                             |
| Modul             | Manajemen Pohon                                                        |
| Skenario          | Owner mengembalikan pohon yang sudah diarsipkan                        |
| Prasyarat         | Data pohon berada dalam status arsip                                   |
| Langkah Pengujian | 1. Buka Archived Tree List. 2. Pilih pohon. 3. Tekan Pulihkan.         |
| Input             | Pohon archived                                                         |
| Expected Result   | `is_archived` berubah menjadi false dan pohon tampil di daftar utama   |
| Actual Result     |                                                                        |
| Status            |                                                                        |

---

# 8. Test Case Laporan Kondisi Pohon

## TC-COND-01 Worker Membuat Laporan Kondisi Valid

| Item              | Detail                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| ID Test           | TC-COND-01                                                                                          |
| Modul             | Laporan Kondisi Pohon                                                                               |
| Skenario          | Worker mencatat kondisi pohon                                                                       |
| Prasyarat         | Worker active dan data pohon tersedia                                                               |
| Langkah Pengujian | 1. Login sebagai worker. 2. Buka detail pohon. 3. Tekan Catat Kondisi. 4. Pilih kondisi. 5. Simpan. |
| Input             | Kondisi: terserang hama, Catatan: daun menguning                                                    |
| Expected Result   | Laporan kondisi berhasil tersimpan                                                                  |
| Actual Result     |                                                                                                     |
| Status            |                                                                                                     |

---

## TC-COND-02 Owner Membuat Laporan Kondisi Valid

| Item              | Detail                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| ID Test           | TC-COND-02                                                                                         |
| Modul             | Laporan Kondisi Pohon                                                                              |
| Skenario          | Owner mencatat kondisi pohon                                                                       |
| Prasyarat         | Owner active dan data pohon tersedia                                                               |
| Langkah Pengujian | 1. Login sebagai owner. 2. Buka detail pohon. 3. Tekan Catat Kondisi. 4. Pilih kondisi. 5. Simpan. |
| Input             | Kondisi: perlu perhatian                                                                           |
| Expected Result   | Laporan kondisi berhasil tersimpan                                                                 |
| Actual Result     |                                                                                                    |
| Status            |                                                                                                    |

---

## TC-COND-03 Kondisi Terbaru Pohon Berubah

| Item              | Detail                                                            |
| ----------------- | ----------------------------------------------------------------- |
| ID Test           | TC-COND-03                                                        |
| Modul             | Laporan Kondisi Pohon                                             |
| Skenario          | Sistem memperbarui kondisi terbaru setelah laporan kondisi dibuat |
| Prasyarat         | Laporan kondisi berhasil dibuat                                   |
| Langkah Pengujian | 1. Buat laporan kondisi baru. 2. Buka detail pohon.               |
| Input             | Kondisi: disease_indicated                                        |
| Expected Result   | Current condition pohon berubah mengikuti laporan terbaru         |
| Actual Result     |                                                                   |
| Status            |                                                                   |

---

## TC-COND-04 Laporan Tanpa Kategori Kondisi

| Item              | Detail                                               |
| ----------------- | ---------------------------------------------------- |
| ID Test           | TC-COND-04                                           |
| Modul             | Laporan Kondisi Pohon                                |
| Skenario          | User menyimpan laporan tanpa memilih kondisi         |
| Prasyarat         | User berada di Create Condition Report Screen        |
| Langkah Pengujian | 1. Kosongkan pilihan kondisi. 2. Tekan Simpan.       |
| Input             | Kondisi kosong                                       |
| Expected Result   | Sistem menampilkan pesan bahwa kondisi wajib dipilih |
| Actual Result     |                                                      |
| Status            |                                                      |

---

## TC-COND-05 User Membuka Riwayat Kondisi

| Item              | Detail                                                             |
| ----------------- | ------------------------------------------------------------------ |
| ID Test           | TC-COND-05                                                         |
| Modul             | Riwayat Kondisi                                                    |
| Skenario          | User melihat riwayat kondisi pohon                                 |
| Prasyarat         | Pohon memiliki laporan kondisi                                     |
| Langkah Pengujian | 1. Buka Tree Detail. 2. Buka bagian riwayat kondisi atau timeline. |
| Input             | Pohon dengan riwayat kondisi                                       |
| Expected Result   | Riwayat kondisi pohon tampil                                       |
| Actual Result     |                                                                    |
| Status            |                                                                    |

---

## TC-COND-06 Riwayat Kondisi Diurutkan Berdasarkan Waktu

| Item              | Detail                                                 |
| ----------------- | ------------------------------------------------------ |
| ID Test           | TC-COND-06                                             |
| Modul             | Riwayat Kondisi                                        |
| Skenario          | Sistem menampilkan riwayat kondisi berdasarkan waktu   |
| Prasyarat         | Pohon memiliki lebih dari satu laporan kondisi         |
| Langkah Pengujian | 1. Buka riwayat kondisi pohon. 2. Periksa urutan data. |
| Input             | Beberapa laporan kondisi                               |
| Expected Result   | Riwayat tampil berdasarkan urutan waktu sesuai desain  |
| Actual Result     |                                                        |
| Status            |                                                        |

---

# 9. Test Case Laporan Operasional Kebun

## TC-OPR-01 Worker Membuat Laporan Operasional Valid

| Item              | Detail                                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| ID Test           | TC-OPR-01                                                                                                        |
| Modul             | Laporan Operasional                                                                                              |
| Skenario          | Worker membuat laporan operasional kebun                                                                         |
| Prasyarat         | Worker active                                                                                                    |
| Langkah Pengujian | 1. Login sebagai worker. 2. Buka Create Operational Report. 3. Pilih kategori. 4. Isi lokasi/catatan. 5. Simpan. |
| Input             | Kategori: alat rusak, Catatan: sprayer bocor                                                                     |
| Expected Result   | Laporan operasional berhasil tersimpan                                                                           |
| Actual Result     |                                                                                                                  |
| Status            |                                                                                                                  |

---

## TC-OPR-02 Status Awal Laporan Operasional

| Item              | Detail                                                        |
| ----------------- | ------------------------------------------------------------- |
| ID Test           | TC-OPR-02                                                     |
| Modul             | Laporan Operasional                                           |
| Skenario          | Laporan operasional baru memiliki status awal                 |
| Prasyarat         | Laporan operasional berhasil dibuat                           |
| Langkah Pengujian | 1. Buat laporan operasional. 2. Owner membuka daftar laporan. |
| Input             | Laporan baru                                                  |
| Expected Result   | Status laporan adalah new atau baru                           |
| Actual Result     |                                                               |
| Status            |                                                               |

---

## TC-OPR-03 Owner Melihat Daftar Laporan Operasional

| Item              | Detail                                                   |
| ----------------- | -------------------------------------------------------- |
| ID Test           | TC-OPR-03                                                |
| Modul             | Laporan Operasional                                      |
| Skenario          | Owner melihat laporan operasional yang masuk             |
| Prasyarat         | Terdapat laporan operasional                             |
| Langkah Pengujian | 1. Login sebagai owner. 2. Buka Operational Report List. |
| Input             | Akun owner active                                        |
| Expected Result   | Daftar laporan operasional tampil                        |
| Actual Result     |                                                          |
| Status            |                                                          |

---

## TC-OPR-04 Owner Membuka Detail Laporan

| Item              | Detail                                                        |
| ----------------- | ------------------------------------------------------------- |
| ID Test           | TC-OPR-04                                                     |
| Modul             | Laporan Operasional                                           |
| Skenario          | Owner membuka detail laporan operasional                      |
| Prasyarat         | Terdapat laporan operasional                                  |
| Langkah Pengujian | 1. Buka Operational Report List. 2. Pilih salah satu laporan. |
| Input             | ID laporan valid                                              |
| Expected Result   | Detail laporan tampil                                         |
| Actual Result     |                                                               |
| Status            |                                                               |

---

## TC-OPR-05 Owner Mengubah Status Laporan

| Item              | Detail                                                   |
| ----------------- | -------------------------------------------------------- |
| ID Test           | TC-OPR-05                                                |
| Modul             | Laporan Operasional                                      |
| Skenario          | Owner mengubah status laporan operasional                |
| Prasyarat         | Terdapat laporan operasional                             |
| Langkah Pengujian | 1. Buka detail laporan. 2. Pilih status baru. 3. Simpan. |
| Input             | Status: in_progress                                      |
| Expected Result   | Status laporan berubah                                   |
| Actual Result     |                                                          |
| Status            |                                                          |

---

## TC-OPR-06 Owner Membuat Tugas dari Laporan

| Item              | Detail                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| ID Test           | TC-OPR-06                                                                                          |
| Modul             | Laporan Operasional                                                                                |
| Skenario          | Owner membuat tugas tindak lanjut manual dari laporan operasional                                  |
| Prasyarat         | Ada laporan operasional dengan status new                                                          |
| Langkah Pengujian | 1. Buka detail laporan. 2. Tekan Buat Tugas. 3. Isi worker, tanggal, target, instruksi. 4. Simpan. |
| Input             | Worker active, tanggal valid, target custom dengan catatan                                         |
| Expected Result   | Tugas berhasil dibuat dari laporan                                                                 |
| Actual Result     |                                                                                                    |
| Status            |                                                                                                    |

---

## TC-OPR-07 Status Laporan Berubah Setelah Tugas Dibuat

| Item              | Detail                                                      |
| ----------------- | ----------------------------------------------------------- |
| ID Test           | TC-OPR-07                                                   |
| Modul             | Laporan Operasional                                         |
| Skenario          | Status laporan berubah setelah dibuatkan tugas              |
| Prasyarat         | Owner membuat tugas dari laporan                            |
| Langkah Pengujian | 1. Buat tugas dari laporan. 2. Buka kembali detail laporan. |
| Input             | Tugas tindak lanjut                                         |
| Expected Result   | Status laporan berubah menjadi in_progress                  |
| Actual Result     |                                                             |
| Status            |                                                             |

---

## TC-OPR-08 Worker Melihat Tugas Tindak Lanjut

| Item              | Detail                                                         |
| ----------------- | -------------------------------------------------------------- |
| ID Test           | TC-OPR-08                                                      |
| Modul             | Laporan Operasional dan Tugas                                  |
| Skenario          | Worker melihat tugas hasil tindak lanjut laporan               |
| Prasyarat         | Owner sudah membuat tugas dari laporan operasional             |
| Langkah Pengujian | 1. Login sebagai worker yang ditugaskan. 2. Buka daftar tugas. |
| Input             | Akun worker assigned                                           |
| Expected Result   | Tugas tindak lanjut muncul pada daftar tugas worker            |
| Actual Result     |                                                                |
| Status            |                                                                |

---

# 10. Test Case SOP dan Jadwal

## TC-SOP-01 Owner Membuat SOP Valid

| Item              | Detail                                                                  |
| ----------------- | ----------------------------------------------------------------------- |
| ID Test           | TC-SOP-01                                                               |
| Modul             | SOP Perawatan                                                           |
| Skenario          | Owner membuat template SOP perawatan                                    |
| Prasyarat         | Owner active                                                            |
| Langkah Pengujian | 1. Buka Care SOP List. 2. Tekan Tambah SOP. 3. Isi data SOP. 4. Simpan. |
| Input             | Nama: Semprot Pencegahan, Kategori: spraying, Interval: 14              |
| Expected Result   | SOP berhasil dibuat dan muncul di daftar SOP                            |
| Actual Result     |                                                                         |
| Status            |                                                                         |

---

## TC-SOP-02 Owner Membuat SOP tanpa Nama

| Item              | Detail                                                                |
| ----------------- | --------------------------------------------------------------------- |
| ID Test           | TC-SOP-02                                                             |
| Modul             | SOP Perawatan                                                         |
| Skenario          | Owner menyimpan SOP tanpa nama                                        |
| Prasyarat         | Owner berada di Create SOP Screen                                     |
| Langkah Pengujian | 1. Kosongkan nama SOP. 2. Isi kategori dan interval. 3. Tekan Simpan. |
| Input             | Nama kosong                                                           |
| Expected Result   | Sistem menampilkan pesan bahwa nama SOP wajib diisi                   |
| Actual Result     |                                                                       |
| Status            |                                                                       |

---

## TC-SOP-03 Owner Mengisi Interval 0

| Item              | Detail                                                          |
| ----------------- | --------------------------------------------------------------- |
| ID Test           | TC-SOP-03                                                       |
| Modul             | SOP Perawatan                                                   |
| Skenario          | Owner mengisi interval SOP dengan nilai 0                       |
| Prasyarat         | Owner berada di Create SOP Screen                               |
| Langkah Pengujian | 1. Isi interval dengan 0. 2. Tekan Simpan.                      |
| Input             | Interval: 0                                                     |
| Expected Result   | Sistem menampilkan pesan bahwa interval harus lebih dari 0 hari |
| Actual Result     |                                                                 |
| Status            |                                                                 |

---

## TC-SOP-04 Owner Mengubah SOP

| Item              | Detail                                                                         |
| ----------------- | ------------------------------------------------------------------------------ |
| ID Test           | TC-SOP-04                                                                      |
| Modul             | SOP Perawatan                                                                  |
| Skenario          | Owner mengubah data SOP                                                        |
| Prasyarat         | SOP sudah tersedia                                                             |
| Langkah Pengujian | 1. Buka detail SOP. 2. Tekan Edit. 3. Ubah instruksi atau interval. 4. Simpan. |
| Input             | Interval diubah dari 14 menjadi 10                                             |
| Expected Result   | SOP berhasil diperbarui                                                        |
| Actual Result     |                                                                                |
| Status            |                                                                                |

---

## TC-SOP-05 Owner Menonaktifkan SOP

| Item              | Detail                                    |
| ----------------- | ----------------------------------------- |
| ID Test           | TC-SOP-05                                 |
| Modul             | SOP Perawatan                             |
| Skenario          | Owner menonaktifkan SOP                   |
| Prasyarat         | SOP aktif tersedia                        |
| Langkah Pengujian | 1. Buka detail SOP. 2. Tekan Nonaktifkan. |
| Input             | SOP aktif                                 |
| Expected Result   | Status SOP menjadi tidak aktif            |
| Actual Result     |                                           |
| Status            |                                           |

---

## TC-SOP-06 SOP Belum Memiliki Histori Realisasi

| Item              | Detail                                                                |
| ----------------- | --------------------------------------------------------------------- |
| ID Test           | TC-SOP-06                                                             |
| Modul             | Acuan Jadwal SOP                                                      |
| Skenario          | Sistem menampilkan status jika SOP belum pernah direalisasikan        |
| Prasyarat         | SOP baru dibuat dan belum ada tugas selesai                           |
| Langkah Pengujian | 1. Buka detail SOP. 2. Lihat bagian acuan jadwal berikutnya.          |
| Input             | SOP tanpa histori                                                     |
| Expected Result   | Sistem menampilkan status no_history atau belum ada riwayat realisasi |
| Actual Result     |                                                                       |
| Status            |                                                                       |

---

## TC-SOP-07 Sistem Menghitung Tanggal Berikutnya

| Item              | Detail                                                                     |
| ----------------- | -------------------------------------------------------------------------- |
| ID Test           | TC-SOP-07                                                                  |
| Modul             | Acuan Jadwal SOP                                                           |
| Skenario          | Sistem menghitung acuan jadwal berikutnya dari interval SOP                |
| Prasyarat         | SOP memiliki interval dan pernah direalisasikan                            |
| Langkah Pengujian | 1. Buat tugas dari SOP. 2. Worker menyelesaikan tugas. 3. Buka detail SOP. |
| Input             | Realisasi terakhir: 1 Juni 2026, interval: 14 hari                         |
| Expected Result   | Sistem menampilkan acuan jadwal berikutnya: 15 Juni 2026                   |
| Actual Result     |                                                                            |
| Status            |                                                                            |

---

## TC-SOP-08 Status SOP Overdue

| Item              | Detail                                                            |
| ----------------- | ----------------------------------------------------------------- |
| ID Test           | TC-SOP-08                                                         |
| Modul             | Acuan Jadwal SOP                                                  |
| Skenario          | Sistem menampilkan status terlambat jika acuan jadwal sudah lewat |
| Prasyarat         | Acuan jadwal berikutnya lebih kecil dari tanggal hari ini         |
| Langkah Pengujian | 1. Buka Care SOP List atau Detail.                                |
| Input             | Acuan jadwal sudah lewat                                          |
| Expected Result   | Sistem menampilkan status overdue atau terlambat                  |
| Actual Result     |                                                                   |
| Status            |                                                                   |

---

## TC-SCH-01 Owner Membuat Jadwal dari SOP

| Item              | Detail                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------ |
| ID Test           | TC-SCH-01                                                                                  |
| Modul             | Jadwal Perawatan                                                                           |
| Skenario          | Owner membuat jadwal berdasarkan SOP                                                       |
| Prasyarat         | SOP aktif tersedia dan worker active tersedia                                              |
| Langkah Pengujian | 1. Buka detail SOP. 2. Tekan Buat Jadwal. 3. Pilih tanggal, worker, dan target. 4. Simpan. |
| Input             | SOP spraying, tanggal valid, worker active                                                 |
| Expected Result   | Jadwal berhasil dibuat                                                                     |
| Actual Result     |                                                                                            |
| Status            |                                                                                            |

---

## TC-SCH-02 Jadwal dari SOP Membuat Task Worker

| Item              | Detail                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------- |
| ID Test           | TC-SCH-02                                                                               |
| Modul             | Jadwal dan Tugas                                                                        |
| Skenario          | Sistem membuat task worker dari jadwal berbasis SOP                                     |
| Prasyarat         | Owner berhasil membuat jadwal dari SOP                                                  |
| Langkah Pengujian | 1. Buat jadwal dari SOP. 2. Login sebagai worker yang ditugaskan. 3. Buka daftar tugas. |
| Input             | Jadwal dari SOP                                                                         |
| Expected Result   | Tugas muncul di daftar worker                                                           |
| Actual Result     |                                                                                         |
| Status            |                                                                                         |

---

## TC-SCH-03 Owner Membuat Jadwal Manual

| Item              | Detail                                                                             |
| ----------------- | ---------------------------------------------------------------------------------- |
| ID Test           | TC-SCH-03                                                                          |
| Modul             | Jadwal Perawatan                                                                   |
| Skenario          | Owner membuat jadwal manual tanpa SOP                                              |
| Prasyarat         | Owner active dan worker active tersedia                                            |
| Langkah Pengujian | 1. Buka Care Schedule List. 2. Tekan Jadwal Manual. 3. Isi data jadwal. 4. Simpan. |
| Input             | Judul: Bersihkan saluran air, Target: custom                                       |
| Expected Result   | Jadwal manual berhasil dibuat                                                      |
| Actual Result     |                                                                                    |
| Status            |                                                                                    |

---

## TC-SCH-04 Jadwal Manual Membuat Task Worker

| Item              | Detail                                                                         |
| ----------------- | ------------------------------------------------------------------------------ |
| ID Test           | TC-SCH-04                                                                      |
| Modul             | Jadwal dan Tugas                                                               |
| Skenario          | Sistem membuat task worker dari jadwal manual                                  |
| Prasyarat         | Jadwal manual berhasil dibuat                                                  |
| Langkah Pengujian | 1. Buat jadwal manual. 2. Login sebagai worker assigned. 3. Buka daftar tugas. |
| Input             | Jadwal manual                                                                  |
| Expected Result   | Tugas muncul di daftar worker                                                  |
| Actual Result     |                                                                                |
| Status            |                                                                                |

---

## TC-SCH-05 Target Jadwal Tree Dipilih

| Item              | Detail                                                                |
| ----------------- | --------------------------------------------------------------------- |
| ID Test           | TC-SCH-05                                                             |
| Modul             | Target Jadwal                                                         |
| Skenario          | Owner membuat jadwal dengan target pohon tertentu                     |
| Prasyarat         | Data pohon tersedia                                                   |
| Langkah Pengujian | 1. Buat jadwal. 2. Pilih target type tree. 3. Pilih pohon. 4. Simpan. |
| Input             | Target tree: P-01                                                     |
| Expected Result   | Jadwal dan task terhubung ke pohon yang dipilih                       |
| Actual Result     |                                                                       |
| Status            |                                                                       |

---

## TC-SCH-06 Target Custom Jadwal Manual tanpa Catatan

| Item              | Detail                                                              |
| ----------------- | ------------------------------------------------------------------- |
| ID Test           | TC-SCH-06                                                           |
| Modul             | Target Jadwal                                                       |
| Skenario          | Owner membuat jadwal manual dengan target custom tanpa catatan      |
| Prasyarat         | Owner berada di Create Manual Schedule Screen                       |
| Langkah Pengujian | 1. Pilih target custom. 2. Kosongkan custom target note. 3. Simpan. |
| Input             | Jadwal manual dengan target custom tanpa catatan                    |
| Expected Result   | Sistem menampilkan error bahwa catatan target wajib diisi           |
| Actual Result     |                                                                     |
| Status            |                                                                     |

---

## TC-SCH-07 Worker Melihat Tugas dari Jadwal

| Item              | Detail                                                      |
| ----------------- | ----------------------------------------------------------- |
| ID Test           | TC-SCH-07                                                   |
| Modul             | Jadwal dan Tugas                                            |
| Skenario          | Worker melihat tugas yang berasal dari jadwal               |
| Prasyarat         | Owner sudah membuat jadwal dan task untuk worker            |
| Langkah Pengujian | 1. Login sebagai worker assigned. 2. Buka Worker Task List. |
| Input             | Akun worker assigned                                        |
| Expected Result   | Tugas dari jadwal tampil di daftar tugas                    |
| Actual Result     |                                                             |
| Status            |                                                             |

---

# 11. Test Case Tugas Worker

## TC-TASK-01 Worker Membuka Daftar Tugas

| Item              | Detail                                      |
| ----------------- | ------------------------------------------- |
| ID Test           | TC-TASK-01                                  |
| Modul             | Tugas Worker                                |
| Skenario          | Worker melihat daftar tugas miliknya        |
| Prasyarat         | Worker active dan memiliki tugas            |
| Langkah Pengujian | 1. Login sebagai worker. 2. Buka tab Tugas. |
| Input             | Akun worker active                          |
| Expected Result   | Daftar tugas milik worker tampil            |
| Actual Result     |                                             |
| Status            |                                             |

---

## TC-TASK-02 Worker Membuka Detail Tugas

| Item              | Detail                                                               |
| ----------------- | -------------------------------------------------------------------- |
| ID Test           | TC-TASK-02                                                           |
| Modul             | Tugas Worker                                                         |
| Skenario          | Worker membuka detail tugas                                          |
| Prasyarat         | Worker memiliki tugas                                                |
| Langkah Pengujian | 1. Buka Worker Task List. 2. Pilih tugas.                            |
| Input             | ID task valid                                                        |
| Expected Result   | Detail tugas tampil, termasuk instruksi, target, tanggal, dan status |
| Actual Result     |                                                                      |
| Status            |                                                                      |

---

## TC-TASK-03 Worker Menyelesaikan Tugas

| Item              | Detail                                                                             |
| ----------------- | ---------------------------------------------------------------------------------- |
| ID Test           | TC-TASK-03                                                                         |
| Modul             | Tugas Worker                                                                       |
| Skenario          | Worker menandai tugas sebagai selesai                                              |
| Prasyarat         | Worker memiliki tugas pending/postponed                                            |
| Langkah Pengujian | 1. Buka detail tugas. 2. Tekan Selesai. 3. Isi catatan jika diperlukan. 4. Simpan. |
| Input             | Status completed                                                                   |
| Expected Result   | Status tugas berubah menjadi completed dan aktivitas tersimpan                     |
| Actual Result     |                                                                                    |
| Status            |                                                                                    |

---

## TC-TASK-04 Worker Menunda Tugas

| Item              | Detail                                                                  |
| ----------------- | ----------------------------------------------------------------------- |
| ID Test           | TC-TASK-04                                                              |
| Modul             | Tugas Worker                                                            |
| Skenario          | Worker menandai tugas sebagai tertunda                                  |
| Prasyarat         | Worker memiliki tugas pending                                           |
| Langkah Pengujian | 1. Buka detail tugas. 2. Tekan Tunda. 3. Isi catatan. 4. Simpan.        |
| Input             | Status postponed                                                        |
| Expected Result   | Status tugas berubah menjadi postponed dan aktivitas tertunda tersimpan |
| Actual Result     |                                                                         |
| Status            |                                                                         |

---

## TC-TASK-05 Worker Menunda Tugas dengan Catatan

| Item              | Detail                                                          |
| ----------------- | --------------------------------------------------------------- |
| ID Test           | TC-TASK-05                                                      |
| Modul             | Tugas Worker                                                    |
| Skenario          | Worker memberi catatan saat menunda tugas                       |
| Prasyarat         | Worker memiliki tugas pending                                   |
| Langkah Pengujian | 1. Buka detail tugas. 2. Tekan Tunda. 3. Isi alasan. 4. Simpan. |
| Input             | Catatan: hujan deras                                            |
| Expected Result   | Catatan tersimpan pada aktivitas tugas                          |
| Actual Result     |                                                                 |
| Status            |                                                                 |

---

## TC-TASK-06 Worker Mencoba Akses Tugas Worker Lain

| Item              | Detail                                                        |
| ----------------- | ------------------------------------------------------------- |
| ID Test           | TC-TASK-06                                                    |
| Modul             | Role Access                                                   |
| Skenario          | Worker mencoba membuka tugas milik worker lain                |
| Prasyarat         | Terdapat dua worker aktif dan masing-masing memiliki tugas    |
| Langkah Pengujian | 1. Login sebagai Worker A. 2. Coba akses task milik Worker B. |
| Input             | ID task worker lain                                           |
| Expected Result   | Akses ditolak atau data tidak tampil                          |
| Actual Result     |                                                               |
| Status            |                                                               |

---

## TC-TASK-07 Owner Melihat Tugas Kebun

| Item              | Detail                                                |
| ----------------- | ----------------------------------------------------- |
| ID Test           | TC-TASK-07                                            |
| Modul             | Tugas Worker                                          |
| Skenario          | Owner melihat daftar tugas seluruh worker dalam kebun |
| Prasyarat         | Terdapat beberapa tugas worker                        |
| Langkah Pengujian | 1. Login sebagai owner. 2. Buka Owner Task List.      |
| Input             | Akun owner active                                     |
| Expected Result   | Owner dapat melihat daftar tugas dalam kebunnya       |
| Actual Result     |                                                       |
| Status            |                                                       |

---

# 12. Test Case Fase Pertumbuhan

## TC-PHASE-01 Worker Mencatat Fase Pohon

| Item              | Detail                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------- |
| ID Test           | TC-PHASE-01                                                                                   |
| Modul             | Fase Pertumbuhan                                                                              |
| Skenario          | Worker mencatat fase pertumbuhan pohon                                                        |
| Prasyarat         | Worker active dan data pohon tersedia                                                         |
| Langkah Pengujian | 1. Login sebagai worker. 2. Buka detail pohon. 3. Tekan Catat Fase. 4. Pilih fase. 5. Simpan. |
| Input             | Fase: flowering                                                                               |
| Expected Result   | Catatan fase berhasil tersimpan                                                               |
| Actual Result     |                                                                                               |
| Status            |                                                                                               |

---

## TC-PHASE-02 Owner Mencatat Fase Pohon

| Item              | Detail                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------- |
| ID Test           | TC-PHASE-02                                                                                  |
| Modul             | Fase Pertumbuhan                                                                             |
| Skenario          | Owner mencatat fase pertumbuhan pohon                                                        |
| Prasyarat         | Owner active dan data pohon tersedia                                                         |
| Langkah Pengujian | 1. Login sebagai owner. 2. Buka detail pohon. 3. Tekan Catat Fase. 4. Pilih fase. 5. Simpan. |
| Input             | Fase: fruiting                                                                               |
| Expected Result   | Catatan fase berhasil tersimpan                                                              |
| Actual Result     |                                                                                              |
| Status            |                                                                                              |

---

## TC-PHASE-03 Fase Terbaru Pohon Berubah

| Item              | Detail                                                     |
| ----------------- | ---------------------------------------------------------- |
| ID Test           | TC-PHASE-03                                                |
| Modul             | Fase Pertumbuhan                                           |
| Skenario          | Sistem memperbarui fase terbaru pohon setelah fase dicatat |
| Prasyarat         | Catatan fase berhasil dibuat                               |
| Langkah Pengujian | 1. Buat catatan fase. 2. Buka detail pohon.                |
| Input             | Fase: flowering                                            |
| Expected Result   | Current growth phase pohon berubah sesuai fase terbaru     |
| Actual Result     |                                                            |
| Status            |                                                            |

---

## TC-PHASE-04 Fase tanpa Pilihan

| Item              | Detail                                            |
| ----------------- | ------------------------------------------------- |
| ID Test           | TC-PHASE-04                                       |
| Modul             | Fase Pertumbuhan                                  |
| Skenario          | User menyimpan catatan fase tanpa memilih fase    |
| Prasyarat         | User berada di Create Growth Phase Screen         |
| Langkah Pengujian | 1. Kosongkan field fase. 2. Tekan Simpan.         |
| Input             | Fase kosong                                       |
| Expected Result   | Sistem menampilkan pesan bahwa fase wajib dipilih |
| Actual Result     |                                                   |
| Status            |                                                   |

---

## TC-PHASE-05 User Membuka Riwayat Fase

| Item              | Detail                                                   |
| ----------------- | -------------------------------------------------------- |
| ID Test           | TC-PHASE-05                                              |
| Modul             | Riwayat Fase                                             |
| Skenario          | User melihat riwayat fase pertumbuhan pohon              |
| Prasyarat         | Pohon memiliki catatan fase                              |
| Langkah Pengujian | 1. Buka Tree Detail. 2. Buka riwayat fase atau timeline. |
| Input             | Pohon dengan catatan fase                                |
| Expected Result   | Riwayat fase tampil                                      |
| Actual Result     |                                                          |
| Status            |                                                          |

---

## TC-PHASE-06 Pohon Flowering Muncul dalam Monitoring

| Item              | Detail                                                    |
| ----------------- | --------------------------------------------------------- |
| ID Test           | TC-PHASE-06                                               |
| Modul             | Monitoring Fase                                           |
| Skenario          | Pohon dengan fase flowering tampil pada daftar monitoring |
| Prasyarat         | Terdapat pohon dengan fase flowering                      |
| Langkah Pengujian | 1. Owner membuka Growth Monitoring Screen.                |
| Input             | Pohon current_growth_phase = flowering                    |
| Expected Result   | Pohon tampil pada daftar pohon berbunga                   |
| Actual Result     |                                                           |
| Status            |                                                           |

---

## TC-PHASE-07 Pohon Fruiting Muncul dalam Monitoring

| Item              | Detail                                                   |
| ----------------- | -------------------------------------------------------- |
| ID Test           | TC-PHASE-07                                              |
| Modul             | Monitoring Fase                                          |
| Skenario          | Pohon dengan fase fruiting tampil pada daftar monitoring |
| Prasyarat         | Terdapat pohon dengan fase fruiting                      |
| Langkah Pengujian | 1. Owner membuka Growth Monitoring Screen.               |
| Input             | Pohon current_growth_phase = fruiting                    |
| Expected Result   | Pohon tampil pada daftar pohon berbuah                   |
| Actual Result     |                                                          |
| Status            |                                                          |

---

## TC-PHASE-08 Tidak Ada Klaim Prediksi Panen

| Item              | Detail                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| ID Test           | TC-PHASE-08                                                                                        |
| Modul             | Monitoring Fase                                                                                    |
| Skenario          | Sistem menampilkan monitoring fase tanpa prediksi panen otomatis                                   |
| Prasyarat         | Owner membuka Growth Monitoring Screen                                                             |
| Langkah Pengujian | 1. Periksa label dan informasi pada halaman monitoring fase.                                       |
| Input             | Data fase pohon                                                                                    |
| Expected Result   | Sistem hanya menampilkan fase berbunga/berbuah dan tidak menampilkan klaim prediksi panen otomatis |
| Actual Result     |                                                                                                    |
| Status            |                                                                                                    |

---

# 13. Test Case Riwayat Pohon

## TC-HIS-01 Riwayat Kondisi Muncul di Timeline

| Item              | Detail                                          |
| ----------------- | ----------------------------------------------- |
| ID Test           | TC-HIS-01                                       |
| Modul             | Riwayat Pohon                                   |
| Skenario          | Riwayat kondisi tampil pada timeline pohon      |
| Prasyarat         | Pohon memiliki laporan kondisi                  |
| Langkah Pengujian | 1. Buka Tree Detail. 2. Lihat timeline riwayat. |
| Input             | Pohon dengan tree_condition_reports             |
| Expected Result   | Riwayat kondisi muncul di timeline              |
| Actual Result     |                                                 |
| Status            |                                                 |

---

## TC-HIS-02 Riwayat Fase Muncul di Timeline

| Item              | Detail                                          |
| ----------------- | ----------------------------------------------- |
| ID Test           | TC-HIS-02                                       |
| Modul             | Riwayat Pohon                                   |
| Skenario          | Riwayat fase tampil pada timeline pohon         |
| Prasyarat         | Pohon memiliki catatan fase                     |
| Langkah Pengujian | 1. Buka Tree Detail. 2. Lihat timeline riwayat. |
| Input             | Pohon dengan growth_phase_records               |
| Expected Result   | Riwayat fase muncul di timeline                 |
| Actual Result     |                                                 |
| Status            |                                                 |

---

## TC-HIS-03 Riwayat Perawatan Muncul di Timeline

| Item              | Detail                                                                               |
| ----------------- | ------------------------------------------------------------------------------------ |
| ID Test           | TC-HIS-03                                                                            |
| Modul             | Riwayat Pohon                                                                        |
| Skenario          | Riwayat perawatan tampil pada timeline pohon                                         |
| Prasyarat         | Pohon memiliki tugas perawatan dengan target tree dan sudah selesai                  |
| Langkah Pengujian | 1. Buat task dengan target pohon. 2. Worker menyelesaikan task. 3. Buka Tree Detail. |
| Input             | Task completed dengan target tree                                                    |
| Expected Result   | Riwayat perawatan muncul di timeline pohon                                           |
| Actual Result     |                                                                                      |
| Status            |                                                                                      |

---

# 14. Test Case Dashboard

## TC-DASH-01 Owner Membuka Dashboard

| Item              | Detail                                           |
| ----------------- | ------------------------------------------------ |
| ID Test           | TC-DASH-01                                       |
| Modul             | Dashboard Owner                                  |
| Skenario          | Owner membuka dashboard kebun                    |
| Prasyarat         | Owner active dan data kebun tersedia             |
| Langkah Pengujian | 1. Login sebagai owner. 2. Buka Owner Dashboard. |
| Input             | Akun owner active                                |
| Expected Result   | Ringkasan kebun tampil                           |
| Actual Result     |                                                  |
| Status            |                                                  |

---

## TC-DASH-02 Jumlah Pohon Bermasalah Tampil Benar

| Item              | Detail                                                                       |
| ----------------- | ---------------------------------------------------------------------------- |
| ID Test           | TC-DASH-02                                                                   |
| Modul             | Dashboard Owner                                                              |
| Skenario          | Dashboard menampilkan jumlah pohon bermasalah                                |
| Prasyarat         | Terdapat pohon dengan kondisi selain healthy                                 |
| Langkah Pengujian | 1. Buat atau ubah kondisi pohon menjadi bermasalah. 2. Buka dashboard owner. |
| Input             | Pohon status needs_attention/pest/disease/damaged/dead                       |
| Expected Result   | Jumlah pohon bermasalah bertambah sesuai data                                |
| Actual Result     |                                                                              |
| Status            |                                                                              |

---

## TC-DASH-03 Jumlah Tugas Hari Ini Tampil Benar

| Item              | Detail                                                          |
| ----------------- | --------------------------------------------------------------- |
| ID Test           | TC-DASH-03                                                      |
| Modul             | Dashboard Owner                                                 |
| Skenario          | Dashboard menampilkan tugas hari ini                            |
| Prasyarat         | Terdapat tugas dengan due_date hari ini                         |
| Langkah Pengujian | 1. Buat tugas dengan tanggal hari ini. 2. Buka dashboard owner. |
| Input             | Task due_date hari ini                                          |
| Expected Result   | Jumlah tugas hari ini tampil sesuai data                        |
| Actual Result     |                                                                 |
| Status            |                                                                 |

---

## TC-DASH-04 Jumlah Tugas Belum Selesai Tampil Benar

| Item              | Detail                                                    |
| ----------------- | --------------------------------------------------------- |
| ID Test           | TC-DASH-04                                                |
| Modul             | Dashboard Owner                                           |
| Skenario          | Dashboard menampilkan tugas belum selesai                 |
| Prasyarat         | Terdapat tugas pending atau postponed                     |
| Langkah Pengujian | 1. Buat tugas pending/postponed. 2. Buka dashboard owner. |
| Input             | Task pending/postponed                                    |
| Expected Result   | Jumlah tugas belum selesai tampil sesuai data             |
| Actual Result     |                                                           |
| Status            |                                                           |

---

## TC-DASH-05 Jumlah Laporan Operasional Baru Tampil Benar

| Item              | Detail                                                             |
| ----------------- | ------------------------------------------------------------------ |
| ID Test           | TC-DASH-05                                                         |
| Modul             | Dashboard Owner                                                    |
| Skenario          | Dashboard menampilkan laporan operasional baru                     |
| Prasyarat         | Terdapat operational report status new                             |
| Langkah Pengujian | 1. Worker membuat laporan operasional. 2. Owner membuka dashboard. |
| Input             | Operational report new                                             |
| Expected Result   | Jumlah laporan baru tampil sesuai data                             |
| Actual Result     |                                                                    |
| Status            |                                                                    |

---

## TC-DASH-06 Jumlah Worker Pending Tampil Benar

| Item              | Detail                                                      |
| ----------------- | ----------------------------------------------------------- |
| ID Test           | TC-DASH-06                                                  |
| Modul             | Dashboard Owner                                             |
| Skenario          | Dashboard menampilkan jumlah worker pending                 |
| Prasyarat         | Ada worker pending                                          |
| Langkah Pengujian | 1. Worker mengajukan join farm. 2. Owner membuka dashboard. |
| Input             | Worker status pending                                       |
| Expected Result   | Jumlah worker pending tampil sesuai data                    |
| Actual Result     |                                                             |
| Status            |                                                             |

---

## TC-DASH-07 Jumlah Pohon Berbunga/Berbuah Tampil Benar

| Item              | Detail                                                                   |
| ----------------- | ------------------------------------------------------------------------ |
| ID Test           | TC-DASH-07                                                               |
| Modul             | Dashboard Owner                                                          |
| Skenario          | Dashboard menampilkan jumlah pohon berbunga dan berbuah                  |
| Prasyarat         | Ada pohon dengan fase flowering atau fruiting                            |
| Langkah Pengujian | 1. Catat fase pohon menjadi flowering/fruiting. 2. Buka dashboard owner. |
| Input             | current_growth_phase flowering/fruiting                                  |
| Expected Result   | Jumlah pohon berbunga/berbuah tampil sesuai data                         |
| Actual Result     |                                                                          |
| Status            |                                                                          |

---

## TC-DASH-08 Jumlah SOP Overdue Tampil Benar

| Item              | Detail                                                                             |
| ----------------- | ---------------------------------------------------------------------------------- |
| ID Test           | TC-DASH-08                                                                         |
| Modul             | Dashboard Owner                                                                    |
| Skenario          | Dashboard menampilkan SOP yang terlambat                                           |
| Prasyarat         | Ada SOP dengan acuan jadwal berikutnya sudah lewat                                 |
| Langkah Pengujian | 1. Buat SOP dengan interval. 2. Buat dan selesaikan tugas lama. 3. Buka dashboard. |
| Input             | SOP overdue                                                                        |
| Expected Result   | Jumlah SOP overdue tampil sesuai data                                              |
| Actual Result     |                                                                                    |
| Status            |                                                                                    |

---

## TC-DASH-09 Worker Membuka Dashboard

| Item              | Detail                                             |
| ----------------- | -------------------------------------------------- |
| ID Test           | TC-DASH-09                                         |
| Modul             | Dashboard Worker                                   |
| Skenario          | Worker membuka dashboard tugas                     |
| Prasyarat         | Worker active                                      |
| Langkah Pengujian | 1. Login sebagai worker. 2. Buka Worker Dashboard. |
| Input             | Akun worker active                                 |
| Expected Result   | Ringkasan tugas worker tampil                      |
| Actual Result     |                                                    |
| Status            |                                                    |

---

## TC-DASH-10 Worker Memiliki Tugas Hari Ini

| Item              | Detail                                                                     |
| ----------------- | -------------------------------------------------------------------------- |
| ID Test           | TC-DASH-10                                                                 |
| Modul             | Dashboard Worker                                                           |
| Skenario          | Dashboard worker menampilkan tugas hari ini                                |
| Prasyarat         | Worker memiliki tugas dengan due_date hari ini                             |
| Langkah Pengujian | 1. Owner membuat tugas untuk worker hari ini. 2. Worker membuka dashboard. |
| Input             | Task assigned to worker due today                                          |
| Expected Result   | Jumlah tugas hari ini tampil sesuai data                                   |
| Actual Result     |                                                                            |
| Status            |                                                                            |

---

## TC-DASH-11 Worker Tidak Punya Tugas

| Item              | Detail                                                  |
| ----------------- | ------------------------------------------------------- |
| ID Test           | TC-DASH-11                                              |
| Modul             | Dashboard Worker                                        |
| Skenario          | Worker membuka dashboard tanpa tugas                    |
| Prasyarat         | Worker active tetapi belum memiliki tugas               |
| Langkah Pengujian | 1. Login sebagai worker tanpa tugas. 2. Buka dashboard. |
| Input             | Worker tanpa task                                       |
| Expected Result   | Empty state tampil dengan pesan yang sesuai             |
| Actual Result     |                                                         |
| Status            |                                                         |

---

# 15. Test Case Role dan Akses

## TC-ROLE-01 Owner Membuka Owner Area

| Item              | Detail                                                                  |
| ----------------- | ----------------------------------------------------------------------- |
| ID Test           | TC-ROLE-01                                                              |
| Modul             | Role Access                                                             |
| Skenario          | Owner membuka halaman owner                                             |
| Prasyarat         | Owner active                                                            |
| Langkah Pengujian | 1. Login sebagai owner. 2. Buka Owner Dashboard atau halaman manajemen. |
| Input             | Akun owner active                                                       |
| Expected Result   | Owner dapat mengakses owner area                                        |
| Actual Result     |                                                                         |
| Status            |                                                                         |

---

## TC-ROLE-02 Worker Membuka Owner Area

| Item              | Detail                                                              |
| ----------------- | ------------------------------------------------------------------- |
| ID Test           | TC-ROLE-02                                                          |
| Modul             | Role Access                                                         |
| Skenario          | Worker mencoba membuka halaman owner                                |
| Prasyarat         | Worker active                                                       |
| Langkah Pengujian | 1. Login sebagai worker. 2. Coba akses route owner secara langsung. |
| Input             | Akun worker active                                                  |
| Expected Result   | Akses ditolak atau user diarahkan kembali ke worker area            |
| Actual Result     |                                                                     |
| Status            |                                                                     |

---

## TC-ROLE-03 Worker Pending Membuka Worker Dashboard

| Item              | Detail                                                           |
| ----------------- | ---------------------------------------------------------------- |
| ID Test           | TC-ROLE-03                                                       |
| Modul             | Role Access                                                      |
| Skenario          | Worker pending mencoba mengakses dashboard worker                |
| Prasyarat         | Worker status pending                                            |
| Langkah Pengujian | 1. Login sebagai worker pending. 2. Coba akses Worker Dashboard. |
| Input             | Akun worker pending                                              |
| Expected Result   | Akses ditolak dan user diarahkan ke Pending Approval Screen      |
| Actual Result     |                                                                  |
| Status            |                                                                  |

---

## TC-ROLE-04 Worker Active Membuka Worker Dashboard

| Item              | Detail                                  |
| ----------------- | --------------------------------------- |
| ID Test           | TC-ROLE-04                              |
| Modul             | Role Access                             |
| Skenario          | Worker active membuka dashboard worker  |
| Prasyarat         | Worker status active                    |
| Langkah Pengujian | 1. Login sebagai worker active.         |
| Input             | Akun worker active                      |
| Expected Result   | Worker dapat mengakses Worker Dashboard |
| Actual Result     |                                         |
| Status            |                                         |

---

## TC-ROLE-05 Worker Removed Membuka Data Kebun

| Item              | Detail                                                              |
| ----------------- | ------------------------------------------------------------------- |
| ID Test           | TC-ROLE-05                                                          |
| Modul             | Role Access                                                         |
| Skenario          | Worker removed mencoba mengakses data kebun                         |
| Prasyarat         | Worker status removed                                               |
| Langkah Pengujian | 1. Login sebagai worker removed. 2. Coba akses halaman operasional. |
| Input             | Akun worker removed                                                 |
| Expected Result   | Akses ditolak dan user diarahkan ke Removed Access Screen           |
| Actual Result     |                                                                     |
| Status            |                                                                     |

---

## TC-ROLE-06 User dari Kebun Lain Membuka Data Kebun Berbeda

| Item              | Detail                                                          |
| ----------------- | --------------------------------------------------------------- |
| ID Test           | TC-ROLE-06                                                      |
| Modul             | Role Access dan RLS                                             |
| Skenario          | User mencoba mengakses data dari kebun lain                     |
| Prasyarat         | Terdapat dua kebun berbeda                                      |
| Langkah Pengujian | 1. Login sebagai user dari Kebun A. 2. Coba akses data Kebun B. |
| Input             | ID data kebun lain                                              |
| Expected Result   | Data tidak tampil atau akses ditolak                            |
| Actual Result     |                                                                 |
| Status            |                                                                 |

---

## TC-ROLE-07 Owner Melihat Profil Worker Satu Kebun

| Item              | Detail                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------- |
| ID Test           | TC-ROLE-07                                                                               |
| Modul             | Role Access dan RLS                                                                      |
| Skenario          | Owner membuka daftar worker dan melihat profil dasar worker dalam farm yang sama         |
| Prasyarat         | Owner active dan worker active berada pada farm yang sama                                |
| Langkah Pengujian | 1. Login sebagai owner. 2. Buka Worker Management. 3. Buka detail worker atau daftar worker. |
| Input             | Akun owner dan worker satu kebun                                                         |
| Expected Result   | Nama dan profil dasar worker tampil sesuai policy, tanpa membuka profil user luar kebun  |
| Actual Result     |                                                                                          |
| Status            |                                                                                          |

---

# 16. Test Case UX dan Data

## TC-UX-01 Worker Membuka Dashboard

| Item              | Detail                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------- |
| ID Test           | TC-UX-01                                                                               |
| Modul             | UX Worker                                                                              |
| Skenario          | Worker melihat aksi utama di dashboard                                                 |
| Prasyarat         | Worker active                                                                          |
| Langkah Pengujian | 1. Login sebagai worker. 2. Buka dashboard.                                            |
| Input             | Akun worker active                                                                     |
| Expected Result   | Aksi utama seperti lihat tugas, lapor kondisi, dan laporan operasional mudah ditemukan |
| Actual Result     |                                                                                        |
| Status            |                                                                                        |

---

## TC-UX-02 Worker Mengisi Laporan Kondisi

| Item              | Detail                                                              |
| ----------------- | ------------------------------------------------------------------- |
| ID Test           | TC-UX-02                                                            |
| Modul             | UX Form                                                             |
| Skenario          | Worker membuat laporan kondisi dengan input kategori                |
| Prasyarat         | Worker active                                                       |
| Langkah Pengujian | 1. Buka form laporan kondisi. 2. Periksa jenis input yang tersedia. |
| Input             | Kategori kondisi                                                    |
| Expected Result   | Input utama menggunakan pilihan kategori, bukan teks panjang        |
| Actual Result     |                                                                     |
| Status            |                                                                     |

---

## TC-UX-03 Aplikasi Dibuka di Layar Mobile

| Item              | Detail                                                                   |
| ----------------- | ------------------------------------------------------------------------ |
| ID Test           | TC-UX-03                                                                 |
| Modul             | Mobile First                                                             |
| Skenario          | Aplikasi diuji di perangkat mobile                                       |
| Prasyarat         | Aplikasi berjalan di perangkat mobile atau emulator                      |
| Langkah Pengujian | 1. Buka beberapa halaman utama. 2. Periksa layout, tombol, dan navigasi. |
| Input             | Perangkat mobile                                                         |
| Expected Result   | Layout tampil rapi dan tombol mudah ditekan                              |
| Actual Result     |                                                                          |
| Status            |                                                                          |

---

## TC-UX-04 Worker Membuat Laporan Operasional

| Item              | Detail                                                                 |
| ----------------- | ---------------------------------------------------------------------- |
| ID Test           | TC-UX-04                                                               |
| Modul             | UX Worker                                                              |
| Skenario          | Worker membuat laporan operasional dengan form sederhana               |
| Prasyarat         | Worker active                                                          |
| Langkah Pengujian | 1. Buka form laporan operasional. 2. Isi kategori dan catatan singkat. |
| Input             | Kategori laporan                                                       |
| Expected Result   | Form singkat dan mudah dipahami                                        |
| Actual Result     |                                                                        |
| Status            |                                                                        |

---

## TC-UX-05 Worker Menyelesaikan Tugas

| Item              | Detail                                           |
| ----------------- | ------------------------------------------------ |
| ID Test           | TC-UX-05                                         |
| Modul             | UX Task                                          |
| Skenario          | Worker menyelesaikan tugas dari detail tugas     |
| Prasyarat         | Worker memiliki tugas                            |
| Langkah Pengujian | 1. Buka detail tugas. 2. Periksa tombol Selesai. |
| Input             | Task detail                                      |
| Expected Result   | Tombol selesai mudah ditemukan                   |
| Actual Result     |                                                  |
| Status            |                                                  |

---

## TC-UX-06 Worker Menunda Tugas

| Item              | Detail                                                |
| ----------------- | ----------------------------------------------------- |
| ID Test           | TC-UX-06                                              |
| Modul             | UX Task                                               |
| Skenario          | Worker menunda tugas dengan catatan singkat           |
| Prasyarat         | Worker memiliki tugas                                 |
| Langkah Pengujian | 1. Buka detail tugas. 2. Tekan Tunda. 3. Isi catatan. |
| Input             | Catatan singkat                                       |
| Expected Result   | Catatan alasan dapat diisi secara singkat             |
| Actual Result     |                                                       |
| Status            |                                                       |

---

## TC-UX-07 Worker Mencatat Fase

| Item              | Detail                                          |
| ----------------- | ----------------------------------------------- |
| ID Test           | TC-UX-07                                        |
| Modul             | UX Fase                                         |
| Skenario          | Worker mencatat fase menggunakan pilihan fase   |
| Prasyarat         | Worker active                                   |
| Langkah Pengujian | 1. Buka form catat fase. 2. Periksa input fase. |
| Input             | Pilihan fase                                    |
| Expected Result   | Fase dapat dipilih dari daftar pilihan          |
| Actual Result     |                                                 |
| Status            |                                                 |

---

## TC-DATA-01 Interval SOP Menggunakan Satuan Hari

| Item              | Detail                                                   |
| ----------------- | -------------------------------------------------------- |
| ID Test           | TC-DATA-01                                               |
| Modul             | Konsistensi Data                                         |
| Skenario          | Sistem menyimpan interval SOP dengan satuan hari         |
| Prasyarat         | Owner membuat SOP                                        |
| Langkah Pengujian | 1. Isi interval SOP. 2. Simpan SOP. 3. Lihat detail SOP. |
| Input             | Interval: 14                                             |
| Expected Result   | Interval tersimpan sebagai 14 hari                       |
| Actual Result     |                                                          |
| Status            |                                                          |

---

## TC-DATA-02 Riwayat Tetap Ada Setelah Worker Removed atau Pohon Archived

| Item              | Detail                                                                  |
| ----------------- | ----------------------------------------------------------------------- |
| ID Test           | TC-DATA-02                                                              |
| Modul             | Reliabilitas Data                                                       |
| Skenario          | Data histori tetap tersimpan setelah worker removed atau pohon archived |
| Prasyarat         | Terdapat worker dengan histori dan pohon dengan riwayat                 |
| Langkah Pengujian | 1. Remove worker atau arsipkan pohon. 2. Buka data riwayat.             |
| Input             | Worker removed / pohon archived                                         |
| Expected Result   | Riwayat tetap dapat ditelusuri                                          |
| Actual Result     |                                                                         |
| Status            |                                                                         |

---

## TC-PERF-01 Dashboard Tampil dalam Waktu Wajar

| Item              | Detail                                                                    |
| ----------------- | ------------------------------------------------------------------------- |
| ID Test           | TC-PERF-01                                                                |
| Modul             | Performa Dasar                                                            |
| Skenario          | User membuka dashboard                                                    |
| Prasyarat         | Data tersedia dalam sistem                                                |
| Langkah Pengujian | 1. Login sebagai owner/worker. 2. Buka dashboard. 3. Amati waktu loading. |
| Input             | Data dashboard                                                            |
| Expected Result   | Dashboard tampil dalam waktu yang wajar                                   |
| Actual Result     |                                                                           |
| Status            |                                                                           |

---

## TC-UI-01 Konsistensi Tampilan Antar Halaman

| Item              | Detail                                                                           |
| ----------------- | -------------------------------------------------------------------------------- |
| ID Test           | TC-UI-01                                                                         |
| Modul             | Konsistensi Antarmuka                                                            |
| Skenario          | User berpindah antar halaman utama                                               |
| Prasyarat         | Aplikasi berjalan                                                                |
| Langkah Pengujian | 1. Buka dashboard, pohon, tugas, laporan, dan profile. 2. Periksa gaya tampilan. |
| Input             | Navigasi antar halaman                                                           |
| Expected Result   | Warna, tombol, card, spacing, dan navigasi tampil konsisten                      |
| Actual Result     |                                                                                  |
| Status            |                                                                                  |

---

# 17. Rekap Jumlah Test Case

| Modul                     | Jumlah Test Case |
| ------------------------- | ---------------: |
| Autentikasi               |                6 |
| Farm dan Membership       |               13 |
| Manajemen Pohon           |                9 |
| Laporan Kondisi Pohon     |                6 |
| Laporan Operasional Kebun |                8 |
| SOP dan Jadwal            |               15 |
| Tugas Worker              |                7 |
| Fase Pertumbuhan          |                8 |
| Riwayat Pohon             |                3 |
| Dashboard                 |               11 |
| Role dan Akses            |                7 |
| UX dan Data               |               11 |
| Total                     |              104 |

---

# 18. Format Rekap Hasil Pengujian

Setelah pengujian dilakukan, hasilnya dapat direkap dengan format berikut:

| Modul                     | Jumlah Test Case | Pass | Fail | Pending | Persentase Berhasil |
| ------------------------- | ---------------: | ---: | ---: | ------: | ------------------: |
| Autentikasi               |                6 |      |      |         |                     |
| Farm dan Membership       |               13 |      |      |         |                     |
| Manajemen Pohon           |                9 |      |      |         |                     |
| Laporan Kondisi Pohon     |                6 |      |      |         |                     |
| Laporan Operasional Kebun |                8 |      |      |         |                     |
| SOP dan Jadwal            |               15 |      |      |         |                     |
| Tugas Worker              |                7 |      |      |         |                     |
| Fase Pertumbuhan          |                8 |      |      |         |                     |
| Riwayat Pohon             |                3 |      |      |         |                     |
| Dashboard                 |               11 |      |      |         |                     |
| Role dan Akses            |                7 |      |      |         |                     |
| UX dan Data               |               11 |      |      |         |                     |
| Total                     |              104 |      |      |         |                     |

Rumus persentase berhasil:

```txt
Persentase Berhasil = (Jumlah Pass / Total Test Case) × 100%
```

---

# 19. Kesimpulan

Black-box testing plan Avology V2 dirancang untuk memastikan bahwa seluruh fitur MVP berjalan sesuai kebutuhan fungsional dan non-fungsional.

Pengujian mencakup 102 test case yang tersebar pada modul autentikasi, kebun, worker, pohon, laporan, SOP, jadwal, tugas, fase pertumbuhan, riwayat, dashboard, role access, UX, dan konsistensi data.

Hasil pengujian ini nantinya dapat digunakan sebagai dasar pembahasan pada Bab 4 untuk menunjukkan bahwa sistem telah diuji berdasarkan skenario penggunaan yang sesuai dengan kebutuhan pengguna dan scope MVP.
