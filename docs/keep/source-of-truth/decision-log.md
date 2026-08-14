# Decision Log Avology V2

## 1. Tujuan Decision Log

Decision log digunakan untuk mencatat keputusan-keputusan penting dalam proses perancangan dan pengembangan Avology V2.

Dokumen ini berfungsi sebagai catatan alasan mengapa suatu fitur dipilih, diubah, dibatasi, atau tidak dimasukkan ke dalam MVP. Dengan adanya decision log, setiap keputusan pengembangan dapat ditelusuri kembali dan tidak bergantung pada ingatan pengembang semata.

Decision log juga digunakan untuk menjaga agar pengembangan Avology V2 tetap sesuai dengan sumber kebenaran utama, yaitu kebutuhan lapangan, hasil wawancara, requirement, user story, scope MVP, rancangan database, dan rencana iterasi pengembangan.

---

## 2. Format Decision Log

Setiap keputusan dicatat menggunakan format berikut:

| Bagian          | Keterangan                                                                       |
| --------------- | -------------------------------------------------------------------------------- |
| ID Keputusan    | Kode unik keputusan                                                              |
| Tanggal         | Tanggal keputusan dibuat                                                         |
| Judul Keputusan | Ringkasan keputusan                                                              |
| Latar Belakang  | Masalah atau alasan munculnya keputusan                                          |
| Keputusan       | Keputusan yang diambil                                                           |
| Alasan          | Pertimbangan utama                                                               |
| Dampak          | Dampak terhadap scope, desain, database, UI, service, testing, atau implementasi |
| Status          | Accepted, Revised, Deprecated, atau Rejected                                     |

---

## 3. Daftar Keputusan Utama

| ID     | Judul Keputusan                                                      | Status   |
| ------ | -------------------------------------------------------------------- | -------- |
| DL-001 | Reset Avology V2 dari awal berdasarkan sumber kebenaran baru         | Accepted |
| DL-002 | Menggunakan Bab 3 dan requirement sebagai sumber kebenaran utama     | Accepted |
| DL-003 | Menggunakan metode Personal Extreme Programming                      | Accepted |
| DL-004 | Membatasi MVP pada sistem informasi manajemen kebun alpukat          | Accepted |
| DL-005 | Menghapus prediksi panen otomatis dari MVP                           | Accepted |
| DL-006 | Mengubah estimasi panen menjadi monitoring fase pertumbuhan          | Accepted |
| DL-007 | Mempertahankan SOP sebagai template standar perawatan                | Superseded |
| DL-008 | Menggunakan jadwal semi-otomatis berdasarkan interval SOP            | Superseded |
| DL-009 | Menambahkan laporan operasional kebun                                | Accepted |
| DL-010 | Menambahkan manajemen worker oleh owner                              | Accepted |
| DL-011 | Worker removed tidak dihapus permanen                                | Accepted |
| DL-012 | Memisahkan laporan kondisi pohon dan laporan operasional kebun       | Accepted |
| DL-013 | Menggunakan pencatatan pohon individual                              | Accepted |
| DL-014 | Menggunakan role berdasarkan farm_members                            | Accepted |
| DL-015 | Menggunakan Supabase sebagai backend utama MVP                       | Accepted |
| DL-016 | Tidak menggunakan backend custom pada MVP                            | Accepted |
| DL-017 | Tidak menggunakan IoT dan sensor pada MVP                            | Accepted |
| DL-018 | Tidak menggunakan push notification pada MVP                         | Accepted |
| DL-019 | Tidak memasukkan fitur chat owner-worker pada MVP                    | Accepted |
| DL-020 | Tidak memasukkan akuntansi lengkap pada MVP                          | Accepted |
| DL-021 | Dashboard tidak dibuat sebagai tabel tersendiri                      | Accepted |
| DL-022 | Riwayat pohon dibentuk dari beberapa tabel histori                   | Accepted |
| DL-023 | Care activity dibuat lebih dari satu per task                        | Accepted |
| DL-024 | Worker flow harus sederhana dan minim teks                           | Accepted |
| DL-025 | UAT dapat melibatkan responden tambahan dengan karakteristik relevan | Accepted |
| DL-026 | Permanent delete pohon tidak masuk MVP                               | Accepted |
| DL-027 | Screen rejected dan removed access tetap dibuat minimal              | Accepted |
| DL-028 | Opsi custom target SOP tidak digunakan pada MVP                      | Superseded |
| DL-029 | Owner dapat melihat profil worker dalam kebun yang sama              | Accepted |
| DL-030 | Growth phase tetap menjadi fitur critical MVP                        | Accepted |
| DL-031 | Custom target hanya digunakan untuk jadwal atau task manual          | Superseded |
| DL-032 | Mencabut fitur SOP perawatan dari sistem                             | Accepted |
| DL-033 | Mencabut target baris dan kolom dari jadwal dan tugas                | Accepted |
| DL-034 | Rantai jadwal berulang berjalan sendiri dengan masa toleransi        | Accepted |
| DL-035 | Penundaan tugas wajib bertanggal dan menggeser tenggat               | Accepted |
| DL-036 | Realisasi tugas terjadwal menautkan pohon yang dirawat               | Accepted |
| DL-037 | Tugas terbuka dilepas saat keanggotaan berhenti aktif                | Accepted |
| DL-038 | Jadwal hanya terkunci oleh hasil kerja yang selesai                  | Accepted |

---

# 4. Detail Decision Log

## DL-001 Reset Avology V2 dari Awal Berdasarkan Sumber Kebenaran Baru

### Tanggal

9 Juni 2026

### Latar Belakang

Avology versi sebelumnya mengalami pergeseran scope dari rencana awal. Beberapa fitur yang diimplementasikan tidak sesuai dengan Bab 3, PRD, dan kebutuhan lapangan. Hal ini menyebabkan desain database, alur aplikasi, dan implementasi menjadi tidak konsisten.

### Keputusan

Avology V2 dibuat ulang dari awal dengan pendekatan yang lebih terstruktur. Seluruh perancangan dimulai kembali dari problem statement, requirement, user story, use case, activity diagram, ERD, database schema, service layer, screen inventory, testing plan, dan UAT plan.

### Alasan

Reset diperlukan agar project tidak terus melanjutkan fondasi yang sudah melenceng. Dengan membangun ulang dari dokumen sumber kebenaran, fitur yang dikembangkan dapat lebih sesuai dengan kebutuhan skripsi dan kebutuhan pengguna.

### Dampak

* Project lama dijadikan pembelajaran.
* Avology V2 memiliki dokumen source-of-truth baru.
* Implementasi coding tidak dilakukan sebelum requirement dan scope jelas.
* Semua fitur harus dapat ditelusuri asal-usulnya.

### Status

Accepted

---

## DL-002 Menggunakan Bab 3 dan Requirement sebagai Sumber Kebenaran Utama

### Tanggal

9 Juni 2026

### Latar Belakang

Pada project sebelumnya, implementasi banyak dipengaruhi oleh kebutuhan teknis dan improvisasi saat coding. Akibatnya, fitur yang dibuat tidak selalu sesuai dengan skripsi, requirement, dan kebutuhan lapangan.

### Keputusan

Sumber kebenaran utama Avology V2 adalah:

1. Bab 3 skripsi
2. Hasil wawancara dan problem statement
3. Requirement
4. User story
5. Use case
6. Activity diagram
7. ERD dan database schema
8. Screen inventory
9. UI
10. Coding
11. Testing

### Alasan

Urutan ini memastikan bahwa implementasi teknis mengikuti kebutuhan akademik dan kebutuhan lapangan, bukan sebaliknya.

### Dampak

* Setiap fitur harus memiliki dasar requirement.
* Perubahan scope harus masuk decision log.
* Coding baru boleh dilakukan setelah dokumen dasar cukup jelas.
* Jika terjadi konflik antara coding dan dokumen, dokumen source-of-truth menjadi acuan utama.

### Status

Accepted

---

## DL-003 Menggunakan Metode Personal Extreme Programming

### Tanggal

9 Juni 2026

### Latar Belakang

Avology V2 dikembangkan secara individual sebagai project skripsi. Oleh karena itu, metode pengembangan harus sesuai untuk pengembang tunggal tetapi tetap memiliki tahapan yang jelas.

### Keputusan

Metode pengembangan yang digunakan adalah Personal Extreme Programming atau PXP.

### Alasan

PXP cocok untuk pengembangan individual karena memiliki tahapan requirements, planning, iteration initialization, design, implementation, system testing, dan retrospective.

### Dampak

* Pengembangan dibagi ke dalam beberapa iterasi.
* Setiap iterasi memiliki output yang jelas.
* Setiap iterasi memiliki black-box testing.
* Retrospective dilakukan setelah tiap iterasi.
* Planning dapat menggunakan story point, priority, dan Natural Time.

### Status

Accepted

---

## DL-004 Membatasi MVP pada Sistem Informasi Manajemen Kebun Alpukat

### Tanggal

9 Juni 2026

### Latar Belakang

Hasil wawancara menunjukkan banyak visi jangka panjang, seperti integrated farming, peternakan, feed bank, restoran, farmer group, hingga supply chain. Namun, tidak semua kebutuhan tersebut realistis untuk MVP skripsi.

### Keputusan

MVP Avology V2 dibatasi sebagai sistem informasi manajemen kebun alpukat berbasis mobile yang fokus pada:

1. Manajemen kebun
2. Manajemen worker
3. Pencatatan pohon individual
4. Laporan kondisi pohon
5. Laporan operasional kebun
6. Jadwal dan tugas worker
7. Realisasi tugas
8. Fase pertumbuhan
9. Riwayat pohon
10. Dashboard owner dan worker

### Alasan

Scope ini cukup merepresentasikan kebutuhan utama MS Farm tanpa membuat aplikasi terlalu luas dan sulit diselesaikan.

### Dampak

* Fitur non-MVP ditunda.
* Fokus implementasi menjadi lebih jelas.
* Project lebih realistis untuk diselesaikan sebagai skripsi.
* Semua fitur MVP harus terhubung dengan kebutuhan lapangan dan requirement.

### Status

Accepted

---

## DL-005 Menghapus Prediksi Panen Otomatis dari MVP

### Tanggal

9 Juni 2026

### Latar Belakang

Pada rancangan awal sempat muncul ide estimasi atau prediksi panen otomatis. Namun, prediksi panen yang akurat membutuhkan banyak variabel seperti varietas, umur pohon, kondisi pohon, hama, penyakit, cuaca, riwayat perawatan, dan data panen historis.

### Keputusan

Fitur prediksi panen otomatis tidak dimasukkan ke dalam MVP Avology V2.

### Alasan

Jika sistem hanya memakai rumus sederhana, misalnya fase berbunga ditambah beberapa bulan, maka hasilnya berisiko overclaim dan tidak cukup ilmiah. Untuk skripsi sistem informasi manajemen, klaim prediksi otomatis terlalu berat jika tidak didukung model data dan metode prediksi yang memadai.

### Dampak

* Tidak ada fitur bernama prediksi panen.
* Tidak ada machine learning untuk panen.
* Tidak ada klaim akurasi panen.
* Fokus digeser ke pencatatan dan monitoring fase pertumbuhan.

### Status

Accepted

---

## DL-006 Mengubah Estimasi Panen Menjadi Monitoring Fase Pertumbuhan

### Tanggal

9 Juni 2026

### Latar Belakang

Meskipun prediksi panen otomatis tidak dimasukkan, hasil wawancara tetap menunjukkan bahwa pencatatan fase berbunga dan berbuah penting untuk membantu owner memantau perkembangan pohon.

### Keputusan

Fitur estimasi panen diganti menjadi pencatatan dan monitoring fase pertumbuhan pohon.

### Alasan

Monitoring fase lebih aman secara akademik dan lebih realistis secara implementasi. Sistem membantu mencatat pohon yang sedang berbunga atau berbuah, tetapi keputusan panen tetap berada pada owner berdasarkan kondisi lapangan.

### Dampak

* Ditambahkan tabel `growth_phase_records`.
* Ditambahkan atribut `current_growth_phase` pada `trees`.
* Ditambahkan fitur Growth Monitoring.
* Tidak ada klaim sistem dapat memprediksi panen otomatis.

### Status

Accepted

---

## DL-007 Mempertahankan SOP sebagai Template Standar Perawatan

### Tanggal

9 Juni 2026

### Latar Belakang

Pada versi sebelumnya, SOP terasa kurang berguna karena hanya menjadi template dan tidak terhubung kuat dengan operasional. Namun, hasil wawancara menunjukkan bahwa SOP perawatan seperti semprot, pupuk, siram, dan gulma memang penting untuk konsistensi pekerjaan kebun.

### Keputusan

SOP tetap dipertahankan dalam MVP, tetapi didefinisikan ulang sebagai template standar perawatan, bukan dokumen prosedur panjang.

### Alasan

SOP sebagai template lebih cocok untuk kebutuhan aplikasi. Owner dapat membuat template seperti pemupukan, penyemprotan, penyiraman, atau pengendalian gulma, lalu menggunakan template tersebut untuk membuat jadwal dan tugas.

### Dampak

* Ditambahkan tabel `care_sops`.
* SOP memiliki kategori, interval, instruksi default, target default, dan status aktif.
* SOP digunakan sebagai dasar pembuatan jadwal.
* SOP tidak dibuat sebagai dokumen panjang.

### Status

Accepted

---

## DL-008 Menggunakan Jadwal Semi-Otomatis Berdasarkan Interval SOP

### Tanggal

9 Juni 2026

### Latar Belakang

Owner membutuhkan bantuan agar jadwal treatment tidak terlupa. Namun, sistem recurring task otomatis penuh membutuhkan mekanisme scheduler, notifikasi, dan validasi yang lebih kompleks.

### Keputusan

Avology V2 menggunakan sistem semi-otomatis. Sistem menghitung acuan jadwal berikutnya berdasarkan realisasi terakhir dan interval SOP, tetapi tugas baru hanya dibuat setelah owner mengonfirmasi.

### Alasan

Pendekatan ini membantu owner tanpa membuat sistem terlalu kompleks. Sistem tidak membuat task otomatis secara diam-diam, sehingga owner tetap memiliki kontrol terhadap jadwal yang dibuat.

### Rumus

```txt
Acuan jadwal berikutnya = tanggal realisasi terakhir + interval SOP
```

### Dampak

* SOP memiliki `interval_days`.
* Sistem menampilkan acuan jadwal berikutnya.
* Sistem dapat menampilkan status seperti belum jatuh tempo, jatuh tempo hari ini, atau terlambat.
* Tidak ada background job otomatis.
* Tidak ada push notification wajib.
* Owner tetap membuat atau mengonfirmasi jadwal dan task.

### Status

Accepted

---

## DL-009 Menambahkan Laporan Operasional Kebun

### Tanggal

9 Juni 2026

### Latar Belakang

Selain kondisi pohon, worker juga dapat menemukan masalah umum di kebun seperti alat rusak, stok habis, kerusakan lahan, bencana, atau kebutuhan pekerja. Masalah ini tidak cocok jika dipaksakan masuk ke laporan kondisi pohon.

### Keputusan

Ditambahkan fitur laporan operasional kebun.

### Alasan

Fitur ini membantu owner mengetahui kondisi umum kebun saat tidak berada di lokasi. Worker dapat melaporkan kejadian lapangan yang membutuhkan perhatian owner.

### Dampak

* Ditambahkan tabel `operational_reports`.
* Worker dapat membuat laporan operasional.
* Owner dapat melihat laporan operasional.
* Owner dapat mengubah status laporan.
* Laporan dapat ditindaklanjuti menjadi task worker.

### Status

Accepted

---

## DL-010 Menambahkan Manajemen Worker oleh Owner

### Tanggal

9 Juni 2026

### Latar Belakang

Owner perlu mengelola siapa saja yang memiliki akses ke data kebun. Worker dapat bergabung menggunakan kode kebun, tetapi akses tidak boleh langsung aktif tanpa kontrol owner.

### Keputusan

Ditambahkan fitur manajemen worker oleh owner.

### Alasan

Fitur ini penting untuk keamanan dan kontrol akses sistem. Owner dapat menerima, menolak, dan mengeluarkan worker dari kebun.

### Dampak

* Tabel `farm_members` menyimpan role dan status worker.
* Owner dapat approve worker.
* Owner dapat reject worker.
* Owner dapat remove worker.
* Worker hanya dapat mengakses data kebun jika statusnya `active`.

### Status

Accepted

---

## DL-011 Worker Removed Tidak Dihapus Permanen

### Tanggal

9 Juni 2026

### Latar Belakang

Jika worker dikeluarkan dari kebun, riwayat tugas dan laporan yang pernah dibuat worker tetap penting untuk ditelusuri.

### Keputusan

Worker yang dikeluarkan tidak dihapus permanen dari database. Status worker diubah menjadi `removed`.

### Alasan

Penghapusan permanen dapat merusak riwayat data. Dengan status `removed`, akses worker dicabut tetapi histori tetap aman.

### Dampak

* Status `removed` ditambahkan pada enum `member_status`.
* Worker removed tidak dapat mengakses data kebun.
* Riwayat tugas dan laporan tetap tersimpan.
* Owner tetap dapat melihat histori pekerjaan yang pernah dilakukan worker tersebut jika relevan.

### Status

Accepted

---

## DL-012 Memisahkan Laporan Kondisi Pohon dan Laporan Operasional Kebun

### Tanggal

9 Juni 2026

### Latar Belakang

Laporan kondisi pohon dan laporan operasional memiliki objek yang berbeda. Laporan kondisi pohon berhubungan langsung dengan pohon tertentu, sedangkan laporan operasional bisa berhubungan dengan area, alat, stok, kerusakan lahan, atau kebutuhan umum kebun.

### Keputusan

Laporan kondisi pohon dan laporan operasional kebun dipisahkan menjadi dua entitas berbeda.

### Alasan

Pemisahan ini membuat data lebih rapi, mudah diproses, dan tidak mencampur objek masalah yang berbeda.

### Dampak

* Laporan kondisi disimpan di `tree_condition_reports`.
* Laporan operasional disimpan di `operational_reports`.
* Riwayat pohon hanya mengambil laporan yang terkait pohon.
* Laporan umum kebun dapat ditindaklanjuti menjadi task.

### Status

Accepted

---

## DL-013 Menggunakan Pencatatan Pohon Individual

### Tanggal

9 Juni 2026

### Latar Belakang

Hasil wawancara menunjukkan bahwa setiap pohon alpukat memiliki perkembangan yang berbeda. Ada pohon yang cepat berbuah, ada yang lambat, ada yang sensitif terhadap penyakit, dan ada yang membutuhkan perhatian khusus.

### Keputusan

Avology V2 mencatat pohon secara individual.

### Alasan

Pencatatan individual memungkinkan owner menelusuri kondisi, fase, dan riwayat perawatan setiap pohon.

### Dampak

* Ditambahkan tabel `trees`.
* Setiap pohon memiliki kode unik per kebun.
* Riwayat kondisi, fase, dan perawatan dapat dikaitkan dengan pohon tertentu.
* Dashboard dapat menghitung jumlah pohon sehat, bermasalah, berbunga, dan berbuah.

### Status

Accepted

---

## DL-014 Menggunakan Role Berdasarkan Farm Members

### Tanggal

9 Juni 2026

### Latar Belakang

Role pengguna perlu bergantung pada konteks kebun. Pengguna dapat menjadi owner atau worker berdasarkan hubungan ke kebun.

### Keputusan

Role tidak disimpan langsung pada `profiles`, tetapi disimpan pada tabel `farm_members`.

### Alasan

Desain ini lebih fleksibel dan lebih sesuai dengan konsep membership kebun. Role melekat pada relasi user dengan farm, bukan pada identitas user secara global.

### Dampak

* Tabel `profiles` hanya menyimpan data pengguna.
* Tabel `farm_members` menyimpan `role` dan `status`.
* Guard aplikasi mengacu pada `farm_members`.
* RLS mengacu pada relasi user terhadap farm.

### Status

Accepted

---

## DL-015 Menggunakan Supabase sebagai Backend Utama MVP

### Tanggal

9 Juni 2026

### Latar Belakang

Avology V2 membutuhkan autentikasi, database, authorization, dan penyimpanan data. Membuat backend custom akan menambah kompleksitas dan waktu pengembangan.

### Keputusan

MVP Avology V2 menggunakan Supabase sebagai backend utama.

### Alasan

Supabase menyediakan Auth, PostgreSQL, RPC, trigger, view, dan Row Level Security. Ini cukup untuk kebutuhan MVP tanpa perlu membangun backend custom.

### Dampak

* Auth menggunakan Supabase Auth.
* Database menggunakan PostgreSQL Supabase.
* Logic penting dapat dibuat melalui RPC.
* Akses data dibatasi menggunakan RLS.
* Frontend menggunakan service layer untuk berinteraksi dengan Supabase.

### Status

Accepted

---

## DL-016 Tidak Menggunakan Backend Custom pada MVP

### Tanggal

9 Juni 2026

### Latar Belakang

Backend custom seperti Express atau NestJS dapat memberi fleksibilitas, tetapi juga menambah pekerjaan, deployment, testing, dan risiko bug.

### Keputusan

Backend custom tidak digunakan pada MVP.

### Alasan

MVP dapat dipenuhi dengan Supabase, service layer di frontend, RPC, dan RLS. Backend custom dapat dipertimbangkan di pengembangan lanjutan jika kebutuhan sistem bertambah.

### Dampak

* Implementasi lebih sederhana.
* Tidak perlu deploy backend terpisah.
* Logic bisnis penting tetap dapat dipindahkan ke RPC.
* Frontend harus memiliki service layer yang rapi.

### Status

Accepted

---

## DL-017 Tidak Menggunakan IoT dan Sensor pada MVP

### Tanggal

9 Juni 2026

### Latar Belakang

IoT dan sensor dapat membantu monitoring kebun, tetapi membutuhkan perangkat keras, koneksi, integrasi data, dan biaya tambahan.

### Keputusan

IoT dan sensor tidak dimasukkan ke dalam MVP.

### Alasan

Hasil wawancara menunjukkan bahwa input manual masih realistis untuk kondisi lapangan. Fokus MVP adalah pencatatan dan manajemen operasional, bukan otomasi sensor.

### Dampak

* Semua data dimasukkan manual oleh owner atau worker.
* Tidak ada tabel sensor.
* Tidak ada dashboard sensor.
* IoT dapat menjadi pengembangan lanjutan.

### Status

Accepted

---

## DL-018 Tidak Menggunakan Push Notification pada MVP

### Tanggal

9 Juni 2026

### Latar Belakang

Fitur notifikasi dapat membantu pengingat, tetapi implementasinya menambah kompleksitas teknis seperti permission, token device, scheduler, dan background job.

### Keputusan

Push notification tidak dimasukkan ke dalam MVP.

### Alasan

MVP cukup menggunakan dashboard dan status acuan jadwal untuk menunjukkan tugas, laporan, dan SOP yang perlu diperhatikan.

### Dampak

* Tidak ada push notification.
* Tidak ada tabel notification.
* Pengingat jadwal ditampilkan melalui dashboard, daftar SOP, dan daftar tugas.
* Notifikasi dapat menjadi pengembangan lanjutan.

### Status

Accepted

---

## DL-019 Tidak Memasukkan Fitur Chat Owner-Worker pada MVP

### Tanggal

9 Juni 2026

### Latar Belakang

Komunikasi owner dan worker memang penting, tetapi fitur chat akan menambah kompleksitas seperti realtime message, status terbaca, histori chat, dan notifikasi.

### Keputusan

Fitur chat owner-worker tidak dimasukkan ke dalam MVP.

### Alasan

Kebutuhan komunikasi utama sudah difasilitasi melalui laporan kondisi, laporan operasional, tugas, dan catatan realisasi.

### Dampak

* Tidak ada tabel chat.
* Tidak ada fitur pesan realtime.
* Komunikasi kerja dilakukan melalui laporan dan tugas.
* Chat dapat menjadi pengembangan lanjutan.

### Status

Accepted

---

## DL-020 Tidak Memasukkan Akuntansi Lengkap pada MVP

### Tanggal

9 Juni 2026

### Latar Belakang

Owner memiliki visi jangka panjang terkait perhitungan biaya dan keuntungan kebun. Namun, fitur akuntansi lengkap membutuhkan modul transaksi, kategori biaya, pendapatan, laporan laba rugi, dan validasi finansial.

### Keputusan

Akuntansi lengkap tidak dimasukkan ke dalam MVP.

### Alasan

Fokus MVP adalah manajemen operasional kebun. Modul finansial dapat memperluas scope terlalu jauh dan mengganggu penyelesaian fitur utama.

### Dampak

* Tidak ada tabel transaksi keuangan.
* Tidak ada laporan laba rugi.
* Tidak ada fitur biaya treatment.
* Modul finansial menjadi backlog pengembangan lanjutan.

### Status

Accepted

---

## DL-021 Dashboard Tidak Dibuat sebagai Tabel Tersendiri

### Tanggal

9 Juni 2026

### Latar Belakang

Dashboard menampilkan ringkasan data seperti total pohon, pohon bermasalah, tugas hari ini, laporan baru, dan worker pending.

### Keputusan

Dashboard tidak dibuat sebagai tabel tersendiri.

### Alasan

Dashboard adalah hasil agregasi dari data yang sudah ada. Membuat tabel dashboard dapat menyebabkan duplikasi data dan risiko data tidak sinkron.

### Dampak

* Dashboard mengambil data dari tabel `trees`, `care_tasks`, `operational_reports`, `farm_members`, dan `growth_phase_records`.
* Tidak ada tabel `dashboard`.
* Query dashboard perlu dibuat efisien.
* Jika diperlukan, dashboard dapat menggunakan view atau RPC agregasi.

### Status

Accepted

---

## DL-022 Riwayat Pohon Dibentuk dari Beberapa Tabel Histori

### Tanggal

9 Juni 2026

### Latar Belakang

Riwayat pohon terdiri dari kondisi pohon, fase pertumbuhan, dan aktivitas perawatan. Jika semua riwayat disimpan dalam satu tabel fisik, data dapat menjadi duplikatif.

### Keputusan

Riwayat pohon dibentuk dari gabungan beberapa tabel histori melalui view atau query.

### Alasan

Data sumber tetap tersimpan di tabel masing-masing, sedangkan timeline riwayat dapat dibentuk menggunakan `tree_history_view`.

### Dampak

* Riwayat kondisi disimpan di `tree_condition_reports`.
* Riwayat fase disimpan di `growth_phase_records`.
* Riwayat perawatan berasal dari `care_tasks` dan `care_activities`.
* View `tree_history_view` digunakan untuk menampilkan timeline.

### Status

Accepted

---

## DL-023 Care Activity Dibuat Lebih dari Satu per Task

### Tanggal

9 Juni 2026

### Latar Belakang

Awalnya satu task dianggap cukup memiliki satu activity. Namun, dalam praktiknya satu task bisa ditunda terlebih dahulu lalu diselesaikan di hari lain.

### Keputusan

Satu `care_task` dapat memiliki banyak `care_activities`.

### Alasan

Desain ini menjaga riwayat perubahan status task. Penundaan dan penyelesaian tidak saling menimpa.

### Dampak

* Relasi `care_tasks` ke `care_activities` menjadi one-to-many.
* Setiap aksi worker terhadap task dicatat sebagai activity baru.
* Status terbaru task disinkronkan berdasarkan activity terakhir.
* Riwayat pengerjaan task lebih mudah ditelusuri.

### Status

Accepted

---

## DL-024 Worker Flow Harus Sederhana dan Minim Teks

### Tanggal

9 Juni 2026

### Latar Belakang

Hasil wawancara menunjukkan aplikasi harus sederhana, mudah digunakan, dan tidak membutuhkan input rumit. Worker menggunakan aplikasi di konteks lapangan, sehingga flow harus cepat.

### Keputusan

Flow worker dibuat lebih sederhana daripada owner dan form worker harus minim teks.

### Alasan

Worker membutuhkan fitur operasional langsung seperti lihat tugas, selesai/tunda tugas, lapor kondisi pohon, catat fase, dan buat laporan operasional. Form yang terlalu rumit berisiko tidak digunakan.

### Dampak

* Worker dashboard berisi ringkasan tugas dan shortcut utama.
* Form menggunakan pilihan kategori/status.
* Catatan teks dibuat singkat dan opsional jika memungkinkan.
* Worker tidak diberi fitur pengelolaan kompleks seperti SOP, jadwal utama, dan worker management.

### Status

Accepted

---

## DL-025 UAT Dapat Melibatkan Responden Tambahan dengan Karakteristik Relevan

### Tanggal

9 Juni 2026

### Latar Belakang

Jumlah pengguna internal MS Farm terbatas, yaitu owner dan worker. Untuk memperoleh masukan tambahan terhadap kemudahan penggunaan dan penerimaan sistem, diperlukan responden tambahan.

### Keputusan

UAT dapat melibatkan responden tambahan dengan karakteristik relevan.

### Alasan

Responden tambahan dapat membantu menilai aspek kemudahan penggunaan, tampilan, dan kelayakan alur aplikasi. Namun, validasi utama kebutuhan tetap mengacu pada pengguna utama MS Farm.

### Dampak

* UAT memiliki responden utama dan responden tambahan.
* Kuesioner dapat dibagi menjadi owner, worker, dan responden umum.
* Hasil UAT tetap dijelaskan berdasarkan karakteristik responden.
* Responden tambahan tidak menggantikan validasi pengguna utama.

### Status

Accepted

---

## DL-026 Permanent Delete Pohon Tidak Masuk MVP

### Tanggal

9 Juni 2026

### Latar Belakang

Requirement menyebut owner dapat menghapus pohon jika diperlukan. Namun, dalam konteks sistem informasi kebun, data pohon memiliki riwayat kondisi, fase pertumbuhan, dan perawatan yang penting untuk ditelusuri.

### Keputusan

MVP Avology V2 tidak menggunakan permanent delete untuk pohon. Aksi utama yang digunakan adalah archive dan unarchive melalui field `is_archived`.

### Alasan

Permanent delete berisiko menghilangkan riwayat pohon dan merusak integritas data histori. Archive lebih aman karena data tetap tersimpan tetapi tidak ditampilkan sebagai pohon aktif.

### Dampak

* Tabel `trees` menggunakan field `is_archived`.
* Tidak ada fitur delete permanen pohon pada MVP.
* Pohon arsip tetap dapat ditelusuri jika diperlukan.
* Query pohon aktif memfilter `is_archived = false`.
* Riwayat pohon tidak rusak karena data pohon tidak dihapus permanen.

### Status

Accepted

---

## DL-027 Screen Rejected dan Removed Access Tetap Dibuat Minimal

### Tanggal

9 Juni 2026

### Latar Belakang

Screen rejected dan removed access memiliki prioritas UI rendah, tetapi status worker `rejected` dan `removed` tetap memengaruhi akses aplikasi.

### Keputusan

Screen rejected dan removed access tetap dibuat secara minimal sejak Iteration 1.

### Alasan

Worker yang ditolak atau dikeluarkan harus mendapatkan feedback yang jelas dan tidak boleh masuk ke halaman owner atau worker aktif.

### Dampak

* Auth guard perlu membaca status `farm_members`.
* Worker dengan status `rejected` diarahkan ke rejected screen.
* Worker dengan status `removed` diarahkan ke removed access screen.
* UI dibuat sederhana dan tidak menjadi fokus polish awal.
* Testing role dan status membership harus mencakup status `pending`, `active`, `rejected`, dan `removed`.

### Status

Accepted

---

## DL-028 Opsi Custom Target SOP Tidak Digunakan pada MVP

### Tanggal

9 Juni 2026

### Latar Belakang

SQL draft sebelumnya menyediakan opsi `custom` pada default target SOP, tetapi tidak ada field tambahan untuk menyimpan catatan target custom.

### Keputusan

MVP tidak menggunakan opsi `custom` pada default target SOP.

### Alasan

Target custom menambah kompleksitas form, database, validasi, dan service layer. Untuk MVP, target SOP cukup menggunakan target yang terstruktur.

### Dampak

* Enum atau validasi `target_type` untuk SOP tidak menggunakan `custom`.
* Target jadwal tetap dapat menggunakan `farm`, `row`, `column`, atau `tree` sesuai kebutuhan dokumen.
* Tidak perlu field `default_custom_target_note` pada `care_sops`.
* Form SOP menjadi lebih sederhana.

### Status

Accepted

---

## DL-029 Owner Dapat Melihat Profil Worker dalam Kebun yang Sama

### Tanggal

9 Juni 2026

### Latar Belakang

Policy awal pada tabel `profiles` hanya mengizinkan user melihat profil dirinya sendiri. Namun, fitur worker management membutuhkan owner untuk melihat nama, nomor telepon, atau informasi dasar worker yang bergabung ke kebunnya.

### Keputusan

Owner dapat melihat profil worker yang berada dalam farm yang sama melalui RLS policy, view, atau RPC yang aman.

### Alasan

Fitur approve, reject, remove, dan active worker list membutuhkan identitas dasar worker. Tanpa akses profil, owner tidak dapat mengelola worker dengan jelas.

### Dampak

* RLS `profiles` perlu mendukung akses owner terhadap member kebunnya.
* Alternatif aman dapat menggunakan view atau RPC khusus.
* Worker tetap tidak boleh melihat profil user di luar kebunnya.
* Data profil yang dibuka hanya data yang relevan untuk membership.
* Service `memberService` dapat mengambil data worker dengan aman.

### Status

Accepted

---

## DL-030 Growth Phase Tetap Menjadi Fitur Critical MVP

### Tanggal

9 Juni 2026

### Latar Belakang

Screen inventory sempat menempatkan create growth phase record pada priority rendah, sementara requirement dan user story menunjukkan bahwa monitoring fase pertumbuhan adalah fitur penting pengganti prediksi panen otomatis.

### Keputusan

Growth phase tetap menjadi fitur critical MVP dan diimplementasikan pada Iteration 6.

### Alasan

Monitoring fase pertumbuhan adalah bagian inti dari pengelolaan pohon alpukat dan menjadi pengganti yang lebih realistis dari fitur prediksi panen otomatis.

### Dampak

* Tabel `growth_phase_records` tetap masuk schema MVP.
* Kolom `current_growth_phase` tetap ada pada `trees`.
* Screen growth monitoring tetap masuk MVP.
* Black-box testing perlu mencakup pencatatan dan sinkronisasi fase pertumbuhan.
* Iteration planning harus tetap memasukkan growth phase sebagai bagian MVP.

### Status

Accepted

---

## DL-031 Custom Target Hanya Digunakan untuk Jadwal atau Task Manual

### Tanggal

9 Juni 2026

### Latar Belakang

Decision log DL-028 memutuskan bahwa custom target tidak digunakan pada default target SOP. Namun, beberapa dokumen testing dan rancangan jadwal masih menyebut target custom untuk kebutuhan jadwal atau task manual.

### Keputusan

Custom target tidak digunakan pada default target SOP, tetapi tetap dapat digunakan pada jadwal atau task manual jika diperlukan.

### Alasan

SOP membutuhkan struktur target yang konsisten karena berfungsi sebagai template berulang. Sementara itu, jadwal atau task manual dapat membutuhkan target yang lebih fleksibel untuk kondisi lapangan tertentu.

### Dampak

* `care_sops.default_target_type` tidak menerima nilai `custom`.
* Jadwal atau task manual boleh menggunakan custom target jika schema mendukung.
* Testing target custom hanya berlaku untuk schedule/task manual, bukan SOP default.
* Form SOP tetap sederhana.

### Status

Accepted

---

## DL-032 Mencabut Fitur SOP Perawatan dari Sistem

### Konteks

DL-007 memutuskan SOP dipertahankan sebagai template standar perawatan, dan DL-008 membangun acuan jadwal berikutnya di atas `care_sops.interval_days`.

Pada praktiknya fitur SOP tidak pernah selesai dibangun: enam service yang dirancang di `12-service-layer-design.md` dan empat halaman di `13-screen-navigation-flow.md` tidak pernah diimplementasikan. Yang berjalan di aplikasi hanyalah jadwal manual. Audit database menunjukkan `interval_days` tidak pernah dibaca RPC mana pun, dan sebagian besar baris `care_sops` adalah fixture pengujian.

Kebutuhan pengulangan perawatan yang menjadi alasan DL-008 sudah dijawab lebih dahulu oleh kolom `care_schedules.repeat_every_days` (migrasi 040 dan 041), yang menghitung jadwal berikutnya dari tanggal realisasi terakhir tanpa memerlukan template terpisah.

### Keputusan

Tabel `care_sops`, RPC `create_schedule_from_sop`, dan kolom `care_schedules.care_sop_id` dihapus dari database melalui migrasi 046.

### Alasan

Mempertahankan tabel dan RPC yang tidak dipakai membebani setiap perubahan skema berikutnya: dua trigger validasi yang masih aktif membaca `care_sops`, sehingga tabel itu tidak bisa diabaikan begitu saja. Menghapusnya menyederhanakan model tanpa kehilangan kemampuan apa pun yang benar-benar berjalan.

### Dampak

* DL-007 dan DL-008 berstatus superseded.
* Interval pengulangan hidup di `care_schedules.repeat_every_days`, bukan di template.
* FR-13, FR-14, US-21, US-22, US-23, US-25, UC-18, dan UC-20 dihapus; nomornya sengaja tidak dipakai ulang.
* Dokumen 04 sampai 17 disunting mengikuti keputusan ini.

### Status

Accepted

---

## DL-033 Mencabut Target Baris dan Kolom dari Jadwal dan Tugas

### Konteks

DL-028 dan DL-031 mengatur kapan target `custom` boleh dipakai, dengan asumsi target terstruktur mencakup `farm`, `row`, `column`, dan `tree`.

Audit menemukan bahwa `target_row` dan `target_column` hanyalah teks bebas yang diketik owner. Tidak ada satu pun query yang menghubungkannya ke `trees.row_position` / `trees.column_position`, sehingga target "Baris B" tidak pernah menghasilkan daftar pohon dan hanya tampil sebagai label. Nilainya juga tidak terpakai di riwayat pohon maupun dashboard.

Pemakaiannya juga nyaris nol. Pemeriksaan isi tabel sebelum migrasi 047 menemukan **nol baris** bertarget `row`, dan **satu baris** bertarget `column` yang isinya `'1'` — satu karakter tanpa makna operasional apa pun. Dengan kata lain, fitur ini dicabut bukan berdasarkan dugaan bahwa ia tidak dipakai, melainkan berdasarkan hitungan bahwa ia memang tidak pernah dipakai.

### Keputusan

Kolom `target_row` dan `target_column` dihapus dari `care_schedules` dan `care_tasks` melalui migrasi 047. Nilai `target_type` yang berlaku menyusut menjadi `farm`, `tree`, dan `custom`. Pada migrasi yang sama, `care_tasks.category` menjadi `not null`.

### Alasan

Target yang tidak dapat di-resolve ke entitas apa pun memberi kesan presisi yang tidak dimiliki sistem. Menyisakan tiga target yang benar-benar bermakna membuat validasi, form, dan constraint jauh lebih sederhana.

### Dampak

* DL-028 dan DL-031 berstatus superseded; aturan target `custom` kini berlaku untuk seluruh jadwal dan tugas, karena semuanya dibuat manual.
* Nilai `row` dan `column` TETAP ada di tipe enum `target_type` PostgreSQL karena `alter type ... drop value` tidak tersedia; keduanya ditutup oleh CHECK constraint pada kedua tabel.
* Kolom `trees.row_position` dan `trees.column_position` tidak terpengaruh — itu posisi fisik pohon, bukan target jadwal.
* Signature `create_manual_schedule` dan `create_task_from_operational_report` berubah.

### Status

Accepted

---

## DL-034 Rantai Jadwal Berulang Berjalan Sendiri dengan Masa Toleransi

### Konteks

DL-008 memutuskan jadwal berjalan semi-otomatis: sistem menghitung acuan tanggal berikutnya, tetapi tugas baru hanya dibuat setelah owner mengonfirmasi. Keputusan itu sudah berstatus superseded sejak DL-032, namun konsekuensinya belum pernah dicatat sebagai keputusan tersendiri.

Sejak migrasi 041 sistem sebenarnya sudah membuat jadwal penerus sendiri lewat rantai `series_id` / `parent_schedule_id`. Yang belum terjawab adalah apa yang terjadi ketika satu siklus TIDAK dikerjakan sama sekali: rantai berhenti diam-diam. Penjaga "satu jadwal terbuka per rantai" melihat siklus lama masih menganggur, sehingga penerus tidak pernah lahir dan perawatan rutin berhenti tanpa satu pun pesan kesalahan.

### Keputusan

Migrasi 048 menambahkan tiga hal pada `care_schedules`: `grace_days` sebagai masa toleransi keterlambatan, `date_basis` sebagai dasar perhitungan tanggal penerus, dan `missed_at` sebagai penanda siklus terlewat. Siklus yang melewati `scheduled_date + grace_days` dinyatakan terlewat, dan penerusnya tetap dibuat.

Penandaan dan pembentukan penerus dijalankan penyapu yang menumpang pada jalur baca aplikasi, dilindungi kunci per kebun, bukan oleh penjadwal yang hidup di luar aplikasi.

### Alasan

Perawatan rutin adalah alasan utama fitur jadwal ada. Rantai yang berhenti karena satu siklus terlewat justru gagal pada kasus yang paling membutuhkannya.

Masa toleransi ditaruh per jadwal, bukan sebagai angka global, karena toleransi penyiraman dan toleransi pemupukan tidak sama. Jadwal tanpa `grace_days` sengaja tidak pernah dinyatakan terlewat, sehingga owner tetap bisa membuat jadwal yang menunggu selamanya.

Penyapu dipilih ketimbang penjadwal latar agar MVP tetap tidak membutuhkan cron, token perangkat, maupun push notification — batasan yang sudah ditetapkan DL-018.

### Dampak

* FR-17 ditulis ulang; klaim "sistem tidak membuat tugas berulang otomatis tanpa konfirmasi owner" dicabut dari dokumen 04, 05, 06, 07, 08, 09, dan 10.
* US-24 berubah judul menjadi "Sistem Melanjutkan Jadwal Berulang", UC-19 menjadi "Melanjutkan Jadwal Berulang" dengan aktor tambahan Sistem.
* Baris "Recurring task otomatis penuh" pada daftar fitur di luar MVP dipersempit menjadi penjadwal latar.
* Penerus hanya membawa tugas jika pekerja siklus sebelumnya masih aktif; jika tidak, penerus lahir tanpa tugas dan menunggu penugasan owner.

### Status

Accepted

---

## DL-035 Penundaan Tugas Wajib Bertanggal dan Menggeser Tenggat

### Konteks

DL-023 memutuskan satu tugas boleh memiliki lebih dari satu aktivitas, tepatnya agar tugas dapat ditunda lebih dulu lalu diselesaikan di hari lain. Yang tidak diatur adalah kapan pekerjaan yang ditunda itu akan dikerjakan.

Akibatnya penundaan menjadi jalan buntu. Tenggat tugas tetap di tanggal lama, sehingga tugas yang ditunda selamanya terlihat terlambat, dan setelah DL-034 berlaku ia akhirnya hangus kena masa toleransi — padahal pekerja sudah menyatakan niat mengerjakannya.

### Keputusan

Migrasi 049 menambahkan `postponed_until` pada `care_activities` dan mewajibkannya terisi untuk setiap realisasi berstatus `postponed`. Tanggal itu menggeser `care_tasks.due_date`, sehingga masa toleransi dihitung ulang dari tanggal baru.

### Alasan

Penundaan adalah penjadwalan ulang, bukan pengabaian. Menuntut satu tanggal mengubah "belum saya kerjakan" menjadi "akan saya kerjakan tanggal sekian", dan itulah yang membuat penundaan bisa hidup berdampingan dengan masa toleransi.

Pergeseran tenggat ditaruh pada trigger, bukan di dalam RPC penundaan, karena tanggal penundaan punya dua jalur tulis: pencatatan baru dan perbaikan catatan terakhir. Satu salinan aturan mencegah keduanya berbeda diam-diam.

### Dampak

* FR-20, US-31, dan UC-25 disunting; tanggal dan catatan menjadi wajib saat menunda.
* Constraint database menolak realisasi `postponed` tanpa tanggal, dan realisasi `completed` yang menyertakan tanggal tunda.
* Owner melihat tanggal rencana pengerjaan ulang pada tugas yang tertunda.

### Status

Accepted

---

## DL-036 Realisasi Tugas Terjadwal Menautkan Pohon yang Dirawat

### Konteks

DL-022 memutuskan riwayat pohon dibentuk dari gabungan beberapa tabel histori, salah satunya aktivitas perawatan. Sejak migrasi 025 tautan aktivitas ke pohon disimpan pada tabel jembatan `care_activity_trees`, karena satu perawatan dapat berdampak pada banyak pohon.

Audit menemukan jembatan itu hanya pernah diisi dari satu jalur, yaitu pencatatan inisiatif. Jalur tugas terjadwal tidak pernah menyentuhnya sama sekali. Hitungannya tegas: **14 aktivitas terjadwal, nol tautan pohon**. Artinya seluruh pekerjaan terjadwal — justru pekerjaan yang direncanakan owner dan paling layak dilacak — tidak pernah muncul di riwayat pohon mana pun.

### Keputusan

Migrasi 050 membuat penyelesaian tugas ikut mengisi `care_activity_trees`, dengan pohon diturunkan dari target tugas: target `tree` menautkan satu pohon, target `farm` menautkan seluruh pohon kebun yang belum diarsipkan, dan target `custom` tidak menautkan apa pun.

Pohon diresolusi pada saat penyelesaian tugas, bukan pada saat jadwal dibuat.

### Alasan

Riwayat perawatan per pohon adalah salah satu janji utama sistem ini kepada pemilik kebun. Riwayat yang hanya memuat pencatatan inisiatif memberi gambaran yang keliru tentang pohon yang sebenarnya paling rutin dirawat.

Resolusi di akhir dipilih karena jadwal berulang bisa lahir berbulan-bulan sebelum dikerjakan, sementara daftar pohon kebun berubah di antaranya. Menautkan pohon berdasarkan keadaan saat pekerjaan benar-benar dilakukan lebih jujur daripada berdasarkan keadaan saat rencana disusun.

Target `custom` sengaja tidak menautkan apa pun. Targetnya memang tidak menunjuk pohon, dan menebak-nebak pohon dari teks bebas akan mengulang persis kekeliruan yang dicabut DL-033.

### Dampak

* FR-21 disunting; US-30 dan UC-24 bertambah langkah penautan pohon.
* `tree_history_view` mengambil pohon dari jembatan, bukan dari target pohon pada tugas, sehingga perawatan bertarget seluruh kebun muncul di riwayat setiap pohon terdampak.
* Entitas `CareActivityTree` masuk ke dokumen 09, 10, dan 11 — jembatan ini sudah ada di database sejak migrasi 025 tetapi belum pernah terdokumentasi.
* Tautan yang terbentuk tidak dapat dikoreksi; jembatan sengaja tidak punya jalur hapus maupun ubah.

### Status

Accepted

---

## DL-037 Tugas Terbuka Dilepas Saat Keanggotaan Berhenti Aktif

### Konteks

DL-011 memutuskan worker yang dikeluarkan tidak dihapus permanen, melainkan diberi status `removed`, agar riwayat tugas dan laporannya tetap dapat ditelusuri. Keputusan itu tetap berlaku.

Yang tidak diperhitungkan adalah tugas yang masih terbuka saat keanggotaan berakhir. Keanggotaan dapat berpindah keluar dari `active` kapan saja, dan baris keanggotaan yang sama dipakai ulang ketika orang itu mengajukan bergabung kembali. Akibatnya tugas lama otomatis menjadi milik anggota non-aktif tanpa satu pun perubahan pada tugas itu sendiri.

Tugas seperti itu terjebak di tengah: tidak terlihat oleh mantan pekerja, tidak bisa ditugaskan ulang karena jadwalnya dianggap sudah punya tugas, tetapi tetap dihitung sebagai tunggakan di dashboard owner.

### Keputusan

Migrasi 051 melepas seluruh tugas terbuka milik anggota yang berhenti aktif, baik karena dikeluarkan owner maupun karena keluar sendiri. Pelepasan dicatat pada kolom `released_at` dan `released_reason`, dan dijalankan sebelum status keanggotaan diubah.

### Alasan

Pemicunya adalah keanggotaan berhenti `active`, bukan nilai status akhirnya. Menyandarkan aturan pada nilai `removed` saja akan melewatkan jalur keluar lain yang mungkin ditambahkan kemudian.

Pelepasan dicatat sebagai kolom tersendiri, bukan sebagai nilai status baru maupun dengan menumpang penanda terlewat. Sebabnya berbeda dan tidak boleh tertukar: terlewat berarti tenggatnya habis, sedangkan dilepas berarti pekerjaannya tidak lagi menjadi tanggungan siapa pun. Menyatukan keduanya akan membuat mantan pekerja terlihat lalai atas pekerjaan yang ia tinggalkan secara sah.

Urutan pelepasan sebelum pencabutan keanggotaan bersifat wajib, karena validasi tugas menolak setiap perubahan pada tugas milik orang yang sudah tidak aktif.

### Dampak

* FR-06, US-09, dan UC-09 disunting; jalur keluar atas kemauan sendiri ikut dicatat.
* Definisi "tugas terbuka" menjadi: status `pending` atau `postponed`, belum terlewat, dan belum dilepas. Definisi ini dipakai seluruh penghitung tunggakan dan penyapu jadwal.
* Penjaga "jadwal sudah punya tugas" dilonggarkan menjadi "jadwal masih punya tugas aktif", sehingga jadwal dapat ditugaskan ulang.
* Jadwal yang tugasnya dilepas memakai penanda "Belum ada pekerja" yang sudah ada; tidak ada penanda baru yang ditambahkan.

### Status

Accepted

---

## DL-038 Jadwal Hanya Terkunci oleh Hasil Kerja yang Selesai

### Konteks

Sejak awal, jadwal dikunci dari penyuntingan dan pembatalan begitu ada aktivitas apa pun yang menempel pada tugasnya. Aturan itu masuk akal ketika aktivitas hanya berarti pekerjaan selesai.

Setelah DL-023 mengizinkan satu tugas memiliki banyak aktivitas, penundaan juga menulis baris aktivitas. Akibatnya satu kali pekerja menekan tunda sudah cukup mengunci jadwalnya selamanya: owner tidak dapat mengedit, dan tidak dapat membatalkan. Keadaan buntu ini terkonfirmasi langsung pada perangkat.

### Keputusan

Migrasi 052 mempersempit penguncian menjadi hanya aktivitas berstatus `completed`.

### Alasan

Yang dilindungi penguncian adalah riwayat. Begitu pekerjaan benar-benar dilakukan, mengubah jadwalnya membuat catatan lama berbicara tentang perintah yang tidak pernah diberikan.

Penundaan tidak membawa risiko itu sama sekali: tidak ada pekerjaan yang terjadi, tidak ada bahan yang tercatat, tidak ada pohon yang tertaut, dan tidak ada foto bukti. Mengunci jadwal karenanya menghukum owner atas pekerjaan yang justru belum dikerjakan.

### Dampak

* FR-15 dan NFR-08 disunting; owner dapat mengedit maupun membatalkan jadwal yang tugasnya tertunda.
* Aturan yang sama berlaku di tiga tempat: RPC pembatalan jadwal, pemeriksaan kelayakan sunting, dan tombol pada layar detail jadwal. Ketiganya harus bergerak bersama.
* Perilaku migrasi 049 — mengedit jadwal tanpa mengubah tanggal tidak menimpa tenggat hasil penundaan — baru benar-benar dapat dijalankan lewat aplikasi setelah keputusan ini, karena sebelumnya layar Edit tidak pernah terbuka untuk jadwal dengan tugas tertunda.
* Aksi "hentikan pengulangan" tetap tidak ikut terkunci.

### Status

Accepted

---

# 5. Keputusan Fitur yang Tidak Masuk MVP

Fitur berikut secara sadar tidak dimasukkan ke dalam MVP Avology V2:

| Fitur                         | Alasan Tidak Masuk MVP                                      |
| ----------------------------- | ----------------------------------------------------------- |
| Prediksi panen otomatis       | Membutuhkan data historis dan metode prediksi yang kuat     |
| Machine learning              | Tidak sesuai fokus sistem informasi operasional MVP         |
| Push notification             | Membutuhkan scheduler, token device, dan background process |
| IoT/sensor                    | Membutuhkan perangkat keras dan biaya tambahan              |
| Weather API                   | Tidak menjadi kebutuhan inti MVP                            |
| Chat owner-worker             | Sudah digantikan oleh laporan, tugas, dan catatan           |
| Akuntansi lengkap             | Scope terlalu luas dan membutuhkan modul finansial khusus   |
| PDF report generator          | Tidak wajib untuk operasional awal                          |
| Integrated farming            | Visi jangka panjang, bukan MVP                              |
| Peternakan/feed bank          | Di luar fokus kebun alpukat MVP                             |
| Marketplace                   | Tidak relevan untuk scope awal                              |
| Grading buah A1/A2/A3         | Membutuhkan data panen dan standar grading lebih detail     |
| Kelompok tani                 | Bukan kebutuhan utama sistem internal MS Farm               |
| Penjadwal latar dan notifikasi | Rantai jadwal berjalan sendiri lewat jalur baca aplikasi, sehingga proses di luar aplikasi tidak dibutuhkan |
| Supply chain restoran/warung  | Visi jangka panjang, bukan fitur skripsi MVP                |
| Permanent delete pohon        | Berisiko merusak histori pohon                              |
| Custom target SOP             | Menambah kompleksitas database dan form pada MVP            |

---

# 6. Keputusan yang Berdampak pada Database

| Keputusan                                  | Dampak Database                                                    |
| ------------------------------------------ | ------------------------------------------------------------------ |
| Role berdasarkan farm_members              | Tabel `farm_members` menyimpan role dan status                     |
| Worker removed tidak dihapus               | Enum `member_status` memiliki nilai `removed`                      |
| Pohon individual                           | Tabel `trees` memiliki kode unik per farm                          |
| Permanent delete pohon tidak masuk MVP     | Tabel `trees` menggunakan `is_archived`                            |
| Laporan kondisi dan operasional dipisahkan | Tabel `tree_condition_reports` dan `operational_reports` dipisah   |
| Jadwal berulang                            | `care_schedules.repeat_every_days` menyimpan interval pengulangan  |
| Target baris/kolom dicabut                 | `target_type` efektif hanya `farm`, `tree`, `custom`               |
| Rantai jadwal berjalan sendiri             | `series_id`, `parent_schedule_id`, dan `date_basis` pada `care_schedules` |
| Masa toleransi dan status terlewat         | `grace_days` dan `missed_at` pada `care_schedules`, `missed_at` pada `care_tasks` |
| Penundaan wajib bertanggal                 | `postponed_until` pada `care_activities`, menggeser `care_tasks.due_date` |
| Aktivitas terjadwal menautkan pohon        | `care_activity_trees` diisi juga oleh jalur penyelesaian tugas     |
| Tugas dilepas saat keanggotaan berakhir    | `released_at` dan `released_reason` pada `care_tasks`              |
| Jadwal terkunci hanya oleh hasil kerja selesai | Penjaga pembatalan jadwal memeriksa aktivitas berstatus `completed` |
| Task bisa dari jadwal atau laporan         | `care_tasks` punya `care_schedule_id` dan `operational_report_id`  |
| Activity lebih dari satu per task          | `care_activities` menjadi histori aksi task                        |
| Fase pertumbuhan                           | Tabel `growth_phase_records` dan kolom `current_growth_phase`      |
| Riwayat pohon via view                     | `tree_history_view` menggabungkan beberapa tabel                   |
| Dashboard bukan tabel                      | Dashboard memakai query agregasi                                   |
| Owner melihat profil worker                | RLS, view, atau RPC perlu mendukung akses profil member satu kebun |

---

# 7. Keputusan yang Berdampak pada UI

| Keputusan                              | Dampak UI                                                      |
| -------------------------------------- | -------------------------------------------------------------- |
| Worker flow sederhana                  | Worker dashboard hanya berisi tugas dan shortcut laporan       |
| Owner sebagai pengelola utama          | Owner memiliki halaman SOP, jadwal, worker, laporan, dashboard |
| Tidak ada prediksi panen               | Tidak ada halaman prediksi panen                               |
| Monitoring fase pertumbuhan            | Ada halaman Growth Monitoring                                  |
| Rantai jadwal dan masa toleransi        | Form jadwal memuat interval, dasar tanggal penerus, dan masa toleransi |
| Penundaan bertanggal                    | Form tunda memuat pilihan tanggal rencana pengerjaan ulang     |
| Tugas dilepas                           | Jadwal tanpa tugas aktif memakai penanda "Belum ada pekerja" yang sudah ada |
| Laporan operasional                    | Ada halaman laporan operasional dan tindak lanjut              |
| Worker management                      | Ada halaman Worker Management                                  |
| Role berbeda                           | Navigasi owner dan worker dipisahkan                           |
| Input minim teks                       | Form menggunakan pilihan kategori/status                       |
| Dashboard ringkas                      | Dashboard hanya berisi ringkasan penting                       |
| Rejected dan removed access            | Ada screen minimal untuk worker rejected dan removed           |
| Permanent delete pohon tidak masuk MVP | UI menggunakan archive/unarchive, bukan delete permanen        |
| Jadwal terkunci hanya oleh hasil kerja selesai | Aksi edit dan batalkan jadwal tetap hidup selama tugasnya baru tertunda |

---

# 8. Keputusan yang Berdampak pada Service Layer

| Keputusan                          | Dampak Service Layer                                                         |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| Supabase sebagai backend utama     | Service layer berinteraksi langsung dengan Supabase client                   |
| Tidak ada backend custom           | Logic frontend harus rapi dan tidak bercampur di screen                      |
| Role berdasarkan farm_members      | Auth guard dan service perlu membaca membership aktif                        |
| Worker management                  | Dibutuhkan `memberService` untuk join, approve, reject, remove               |
| Rantai jadwal berjalan sendiri     | Dibutuhkan RPC penyapu yang menandai jadwal terlewat dan membuat penerusnya  |
| Tugas dilepas saat keanggotaan berakhir | `memberService` melepas tugas terbuka sebelum mencabut keanggotaan      |
| Task bisa dari jadwal atau laporan | Dibutuhkan service atau RPC untuk membuat task dari sumber berbeda           |
| Activity lebih dari satu per task  | Dibutuhkan `careActivityService` atau fungsi terkait dalam `careTaskService` |
| Aktivitas terjadwal menautkan pohon | RPC penyelesaian tugas mengisi jembatan pohon dalam satu transaksi          |
| Riwayat pohon via view             | Dibutuhkan `historyService` untuk membaca `tree_history_view`                |
| Dashboard agregasi                 | Dibutuhkan `dashboardService`                                                |
| Owner melihat profil worker        | `memberService` harus memakai query, view, atau RPC yang sesuai RLS          |

---

# 9. Keputusan yang Berdampak pada Testing

| Keputusan                              | Dampak Testing                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Role owner dan worker dipisah          | Perlu test role access                                                                         |
| Worker pending/rejected/removed        | Perlu test status membership                                                                   |
| Rantai jadwal dan masa toleransi       | Perlu test pembuatan penerus, penandaan terlewat, dan rantai yang tetap maju setelah siklus terlewat |
| Penundaan bertanggal                   | Perlu test penolakan penundaan tanpa tanggal dan pergeseran tenggat                            |
| Tugas dilepas                          | Perlu test pelepasan pada kedua jalur keluar, penugasan ulang, dan kasus bergabung kembali     |
| Penguncian jadwal                      | Perlu test bahwa penundaan tidak mengunci jadwal, tetapi hasil kerja selesai tetap mengunci    |
| Tidak ada prediksi panen               | Perlu test bahwa sistem tidak menampilkan klaim prediksi                                       |
| Laporan operasional                    | Perlu test create report, update status, task follow-up                                        |
| Riwayat pohon                          | Perlu test timeline kondisi, fase, dan perawatan                                               |
| Dashboard agregasi                     | Perlu test jumlah data sesuai sumber                                                           |
| RLS Supabase                           | Perlu test akses antar role dan antar farm                                                     |
| Worker flow minim teks                 | Perlu test UX dasar worker                                                                     |
| Permanent delete pohon tidak masuk MVP | Perlu test archive/unarchive pohon                                                             |
| Owner melihat profil worker            | Perlu test owner dapat melihat member satu kebun tetapi tidak dapat melihat user di luar kebun |
| Growth phase critical                  | Perlu test pencatatan fase dan update `current_growth_phase`                                   |

---

# 10. Cara Menggunakan Decision Log

Decision log harus digunakan ketika:

1. Ada perubahan scope fitur.
2. Ada fitur yang ingin ditambahkan.
3. Ada fitur yang ingin dihapus.
4. Ada perubahan desain database besar.
5. Ada perubahan alur owner atau worker.
6. Ada perubahan metode testing.
7. Ada pertanyaan dosen terkait alasan fitur.
8. Ada konflik antara implementasi dan dokumen requirement.
9. Ada konflik antara ERD, logical schema, SQL schema, service layer, screen inventory, dan iteration planning.

Jika ada perubahan baru, tambahkan decision log baru dengan ID berikutnya.

Contoh:

```txt
DL-031 Mengubah Target Jadwal Baris/Kolom Menjadi Area Custom
```

Atau:

```txt
DL-040 Menunda Edit Profile dari MVP Dasar ke Pengembangan Lanjutan
```

---

# 11. Template Decision Log Baru

Gunakan template berikut jika ada keputusan baru.

```txt
## DL-XXX Judul Keputusan

### Tanggal

[Tanggal keputusan]

### Latar Belakang

[Jelaskan masalah atau alasan munculnya keputusan]

### Keputusan

[Jelaskan keputusan yang diambil]

### Alasan

[Jelaskan alasan utama keputusan]

### Dampak

[Jelaskan dampak ke requirement, scope, database, UI, service, testing, atau dokumentasi]

### Status

Accepted / Revised / Deprecated / Rejected
```

---

# 12. Kesimpulan

Decision log Avology V2 mencatat keputusan-keputusan utama yang menjaga pengembangan sistem tetap fokus pada kebutuhan MVP.

Keputusan penting dalam Avology V2 meliputi reset project, pembatasan scope MVP, penghapusan prediksi panen otomatis, penggantian estimasi panen menjadi monitoring fase, pencabutan fitur SOP perawatan beserta target baris dan kolom, rantai jadwal berulang yang berjalan sendiri beserta masa toleransi keterlambatan, penundaan tugas yang wajib bertanggal, penautan pohon pada realisasi tugas terjadwal, pelepasan tugas saat keanggotaan berakhir, penguncian jadwal yang hanya berlaku bagi hasil kerja yang selesai, penambahan laporan operasional, manajemen worker, pemisahan role owner-worker, penggunaan Supabase sebagai backend MVP, penggunaan archive untuk pohon, dan penguatan growth phase sebagai fitur critical.

Dengan decision log ini, setiap keputusan dalam pengembangan Avology V2 dapat dipertanggungjawabkan secara teknis dan akademik.
