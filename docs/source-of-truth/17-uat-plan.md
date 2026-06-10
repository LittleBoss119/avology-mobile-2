# User Acceptance Testing Plan Avology V2

## 1. Tujuan UAT

User Acceptance Testing atau UAT digunakan untuk mengetahui apakah aplikasi Avology V2 dapat diterima oleh pengguna berdasarkan kebutuhan dan alur kerja yang telah dirancang.

UAT tidak berfokus pada struktur kode program, tetapi pada penerimaan pengguna terhadap sistem. Pengujian ini dilakukan untuk menilai apakah fitur, tampilan, alur penggunaan, dan manfaat aplikasi sudah sesuai dengan kebutuhan owner dan worker dalam pengelolaan kebun alpukat.

---

## 2. Perbedaan UAT dan Black-box Testing

| Aspek           | Black-box Testing                             | User Acceptance Testing                      |
| --------------- | --------------------------------------------- | -------------------------------------------- |
| Fokus           | Menguji apakah fitur berjalan sesuai skenario | Menguji apakah sistem diterima oleh pengguna |
| Penguji         | Pengembang atau tester                        | Pengguna akhir atau calon pengguna           |
| Dasar Pengujian | Test case fungsional                          | Skenario penggunaan dan kuesioner            |
| Output          | Pass, fail, pending                           | Nilai penerimaan pengguna                    |
| Tujuan          | Memastikan fungsi berjalan                    | Memastikan sistem sesuai kebutuhan pengguna  |

---

## 3. Ruang Lingkup UAT

UAT Avology V2 mencakup pengujian terhadap fitur utama MVP, yaitu:

1. Autentikasi pengguna
2. Pembuatan kebun
3. Pengajuan worker ke kebun
4. Approval worker oleh owner
5. Manajemen data pohon
6. Pencatatan kondisi pohon
7. Laporan operasional kebun
8. SOP perawatan
9. Jadwal perawatan
10. Tugas worker
11. Realisasi tugas worker
12. Pencatatan fase pertumbuhan pohon
13. Riwayat pohon
14. Dashboard owner
15. Dashboard worker
16. Pembatasan akses berdasarkan role

---

## 4. Tujuan Khusus UAT

UAT dilakukan untuk menilai beberapa aspek berikut:

1. Apakah aplikasi mudah digunakan oleh owner dan worker.
2. Apakah fitur aplikasi sesuai dengan kebutuhan pengelolaan kebun alpukat.
3. Apakah alur pencatatan data pohon mudah dipahami.
4. Apakah alur tugas worker membantu pelaksanaan pekerjaan kebun.
5. Apakah laporan kondisi dan laporan operasional membantu komunikasi antara worker dan owner.
6. Apakah SOP dan jadwal membantu owner mengelola perawatan kebun.
7. Apakah dashboard membantu owner melihat kondisi kebun secara ringkas.
8. Apakah aplikasi layak digunakan sebagai sistem manajemen kebun alpukat.

---

## 5. Responden UAT

Responden UAT Avology V2 terdiri dari pengguna yang memiliki karakteristik sesuai dengan calon pengguna sistem.

## 5.1 Responden Utama

| Responden             | Peran  | Keterangan                                          |
| --------------------- | ------ | --------------------------------------------------- |
| Pemilik kebun MS Farm | Owner  | Pengguna utama yang mengelola kebun                 |
| Pekerja kebun MS Farm | Worker | Pengguna yang menjalankan tugas dan membuat laporan |

## 5.2 Responden Tambahan

Jika jumlah responden internal kebun terbatas, maka UAT dapat melibatkan responden tambahan dengan karakteristik serupa, seperti:

1. Pemilik kebun atau pengelola kebun lain.
2. Pekerja kebun atau orang yang memahami aktivitas pertanian.
3. Mahasiswa atau pengguna yang memahami alur dasar manajemen kebun.
4. Calon pengguna yang dapat menilai kemudahan penggunaan aplikasi mobile.

Responden tambahan digunakan untuk membantu memperoleh masukan terhadap kemudahan penggunaan dan kelayakan aplikasi, bukan untuk menggantikan validasi dari pengguna utama MS Farm.

---

## 6. Metode UAT

Metode UAT yang digunakan adalah:

1. Pengguna mencoba aplikasi berdasarkan skenario yang telah disiapkan.
2. Pengguna menjalankan fitur sesuai peran masing-masing.
3. Pengguna mengisi kuesioner UAT menggunakan skala Likert.
4. Hasil kuesioner dihitung untuk mendapatkan persentase penerimaan pengguna.
5. Hasil UAT digunakan sebagai dasar evaluasi sistem.

---

## 7. Skala Penilaian

Kuesioner UAT menggunakan skala Likert 1 sampai 5.

| Skor | Keterangan          |
| ---: | ------------------- |
|    1 | Sangat Tidak Setuju |
|    2 | Tidak Setuju        |
|    3 | Netral              |
|    4 | Setuju              |
|    5 | Sangat Setuju       |

---

## 8. Rumus Perhitungan UAT

Nilai UAT dihitung menggunakan rumus:

```txt
Persentase UAT = (Total Skor Aktual / Total Skor Maksimal) × 100%
```

Keterangan:

```txt
Total Skor Aktual = Jumlah seluruh skor dari responden
Total Skor Maksimal = Jumlah responden × jumlah pertanyaan × skor maksimal
```

Contoh:

```txt
Jumlah responden = 5
Jumlah pertanyaan = 20
Skor maksimal = 5

Total Skor Maksimal = 5 × 20 × 5 = 500
Total Skor Aktual = 430

Persentase UAT = (430 / 500) × 100% = 86%
```

---

## 9. Interpretasi Hasil UAT

| Persentase | Kategori           |
| ---------: | ------------------ |
|   0% - 20% | Sangat Tidak Layak |
|  21% - 40% | Tidak Layak        |
|  41% - 60% | Cukup Layak        |
|  61% - 80% | Layak              |
| 81% - 100% | Sangat Layak       |

Jika hasil UAT berada pada kategori Layak atau Sangat Layak, maka sistem dapat dinyatakan diterima oleh pengguna.

---

# 10. Skenario UAT Owner

Skenario UAT owner digunakan untuk menguji alur penggunaan aplikasi dari sudut pandang pemilik kebun.

| No | Skenario                                                   | Fitur yang Diuji       |
| -: | ---------------------------------------------------------- | ---------------------- |
|  1 | Owner melakukan login ke aplikasi                          | Login                  |
|  2 | Owner membuat data kebun                                   | Create Farm            |
|  3 | Owner melihat kode bergabung kebun                         | Join Code              |
|  4 | Owner menyetujui worker yang mengajukan bergabung          | Worker Approval        |
|  5 | Owner menambahkan data pohon                               | Create Tree            |
|  6 | Owner melihat detail pohon                                 | Tree Detail            |
|  7 | Owner mencatat kondisi pohon                               | Condition Report       |
|  8 | Owner membuat SOP perawatan                                | Care SOP               |
|  9 | Owner melihat acuan jadwal berikutnya dari SOP             | SOP Schedule Reference |
| 10 | Owner membuat jadwal dari SOP                              | Schedule From SOP      |
| 11 | Owner membuat jadwal manual                                | Manual Schedule        |
| 12 | Owner melihat daftar tugas worker                          | Task List              |
| 13 | Owner melihat laporan operasional dari worker              | Operational Report     |
| 14 | Owner membuat tugas tindak lanjut dari laporan operasional | Task From Report       |
| 15 | Owner mencatat fase pertumbuhan pohon                      | Growth Phase           |
| 16 | Owner melihat pohon berbunga atau berbuah                  | Growth Monitoring      |
| 17 | Owner melihat riwayat pohon                                | Tree History           |
| 18 | Owner melihat dashboard kebun                              | Owner Dashboard        |
| 19 | Owner mengeluarkan worker dari kebun                       | Remove Worker          |
| 20 | Owner logout dari aplikasi                                 | Logout                 |

---

# 11. Skenario UAT Worker

Skenario UAT worker digunakan untuk menguji alur penggunaan aplikasi dari sudut pandang pekerja kebun.

| No | Skenario                                              | Fitur yang Diuji   |
| -: | ----------------------------------------------------- | ------------------ |
|  1 | Worker melakukan login ke aplikasi                    | Login              |
|  2 | Worker mengajukan bergabung ke kebun menggunakan kode | Join Farm          |
|  3 | Worker menunggu persetujuan owner                     | Pending Approval   |
|  4 | Worker masuk ke dashboard setelah disetujui           | Worker Dashboard   |
|  5 | Worker melihat daftar tugas                           | Worker Task List   |
|  6 | Worker membuka detail tugas                           | Worker Task Detail |
|  7 | Worker menandai tugas sebagai selesai                 | Complete Task      |
|  8 | Worker menunda tugas dengan catatan                   | Postpone Task      |
|  9 | Worker melihat daftar pohon                           | Tree List          |
| 10 | Worker membuka detail pohon                           | Tree Detail        |
| 11 | Worker mencatat kondisi pohon                         | Condition Report   |
| 12 | Worker mencatat fase pertumbuhan pohon                | Growth Phase       |
| 13 | Worker membuat laporan operasional kebun              | Operational Report |
| 14 | Worker melihat ringkasan tugas di dashboard           | Worker Dashboard   |
| 15 | Worker logout dari aplikasi                           | Logout             |

---

# 12. Instrumen Kuesioner UAT Owner

Kuesioner berikut digunakan untuk responden dengan peran owner.

| No | Pernyataan                                                                                      | Skor 1-5 |
| -: | ----------------------------------------------------------------------------------------------- | -------- |
|  1 | Aplikasi mudah dipahami saat pertama kali digunakan.                                            |          |
|  2 | Proses login dan masuk ke aplikasi berjalan dengan jelas.                                       |          |
|  3 | Fitur pembuatan kebun mudah digunakan.                                                          |          |
|  4 | Fitur kode bergabung membantu worker mengajukan akses ke kebun.                                 |          |
|  5 | Fitur approval worker membantu owner mengelola akses pekerja.                                   |          |
|  6 | Fitur manajemen data pohon sesuai dengan kebutuhan pencatatan pohon alpukat.                    |          |
|  7 | Informasi detail pohon mudah dipahami.                                                          |          |
|  8 | Fitur laporan kondisi pohon membantu owner memantau kondisi pohon.                              |          |
|  9 | Fitur SOP perawatan membantu owner menyusun acuan perawatan kebun.                              |          |
| 10 | Fitur acuan jadwal berikutnya dari SOP membantu owner mengingat jadwal perawatan.               |          |
| 11 | Fitur pembuatan jadwal dari SOP mudah digunakan.                                                |          |
| 12 | Fitur jadwal manual membantu owner membuat tugas di luar SOP.                                   |          |
| 13 | Fitur tugas worker membantu owner membagi pekerjaan kepada pekerja.                             |          |
| 14 | Fitur laporan operasional membantu owner mengetahui kondisi umum kebun.                         |          |
| 15 | Fitur tindak lanjut laporan operasional menjadi tugas worker mudah dipahami.                    |          |
| 16 | Fitur pencatatan fase pertumbuhan membantu owner memantau perkembangan pohon.                   |          |
| 17 | Fitur monitoring pohon berbunga dan berbuah membantu owner dalam pemantauan panen.              |          |
| 18 | Fitur riwayat pohon membantu owner menelusuri kondisi, fase, dan perawatan pohon.               |          |
| 19 | Dashboard owner menampilkan informasi penting secara ringkas.                                   |          |
| 20 | Secara keseluruhan, aplikasi Avology V2 layak digunakan untuk membantu manajemen kebun alpukat. |          |

---

# 13. Instrumen Kuesioner UAT Worker

Kuesioner berikut digunakan untuk responden dengan peran worker.

| No | Pernyataan                                                                                        | Skor 1-5 |
| -: | ------------------------------------------------------------------------------------------------- | -------- |
|  1 | Aplikasi mudah dipahami saat pertama kali digunakan.                                              |          |
|  2 | Proses login dan masuk ke aplikasi berjalan dengan jelas.                                         |          |
|  3 | Proses bergabung ke kebun menggunakan kode mudah dilakukan.                                       |          |
|  4 | Dashboard worker menampilkan informasi tugas dengan jelas.                                        |          |
|  5 | Daftar tugas mudah ditemukan dan dipahami.                                                        |          |
|  6 | Detail tugas menampilkan instruksi yang cukup jelas.                                              |          |
|  7 | Tombol untuk menyelesaikan tugas mudah digunakan.                                                 |          |
|  8 | Tombol untuk menunda tugas mudah digunakan.                                                       |          |
|  9 | Form catatan tugas mudah diisi.                                                                   |          |
| 10 | Daftar pohon mudah diakses.                                                                       |          |
| 11 | Informasi detail pohon mudah dipahami.                                                            |          |
| 12 | Fitur laporan kondisi pohon mudah digunakan.                                                      |          |
| 13 | Pilihan kondisi pohon membantu mempercepat proses pelaporan.                                      |          |
| 14 | Fitur pencatatan fase pertumbuhan pohon mudah digunakan.                                          |          |
| 15 | Fitur laporan operasional kebun mudah digunakan.                                                  |          |
| 16 | Kategori laporan operasional mudah dipahami.                                                      |          |
| 17 | Aplikasi tidak membutuhkan input teks yang terlalu banyak.                                        |          |
| 18 | Navigasi aplikasi mudah digunakan di perangkat mobile.                                            |          |
| 19 | Tampilan aplikasi cukup jelas untuk digunakan saat bekerja di kebun.                              |          |
| 20 | Secara keseluruhan, aplikasi Avology V2 layak digunakan untuk membantu pekerjaan worker di kebun. |          |

---

# 14. Kuesioner Gabungan untuk Responden Umum

Jika responden tambahan tidak secara langsung berperan sebagai owner atau worker, maka kuesioner gabungan berikut dapat digunakan.

| No | Pernyataan                                                                           | Skor 1-5 |
| -: | ------------------------------------------------------------------------------------ | -------- |
|  1 | Aplikasi mudah dipahami saat pertama kali digunakan.                                 |          |
|  2 | Tampilan aplikasi mudah dibaca pada perangkat mobile.                                |          |
|  3 | Navigasi antar halaman mudah dipahami.                                               |          |
|  4 | Fitur manajemen data pohon sesuai dengan kebutuhan pencatatan kebun.                 |          |
|  5 | Fitur laporan kondisi pohon mudah digunakan.                                         |          |
|  6 | Fitur laporan operasional kebun mudah dipahami.                                      |          |
|  7 | Fitur SOP perawatan membantu penyusunan acuan perawatan kebun.                       |          |
|  8 | Fitur jadwal perawatan membantu pengelolaan aktivitas kebun.                         |          |
|  9 | Fitur tugas worker membantu pembagian pekerjaan.                                     |          |
| 10 | Fitur pencatatan fase pertumbuhan membantu monitoring pohon.                         |          |
| 11 | Fitur riwayat pohon membantu menelusuri data pohon.                                  |          |
| 12 | Dashboard menampilkan informasi penting secara ringkas.                              |          |
| 13 | Role owner dan worker terlihat memiliki alur yang berbeda.                           |          |
| 14 | Form dalam aplikasi tidak terlalu rumit.                                             |          |
| 15 | Secara keseluruhan, aplikasi layak digunakan sebagai sistem manajemen kebun alpukat. |          |

---

# 15. Format Data Responden

| No | Nama Responden | Peran              | Usia | Keterangan |
| -: | -------------- | ------------------ | ---: | ---------- |
|  1 |                | Owner              |      |            |
|  2 |                | Worker             |      |            |
|  3 |                | Responden Tambahan |      |            |

---

# 16. Format Rekap Hasil UAT Owner

| No | Pernyataan                                                                                      | R1 | R2 | R3 | R4 | R5 | Total Skor |
| -: | ----------------------------------------------------------------------------------------------- | -: | -: | -: | -: | -: | ---------: |
|  1 | Aplikasi mudah dipahami saat pertama kali digunakan.                                            |    |    |    |    |    |            |
|  2 | Proses login dan masuk ke aplikasi berjalan dengan jelas.                                       |    |    |    |    |    |            |
|  3 | Fitur pembuatan kebun mudah digunakan.                                                          |    |    |    |    |    |            |
|  4 | Fitur kode bergabung membantu worker mengajukan akses ke kebun.                                 |    |    |    |    |    |            |
|  5 | Fitur approval worker membantu owner mengelola akses pekerja.                                   |    |    |    |    |    |            |
|  6 | Fitur manajemen data pohon sesuai dengan kebutuhan pencatatan pohon alpukat.                    |    |    |    |    |    |            |
|  7 | Informasi detail pohon mudah dipahami.                                                          |    |    |    |    |    |            |
|  8 | Fitur laporan kondisi pohon membantu owner memantau kondisi pohon.                              |    |    |    |    |    |            |
|  9 | Fitur SOP perawatan membantu owner menyusun acuan perawatan kebun.                              |    |    |    |    |    |            |
| 10 | Fitur acuan jadwal berikutnya dari SOP membantu owner mengingat jadwal perawatan.               |    |    |    |    |    |            |
| 11 | Fitur pembuatan jadwal dari SOP mudah digunakan.                                                |    |    |    |    |    |            |
| 12 | Fitur jadwal manual membantu owner membuat tugas di luar SOP.                                   |    |    |    |    |    |            |
| 13 | Fitur tugas worker membantu owner membagi pekerjaan kepada pekerja.                             |    |    |    |    |    |            |
| 14 | Fitur laporan operasional membantu owner mengetahui kondisi umum kebun.                         |    |    |    |    |    |            |
| 15 | Fitur tindak lanjut laporan operasional menjadi tugas worker mudah dipahami.                    |    |    |    |    |    |            |
| 16 | Fitur pencatatan fase pertumbuhan membantu owner memantau perkembangan pohon.                   |    |    |    |    |    |            |
| 17 | Fitur monitoring pohon berbunga dan berbuah membantu owner dalam pemantauan panen.              |    |    |    |    |    |            |
| 18 | Fitur riwayat pohon membantu owner menelusuri kondisi, fase, dan perawatan pohon.               |    |    |    |    |    |            |
| 19 | Dashboard owner menampilkan informasi penting secara ringkas.                                   |    |    |    |    |    |            |
| 20 | Secara keseluruhan, aplikasi Avology V2 layak digunakan untuk membantu manajemen kebun alpukat. |    |    |    |    |    |            |
|    | Total                                                                                           |    |    |    |    |    |            |
|    | Persentase                                                                                      |    |    |    |    |    |            |

---

# 17. Format Rekap Hasil UAT Worker

| No | Pernyataan                                                                                        | R1 | R2 | R3 | R4 | R5 | Total Skor |
| -: | ------------------------------------------------------------------------------------------------- | -: | -: | -: | -: | -: | ---------: |
|  1 | Aplikasi mudah dipahami saat pertama kali digunakan.                                              |    |    |    |    |    |            |
|  2 | Proses login dan masuk ke aplikasi berjalan dengan jelas.                                         |    |    |    |    |    |            |
|  3 | Proses bergabung ke kebun menggunakan kode mudah dilakukan.                                       |    |    |    |    |    |            |
|  4 | Dashboard worker menampilkan informasi tugas dengan jelas.                                        |    |    |    |    |    |            |
|  5 | Daftar tugas mudah ditemukan dan dipahami.                                                        |    |    |    |    |    |            |
|  6 | Detail tugas menampilkan instruksi yang cukup jelas.                                              |    |    |    |    |    |            |
|  7 | Tombol untuk menyelesaikan tugas mudah digunakan.                                                 |    |    |    |    |    |            |
|  8 | Tombol untuk menunda tugas mudah digunakan.                                                       |    |    |    |    |    |            |
|  9 | Form catatan tugas mudah diisi.                                                                   |    |    |    |    |    |            |
| 10 | Daftar pohon mudah diakses.                                                                       |    |    |    |    |    |            |
| 11 | Informasi detail pohon mudah dipahami.                                                            |    |    |    |    |    |            |
| 12 | Fitur laporan kondisi pohon mudah digunakan.                                                      |    |    |    |    |    |            |
| 13 | Pilihan kondisi pohon membantu mempercepat proses pelaporan.                                      |    |    |    |    |    |            |
| 14 | Fitur pencatatan fase pertumbuhan pohon mudah digunakan.                                          |    |    |    |    |    |            |
| 15 | Fitur laporan operasional kebun mudah digunakan.                                                  |    |    |    |    |    |            |
| 16 | Kategori laporan operasional mudah dipahami.                                                      |    |    |    |    |    |            |
| 17 | Aplikasi tidak membutuhkan input teks yang terlalu banyak.                                        |    |    |    |    |    |            |
| 18 | Navigasi aplikasi mudah digunakan di perangkat mobile.                                            |    |    |    |    |    |            |
| 19 | Tampilan aplikasi cukup jelas untuk digunakan saat bekerja di kebun.                              |    |    |    |    |    |            |
| 20 | Secara keseluruhan, aplikasi Avology V2 layak digunakan untuk membantu pekerjaan worker di kebun. |    |    |    |    |    |            |
|    | Total                                                                                             |    |    |    |    |    |            |
|    | Persentase                                                                                        |    |    |    |    |    |            |

---

# 18. Format Rekap Keseluruhan UAT

| Kelompok Responden | Jumlah Responden | Jumlah Pernyataan | Total Skor Aktual | Total Skor Maksimal | Persentase | Kategori |
| ------------------ | ---------------: | ----------------: | ----------------: | ------------------: | ---------: | -------- |
| Owner              |                  |                20 |                   |                     |            |          |
| Worker             |                  |                20 |                   |                     |            |          |
| Responden Tambahan |                  |                15 |                   |                     |            |          |
| Total              |                  |                   |                   |                     |            |          |

---

# 19. Pertanyaan Masukan Terbuka

Selain kuesioner skala Likert, responden juga dapat diberikan pertanyaan terbuka untuk memperoleh masukan tambahan.

## 19.1 Pertanyaan untuk Owner

1. Fitur apa yang paling membantu dalam pengelolaan kebun?
2. Fitur apa yang masih membingungkan?
3. Apakah dashboard sudah menampilkan informasi yang dibutuhkan?
4. Apakah fitur SOP dan jadwal membantu mengingat aktivitas perawatan?
5. Apakah ada bagian aplikasi yang perlu disederhanakan?
6. Saran tambahan untuk pengembangan aplikasi?

## 19.2 Pertanyaan untuk Worker

1. Apakah aplikasi mudah digunakan saat menjalankan tugas?
2. Apakah form laporan kondisi pohon mudah dipahami?
3. Apakah instruksi tugas cukup jelas?
4. Apakah fitur laporan operasional mudah digunakan?
5. Apakah ada bagian aplikasi yang terlalu rumit?
6. Saran tambahan untuk pengembangan aplikasi?

---

# 20. Prosedur Pelaksanaan UAT

Prosedur pelaksanaan UAT dilakukan sebagai berikut:

1. Menyiapkan aplikasi Avology V2 versi MVP.
2. Menyiapkan akun owner dan worker untuk pengujian.
3. Menyiapkan data awal kebun, worker, dan pohon jika diperlukan.
4. Menjelaskan tujuan pengujian kepada responden.
5. Memberikan skenario penggunaan sesuai role responden.
6. Responden mencoba aplikasi sesuai skenario.
7. Responden mengisi kuesioner UAT.
8. Peneliti menghitung hasil kuesioner.
9. Peneliti menganalisis hasil UAT.
10. Peneliti mencatat masukan responden untuk pengembangan lanjutan.

---

# 21. Data Awal UAT yang Disarankan

Untuk memudahkan pelaksanaan UAT, data awal berikut dapat disiapkan:

| Data                | Contoh                                                |
| ------------------- | ----------------------------------------------------- |
| Nama kebun          | MS Farm                                               |
| Lokasi              | Tegal                                                 |
| Luas kebun          | 6500 m²                                               |
| Owner               | Pemilik kebun                                         |
| Worker              | Pekerja kebun                                         |
| Pohon               | P-01, P-02, P-03                                      |
| Varietas            | Miki, Aligator                                        |
| SOP                 | Semprot Pencegahan, Pemupukan NPK, Pengendalian Gulma |
| Jadwal              | Semprot P-01, Pemupukan Baris A                       |
| Laporan Operasional | Alat rusak, stok pupuk menipis                        |
| Fase Pohon          | Vegetatif, Berbunga, Berbuah                          |

---

# 22. Batasan UAT

UAT Avology V2 memiliki batasan sebagai berikut:

1. UAT hanya menguji penerimaan pengguna terhadap MVP.
2. UAT tidak menguji performa sistem secara mendalam.
3. UAT tidak menguji keamanan teknis secara menyeluruh.
4. UAT tidak mencakup fitur di luar MVP.
5. UAT tidak menilai akurasi prediksi panen karena sistem tidak menyediakan prediksi panen otomatis.
6. UAT dilakukan berdasarkan skenario penggunaan yang telah ditentukan.
7. Jumlah responden dapat menyesuaikan ketersediaan pengguna lapangan.

---

# 23. Fitur yang Tidak Diuji dalam UAT MVP

Fitur berikut tidak diuji karena tidak termasuk dalam MVP Avology V2:

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

# 24. Format Kesimpulan Hasil UAT

Kesimpulan hasil UAT dapat ditulis dengan format berikut:

```txt
Berdasarkan hasil User Acceptance Testing yang dilakukan kepada [jumlah responden] responden, diperoleh total skor aktual sebesar [skor aktual] dari total skor maksimal [skor maksimal]. Berdasarkan perhitungan, persentase kelayakan sistem adalah sebesar [persentase]%.

Hasil tersebut termasuk dalam kategori [kategori], sehingga aplikasi Avology V2 dapat dinyatakan [layak/sangat layak] digunakan sebagai sistem manajemen kebun alpukat berbasis mobile.

Selain itu, responden memberikan beberapa masukan, yaitu [ringkasan masukan]. Masukan tersebut dapat digunakan sebagai bahan perbaikan dan pengembangan aplikasi pada tahap berikutnya.
```

---

# 25. Kesimpulan

UAT Plan Avology V2 disusun untuk mengukur tingkat penerimaan pengguna terhadap aplikasi berdasarkan pengalaman penggunaan langsung.

Pengujian dilakukan menggunakan skenario penggunaan dan kuesioner skala Likert. Hasil UAT akan digunakan untuk menentukan apakah aplikasi Avology V2 layak digunakan oleh owner dan worker sebagai sistem manajemen kebun alpukat berbasis mobile.

Dengan adanya UAT, evaluasi sistem tidak hanya berdasarkan keberhasilan fungsi secara teknis, tetapi juga berdasarkan kesesuaian aplikasi dengan kebutuhan pengguna lapangan.
