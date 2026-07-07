# Kebutuhan Fungsional dan Non-Fungsional Avology V2

## 1. Kebutuhan Fungsional

Kebutuhan fungsional menjelaskan fungsi utama yang harus disediakan oleh sistem Avology V2. Kebutuhan ini diturunkan dari hasil wawancara dengan pemilik kebun MS Farm dan scope MVP yang telah ditentukan.

---

## FR-01 Autentikasi Pengguna

Sistem harus menyediakan fitur autentikasi pengguna agar pengguna dapat mengakses aplikasi sesuai akun masing-masing.

### Rincian:

* Pengguna dapat melakukan registrasi.
* Pengguna dapat melakukan login.
* Pengguna dapat melakukan logout.
* Sistem menyimpan data profil dasar pengguna.

### Prioritas:

Critical

---

## FR-02 Role Pengguna

Sistem harus membedakan hak akses pengguna berdasarkan role.

### Rincian:

* Sistem memiliki role owner.
* Sistem memiliki role worker.
* Owner dapat mengakses fitur pengelolaan kebun.
* Worker hanya dapat mengakses fitur yang berkaitan dengan tugas, laporan, dan data yang diizinkan.

### Prioritas:

Critical

---

## FR-03 Manajemen Kebun

Sistem harus memungkinkan owner membuat dan mengelola data kebun sebagai ruang kerja utama aplikasi.

### Rincian:

* Owner dapat membuat data kebun.
* Sistem menyimpan informasi dasar kebun.
* Data pohon, pekerja, jadwal, tugas, SOP, dan laporan terhubung dengan kebun tertentu.

### Prioritas:

Critical

---

## FR-04 Kode Bergabung Kebun

Sistem harus menyediakan kode bergabung agar worker dapat mengajukan akses ke kebun.

### Rincian:

* Sistem menghasilkan kode bergabung untuk kebun.
* Worker dapat memasukkan kode bergabung.
* Sistem mencatat pengajuan worker dengan status pending.

### Prioritas:

Critical

---

## FR-05 Persetujuan Worker

Sistem harus memungkinkan owner menerima atau menolak pengajuan worker.

### Rincian:

* Owner dapat melihat daftar pengajuan worker.
* Owner dapat menerima worker.
* Owner dapat menolak worker.
* Worker hanya dapat mengakses kebun setelah disetujui owner.

### Prioritas:

Critical

---

## FR-06 Manajemen Pekerja

Sistem harus memungkinkan owner mengelola pekerja yang tergabung dalam kebun.

### Rincian:

* Owner dapat melihat daftar worker.
* Owner dapat melihat status worker.
* Owner dapat menghapus atau mengeluarkan worker aktif dari kebun.
* Worker yang dikeluarkan tidak dapat lagi mengakses data kebun.
* Riwayat tugas dan laporan worker tetap tersimpan meskipun worker dikeluarkan.

### Prioritas:

Critical

---

## FR-07 Manajemen Data Pohon

Sistem harus memungkinkan owner mengelola data pohon alpukat secara individual.

### Rincian:

* Owner dapat menambah data pohon.
* Owner dapat mengubah data pohon.
* Owner dapat melihat detail pohon.
* Owner dapat mengarsipkan pohon.
* Owner dapat mengarsipkan pohon jika diperlukan.
* Sistem menyimpan identitas pohon seperti kode pohon, baris, kolom, varietas, dan tanggal tanam.

### Prioritas:

Critical

---

## FR-08 Identifikasi Pohon Individual

Sistem harus menyimpan identitas setiap pohon agar kondisi dan riwayatnya dapat dipantau secara terpisah.

### Rincian:

* Setiap pohon memiliki kode atau nomor pohon.
* Setiap pohon memiliki informasi lokasi berupa baris dan kolom.
* Setiap pohon dapat memiliki varietas.
* Setiap pohon dapat memiliki tanggal tanam.
* Setiap pohon memiliki kondisi terbaru.
* Setiap pohon memiliki fase pertumbuhan terbaru.

### Prioritas:

Critical

---

## FR-09 Laporan Kondisi Pohon

Sistem harus memungkinkan owner atau worker mencatat kondisi pohon tertentu.

### Rincian:

* Pengguna dapat memilih pohon yang dilaporkan.
* Pengguna dapat memilih kategori kondisi pohon.
* Kategori kondisi mencakup sehat, perlu perhatian, terserang hama, terindikasi penyakit, rusak, dan mati.
* Pengguna dapat menambahkan catatan singkat.
* Sistem menyimpan tanggal laporan kondisi.
* Sistem memperbarui kondisi terbaru pohon berdasarkan laporan terbaru.

### Prioritas:

Critical

---

## FR-10 Riwayat Kondisi Pohon

Sistem harus menampilkan riwayat kondisi pohon berdasarkan laporan yang pernah dicatat.

### Rincian:

* Sistem menampilkan daftar laporan kondisi pohon.
* Riwayat ditampilkan berdasarkan urutan waktu.
* Owner dan worker dapat melihat riwayat kondisi pohon sesuai hak aksesnya.

### Prioritas:

Critical

---

## FR-11 Laporan Operasional Kebun

Sistem harus memungkinkan worker membuat laporan operasional kebun yang tidak selalu berkaitan dengan pohon individual.

### Rincian:

* Worker dapat membuat laporan operasional.
* Laporan dapat berisi kategori seperti kerusakan lahan, alat rusak, stok habis, hama atau penyakit area, bencana atau cuaca ekstrem, kebutuhan pekerja, dan lainnya.
* Worker dapat menambahkan lokasi atau catatan singkat.
* Sistem menyimpan status laporan.
* Owner dapat melihat laporan operasional yang masuk.

### Prioritas:

Critical

---

## FR-12 Tindak Lanjut Laporan Operasional

Sistem harus memungkinkan owner menindaklanjuti laporan operasional kebun.

### Rincian:

* Owner dapat melihat detail laporan operasional.
* Owner dapat mengubah status laporan menjadi baru, diproses, selesai, atau ditolak.
* Owner dapat membuat tugas tindak lanjut dari laporan operasional.
* Tugas tindak lanjut dapat diberikan kepada worker.

### Prioritas:

Critical

---

## FR-13 SOP Perawatan

Sistem harus memungkinkan owner membuat template SOP perawatan sebagai standar pembuatan jadwal dan tugas.

### Rincian:

* Owner dapat membuat SOP perawatan.
* Owner dapat mengubah SOP perawatan.
* Owner dapat mengaktifkan atau menonaktifkan SOP.
* Data SOP mencakup nama SOP, kategori perawatan, interval hari, instruksi default, target default, dan status aktif.
* Kategori SOP mencakup penyiraman, pemupukan, penyemprotan, pengendalian gulma, dan lainnya.

### Prioritas:

Critical

---

## FR-14 Jadwal Perawatan dari SOP

Sistem harus memungkinkan owner membuat jadwal perawatan berdasarkan SOP yang sudah dibuat.

### Rincian:

* Owner dapat memilih SOP saat membuat jadwal.
* Sistem mengisi kategori dan instruksi jadwal berdasarkan SOP.
* Owner dapat mengubah tanggal, target, worker, dan instruksi sebelum jadwal disimpan.
* Jadwal dari SOP menghasilkan tugas untuk worker.

### Prioritas:

Critical

---

## FR-15 Jadwal Perawatan Manual

Sistem harus memungkinkan owner membuat jadwal perawatan tanpa menggunakan SOP.

### Rincian:

* Owner dapat membuat jadwal manual.
* Owner dapat menentukan kategori perawatan.
* Owner dapat menentukan tanggal jadwal.
* Owner dapat menentukan target jadwal.
* Owner dapat menulis instruksi perawatan.
* Owner dapat memilih worker yang bertugas.

### Prioritas:

Standard

---

## FR-16 Target Jadwal Perawatan

Sistem harus memungkinkan owner menentukan target jadwal perawatan.

### Rincian:

* Target jadwal dapat berupa seluruh kebun.
* Target jadwal dapat berupa baris tertentu.
* Target jadwal dapat berupa kolom tertentu.
* Target jadwal dapat berupa pohon tertentu.
* Target jadwal digunakan untuk menentukan cakupan pekerjaan worker.

### Prioritas:

Critical

---

## FR-17 Acuan Jadwal Berikutnya Berdasarkan Interval SOP

Sistem harus menghitung acuan jadwal perawatan berikutnya berdasarkan interval SOP.

### Rincian:

* SOP menyimpan interval dalam satuan hari.
* Sistem melihat tanggal realisasi terakhir dari SOP terkait.
* Sistem menghitung acuan jadwal berikutnya menggunakan rumus: tanggal realisasi terakhir + interval SOP.
* Sistem menampilkan status jadwal berikutnya, seperti belum jatuh tempo, jatuh tempo hari ini, atau terlambat.
* Sistem tidak membuat tugas berulang otomatis tanpa konfirmasi owner.

### Prioritas:

Critical

---

## FR-18 Pembuatan Tugas Worker

Sistem harus menghasilkan tugas worker berdasarkan jadwal yang dibuat owner.

### Rincian:

* Setiap jadwal dapat menghasilkan tugas untuk worker.
* Tugas memiliki tanggal pelaksanaan.
* Tugas memiliki instruksi pekerjaan.
* Tugas memiliki status pengerjaan.
* Tugas terhubung dengan jadwal, worker, dan kebun.

### Prioritas:

Critical

---

## FR-19 Daftar Tugas Worker

Sistem harus memungkinkan worker melihat daftar tugas yang diberikan.

### Rincian:

* Worker dapat melihat tugas hari ini.
* Worker dapat melihat tugas belum selesai.
* Worker dapat melihat detail tugas.
* Worker hanya melihat tugas yang diberikan kepadanya.

### Prioritas:

Critical

---

## FR-20 Realisasi Tugas Worker

Sistem harus memungkinkan worker memperbarui status tugas yang dikerjakan.

### Rincian:

* Worker dapat menandai tugas sebagai selesai.
* Worker dapat menandai tugas sebagai tertunda.
* Worker dapat menambahkan catatan singkat.
* Sistem menyimpan tanggal realisasi tugas.
* Sistem menyimpan worker pelaksana tugas.

### Prioritas:

Critical

---

## FR-21 Riwayat Perawatan

Sistem harus menyimpan riwayat realisasi perawatan yang telah dilakukan.

### Rincian:

* Sistem menyimpan riwayat tugas yang selesai atau tertunda.
* Jika tugas berkaitan dengan pohon tertentu, aktivitas masuk ke riwayat pohon.
* Jika tugas berkaitan dengan area atau kebun, aktivitas masuk ke riwayat operasional kebun.
* Riwayat dapat digunakan owner untuk mengevaluasi pelaksanaan perawatan.

### Prioritas:

Critical

---

## FR-22 Fase Pertumbuhan Pohon

Sistem harus memungkinkan owner atau worker mencatat fase pertumbuhan pohon.

### Rincian:

* Pengguna dapat memilih pohon.
* Pengguna dapat mencatat fase pertumbuhan.
* Fase pertumbuhan mencakup awal tanam, vegetatif, berbunga, berbuah, dan panen.
* Pengguna dapat menambahkan catatan singkat.
* Sistem menyimpan tanggal pencatatan fase.
* Sistem memperbarui fase terbaru pohon.

### Prioritas:

Critical

---

## FR-23 Riwayat Fase Pertumbuhan

Sistem harus menampilkan riwayat fase pertumbuhan pohon.

### Rincian:

* Sistem menampilkan riwayat fase berdasarkan urutan waktu.
* Riwayat fase ditampilkan pada detail pohon.
* Sistem menampilkan pohon yang sedang berbunga atau berbuah sebagai acuan monitoring panen.
* Sistem tidak melakukan prediksi panen otomatis.

### Prioritas:

Critical

---

## FR-24 Riwayat Pohon

Sistem harus menampilkan riwayat aktivitas setiap pohon secara terintegrasi.

### Rincian:

* Riwayat pohon mencakup laporan kondisi.
* Riwayat pohon mencakup aktivitas perawatan.
* Riwayat pohon mencakup fase pertumbuhan.
* Riwayat ditampilkan berdasarkan urutan waktu.

### Prioritas:

Critical

---

## FR-25 Dashboard Owner

Sistem harus menyediakan dashboard untuk owner yang menampilkan ringkasan kondisi kebun.

### Rincian:

Dashboard owner menampilkan:

* total pohon
* jumlah pohon sehat
* jumlah pohon bermasalah
* tugas hari ini
* tugas belum selesai
* laporan operasional baru
* worker pending
* pohon dalam fase berbunga
* pohon dalam fase berbuah
* SOP jatuh tempo atau terlambat

### Prioritas:

Critical

---

## FR-26 Dashboard Worker

Sistem harus menyediakan dashboard untuk worker yang menampilkan ringkasan pekerjaan.

### Rincian:

Dashboard worker menampilkan:

* tugas hari ini
* tugas belum selesai
* tugas selesai
* shortcut lapor kondisi pohon
* shortcut buat laporan operasional

### Prioritas:

Critical

---

## FR-27 Pembatasan Fitur Berdasarkan Role

Sistem harus membatasi akses fitur berdasarkan role pengguna.

### Rincian:

* Owner dapat mengelola kebun, pekerja, pohon, SOP, jadwal, laporan, dan dashboard owner.
* Worker dapat melihat tugas, menyelesaikan tugas, mencatat kondisi pohon, mencatat fase pohon, dan membuat laporan operasional.
* Worker tidak dapat menghapus data kebun.
* Worker tidak dapat menghapus worker lain.
* Worker tidak dapat mengelola SOP.
* Worker tidak dapat membuat jadwal utama kecuali tugas atau laporan yang diperbolehkan sistem.

### Prioritas:

Critical

---

# 2. Kebutuhan Non-Fungsional

Kebutuhan non-fungsional menjelaskan kualitas, batasan, dan karakteristik sistem yang harus diperhatikan dalam pengembangan Avology V2.

---

## NFR-01 Kemudahan Penggunaan

Aplikasi harus mudah digunakan oleh owner dan worker.

### Rincian:

* Tampilan aplikasi harus sederhana.
* Alur utama aplikasi harus mudah dipahami.
* Pengguna tidak perlu melewati terlalu banyak langkah untuk menjalankan fungsi utama.

### Dasar:

Pekerja kebun membutuhkan aplikasi yang praktis dan tidak rumit agar mau menggunakannya secara konsisten.

### Prioritas:

Critical

---

## NFR-02 Input Minim Teks

Aplikasi harus meminimalkan input teks panjang, terutama untuk worker.

### Rincian:

* Form laporan menggunakan pilihan kategori.
* Catatan teks dibuat opsional atau singkat.
* Input status menggunakan tombol atau pilihan sederhana.
* Data yang sering berulang sebaiknya menggunakan template atau pilihan.

### Dasar:

Jika input terlalu rumit, data yang masuk berisiko tidak akurat atau pengguna tidak mau mengisi.

### Prioritas:

Critical

---

## NFR-03 Mobile First

Aplikasi harus dirancang untuk penggunaan perangkat mobile.

### Rincian:

* Tampilan dioptimalkan untuk layar smartphone.
* Navigasi mudah digunakan dengan satu tangan.
* Tombol utama cukup jelas dan mudah ditekan.
* Halaman tidak terlalu padat.

### Dasar:

Penggunaan aplikasi dilakukan oleh owner dan worker melalui HP.

### Prioritas:

Critical

---

## NFR-04 Konsistensi Data dan Satuan

Sistem harus menggunakan format data dan satuan yang konsisten.

### Rincian:

* Tanggal menggunakan format yang konsisten.
* Interval perawatan menggunakan satuan hari.
* Berat menggunakan kilogram jika nanti digunakan.
* Luas atau jarak menggunakan meter jika dibutuhkan.
* Nilai uang menggunakan rupiah jika nanti dikembangkan ke fitur finansial.

### Dasar:

Konsistensi satuan penting agar data tidak membingungkan dan dapat digunakan untuk evaluasi.

### Prioritas:

Critical

---

## NFR-05 Keamanan Akses Berdasarkan Role

Sistem harus menjaga agar pengguna hanya dapat mengakses data sesuai role dan kebun yang terhubung dengannya.

### Rincian:

* Owner hanya dapat mengakses data kebun miliknya.
* Worker hanya dapat mengakses data kebun tempat ia diterima.
* Worker pending tidak boleh mengakses data operasional kebun.
* Worker removed tidak boleh mengakses data kebun.
* Data antar kebun tidak boleh tercampur.

### Prioritas:

Critical

---

## NFR-06 Data Terstruktur dan Dapat Ditelusuri

Sistem harus menyimpan data secara terstruktur agar riwayat operasional dapat ditelusuri kembali.

### Rincian:

* Data pohon tersimpan secara individual.
* Data kondisi tersimpan sebagai riwayat.
* Data perawatan tersimpan sebagai realisasi tugas.
* Data fase pertumbuhan tersimpan sebagai riwayat.
* Data laporan operasional tersimpan dengan status.
* Data worker tetap dapat ditelusuri dalam histori meskipun worker sudah dikeluarkan.

### Prioritas:

Critical

---

## NFR-07 Dashboard Ringkas

Dashboard harus menampilkan informasi penting secara ringkas.

### Rincian:

* Dashboard tidak menampilkan terlalu banyak detail.
* Dashboard memprioritaskan informasi yang membutuhkan perhatian owner.
* Informasi utama dapat dipahami dalam waktu singkat.
* Detail lebih lengkap dapat dibuka dari halaman terkait.

### Dasar:

Owner membutuhkan alat bantu decision making cepat ketika tidak berada di kebun.

### Prioritas:

Critical

---

## NFR-08 Fleksibilitas Jadwal

Sistem harus memberikan fleksibilitas kepada owner dalam membuat jadwal perawatan.

### Rincian:

* Jadwal dapat dibuat dari SOP.
* Jadwal dapat dibuat manual.
* Owner dapat mengubah tanggal, target, worker, dan instruksi sebelum jadwal disimpan.
* Sistem tidak memaksa owner mengikuti interval SOP secara kaku.

### Dasar:

Operasional kebun dipengaruhi kondisi lapangan, sehingga jadwal tidak selalu bisa berjalan sepenuhnya otomatis.

### Prioritas:

Standard

---

## NFR-09 Sistem Tidak Melakukan Overclaim Prediksi

Sistem tidak boleh mengklaim melakukan prediksi panen otomatis.

### Rincian:

* Sistem hanya mencatat fase pertumbuhan.
* Sistem menampilkan pohon berbunga atau berbuah sebagai acuan monitoring.
* Keputusan panen tetap dilakukan owner atau worker berdasarkan kondisi fisik buah di lapangan.
* Sistem tidak menggunakan machine learning untuk prediksi panen dalam MVP.

### Dasar:

Prediksi panen membutuhkan data historis dan faktor pendukung yang belum tersedia dalam MVP.

### Prioritas:

Critical

---

## NFR-10 Kesesuaian dengan Realita Lapangan

Aplikasi harus menyesuaikan kondisi kerja di kebun.

### Rincian:

* Form worker harus cepat diisi.
* Informasi tugas harus mudah ditemukan.
* Laporan operasional harus bisa dibuat dengan langkah sederhana.
* Aplikasi tidak bergantung pada input panjang atau prosedur yang rumit.

### Prioritas:

Critical

---

## NFR-11 Maintainability

Struktur sistem harus mudah dikembangkan dan dirawat.

### Rincian:

* Kode sebaiknya dipisahkan berdasarkan modul.
* Komponen UI yang sering dipakai sebaiknya dibuat reusable.
* Logic bisnis tidak dikumpulkan dalam satu file.
* Struktur database harus mengikuti kebutuhan sistem, bukan fitur dadakan.

### Prioritas:

Standard

---

## NFR-12 Scalability Terbatas untuk Pengembangan Lanjutan

Sistem MVP harus memungkinkan pengembangan fitur lanjutan tanpa perlu merombak total struktur utama.

### Rincian:

* Struktur data kebun, pohon, worker, tugas, laporan, dan riwayat dibuat cukup rapi.
* Fitur seperti finansial, grading buah, laporan panen, atau integrated farming dapat ditambahkan di masa depan sebagai pengembangan lanjutan.
* MVP tidak wajib langsung mendukung fitur lanjutan tersebut.

### Prioritas:

Optional

---

## NFR-13 Reliabilitas Data Operasional

Sistem harus menjaga agar data operasional penting tidak hilang secara tidak sengaja.

### Rincian:

* Penghapusan worker sebaiknya menggunakan status removed, bukan delete permanen.
* Pengarsipan pohon digunakan dalam MVP sebagai pengganti penghapusan permanen.
* Riwayat kondisi, perawatan, fase, dan laporan tetap tersimpan.
* Data yang sudah menjadi bagian dari histori sebaiknya tidak mudah dihapus.

### Prioritas:

Critical

---

## NFR-14 Performa Dasar

Aplikasi harus dapat menampilkan data utama dengan waktu respons yang wajar.

### Rincian:

* Daftar pohon dapat dibuka tanpa loading berlebihan.
* Dashboard dapat menampilkan ringkasan data utama dengan cepat.
* Daftar tugas worker dapat diakses dengan mudah.
* Query data sebaiknya dibatasi sesuai kebun dan role pengguna.

### Prioritas:

Standard

---

## NFR-15 Konsistensi Antarmuka

Aplikasi harus memiliki tampilan yang konsisten di setiap halaman.

### Rincian:

* Warna utama konsisten.
* Jarak antar elemen konsisten.
* Format tombol konsisten.
* Format card dan list konsisten.
* Navigasi owner dan worker dibuat jelas.

### Prioritas:

Standard

---

# 3. Ringkasan Kebutuhan Fungsional

| Kode  | Kebutuhan Fungsional                             | Prioritas |
| ----- | ------------------------------------------------ | --------- |
| FR-01 | Autentikasi Pengguna                             | Critical  |
| FR-02 | Role Pengguna                                    | Critical  |
| FR-03 | Manajemen Kebun                                  | Critical  |
| FR-04 | Kode Bergabung Kebun                             | Critical  |
| FR-05 | Persetujuan Worker                               | Critical  |
| FR-06 | Manajemen Pekerja                                | Critical  |
| FR-07 | Manajemen Data Pohon                             | Critical  |
| FR-08 | Identifikasi Pohon Individual                    | Critical  |
| FR-09 | Laporan Kondisi Pohon                            | Critical  |
| FR-10 | Riwayat Kondisi Pohon                            | Critical  |
| FR-11 | Laporan Operasional Kebun                        | Critical  |
| FR-12 | Tindak Lanjut Laporan Operasional                | Critical  |
| FR-13 | SOP Perawatan                                    | Critical  |
| FR-14 | Jadwal Perawatan dari SOP                        | Critical  |
| FR-15 | Jadwal Perawatan Manual                          | Standard  |
| FR-16 | Target Jadwal Perawatan                          | Critical  |
| FR-17 | Acuan Jadwal Berikutnya Berdasarkan Interval SOP | Critical  |
| FR-18 | Pembuatan Tugas Worker                           | Critical  |
| FR-19 | Daftar Tugas Worker                              | Critical  |
| FR-20 | Realisasi Tugas Worker                           | Critical  |
| FR-21 | Riwayat Perawatan                                | Critical  |
| FR-22 | Fase Pertumbuhan Pohon                           | Critical  |
| FR-23 | Riwayat Fase Pertumbuhan                         | Critical  |
| FR-24 | Riwayat Pohon                                    | Critical  |
| FR-25 | Dashboard Owner                                  | Critical  |
| FR-26 | Dashboard Worker                                 | Critical  |
| FR-27 | Pembatasan Fitur Berdasarkan Role                | Critical  |

---

# 4. Ringkasan Kebutuhan Non-Fungsional

| Kode   | Kebutuhan Non-Fungsional                         | Prioritas |
| ------ | ------------------------------------------------ | --------- |
| NFR-01 | Kemudahan Penggunaan                             | Critical  |
| NFR-02 | Input Minim Teks                                 | Critical  |
| NFR-03 | Mobile First                                     | Critical  |
| NFR-04 | Konsistensi Data dan Satuan                      | Critical  |
| NFR-05 | Keamanan Akses Berdasarkan Role                  | Critical  |
| NFR-06 | Data Terstruktur dan Dapat Ditelusuri            | Critical  |
| NFR-07 | Dashboard Ringkas                                | Critical  |
| NFR-08 | Fleksibilitas Jadwal                             | Standard  |
| NFR-09 | Sistem Tidak Melakukan Overclaim Prediksi        | Critical  |
| NFR-10 | Kesesuaian dengan Realita Lapangan               | Critical  |
| NFR-11 | Maintainability                                  | Standard  |
| NFR-12 | Scalability Terbatas untuk Pengembangan Lanjutan | Optional  |
| NFR-13 | Reliabilitas Data Operasional                    | Critical  |
| NFR-14 | Performa Dasar                                   | Standard  |
| NFR-15 | Konsistensi Antarmuka                            | Standard  |
