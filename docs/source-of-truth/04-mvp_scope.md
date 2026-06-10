# MVP Scope Avology V2

## Fokus Utama MVP

Avology V2 difokuskan sebagai aplikasi mobile sistem informasi operasional kebun alpukat yang membantu pemilik dan pekerja kebun dalam mencatat data pohon, memantau kondisi kebun, mengelola jadwal perawatan, menjalankan tugas pekerja, mencatat fase pertumbuhan, serta menyediakan dashboard monitoring bagi pemilik kebun.

MVP ini berangkat dari permasalahan utama di MS Farm, yaitu belum adanya pencatatan terstruktur terhadap data pohon, jadwal treatment, kondisi pohon, riwayat perawatan, fase pertumbuhan, dan laporan operasional kebun. Akibatnya, pelaksanaan SOP perawatan berisiko tidak konsisten, riwayat treatment sulit dilacak, dan pemilik kebun kesulitan mengambil keputusan cepat saat tidak berada di kebun.

---

## 1. Autentikasi dan Role Pengguna

### Fitur Masuk MVP

* Registrasi pengguna
* Login pengguna
* Logout pengguna
* Pembagian role pengguna:

  * Owner
  * Worker

### Tujuan

Fitur ini digunakan untuk membedakan hak akses antara pemilik kebun dan pekerja kebun.

Owner memiliki akses untuk mengelola data utama kebun, pekerja, pohon, jadwal, SOP, laporan, dan dashboard. Worker memiliki akses untuk melihat tugas, menyelesaikan tugas, melaporkan kondisi pohon, dan membuat laporan operasional kebun.

---

## 2. Manajemen Kebun

### Fitur Masuk MVP

* Owner membuat data kebun
* Sistem menghasilkan kode bergabung kebun
* Worker mengajukan bergabung ke kebun menggunakan kode
* Owner menerima pengajuan worker
* Owner menolak pengajuan worker

### Tujuan

Fitur ini digunakan untuk membentuk ruang kerja utama dalam aplikasi, sehingga data pohon, pekerja, jadwal, tugas, dan laporan terhubung dengan satu kebun tertentu.

---

## 3. Manajemen Pekerja

### Fitur Masuk MVP

* Owner melihat daftar worker dalam kebun
* Owner melihat status worker:

  * Pending
  * Active
  * Rejected
  * Removed
* Owner menerima worker pending
* Owner menolak worker pending
* Owner menghapus atau mengeluarkan worker aktif dari kebun

### Tujuan

Fitur ini digunakan agar owner dapat mengelola anggota kebun. Jika worker sudah tidak bekerja atau tidak lagi terlibat dalam operasional kebun, owner dapat menghapus akses worker dari kebun.

Penghapusan worker sebaiknya tidak dilakukan dengan delete permanen, tetapi dengan mengubah status worker menjadi removed agar riwayat tugas dan laporan yang pernah dibuat tetap dapat dilacak.

---

## 4. Manajemen Data Pohon

### Fitur Masuk MVP

* Owner menambah data pohon
* Owner mengubah data pohon
* Owner melihat detail pohon
* Owner mengarsipkan pohon
* Owner mengarsipkan pohon jika diperlukan
* Sistem menyimpan identitas pohon, seperti:

  * kode/nomor pohon
  * baris
  * kolom
  * varietas
  * tanggal tanam
  * status arsip
  * kondisi terbaru
  * fase pertumbuhan terbaru

### Tujuan

Fitur ini digunakan untuk mencatat setiap pohon secara individual karena setiap pohon memiliki kondisi, perkembangan, dan kebutuhan treatment yang berbeda.

---

## 5. Laporan Kondisi Pohon

### Fitur Masuk MVP

* Owner atau worker mencatat kondisi pohon
* Laporan dikaitkan dengan pohon tertentu
* Kondisi pohon dapat berupa:

  * sehat
  * perlu perhatian
  * terserang hama
  * terindikasi penyakit
  * rusak
  * mati
* Pengguna dapat menambahkan catatan singkat
* Sistem menampilkan kondisi terbaru pohon
* Sistem menyimpan riwayat kondisi pohon

### Tujuan

Fitur ini digunakan untuk mencatat perubahan kondisi pohon secara historis, terutama terkait hama, penyakit, kerusakan, atau kondisi yang membutuhkan perhatian.

Fitur ini menjawab kebutuhan pemilik kebun untuk mengetahui pohon mana yang bermasalah dan membutuhkan tindakan perawatan.

---

## 6. Laporan Operasional Kebun

### Fitur Masuk MVP

* Worker membuat laporan operasional kebun
* Laporan tidak harus terkait dengan pohon tertentu
* Kategori laporan operasional meliputi:

  * kerusakan lahan
  * alat rusak
  * stok habis
  * hama atau penyakit area
  * bencana atau cuaca ekstrem
  * kebutuhan pekerja
  * lainnya
* Worker menambahkan lokasi atau catatan singkat
* Owner melihat daftar laporan masuk
* Owner mengubah status laporan:

  * baru
  * diproses
  * selesai
  * ditolak
* Owner dapat membuat tugas tindak lanjut dari laporan operasional

### Tujuan

Fitur ini digunakan agar worker dapat melaporkan kejadian lapangan yang tidak selalu berkaitan dengan pohon individual, seperti kerusakan lahan, alat rusak, kebutuhan tambahan, atau kondisi kebun yang membutuhkan respons owner.

Fitur ini penting karena owner tidak selalu berada di kebun dan membutuhkan informasi lapangan untuk mengambil keputusan cepat.

---

## 7. SOP Perawatan sebagai Template Standar

### Fitur Masuk MVP

* Owner membuat template SOP perawatan
* Owner mengubah template SOP
* Owner mengaktifkan atau menonaktifkan SOP
* Data SOP mencakup:

  * nama SOP
  * kategori perawatan
  * interval hari
  * instruksi default
  * target default
  * status aktif/tidak aktif

### Kategori SOP

* Penyiraman
* Pemupukan
* Penyemprotan
* Pengendalian gulma
* Lainnya

### Tujuan

SOP dalam Avology V2 tidak diposisikan sebagai dokumen prosedur panjang, tetapi sebagai template standar perawatan yang membantu owner membuat jadwal dan tugas secara lebih konsisten.

SOP digunakan untuk menyimpan instruksi dan interval perawatan, sehingga owner tidak perlu menulis instruksi berulang setiap kali membuat jadwal.

---

## 8. Jadwal Perawatan Berbasis SOP dan Manual

### Fitur Masuk MVP

* Owner membuat jadwal dari SOP
* Owner membuat jadwal manual tanpa SOP
* Owner menentukan tanggal jadwal
* Owner menentukan target jadwal:

  * seluruh kebun
  * baris tertentu
  * kolom tertentu
  * pohon tertentu
* Owner memilih worker yang bertugas
* Jadwal menghasilkan tugas untuk worker
* Jadwal dapat menyimpan instruksi perawatan

### Tujuan

Fitur ini digunakan untuk mengubah rencana perawatan menjadi tugas yang dapat dikerjakan worker.

Jadwal dapat dibuat dari SOP agar instruksi dan kategori perawatan otomatis terisi berdasarkan template, tetapi owner tetap memiliki fleksibilitas untuk membuat jadwal manual jika pekerjaan tidak sesuai SOP tertentu.

---

## 9. Interval SOP dan Acuan Jadwal Berikutnya

### Fitur Masuk MVP

* SOP menyimpan interval perawatan dalam satuan hari

* Sistem melihat tanggal realisasi terakhir dari SOP terkait

* Sistem menghitung acuan jadwal berikutnya berdasarkan:

  tanggal realisasi terakhir + interval SOP

* Sistem menampilkan status jadwal berikutnya, misalnya:

  * belum jatuh tempo
  * jatuh tempo hari ini
  * terlambat

* Owner dapat membuat jadwal berikutnya berdasarkan acuan tersebut

* Sistem tidak otomatis membuat tugas tanpa konfirmasi owner

### Tujuan

Fitur ini digunakan untuk membantu owner menjaga konsistensi perawatan tanpa harus mengingat sendiri tanggal treatment terakhir.

Mekanisme ini bersifat semi-otomatis. Sistem membantu menghitung acuan jadwal berikutnya, tetapi owner tetap meninjau dan membuat jadwal/tugas secara sadar.

Fitur ini dipilih agar MVP tetap realistis dan tidak membutuhkan sistem background scheduler atau push notification yang kompleks.

---

## 10. Tugas Worker

### Fitur Masuk MVP

* Worker melihat daftar tugas
* Worker melihat tugas hari ini
* Worker melihat detail tugas
* Worker menandai tugas sebagai selesai
* Worker menandai tugas sebagai tertunda
* Worker menambahkan catatan singkat saat menyelesaikan atau menunda tugas
* Status tugas dapat berupa:

  * belum selesai
  * selesai
  * tertunda

### Tujuan

Fitur ini digunakan agar jadwal yang dibuat owner benar-benar menjadi pekerjaan yang bisa dilihat dan dikerjakan worker.

Tugas worker menjadi penghubung antara rencana perawatan dan realisasi di lapangan.

---

## 11. Realisasi Perawatan dan Riwayat Aktivitas

### Fitur Masuk MVP

* Sistem menyimpan realisasi tugas worker
* Realisasi tugas mencakup:

  * tugas terkait
  * worker pelaksana
  * status realisasi
  * tanggal realisasi
  * catatan singkat
* Jika tugas berkaitan dengan pohon tertentu, aktivitas masuk ke riwayat pohon
* Jika tugas berkaitan dengan kebun atau area, aktivitas masuk ke riwayat operasional kebun

### Tujuan

Fitur ini digunakan untuk mencatat apakah tugas benar-benar dilakukan atau tidak.

Riwayat realisasi penting untuk membantu owner mengevaluasi disiplin perawatan dan mengetahui treatment apa yang pernah diberikan.

---

## 12. Fase Pertumbuhan Pohon

### Fitur Masuk MVP

* Owner atau worker mencatat fase pertumbuhan pohon
* Fase pertumbuhan mencakup:

  * awal tanam
  * vegetatif
  * berbunga
  * berbuah
  * panen
* Sistem menampilkan fase terbaru pohon
* Sistem menyimpan riwayat fase pertumbuhan pohon
* Sistem menampilkan pohon yang sedang berbunga atau berbuah sebagai acuan monitoring

### Tujuan

Fitur ini digunakan untuk mencatat perkembangan pohon secara historis, terutama fase berbunga dan berbuah.

Fitur ini tidak digunakan untuk memprediksi panen otomatis. Keputusan panen tetap dilakukan oleh owner atau worker berdasarkan kondisi fisik buah di lapangan.

---

## 13. Riwayat Pohon

### Fitur Masuk MVP

* Sistem menampilkan riwayat kondisi pohon
* Sistem menampilkan riwayat perawatan pohon
* Sistem menampilkan riwayat fase pertumbuhan pohon
* Riwayat ditampilkan berdasarkan urutan waktu

### Tujuan

Fitur ini digunakan untuk menyediakan track record setiap pohon, sehingga owner dapat mengetahui apa saja yang pernah terjadi pada pohon tertentu.

Riwayat pohon membantu owner mengevaluasi treatment, kondisi, dan perkembangan pohon dari waktu ke waktu.

---

## 14. Dashboard Owner

### Fitur Masuk MVP

Dashboard owner menampilkan ringkasan informasi penting, seperti:

* total pohon
* jumlah pohon sehat
* jumlah pohon bermasalah
* tugas hari ini
* tugas belum selesai
* laporan operasional baru
* worker pending
* pohon dalam fase berbunga
* pohon dalam fase berbuah
* SOP yang sudah jatuh tempo atau terlambat

### Tujuan

Dashboard digunakan sebagai alat bantu decision making cepat bagi owner.

Owner dapat melihat kondisi penting kebun dalam waktu singkat tanpa harus membuka semua halaman satu per satu.

---

## 15. Dashboard Worker

### Fitur Masuk MVP

Dashboard worker menampilkan ringkasan informasi seperti:

* tugas hari ini
* tugas belum selesai
* tugas selesai
* shortcut lapor kondisi pohon
* shortcut buat laporan operasional

### Tujuan

Dashboard worker digunakan agar pekerja dapat langsung mengetahui pekerjaan utama yang harus dilakukan dan melaporkan kondisi lapangan dengan cepat.

---

# Fitur yang Tidak Masuk MVP

Fitur berikut tidak dimasukkan ke dalam MVP Avology V2:

1. Prediksi panen otomatis
2. Machine learning untuk prediksi panen
3. Push notification atau alarm otomatis
4. Integrasi IoT atau sensor
5. Integrasi API cuaca
6. Chat owner-worker
7. Akuntansi atau laporan laba-rugi lengkap
8. Laporan PDF otomatis
9. Integrated farming
10. Peternakan dan bank pakan
11. Supply chain resto atau warung
12. Marketplace hasil panen
13. Grading buah A1, A2, A3
14. Sistem kelompok tani
15. Multi-owner kompleks
16. Role admin global
17. Recurring task full otomatis tanpa konfirmasi owner

---

# Batasan Penting MVP

1. Sistem tidak melakukan prediksi panen otomatis.
2. Sistem hanya mencatat fase pertumbuhan sebagai acuan monitoring.
3. Sistem tidak mengirim push notification.
4. Sistem tidak membuat tugas berulang otomatis tanpa persetujuan owner.
5. SOP digunakan sebagai template standar dan acuan interval, bukan sebagai dokumen prosedur panjang.
6. Laporan operasional kebun hanya mencakup laporan, status, dan tindak lanjut menjadi tugas.
7. Manajemen worker hanya mencakup approve, reject, dan remove worker.
8. Fokus aplikasi adalah pencatatan, monitoring, jadwal, tugas, dan riwayat operasional kebun alpukat.

---

# Ringkasan Scope Final

MVP Avology V2 mencakup:

1. Autentikasi dan role pengguna
2. Manajemen kebun
3. Manajemen pekerja
4. Manajemen data pohon
5. Laporan kondisi pohon
6. Laporan operasional kebun
7. SOP perawatan sebagai template standar
8. Jadwal perawatan dari SOP atau manual
9. Interval SOP sebagai acuan jadwal berikutnya
10. Tugas worker
11. Realisasi perawatan
12. Fase pertumbuhan pohon
13. Riwayat pohon
14. Dashboard owner
15. Dashboard worker

Dengan scope ini, Avology V2 diposisikan sebagai sistem informasi operasional kebun alpukat yang mendukung pencatatan, pemantauan, koordinasi kerja, dan pengambilan keputusan owner berdasarkan data lapangan.
