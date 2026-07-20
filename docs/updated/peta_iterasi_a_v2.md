# Peta Teknis Iterasi A — v2 (Merge & Pemangkasan)

Menggantikan `peta_pemangkasan_b2_b5.md`. Perubahan utama: **B2 bukan lagi dihapus, tapi di-merge.**

> **Keterbatasan sumber.** Disusun dari `AVOLOGY_CURRENT_PROJECT_CONTEXT.md`, bukan dari pembacaan source code langsung. Nama file/fungsi mengacu pada yang tercatat di context. **Verifikasi di kodebase sebelum eksekusi** — mungkin ada dependensi yang tidak tercatat. Ini checklist terpandu, bukan instruksi hapus-buta.

## Prinsip eksekusi

1. **Migrasi data dulu, hapus belakangan.** Jangan DROP tabel di awal.
2. Urutan aman: **migration (tambah kolom) → service → UI/route → (paling akhir) migration pembersih**.
3. `npm run typecheck` hijau setelah tiap langkah.
4. Satu bagian sampai tuntas. Jangan paralel.
5. **B2-merge dulu**, baru B3–B5. Karena B2 menyentuh model data inti.

---

## B2 — MERGE manual care → satu tabel perawatan (RF-13)

**Bukan hapus.** Use case valid: pekerja berinisiatif tanpa instruksi; owner turun tangan langsung lalu mencatat. Masalahnya hanya dua tabel untuk hal yang sama.

### Target akhir
Satu tabel perawatan, dibedakan field `asal` = `terjadwal` | `inisiatif`.

### Langkah

| # | Lapisan | Aksi |
|---|---|---|
| 1 | Migration (tambah) | Tambah kolom `asal` (enum/text, default `terjadwal`) dan longgarkan `tugas_id` jadi **nullable** pada tabel realisasi perawatan. Tambah kolom `produk` sekalian (RF-12 — hemat satu migration). |
| 2 | Migration (backfill) | Salin data `manual_care_records` → tabel realisasi dengan `asal='inisiatif'`, `tugas_id=null`. **Verifikasi jumlah baris cocok sebelum lanjut.** |
| 3 | Service | Gabung `manualCareService.ts` ke service perawatan utama. Satu fungsi create menerima parameter `asal`. Hapus file manual care setelah tidak ada import. |
| 4 | RPC | `update_own_manual_care_record`, `soft_delete_own_manual_care_record` → deprecated. Pastikan RPC perawatan utama menangani baris `asal='inisiatif'`. |
| 5 | Riwayat/timeline | `historyService.ts` / `tree_history_view`: **hapus source manual_care**, baca satu sumber saja. Tampilkan badge asal (terjadwal/inisiatif). |
| 6 | UI/Route | Satukan form. Route `.../trees/[treeId]/care.tsx` **dipertahankan** sebagai jalan masuk pencatatan inisiatif (tidak dihapus), tapi menulis ke tabel utama. Hapus cabang `recordType=manual_care` yang terpisah di record detail. |
| 7 | Tipe | Hapus tipe manual care terpisah; tambahkan `asal` ke tipe perawatan. |
| 8 | Migration pembersih | **Hanya setelah semua di atas lolos:** DROP `manual_care_records` + RPC deprecated. |

### Cek yatim
`grep -rn "manualCare\|manual_care"` → nol sisa aktif (kecuali migration historis).

### Nilai tambah gratis
Setelah merge, owner bisa lihat proporsi **inisiatif vs terjadwal** — tinggal query `GROUP BY asal`.

---

## B3 — Pangkas foto: 7 entitas → 2

**Sisakan:** `condition_record`, `task_proof`.
**Buang:** `growth_phase_record`, `operational_report`, `harvest_record`, `manual_care_record` (hilang via B2).
**Tunda keputusan:** `tree_main` — konfirmasi saat UAT. Foto pohon bisa jadi identitas yang membantu owner, bukan beban.

| Lapisan | Aksi |
|---|---|
| Service `photoAttachmentService.ts` | Sempitkan entity yang didukung |
| Storage helper (`avology_storage_path_entity_folder` dkk) | Sisakan folder 2 entity |
| Migration | **Migration baru** menyesuaikan policy — jangan edit `019_sync_photo_attachment_entity_policies.sql` yang lama |
| UI | Hapus `PhotoPickerCard` dari form phase/harvest/report |
| Tipe | Sempitkan enum entity |

---

## B4 — Sederhanakan CRUD + soft-delete + varian screen

**Target:** create + view + edit-terbatas (hanya pencatat). Hapus soft-delete per-record. Satukan screen detail "dicatat sendiri" & "orang lain" jadi satu file (beda cukup di kondisi tampil tombol).

| Lapisan | Aksi |
|---|---|
| Route `records/[recordType]/[recordId].tsx` + `edit.tsx` | Pertahankan; hapus logika soft-delete; satukan varian sendiri/orang-lain |
| RPC `soft_delete_own_*` (condition, growth, harvest) | Deprecated → DROP di akhir |
| Service | Hapus fungsi `softDelete*` |
| UI | Hapus tombol hapus di detail record |

**Efek:** varian screen "Detail Catatan – dicatat sendiri / orang lain" menyusut 2→1 per jenis record. Ini pemangkasan screen terbesar dari ~100 di V2 review.

---

## B5 — Hapus reopen laporan

| Lapisan | Aksi |
|---|---|
| RPC `reopen_operational_report` | Deprecated → DROP di akhir |
| Service `operationalReportService.ts` | Hapus fungsi `reopen*` |
| UI | Hapus screen "Detail Laporan – Setelah Klik Buka Ulang" |
| Status | Sederhanakan enum status sesuai RF-10 (tanpa status berlapis) |

---

## Definition of Done — Iterasi A

- [ ] Satu tabel perawatan dengan field `asal`; `manual_care_records` kosong/terhapus
- [ ] Riwayat pohon membaca **satu sumber**
- [ ] Pencatatan inisiatif (tanpa jadwal) berfungsi
- [ ] `npm run typecheck` hijau
- [ ] `grep manualCare|manual_care|reopen|softDelete` → nol sisa aktif
- [ ] Tidak ada route mengarah ke file terhapus (cek `_layout.tsx`)
- [ ] Flow inti utuh: pohon, kondisi, jadwal, tugas, realisasi, panen, dashboard
- [ ] Migration pembersih disiapkan **terpisah**, dijalankan hanya setelah semua lolos
- [ ] Hitung ulang jumlah screen; bandingkan dengan ~100 (V2 review) sebagai bukti pemangkasan

---

## Catatan urutan

RF-12 (`produk`) sengaja dititipkan di migration B2 langkah 1 walau resminya Iterasi B — menghemat satu migration pada tabel yang sama. Implementasi UI-nya tetap di Iterasi B.
