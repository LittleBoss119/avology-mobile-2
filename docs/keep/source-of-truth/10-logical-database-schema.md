# Logical Database Schema Avology V2

> **Catatan perubahan (migrasi 046 & 047).** Tabel `care_sops` beserta relasinya
> dihapus, begitu juga kolom `target_row`/`target_column` pada `care_schedules`
> dan `care_tasks`. Nilai enum `target_type` menyusut menjadi `farm`, `tree`,
> `custom`. Kolom `care_tasks.category` menjadi `not null`, dan
> `care_schedules.repeat_every_days` ditambahkan sebagai interval pengulangan.
> Penomoran bab dan sub-bab dirapatkan. Kolom `row_position`/`column_position`
> pada tabel `trees` TIDAK terpengaruh. Riwayat keputusannya ada di
> `decision-log.md`.

> **Catatan perubahan (migrasi 048–052).** `care_schedules` bertambah
> `date_basis`, `grace_days`, `missed_at`, `series_id`, `parent_schedule_id`, dan
> `is_cancelled`; `care_tasks` bertambah `missed_at`, `released_at`, dan
> `released_reason`; `care_activities` bertambah `postponed_until`. Tabel
> jembatan `care_activity_trees` ditambahkan sebagai bab 13 — tabel ini sudah ada
> di database sejak migrasi 025 tetapi belum pernah masuk dokumen, dan migrasi
> 050 menjadikannya satu-satunya jalan aktivitas perawatan masuk ke riwayat
> pohon. Bab 13 sampai 24 karena itu bergeser satu nomor. Riwayat keputusannya
> ada di `decision-log.md` (DL-034 sampai DL-038).

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
6. Jadwal perawatan dibuat manual oleh owner, tanpa tabel template terpisah.
7. Interval pengulangan pada jadwal membentuk rantai jadwal penerus yang dihitung sistem saat aplikasi membaca data, tanpa penjadwal yang berjalan di luar aplikasi.
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

Digunakan pada tabel `care_schedules` dan `care_tasks`.

| Nilai       | Keterangan         |
| ----------- | ------------------ |
| watering    | Penyiraman         |
| fertilizing | Pemupukan          |
| spraying    | Penyemprotan       |
| weeding     | Pengendalian gulma |
| other       | Lainnya            |

---

## 3.8 `target_type`

Digunakan untuk target jadwal dan tugas.

| Nilai  | Keterangan                         |
| ------ | ---------------------------------- |
| farm   | Seluruh kebun                      |
| tree   | Pohon tertentu                     |
| custom | Target bebas atau deskripsi manual |

Nilai `row` dan `column` sudah dicabut di migrasi 047. Keduanya masih ada di
tipe enum PostgreSQL karena `alter type ... drop value` tidak tersedia, tetapi
ditutup oleh CHECK constraint pada `care_schedules` dan `care_tasks` sehingga
tidak dapat lagi tersimpan.

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

# 10. Tabel `care_schedules`

## Fungsi

Tabel `care_schedules` menyimpan jadwal perawatan yang dibuat owner.

## Struktur Tabel

| Kolom              | Tipe Data     | Constraint                   | Keterangan                              |
| ------------------ | ------------- | ---------------------------- | --------------------------------------- |
| id                 | uuid          | PK                           | ID jadwal                               |
| farm_id            | uuid          | FK ke farms.id, not null     | ID kebun                                |
| title              | text          | not null                     | Judul jadwal                            |
| category           | care_category | not null                     | Kategori jadwal                         |
| scheduled_date     | date          | not null                     | Tanggal jadwal                          |
| target_type        | target_type   | not null                     | Jenis target jadwal                     |
| target_tree_id     | uuid          | FK ke trees.id, nullable     | Target pohon                            |
| custom_target_note | text          | nullable                     | Target custom                           |
| instruction        | text          | nullable                     | Instruksi jadwal                        |
| repeat_every_days  | integer       | nullable                     | Interval pengulangan dalam hari         |
| date_basis         | text          | not null, default `jadwal`   | Dasar tanggal penerus: `jadwal` atau `realisasi` |
| grace_days         | integer       | nullable                     | Masa toleransi keterlambatan dalam hari |
| missed_at          | timestamptz   | nullable                     | Waktu jadwal dinyatakan terlewat        |
| series_id          | uuid          | nullable                     | Penanda satu rantai pengulangan         |
| parent_schedule_id | uuid          | FK ke care_schedules.id, nullable | Jadwal pendahulu dalam rantai      |
| is_cancelled       | boolean       | not null, default false      | Penanda jadwal dibatalkan owner         |
| created_by         | uuid          | FK ke profiles.id, not null  | Owner pembuat jadwal                    |
| created_at         | timestamptz   | default now()                | Tanggal jadwal dibuat                   |
| updated_at         | timestamptz   | nullable                     | Tanggal jadwal diperbarui               |

## Constraint yang Disarankan

| Constraint                                         | Tujuan                |
| -------------------------------------------------- | --------------------- |
| target_type hanya boleh farm, tree, atau custom    | Menutup nilai enum row/column yang sudah dicabut |
| target_tree_id wajib jika target_type = tree       | Menjaga target pohon  |
| custom_target_note wajib jika target_type = custom | Menjaga target custom |
| custom_target_note kosong jika target_type bukan custom | Mencegah target campuran |
| repeat_every_days > 0 jika diisi                   | Interval tidak boleh nol atau negatif |
| date_basis hanya boleh `jadwal` atau `realisasi`   | Menutup nilai dasar tanggal yang tidak dikenal |
| grace_days >= 0 jika diisi                         | Nol berarti terlewat begitu lewat tanggal; negatif tidak bermakna |

## Catatan

Siklus pertama sebuah jadwal dibuat manual oleh owner. Jadwal yang mengisi `repeat_every_days` membentuk rantai: begitu siklus berjalan ditutup, sistem membuat jadwal penerusnya sendiri tanpa menunggu konfirmasi owner.

Seluruh siklus dalam satu rantai berbagi `series_id` yang sama, dan setiap penerus menunjuk pendahulunya lewat `parent_schedule_id`. Dalam satu rantai hanya boleh ada satu jadwal terbuka pada satu waktu.

`grace_days` menentukan berapa lama keterlambatan masih ditoleransi. Jadwal yang melewati batas itu diberi `missed_at` dan rantainya dilanjutkan ke siklus berikutnya. Jadwal tanpa `grace_days` tidak pernah dinyatakan terlewat.

Penandaan terlewat dan pembentukan penerus dihitung saat aplikasi membaca data, bukan oleh penjadwal yang berjalan di luar aplikasi.

---

# 11. Tabel `care_tasks`

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
| category              | care_category | not null                               | Kategori tugas                 |
| instruction           | text          | nullable                               | Instruksi tugas                |
| target_type           | target_type   | not null                               | Jenis target tugas             |
| target_tree_id        | uuid          | FK ke trees.id, nullable               | Target pohon                   |
| custom_target_note    | text          | nullable                               | Target custom                  |
| due_date              | date          | not null                               | Tanggal pelaksanaan tugas, ikut bergeser saat tugas ditunda |
| status                | task_status   | default pending                        | Status tugas                   |
| missed_at             | timestamptz   | nullable                               | Waktu tugas dinyatakan terlewat |
| released_at           | timestamptz   | nullable                               | Waktu tugas dilepas karena pekerjanya berhenti aktif |
| released_reason       | text          | nullable                               | Sebab pelepasan: `removed_by_owner` atau `left_by_worker` |
| created_at            | timestamptz   | default now()                          | Tanggal tugas dibuat           |
| updated_at            | timestamptz   | nullable                               | Tanggal tugas diperbarui       |

## Constraint yang Disarankan

| Constraint                                                                          | Tujuan                                                   |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Minimal salah satu dari `care_schedule_id` atau `operational_report_id` boleh diisi | Menentukan sumber tugas                                  |
| assigned_to harus worker active pada farm terkait                                   | Mencegah tugas diberikan ke user yang bukan worker aktif |
| target_tree_id wajib jika target_type = tree                                        | Menjaga target pohon                                     |
| custom_target_note wajib jika target_type = custom                                  | Menjaga target custom untuk tugas manual atau tindak lanjut |
| custom_target_note kosong jika target_type bukan custom                             | Mencegah target campuran                                 |
| released_at dan released_reason harus terisi bersama atau kosong bersama            | Pelepasan selalu punya waktu dan sebab                   |
| released_reason hanya boleh `removed_by_owner` atau `left_by_worker`                | Menyamakan kosakata dengan sebab keluarnya keanggotaan   |

## Catatan

Tabel ini menyimpan status tugas terbaru. Perubahan status atau realisasi dicatat di tabel `care_activities`.

`missed_at` dan `released_at` bukan nilai `status`, melainkan penanda terpisah, dan sebabnya sengaja tidak disatukan. **Terlewat** berarti tenggat beserta masa toleransinya habis. **Dilepas** berarti pekerjanya berhenti aktif sehingga tugas itu tidak lagi menjadi tanggungan siapa pun; pekerjaannya sendiri belum tentu terlambat.

Tugas dinyatakan terbuka bila statusnya `pending` atau `postponed`, `missed_at` kosong, dan `released_at` kosong. Definisi inilah yang dipakai seluruh penghitung tunggakan, penyapu jadwal terlewat, dan pemeriksaan "jadwal ini masih punya tugas aktif".

Tugas yang sudah dilepas tidak dapat diperbarui lagi selama pemiliknya belum aktif kembali, karena validasi tugas mensyaratkan penerima tugas adalah worker aktif.

---

# 12. Tabel `care_activities`

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
| postponed_until | date         | nullable                      | Tanggal rencana pengerjaan ulang |
| performed_at | timestamptz     | default now()                 | Waktu aktivitas dibuat |

## Constraint yang Disarankan

| Constraint                                                              | Tujuan                                            |
| ----------------------------------------------------------------------- | ------------------------------------------------- |
| postponed_until wajib diisi jika status = postponed                     | Penundaan harus menyebut kapan akan dikerjakan    |
| postponed_until wajib kosong jika status = completed                    | Pekerjaan yang selesai tidak punya tanggal tunda  |

## Catatan

Pohon yang dirawat TIDAK disimpan pada tabel ini, melainkan pada tabel jembatan `care_activity_trees`. Satu perawatan dapat berdampak pada banyak pohon sekaligus, sehingga hubungannya banyak-ke-banyak dan tidak dapat diwakili satu kolom `tree_id`.

Penundaan wajib menyebut `postponed_until`, dan tanggal itu juga menggeser `care_tasks.due_date` sehingga masa toleransi jadwal dihitung ulang dari tanggal baru tersebut.

Satu tugas hanya boleh memiliki satu aktivitas berstatus `completed`. Perbaikan catatan dilakukan dengan menyunting aktivitas terakhir, bukan dengan menambah baris baru.

---

# 13. Tabel `care_activity_trees`

## Fungsi

Tabel `care_activity_trees` adalah jembatan yang mencatat pohon mana saja yang terdampak oleh satu aktivitas perawatan.

## Struktur Tabel

| Kolom            | Tipe Data | Constraint                         | Keterangan                  |
| ---------------- | --------- | ---------------------------------- | --------------------------- |
| care_activity_id | uuid      | FK ke care_activities.id, not null | Aktivitas perawatan terkait |
| tree_id          | uuid      | FK ke trees.id, not null           | Pohon yang terdampak        |

Primary key gabungan `(care_activity_id, tree_id)`.

## Catatan

Jembatan ini terisi dari dua jalur:

1. **Pencatatan inisiatif** — pelaku memilih sendiri pohon yang dirawat.
2. **Realisasi tugas terjadwal** — pohon diturunkan dari target tugas saat tugas diselesaikan: target `tree` menautkan satu pohon, target `farm` menautkan seluruh pohon kebun yang belum diarsipkan, dan target `custom` tidak menautkan pohon sama sekali.

Pohon ditentukan pada saat penyelesaian tugas, bukan saat jadwal dibuat, agar tautannya mencerminkan pohon yang benar-benar ada ketika pekerjaan dilakukan.

Tabel ini hanya menerima operasi baca dan tulis baru. Tautan yang sudah terbentuk tidak dapat dihapus atau diubah; koreksi hanya mungkin dengan menghapus aktivitas induknya.

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
3. `care_activities` melalui jembatan `care_activity_trees`
4. `care_tasks`, hanya untuk mengambil judul tugas dari aktivitas terjadwal

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

Aktivitas perawatan masuk ke timeline lewat `care_activity_trees`, bukan lewat target pohon pada `care_tasks`. Konsekuensinya satu perawatan yang menyasar seluruh kebun muncul di riwayat setiap pohon yang terdampak, dan perawatan bertarget catatan bebas tidak muncul di riwayat pohon mana pun.

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
| care_schedules         | Menyimpan jadwal perawatan              |
| care_tasks             | Menyimpan tugas worker                  |
| care_activities        | Menyimpan aktivitas realisasi tugas     |
| care_activity_trees    | Menautkan aktivitas perawatan ke pohon terdampak |
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

## 17.6 `farms` ke `care_schedules`

```txt
farms.id 1..N care_schedules.farm_id
```

Satu kebun memiliki banyak jadwal perawatan.

---

## 17.7 `care_schedules` ke `care_tasks`

```txt
care_schedules.id 1..N care_tasks.care_schedule_id
```

Satu jadwal dapat menghasilkan satu atau lebih tugas.

---

## 17.8 `operational_reports` ke `care_tasks`

```txt
operational_reports.id 0..N care_tasks.operational_report_id
```

Satu laporan operasional dapat menghasilkan tugas tindak lanjut atau tidak menghasilkan tugas sama sekali.

---

## 17.9 `care_tasks` ke `care_activities`

```txt
care_tasks.id 0..N care_activities.care_task_id
```

Satu tugas dapat belum memiliki aktivitas, atau memiliki beberapa aktivitas, misalnya tertunda lalu selesai.

---

## 17.10 `care_activities` dan `trees` ke `care_activity_trees`

```txt
care_activities.id 0..N care_activity_trees.care_activity_id
trees.id           0..N care_activity_trees.tree_id
```

Relasi banyak-ke-banyak antara aktivitas perawatan dan pohon. Satu aktivitas dapat menautkan banyak pohon, dan satu pohon dapat terdampak banyak aktivitas.

---

## 17.11 `care_schedules` ke `care_schedules`

```txt
care_schedules.id 0..1 care_schedules.parent_schedule_id
```

Relasi rekursif untuk rantai jadwal berulang. Setiap penerus menunjuk satu pendahulu, dan siklus pertama tidak menunjuk siapa pun.

---

## 17.12 `trees` ke `growth_phase_records`

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
| care_schedules         | farm_id, scheduled_date       | Jadwal per tanggal                |
| care_tasks             | assigned_to, due_date         | Tugas worker hari ini             |
| care_tasks             | farm_id, status               | Dashboard tugas                   |
| care_tasks             | farm_id, due_date, hanya untuk tugas terbuka | Penyapu jadwal terlewat dan penghitung tunggakan |
| care_activities        | care_task_id                  | Riwayat aktivitas tugas           |
| care_activities        | care_task_id, performed_at, id | Mencari realisasi terakhir sebuah tugas |
| care_activity_trees    | tree_id                       | Riwayat perawatan satu pohon      |
| growth_phase_records   | tree_id, recorded_at          | Riwayat fase pohon                |

Index pada `care_tasks (farm_id, due_date)` sengaja bersifat parsial: hanya mencakup baris yang statusnya `pending` atau `postponed`, `missed_at` kosong, dan `released_at` kosong. Himpunan itulah definisi tugas terbuka, dan membatasi index padanya membuat penyapu tidak perlu memindai tugas yang sudah selesai, sudah terlewat, atau sudah dilepas.

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
* membuat jadwal utama
* mengakses data kebun lain
* mengakses kebun setelah statusnya removed

---

# 21. Catatan Implementasi Target

Untuk target seperti kebun, baris, kolom, dan pohon, schema menggunakan kombinasi:

```txt
target_type
target_tree_id
custom_target_note
```

Alasan tidak menggunakan satu kolom `target_value` saja:

1. Lebih jelas secara struktur.
2. Target pohon bisa menggunakan foreign key.
3. Lebih mudah divalidasi.
4. Lebih mudah dipakai pada query.

Contoh:

## Target seluruh kebun

```txt
target_type = farm
target_tree_id = null
custom_target_note = null
```

## Target pohon tertentu

```txt
target_type = tree
target_tree_id = id pohon
custom_target_note = null
```

## Target custom

```txt
target_type = custom
target_tree_id = null
custom_target_note = "Saluran air dekat area belakang kebun"
```

---

# 22. Catatan Penting tentang Rantai Jadwal Berulang

Untuk membentuk jadwal penerus, sistem mengambil data:

1. Jadwal yang berulang
2. `repeat_every_days`
3. `date_basis`, yang menentukan tanggal mana yang dipakai sebagai dasar
4. `grace_days`, untuk menentukan kapan siklus dinyatakan terlewat

Rumus:

```txt
tanggal dasar + repeat_every_days
```

dengan tanggal dasar bergantung pada `date_basis`:

```txt
date_basis = jadwal    -> scheduled_date
date_basis = realisasi -> tanggal pekerjaan benar-benar dilakukan
```

Contoh:

```txt
Jadwal: Semprot Pencegahan
Interval pengulangan: 14 hari
Dasar tanggal: realisasi
Realisasi terakhir: 1 Juni 2026
Jadwal penerus: 15 Juni 2026
```

Status jadwal yang ditampilkan:

```txt
belum jatuh tempo
jatuh tempo hari ini
terlambat
terlewat
```

Sistem membentuk jadwal penerus sendiri, tanpa konfirmasi owner, begitu siklus berjalan ditutup. Siklus dapat ditutup karena dua sebab: tugasnya diselesaikan, atau siklusnya melewati `scheduled_date + grace_days` sehingga dinyatakan terlewat.

Contoh siklus terlewat:

```txt
Jadwal: Semprot Pencegahan
Tanggal jadwal: 1 Juni 2026
Masa toleransi: 3 hari
Hari ini: 5 Juni 2026
-> jadwal ditandai terlewat, penerus tetap dibuat
```

Jadwal tanpa `grace_days` tidak pernah dinyatakan terlewat dan menunggu selamanya sampai dikerjakan.

Perhitungan ini dijalankan saat aplikasi membaca data, dilindungi kunci per kebun agar dua pembacaan yang bersamaan tidak membuat penerus ganda. Sistem tetap tidak memakai penjadwal yang berjalan di luar aplikasi.

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
7. `care_schedules` menyimpan jadwal perawatan.
8. `care_tasks` menyimpan tugas worker.
9. `care_activities` menyimpan aktivitas realisasi tugas.
10. `growth_phase_records` menyimpan riwayat fase pertumbuhan.
11. `tree_history_view` dapat digunakan untuk menampilkan riwayat pohon secara terintegrasi.
12. Worker yang dikeluarkan menggunakan status `removed`, bukan delete permanen.
13. Pohon tidak aktif menggunakan `is_archived`.
14. Interval pengulangan jadwal digunakan sebagai acuan jadwal berikutnya, bukan recurring otomatis penuh.
