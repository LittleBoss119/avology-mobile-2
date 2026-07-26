# Audit & Rencana Iterasi B — RF-11 (Penanda) + RF-12 (Catatan Produk)

Status: **draft untuk direview**, belum ada kode/migration yang diubah.
Rujukan utama: `landasan_avology_v4.md` §3, §5, §6, §8; `keputusan_desain.md`.

---

## 0. Housekeeping dokumen (sebelum masuk isi)

- `backlog_informal_v4.md` yang disebut sebagai rujukan SP **tidak ditemukan** di project knowledge saat audit ini dibuat. Breakdown SP di §6 di bawah adalah estimasi independen dari gua berdasarkan DoD di `landasan_avology_v4.md`, bukan hasil cross-check ke dokumen itu. Kalau dokumennya ada di tempat lain (repo `docs/`, Notion, dll), upload/paste ke sini biar bisa disilangkan — lihat pertanyaan #5 di §7.
- `AVOLOGY_CURRENT_PROJECT_CONTEXT.md` di project knowledge adalah snapshot **pra-Iterasi A** (migration baru sampai `024`, masih menyebut `manual_care_records`, reopen laporan operasional, dll — semua ini sudah dihapus/di-merge per ringkasan sesi lu). Dokumen itu gua pakai HANYA untuk konteks struktur repo/tech stack yang kemungkinan masih valid (routing convention, pola service layer), **bukan** untuk klaim state DB/kode saat ini.
- Gua tidak punya akses DB atau repo di sesi ini (tidak ada MCP Supabase/GitHub yang tersambung). Semua klaim soal state DB/kode di bawah ini ditandai eksplisit sebagai **ASUMSI — PERLU VERIFIKASI**, sesuai catatan penting lu soal Claude Code juga tidak punya akses DB langsung.

---

## 1. Ruang lingkup terkunci Iterasi B

Dari `landasan_avology_v4.md` §3, §6, §8 — ini yang dianggap sudah diputuskan dan tidak didiskusikan ulang di sini:

| Fitur | DoD teknis (v4 §6) | Sumber triangulasi |
|---|---|---|
| **RF-12 — Catatan produk** | Field produk pada form perawatan; tampil & dapat ditelusuri di riwayat pohon. | Wawancara Abah: *"sering lupa merek insektisida/obat yang terbukti bagus di masa lalu karena tidak dicatat"* [09:26] |
| **RF-11a — Penanda umur berbunga** | Dashboard/detail pohon menampilkan "N hari sejak berbunga". **Tidak ada klaim "layak panen".** | Wawancara Abah: *"tanpa catatan kapan pohon mulai berbunga, pekerja memetik buah hanya berdasarkan perkiraan fisik... buah masih muda"* [26:35],[28:12] |
| **RF-11b — Penanda jadwal in-app** | Dashboard menandai jadwal jatuh tempo/terlambat. Tanpa proses latar. | Wawancara Abah: *"jadwal penyemprotan mundur dan tidak disiplin karena ketiadaan pencatatan tanggal treatment"* [08:35] |

Yang **eksplisit di luar Iterasi B**: RF-11b (push notification) — itu RF-11b di `landasan_avology_v4.md` dinamai beda, hati-hati: dokumen v4 memakai "RF-11b" untuk **push notification** (Iterasi D), sedangkan gua memakai "RF-11b" di tabel atas untuk **penanda jadwal in-app**. Supaya tidak ambigu, mulai dokumen ini gua pakai penamaan:
- **RF-11a** = penanda umur berbunga (in-scope Iterasi B)
- **RF-11b** = penanda jadwal jatuh tempo in-app (in-scope Iterasi B)
- **RF-11c** = push notification (Iterasi D, opsional, boleh gagal — **tidak disentuh sesi ini**)

---

## 2. Yang sudah bisa dipercaya tanpa verifikasi ulang

- Definisi & DoD di §1 — sudah dikunci di v4, triangulasi ≥2 sumber terpenuhi untuk ketiganya.
- Prinsip "tidak akan ada prediksi/estimasi panen" — dikunci di `keputusan_desain.md` ("Prediksi/estimasi panen: Tidak akan ada... Sistem hanya menampilkan **N hari sejak berbunga**").
- Model data konseptual dari v4 §5 (satu tabel `care_activities`/`catatan_perawatan`, field asal, field produk) — ini adalah **desain yang disepakati**, bukan konfirmasi bahwa kolom produk sudah eksis secara fisik di DB. Lihat §3.

---

## 3. Yang BELUM bisa diverifikasi di sesi ini — wajib dicek sebelum nulis migration

Ini daftar konkret yang harus dijalankan lewat SQL Editor (atau dibaca langsung dari kode repo oleh lu / Claude Code). Gua tulis sebagai pertanyaan + query yang bisa langsung dipakai.

### 3.1 Apakah kolom produk sudah ada di `care_activities`?

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'care_activities'
order by ordinal_position;
```

Ini menentukan apakah B-1 (§6) itu kerjaan migration+RPC+form, atau cuma form+tampilan. Beda 1 SP vs 2 SP.

Sekalian cek constraint field asal (buat pastiin nama & nilai aslinya, karena v4 §5 pakai nama konseptual `asal`/`terjadwal`/`inisiatif`, padahal kodebase kemungkinan pakai nama Inggris):

```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'care_activities'::regclass;
```

### 3.2 Skema tabel fase pertumbuhan

Nama tabel persisnya perlu dikonfirmasi (kemungkinan `growth_phase_records` berdasarkan nama service `growthPhaseService.ts`):

```sql
select column_name, data_type
from information_schema.columns
where table_name = 'growth_phase_records'
order by ordinal_position;
```

Dan daftar nilai enum fase (perlu tau nama tipe enum-nya dulu, atau cek lewat `\dT+` di psql / SQL Editor):

```sql
select t.typname, e.enumlabel
from pg_type t
join pg_enum e on t.oid = e.enumtypid
where t.typname ilike '%phase%' or t.typname ilike '%fase%';
```

Yang perlu dicari tahu: apakah enum fase mengandung nilai semacam "siap_panen"/"ready_to_harvest"? Kalau ada, itu bukan masalah selama nilainya diisi manual oleh manusia (observasi, bukan hitungan sistem) — tapi kalau ada teks UI yang menyandingkannya dengan klaim "estimasi", itu yang harus dibersihkan (lihat §4.1).

### 3.3 Apakah growth-monitoring screen sudah menghitung durasi, atau cuma list mentah?

Ini bukan query SQL — ini baca kode `src/services/growthPhaseService.ts` dan komponen growth-monitoring. Yang dicari: apakah sudah ada fungsi hitung selisih tanggal dari fase berbunga terakhir, atau screen itu saat ini cuma nge-list pohon yang fase-nya "berbunga"/"berbuah" tanpa angka umur.

### 3.4 Skema jadwal/tugas untuk penanda jatuh tempo

```sql
select column_name, data_type
from information_schema.columns
where table_name in ('care_schedules', 'care_tasks')
order by table_name, ordinal_position;
```

Yang dicari: nama kolom tanggal terjadwal (`scheduled_date`? `due_date`?), dan nilai status apa yang berarti "belum selesai" (dipakai buat nentuin terlambat vs sudah kelar duluan sebelum jadi terlambat).

### 3.5 Migration terakhir & penomoran

```sql
select version, name
from supabase_migrations.schema_migrations
order by version desc
limit 5;
```

Buat pastiin nomor migration selanjutnya yang aman dipakai (031 sudah dipakai untuk cleanup per catatan lu), dan pastiin tidak ada migration lain yang nyelip belakangan yang belum tercatat di ringkasan sesi ini.

### 3.6 Grep teks UI yang menyerempet klaim prediksi/estimasi

Ini command shell, bukan SQL — jalanin di terminal tempat repo-nya ada (atau minta Claude Code jalanin):

```bash
grep -rniE "estimasi panen|perkiraan panen|siap panen|layak panen|prediksi" src/ app/
```

Tujuannya: nemuin string UI lama (label, placeholder, teks bantuan) yang mungkin nyisa dari masa sebelum keputusan v4 "non-prediktif" dikunci. Kalau ketemu, itu masuk scope pembersihan RF-11a (bukan fitur baru, tapi memastikan DoD "tidak ada klaim layak panen" benar-benar terpenuhi di UI, bukan cuma di skema data).

---

## 4. Risiko drift dokumen yang ketemu selama audit

### 4.1 Bab 3 SEMPRO (skripsi) masih pakai bahasa "estimasi panen"

Beberapa bagian di `SEMPRO_PXP__Revisi.docx` belum mengikuti keputusan v3→v4 ("estimasi panen" → "penanda umur sejak berbunga, non-prediktif"):

- Tabel 3.2 Data Penelitian: *"Data panen | Estimasi panen dan catatan realisasi panen"*
- Skenario testing US-08 Iterasi 2: *"Pengguna mencatat pohon masuk fase berbunga | Sistem menyimpan fase berbunga dan **menampilkan dasar estimasi panen**"*
- Narasi Activity Diagram 3.7 & 3.12: *"Fase berbunga atau berbuah dapat digunakan sebagai dasar untuk menampilkan estimasi panen"*, *"Estimasi panen dapat ditampilkan berdasarkan fase pertumbuhan tertentu"*

**Ini bukan blocker implementasi kode** — keputusan non-prediktif sudah final di v4 dan `keputusan_desain.md`. Tapi ini utang dokumentasi thesis yang belum tercatat sebagai revisi Bab 3 (di luar RF/US yang sudah disebut di v4 §9). Perlu ditambahkan ke daftar revisi Bab 3 sebelum sidang, supaya tiga sumber (wawancara → keputusan v4 → teks Bab 3) benar-benar sinkron, bukan cuma tabel RF/US-nya.

### 4.2 "Acuan jadwal berikutnya" (MVP lama) ≠ RF-11b (penanda jatuh tempo)

`MVP_Scope_project_awal` (sudah ditandai di nama filenya sebagai "ga sejalan dengan project sekarang") punya bagian §9 "Interval SOP dan Acuan Jadwal Berikutnya": sistem menghitung kapan jadwal *berikutnya* seharusnya dibuat berdasarkan interval SOP + tanggal realisasi terakhir, lalu menampilkan status "belum jatuh tempo/jatuh tempo hari ini/terlambat" untuk **jadwal yang belum dibuat**.

RF-11b di v4 itu beda: menandai jadwal/tugas yang **sudah ada** (sudah dibuat, sudah punya tanggal) tapi belum dikerjakan dan tanggalnya sudah lewat/hari ini. Tidak ada logika "sarankan jadwal berikutnya" di RF-11b.

Kedua istilah ini kebetulan mirip ("jatuh tempo/terlambat") tapi mekanismenya beda kelas — yang satu prediktif-semiotomatis (dan sudah di-deprecate), yang satu murni status dari data yang sudah ada. **Jangan campur** pas desain teknis. Kalau `careSopService.ts` ("next schedule reference", disebut di context doc lama) ternyata sudah mengimplementasikan versi MVP lama itu, itu perlu diperiksa terpisah — apakah mau dipertahankan sebagai fitur lain, atau ikut dipangkas karena bukan bagian dari RF-11 final.

---

## 5. Dependensi tersembunyi yang perlu keputusan lu

`keputusan_desain.md` mencatat celah yang belum diputuskan (bukan keputusan, tapi celah): **catatan perawatan berasal "inisiatif" saat ini tidak bisa dibuka sama sekali dari riwayat** — cuma bisa dibaca kalau bukan record sendiri lewat jalur lain, atau malah tidak bisa dibuka sama sekali (dokumennya bilang "tidak bisa dibuka sama sekali").

RF-12 DoD bilang produk harus "tampil & **dapat ditelusuri** di riwayat pohon". Kalau "ditelusuri" berarti harus bisa dibuka detailnya, RF-12 kebentur langsung ke celah ini. Kalau cukup tampil ringkas di baris list riwayat (misalnya "Semprot — Decis 25 EC — 12 Jul"), tidak perlu buka celah itu.

Ini keputusan desain, bukan sesuatu yang bisa gua tebak sendiri — lihat pertanyaan #3 di §7.

---

## 6. Usulan breakdown changeset (pola: 1 changeset = 1 commit = 1 titik verifikasi)

Mengikuti pola Iterasi A (B2/B3/B4/B5 sebagai sub-item terpisah). Estimasi SP di bawah **tentatif**, tergantung hasil verifikasi §3.

### B-1 — RF-12 Catatan Produk

- **Tujuan**: field produk pada form catatan perawatan; tampil & tertelusur di riwayat pohon.
- **Cabang A** (kolom produk sudah ada dari merge Iterasi A): tinggal expose di form input + tampilkan di riwayat. **Estimasi: 1 SP.**
- **Cabang B** (belum ada): migration tambah kolom nullable + update RPC insert (kalau lewat RPC) + tipe TS + form input + tampilan riwayat. **Estimasi: 2 SP.**
- **DoD**: field tersimpan (opsional, boleh kosong untuk data lama), tampil di riwayat pohon tanpa error untuk record lama yang produknya null.
- **Titik verifikasi**: input 1 catatan dengan produk terisi + 1 tanpa produk → riwayat pohon render dua-duanya tanpa error/NaN/undefined.

### B-2 — RF-11a Penanda Umur Berbunga

- **Tujuan**: tampilkan "N hari sejak berbunga" di dashboard dan/atau detail pohon, dihitung dari tanggal fase "berbunga" terakhir. Tanpa klaim kesiapan panen.
- **Prasyarat**: hasil §3.2 dan §3.3 (nama kolom fase, dan apakah growth-monitoring screen sudah punya bagian ini atau baru list mentah).
- **DoD**: angka hari tampil untuk pohon yang punya riwayat fase berbunga; state kosong yang jelas (bukan NaN) untuk pohon yang belum pernah berbunga; tidak ada teks "estimasi/siap panen" di sekitarnya (hasil grep §3.6 dibersihkan kalau ketemu).
- **Titik verifikasi**: pohon dengan 1 riwayat fase berbunga → angka hari cocok dengan hitungan manual selisih tanggal; pohon tanpa riwayat fase berbunga → tidak error.
- **Estimasi: 1–2 SP** (tergantung apakah tinggal nambah hitungan ke screen yang sudah ada, atau perlu bangun/refactor tampilan).

### B-3 — RF-11b Penanda Jadwal Jatuh Tempo (in-app)

- **Tujuan**: dashboard menandai jadwal/tugas dengan status "belum jatuh tempo / jatuh tempo hari ini / terlambat", murni dari tanggal yang sudah ada di `care_schedules`/`care_tasks`. Tanpa proses latar, tanpa logika "sarankan jadwal berikutnya" (lihat §4.2 — itu scope beda).
- **Prasyarat**: hasil §3.4 (nama kolom tanggal & status).
- **DoD**: badge/label tampil di dashboard (dan idealnya di list jadwal/tugas), dihitung on-demand saat halaman dibuka — bukan cron/background job.
- **Titik verifikasi**: 3 data uji (tanggal lampau, hari ini, mendatang) dengan status belum selesai → badge sesuai; tandai salah satu selesai → badge tidak lagi dihitung terlambat.
- **Estimasi: 1 SP.**

**Total tentatif: 3–5 SP.** Kalau kolom produk memang sudah ada dari Iterasi A (Cabang A di B-1) dan growth-monitoring screen tinggal ditambah hitungan, totalnya pas 3–4 SP — cocok dengan angka 4 SP yang lu sebut dari backlog. Ini validasi kasar, bukan pengganti cross-check langsung ke `backlog_informal_v4.md`.

---

## 7. Pertanyaan yang butuh jawaban lu sebelum lanjut ke desain teknis detail

1. **Kolom produk** — udah ditambahkan pas migration merge Iterasi A (031 atau sebelumnya), atau memang sengaja disisakan buat Iterasi B? (jalanin query §3.1)
2. **Definisi "umur sejak berbunga"** — hitungan cuma tampil selama fase pohon persis "berbunga", atau tetap tampil (basis tanggal berbunga terakhir) walau pohon sudah lanjut ke fase berbuah/siap panen? Wawancara Abah nyebut masalahnya justru muncul di fase berbuah (petik kepagian) — jadi kemungkinan besar perlu tetap tampil minimal sampai fase berbuah kelar, bukan cuma pas fase berbunga.
3. **RF-12 "dapat ditelusuri di riwayat pohon"** — cukup tampil ringkas inline di baris list riwayat, atau ini alasan yang cukup kuat buat sekarang juga nutup celah "detail read-only" yang dicatat di `keputusan_desain.md`? Kalau iya, itu nambah scope di luar estimasi 4 SP awal.
4. **RF-11b level tampil** — badge jatuh tempo di level schedule, task, atau dua-duanya? Cuma dashboard owner, atau juga dashboard worker / halaman list jadwal?
5. **`backlog_informal_v4.md`** — bisa di-share ke project ini? Biar breakdown SP di §6 disilangkan ke angka aslinya, bukan estimasi ulang dari nol kayak sekarang.

---

## 8. Langkah selanjutnya

Begitu §3 (verifikasi DB/kode) dan §7 (keputusan desain) kelar dijawab, gua bisa langsung susun rencana migration + kode per changeset (B-1 → B-2 → B-3, urut dari yang paling kecil scope-nya) dengan pola yang sama seperti Iterasi A: satu changeset, satu commit, satu titik verifikasi manual sebelum lanjut ke changeset berikutnya.
