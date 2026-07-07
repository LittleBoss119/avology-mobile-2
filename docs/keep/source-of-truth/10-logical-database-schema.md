# Logical Database Schema Avology V2

## 1. Tujuan Logical Database Schema

Logical database schema digunakan untuk menerjemahkan data model konseptual Avology V2 menjadi rancangan tabel yang lebih dekat dengan implementasi database.

Schema ini disusun berdasarkan:

1. MVP Scope
2. Kebutuhan fungsional
3. User story
4. Use case
5. Activity diagram
6. ERD konseptual

Schema ini belum wajib menjadi SQL final, tetapi menjadi acuan utama sebelum implementasi database di Supabase/PostgreSQL.

---

# 2. Prinsip Logical Schema

Perancangan schema Avology V2 menggunakan prinsip berikut:

1. Setiap data operasional utama harus memiliki `farm_id`.
2. Role pengguna tidak disimpan langsung di tabel profil, tetapi melalui tabel `farm_members`.
3. Worker yang dikeluarkan tidak dihapus permanen, tetapi diberi status `removed`.
4. Pohon yang tidak aktif lebih baik diarsipkan daripada dihapus permanen.
5. Data historis seperti kondisi pohon, fase pertumbuhan, laporan, tugas, dan aktivitas tidak boleh mudah hilang.
6. SOP hanya menjadi template standar perawatan, bukan dokumen panjang.
7. Interval SOP digunakan untuk menghitung acuan jadwal berikutnya, bukan membuat tugas otomatis penuh tanpa konfirmasi owner.
8. Dashboard tidak memiliki tabel sendiri, tetapi mengambil ringkasan dari tabel operasional.
9. Riwayat pohon dapat dibentuk dari gabungan laporan kondisi, fase pertumbuhan, dan aktivitas perawatan.
10. Setiap tabel penting memiliki `created_at` dan jika perlu `updated_at`.

---

# 3. Daftar Enum

Enum digunakan agar nilai status dan kategori tetap konsisten. Ini penting supaya nanti database tidak diisi status seperti `selesai`, `Selesai`, `done`, `kelar`, dan “udah bang”, karena manusia memang berbakat membuat kekacauan dari pilihan bebas.

---

## 3.1 `member_role`

Digunakan pada tabel `farm_members`.

| Nilai  | Keterangan    |
| ------ | ------------- |
| owner  | Pemilik kebun |
| worker | Pekerja kebun |

---

## 3.2 `member_status`

Digunakan pada tabel `farm_members`.

| Nilai    | Keterangan                                           |
| -------- | ---------------------------------------------------- |
| pending  | Worker mengajukan bergabung dan menunggu persetujuan |
| active   | Worker aktif dan dapat mengakses kebun               |
| rejected | Pengajuan worker ditolak                             |
| removed  | Worker dikeluarkan dari kebun                        |

---

## 3.3 `tree_condition_status`

Digunakan pada tabel `trees` dan `tree_condition_reports`.

| Nilai             | Keterangan                 |
| ----------------- | -------------------------- |
| healthy           | Pohon sehat                |
| needs_attention   | Pohon perlu perhatian      |
| pest_attacked     | Pohon terserang hama       |
| disease_indicated | Pohon terindikasi penyakit |
| damaged           | Pohon rusak                |
| dead              | Pohon mati                 |

---

## 3.4 `growth_phase`

Digunakan pada tabel `trees` dan `growth_phase_records`.

| Nilai            | Keterangan |
| ---------------- | ---------- |
| initial_planting | Awal tanam |
| vegetative       | Vegetatif  |
| flowering        | Berbunga   |
| fruiting         | Berbuah    |
| harvesting       | Panen      |

---

## 3.5 `operational_report_category`

Digunakan pada tabel `operational_reports`.

| Nilai             | Keterangan                 |
| ----------------- | -------------------------- |
| land_damage       | Kerusakan lahan            |
| broken_tool       | Alat rusak                 |
| out_of_stock      | Stok habis                 |
| area_pest_disease | Hama atau penyakit area    |
| disaster_weather  | Bencana atau cuaca ekstrem |
| worker_need       | Kebutuhan pekerja          |
| other             | Lainnya                    |

---

## 3.6 `operational_report_status`

Digunakan pada tabel `operational_reports`.

| Nilai       | Keterangan              |
| ----------- | ----------------------- |
| new         | Laporan baru            |
| in_progress | Laporan sedang diproses |
| resolved    | Laporan selesai         |
| rejected    | Laporan ditolak         |

---

## 3.7 `care_category`

Digunakan pada tabel `care_sops`, `care_schedules`, dan `care_tasks`.

| Nilai       | Keterangan         |
| ----------- | ------------------ |
| watering    | Penyiraman         |
| fertilizing | Pemupukan          |
| spraying    | Penyemprotan       |
| weeding     | Pengendalian gulma |
| other       | Lainnya            |

---

## 3.8 `target_type`

Digunakan untuk target SOP, jadwal, dan tugas. Pada MVP, `custom` hanya digunakan untuk jadwal dan tugas, bukan untuk default target SOP.

| Nilai  | Keterangan                         |
| ------ | ---------------------------------- |
| farm   | Seluruh kebun                      |
| row    | Baris tertentu                     |
| column | Kolom tertentu                     |
| tree   | Pohon tertentu                     |
| custom | Target bebas atau deskripsi manual, khusus jadwal dan tugas |

---

## 3.9 `task_status`

Digunakan pada tabel `care_tasks`.

| Nilai     | Keterangan    |
| --------- | ------------- |
| pending   | Belum selesai |
| completed | Selesai       |
| postponed | Tertunda      |

---

## 3.10 `activity_status`

Digunakan pada tabel `care_activities`.

| Nilai     | Keterangan         |
| --------- | ------------------ |
| completed | Aktivitas selesai  |
| postponed | Aktivitas tertunda |

---

# 4. Tabel `profiles`

## Fungsi

Tabel `profiles` menyimpan data profil dasar pengguna. Untuk implementasi Supabase, tabel ini terhubung dengan `auth.users`.

## Struktur Tabel

| Kolom      | Tipe Data   | Constraint              | Keterangan                |
| ---------- | ----------- | ----------------------- | ------------------------- |
| id         | uuid        | PK, FK ke auth.users.id | ID pengguna               |
| full_name  | text        | not null                | Nama pengguna             |
| phone      | text        | nullable                | Nomor telepon             |
| created_at | timestamptz | default now()           | Tanggal profil dibuat     |
| updated_at | timestamptz | nullable                | Tanggal profil diperbarui |

## Catatan

Role tidak disimpan di tabel `profiles`, karena role pengguna ditentukan berdasarkan keanggotaannya pada tabel `farm_members`.

---

# 5. Tabel `farms`

## Fungsi

Tabel `farms` menyimpan data kebun.

## Struktur Tabel

| Kolom      | Tipe Data   | Constraint        | Keterangan               |
| ---------- | ----------- | ----------------- | ------------------------ |
| id         | uuid        | PK                | ID kebun                 |
| name       | text        | not null          | Nama kebun               |
| location   | text        | nullable          | Lokasi kebun             |
| area_size  | numeric     | nullable          | Luas kebun               |
| join_code  | text        | unique, not null  | Kode bergabung worker    |
| created_by | uuid        | FK ke profiles.id | Owner pembuat kebun      |
| created_at | timestamptz | default now()     | Tanggal kebun dibuat     |
| updated_at | timestamptz | nullable          | Tanggal kebun diperbarui |

## Catatan

Untuk MVP, satu owner dapat dibatasi hanya memiliki satu kebun aktif. Namun secara struktur, tabel ini tetap memungkinkan pengembangan multi-kebun di masa depan.

---

# 6. Tabel `farm_members`

## Fungsi

Tabel `farm_members` menyimpan relasi antara pengguna dan kebun, termasuk role dan status keanggotaan.

## Struktur Tabel

| Kolom      | Tipe Data     | Constraint                  | Keterangan                |
| ---------- | ------------- | --------------------------- | ------------------------- |
| id         | uuid          | PK                          | ID keanggotaan            |
| farm_id    | uuid          | FK ke farms.id, not null    | ID kebun                  |
| user_id    | uuid          | FK ke profiles.id, not null | ID pengguna               |
| role       | member_role   | not null                    | Role pengguna             |
| status     | member_status | not null                    | Status keanggotaan        |
| joined_at  | timestamptz   | nullable                    | Tanggal diterima aktif    |
| created_at | timestamptz   | default now()               | Tanggal pengajuan dibuat  |
| updated_at | timestamptz   | nullable                    | Tanggal status diperbarui |

## Constraint yang Disarankan

| Constraint                            | Tujuan                                                        |
| ------------------------------------- | ------------------------------------------------------------- |
| unique(farm_id, user_id)              | Mencegah pengguna yang sama masuk dua kali ke kebun yang sama |
| status default `pending` untuk worker | Worker harus menunggu approval owner                          |
| role owner otomatis active            | Owner langsung aktif saat membuat kebun                       |

## Catatan

Saat owner mengeluarkan worker, data tidak dihapus. Sistem mengubah `status` menjadi `removed`.

---

# 7. Tabel `trees`

## Fungsi

Tabel `trees` menyimpan data pohon alpukat secara individual.

## Struktur Tabel

| Kolom                | Tipe Data             | Constraint               | Keterangan               |
| -------------------- | --------------------- | ------------------------ | ------------------------ |
| id                   | uuid                  | PK                       | ID pohon                 |
| farm_id              | uuid                  | FK ke farms.id, not null | ID kebun                 |
| tree_code            | text                  | not null                 | Kode atau nomor pohon    |
| row_position         | text                  | nullable                 | Posisi baris             |
| column_position      | text                  | nullable                 | Posisi kolom             |
| variety              | text                  | nullable                 | Varietas pohon           |
| planted_at           | date                  | nullable                 | Tanggal tanam            |
| current_condition    | tree_condition_status | default healthy          | Kondisi terbaru          |
| current_growth_phase | growth_phase          | nullable                 | Fase pertumbuhan terbaru |
| is_archived          | boolean               | default false            | Status arsip             |
| created_at           | timestamptz           | default now()            | Tanggal data dibuat      |
| updated_at           | timestamptz           | nullable                 | Tanggal data diperbarui  |

## Constraint yang Disarankan

| Constraint                 | Tujuan                                          |
| -------------------------- | ----------------------------------------------- |
| unique(farm_id, tree_code) | Mencegah kode pohon ganda dalam kebun yang sama |

## Catatan

`current_condition` dan `current_growth_phase` adalah ringkasan kondisi terbaru. Riwayat lengkapnya tetap disimpan di tabel `tree_condition_reports` dan `growth_phase_records`.

---

# 8. Tabel `tree_condition_reports`

## Fungsi

Tabel `tree_condition_reports` menyimpan riwayat laporan kondisi pohon.

## Struktur Tabel

| Kolom            | Tipe Data             | Constraint                  | Keterangan            |
| ---------------- | --------------------- | --------------------------- | --------------------- |
| id               | uuid                  | PK                          | ID laporan kondisi    |
| farm_id          | uuid                  | FK ke farms.id, not null    | ID kebun              |
| tree_id          | uuid                  | FK ke trees.id, not null    | ID pohon              |
| reported_by      | uuid                  | FK ke profiles.id, not null | Pengguna yang melapor |
| condition_status | tree_condition_status | not null                    | Status kondisi pohon  |
| note             | text                  | nullable                    | Catatan singkat       |
| reported_at      | timestamptz           | default now()               | Waktu laporan dibuat  |

## Catatan

Setiap laporan kondisi yang dibuat akan memperbarui `current_condition` pada tabel `trees`. Pembaruan ini bisa dilakukan melalui logic aplikasi atau database trigger.

---

# 9. Tabel `operational_reports`

## Fungsi

Tabel `operational_reports` menyimpan laporan operasional kebun yang tidak selalu berkaitan dengan pohon individual.

## Struktur Tabel

| Kolom         | Tipe Data                   | Constraint                  | Keterangan                 |
| ------------- | --------------------------- | --------------------------- | -------------------------- |
| id            | uuid                        | PK                          | ID laporan operasional     |
| farm_id       | uuid                        | FK ke farms.id, not null    | ID kebun                   |
| reported_by   | uuid                        | FK ke profiles.id, not null | Worker pelapor             |
| category      | operational_report_category | not null                    | Kategori laporan           |
| location_note | text                        | nullable                    | Catatan lokasi             |
| description   | text                        | nullable                    | Deskripsi laporan          |
| status        | operational_report_status   | default new                 | Status laporan             |
| created_at    | timestamptz                 | default now()               | Tanggal laporan dibuat     |
| updated_at    | timestamptz                 | nullable                    | Tanggal laporan diperbarui |

## Catatan

Laporan operasional dapat ditindaklanjuti menjadi tugas worker melalui tabel `care_tasks`.

---

# 10. Tabel `care_sops`

## Fungsi

Tabel `care_sops` menyimpan template SOP perawatan.

## Struktur Tabel

| Kolom                  | Tipe Data     | Constraint                  | Keterangan                    |
| ---------------------- | ------------- | --------------------------- | ----------------------------- |
| id                     | uuid          | PK                          | ID SOP                        |
| farm_id                | uuid          | FK ke farms.id, not null    | ID kebun                      |
| name                   | text          | not null                    | Nama SOP                      |
| category               | care_category | not null                    | Kategori SOP                  |
| interval_days          | integer       | nullable                    | Interval perawatan dalam hari |
| default_instruction    | text          | nullable                    | Instruksi default             |
| default_target_type    | target_type   | default farm                | Target default                |
| default_target_row     | text          | nullable                    | Target baris default          |
| default_target_column  | text          | nullable                    | Target kolom default          |
| default_target_tree_id | uuid          | FK ke trees.id, nullable    | Target pohon default          |
| is_active              | boolean       | default true                | Status aktif SOP              |
| created_by             | uuid          | FK ke profiles.id, not null | Owner pembuat SOP             |
| created_at             | timestamptz   | default now()               | Tanggal SOP dibuat            |
| updated_at             | timestamptz   | nullable                    | Tanggal SOP diperbarui        |

## Constraint yang Disarankan

| Constraint                                    | Tujuan                                           |
| --------------------------------------------- | ------------------------------------------------ |
| interval_days > 0                             | Interval tidak boleh nol atau negatif jika diisi |
| target_tree_id wajib jika target_type = tree  | Menjaga konsistensi target pohon                 |
| target_row wajib jika target_type = row       | Menjaga konsistensi target baris                 |
| target_column wajib jika target_type = column | Menjaga konsistensi target kolom                 |
| default_target_type tidak boleh custom        | Default target SOP hanya memakai target terstruktur |

## Catatan

SOP tidak membuat tugas otomatis penuh. SOP hanya menyediakan template dan interval untuk membantu owner membuat jadwal berikutnya secara semi-otomatis.

---

# 11. Tabel `care_schedules`

## Fungsi

Tabel `care_schedules` menyimpan jadwal perawatan yang dibuat owner.

## Struktur Tabel

| Kolom              | Tipe Data     | Constraint                   | Keterangan                              |
| ------------------ | ------------- | ---------------------------- | --------------------------------------- |
| id                 | uuid          | PK                           | ID jadwal                               |
| farm_id            | uuid          | FK ke farms.id, not null     | ID kebun                                |
| care_sop_id        | uuid          | FK ke care_sops.id, nullable | SOP terkait jika jadwal dibuat dari SOP |
| title              | text          | not null                     | Judul jadwal                            |
| category           | care_category | not null                     | Kategori jadwal                         |
| scheduled_date     | date          | not null                     | Tanggal jadwal                          |
| target_type        | target_type   | not null                     | Jenis target jadwal                     |
| target_row         | text          | nullable                     | Target baris                            |
| target_column      | text          | nullable                     | Target kolom                            |
| target_tree_id     | uuid          | FK ke trees.id, nullable     | Target pohon                            |
| custom_target_note | text          | nullable                     | Target custom                           |
| instruction        | text          | nullable                     | Instruksi jadwal                        |
| created_by         | uuid          | FK ke profiles.id, not null  | Owner pembuat jadwal                    |
| created_at         | timestamptz   | default now()                | Tanggal jadwal dibuat                   |
| updated_at         | timestamptz   | nullable                     | Tanggal jadwal diperbarui               |

## Constraint yang Disarankan

| Constraint                                         | Tujuan                |
| -------------------------------------------------- | --------------------- |
| target_tree_id wajib jika target_type = tree       | Menjaga target pohon  |
| target_row wajib jika target_type = row            | Menjaga target baris  |
| target_column wajib jika target_type = column      | Menjaga target kolom  |
| custom_target_note wajib jika target_type = custom | Menjaga target custom |
| care_sop_id harus kosong jika target_type = custom | Membatasi custom hanya untuk jadwal manual |
| custom_target_note kosong jika target_type bukan custom | Mencegah target campuran |

## Catatan

Jadwal dapat dibuat dari SOP atau secara manual. Jika `care_sop_id` kosong, maka jadwal dianggap jadwal manual.

---

# 12. Tabel `care_tasks`

## Fungsi

Tabel `care_tasks` menyimpan tugas yang diberikan kepada worker.

Tugas dapat berasal dari:

1. Jadwal perawatan.
2. Tindak lanjut laporan operasional.

## Struktur Tabel

| Kolom                 | Tipe Data     | Constraint                             | Keterangan                     |
| --------------------- | ------------- | -------------------------------------- | ------------------------------ |
| id                    | uuid          | PK                                     | ID tugas                       |
| farm_id               | uuid          | FK ke farms.id, not null               | ID kebun                       |
| care_schedule_id      | uuid          | FK ke care_schedules.id, nullable      | Jadwal asal tugas              |
| operational_report_id | uuid          | FK ke operational_reports.id, nullable | Laporan operasional asal tugas |
| assigned_to           | uuid          | FK ke profiles.id, not null            | Worker penerima tugas          |
| assigned_by           | uuid          | FK ke profiles.id, not null            | Owner pemberi tugas            |
| title                 | text          | not null                               | Judul tugas                    |
| category              | care_category | nullable                               | Kategori tugas                 |
| instruction           | text          | nullable                               | Instruksi tugas                |
| target_type           | target_type   | not null                               | Jenis target tugas             |
| target_row            | text          | nullable                               | Target baris                   |
| target_column         | text          | nullable                               | Target kolom                   |
| target_tree_id        | uuid          | FK ke trees.id, nullable               | Target pohon                   |
| custom_target_note    | text          | nullable                               | Target custom                  |
| due_date              | date          | not null                               | Tanggal pelaksanaan tugas      |
| status                | task_status   | default pending                        | Status tugas                   |
| created_at            | timestamptz   | default now()                          | Tanggal tugas dibuat           |
| updated_at            | timestamptz   | nullable                               | Tanggal tugas diperbarui       |

## Constraint yang Disarankan

| Constraint                                                                          | Tujuan                                                   |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Minimal salah satu dari `care_schedule_id` atau `operational_report_id` boleh diisi | Menentukan sumber tugas                                  |
| assigned_to harus worker active pada farm terkait                                   | Mencegah tugas diberikan ke user yang bukan worker aktif |
| target_tree_id wajib jika target_type = tree                                        | Menjaga target pohon                                     |
| target_row wajib jika target_type = row                                             | Menjaga target baris                                     |
| target_column wajib jika target_type = column                                       | Menjaga target kolom                                     |
| custom_target_note wajib jika target_type = custom                                  | Menjaga target custom untuk tugas manual atau tindak lanjut |
| custom_target_note kosong jika target_type bukan custom                             | Mencegah target campuran                                 |

## Catatan

Tabel ini menyimpan status tugas terbaru. Perubahan status atau realisasi dicatat di tabel `care_activities`.

---

# 13. Tabel `care_activities`

## Fungsi

Tabel `care_activities` menyimpan aktivitas realisasi tugas worker.

## Revisi Kecil dari ERD Konseptual

Pada ERD konseptual awal, satu tugas digambarkan memiliki nol atau satu aktivitas. Dalam logical schema, relasi ini lebih baik dibuat:

```txt
CareTask 0..N CareActivity
```

Alasannya, satu tugas bisa mengalami lebih dari satu aktivitas, misalnya:

1. Worker menunda tugas hari ini.
2. Besok worker menyelesaikan tugas yang sama.

Kalau hanya satu aktivitas, riwayat penundaan bisa hilang. Dan kehilangan riwayat karena desain terlalu hemat adalah cara database menertawakan kita diam-diam.

## Struktur Tabel

| Kolom        | Tipe Data       | Constraint                    | Keterangan             |
| ------------ | --------------- | ----------------------------- | ---------------------- |
| id           | uuid            | PK                            | ID aktivitas           |
| farm_id      | uuid            | FK ke farms.id, not null      | ID kebun               |
| care_task_id | uuid            | FK ke care_tasks.id, not null | Tugas terkait          |
| performed_by | uuid            | FK ke profiles.id, not null   | Worker pelaksana       |
| status       | activity_status | not null                      | Status aktivitas       |
| note         | text            | nullable                      | Catatan realisasi      |
| performed_at | timestamptz     | default now()                 | Waktu aktivitas dibuat |

## Catatan

Jika tugas berkaitan dengan pohon tertentu, sistem dapat menampilkan aktivitas ini pada riwayat pohon berdasarkan `target_tree_id` pada `care_tasks`.

Dengan pendekatan ini, `care_activities` tidak menyimpan `tree_id` secara langsung pada MVP karena target pohon sudah ada pada `care_tasks`.

---

# 14. Tabel `growth_phase_records`

## Fungsi

Tabel `growth_phase_records` menyimpan riwayat fase pertumbuhan pohon.

## Struktur Tabel

| Kolom       | Tipe Data    | Constraint                  | Keterangan            |
| ----------- | ------------ | --------------------------- | --------------------- |
| id          | uuid         | PK                          | ID catatan fase       |
| farm_id     | uuid         | FK ke farms.id, not null    | ID kebun              |
| tree_id     | uuid         | FK ke trees.id, not null    | ID pohon              |
| recorded_by | uuid         | FK ke profiles.id, not null | User pencatat         |
| phase       | growth_phase | not null                    | Fase pertumbuhan      |
| note        | text         | nullable                    | Catatan singkat       |
| recorded_at | timestamptz  | default now()               | Waktu pencatatan fase |

## Catatan

Catatan fase terbaru dapat digunakan untuk memperbarui `current_growth_phase` pada tabel `trees`.

Sistem tidak melakukan prediksi panen otomatis. Data fase hanya digunakan sebagai acuan monitoring perkembangan pohon.

---

# 15. View `tree_history_view`

## Fungsi

`tree_history_view` bukan tabel wajib, tetapi disarankan sebagai view untuk menampilkan riwayat pohon secara terintegrasi.

View ini dapat menggabungkan data dari:

1. `tree_condition_reports`
2. `growth_phase_records`
3. `care_tasks`
4. `care_activities`

## Bentuk Data yang Ditampilkan

| Kolom        | Keterangan                            |
| ------------ | ------------------------------------- |
| tree_id      | ID pohon                              |
| farm_id      | ID kebun                              |
| history_type | Jenis riwayat: condition, phase, care |
| title        | Judul riwayat                         |
| description  | Deskripsi atau catatan                |
| actor_id     | User yang membuat aktivitas           |
| happened_at  | Tanggal kejadian                      |

## Catatan

View ini membantu halaman detail pohon menampilkan riwayat dalam satu timeline tanpa harus membuat tabel baru yang menduplikasi data.

---

# 16. Ringkasan Tabel Final

| Tabel                  | Fungsi                                  |
| ---------------------- | --------------------------------------- |
| profiles               | Menyimpan profil pengguna               |
| farms                  | Menyimpan data kebun                    |
| farm_members           | Menyimpan role dan status anggota kebun |
| trees                  | Menyimpan data pohon individual         |
| tree_condition_reports | Menyimpan riwayat kondisi pohon         |
| operational_reports    | Menyimpan laporan operasional kebun     |
| care_sops              | Menyimpan template SOP perawatan        |
| care_schedules         | Menyimpan jadwal perawatan              |
| care_tasks             | Menyimpan tugas worker                  |
| care_activities        | Menyimpan aktivitas realisasi tugas     |
| growth_phase_records   | Menyimpan riwayat fase pertumbuhan      |
| tree_history_view      | View untuk timeline riwayat pohon       |

---

# 17. Relasi Logical Schema

## 17.1 `profiles` ke `farm_members`

```txt
profiles.id 1..N farm_members.user_id
```

Satu pengguna dapat memiliki banyak keanggotaan kebun.

---

## 17.2 `farms` ke `farm_members`

```txt
farms.id 1..N farm_members.farm_id
```

Satu kebun dapat memiliki satu owner dan banyak worker.

---

## 17.3 `farms` ke `trees`

```txt
farms.id 1..N trees.farm_id
```

Satu kebun memiliki banyak pohon.

---

## 17.4 `trees` ke `tree_condition_reports`

```txt
trees.id 1..N tree_condition_reports.tree_id
```

Satu pohon memiliki banyak laporan kondisi.

---

## 17.5 `farms` ke `operational_reports`

```txt
farms.id 1..N operational_reports.farm_id
```

Satu kebun memiliki banyak laporan operasional.

---

## 17.6 `farms` ke `care_sops`

```txt
farms.id 1..N care_sops.farm_id
```

Satu kebun memiliki banyak SOP.

---

## 17.7 `care_sops` ke `care_schedules`

```txt
care_sops.id 1..N care_schedules.care_sop_id
```

Satu SOP dapat digunakan dalam banyak jadwal. Pada jadwal manual, `care_sop_id` boleh kosong.

---

## 17.8 `care_schedules` ke `care_tasks`

```txt
care_schedules.id 1..N care_tasks.care_schedule_id
```

Satu jadwal dapat menghasilkan satu atau lebih tugas.

---

## 17.9 `operational_reports` ke `care_tasks`

```txt
operational_reports.id 0..N care_tasks.operational_report_id
```

Satu laporan operasional dapat menghasilkan tugas tindak lanjut atau tidak menghasilkan tugas sama sekali.

---

## 17.10 `care_tasks` ke `care_activities`

```txt
care_tasks.id 0..N care_activities.care_task_id
```

Satu tugas dapat belum memiliki aktivitas, atau memiliki beberapa aktivitas, misalnya tertunda lalu selesai.

---

## 17.11 `trees` ke `growth_phase_records`

```txt
trees.id 1..N growth_phase_records.tree_id
```

Satu pohon memiliki banyak catatan fase pertumbuhan.

---

# 18. Index yang Disarankan

Index digunakan agar query penting lebih cepat.

| Tabel                  | Kolom                         | Tujuan                            |
| ---------------------- | ----------------------------- | --------------------------------- |
| farm_members           | farm_id, user_id              | Cek keanggotaan user dalam kebun  |
| farm_members           | farm_id, status               | Menampilkan worker pending/active |
| trees                  | farm_id                       | Menampilkan pohon per kebun       |
| trees                  | farm_id, is_archived          | Filter pohon aktif/arsip          |
| trees                  | farm_id, current_condition    | Dashboard kondisi pohon           |
| trees                  | farm_id, current_growth_phase | Dashboard fase berbunga/berbuah   |
| tree_condition_reports | tree_id, reported_at          | Riwayat kondisi pohon             |
| operational_reports    | farm_id, status               | Laporan baru/diproses             |
| care_sops              | farm_id, is_active            | SOP aktif per kebun               |
| care_schedules         | farm_id, scheduled_date       | Jadwal per tanggal                |
| care_tasks             | assigned_to, due_date         | Tugas worker hari ini             |
| care_tasks             | farm_id, status               | Dashboard tugas                   |
| care_activities        | care_task_id                  | Riwayat aktivitas tugas           |
| growth_phase_records   | tree_id, recorded_at          | Riwayat fase pohon                |

---

# 19. Aturan Update Otomatis yang Disarankan

Beberapa nilai ringkasan dapat diperbarui otomatis melalui logic aplikasi atau trigger database.

## 19.1 Update Kondisi Terbaru Pohon

Ketika data baru masuk ke `tree_condition_reports`, maka:

```txt
trees.current_condition = tree_condition_reports.condition_status terbaru
```

## 19.2 Update Fase Terbaru Pohon

Ketika data baru masuk ke `growth_phase_records`, maka:

```txt
trees.current_growth_phase = growth_phase_records.phase terbaru
```

## 19.3 Update Status Tugas

Ketika worker membuat aktivitas pada `care_activities`, maka:

```txt
care_tasks.status = care_activities.status terbaru
```

## 19.4 Update Status Laporan Operasional

Jika owner membuat tugas dari laporan operasional, maka:

```txt
operational_reports.status = in_progress
```

Jika tugas tindak lanjut selesai, owner dapat mengubah laporan menjadi:

```txt
resolved
```

---

# 20. Draft RLS Policy secara Konseptual

Karena implementasi menggunakan Supabase, Row Level Security perlu dirancang sejak awal.

## 20.1 Prinsip RLS

1. User hanya dapat melihat data dari kebun tempat ia menjadi anggota active.
2. Owner dapat mengelola data kebun tempat ia berstatus owner active.
3. Worker hanya dapat mengakses fitur operasional yang diizinkan.
4. Worker pending, rejected, atau removed tidak dapat mengakses data operasional kebun.
5. Data antar kebun tidak boleh saling terlihat.
6. Owner dapat melihat profil dasar worker yang berada dalam farm yang sama melalui RLS policy, view, atau RPC yang aman.

---

## 20.2 Akses Owner

Owner dapat:

* melihat dan mengubah data kebun miliknya
* menerima, menolak, dan mengeluarkan worker
* mengelola data pohon
* mengelola SOP
* membuat jadwal
* membuat tugas
* melihat laporan operasional
* mengubah status laporan
* melihat dashboard

---

## 20.3 Akses Worker

Worker dapat:

* melihat data pohon pada kebun tempat ia aktif
* mencatat kondisi pohon
* mencatat fase pertumbuhan pohon
* membuat laporan operasional
* melihat tugas miliknya
* memperbarui status tugas miliknya
* melihat dashboard worker

Worker tidak dapat:

* menghapus kebun
* mengelola worker
* mengelola SOP
* membuat jadwal utama
* mengakses data kebun lain
* mengakses kebun setelah statusnya removed

---

# 21. Catatan Implementasi Target

Untuk target seperti kebun, baris, kolom, dan pohon, schema menggunakan kombinasi:

```txt
target_type
target_row
target_column
target_tree_id
custom_target_note
```

Alasan tidak menggunakan satu kolom `target_value` saja:

1. Lebih jelas secara struktur.
2. Target pohon bisa menggunakan foreign key.
3. Target baris dan kolom tetap fleksibel.
4. Lebih mudah divalidasi.
5. Lebih mudah dipakai pada query.

Contoh:

## Target seluruh kebun

```txt
target_type = farm
target_row = null
target_column = null
target_tree_id = null
```

## Target baris tertentu

```txt
target_type = row
target_row = "B"
target_column = null
target_tree_id = null
```

## Target kolom tertentu

```txt
target_type = column
target_row = null
target_column = "03"
target_tree_id = null
```

## Target pohon tertentu

```txt
target_type = tree
target_tree_id = id pohon
```

## Target custom

Contoh ini hanya berlaku untuk jadwal manual dan tugas manual/tindak lanjut, bukan untuk default target SOP atau jadwal dari SOP.

```txt
target_type = custom
custom_target_note = "Saluran air dekat area belakang kebun"
```

---

# 22. Catatan Penting tentang SOP Interval

Untuk menghitung acuan jadwal berikutnya, sistem mengambil data:

1. SOP yang dipilih
2. `interval_days`
3. realisasi terakhir dari tugas yang berasal dari SOP tersebut

Rumus:

```txt
tanggal realisasi terakhir + interval_days
```

Contoh:

```txt
SOP: Semprot Pencegahan
Interval: 14 hari
Realisasi terakhir: 1 Juni 2026
Acuan berikutnya: 15 Juni 2026
```

Sistem hanya menampilkan acuan dan status:

```txt
belum jatuh tempo
jatuh tempo hari ini
terlambat
```

Sistem tidak membuat tugas otomatis tanpa konfirmasi owner.

---

# 23. Batasan Logical Schema MVP

Logical schema MVP tidak mencakup tabel untuk:

1. Prediksi panen otomatis
2. Model machine learning
3. Push notification
4. IoT atau sensor
5. Cuaca
6. Chat owner-worker
7. Akuntansi lengkap
8. Laporan PDF otomatis
9. Integrated farming
10. Marketplace
11. Grading buah
12. Kelompok tani
13. Recurring task otomatis penuh
14. Peternakan
15. Supply chain restoran atau warung

Fitur-fitur tersebut dapat dipertimbangkan pada pengembangan lanjutan setelah MVP stabil dan data historis sudah terkumpul.

---

# 24. Ringkasan Keputusan Logical Schema

1. `profiles` menyimpan data pengguna.
2. `farms` menyimpan data kebun.
3. `farm_members` menentukan role dan status user dalam kebun.
4. `trees` menyimpan data pohon individual.
5. `tree_condition_reports` menyimpan riwayat kondisi pohon.
6. `operational_reports` menyimpan laporan umum kebun.
7. `care_sops` menyimpan template standar perawatan.
8. `care_schedules` menyimpan jadwal perawatan.
9. `care_tasks` menyimpan tugas worker.
10. `care_activities` menyimpan aktivitas realisasi tugas.
11. `growth_phase_records` menyimpan riwayat fase pertumbuhan.
12. `tree_history_view` dapat digunakan untuk menampilkan riwayat pohon secara terintegrasi.
13. Worker yang dikeluarkan menggunakan status `removed`, bukan delete permanen.
14. Pohon tidak aktif menggunakan `is_archived`.
15. SOP interval digunakan sebagai acuan jadwal berikutnya, bukan recurring otomatis penuh.
