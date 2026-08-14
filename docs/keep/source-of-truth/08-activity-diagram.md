# Activity Diagram Avology V2

> **Catatan perubahan (migrasi 046 & 047).** Fitur SOP perawatan dan target
> jadwal berupa **baris**/**kolom** sudah dicabut dari sistem. Activity diagram
> "Owner Mengelola SOP Perawatan" dihapus, dan "Owner Membuat Jadwal dan Tugas
> dari SOP" diganti menjadi "Owner Membuat Jadwal dan Tugas Perawatan". Karena
> daftar diagram di dokumen ini bernomor urut dan tidak dirujuk dokumen lain,
> penomorannya dirapatkan. Riwayat keputusannya ada di `decision-log.md`.

> **Catatan perubahan (migrasi 048–052).** Diagram "Owner Membuat Jadwal dan
> Tugas Perawatan" dan "Worker Melihat dan Merealisasikan Tugas" disunting:
> penyapuan jadwal terlewat, pengaturan masa toleransi, penundaan bertanggal,
> dan penautan pohon saat tugas diselesaikan kini muncul di alurnya. Batasan
> nomor 13 diperbaiki karena rantai jadwal sudah tidak menunggu konfirmasi
> owner. Penomoran diagram TIDAK bergeser. Riwayat keputusannya ada di
> `decision-log.md` (DL-034 sampai DL-038).

## 1. Tujuan Activity Diagram

Activity diagram digunakan untuk menggambarkan alur aktivitas utama dalam sistem Avology V2. Diagram ini membantu menjelaskan bagaimana proses bisnis berjalan dari sisi owner, worker, dan sistem.

Activity diagram tidak dibuat untuk seluruh use case, tetapi hanya untuk proses utama yang berpengaruh langsung terhadap operasional sistem.

---

# 2. Daftar Activity Diagram yang Dibuat

Activity diagram Avology V2 mencakup alur berikut:

1. Registrasi dan Login Pengguna
2. Owner Membuat Kebun
3. Worker Mengajukan Bergabung ke Kebun
4. Owner Mengelola Pengajuan Worker
5. Owner Mengelola Data Pohon
6. Pengguna Mencatat Kondisi Pohon
7. Worker Membuat Laporan Operasional Kebun
8. Owner Menindaklanjuti Laporan Operasional
9. Owner Membuat Jadwal dan Tugas Perawatan
10. Worker Melihat dan Merealisasikan Tugas
11. Pengguna Mencatat Fase Pertumbuhan Pohon
12. Owner Melihat Dashboard

---

# 3. Activity Diagram Registrasi dan Login Pengguna

## Deskripsi

Alur ini menjelaskan proses pengguna melakukan registrasi dan login ke aplikasi. Setelah login, sistem akan memeriksa status pengguna dan mengarahkan pengguna sesuai role serta status keanggotaannya.

```plantuml
@startuml
title Activity Diagram Registrasi dan Login Pengguna

start

:Pengguna membuka aplikasi;

if (Sudah memiliki akun?) then (Tidak)
  :Pengguna membuka halaman registrasi;
  :Pengguna mengisi data registrasi;
  :Sistem memvalidasi data;
  if (Data valid?) then (Ya)
    :Sistem membuat akun pengguna;
    :Sistem menyimpan profil pengguna;
  else (Tidak)
    :Sistem menampilkan pesan kesalahan;
    stop
  endif
endif

:Pengguna membuka halaman login;
:Pengguna memasukkan email dan password;
:Sistem memvalidasi akun;

if (Login valid?) then (Ya)
  :Sistem memeriksa role dan status pengguna;

  if (Owner?) then (Ya)
    :Sistem mengarahkan ke halaman owner;
  else (Worker)
    if (Status worker active?) then (Ya)
      :Sistem mengarahkan ke halaman worker;
    elseif (Status worker pending?) then (Pending)
      :Sistem menampilkan halaman status pengajuan;
    else (Rejected / Removed)
      :Sistem menolak akses ke data kebun;
    endif
  endif

else (Tidak)
  :Sistem menampilkan pesan login gagal;
endif

stop
@enduml
```

---

# 4. Activity Diagram Owner Membuat Kebun

## Deskripsi

Alur ini menjelaskan proses owner membuat data kebun sebagai ruang kerja utama dalam aplikasi. Setelah kebun dibuat, sistem menghasilkan kode bergabung yang dapat digunakan worker untuk mengajukan akses.

```plantuml
@startuml
title Activity Diagram Owner Membuat Kebun

start

:Owner login ke aplikasi;
:Sistem memeriksa apakah owner sudah memiliki kebun;

if (Sudah memiliki kebun?) then (Ya)
  :Sistem menampilkan dashboard owner;
else (Tidak)
  :Owner membuka halaman buat kebun;
  :Owner mengisi data kebun;
  :Sistem memvalidasi data kebun;

  if (Data valid?) then (Ya)
    :Sistem menyimpan data kebun;
    :Sistem menghubungkan owner sebagai pemilik kebun;
    :Sistem membuat kode bergabung kebun;
    :Sistem menampilkan dashboard owner;
  else (Tidak)
    :Sistem menampilkan pesan kesalahan;
  endif
endif

stop
@enduml
```

---

# 5. Activity Diagram Worker Mengajukan Bergabung ke Kebun

## Deskripsi

Alur ini menjelaskan proses worker mengajukan akses ke kebun menggunakan kode bergabung yang diberikan oleh owner.

```plantuml
@startuml
title Activity Diagram Worker Mengajukan Bergabung ke Kebun

start

:Worker login ke aplikasi;
:Sistem memeriksa status keanggotaan worker;

if (Worker sudah active?) then (Ya)
  :Sistem menampilkan dashboard worker;
else (Belum)
  :Worker membuka halaman gabung kebun;
  :Worker memasukkan kode bergabung;
  :Sistem memvalidasi kode kebun;

  if (Kode valid?) then (Ya)
    :Sistem membuat pengajuan worker;
    :Sistem menyimpan status pending;
    :Sistem menampilkan halaman menunggu persetujuan;
  else (Tidak)
    :Sistem menampilkan pesan kode tidak valid;
  endif
endif

stop
@enduml
```

---

# 6. Activity Diagram Owner Mengelola Pengajuan Worker

## Deskripsi

Alur ini menjelaskan proses owner menerima atau menolak pengajuan worker. Owner juga dapat mengeluarkan worker aktif dari kebun jika worker sudah tidak terlibat dalam operasional.

```plantuml
@startuml
title Activity Diagram Owner Mengelola Worker

start

:Owner membuka halaman manajemen pekerja;
:Sistem menampilkan daftar worker dan pengajuan;

if (Owner memilih pengajuan pending?) then (Ya)
  :Owner membuka detail pengajuan;

  if (Owner menyetujui pengajuan?) then (Ya)
    :Sistem mengubah status worker menjadi active;
    :Worker mendapat akses ke fitur worker;
  else (Ditolak)
    :Sistem mengubah status worker menjadi rejected;
    :Worker tidak dapat mengakses data kebun;
  endif

elseif (Owner memilih worker active?) then (Ya)
  :Owner memilih aksi keluarkan worker;
  :Sistem meminta konfirmasi;

  if (Dikonfirmasi?) then (Ya)
    :Sistem mengubah status worker menjadi removed;
    :Sistem mencabut akses worker ke kebun;
    :Riwayat tugas dan laporan tetap tersimpan;
  else (Tidak)
    :Sistem membatalkan aksi;
  endif

else (Tidak ada aksi)
  :Sistem tetap menampilkan daftar worker;
endif

stop
@enduml
```

---

# 7. Activity Diagram Owner Mengelola Data Pohon

## Deskripsi

Alur ini menjelaskan proses owner mengelola data pohon, termasuk tambah, edit, dan arsip data pohon. Data pohon digunakan sebagai dasar pencatatan kondisi, fase, dan riwayat perawatan.

```plantuml
@startuml
title Activity Diagram Owner Mengelola Data Pohon

start

:Owner membuka halaman data pohon;
:Sistem menampilkan daftar pohon;

if (Owner menambah pohon?) then (Tambah)
  :Owner mengisi data pohon;
  :Sistem memvalidasi data;
  if (Data valid?) then (Ya)
    :Sistem menyimpan data pohon;
    :Sistem menampilkan pohon pada daftar;
  else (Tidak)
    :Sistem menampilkan pesan kesalahan;
  endif

elseif (Owner mengedit pohon?) then (Edit)
  :Owner memilih pohon;
  :Owner mengubah data pohon;
  :Sistem menyimpan perubahan;

elseif (Owner mengarsipkan pohon?) then (Arsip)
  :Owner memilih pohon;
  :Sistem mengubah status pohon menjadi arsip;
  :Riwayat pohon tetap tersimpan;

else (Lihat Detail)
  :Owner memilih pohon;
  :Sistem menampilkan detail dan riwayat pohon;
endif

stop
@enduml
```

---

# 8. Activity Diagram Pengguna Mencatat Kondisi Pohon

## Deskripsi

Alur ini menjelaskan proses owner atau worker mencatat kondisi pohon. Data kondisi digunakan untuk memperbarui kondisi terbaru pohon dan menambah riwayat kondisi pohon.

```plantuml
@startuml
title Activity Diagram Mencatat Kondisi Pohon

start

:Pengguna membuka halaman pohon;
:Pengguna memilih pohon;
:Pengguna membuka form laporan kondisi;
:Pengguna memilih kategori kondisi;
:Pengguna mengisi catatan singkat jika diperlukan;
:Sistem memvalidasi laporan;

if (Data valid?) then (Ya)
  :Sistem menyimpan laporan kondisi pohon;
  :Sistem memperbarui kondisi terbaru pohon;
  :Sistem menambahkan laporan ke riwayat pohon;
  :Sistem menampilkan pesan berhasil;
else (Tidak)
  :Sistem menampilkan pesan kesalahan;
endif

stop
@enduml
```

---

# 9. Activity Diagram Worker Membuat Laporan Operasional Kebun

## Deskripsi

Alur ini menjelaskan proses worker membuat laporan operasional kebun untuk kejadian yang tidak selalu berkaitan dengan pohon tertentu, seperti kerusakan lahan, alat rusak, stok habis, bencana, atau kebutuhan pekerja.

```plantuml
@startuml
title Activity Diagram Worker Membuat Laporan Operasional Kebun

start

:Worker membuka dashboard worker;
:Worker memilih fitur laporan operasional;
:Worker memilih kategori laporan;
:Worker mengisi lokasi atau catatan singkat;
:Sistem memvalidasi laporan;

if (Data valid?) then (Ya)
  :Sistem menyimpan laporan operasional;
  :Sistem menetapkan status laporan menjadi baru;
  :Sistem menampilkan pesan berhasil;
  :Owner dapat melihat laporan masuk;
else (Tidak)
  :Sistem menampilkan pesan kesalahan;
endif

stop
@enduml
```

---

# 10. Activity Diagram Owner Menindaklanjuti Laporan Operasional

## Deskripsi

Alur ini menjelaskan proses owner melihat laporan operasional, mengubah status laporan, dan membuat tugas tindak lanjut jika laporan membutuhkan aksi dari worker.

```plantuml
@startuml
title Activity Diagram Owner Menindaklanjuti Laporan Operasional

start

:Owner membuka halaman laporan operasional;
:Sistem menampilkan daftar laporan;
:Owner memilih laporan;
:Sistem menampilkan detail laporan;

if (Laporan perlu tindakan?) then (Ya)
  :Owner memilih buat tugas tindak lanjut;
  :Owner menentukan worker, tanggal, target, dan instruksi;
  :Sistem menyimpan tugas tindak lanjut;
  :Sistem mengubah status laporan menjadi diproses;
  :Tugas muncul pada daftar tugas worker;

elseif (Laporan selesai tanpa tugas?) then (Selesai)
  :Owner mengubah status laporan menjadi selesai;

elseif (Laporan tidak valid?) then (Ditolak)
  :Owner mengubah status laporan menjadi ditolak;

else (Belum diproses)
  :Status laporan tetap baru;
endif

stop
@enduml
```

---

# 11. Activity Diagram Owner Membuat Jadwal dan Tugas Perawatan

## Deskripsi

Alur ini menjelaskan proses owner membuat jadwal perawatan beserta tugas worker. Untuk jadwal berulang, owner menentukan interval pengulangan, dasar perhitungan tanggal penerus, dan masa toleransi keterlambatan; siklus berikutnya kemudian dibentuk sistem tanpa perlu dibuat ulang oleh owner.

```plantuml
@startuml
title Activity Diagram Owner Membuat Jadwal dan Tugas Perawatan

start

:Owner membuka halaman jadwal perawatan;
:Sistem menyapu jadwal yang lewat masa toleransi;
:Sistem menandai jadwal terlewat dan membuat penerusnya;
:Sistem menampilkan daftar jadwal beserta statusnya;

:Owner memilih buat jadwal;
:Owner mengisi judul jadwal;
:Owner memilih kategori perawatan;
:Owner mengisi instruksi perawatan;
:Owner menentukan tanggal jadwal;
:Owner menentukan target jadwal;
:Owner memilih worker;

if (Jadwal berulang?) then (Ya)
  :Owner menentukan interval pengulangan;
  :Owner memilih dasar tanggal penerus;
  :Owner menentukan masa toleransi keterlambatan;
else (Tidak)
endif

:Owner meninjau jadwal;

if (Owner menyimpan jadwal?) then (Ya)
  :Sistem menyimpan jadwal perawatan;
  :Sistem membuat tugas untuk worker;
  :Tugas muncul pada daftar tugas worker;
else (Tidak)
  :Sistem membatalkan pembuatan jadwal;
endif

stop
@enduml
```

---

# 12. Activity Diagram Worker Melihat dan Merealisasikan Tugas

## Deskripsi

Alur ini menjelaskan proses worker melihat tugas, membuka detail tugas, lalu menandai tugas sebagai selesai atau tertunda. Realisasi tugas akan menjadi riwayat perawatan, dan tugas yang diselesaikan juga menautkan pohon yang dirawat sehingga masuk ke riwayat pohon.

```plantuml
@startuml
title Activity Diagram Worker Melihat dan Merealisasikan Tugas

start

:Worker membuka dashboard worker;
:Sistem menampilkan ringkasan tugas;
:Worker membuka daftar tugas;
:Sistem menampilkan tugas milik worker;
:Worker memilih tugas;
:Sistem menampilkan detail tugas;

if (Worker menyelesaikan tugas?) then (Selesai)
  :Worker menambahkan catatan singkat jika diperlukan;
  :Sistem menyimpan tanggal realisasi;

  if (Target tugas?) then (Pohon tertentu)
    :Sistem menautkan pohon target ke aktivitas;
  elseif (Seluruh kebun) then (Kebun)
    :Sistem menautkan semua pohon kebun yang belum diarsipkan;
  else (Catatan bebas)
    :Sistem tidak menautkan pohon;
  endif

  :Sistem mengubah status tugas menjadi selesai;
  :Sistem menyimpan aktivitas ke riwayat perawatan;
  :Sistem menampilkan aktivitas pada riwayat setiap pohon yang tertaut;

  if (Jadwal induk berulang?) then (Ya)
    :Sistem membuat jadwal penerus;
  else (Tidak)
  endif

elseif (Worker menunda tugas?) then (Tertunda)
  :Worker memilih tanggal rencana pengerjaan ulang;
  :Worker mengisi alasan atau catatan singkat;
  :Sistem mengubah status tugas menjadi tertunda;
  :Sistem menggeser tenggat tugas ke tanggal penundaan;
  :Owner dapat melihat tugas tertunda beserta tanggal rencananya;

else (Tidak ada aksi)
  :Status tugas tetap belum selesai;
endif

stop
@enduml
```

---

# 13. Activity Diagram Pengguna Mencatat Fase Pertumbuhan Pohon

## Deskripsi

Alur ini menjelaskan proses owner atau worker mencatat fase pertumbuhan pohon. Sistem memperbarui fase terbaru pohon dan menyimpan riwayat fase.

```plantuml
@startuml
title Activity Diagram Mencatat Fase Pertumbuhan Pohon

start

:Pengguna membuka detail pohon;
:Pengguna memilih fitur catat fase;
:Pengguna memilih fase pertumbuhan;
:Pengguna mengisi catatan singkat jika diperlukan;
:Sistem memvalidasi data fase;

if (Data valid?) then (Ya)
  :Sistem menyimpan catatan fase pertumbuhan;
  :Sistem memperbarui fase terbaru pohon;
  :Sistem menambahkan fase ke riwayat pohon;

  if (Fase berbunga atau berbuah?) then (Ya)
    :Sistem menampilkan pohon sebagai acuan monitoring panen;
  else (Tidak)
    :Sistem hanya menyimpan fase sebagai riwayat;
  endif

else (Tidak)
  :Sistem menampilkan pesan kesalahan;
endif

stop
@enduml
```

---

# 14. Activity Diagram Owner Melihat Dashboard

## Deskripsi

Alur ini menjelaskan proses sistem menampilkan dashboard owner. Dashboard berisi ringkasan data penting agar owner dapat mengambil keputusan cepat.

```plantuml
@startuml
title Activity Diagram Owner Melihat Dashboard

start

:Owner membuka dashboard;
:Sistem mengambil data kebun;
:Sistem menghitung total pohon;
:Sistem menghitung jumlah pohon sehat;
:Sistem menghitung jumlah pohon bermasalah;
:Sistem mengambil data tugas hari ini;
:Sistem mengambil data tugas belum selesai;
:Sistem mengambil laporan operasional baru;
:Sistem mengambil worker pending;
:Sistem mengambil pohon berbunga dan berbuah;
:Sistem mengambil jadwal jatuh tempo atau terlambat;
:Sistem menampilkan ringkasan dashboard;

if (Owner memilih salah satu ringkasan?) then (Ya)
  :Sistem membuka halaman detail terkait;
else (Tidak)
  :Owner tetap melihat dashboard;
endif

stop
@enduml
```

---

# 15. Catatan Batasan Activity Diagram

Activity diagram Avology V2 tidak mencakup fitur berikut:

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
13. Penjadwal latar yang berjalan di luar aplikasi

Catatan untuk nomor 13: rantai jadwal berulang MEMANG berjalan tanpa konfirmasi owner, tetapi perhitungannya menumpang pada jalur baca aplikasi. Yang tidak dimiliki MVP adalah proses yang hidup sendiri di luar aplikasi seperti cron atau push notification.

Fitur tersebut tidak termasuk MVP dan hanya dapat dipertimbangkan sebagai pengembangan lanjutan.

---

# 16. Ringkasan Alur Sistem

Secara umum, alur kerja Avology V2 adalah sebagai berikut:

1. Owner membuat kebun.
2. Worker mengajukan bergabung menggunakan kode kebun.
3. Owner menyetujui worker.
4. Owner mengelola data pohon.
5. Owner membuat jadwal perawatan.
6. Sistem membantu menampilkan acuan jadwal berikutnya berdasarkan interval pengulangan jadwal.
7. Owner membuat jadwal dan tugas untuk worker.
8. Worker melihat dan merealisasikan tugas.
9. Worker atau owner mencatat kondisi serta fase pertumbuhan pohon.
10. Worker dapat membuat laporan operasional kebun.
11. Owner dapat menindaklanjuti laporan menjadi tugas.
12. Sistem menyimpan riwayat kondisi, perawatan, fase, dan laporan.
13. Owner memantau kondisi kebun melalui dashboard.
