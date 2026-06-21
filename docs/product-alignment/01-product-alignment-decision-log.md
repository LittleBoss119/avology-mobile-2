# Product Alignment Decision Log Avology V2

**Path dokumen:** `docs/product-alignment/01-product-alignment-decision-log.md`  
**Tanggal:** 19 Juni 2026  
**Status:** Accepted sebagai source of truth produk tambahan  
**Ruang lingkup:** Sinkronisasi arah produk, UI/UX, database impact, service layer impact, navigasi, dan batas implementasi setelah Product Alignment Review Avology V2.

---

## 1. Tujuan Dokumen

Dokumen ini mencatat keputusan alignment produk Avology V2 setelah dilakukan review terhadap source of truth yang sudah ada, termasuk MVP Scope, Requirement, Decision Log, ERD, Logical Database Schema, SQL Schema Draft, Service Layer Design, Screen Navigation Flow, Iteration Planning, Black-box Testing Plan, Traceability Matrix, UAT Plan, dan Implementation Master Plan.

Dokumen ini dibuat untuk mencegah implementasi berikutnya melenceng dari arah produk utama. Jika terdapat perbedaan antara implementasi saat ini dengan dokumen ini, maka dokumen ini menjadi acuan untuk area product direction, UI/UX semantics, navigation behavior, dan implementation guardrails.

Dokumen ini **tidak** berisi kode, tidak berisi migration SQL, dan tidak berisi prompt Codex.

---

## 2. Product Positioning Final

Avology V2 tidak diposisikan sebagai aplikasi pencatatan pohon semata.

Avology V2 diposisikan sebagai:

> **Aplikasi mobile operasional kebun alpukat yang membantu owner dan worker memantau kondisi kebun, mengelola tugas perawatan, mencatat laporan lapangan, menjaga histori operasional, dan mengambil keputusan cepat berdasarkan data kebun.**

Dengan positioning ini, fitur pohon tetap penting, tetapi bukan pusat tunggal produk. Pohon adalah salah satu objek operasional dalam sistem kebun.

Fokus utama produk adalah:

1. Monitoring kondisi kebun.
2. Tugas perawatan worker.
3. Laporan lapangan.
4. Histori operasional.
5. Dashboard berbasis insight untuk owner.
6. Dashboard berbasis tugas untuk worker.

---

## 3. Ringkasan Source of Truth Saat Ini

Berdasarkan source of truth Avology V2, sistem sudah memiliki fondasi sebagai aplikasi operasional kebun alpukat. Fitur utama MVP mencakup:

1. Autentikasi pengguna.
2. Role owner dan worker berbasis `farm_members`.
3. Manajemen kebun.
4. Join worker menggunakan kode kebun.
5. Approval, reject, dan remove worker.
6. Manajemen data pohon individual.
7. Laporan kondisi pohon.
8. Laporan operasional kebun.
9. SOP perawatan sebagai template standar.
10. Jadwal perawatan dari SOP dan manual.
11. Tugas worker.
12. Realisasi tugas melalui `care_activities`.
13. Pencatatan fase pertumbuhan pohon.
14. Riwayat pohon terintegrasi.
15. Dashboard owner.
16. Dashboard worker.
17. Guard akses berdasarkan role dan status membership.

Batasan MVP yang tetap berlaku:

1. Tidak ada prediksi panen otomatis.
2. Tidak ada estimasi panen otomatis.
3. Tidak ada machine learning untuk panen.
4. Tidak ada IoT.
5. Tidak ada push notification.
6. Tidak ada backend custom.
7. Tidak ada chat owner-worker.
8. Tidak ada akuntansi lengkap.
9. Tidak ada recurring task penuh tanpa konfirmasi owner.
10. Tidak ada permanent delete pohon dalam MVP aktif.
11. Tidak ada attachment/foto sebagai bagian core MVP awal.

---

## 4. Konflik dan Penyesuaian Produk

| Area | Source of Truth Lama | Hasil Alignment Baru | Keputusan |
| --- | --- | --- | --- |
| Filosofi produk | Avology sudah disebut sebagai sistem informasi operasional kebun, tetapi implementasi UI masih terasa seperti kumpulan fitur pencatatan | Avology ditegaskan sebagai aplikasi operasional kebun alpukat | Accepted |
| Dashboard owner | Dashboard menampilkan ringkasan data, tetapi risiko implementasi menjadi menu/tombol navigasi masih ada | Dashboard owner harus insight-based | Accepted |
| Dashboard worker | Dashboard worker menampilkan ringkasan tugas dan shortcut | Dashboard worker harus task-based | Accepted |
| Profil | Database memisahkan `profiles` dan `farms`, tetapi navigasi UI masih dapat mencampur profil akun dan kebun | Profil Akun dan Profil Kebun harus dipisah | Accepted |
| User tanpa kebun | User diarahkan ke onboarding jika belum punya membership | User tetap harus dapat membuka dan mengedit profil akun dasar walau belum terafiliasi kebun | Accepted |
| Kode pohon | `tree_code` masih diperlakukan sebagai input manual | `tree_code` menjadi display code berbasis baris-kolom | Accepted dengan penyesuaian service/UI |
| UUID | UUID digunakan sebagai primary key internal dan kadang berisiko tampil di UI | UUID tidak boleh tampil ke user | Accepted |
| Umur pohon | `planted_at` tersedia, umur tidak disimpan eksplisit | Umur dihitung dinamis dari `planted_at` | Accepted |
| Delete vs archive | Permanent delete tidak masuk MVP, archive digunakan untuk pohon tidak aktif | Delete hanya untuk salah input tanpa histori, archive untuk pohon mati/diganti/tidak aktif | Accepted, delete ditunda |
| Foto/lampiran | Belum masuk schema utama MVP aktif | Attachment penting untuk foto pohon, laporan kondisi, laporan operasional, dan bukti tugas | Deferred |
| requires_photo | Belum ada di schedule/task schema | Jadwal/tugas bisa mewajibkan bukti foto secara opsional | Deferred |
| Riwayat worker lintas kebun | Multi-farm dan histori kompleks belum menjadi scope MVP | Riwayat worker lintas kebun bukan prioritas MVP | Deferred |
| Riwayat pengajuan worker | Status pending/rejected/removed sudah ada | Riwayat pengajuan dapat dipertimbangkan setelah flow inti stabil | Deferred |

---

## 5. Product Alignment Decision Log

### PADL-001 — Avology sebagai Aplikasi Operasional Kebun Alpukat

**Status:** Accepted

**Latar Belakang:**  
Beberapa bagian implementasi dan UI berisiko membuat Avology terlihat seperti aplikasi pencatatan pohon. Padahal source of truth sudah menempatkan Avology sebagai sistem informasi operasional kebun alpukat.

**Keputusan:**  
Avology V2 harus diposisikan sebagai aplikasi operasional kebun alpukat, bukan aplikasi pencatatan pohon.

**Alasan:**  
Masalah utama MS Farm bukan hanya tidak adanya data pohon, tetapi juga tidak adanya pencatatan treatment, SOP, jadwal, tugas worker, laporan lapangan, dan histori operasional yang terstruktur.

**Dampak:**

- Narasi produk harus menekankan operasional kebun.
- Dashboard harus menampilkan kondisi kebun dan pekerjaan prioritas.
- Navigasi tidak boleh terlalu berpusat pada pohon saja.
- UAT harus menilai manfaat aplikasi terhadap manajemen operasional kebun.

---

### PADL-002 — Dashboard Owner Harus Insight-Based

**Status:** Accepted

**Latar Belakang:**  
Dashboard owner berisiko menjadi kumpulan tombol navigasi. Ini melemahkan fungsi dashboard sebagai alat monitoring dan pengambilan keputusan cepat.

**Keputusan:**  
Dashboard Owner harus insight-based.

**Dashboard Owner harus menampilkan:**

1. Kondisi kebun secara ringkas.
2. Jumlah pohon bermasalah.
3. Tugas hari ini.
4. Tugas terlambat atau belum selesai.
5. Laporan operasional baru.
6. Worker pending.
7. Pohon berbunga dan berbuah.
8. SOP jatuh tempo atau terlambat.
9. Aksi lanjutan yang relevan berdasarkan insight.

**Alasan:**  
Owner membutuhkan informasi prioritas untuk mengambil keputusan cepat, terutama karena owner tidak selalu berada di kebun.

**Dampak:**

- Dashboard tidak boleh menjadi menu utama berbentuk tombol bertumpuk.
- Quick action boleh ada, tetapi bukan isi utama dashboard.
- Data dashboard tetap berasal dari query agregasi tabel operasional, bukan tabel dashboard baru.

---

### PADL-003 — Dashboard Worker Harus Task-Based

**Status:** Accepted

**Latar Belakang:**  
Worker membutuhkan flow yang sederhana, minim teks, dan langsung mengarah ke pekerjaan lapangan.

**Keputusan:**  
Dashboard Worker harus task-based.

**Dashboard Worker harus menampilkan:**

1. Tugas hari ini.
2. Tugas belum selesai.
3. Tugas selesai.
4. Tugas tertunda.
5. Aksi cepat untuk melihat tugas.
6. Aksi cepat untuk lapor kondisi pohon.
7. Aksi cepat untuk membuat laporan operasional.

**Alasan:**  
Worker tidak membutuhkan dashboard analitik kompleks. Worker membutuhkan daftar kerja yang jelas dan aksi lapangan yang cepat.

**Dampak:**

- Dashboard worker harus lebih sederhana daripada dashboard owner.
- Copywriting harus memakai bahasa operasional yang mudah dipahami.
- Input teks harus diminimalkan.

---

### PADL-004 — Profil Akun Dipisah dari Profil Kebun

**Status:** Accepted

**Latar Belakang:**  
Database sudah memisahkan `profiles` dan `farms`, tetapi UI/navigasi dapat membuat keduanya tercampur. Ini membuat user bingung apakah sedang mengedit data pribadi atau data kebun.

**Keputusan:**  
Profil Akun dan Profil Kebun harus dipisah secara konsep dan UI.

**Definisi:**

- **Profil Akun:** data pribadi user seperti nama lengkap, nomor telepon, dan akun login.
- **Profil Kebun:** data kebun seperti nama kebun, lokasi, luas kebun, join code, dan worker management.

**Aturan:**

1. User yang belum memiliki kebun atau membership tetap boleh membuka dan mengedit Profil Akun.
2. Profil Kebun hanya tersedia jika user memiliki farm context yang valid.
3. Worker tidak boleh mengedit Profil Kebun.
4. Owner dapat mengelola Profil Kebun sesuai hak akses.

**Dampak:**

- Navigasi perlu membedakan entry Profil Akun dan Kebun.
- Guard tidak boleh mengunci seluruh profil hanya karena user belum terafiliasi kebun.
- Service `getCurrentProfile` harus dapat berjalan tanpa farm membership aktif.

---

### PADL-005 — `tree_code` sebagai Display Code Berbasis Baris-Kolom

**Status:** Accepted

**Latar Belakang:**  
Sebelumnya `tree_code` masih diperlakukan sebagai input manual. Ini membuka risiko kode tidak konsisten, duplikat, atau tidak sesuai posisi fisik pohon.

**Keputusan:**  
`tree_code` harus diperlakukan sebagai display code berbasis kombinasi baris dan kolom.

**Format display code:**

```txt
{row_position}-{column_position}
```

Contoh:

```txt
A-12
B-03
P-02
```

**Aturan:**

1. User tidak perlu menginput `tree_code` manual.
2. User menginput baris dan kolom.
3. Sistem membentuk display code dari baris dan kolom.
4. `tree_code` tetap boleh disimpan di database untuk kebutuhan pencarian dan constraint.
5. `tree_code` tidak boleh dianggap sebagai ID internal.
6. UUID tetap menjadi ID internal database.

**Dampak:**

- Form Tambah/Edit Pohon harus menghapus input kode pohon manual.
- UI dapat menampilkan preview kode pohon berdasarkan baris-kolom.
- Service `createTree` dan `updateTree` harus membentuk `tree_code` dari `row_position` dan `column_position`.
- Testing perlu diperbarui dari “kode pohon wajib diisi” menjadi “baris dan kolom wajib diisi untuk menghasilkan kode pohon”.

---

### PADL-006 — UUID Hanya untuk Internal Sistem

**Status:** Accepted

**Latar Belakang:**  
UUID adalah primary key internal database. Menampilkan UUID kepada user membuat UI terlihat teknis, mentah, dan membingungkan.

**Keputusan:**  
UUID tidak boleh tampil kepada user.

**Aturan:**

1. UUID tidak boleh tampil di card.
2. UUID tidak boleh tampil di detail screen.
3. UUID tidak boleh tampil di toast normal.
4. UUID tidak boleh tampil di empty state.
5. UUID tidak boleh tampil di error message user-facing.
6. UUID hanya boleh digunakan di service, route params, debug log internal, dan database relation.

**Dampak:**

- Semua screen perlu audit display field.
- Error message perlu diformat menjadi bahasa user.
- Debug info teknis tidak boleh bocor ke UI produksi/demo.

---

### PADL-007 — Umur Pohon Dihitung Dinamis dari `planted_at`

**Status:** Accepted

**Latar Belakang:**  
Umur pohon dapat dihitung dari tanggal tanam. Menyimpan umur sebagai angka statis akan membuat data cepat basi.

**Keputusan:**  
Umur pohon dihitung dinamis dari `planted_at`.

**Format tampilan:**

1. Kurang dari 1 bulan: tampil dalam hari.
2. Kurang dari 12 bulan: tampil dalam bulan.
3. 12 bulan atau lebih: tampil dalam tahun.

**Contoh:**

```txt
12 hari
4 bulan
2 tahun
```

**Aturan:**

1. Tidak perlu menambah kolom `age` di database.
2. Jika `planted_at` kosong, tampilkan label seperti `Tanggal tanam belum diisi`.
3. Perhitungan umur harus dilakukan di formatter/helper UI atau service formatting layer.

**Dampak:**

- Tree card dan Tree Detail dapat menampilkan umur pohon.
- Testing perlu mengecek format umur berdasarkan tanggal tanam.

---

### PADL-008 — Archive Tetap Default, Permanent Delete Ditunda

**Status:** Accepted dengan batasan MVP

**Latar Belakang:**  
Pohon dapat mati, diganti, atau tidak aktif. Namun pohon yang sudah memiliki laporan kondisi, fase, atau riwayat perawatan tidak boleh dihapus permanen karena akan merusak histori.

**Keputusan:**  
Archive tetap menjadi aksi utama dalam MVP aktif. Permanent delete pohon tidak diimplementasikan dalam MVP aktif.

**Aturan:**

1. Archive digunakan untuk pohon mati, diganti, tidak aktif, atau tidak lagi dipantau.
2. Permanent delete hanya dapat dipertimbangkan untuk data salah input yang belum memiliki histori.
3. Jika pohon sudah memiliki histori penting, archive lebih diutamakan daripada delete.
4. MVP aktif tidak mengimplementasikan permanent delete pohon.

**Dampak:**

- UI hanya perlu menyediakan archive/unarchive.
- Tidak perlu membuat service `deleteTree` untuk MVP aktif.
- Black-box testing tetap fokus pada archive/unarchive.

---

### PADL-009 — Attachment dan Foto Penting, tetapi Ditunda

**Status:** Deferred

**Latar Belakang:**  
Foto penting untuk validasi kondisi lapangan, tetapi attachment membutuhkan storage, policy, upload flow, dan data relation yang lebih kompleks.

**Keputusan:**  
Attachment/foto diakui sebagai fitur penting, tetapi tidak diimplementasikan sebelum UI dasar stabil.

**Attachment di masa depan harus mendukung:**

1. Foto pohon.
2. Foto laporan kondisi pohon.
3. Foto laporan operasional kebun.
4. Bukti penyelesaian tugas.

**Alasan Ditunda:**

1. Membutuhkan Supabase Storage.
2. Membutuhkan tabel attachment.
3. Membutuhkan policy akses file.
4. Membutuhkan upload dan preview handling.
5. Berisiko mengganggu stabilitas MVP jika dimasukkan terlalu cepat.

**Dampak:**

- Placeholder foto boleh ada di UI.
- Upload foto belum boleh menjadi blocker MVP saat ini.
- Attachment perlu mini-iteration khusus setelah UI dasar stabil.

---

### PADL-010 — `requires_photo` untuk Tugas Ditunda

**Status:** Deferred

**Latar Belakang:**  
Sebagian tugas lapangan membutuhkan bukti foto, tetapi tidak semua tugas perlu bukti foto. Jika dipaksakan global, worker flow menjadi berat.

**Keputusan:**  
Konsep `requires_photo` diterima, tetapi implementasinya ditunda.

**Aturan Future:**

1. Jadwal/tugas dapat memiliki flag `requires_photo`.
2. Nilai default harus false.
3. Jika `requires_photo = true`, worker harus melampirkan foto sebelum menandai tugas selesai.
4. Bukti foto sebaiknya melekat pada realisasi tugas atau `care_activities`, bukan hanya pada master task.

**Dampak Future:**

- Perlu perubahan database.
- Perlu service validation.
- Perlu UI upload proof.
- Perlu test case completion task dengan bukti wajib dan tidak wajib.

---

### PADL-011 — Riwayat Worker Lintas Kebun Bukan Prioritas MVP

**Status:** Deferred

**Latar Belakang:**  
Riwayat worker lintas kebun dapat berguna jika sistem sudah mendukung multi-farm dan user history yang lebih kompleks. Namun MVP saat ini belum membutuhkan itu.

**Keputusan:**  
Riwayat worker lintas kebun tidak masuk prioritas MVP.

**Alasan:**  
Core flow saat ini masih harus distabilkan: auth, farm, membership, tree, task, operational report, history, dashboard.

**Dampak:**

- Tidak ada screen riwayat kerja lintas kebun.
- Tidak ada service khusus worker cross-farm history.
- Tidak ada perubahan database untuk fitur ini di MVP aktif.

---

### PADL-012 — Riwayat Pengajuan Worker Ditunda

**Status:** Deferred

**Latar Belakang:**  
Sistem sudah memiliki status `pending`, `active`, `rejected`, dan `removed`. Namun histori lengkap pengajuan worker dari waktu ke waktu belum menjadi kebutuhan utama.

**Keputusan:**  
Riwayat pengajuan worker dapat dipertimbangkan setelah flow inti stabil.

**Dampak:**

- Status membership saat ini tetap cukup untuk MVP.
- Tidak perlu tabel baru untuk join request history pada MVP aktif.
- Audit join history dapat masuk backlog setelah UAT awal.

---

## 6. Implementation Guardrails

Bagian ini adalah pagar wajib untuk implementasi berikutnya. Jangan dilanggar kecuali ada decision log baru yang eksplisit merevisi dokumen ini.

### 6.1 Jangan Implement Attachment/Foto/`requires_photo` Sebelum UI Dasar Stabil

Attachment, foto pohon, foto laporan, dan bukti tugas tidak boleh masuk sebelum UI dasar stabil.

Prioritas saat ini adalah:

1. Semantic cleanup.
2. Tree code formatting.
3. Age formatter.
4. Profile separation.
5. Dashboard redesign.
6. QA dan regression test.

Attachment/foto hanya boleh masuk setelah flow dasar tidak rusak.

---

### 6.2 Jangan Implement Permanent Delete Pohon di MVP Aktif

Permanent delete pohon tidak boleh diimplementasikan dalam MVP aktif.

Gunakan:

```txt
archive / unarchive
```

bukan:

```txt
delete permanent
```

Delete hanya dapat dipertimbangkan nanti untuk data salah input yang belum memiliki histori, dan harus melalui audit database terlebih dahulu.

---

### 6.3 UUID Tidak Boleh Tampil ke User

UUID hanya untuk internal sistem.

Tidak boleh tampil di:

1. Card.
2. Detail screen.
3. Form.
4. Toast.
5. Empty state.
6. Error message user-facing.
7. Badge.
8. Filter.
9. List item.

Gunakan display label yang bisa dipahami user, misalnya nama kebun, nama worker, kode pohon berbasis baris-kolom, atau label status bahasa Indonesia.

---

### 6.4 Raw Status dan Raw Role Harus Diformat ke Bahasa Indonesia

Raw status/role seperti:

```txt
active
pending
rejected
removed
owner
worker
healthy
needs_attention
pest_attacked
disease_indicated
completed
postponed
new
in_progress
resolved
```

tidak boleh tampil mentah kepada user.

Gunakan label bahasa Indonesia, misalnya:

| Raw Value | Label UI |
| --- | --- |
| `owner` | Pemilik |
| `worker` | Pekerja |
| `active` | Aktif |
| `pending` | Menunggu Persetujuan |
| `rejected` | Ditolak |
| `removed` | Akses Dinonaktifkan |
| `healthy` | Sehat |
| `needs_attention` | Perlu Perhatian |
| `pest_attacked` | Terserang Hama |
| `disease_indicated` | Terindikasi Penyakit |
| `damaged` | Rusak |
| `dead` | Mati |
| `completed` | Selesai |
| `postponed` | Tertunda |
| `new` | Baru |
| `in_progress` | Diproses |
| `resolved` | Selesai |

---

### 6.5 Dashboard Owner Harus Insight-Based

Dashboard Owner harus menjawab pertanyaan:

> “Apa yang harus owner perhatikan sekarang?”

Dashboard Owner tidak boleh hanya menampilkan tombol menuju fitur.

Isi utama harus berupa:

1. Kondisi kebun.
2. Peringatan pohon bermasalah.
3. Tugas hari ini.
4. Tugas tertunda/terlambat.
5. Laporan operasional baru.
6. Worker pending.
7. SOP jatuh tempo/terlambat.
8. Pohon berbunga/berbuah.

---

### 6.6 Dashboard Worker Harus Task-Based

Dashboard Worker harus menjawab pertanyaan:

> “Apa yang harus worker kerjakan hari ini?”

Isi utama harus berupa:

1. Tugas hari ini.
2. Tugas belum selesai.
3. Tugas tertunda.
4. Aksi selesaikan/tunda tugas.
5. Aksi lapor kondisi.
6. Aksi buat laporan operasional.

Dashboard Worker tidak boleh dibuat sekompleks dashboard owner.

---

### 6.7 `tree_code` Harus Diperlakukan sebagai Display Code Berbasis Baris-Kolom

`tree_code` bukan input bebas utama.

Aturan:

1. User input baris.
2. User input kolom.
3. Sistem membentuk display code.
4. Display code dipakai untuk UI, search, dan identifikasi manusia.
5. UUID tetap dipakai untuk relasi internal.

Contoh:

```txt
Baris: A
Kolom: 12
Display code: A-12
```

---

### 6.8 Audit Unique Constraint `tree_code` Sebelum Replacement Pohon

Saat ini `trees` memiliki constraint unik pada kombinasi:

```txt
farm_id + tree_code
```

Jika di masa depan owner ingin mengganti pohon di lokasi yang sama setelah pohon lama diarsipkan, constraint ini dapat menghalangi pembuatan pohon baru dengan kode lokasi yang sama.

Contoh masalah:

```txt
Pohon lama A-12 diarsipkan.
Owner menanam pohon baru di lokasi A-12.
Sistem menolak karena tree_code A-12 sudah ada pada farm yang sama.
```

Keputusan saat ini:

1. Jangan langsung membuat migration untuk mengubah constraint.
2. Catat ini sebagai database issue.
3. Lakukan audit sebelum migration.
4. Tentukan apakah model yang benar adalah:
   - satu lokasi hanya punya satu record pohon yang diupdate,
   - atau satu lokasi bisa punya banyak generasi pohon dengan versi/sequence,
   - atau unique constraint perlu berubah menjadi partial unique untuk pohon aktif saja.

Status issue:

```txt
Database issue pending audit sebelum migration.
```

---

### 6.9 Perubahan Berikutnya Harus Dibagi Menjadi Tahap Kecil

Perubahan berikutnya tidak boleh digabung menjadi satu prompt besar.

Tahap berikutnya harus dibagi menjadi:

#### 8A — UI Semantic Cleanup

Fokus:

1. Hilangkan raw UUID dari UI.
2. Format raw status/role ke bahasa Indonesia.
3. Bersihkan label teknis.
4. Kurangi tampilan yang terasa seperti database admin panel.

#### 8B — Tree Code and Age Formatter

Fokus:

1. `tree_code` berbasis baris-kolom.
2. Preview kode pohon di form.
3. Hilangkan input kode manual.
4. Formatter umur pohon dari `planted_at`.
5. Testing create/edit tree setelah perubahan.

#### 8C — Profile Separation

Fokus:

1. Pisahkan Profil Akun dan Profil Kebun.
2. Pastikan user tanpa kebun tetap bisa mengedit profil akun.
3. Sesuaikan navigasi owner dan worker.
4. Pastikan guard tidak mengunci profil akun.

#### 8D — Dashboard Redesign

Fokus:

1. Owner dashboard insight-based.
2. Worker dashboard task-based.
3. Tidak ada dashboard berupa tumpukan tombol.
4. Quick actions hanya pendukung.
5. Dashboard tetap memakai data agregasi dari service yang sudah ada.

#### 8E — QA and Regression Test

Fokus:

1. Test auth dan onboarding.
2. Test owner create farm.
3. Test worker join flow.
4. Test tree create/edit/archive.
5. Test condition report.
6. Test task flow.
7. Test dashboard owner/worker.
8. Test profile account access tanpa farm.
9. Pastikan tidak ada UUID/raw status tampil di UI.
10. Pastikan fitur lama tidak rusak.

---

## 7. Dampak terhadap Database

### 7.1 Tidak Perlu Perubahan Database Langsung untuk Tahap 8A sampai 8D

Tahap 8A sampai 8D sebaiknya fokus pada UI, UX, formatter, service formatting, dan navigation cleanup.

Tidak perlu migration langsung untuk:

1. Hide UUID.
2. Format status.
3. Dashboard redesign.
4. Age formatter.
5. Profile separation.

### 7.2 Potensi Issue pada `tree_code`

Karena `tree_code` akan diperlakukan sebagai display code berbasis baris-kolom, constraint unik `farm_id + tree_code` perlu diaudit sebelum fitur replacement pohon di lokasi sama diimplementasikan.

Untuk MVP aktif, constraint ini masih dapat dipertahankan selama replacement pohon belum menjadi flow utama.

### 7.3 Attachment Future

Jika attachment/foto masuk future iteration, kemungkinan perlu tambahan:

1. Tabel attachment.
2. Supabase Storage bucket.
3. Entity type atau polymorphic relation.
4. Policy akses file.
5. Attachment relation ke pohon, laporan kondisi, laporan operasional, dan care activity.

Namun ini tidak masuk tahap UI cleanup saat ini.

---

## 8. Dampak terhadap Service Layer

### 8.1 Tree Service

Service `createTree` dan `updateTree` perlu disesuaikan agar `tree_code` dibentuk dari baris dan kolom.

Validasi utama:

1. Baris wajib diisi.
2. Kolom wajib diisi.
3. Kombinasi baris-kolom harus menghasilkan display code yang konsisten.
4. Duplikasi display code harus ditangani dengan pesan error yang mudah dipahami.

### 8.2 Profile/Auth Service

Service profil harus memastikan user yang belum memiliki farm tetap dapat:

1. Membaca profil akun sendiri.
2. Mengubah profil akun sendiri.
3. Kembali ke onboarding setelah mengedit profil.

### 8.3 Dashboard Service

Dashboard service harus mendukung output berbasis insight/task.

Owner dashboard membutuhkan agregasi dari:

1. `trees`.
2. `care_tasks`.
3. `operational_reports`.
4. `farm_members`.
5. `care_sops`.
6. `growth_phase_records` atau current phase dari `trees`.

Worker dashboard membutuhkan agregasi dari:

1. `care_tasks` berdasarkan `assigned_to`.
2. Status tugas.
3. Due date tugas.

### 8.4 Formatter Layer

Perlu formatter/helper untuk:

1. Label role.
2. Label status membership.
3. Label kondisi pohon.
4. Label fase pertumbuhan.
5. Label status task.
6. Label status report.
7. Umur pohon.
8. Tree display code.

---

## 9. Dampak terhadap UI/UX

### 9.1 UI

Perubahan UI yang harus dilakukan:

1. Hapus UUID dari semua tampilan user-facing.
2. Format semua raw enum ke bahasa Indonesia.
3. Ubah form pohon agar memakai baris dan kolom sebagai input utama.
4. Tampilkan preview kode pohon.
5. Tampilkan umur pohon dari tanggal tanam.
6. Pisahkan Profil Akun dan Profil Kebun.
7. Ubah dashboard owner menjadi insight-based.
8. Ubah dashboard worker menjadi task-based.

### 9.2 UX

Prinsip UX yang harus dijaga:

1. Owner melihat prioritas kebun dengan cepat.
2. Worker melihat pekerjaan hari ini dengan cepat.
3. Worker tidak dibebani input teks berlebihan.
4. User tidak melihat istilah teknis database.
5. Navigasi tidak menjadi tumpukan tombol.
6. Aksi utama harus sesuai konteks screen.

---

## 10. Dampak terhadap Navigasi

### 10.1 Owner Navigation

Rekomendasi struktur owner:

```txt
Dashboard
Pohon
Jadwal
Laporan
Kebun
```

Profil Akun dapat diakses dari header/avatar/menu akun, bukan dicampur sebagai Profil Kebun.

Tab `Kebun` dapat berisi:

1. Profil Kebun.
2. Join Code.
3. Manajemen Worker.
4. SOP Perawatan.
5. Pengaturan kebun jika diperlukan.

### 10.2 Worker Navigation

Rekomendasi struktur worker:

```txt
Dashboard
Tugas
Pohon
Laporan
Profil
```

Worker membutuhkan akses profil akun secara langsung karena worker tidak mengelola profil kebun.

### 10.3 User Tanpa Kebun

User yang belum memiliki farm/membership perlu akses:

1. Onboarding Decision.
2. Create Farm.
3. Join Farm.
4. Profil Akun.
5. Logout.

User tanpa kebun tidak boleh dipaksa logout hanya untuk mengedit profil dasar.

---

## 11. Dampak terhadap Testing

Testing berikut perlu ditambahkan atau direvisi:

### 11.1 UI Semantic Testing

1. Tidak ada UUID tampil pada UI.
2. Tidak ada raw enum tampil pada UI.
3. Role tampil sebagai Pemilik/Pekerja.
4. Status membership tampil sebagai Aktif/Menunggu Persetujuan/Ditolak/Akses Dinonaktifkan.

### 11.2 Tree Code Testing

1. Owner input baris dan kolom.
2. Sistem menampilkan preview kode pohon.
3. Sistem menyimpan display code berbasis baris-kolom.
4. Duplikasi baris-kolom ditolak dengan pesan yang mudah dipahami.
5. Edit baris/kolom memperbarui display code.

### 11.3 Age Formatter Testing

1. Tanggal tanam kurang dari 1 bulan tampil sebagai hari.
2. Tanggal tanam kurang dari 12 bulan tampil sebagai bulan.
3. Tanggal tanam 12 bulan atau lebih tampil sebagai tahun.
4. Tanggal tanam kosong tampil sebagai belum diisi.

### 11.4 Profile Separation Testing

1. User tanpa kebun dapat membuka Profil Akun.
2. User tanpa kebun dapat mengedit Profil Akun.
3. Worker tidak dapat mengedit Profil Kebun.
4. Owner dapat melihat Profil Kebun.
5. Profil Akun tidak tertukar dengan data kebun.

### 11.5 Dashboard Testing

1. Owner dashboard menampilkan insight penting.
2. Worker dashboard menampilkan tugas utama.
3. Dashboard bukan tumpukan tombol navigasi.
4. Quick action tidak menggantikan insight/task utama.

### 11.6 Regression Testing

Setelah tahap 8A sampai 8D, regression test wajib mencakup:

1. Register.
2. Login.
3. Logout.
4. Create farm.
5. Join farm.
6. Approve worker.
7. Reject worker.
8. Remove worker.
9. Create tree.
10. Edit tree.
11. Archive tree.
12. Create condition report.
13. Create operational report.
14. Create schedule/task.
15. Complete/postpone task.
16. Dashboard owner.
17. Dashboard worker.

---

## 12. Prioritas Implementasi Setelah Alignment

Urutan implementasi setelah dokumen ini:

```txt
8A UI Semantic Cleanup
↓
8B Tree Code and Age Formatter
↓
8C Profile Separation
↓
8D Dashboard Redesign
↓
8E QA and Regression Test
```

Jangan menggabungkan semua tahap menjadi satu perubahan besar.

Alasan:

1. Mengurangi risiko fitur lama rusak.
2. Memudahkan rollback.
3. Memudahkan testing per tahap.
4. Menghemat limit Codex.
5. Menghindari perubahan database yang belum perlu.

---

## 13. Backlog Setelah MVP Stabil

Fitur berikut tidak masuk tahap 8A sampai 8E, tetapi dapat masuk backlog setelah MVP stabil:

1. Attachment/foto pohon.
2. Foto laporan kondisi.
3. Foto laporan operasional.
4. Bukti foto penyelesaian tugas.
5. `requires_photo` pada schedule/task.
6. Safe delete untuk data salah input tanpa histori.
7. Riwayat worker lintas kebun.
8. Riwayat pengajuan worker.
9. Audit replacement pohon di lokasi yang sama.
10. Perbaikan constraint `tree_code` jika replacement pohon menjadi kebutuhan nyata.

---

## 14. Source-of-Truth Priority Setelah Dokumen Ini

Urutan acuan setelah Product Alignment Review:

1. Product Alignment Decision Log ini.
2. Decision Log Avology V2.
3. Implementation Master Plan.
4. MVP Scope.
5. Requirement.
6. Traceability Matrix.
7. ERD dan Logical Database Schema.
8. SQL Schema Draft.
9. Service Layer Design.
10. Screen Navigation Flow.
11. Iteration Planning.
12. Black-box Testing Plan.
13. UAT Plan.
14. Implementasi kode saat ini.

Jika implementasi kode bertentangan dengan dokumen ini pada area UI semantics, product positioning, dashboard behavior, profile separation, UUID display, raw status display, tree code behavior, atau implementation guardrails, maka implementasi harus disesuaikan.

---

## 15. Final Decision Summary

| ID | Keputusan | Status |
| --- | --- | --- |
| PADL-001 | Avology adalah aplikasi operasional kebun alpukat, bukan aplikasi pencatatan pohon | Accepted |
| PADL-002 | Dashboard Owner harus insight-based | Accepted |
| PADL-003 | Dashboard Worker harus task-based | Accepted |
| PADL-004 | Profil Akun dan Profil Kebun dipisahkan | Accepted |
| PADL-005 | `tree_code` adalah display code berbasis baris-kolom | Accepted |
| PADL-006 | UUID hanya untuk internal sistem dan tidak boleh tampil ke user | Accepted |
| PADL-007 | Umur pohon dihitung dinamis dari `planted_at` | Accepted |
| PADL-008 | Archive tetap default, permanent delete pohon ditunda | Accepted with MVP restriction |
| PADL-009 | Attachment/foto penting tetapi ditunda sampai UI dasar stabil | Deferred |
| PADL-010 | `requires_photo` diterima secara konsep tetapi ditunda | Deferred |
| PADL-011 | Riwayat worker lintas kebun bukan prioritas MVP | Deferred |
| PADL-012 | Riwayat pengajuan worker ditunda sampai flow inti stabil | Deferred |

---

## 16. Catatan Penutup

Dokumen ini menjadi pagar produk untuk mencegah implementasi Avology V2 melebar atau kembali menjadi aplikasi yang tampak seperti database frontend mentah.

Fokus berikutnya bukan menambah fitur besar, tetapi membersihkan makna produk di UI dan UX:

1. Apa yang user lihat.
2. Apa yang user pahami.
3. Apa yang user lakukan.
4. Apa yang sistem sembunyikan sebagai detail internal.
5. Apa yang harus ditunda agar MVP tetap stabil.

Implementasi berikutnya wajib kecil, terurut, dan bisa dites.
