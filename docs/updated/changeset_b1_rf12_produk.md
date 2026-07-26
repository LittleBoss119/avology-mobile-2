# Changeset B-1 — RF-12 Catatan Produk Perawatan

Bagian dari Iterasi B. Satu changeset = satu commit = satu titik verifikasi.
Rujukan: `landasan_avology_v4.md` §6 (DoD RF-12), keputusan sesi ini.

---

## STATUS: SELESAI — commit `4ef6b3d`

Migration 032 (`032_rf12_produk_view_and_complete_task.sql`) dijalankan manual via
SQL Editor & terverifikasi (view definition, signature complete_task tunggal/tidak
overload, grant `authenticated` utuh). Sisi aplikasi + migration di-commit bersama.

### Koreksi terhadap rencana awal (dicatat untuk auditability, bukan disembunyikan)

Rencana awal changeset ini keliru di dua titik; keduanya terkoreksi setelah audit
langsung ke DB & kode (lihat prinsip di `keputusan_desain.md`: audit fakta, bukan asumsi):

1. **"Tanpa migration" → SALAH.** §0 di bawah semula menyatakan B-1 murni kerjaan
   aplikasi karena kolom `produk` sudah ada. Faktanya `tree_history_view` belum
   menyertakan `produk` di SELECT → **butuh migration 032** untuk jalur tampil.

2. **Produk semula direncanakan hanya di form (inisiatif) → DILUASKAN ke jalur
   terjadwal.** Audit menemukan ada 2 pintu tulis ke `care_activities`: inisiatif
   (`create_care_activity`, produk sudah lengkap sejak migration 027) dan terjadwal
   (`complete_task`, belum kenal produk). Karena mayoritas pemakaian produk justru
   lewat perawatan terjadwal (semprot/pupuk ber-SOP — wawancara Abah [08:23],[20:44]),
   produk **wajib** masuk jalur terjadwal agar RF-12 menutup use case aslinya.
   Konsekuensi: 032 juga me-`replace` `complete_task` (drop dulu → hindari overload,
   pelajaran migration 024). Estimasi naik ~1 SP → ~2 SP, masih dalam anggaran Iterasi B.

### Celah yang SENGAJA ditunda (bukan bug)

- **Edit realisasi tidak bisa mengubah produk.** `updateLatestTaskRealization` hanya
  menyentuh note+status. Worker mengisi produk saat "Selesaikan", tapi tak bisa
  mengoreksinya saat edit. Ditunda ke UAT — kalau terbukti mengganggu, itu alasan sah
  untuk ditambah (siklus PXP), catat di `keputusan_desain.md` saat itu.

### Yang inisiatif — tidak disentuh sama sekali

Jalur inisiatif (kolom→RPC→service→tipe→form) sudah 100% jadi sejak Iterasi A.
Nol perubahan di jalur ini pada B-1.

---

## 0. Ringkasan keputusan yang mengikat changeset ini

> Catatan: poin "Tanpa migration" di bawah adalah rencana AWAL yang kemudian
> dikoreksi — lihat blok STATUS di atas. Dipertahankan apa adanya sebagai jejak.


- **Tanpa migration.** Kolom `care_activities.produk` (text, nullable) sudah ada — terverifikasi via `information_schema.columns`. Ini murni kerjaan aplikasi.
- **Produk = opsional.** Boleh kosong. Data lama (produk null) harus render tanpa error.
- **RF-12 "dapat ditelusuri" = tampil inline di riwayat pohon**, bukan buka layar detail read-only. Celah detail read-only ditunda ke Iterasi C (keputusan #3 sesi ini).
- **Constraint terkait yang tidak boleh dilanggar** (terverifikasi via `pg_constraint`):
  - `care_activities_asal_check`: `asal ∈ {'terjadwal','inisiatif'}`.
  - `care_activities_asal_source_check`: kalau `asal='inisiatif'` maka `care_task_id IS NULL` **dan** `category IS NOT NULL`. → Produk tidak mengubah aturan ini; produk berdiri sendiri di atas category. Jangan sampai nambah field produk bikin form lupa ngirim `category` untuk inisiatif.

---

## 1. Verifikasi pra-kode (WAJIB sebelum ngetik — jangan percaya asumsi nama file)

Snapshot repo yang gua punya sudah basi (pra-Iterasi A). Nama file di §2 adalah **dugaan berbasis konvensi**, bukan fakta. Konfirmasi dulu 4 hal ini — lewat editor lu, atau minta Claude Code (ingat: Claude Code juga tidak punya akses DB, tapi dia BISA baca file repo — jadi untuk hal-hal ini dia sumber yang sah).

### V1 — Service tulis catatan perawatan
Cari service yang meng-`insert` ke `care_activities`. Kemungkinan `src/services/careActivityService.ts` atau sejenis (bukan `manualCareService.ts` — itu sudah di-drop di Iterasi A).

Yang dicari:
- Fungsi create-nya. Apakah insert langsung `supabase.from('care_activities').insert({...})`, atau lewat RPC (`supabase.rpc('...')`)?
- **Kalau lewat RPC**: nama RPC-nya apa, dan apakah signature-nya sudah punya parameter produk? Kalau belum, `produk` tidak akan bisa masuk lewat RPC tanpa mengubah fungsi RPC-nya → itu berubah jadi butuh migration kecil (ALTER FUNCTION), naik dari 1 SP. **Ini satu-satunya hal yang bisa bikin estimasi 1 SP meleset — cek ini pertama.**
- Kalau insert langsung dari client: tinggal tambah `produk` ke objek insert. Tetap 1 SP.

### V2 — Tipe domain
Cari `src/types/domain.ts` (atau file tipe terkait care activity). Yang dicari: tipe `CareActivity` / `CreateCareActivityInput` / row type-nya. Perlu tambah field `produk` / `product`.

### V3 — Form catat perawatan
Cari komponen form catat perawatan (kemungkinan `src/components/*care*record*` atau di `app/(owner|worker)/.../care.tsx`). Yang dicari: di mana field `category` dan `note` dirender — field produk nempel di situ.

### V4 — Riwayat pohon (tampil inline)
Cari yang baca `tree_history_view` (kemungkinan `src/services/historyService.ts`, fungsi `getTreeHistory`) dan komponen yang me-render timeline riwayat.
- **Krusial**: apakah `tree_history_view` sudah menyertakan kolom `produk` di SELECT-nya? View ini terakhir disentuh migration `028_tree_history_view_multi_tree_care`. Kalau `produk` **tidak** ikut di-select oleh view, maka menampilkan produk di riwayat butuh **update view = migration** → naik jadi ~2 SP dan butuh nomor migration 032.

Query cek isi view (jalanin di SQL Editor):

```sql
select pg_get_viewdef('tree_history_view'::regclass, true);
```

Baca apakah `produk` (atau alias-nya) muncul di definisi view untuk baris yang berasal dari `care_activities`.

---

## 2. Rencana perubahan (setelah V1–V4 terkonfirmasi)

Urutan ngoding: data masuk dulu (tulis), baru tampil (baca). Biar bisa diverifikasi bertahap.

### 2a. Jalur tulis — form → simpan
1. **Tipe** (V2): tambah `produk?: string | null` ke input create dan ke row/domain type.
2. **Service** (V1):
   - Kalau insert langsung: tambah `produk: normalizeOptionalText(input.produk)` ke objek insert (pola `normalizeOptionalText` sudah dipakai di `growthPhaseService` — ikuti gaya yang sama: string kosong → null).
   - Kalau lewat RPC tanpa param produk: STOP, ini bukan lagi 1 SP. Balik lapor, putuskan apakah update RPC (migration 032) masih masuk changeset ini atau dipecah.
3. **Form** (V3): tambah satu input teks opsional berlabel misalnya **"Produk / Merek (opsional)"**, placeholder contoh `"mis. Decis 25 EC, NPK Mutiara"`. Tempatkan setelah kategori/jenis perawatan, sebelum catatan. Tidak wajib diisi. Jangan mengubah validasi `category` yang sudah ada (ingat constraint inisiatif wajib category).

### 2b. Jalur baca — riwayat pohon (inline)
- **Kalau `produk` sudah ada di `tree_history_view`** (V4 hasil A): tinggal ambil di service history + render di baris timeline. Format usulan: `Semprot · Decis 25 EC · 12 Jul`. Kalau produk null, cukup `Semprot · 12 Jul` (jangan render `· ·` atau `null`).
- **Kalau `produk` belum ada di view** (V4 hasil B): butuh migration 032 update view untuk ikut select `produk`. Ini mengubah scope B-1 → catat sebagai temuan, dan pertimbangkan pisah jadi B-1a (form/tulis) + B-1b (view/tampil). Tetap satu iterasi, tapi dua commit.

---

## 3. Definisi Selesai (DoD) changeset ini

- [ ] Form catat perawatan punya field produk opsional; bisa disimpan terisi maupun kosong.
- [ ] Catatan `asal='inisiatif'` tetap tersimpan tanpa melanggar constraint (category tetap terisi, task_id null).
- [ ] Riwayat pohon menampilkan produk inline saat ada; rapi (tanpa `null`/pemisah gantung) saat kosong.
- [ ] Data catatan lama (produk null) render tanpa error.
- [ ] `npm run typecheck` lolos.

## 4. Titik verifikasi manual (sebelum commit)

1. Catat 1 perawatan **terjadwal** (dari realisasi task) dengan produk terisi → cek riwayat pohon: produk tampil.
2. Catat 1 perawatan **inisiatif** (tanpa jadwal) dengan produk terisi → tersimpan (tidak kena error constraint), tampil di riwayat.
3. Catat 1 perawatan **tanpa** produk → tersimpan, riwayat tampil rapi tanpa `null`.
4. Buka pohon yang punya catatan lama pra-B1 (produk null) → riwayat tidak error.

## 5. Commit

Satu commit setelah 4 titik verifikasi hijau. Saran pesan:
`feat(rf-12): catat & tampilkan produk perawatan di riwayat pohon`

Kalau ternyata jalur view butuh migration (hasil B di §2b), pecah:
- `feat(rf-12): field produk pada form & simpan catatan perawatan`
- `feat(rf-12): tampilkan produk di riwayat pohon (view 032)`

## 6. Yang TIDAK dikerjakan di changeset ini (biar scope tidak melebar)

- Detail read-only catatan perawatan (celah US-14) → Iterasi C.
- Filter/pencarian riwayat berdasarkan produk → belum ada dasar triangulasi; jangan tambah.
- Autocomplete/daftar produk yang pernah dipakai → menarik, tapi belum diminta. Catat sebagai kandidat kalau UAT menunjukkan pengetikan ulang merek jadi beban.

---

## 7. Setelah B-1 hijau

Lanjut ke **B-2 (RF-11a penanda umur berbunga)** — sudah terverifikasi butuh kerja nyata karena `getFloweringAndFruitingTrees` saat ini cuma nge-list, belum menghitung selisih tanggal dari record `flowering` terakhir. Rencana teknisnya disusun terpisah begitu B-1 di-commit.
