# KONTEKS AVOLOGY — Iterasi Polish

**File konteks tunggal.** Menggantikan kebutuhan membaca `handoff_iterasi_polish.md`,
`landasan_avology_v4.md`, `keputusan_desain.md`, `design_token_v1.md`, dan
`iterasi_polish_kandidat.md` di awal setiap chat unit.

Simpan di `docs/updated/KONTEKS_AVOLOGY_POLISH.md`, unggah ke Project Knowledge,
dan **hapus dokumen lain dari Project Knowledge** supaya tidak ikut terbaca.

Status per: setelah audit isolasi Unit 1 (30 Juli 2026).

---

## 0. Cara pakai file ini

**Awal chat unit baru, kirim ini saja:**

> Lanjut Iterasi Polish Avology — [nama unit]. Baca `KONTEKS_AVOLOGY_POLISH.md`
> di project knowledge. Jangan baca dokumen lain. Mulai dengan prompt audit
> isolasi (§11) untuk file berikut: [daftar file].

Aturan hemat token:
- **Jangan baca dokumen lain** kecuali file ini eksplisit menyuruh.
- **Jangan audit ulang** apa pun di §4 dan §9.
- Satu chat = satu unit. Begitu konteks terasa berat, buka chat baru + file ini.
- Setelah unit selesai, **update §7, §8, §12** di file ini, bukan bikin dokumen baru.

---

## 1. Proyek

Avology — app mobile manajemen kebun alpukat untuk M.S. Farm. Skripsi S1, metodologi
**Personal Extreme Programming (PXP)**. Dua user: pemilik ("Abah") dan pekerja tetap
("Om Ari"). Stack: **React Native / Expo SDK 56** + **Supabase**. Migrasi DB dijalankan
manual via Supabase SQL Editor, dicatat di repo.

Prinsip pengikat: modul utama = manajemen kebun; **simplicity di atas kelengkapan**
(prinsip GIGO pemilik: "kalau input ribet, Om Ari nggak akan mau pakai"); sistem
informasi, bukan prediksi/IoT; sukses = dipakai, bukan lolos tes.

Branch aktif: `ui-reconstruction-batch-1-foundation`.

---

## 2. Peran & workflow wajib

**Peran Claude:** Lead UI/UX Architect senior, iOS HIG + Material 3, pragmatis, benci
over-engineering, usability & information architecture di atas estetika. Frank, alasan
eksplisit tiap rekomendasi, pushback kalau Harish salah. Bahasa Indonesia, register lu/gua.

**Urutan per unit — jangan dilompati:**

1. **Audit isolasi** lewat Claude Code — read-only, fakta + nomor baris, dilarang menebak
2. **Keputusan desain di depan** — tanya Harish pakai tombol pilihan sebelum ngoding
3. **Mockup** pakai visualizer sebelum implementasi
4. **Implementasi** oleh Claude Code, dengan pre-flight gate untuk hal yang belum pasti
5. **Tes device** per unit
6. **Commit oleh Harish**, bukan Claude Code

Satu unit = satu commit = satu titik verifikasi.

**Cara menegakkan gate:** jangan tulis "STOP, butuh keputusanmu" di prompt Claude Code —
itu pernah dijawab sendiri lalu lanjut ngoding di P-9b Commit 3. Tulis gate sebagai
**pertanyaan tanpa jawaban di prompt**, dan jangan kirim prompt implementasi sebelum
Harish menjawab.

**Batas praktis:** maksimal ~4–5 alur layar-per-peran per unit untuk tes device. Satu
layar yang dipakai owner **dan** worker = 2 alur.

---

## 3. Sembilan aturan desain terkunci

Hasil keputusan sadar. Patuhi semua; kalau mau melanggar, minta izin eksplisit.

1. **Header dilarang memuat subtitle penjelas.** Kalau user butuh kalimat untuk paham
   fungsi halaman, itu kegagalan IA. Sapaan boleh, tapi di konten, bukan di header.
2. **Form tanpa tombol Batal.** Jalan keluar lewat chevron back di header, yang selalu
   terlihat karena header sticky. Batal = duplikat yang makan ruang.
3. **Header pinned, tanpa animasi.** Hairline tetap, tanpa shadow, tanpa perubahan warna
   saat scroll, tanpa listener `onScroll`.
4. **Yang dipaku hanya header.** Search, filter chips, ResultCount, FAB, sapaan, dan
   `footer` tetap menggulung. `stickyFooter` sengaja tidak dipakai (ditolak di mockup).
5. **Konfirmasi sukses pakai snackbar, bukan modal.** Modal hanya untuk error atau
   keputusan. `showSnackbar` dari `src/components/snackbar.tsx`.
6. **Error validasi inline per-field; `ErrorBanner` hanya untuk error sistem/jaringan.**
   Semua field kosong ditandai **sekaligus** dalam satu submit, bukan satu-satu.
7. **Aksi Hapus tinggal di sheet hanya kalau tidak ada affordance langsung di permukaan.**
   Form punya tombol X di thumbnail → sheet tanpa Hapus. Detail pohon tanpa X → Hapus di sheet.
8. **Satu jalan untuk satu aksi.** Sudah dua kali jadi sumber masalah (tombol teks vs
   sheet foto; Batal vs chevron). Ketemu lagi → pilih satu.
9. **Perubahan primitif harus aditif.** Prop opsional default `undefined` supaya blast
   radius nol saat diperkenalkan; migrasi pemakai per unit sesudahnya.

---

## 4. Fakta arsitektur terverifikasi — JANGAN AUDIT ULANG

- **`Screen` adalah satu-satunya ScrollView.** Nol `FlatList`/`SectionList`/`SafeAreaView`
  di seluruh `app/` dan `src/`. Tidak ada layar yang bikin scroll sendiri.
- **`Screen` props:** `children`, `header`, `footer`, `stickyFooter` (nol pemakai),
  `floatingAction`, `floatingActionBottom`, `contentStyle`, `variant`
  (`default`/`soft`/`surface`). Selalu padded, selalu ScrollView. Definisi: `ui.tsx:56-102`.
- **Safe-area atas** diterapkan `TopAppBar` (`Math.max(insets.top, spacing.sm)`), bukan
  `Screen`. Jangan dobel.
- **Jarak header→konten** = `paddingTop: spacing.xl` (20) milik contentContainer.
- **`TopAppBar` tidak punya border bawah sendiri.** Hairline satu-satunya ada di wrapper
  `header` milik `Screen`. Prop `subtitle` ada di `ui.tsx:182` tapi jangan diisi (aturan #1).
- **`Field` shared** (`ui.tsx:735-792`) punya `error` inline (`ui.tsx:744`) tapi
  **single-line saja** — tidak ada `multiline`.
- **Tidak ada primitif "selectable option"/segmented** di `ui.tsx`. Setiap layar bikin
  chip pilihan lokal sendiri.
- **Bottom nav dirender di layout, di luar `Screen`** — tidak berinteraksi dengan header.
- **`feedback.ts` ada di `src/components/feedback.ts`** (bukan `src/utils/`).
  `showSuccessToast` sebenarnya `Alert.alert` — nama menyesatkan. Pemakai: hanya
  `app/(owner)/owner/workers.tsx:23` dan `src/components/profile-screen.tsx:9`.
- **Empat pola layar:**
  - **A** — `MainTabHeader` (tab root). 8 sudah migrasi; reports tertinggal.
  - **B** — `TopAppBar` (detail/form). Mayoritas. Belum migrasi kecuali 3 layar pohon.
  - **C** — native Stack header, khusus owner, 4 layar: `growth-monitoring`,
    `tasks/index`, `workers`, `farm-profile`. Semua layar worker `headerShown:false`.
  - **D** — tanpa header: `get-started`, `access-status`, `index`.

---

## 5. Cheatsheet design token

Layer `tokens` di `src/constants/theme.ts` (aditif). Ekspor lama (`colors`, `spacing`,
`radius`, `typography`, `shadows`, `statusColors`, `theme`) masih utuh — dihapus di
commit pembersih akhir setelah grep membuktikan nol pemakai.

**Grup token:** `tokens.color.{brand,text,surface,line,status,record,overlay}`,
`tokens.type.*`, `tokens.space.*`, `tokens.radius.*`, `tokens.layout.*`,
`tokens.icon` (sm16/md20/lg24/stroke2), `tokens.elevation.overlay`.

**Nilai yang sering dipakai:**

| Peran | Token | Nilai |
|---|---|---|
| Hijau utama | `color.brand.base` | `#065F2E` |
| Hijau soft | `color.brand.soft` | `#E7F5EC` |
| Teks utama | `color.text.primary` | `#17231B` |
| Teks sekunder | `color.text.secondary` | `#5B6B60` |
| Teks tersier | `color.text.tertiary` | `#8A978D` |
| Latar layar | `color.surface.canvas` | `#F7FAF3` |
| Kartu | `color.surface.card` | `#FFFFFF` |
| Border kartu | `color.line.card` | `#DDE8D8` |
| Divider | `color.line.hairline` | `#E7EEE3` |

**Skala tipografi:** `display` 32/700/38 · `title` 24/700/30 · `heading` 20/700/26 ·
`subheading` 17/600/23 · `body` 16/400/22 · `bodyStrong` 16/600/22 · `bodySmall` 14/400/20 ·
`label` 14/500/20 (label form & metrik) · `meta` 13/400/18 · `caption` 12/600/16.

**Aturan berat huruf:** literal `'800'`/`'900'` turun ke `700`; `subheading` &
`bodyStrong` ke `600`.

**Radius:** `control` 14 · `cardInner` 16 · `card` 20 · `sheet` 28 · `pill` 999.

**Layout:** `screenX` 16 · `screenTop` 20 · `sectionGap` **24** · `cardPadding` 16 ·
`listGap` 12 · `controlHeight` **56** · `rowMinHeight` 48 · `tapTarget` 44.

**Tiga perubahan nilai yang DISENGAJA** (jangan dianggap bug):
warna panen `#FFF4D6`/`#8A5B00` → `#FDEBD9`/`#9A4C0A` · `sectionGap` 18 → 24 ·
`controlHeight` 52 → 56. Selain ini, migrasi token **tidak boleh** mengubah warna.

**Belum dipetakan** (diputuskan saat layar terkait): accent visual pohon
`#DCEFE3 #B8D8BF #5C8A45 #FFF8E8 #C49A25 #8A9A31 #A6D96A #FDA29B #F6D77A`,
`pending*`, `photoPlaceholder #EAF0E6`, `navLabel` 11px.

---

## 6. Batas scope — yang SENGAJA tidak ada

Kalau muncul "kok nggak ada X?", cek daftar ini dulu. Kalau X di sini, jangan tambah
tanpa alasan baru yang lolos triangulasi (≥2 dari wawancara/observasi/literatur).

| Fitur | Alasan | Boleh ditinjau kalau... |
|---|---|---|
| Foto di catatan **perawatan**, **fase**, **panen**, **laporan operasional** | Beban input tanpa dasar kebutuhan. Foto disisakan **hanya** di kondisi pohon & bukti task. | Diminta spesifik saat UAT |
| Foto pohon utama (`tree_main`) | **Ditahan, belum diputuskan** — mungkin identitas visual, beda kelas dari foto-bukti. | Konfirmasi UAT |
| Edit & hapus catatan perawatan | CRUD penuh + soft-delete per record = biang ~100 layar di V2. | Pekerja mengeluh salah catat |
| Soft-delete per record | Sama. | Sama |
| Layar detail terpisah "dicatat sendiri" vs "orang lain" | Dua file satu tujuan. Cukup beda kondisi tampil tombol. | — |
| Reopen laporan; status berlapis di laporan lapangan | Tidak pernah diminta. | — |
| Jalur pencatatan perawatan ganda | Satu tabel `care_activities`, dibedakan field `asal`. | — |
| Multi-select pohon di layar catat perawatan | Masuk dari detail pohon A-2 → konteks sudah jelas. Model `care_activity_trees` tetap many-to-many, hanya UI disederhanakan. | Terbukti sering merawat beberapa pohon sekaligus |
| Layar khusus perawatan multi-pohon | Belum terbukti dibutuhkan; model data sudah siap. | Jawaban UAT tentang penyemprotan |
| Prediksi/estimasi panen | Bertentangan dengan batasan masalah. Sistem hanya tampilkan **"N hari sejak berbunga"**. | — |
| Pencatatan finansial/upah, target kuantitas & grading panen, integrated farming | Out of scope skripsi, dicatat jujur di Batasan Masalah. | Pengembangan lanjutan |
| Push notification | Opsional, Iterasi D, boleh gagal. Penanda in-app sudah menutup kebutuhan inti. | — |
| Sistem notifikasi in-app penuh (lonceng + badge belum-dibaca + pusat notifikasi) | Butuh tabel notifikasi + status baca per-user + logika "kapan notif lahir". Kelas fitur berstate; risiko mandek jilid dua. | UAT membuktikan perlu |
| Sync engine offline | Diganti draft lokal + tombol kirim ulang manual. | — |
| IoT, sensor, drone, GIS | Batasan masalah. | — |
| Migrasi ke `@gorhom/bottom-sheet` | Butuh gesture-handler + reanimated + konfigurasi root. Menyentuh fondasi, berisiko. Sheet sekarang pakai Modal bawaan dan fungsional. | Tidak dikejar deadline |
| Highlight/auto-scroll baris pohon baru setelah tambah | Butuh tahu urutan sorting. | Kandidat polish opsional |

**Koreksi penting (30 Juli 2026):** baris "Yang MASIH kurang → detail read-only catatan
perawatan" di `keputusan_desain.md` sudah **STALE**. Kapabilitas itu sudah terpasang
end-to-end (bukti di §9.4). Iterasi C kembali ke definisi landasan v4: **RF-10 laporan
lapangan + draft offline saja.**

**Jejak keputusan yang jangan diulang perdebatannya:**
- `row`/`column` = koordinat lokasi pohon, bukan unit kerja. Pekerja tidak berpikir
  "saya menyemprot kolom 3"; baris/kolom hanya alat bantu filter saat memilih pohon.
- Visibilitas riwayat dilonggarkan (029): semua anggota aktif kebun melihat semua catatan
  perawatan. Kalau owner mencatat tapi worker tidak melihat, riwayat jadi bohong.
- `react-native-svg` dipasang di Iterasi B sebagai fondasi ikon (path verbatim Tabler
  Icons di `src/components/icons.tsx`). Glyph hand-drawn (View+border) sudah pensiun —
  sisa terakhir hanya `TreeVisualPlaceholder` di `tree-components.tsx:199-247`.
- **Drop before replace** pada function Postgres; **rewrite RLS policy sebelum drop
  function** yang direferensikan.
- Live DB bisa melenceng dari migration ter-commit (kasus `get_farm_actor_display_profiles`,
  diperbaiki migration 033). Verifikasi keberadaan objek di DB, jangan asumsikan.

---

## 7. Status pekerjaan

### Fondasi — SELESAI
Design token (`tokens` di `theme.ts`) · ikon SVG (`icons.tsx`, path Tabler) · bottom nav
(`role-bottom-navigation.tsx`) · primitif shared di `ui.tsx` · `BottomSheet` +
`PhotoSourceSheet` bersama · `Snackbar` (`snackbar.tsx`, `SnackbarProvider` di root
layout, `showSnackbar(text)`, auto-dismiss 3500ms, tanpa tombol aksi).

### Layar selesai dipoles penuh
Beranda owner · beranda worker · daftar jadwal owner · daftar pohon owner · daftar tugas
worker · detail pohon · P-13 form tambah/edit pohon · P-9b header sticky (lintas layar).

### Kena migrasi header saja, belum direview isinya
`worker/trees/index.tsx` · `owner/farm.tsx` · `worker/farm.tsx`

### ⚠ BLOCKER AKTIF — P-9b belum tutup, nol commit

`git log` tidak punya satu pun commit P-13/P-9b. 16 file `M` + 2 `??`, staging kosong,
`ui.tsx` termodifikasi 165 baris. **Empat unit menumpuk di satu working tree.**

Syarat tutup sebelum unit baru mana pun diimplementasikan:

- [ ] Tes device P-9b Commit 3: detail pohon (owner + worker + cabang error), tambah
      pohon, edit pohon
- [ ] Regresi cepat: satu layar Pola B yang belum dimigrasi (Detail SOP / Login) —
      header harus **masih ikut scroll**, membuktikan tidak bocor
- [ ] Pisah jadi commit terpisah: P-13, P-9b c1, c2, c3, migrasi Modal→BottomSheet.
      `ui.tsx` kena hampir semuanya → wajib `git add -p`
- [ ] `snackbar.tsx` (untracked) ikut commit unit yang memperkenalkannya
- [ ] Aturan §3 no.1 dan no.2 dicatat di `keputusan_desain.md`

Kenapa keras: `ui.tsx` sudah 165 baris diff campur 5 niat. Tiap unit tambahan menaikkan
peluang salah pisah, dan kalau salah pisah, rollback safety yang jadi alasan
"satu unit satu commit" hilang — plus jejak velocity per iterasi untuk retrospektif PXP
jadi tidak akurat.

### Isi working tree per 30 Juli 2026 (dari `git status`)

Dugaan pemetaan ke unit — **wajib dikonfirmasi dari diff sebelum commit**, jangan dipakai
mentah:

| File | +/− | Dugaan unit |
|---|---|---|
| `app/_layout.tsx` | 41 | Snackbar (SnackbarProvider di root) |
| `src/components/snackbar.tsx` | `??` baru | Snackbar |
| `src/components/tree-components.tsx` | 213 | P-13 (`TreeForm`, `validateTreeForm`) |
| `app/(owner)/owner/trees/create.tsx` | 44 | P-13 + P-9b c3 |
| `app/(owner)/owner/trees/[treeId]/edit.tsx` | 44 | P-13 + P-9b c3 |
| `src/components/tree-detail-screen.tsx` | 182 | P-9b c3 |
| `app/(owner)/owner/index.tsx` | 26 | P-9b c2 |
| `app/(owner)/owner/schedules/index.tsx` | 17 | P-9b c2 |
| `app/(owner)/owner/trees/index.tsx` | 18 | P-9b c2 |
| `app/(owner)/owner/farm.tsx` | 6 | P-9b c2 |
| `app/(worker)/worker/index.tsx` | 28 | P-9b c2 |
| `app/(worker)/worker/tasks/index.tsx` | 16 | P-9b c2 |
| `app/(worker)/worker/trees/index.tsx` | 17 | P-9b c2 |
| `app/(worker)/worker/farm.tsx` | 5 | P-9b c2 |
| `src/components/ui.tsx` | 165 | **CAMPUR** — c1 (prop `header`) + P-13 (`Field.error`) + PhotoPickerCard + kemungkinan snackbar |
| `src/components/bottom-sheet.tsx` | 46 | `PhotoSourceSheet` shared — unit belum jelas |
| `src/components/icons.tsx` | 2 | ikut unit yang butuh ikonnya |
| `docs/updated/handoff_iterasi_polish.md` | `??` | digantikan file ini — hapus, jangan di-commit |

Urutan commit yang disarankan (dari paling bawah dependensinya):
**c1 (prop `header` di `Screen`) → snackbar → P-13 → c2 → c3 → PhotoSourceSheet.**

### Prompt rencana pisah commit (READ-ONLY, jalankan sebelum `git add -p`)

```
Tugas: RENCANA PISAH COMMIT, READ-ONLY. Jangan ubah file, jangan stage, jangan
commit, jangan stash. Hanya baca diff dan lapor.

Baca `git diff` untuk file-file ini dan petakan SETIAP HUNK ke satu unit:
  c1        = prop `header?: ReactNode` di Screen (aditif, sibling di luar ScrollView)
  snackbar  = Snackbar + SnackbarProvider
  P-13      = form tambah/edit pohon (TreeForm, validateTreeForm, Field.error inline)
  c2        = 8 layar Pola A → slot header, MainTabHeader jadi satu baris
  c3        = detail pohon + create/edit pohon → slot header, tombol Batal dibuang
  sheet     = PhotoSourceSheet shared
  ?         = tidak bisa ditentukan

Fokus utama: `src/components/ui.tsx` (165 baris) dan `src/components/bottom-sheet.tsx`
(46 baris). Untuk kedua file ini, daftarkan TIAP hunk: rentang baris, ringkasan satu
baris isi perubahannya, unit tujuannya, dan tingkat keyakinan (pasti / ragu).

Untuk 14 file lain, cukup satu baris per file: unit tujuannya + bukti dari diff.

Lapor juga: hunk mana yang TIDAK BISA dipisah karena bercampur dalam satu blok
kode (butuh `git add -e`, bukan `-p`).

BERHENTI setelah laporan. Jangan stage apa pun. Jangan usulkan perintah git untuk
dijalankan otomatis — Harish yang commit.
```

### Checklist tes device P-9b sebelum commit

Header harus **tetap terpaku** saat konten digulung:
- [ ] Detail pohon — owner
- [ ] Detail pohon — worker
- [ ] Detail pohon — cabang error (pohon tidak ditemukan / gagal muat)
- [ ] Tambah pohon (validasi: submit kosong → semua field wajib ditandai **sekaligus**)
- [ ] Edit pohon (submit sukses → **snackbar**, bukan Alert; keluar lewat chevron, nol Batal)

Regresi kebocoran — header harus **masih ikut menggulung**:
- [ ] Satu layar Pola B yang belum dimigrasi (Detail SOP atau Login)

Kalau salah satu gagal, perbaiki **sebelum** memisah commit — jangan commit lalu tambal.

---

## 8. Utang teknis — tempelkan ke unit yang menyentuh filenya

| Item | Tempat beres |
|---|---|
| **`owner/workers` header GANDA** (native "Manajemen Pekerja" + `TopAppBar` "Pekerja"). Bug. | Unit kebun & pekerja |
| **`feedback.ts`** — `showSuccessToast` sebenarnya `Alert.alert`. Migrasi ke snackbar. Pemakai: `owner/workers.tsx:23`, `profile-screen.tsx:9`. | Unit kebun & pekerja |
| **Rute `harvest` & `care` (owner+worker) berisiko header dobel** — tidak terdaftar di Stack layout, tidak menyetel `headerShown:false`, `screenOptions` default tidak mematikan header. Perlu konfirmasi device. | Unit 1b |
| **Migrasi `Field` ke `tokens`** — masih literal (`borderRadius:14`, `minHeight:54`, `fontSize:16`). Blast radius = semua form. Radius 14 kebetulan sama dengan token → nol beda visual. | Unit terpisah, menjelang akhir |
| **Reports header** belum migrasi — `operational-report-screen.tsx` mengoper header lewat prop sendiri, dirender sebagai anak scroll, satu-satunya pemakai `stickyFooter`. | Unit laporan |
| **Pola C → `headerShown:false` + `TopAppBar`** untuk 4 layar owner. | Unit masing-masing |
| **Judul kartu perawatan di riwayat = kategori** (bukan "Perawatan inisiatif" yang redundan dengan badge). Butuh: migration expose `ca.category` di `tree_history_view`; `category` di `TREE_HISTORY_SELECT` + `mapTreeHistoryItem` (`historyService.ts:17,178`); `category?` di `TreeHistoryItem` (`domain.ts:211`, aditif); pakai di `formatHistoryTitle` (`tree-components.tsx:953`). **Bukan** file Unit 1. | Unit riwayat/timeline |
| **Angka tugas Beranda owner salah hitung** — `countFarmUnfinishedTasks` masih hitung postponed sebagai belum selesai; `countFarmTasksDueToday` tanpa filter status & tidak kecualikan jadwal cancelled. Selaraskan dengan RF-11b (eksklusif: terlambat / hari ini / akan datang; kecualikan postponed & cancelled). | Unit beranda owner |
| **Redesign dashboard owner** — sekarang terasa daftar notifikasi (tumpukan kartu "ada X perlu ditindak"), bukan ringkasan visual. Tab bernama "Beranda" tapi konsepnya "Dashboard". Bagian atas ikut loading saat refresh. | Unit beranda owner |
| **Prop `subtitle` di `TopAppBar`** masih ada. Setelah semua Pola B direview, evaluasi cabut total. | Commit pembersih |
| **`stickyFooter`** nol pemakai. Kalau sampai akhir tetap nol, cabut. | Commit pembersih |

---

## 9. Hasil audit isolasi Unit 1 — SUDAH DIBAYAR, JANGAN ULANG

Enam file di `src/components/`, semua dipakai owner **dan** worker → **12 alur device**.
Wrapper rute tipis, semua mengoper `basePath`.

### 9.1 Peta file

| Kode | File | Baris | Komponen | Rute |
|---|---|---|---|---|
| F1 | `tree-care-activity-screen.tsx` | 263 | `TreeCareActivityScreen` | `trees/[treeId]/care.tsx` |
| F2 | `tree-condition-report-screen.tsx` | 394 | `TreeConditionReportScreen` | `trees/[treeId]/report.tsx` |
| F3 | `tree-harvest-record-screen.tsx` | 239 | `TreeHarvestRecordScreen` | `trees/[treeId]/harvest.tsx` |
| F4 | `tree-growth-phase-record-screen.tsx` | 257 | `TreeGrowthPhaseRecordScreen` | `trees/[treeId]/phase.tsx` |
| F5 | `tree-record-edit-screen.tsx` | 503 | `TreeRecordEditScreen` | `records/[recordType]/[recordId]/edit.tsx` |
| F6 | `tree-record-detail-screen.tsx` | 523 | `TreeRecordDetailScreen` | `records/[recordType]/[recordId].tsx` |

Ketergantungan antar-file: **hanya F5 → F6**, type-only
(`import type { TreeRecordRouteType }`, F5:26, dipakai F5:188/338/346).

### 9.2 Pelanggaran aturan yang harus dibereskan

| Aturan | Kondisi sekarang |
|---|---|
| #2 tanpa Batal | **Dilanggar F1–F5.** Tombol "Batal" `variant="secondary"` di slot footer → `router.back()`. F1:122, F2:244, F3:117, F4:126, F5:269. F6 bersih. |
| #5 snackbar | **Dilanggar.** F1–F4 tidak ada konfirmasi sukses sama sekali (`router.replace` diam: F1:110, F2:130, F3:105, F4:114). F5 pakai `Alert.alert('Catatan berhasil diperbarui.')` F5:180-185. |
| #6 inline per-field | **Dilanggar dua kali.** Semua pakai `setError` tunggal → `ErrorBanner`, dan validasi **berurutan satu-per-satu**, bukan serentak. F1:86-89, F2:93-96, F3:76-84, F4:82-85, F5:163-225. |
| P-9b header slot | **Belum semua.** F1–F6 merender `TopAppBar` sebagai **anak pertama ScrollView** → header ikut menggulung. F1:126, F2:248, F3:121, F4:130, F5:248/257/273, F6:140/155. Slot `header` tersedia tapi tidak dipakai. |

### 9.3 Yang sudah bersih (jangan diutak-atik tanpa alasan)

- **Nol literal hex warna** di keenam file. `borderRadius` & `padding*` **100% token**.
- **`subtitle` nol pemakai** — semua `TopAppBar` hanya `title` + `onBack`.
- **Isolasi sempurna:** importir F1–F6 **hanya** 12 wrapper rute. Nol konsumen eksternal
  untuk ekspor apa pun. Mengubah F1–F6 saja tidak bisa merusak layar lain.
- **Aturan foto dipatuhi.** `PhotoPickerCard` hanya di F2 (kondisi pohon). Nol foto di
  F1/F3/F4. F1:22-23 bahkan punya komentar eksplisit. F6 tampilkan foto hanya untuk
  tipe `condition` (F6:217-219).
- **Nol `Modal` bawaan RN** dan nol glyph hand-drawn di keenam file. F1–F6 tidak
  mengimpor `./icons` sama sekali; ikon hanya lewat primitif.
- **RF-12 `produk` terpasang benar** di F1: state F1:36, field F1:163-181, dikirim via
  `createCareActivity` (F1:94-101) → RPC `create_care_activity` param `p_produk`
  (`careActivityService.ts:67-74`). Bukan `complete_task`, bukan insert langsung.

### 9.4 Gap US-14 SUDAH TERTUTUP — bukti

Catatan perawatan **inisiatif** sudah bisa dibuka read-only dari timeline riwayat:

1. `tree_history_view` menyertakan care inisiatif dengan `source_id = ca.id` via
   **LEFT JOIN** ke `care_tasks` (migration 028:59-73, komentar eksplisit 028:7-9).
2. `getRouteRecordType` map care → `'care'` (`tree-components.tsx:905-907`).
3. `canOpenRecord = Boolean(item.sourceId && routeRecordType && onRecordPress)`
   (`tree-components.tsx:595`) → item dibungkus `Pressable` + chevron (`:654,660-666`).
4. Handler `handleOpenHistoryRecord` push ke rute (`tree-detail-screen.tsx:334-340`),
   dioper via `onRecordPress` (`:405`).
5. Rute dinamis `records/[recordType]/[recordId]` menerima `'care'`; F6
   `normalizeRecordType` (F6:221-227) menerima keempat tipe.
6. F6 cabang `care` (F6:326-377) pakai `getCareActivityDetail` → query `care_activities`
   by id tanpa syarat asal. Untuk inisiatif: judul tugas induk di-skip (F6:339),
   badge asal **"Inisiatif"** (F6:368), `canEdit:false` + `supportsEdit:false`
   (F6:362,371). Kategori & produk ditampilkan bila ada (F6:343-349).

**Kesimpulan: nol file wajib disentuh untuk "bisa dibuka read-only".** Sudah jalan.

### 9.5 Duplikasi yang butuh primitif baru

Diduplikasi lokal di banyak file, tidak bisa di-dedupe tanpa menyentuh `ui.tsx`:

- **`TextArea` multiline** — lokal di F1, F2, F3, F4, F5. `Field` shared single-line saja.
  → butuh prop aditif `Field.multiline?: boolean` (+ opsional `numberOfLines`/`minHeight`).
- **Chip pilihan** (`CategoryOption` / `SelectableOption` / `OptionChip`) — lokal di
  F1, F2, F4, F5. Tidak ada primitifnya. → butuh **komponen shared baru** di `ui.tsx`.
- **`Field`/`InputField` lokal** — F3, F5.
- Literal sisa: `fontSize` (13/14/15/16), `fontWeight` `'600'/'700'`, `minHeight` 54/96,
  `lineHeight` 21. Semua enam masih impor `colors/radius/spacing/typography` lama,
  **nol yang impor `tokens`** (F1–F6 baris 5).

### 9.6 Pembagian sub-unit yang direkomendasikan

| Sub-unit | Isi | Alur device |
|---|---|---|
| **1a** | Prop aditif di `ui.tsx`: `Field.multiline`, komponen shared `OptionList`/`SelectableOption`. **Nol pemakai dimigrasi** (aturan #9). | 1 (smoke test P-13) |
| **1b** | F1 care, F2 condition, F3 harvest, F4 phase. Header slot, buang Batal, validasi inline serentak, snackbar, migrasi `tokens`, dedupe pakai 1a, cek/beresin header dobel `harvest`+`care`. | 8 |
| **1c** | F5 edit + F6 detail. | 4 |

Kalau 1b kehabisan sesi, potong di batas F2/F3 — F3 & F4 struktur nyaris identik, murah
setelah pola dari F1/F2 terbentuk.

### 9.7 Belum bisa dipastikan tanpa device / DB

1. Apakah expo-router benar merender native header untuk `harvest`/`care` (→ dobel
   dengan `TopAppBar`). Statik: rute tidak terdaftar di Stack layout, tidak menyetel
   `headerShown:false`, `screenOptions` default tidak mematikan header.
2. Apakah worker records detail/edit wrapper menyetel `headerShown:false` (owner sudah
   dikonfirmasi di `:14`).
3. Apakah RLS mengizinkan worker membaca `care_activities` inisiatif milik orang lain
   saat detail dibuka (`security_invoker` di 028:18-22).

### 9.8 Acuan pembanding: P-13

Layar terpoles paling mirip. `TreeForm` + `validateTreeForm` di
`tree-components.tsx:255,343`. Rute: `owner/trees/create.tsx`,
`owner/trees/[treeId]/edit.tsx`.

Pola yang harus ditiru F1–F5: slot `header={<TopAppBar/>}` (create:145, edit:241) ·
`headerShown:false` konsisten (per file **dan** terdaftar di layout) · tanpa Batal ·
`validateTreeForm` + `Field.error` inline serentak + `clearResolvedTreeFormErrors` ·
`showSnackbar` (create:108, edit:193) · sudah pakai `tokens`.

---

## 10. Rencana sisa unit

Prinsip: layar yang berbagi komponen digabung. Tiap unit otomatis memuat baris checklist
**migrasi header ke slot `header`**.

| # | Unit | File | Catatan |
|---|---|---|---|
| **1** | Record pohon | F1–F6 (§9) | Pecah 1a/1b/1c |
| **1.5** | **Revisi daftar pohon** (BARU) | `owner/trees/index.tsx`, kartu pohon di `tree-components.tsx` | Filter, kartu, FAB inset — lihat §12 |
| 2 | Tugas | `owner/tasks/index` (Pola C), `owner/tasks/[taskId]`, `worker/tasks/[taskId]` | Daftar worker sudah dipoles |
| 3 | Jadwal | `owner/schedules/[scheduleId]`, `.../edit`, `owner/schedules/create` | Daftar sudah dipoles |
| 4 | SOP | `sops/index`, `create`, `[sopId]`, `[sopId]/edit`, `[sopId]/schedule` | `sops/[sopId]` punya `right={<MenuButton>}` — pola sama dengan detail pohon |
| 5 | Laporan | `operational-report-screen.tsx`, `reports/index` owner+worker, `reports/create`, `reports/[reportId]` | **Paling berisiko.** Komponen bersama, satu-satunya pemakai `stickyFooter`, menampung migrasi header reports. Audit paling teliti. |
| 6 | Kebun & pekerja | `owner/workers` (header ganda), `owner/farm-profile` (Pola C), `owner/farm` + `worker/farm`, CRUD info kebun | Sekalian `feedback.ts` |
| 7 | Pemantauan pertumbuhan | `growth-monitoring-screen.tsx` (Pola C) | Tidak ada di triase awal |
| 8 | Profil & akun | `profile-screen.tsx`, `account-password-screen.tsx` | Ikon profil sekarang selalu terlihat di 8 layar tab → jalur lebih sering dipakai |
| 9 | Auth | `get-started` (Pola D), `login`, `register` | Kesan pertama, tapi frekuensi paling rendah. Sengaja belakangan. |
| 10 | Onboarding | `onboarding`, `create-farm`, `join-farm`, `access-status` | `onboarding.tsx` pakai `TopAppBar` dengan `right=` + `variant="main"` — satu-satunya di luar `MainTabHeader` |
| 11 | Riwayat/timeline | judul kartu perawatan = kategori | Butuh migration + service + tipe |
| 12 | Migrasi `Field` ke token | teknis, nol perubahan visual diharapkan | Tes device = sampling form |
| 13 | Commit pembersih | cabut prop nol pemakai, sinkronkan dokumen, audit literal sisa | — |

---

## 11. Template prompt audit isolasi

Salin, isi `[FILE]`, kirim ke Claude Code. Buang bagian yang tidak relevan untuk unit
tersebut supaya hemat token.

```
Tugas: AUDIT ISOLASI, READ-ONLY. Jangan ubah, buat, hapus, atau format file apa pun.
Jangan commit. Jangan usulkan patch. Output hanya laporan.

Aturan pelaporan:
- Setiap klaim wajib disertai `path:baris`.
- Kalau tidak ditemukan, tulis "TIDAK DITEMUKAN". JANGAN menebak, jangan
  menyimpulkan dari nama file, jangan bilang "kemungkinan".
- Fakta arsitektur berikut SUDAH terverifikasi, jangan diaudit ulang:
  Screen satu-satunya ScrollView (nol FlatList/SectionList/SafeAreaView di app/
  dan src/); Screen props children/header/footer/stickyFooter/floatingAction/
  floatingActionBottom/contentStyle/variant; safe-area atas oleh TopAppBar bukan
  Screen; hairline hanya di wrapper header milik Screen; bottom nav di layout di
  luar Screen; Field shared single-line (tanpa multiline); tidak ada primitif
  selectable-option di ui.tsx.

FILE DALAM LINGKUP: [FILE]

1. PETA — path persis, jumlah baris, komponen diekspor + interface props, semua
   rute di app/ yang merender (tandai owner/worker/keduanya), total alur device.
2. PRIMITIF — primitif ui.tsx yang dipakai + baris; prop Screen mana yang dipakai
   (slot `header` atau TopAppBar sebagai anak scroll?); apakah `subtitle` diisi;
   ketergantungan antar-file dalam lingkup.
3. FORM — daftar field (label/tipe/wajib/baris); cara validasi (inline per-field
   vs ErrorBanner vs Alert; serentak vs satu-per-satu); konfirmasi sukses
   (showSnackbar / Alert / diam / modal); ada tombol Batal?; ada dua jalan ke
   aksi yang sama?
4. TOKEN — jumlah literal hex; literal fontSize/fontWeight/borderRadius/padding;
   impor `tokens` atau `colors/spacing/typography` lama (baris impornya).
5. IKON/SHEET/FOTO — ikon per file, glyph hand-drawn sisa, BottomSheet shared vs
   Modal bawaan RN, PhotoPickerCard dipakai di mana + prop apa. Aturan: foto HANYA
   boleh di kondisi pohon & bukti task — laporkan kalau ada di tempat lain.
6. ISOLASI — file lain yang mengimpor file dalam lingkup; ekspor non-komponen yang
   dipakai dari luar; blast radius kalau hanya file ini diubah; perubahan yang
   TIDAK BISA tanpa menyentuh primitif shared (sebut prop aditif yang perlu).
7. PEMBANDING — bandingkan dengan P-13 (`tree-components.tsx:255,343`,
   `owner/trees/create.tsx`, `owner/trees/[treeId]/edit.tsx`) dalam tabel: pola
   header, Batal, validasi, konfirmasi sukses, tokens vs lama.
8. Terakhir: bagian "HAL YANG TIDAK BISA GUA PASTIKAN" — apa pun yang butuh info
   dari luar kodebase (isi DB, RLS, perilaku runtime, tes device).

BERHENTI setelah laporan. JANGAN mulai implementasi. JANGAN usulkan diff.
Tunggu instruksi berikutnya.
```

---

## 12. Log keputusan per unit

Append di sini setiap unit selesai. Ganti isi §7 dan §8 kalau berubah.

### 30 Juli 2026 — audit Unit 1
- Unit 1 dipecah jadi 1a/1b/1c (§9.6).
- Gap US-14 dinyatakan **sudah tertutup**; `keputusan_desain.md` dikoreksi (§6).
- Iterasi C menyusut kembali ke RF-10 + draft offline.
- Utang baru: risiko header dobel `harvest`/`care` → dibereskan di 1b.
- P-9b dinyatakan **blocker** untuk implementasi unit baru mana pun (§7).

### 30 Juli 2026 — masukan Harish untuk Unit 1.5 (daftar pohon), BELUM diimplementasikan
Layar `owner/trees/index.tsx` sudah pernah "selesai dipoles", dibuka ulang atas masukan
pemakaian nyata.

1. **Filter.** Empat chip (Kondisi, Fase, Umur, Status) semuanya membuka sheet yang sama
   = empat pintu ke satu ruangan, melanggar aturan #8. Ganti satu **tombol ikon filter di
   samping search bar** dengan badge angka jumlah filter aktif. **Disetujui: tidak** ada
   shortcut kondisi (Sehat/Sakit) di bawah — itu menambah pintu lagi, dan ini bukan layar
   jadwal. Terbuka: apakah menampilkan baris chip filter aktif (hanya untuk *menghapus*,
   bukan membuka sheet) atau cukup tombol Reset.
2. **Kartu pohon.** Masalah sebenarnya bukan "kaku" tapi **dua badge dengan dua logika
   penempatan**: "Sehat" overlay di foto kanan-atas, "Berbunga" duduk di bawah kode.
   Plus border kuning di sekeliling *foto* pada kartu "Perhatian" — mengulang informasi
   badge, buang. Placeholder foto default (blob hijau abstrak) terbaca sebagai
   **rusak/loading**, bukan "belum ada foto" → ganti surface netral + satu ikon pohon
   dari `icons.tsx`, tahan diri jangan dihias.
3. **FAB (+).** **Pertahankan** — FAB untuk aksi create primer di layar daftar benar
   menurut M3, dan memindahkannya ke header kanan bentrok dengan ikon profil yang
   sekarang selalu terlihat di 8 layar tab. Yang salah adalah **inset scroll bawah
   kurang** sehingga FAB menumpuk konten kartu terakhir → pakai `floatingActionBottom`
   di `Screen`.

### 30 Juli 2026 — TIGA KEPUTUSAN TERKUNCI (Harish)

Jangan buka ulang perdebatannya di chat berikutnya.

**K-1 · Urutan kerja.** Chat berikutnya = **tutup P-9b**, bukan unit baru. Implementasi
unit apa pun ditahan sampai working tree bersih.

**K-2 · Filter daftar pohon.** Empat chip (Kondisi/Fase/Umur/Status) → **satu tombol ikon
filter di samping search bar** dengan badge angka jumlah filter aktif. Saat ada filter
aktif, muncul **baris chip filter aktif; tap chip = hapus filter itu** (chip **bukan**
pembuka sheet — satu pintu masuk saja, aturan #8). Baris chip **tidak** dirender saat nol
filter. **Tidak ada** shortcut kondisi (Sehat/Sakit) di bawah search bar.

**K-3 · Badge kartu pohon.** Kondisi **keluar dari foto**, jadi **dot berwarna + label teks
tanpa pill**, satu baris dengan kode pohon, rata kanan. Badge fase **turun jadi teks meta**
digabung varietas (`Berbunga · miki`). Kartu: foto → `A-2 ····· ● Sehat` → `Berbunga · miki`.

Alasan (jangan dibalik tanpa alasan baru):
- **Lebar kartu tidak cukup untuk dua pill sejajar.** Grid 2 kolom di layar 400px ≈ 165px
  konten. "Perhatian" ≈78px + "Berbunga" ≈74px + gap 8 = 160px → mentok; di HP 360px
  wrap/kepotong. Bukan soal selera, itu bug yang menunggu device tertentu.
- **Dot warna tanpa label gagal aksesibilitas** (encoding warna-saja; M3 & iOS HIG
  melarang). Dengan label justru lebih murah: dot 8 + gap 6 + teks 13px ≈ 52px.
- **Overlay di foto punya masalah kontras yang tidak bisa diperbaiki** — isi foto
  ditentukan user. Lihat kartu A-1: pill putih-kehijauan di atas dedaunan hijau hampir
  lenyap.
- **Hierarki, bukan warna, yang menyembuhkan rasa kaku.** Dua pill berbobot sama = mata
  tidak tahu mana yang penting. Yang di-scan Abah saat melihat 8 pohon adalah "mana yang
  perlu ditengok", bukan "mana yang berbunga" (fase sudah punya filter). Jadi kondisi naik
  jadi sinyal pengecualian, fase turun jadi keterangan.

Warna: dot pakai `tokens.color.status.*`; label `text.secondary` untuk Sehat (mayoritas,
sengaja tenang), warna status untuk non-Sehat supaya pengecualian yang menonjol.

Sekalian di unit yang sama: **border berwarna di sekeliling foto pada kartu "Perhatian"
dibuang** (mengulang informasi label, dan membuat kartu terasa terkurung). **Placeholder
foto default** (blob hijau abstrak — terbaca sebagai rusak/loading) → surface netral +
satu ikon pohon dari `icons.tsx`, tanpa hiasan.

**Fallback kalau K-3 jelek di mockup:** kondisi tetap keluar dari foto sebagai pill, fase
tetap pill, tapi **ditumpuk dua baris** — jangan sejajar.

**Wajib mockup visualizer dulu** sebelum implementasi K-2 dan K-3.
