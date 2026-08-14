# MVP Scope Avology V2

> **Catatan perubahan (migrasi 046 & 047).** Fitur SOP perawatan sebagai
> template (tabel `care_sops`) dan target jadwal berupa **baris**/**kolom**
> sudah dicabut dari sistem. Bagian yang menspesifikasikan keduanya dihapus dari
> dokumen ini. Istilah "SOP" yang masih muncul di bagian latar belakang mengacu
> pada praktik operasional di lapangan sebagaimana temuan wawancara, bukan pada
> fitur aplikasi yang dicabut. Riwayat keputusannya ada di `decision-log.md`.

> **Catatan perubahan (migrasi 048–052).** Pengulangan jadwal tidak lagi
> menunggu konfirmasi owner: rantai jadwal membuat penerusnya sendiri. Jadwal
> kini mengenal masa toleransi keterlambatan dan status **terlewat**, penundaan
> tugas wajib menyebut tanggal, realisasi tugas terjadwal menautkan pohon yang
> dirawat, tugas terbuka dilepas ketika pekerjanya berhenti aktif, dan jadwal
> hanya terkunci oleh hasil kerja yang benar-benar selesai. Riwayat
> keputusannya ada di `decision-log.md` (DL-034 sampai DL-038).

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

Owner memiliki akses untuk mengelola data utama kebun, pekerja, pohon, jadwal, laporan, dan dashboard. Worker memiliki akses untuk melihat tugas, menyelesaikan tugas, melaporkan kondisi pohon, dan membuat laporan operasional kebun.

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
* Worker dapat keluar sendiri dari kebun
* Tugas terbuka milik worker yang berhenti aktif dilepas otomatis, sehingga
  jadwalnya dapat ditugaskan kembali kepada worker lain

### Tujuan

Fitur ini digunakan agar owner dapat mengelola anggota kebun. Jika worker sudah tidak bekerja atau tidak lagi terlibat dalam operasional kebun, owner dapat menghapus akses worker dari kebun.

Penghapusan worker sebaiknya tidak dilakukan dengan delete permanen, tetapi dengan mengubah status worker menjadi removed agar riwayat tugas dan laporan yang pernah dibuat tetap dapat dilacak.

Ketika keanggotaan berhenti aktif — baik karena dikeluarkan owner maupun karena worker keluar sendiri — tugas yang belum dikerjakan tidak boleh ikut tertinggal atas nama orang yang sudah tidak ada di kebun. Tugas seperti itu dilepas: pekerjaannya berhenti dihitung sebagai tunggakan, sedangkan jadwalnya tetap hidup dan muncul kembali sebagai jadwal yang belum punya pekerja.

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

## 7. Jadwal Perawatan Manual

### Fitur Masuk MVP

* Owner membuat jadwal perawatan
* Owner menentukan kategori perawatan
* Owner menentukan tanggal jadwal
* Owner menentukan target jadwal:

  * seluruh kebun
  * pohon tertentu
  * target khusus berupa catatan bebas
* Owner memilih worker yang bertugas
* Jadwal menghasilkan tugas untuk worker
* Jadwal dapat menyimpan instruksi perawatan
* Owner dapat mengedit atau membatalkan jadwal selama belum ada hasil kerja
  yang selesai
* Owner dapat menugaskan ulang jadwal yang belum punya tugas aktif

### Tujuan

Fitur ini digunakan untuk mengubah rencana perawatan menjadi tugas yang dapat dikerjakan worker.

Setiap jadwal dibuat sendiri oleh owner, lengkap dengan kategori dan instruksinya, tanpa bergantung pada template apa pun.

Jadwal dikunci hanya oleh hasil kerja yang benar-benar selesai. Yang dilindungi penguncian itu adalah riwayat: begitu pekerjaan dilakukan, mengubah jadwalnya membuat catatan lama berbicara tentang perintah yang tidak pernah diberikan. Tugas yang ditunda tidak membawa risiko itu karena pekerjaannya justru belum terjadi, sehingga jadwalnya tetap dapat diedit maupun dibatalkan.

---

## 8. Interval Pengulangan, Rantai Jadwal, dan Masa Toleransi

### Fitur Masuk MVP

* Jadwal dapat menyimpan interval pengulangan dalam satuan hari

* Jadwal berulang membentuk rantai: begitu satu siklus ditutup, sistem membuat
  jadwal penerusnya sendiri tanpa menunggu konfirmasi owner

* Owner menentukan dasar perhitungan tanggal penerus:

  * dasar **jadwal** — tanggal penerus dihitung dari tanggal jadwal
  * dasar **realisasi** — tanggal penerus dihitung dari tanggal pekerjaan
    benar-benar dilakukan

* Jadwal dapat menyimpan masa toleransi keterlambatan dalam satuan hari.
  Tanpa masa toleransi, jadwal tidak pernah dinyatakan terlewat

* Sistem menampilkan status jadwal:

  * belum jatuh tempo
  * jatuh tempo hari ini
  * terlambat
  * terlewat

* Jadwal yang melewati masa toleransi dinyatakan **terlewat**, dan rantainya
  tetap berjalan ke siklus berikutnya

* Owner dapat menghentikan pengulangan tanpa membatalkan jadwal yang sedang
  berjalan

### Tujuan

Fitur ini digunakan untuk membantu owner menjaga konsistensi perawatan tanpa harus mengingat sendiri tanggal treatment terakhir.

Rantai jadwal dijalankan sistem, bukan owner. Pilihan ini diambil setelah terlihat bahwa perawatan berulang yang menunggu konfirmasi akan berhenti diam-diam begitu owner lupa satu siklus, dan justru siklus yang terlupakan itulah yang paling perlu dijaga.

Masa toleransi menjawab persoalan turunannya: tanpa batas waktu, satu siklus yang tidak dikerjakan akan menahan seluruh rantai selamanya. Dengan masa toleransi, siklus yang lewat ditutup sebagai terlewat dan penerusnya tetap lahir, sehingga perawatan berikutnya tidak ikut hilang.

MVP ini tetap tidak memakai background scheduler maupun push notification. Penerus jadwal dan penandaan terlewat dihitung saat aplikasi dibuka, pada jalur baca yang memang sudah berjalan, sehingga tidak dibutuhkan proses yang hidup di luar aplikasi.

---

## 9. Tugas Worker

### Fitur Masuk MVP

* Worker melihat daftar tugas
* Worker melihat tugas hari ini
* Worker melihat detail tugas
* Worker menandai tugas sebagai selesai
* Worker menandai tugas sebagai tertunda dengan menyebut tanggal rencana
  pengerjaan ulang
* Worker menambahkan catatan singkat saat menyelesaikan atau menunda tugas
* Tenggat tugas ikut bergeser ke tanggal penundaan, sehingga masa toleransi
  dihitung ulang dari tanggal baru itu
* Status tugas dapat berupa:

  * belum selesai
  * selesai
  * tertunda
* Di samping status tersebut, tugas dapat ditandai **terlewat** bila melewati
  masa toleransi jadwalnya, dan **dilepas** bila pekerjanya berhenti aktif.
  Keduanya bukan nilai status, melainkan penanda terpisah

### Tujuan

Fitur ini digunakan agar jadwal yang dibuat owner benar-benar menjadi pekerjaan yang bisa dilihat dan dikerjakan worker.

Tugas worker menjadi penghubung antara rencana perawatan dan realisasi di lapangan.

---

## 10. Realisasi Perawatan dan Riwayat Aktivitas

### Fitur Masuk MVP

* Sistem menyimpan realisasi tugas worker
* Realisasi tugas mencakup:

  * tugas terkait
  * worker pelaksana
  * status realisasi
  * tanggal realisasi
  * catatan singkat
  * tanggal rencana pengerjaan ulang, khusus untuk realisasi berupa penundaan
* Saat tugas diselesaikan, sistem menautkan pohon yang dirawat ke aktivitas itu:

  * target pohon tertentu — pohon itu saja
  * target seluruh kebun — semua pohon kebun yang belum diarsipkan
  * target khusus berupa catatan bebas — tidak ada pohon yang ditautkan
* Aktivitas yang tertaut pohon masuk ke riwayat pohon terkait
* Aktivitas yang tidak tertaut pohon tetap tercatat sebagai riwayat kerja kebun

### Tujuan

Fitur ini digunakan untuk mencatat apakah tugas benar-benar dilakukan atau tidak.

Riwayat realisasi penting untuk membantu owner mengevaluasi disiplin perawatan dan mengetahui treatment apa yang pernah diberikan.

Pohon ditautkan pada saat tugas diselesaikan, bukan pada saat jadwal dibuat. Jadwal berulang bisa lahir jauh sebelum dikerjakan dan daftar pohon kebun berubah di antaranya, sehingga tautan yang dibentuk di akhir mencerminkan pohon yang benar-benar ada ketika pekerjaan dilakukan.

---

## 11. Fase Pertumbuhan Pohon

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

## 12. Riwayat Pohon

### Fitur Masuk MVP

* Sistem menampilkan riwayat kondisi pohon
* Sistem menampilkan riwayat perawatan pohon
* Sistem menampilkan riwayat fase pertumbuhan pohon
* Riwayat ditampilkan berdasarkan urutan waktu

### Tujuan

Fitur ini digunakan untuk menyediakan track record setiap pohon, sehingga owner dapat mengetahui apa saja yang pernah terjadi pada pohon tertentu.

Riwayat pohon membantu owner mengevaluasi treatment, kondisi, dan perkembangan pohon dari waktu ke waktu.

---

## 13. Dashboard Owner

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
* jadwal yang sudah jatuh tempo atau terlambat

### Tujuan

Dashboard digunakan sebagai alat bantu decision making cepat bagi owner.

Owner dapat melihat kondisi penting kebun dalam waktu singkat tanpa harus membuka semua halaman satu per satu.

---

## 14. Dashboard Worker

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
17. Penjadwal latar yang berjalan di luar aplikasi

---

# Batasan Penting MVP

1. Sistem tidak melakukan prediksi panen otomatis.
2. Sistem hanya mencatat fase pertumbuhan sebagai acuan monitoring.
3. Sistem tidak mengirim push notification.
4. Sistem tidak membuat tugas berulang otomatis tanpa persetujuan owner.
5. Interval pengulangan disimpan pada jadwal itu sendiri dan hanya menjadi acuan jadwal berikutnya.
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
7. Jadwal perawatan manual
8. Interval pengulangan sebagai acuan jadwal berikutnya
9. Tugas worker
10. Realisasi perawatan
11. Fase pertumbuhan pohon
12. Riwayat pohon
13. Dashboard owner
14. Dashboard worker

Dengan scope ini, Avology V2 diposisikan sebagai sistem informasi operasional kebun alpukat yang mendukung pencatatan, pemantauan, koordinasi kerja, dan pengambilan keputusan owner berdasarkan data lapangan.
