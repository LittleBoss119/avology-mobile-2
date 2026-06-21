# Screenshot Design Review Action Plan Avology V2

**Path dokumen:** `docs/ui-review/05-screenshot-design-review-action-plan.md`  
**Tanggal:** 19 Juni 2026  
**Status:** Accepted sebagai source of truth UI/UX correction sebelum implementasi lanjutan  
**Ruang lingkup:** Sinkronisasi hasil review desain screenshot versi pertama dengan Product Alignment Decision Log, MVP Scope, Requirement, Decision Log, ERD, database design, service layer, screen navigation flow, UI polish decision, iteration planning, black-box testing, traceability matrix, dan UAT plan.

---

## 1. Tujuan Dokumen

Dokumen ini dibuat untuk mengunci arah perbaikan UI/UX Avology V2 setelah review desain screenshot versi pertama.

Tujuan utama dokumen ini:

1. Menyelaraskan hasil review desain dengan arah produk Avology V2.
2. Mencegah UI berikutnya kembali menjadi CRUD template atau tampilan generic app.
3. Menentukan prioritas redesign screen berdasarkan risiko UX dan kebutuhan UAT.
4. Menjadi pagar implementasi sebelum prompt Codex tahap UI/UX lanjutan dibuat.
5. Memastikan perubahan visual tidak merusak fitur, service, database, RLS, dan guard yang sudah berjalan.

Dokumen ini **tidak** berisi kode, tidak berisi migration SQL, dan tidak berisi prompt implementasi Codex.

---

## 2. Source of Truth yang Disinkronkan

Dokumen ini disusun dengan merujuk pada source of truth Avology V2 berikut:

1. `docs/product-alignment/01-product-alignment-decision-log.md`
2. MVP Scope Avology V2
3. Requirement Avology V2
4. Decision Log Avology V2
5. ERD dan Data Model Konseptual
6. Logical Database Schema
7. SQL Schema Draft
8. Service Layer Design
9. Screen Inventory dan Navigation Flow
10. UI/UX Polish Decision sebelumnya
11. Iteration Planning PXP
12. Black-box Testing Plan
13. Traceability Matrix
14. UAT Plan
15. Implementation Master Plan
16. Catatan review desain screenshot versi pertama

Jika ada konflik antara desain screenshot lama dan dokumen ini, maka dokumen ini menjadi acuan untuk UI/UX correction.

Jika ada konflik antara dokumen ini dan Product Alignment Decision Log, maka Product Alignment Decision Log tetap menjadi acuan utama untuk product direction dan implementation guardrails.

---

# A. Executive Summary

Desain versi pertama Avology V2 sudah mencakup fungsi utama aplikasi, tetapi secara rasa produk masih terlalu dekat dengan CRUD app atau template UI hasil generate. Fungsi sudah ada, tetapi presentasi informasi belum cukup terasa sebagai aplikasi operasional kebun alpukat.

Masalah utamanya bukan sekadar warna atau spacing. Masalah yang lebih dalam adalah hierarchy, navigation intent, semantic UI, role-specific experience, dan screen-specific redesign.

Avology V2 harus terasa seperti aplikasi operasional kebun yang membantu owner mengambil keputusan dan membantu worker menyelesaikan pekerjaan lapangan, bukan seperti kumpulan form database yang diberi warna hijau lalu berharap manusia menyebutnya produk. Ambisi manusia memang sering murah, tapi jangan sampai skripsi ikut-ikutan.

Fokus koreksi UI/UX berikutnya adalah:

1. Membersihkan data teknis dari UI user-facing.
2. Memformat status, role, kondisi, fase, kategori, dan label teknis ke Bahasa Indonesia.
3. Mengubah dashboard owner dari menu-based menjadi insight-based.
4. Mengubah dashboard worker menjadi task-based.
5. Membuat list, card, detail, dan form lebih mobile-native dan scan-friendly.
6. Memisahkan Profil Akun dan Profil Kebun secara UX.
7. Mengurangi tombol full-width yang bukan primary action.
8. Menghapus tombol refresh manual yang tidak perlu.
9. Menggunakan komponen UI foundation yang sudah tersedia.
10. Memastikan semua redesign dilakukan bertahap, kecil, bisa dites, dan bisa di-commit aman.

Perbaikan ini bukan penambahan fitur besar. Ini adalah UI/UX correction untuk membuat fitur yang sudah ada menjadi layak dipakai, layak diuji, dan layak dipresentasikan.

---

# B. UI/UX Problems by Category

## B.1 Information Architecture

### Masalah

1. Banyak screen masih terasa seperti halaman CRUD terpisah, bukan alur operasional kebun.
2. Beberapa halaman menampilkan data apa adanya tanpa prioritas informasi.
3. Dashboard, list, detail, dan form belum punya pembagian fungsi yang cukup jelas.
4. Profil Akun dan Profil Kebun masih berisiko tercampur.
5. Beberapa aksi penting muncul sebagai tombol besar yang tidak membedakan prioritas.
6. Screen operasional belum selalu menjawab kebutuhan utama user pada konteks screen tersebut.

### Dampak

1. User perlu membaca terlalu banyak untuk memahami keadaan.
2. Owner tidak langsung melihat hal yang perlu diprioritaskan.
3. Worker tidak langsung diarahkan ke pekerjaan hari ini.
4. Aplikasi terasa seperti admin panel mobile, bukan aplikasi lapangan.

### Koreksi

1. Setiap screen harus punya satu tujuan utama yang jelas.
2. Informasi utama harus muncul lebih dulu.
3. Aksi utama harus dibedakan dari aksi sekunder.
4. Data teknis harus disembunyikan atau diganti dengan label user-friendly.
5. Profil Akun dan Profil Kebun harus dipisah secara konsep dan UI.

---

## B.2 Dashboard

### Masalah

1. Dashboard Owner masih terlalu menu-based.
2. Dashboard Owner berisiko menjadi tumpukan tombol navigasi.
3. Dashboard Worker belum cukup task-based.
4. Semua metrik cenderung tampil dengan bobot visual sama.
5. Insight penting belum cukup menonjol.
6. Tombol Refresh terlalu sering muncul dan membuat aplikasi terasa belum matang.

### Dampak

1. Dashboard kehilangan fungsi sebagai pusat monitoring.
2. Owner masih harus membuka banyak halaman untuk tahu kondisi penting.
3. Worker belum langsung paham tugas apa yang harus dikerjakan.
4. Tampilan terasa seperti prototype mentah.

### Koreksi

1. Dashboard Owner harus menjawab: **Apa yang perlu owner perhatikan sekarang?**
2. Dashboard Worker harus menjawab: **Apa yang harus worker kerjakan hari ini?**
3. Quick action boleh ada, tetapi tidak boleh menjadi isi utama dashboard.
4. Tombol Refresh besar di dashboard harus dihapus.
5. Refresh data sebaiknya memakai pull-to-refresh atau reload saat screen dibuka.

---

## B.3 Navigation

### Masalah

1. Navigasi masih terasa seperti daftar tombol fitur.
2. Dashboard digunakan sebagai menu, bukan halaman ringkasan.
3. Owner dan worker belum cukup terasa berbeda dari sisi navigasi.
4. Beberapa screen detail masih membutuhkan tombol kembali manual yang membuat UI berat.
5. Aksi tambahan belum selalu ditempatkan di area yang tepat, misalnya menu titik tiga untuk aksi sekunder owner.

### Dampak

1. Mobile feel menurun.
2. User dipaksa memilih fitur, bukan diarahkan berdasarkan konteks.
3. Worker flow menjadi terlalu mirip owner flow.

### Koreksi

1. Gunakan bottom navigation sesuai role.
2. Owner navigation: Dashboard, Pohon, Jadwal, Laporan, Kebun.
3. Worker navigation: Dashboard, Tugas, Pohon, Laporan, Profile.
4. Aksi spesifik screen ditempatkan di header, card utama, floating action button, atau menu sekunder sesuai prioritas.
5. Dashboard tidak boleh menggantikan bottom navigation.

---

## B.4 Component Consistency

### Masalah

1. Banyak tombol full-width membuat UI terasa berat.
2. Card, section, info row, badge, empty state, loading state, dan error state belum konsisten.
3. Style lokal berisiko dibuat berulang di tiap screen.
4. Filter besar vertikal membuat layar boros.
5. Form dan detail belum punya pola visual yang seragam.

### Dampak

1. Aplikasi terasa seperti gabungan screen yang dibuat terpisah.
2. User perlu beradaptasi ulang di setiap screen.
3. Maintenance UI menjadi makin berantakan.

### Koreksi

1. Gunakan UI foundation dari `components/ui.tsx`.
2. Jangan membuat komponen duplikat tanpa alasan kuat.
3. Gunakan AppCard untuk grouping informasi.
4. Gunakan StatusBadge untuk status dan kondisi.
5. Gunakan SectionHeader dan InfoRow untuk detail.
6. Gunakan EmptyState, LoadingState, dan ErrorState secara konsisten.
7. Gunakan AppButton sesuai hierarchy: primary, secondary, outline, ghost, danger.

---

## B.5 Forms

### Masalah

1. Form kondisi dan fase memakai pilihan besar vertikal yang boros ruang.
2. Form worker masih bisa terasa terlalu berat untuk konteks lapangan.
3. Input teks muncul terlalu dominan di beberapa flow.
4. CTA utama belum selalu jelas.
5. Validasi belum selalu ditampilkan dengan bahasa user-friendly.
6. Beberapa screen terindikasi copy-paste salah, seperti Catat Fase Worker yang masih terasa seperti Catat Kondisi.

### Dampak

1. Worker membutuhkan waktu lebih lama untuk menyelesaikan aksi lapangan.
2. Form terasa seperti form admin, bukan form mobile.
3. Risiko salah input meningkat.
4. UI terlihat generik dan kurang meyakinkan untuk UAT.

### Koreksi

1. Gunakan chips, radio card compact, segmented control, atau dropdown untuk pilihan status/kategori/fase.
2. Catatan dibuat opsional kecuali benar-benar dibutuhkan.
3. CTA utama harus jelas dan konsisten.
4. Worker form harus minim teks.
5. Setiap form harus dicek ulang copywriting-nya agar sesuai fungsi screen.
6. Catat Kondisi dan Catat Fase harus punya label, pilihan, dan empty/error text yang berbeda.

---

## B.6 Lists and Cards

### Masalah

1. List pohon masih terasa seperti data dump.
2. Card terlalu padat atau terlalu mirip output database.
3. Informasi penting belum tersusun berdasarkan prioritas.
4. Filter list tugas/laporan/jadwal masih terlalu besar.
5. UUID atau ID teknis berisiko tampil di list item.

### Dampak

1. User sulit melakukan scanning cepat.
2. List tidak membantu pengambilan keputusan.
3. Tampilan terasa seperti admin table yang dipaksa masuk layar HP.

### Koreksi

1. Setiap card list harus menampilkan maksimal informasi penting.
2. Kode pohon berbasis lokasi harus menjadi anchor visual utama pada card pohon.
3. Status/kondisi/fase memakai badge.
4. Umur pohon ditampilkan sebagai formatter dari tanggal tanam.
5. Filter memakai chips, segmented control, atau dropdown.
6. UUID tidak boleh tampil.

---

## B.7 Detail Pages

### Masalah

1. Detail pohon, tugas, SOP, laporan, dan profil belum memiliki hierarchy yang kuat.
2. Semua field berisiko tampil rata tanpa prioritas.
3. Detail pohon masih terasa seperti data mentah, belum story-based.
4. Aksi utama dan aksi sekunder belum selalu dipisahkan.
5. Riwayat belum selalu terasa seperti timeline operasional.

### Dampak

1. User sulit memahami konteks objek yang sedang dibuka.
2. Informasi penting tertutup field teknis.
3. Detail screen kehilangan fungsi sebagai pusat keputusan lanjutan.

### Koreksi

1. Detail page harus dimulai dari summary card.
2. Status utama harus terlihat jelas.
3. Section dipisahkan berdasarkan konteks: Ringkasan, Detail, Riwayat, Aksi.
4. Riwayat pohon harus dibaca seperti timeline, bukan kumpulan field datar.
5. Aksi utama tampil sebagai CTA jelas.
6. Aksi sekunder seperti edit/archive/unarchive owner dapat masuk menu titik tiga atau section khusus.

---

## B.8 Empty, Loading, and Error States

### Masalah

1. Empty state belum selalu menjelaskan kondisi dengan baik.
2. Loading state belum konsisten.
3. Error message berisiko menampilkan pesan teknis dari Supabase atau UUID.
4. Beberapa screen masih mengandalkan tombol refresh manual.

### Dampak

1. User bingung saat data kosong.
2. App terasa rapuh saat loading atau error.
3. UI terlihat belum matang.

### Koreksi

1. Empty state harus menjelaskan kondisi dan aksi berikutnya.
2. Loading state harus konsisten dengan `LoadingState`.
3. Error state harus memakai Bahasa Indonesia dan tidak membocorkan error teknis mentah.
4. Tombol retry boleh ada pada error state, tetapi bukan tombol Refresh besar di halaman utama.
5. Gunakan pull-to-refresh atau auto reload untuk refresh normal.

---

## B.9 Copywriting and Language

### Masalah

1. Bahasa UI masih campur Inggris-Indonesia.
2. Raw status seperti `active`, `pending`, `worker`, `owner`, `completed`, `postponed`, `healthy`, dan `needs_attention` masih berisiko tampil.
3. Label teknis seperti database ID, route param, atau development text masih berisiko muncul.
4. Beberapa label screen belum sesuai konteks operasional kebun.

### Dampak

1. User awam kebun bisa bingung.
2. Aplikasi terasa belum dipoles.
3. UAT bisa terdampak karena responden menilai aplikasi kurang mudah dipahami.

### Koreksi

1. Gunakan Bahasa Indonesia konsisten untuk semua user-facing text.
2. Role dan status harus diformat ke label Bahasa Indonesia.
3. Error, empty, loading, toast, badge, placeholder, helper text, dan CTA harus diaudit.
4. Hindari istilah developer kecuali memang di dokumentasi internal.

---

## B.10 Technical Data Exposure

### Masalah

1. UUID masih tampil ke user di beberapa bagian.
2. Database ID, field internal, atau debug text berisiko bocor ke UI.
3. Teks development seperti `Iteration 1` tidak boleh tampil di UI user-facing.
4. Raw enum masih terlihat seperti nilai database.

### Dampak

1. UI terlihat seperti admin/debug panel.
2. User tidak mendapatkan informasi yang bermakna.
3. Presentasi skripsi terlihat kurang profesional.

### Koreksi

1. UUID hanya boleh dipakai internal sistem.
2. Gunakan nama, kode pohon, nama kebun, nama worker, atau label status yang bisa dipahami.
3. Debug/development text harus dihapus dari UI user-facing.
4. Error message teknis harus diformat menjadi pesan user-friendly.

---

## B.11 Owner vs Worker Experience

### Masalah

1. Worker flow masih berisiko terlalu mirip owner flow.
2. Worker bisa melihat terlalu banyak informasi yang tidak diperlukan.
3. Owner dashboard belum cukup menonjolkan insight.
4. Worker dashboard belum cukup menonjolkan tugas hari ini.

### Dampak

1. Worker app terasa berat.
2. Owner app terasa seperti menu fitur, bukan monitoring tool.
3. Perbedaan role tidak terasa kuat secara UX.

### Koreksi

1. Owner experience fokus pada monitoring, pengambilan keputusan, pengelolaan worker, jadwal, SOP, dan laporan.
2. Worker experience fokus pada tugas hari ini, realisasi tugas, catat kondisi, catat fase, dan laporan operasional.
3. Worker form harus lebih sederhana dan minim teks.
4. Owner boleh punya data lebih lengkap, tetapi tetap harus terstruktur.

---

# C. Global UI Rules

Aturan berikut wajib dipatuhi dalam seluruh UI/UX correction Avology V2.

## C.1 Data Display Rules

1. Jangan tampilkan UUID ke user.
2. Jangan tampilkan database ID ke user.
3. Jangan tampilkan route param ke user.
4. Jangan tampilkan teks development seperti `Iteration 1`, `debug`, `raw`, `payload`, atau `console` di UI user-facing.
5. Jangan tampilkan raw status atau raw role.
6. Jangan tampilkan raw enum seperti `needs_attention`, `pest_attacked`, `in_progress`, `completed`, atau `postponed`.
7. Gunakan label Bahasa Indonesia yang jelas.
8. Jika data kosong, tampilkan fallback user-friendly seperti `Belum diisi`, `Belum ada catatan`, atau `Tanggal tanam belum diisi`.

---

## C.2 Language Rules

1. Gunakan Bahasa Indonesia konsisten pada semua UI user-facing.
2. Hindari campuran Inggris-Indonesia kecuali istilah teknis yang memang lazim dan tidak membingungkan.
3. Gunakan istilah operasional kebun, bukan istilah database.
4. Gunakan kata kerja yang jelas untuk CTA, seperti `Simpan`, `Catat Kondisi`, `Catat Fase`, `Buat Jadwal`, `Selesaikan Tugas`, `Tunda Tugas`.
5. Gunakan copy pendek untuk worker.
6. Gunakan copy informatif tetapi tidak berlebihan untuk owner.

---

## C.3 Button and Action Rules

1. Kurangi tombol full-width yang bukan primary action.
2. Full-width button hanya boleh untuk CTA utama screen atau aksi penting pada form.
3. Aksi sekunder gunakan compact button, ghost button, outline button, icon button, atau menu titik tiga.
4. Hindari tumpukan tombol navigasi di dashboard.
5. Tombol Refresh besar tidak boleh muncul di dashboard, list utama, atau detail utama.
6. Retry button hanya boleh muncul dalam konteks error state.
7. Action destructive seperti archive harus memakai confirmation dialog.

---

## C.4 Filter Rules

1. Gunakan chips, segmented control, atau dropdown untuk filter.
2. Jangan gunakan tombol besar vertikal untuk filter status/kategori jika bisa dipadatkan.
3. Filter harus mudah di-scan dan tidak mengambil terlalu banyak ruang layar.
4. Filter aktif harus terlihat jelas.
5. Search dan filter tidak boleh membuat screen terasa seperti panel admin desktop.

---

## C.5 Component Rules

Gunakan komponen dari `components/ui.tsx` sebisa mungkin:

1. `AppScreen`
2. `ScreenHeader`
3. `AppCard`
4. `AppButton`
5. `AppTextInput`
6. `PasswordInput`
7. `StatusBadge`
8. `EmptyState`
9. `LoadingState`
10. `ErrorState`
11. `SearchFilterBar`
12. `FloatingActionButton`
13. `SectionHeader`
14. `InfoRow`
15. `ConfirmDialog`

Aturan tambahan:

1. Jangan membuat warna random.
2. Jangan membuat style lokal baru kecuali benar-benar perlu.
3. Jangan membuat komponen duplikat jika komponen foundation sudah cukup.
4. Jika komponen foundation kurang, perluas komponen tersebut secara kecil dan reusable.
5. Layout harus mobile-first.

---

## C.6 Technical Change Rules

1. Jangan mengubah database/service/RLS untuk UI polish kecuali tahap tersebut memang khusus semantic data.
2. Jangan mengubah RPC untuk perbaikan visual biasa.
3. Jangan membuat migration untuk UI-only cleanup.
4. Jangan menghapus fitur yang sudah berjalan.
5. Jangan mengubah route guard besar tanpa alasan spesifik.
6. Jangan menambah fitur di luar scope MVP.

---

# D. Screen Group Priority

Prioritas redesign harus mengikuti urutan berikut agar perubahan tetap aman dan tidak berubah menjadi bencana arsitektur berjubah “polish”.

## 1. UI Semantic Cleanup

Fokus:

1. Hilangkan UUID dari UI.
2. Hilangkan database ID dari UI.
3. Format raw status/role/kondisi/fase/kategori ke Bahasa Indonesia.
4. Bersihkan teks development.
5. Konsistenkan Bahasa Indonesia.
6. Hapus tombol Refresh manual yang tidak perlu.
7. Pastikan error/toast/empty/loading tidak membocorkan informasi teknis.

Alasan prioritas:

Ini perbaikan paling aman dan paling berdampak. Tanpa ini, desain sebagus apa pun tetap terlihat seperti halaman debug.

---

## 2. Dashboard Owner dan Dashboard Worker

Fokus:

1. Owner Dashboard menjadi insight-based.
2. Worker Dashboard menjadi task-based.
3. Quick action dibatasi.
4. Dashboard tidak menjadi daftar tombol navigasi.
5. Informasi paling penting diberi hierarchy tertinggi.

Alasan prioritas:

Dashboard adalah halaman pertama setelah login. Jika dashboard buruk, user langsung mencium bau prototype mentah sebelum sempat menghargai fitur lain.

---

## 3. Pohon List, Detail, dan Form

Fokus:

1. Pohon list scan-friendly.
2. Kode pohon berbasis baris-kolom.
3. Umur pohon dinamis dari `planted_at`.
4. Detail pohon story-based.
5. Form Tambah/Edit Pohon mengurangi input kode manual.
6. Form Catat Kondisi/Fase memakai pilihan compact.
7. Riwayat pohon dibuat lebih seperti timeline.

Alasan prioritas:

Pohon adalah objek penting dan sering dipakai. UI pohon yang buruk membuat aplikasi terasa seperti spreadsheet berkostum alpukat.

---

## 4. Jadwal, Tugas, dan Realisasi

Fokus:

1. Bedakan rencana owner dan eksekusi worker.
2. List tugas worker harus langsung menunjukkan prioritas kerja.
3. Detail tugas harus jelas: apa tugasnya, kapan, di mana, instruksi apa, aksi apa.
4. Realisasi tugas harus cepat: selesai/tunda dan catatan opsional.
5. Filter status/tanggal/kategori memakai chips atau dropdown.

Alasan prioritas:

Jadwal dan tugas adalah inti operasional. Jika ini membingungkan, aplikasi gagal sebagai alat kerja lapangan.

---

## 5. Laporan Operasional

Fokus:

1. Worker mudah membuat laporan.
2. Owner mudah melihat laporan baru dan tindak lanjut.
3. Kategori laporan memakai label Bahasa Indonesia.
4. Status laporan memakai badge.
5. Detail laporan punya hierarchy: masalah, lokasi, pelapor, status, tindak lanjut.
6. Tindak lanjut menjadi tugas harus jelas.

Alasan prioritas:

Laporan operasional menjawab kebutuhan owner yang tidak selalu berada di kebun.

---

## 6. SOP

Fokus:

1. SOP tampil sebagai template perawatan, bukan dokumen panjang.
2. List SOP menonjolkan kategori, interval, target default, dan status aktif.
3. Detail SOP menampilkan acuan jadwal berikutnya dengan jelas.
4. Form SOP tetap owner-oriented tetapi tidak seperti form database.
5. Status aktif/nonaktif diformat ke Bahasa Indonesia.

Alasan prioritas:

SOP penting, tetapi UX-nya harus mendukung jadwal dan tugas, bukan berdiri sebagai halaman administratif berat.

---

## 7. Profile Akun dan Profile Kebun

Fokus:

1. Pisahkan Profil Akun dan Profil Kebun.
2. User tanpa farm/membership tetap bisa membuka dan mengedit Profil Akun.
3. Profil Kebun hanya untuk konteks kebun valid.
4. Worker melihat profil sederhana dan status kebun user-friendly.
5. Owner mengelola data kebun, join code, worker management, dan SOP dari area Kebun.

Alasan prioritas:

Profil yang tercampur membuat user bingung apakah sedang mengedit dirinya atau kebunnya. Ini jenis kebingungan kecil yang diam-diam bikin UAT muram.

---

## 8. Final Consistency Pass

Fokus:

1. Audit semua screen.
2. Pastikan style konsisten.
3. Pastikan tidak ada UUID/raw status/raw enum tampil.
4. Pastikan tidak ada tombol Refresh manual yang tidak perlu.
5. Pastikan owner dan worker flow berbeda sesuai kebutuhan.
6. Pastikan empty/loading/error states konsisten.
7. Pastikan tidak ada screen copy-paste salah.
8. Pastikan fitur lama tidak rusak.

Alasan prioritas:

Final pass diperlukan sebelum UAT dan presentasi. Tanpa ini, error kecil bisa terlihat seperti ketidakseriusan produk.

---

# E. Screen Contracts

Screen contracts berikut adalah kontrak desain yang harus dijaga saat implementasi UI/UX correction.

---

## E.1 Owner Dashboard

### Tujuan

Owner Dashboard harus menjadi pusat insight untuk owner. Dashboard ini bukan daftar menu, bukan kumpulan tombol, dan bukan statistik mentah tanpa konteks.

Dashboard Owner harus menjawab:

> Apa yang harus owner perhatikan sekarang?

### Wajib Ditampilkan

1. Sapaan dan nama kebun.
2. Kondisi kebun hari ini.
3. Pohon butuh perhatian.
4. Tugas hari ini.
5. Tugas belum selesai atau tertunda.
6. Laporan operasional baru.
7. Worker pending.
8. SOP jatuh tempo atau terlambat jika data tersedia.
9. Fase berbunga dan berbuah.
10. Quick action terbatas.

### Hierarchy yang Disarankan

1. Summary utama kondisi kebun.
2. Insight prioritas atau alert.
3. Ringkasan operasional hari ini.
4. Quick actions terbatas.
5. Section tambahan seperti fase dan SOP.

### Quick Action yang Boleh Ada

1. Tambah Pohon.
2. Buat Jadwal.
3. Lihat Laporan Baru.
4. Catat Kondisi.

Quick action tidak boleh lebih dominan daripada insight.

### Dilarang

1. Dashboard menjadi daftar tombol navigasi.
2. Semua metrik tampil dengan bobot visual sama.
3. Tombol Refresh besar.
4. UUID atau raw status.
5. Teks development.
6. Menampilkan semua fitur owner sebagai tombol full-width.
7. Membuat tabel dashboard baru di database.

### Acceptance Criteria

1. Owner dapat melihat prioritas kebun tanpa membuka semua tab.
2. Tidak ada UUID/raw status tampil.
3. Tidak ada tombol Refresh besar.
4. Quick action tidak mendominasi screen.
5. Dashboard tetap memakai data dari service/agregasi yang sudah ada.
6. Empty/loading/error state tersedia dan user-friendly.

---

## E.2 Worker Dashboard

### Tujuan

Worker Dashboard harus menjadi pusat pekerjaan harian worker. Dashboard ini harus lebih sederhana daripada owner dashboard.

Dashboard Worker harus menjawab:

> Apa yang harus worker kerjakan hari ini?

### Wajib Ditampilkan

1. Sapaan dan nama kebun jika tersedia.
2. Tugas hari ini.
3. Tugas pending atau belum selesai.
4. Tugas tertunda jika relevan.
5. Shortcut lapor kondisi.
6. Shortcut catat fase jika relevan.
7. Shortcut buat laporan operasional.
8. Status akses kebun bila relevan, dengan label user-friendly.

### Hierarchy yang Disarankan

1. Tugas paling penting hari ini.
2. Ringkasan status tugas.
3. Aksi lapangan cepat.
4. Informasi akses/status kebun jika dibutuhkan.

### Dilarang

1. Worker dashboard berisi menu owner.
2. Worker dashboard terlalu banyak angka.
3. Informasi teknis membership mentah.
4. UUID atau raw status.
5. Tombol Refresh besar.
6. Aksi owner seperti kelola worker, buat SOP, edit kebun, atau approve worker.

### Acceptance Criteria

1. Worker langsung melihat tugas yang perlu dikerjakan.
2. Worker dapat menuju tugas, catat kondisi, catat fase, atau laporan operasional dengan cepat.
3. UI lebih sederhana daripada owner dashboard.
4. Tidak ada fitur owner.
5. Tidak ada raw role/status/UUID.

---

## E.3 Pohon List

### Tujuan

Pohon List harus scan-friendly dan membantu user menemukan pohon berdasarkan lokasi, kondisi, fase, dan informasi ringkas.

### Wajib Ditampilkan

1. Kode pohon berbasis baris-kolom, contoh `A-12`.
2. Varietas.
3. Umur dinamis dari tanggal tanam.
4. Kondisi terbaru.
5. Fase terbaru.
6. Lokasi baris dan kolom.
7. Status arsip jika sedang melihat arsip.

### Filter yang Disarankan

1. Search berdasarkan kode pohon/lokasi/varietas.
2. Filter kondisi.
3. Filter fase.
4. Filter aktif/arsip.

Filter harus berupa chips, segmented control, atau dropdown, bukan tombol vertikal besar.

### Dilarang

1. UUID.
2. Data terlalu panjang.
3. Card terlalu padat.
4. Raw enum kondisi/fase.
5. Input atau tampilan yang membuat pohon terasa seperti record database.

### Acceptance Criteria

1. User dapat scan daftar pohon dengan cepat.
2. Kode lokasi menjadi anchor visual utama.
3. Kondisi dan fase tampil sebagai badge user-friendly.
4. Umur pohon tampil dari formatter.
5. Tidak ada UUID/raw enum.

---

## E.4 Detail Pohon

### Tujuan

Detail Pohon harus story-based. Screen ini harus menceritakan kondisi satu pohon: lokasinya, varietasnya, umurnya, kondisi saat ini, fase saat ini, dan riwayat terbarunya.

### Wajib Ditampilkan

1. Summary pohon.
2. Kode pohon berbasis baris-kolom.
3. Lokasi baris dan kolom.
4. Varietas.
5. Tanggal tanam.
6. Umur dinamis.
7. Kondisi saat ini.
8. Fase saat ini.
9. Riwayat terbaru.
10. Aksi utama: Catat Kondisi.
11. Aksi utama: Catat Fase.
12. Owner-only action: Edit.
13. Owner-only action: Archive/Unarchive.

### Hierarchy yang Disarankan

1. Header/summary pohon.
2. Status cards untuk kondisi dan fase.
3. Informasi dasar pohon.
4. Aksi utama.
5. Riwayat terbaru/timeline.
6. Aksi owner sekunder.

### Dilarang

1. Data teknis database.
2. UUID.
3. Semua field tampil rata tanpa hierarchy.
4. Worker melihat edit/archive/delete.
5. Raw enum kondisi/fase.
6. Riwayat tampil seperti dump table.

### Acceptance Criteria

1. User paham keadaan pohon dalam beberapa detik.
2. Owner dan worker melihat aksi sesuai hak akses.
3. Riwayat terbaru mudah dibaca.
4. Tidak ada data teknis user-facing.

---

## E.5 Form Kondisi dan Form Fase

### Tujuan

Form Kondisi dan Form Fase harus cepat digunakan di lapangan. Kedua form ini harus terasa berbeda sesuai konteks, bukan copy-paste yang cuma ganti judul setengah niat.

### Wajib Digunakan

1. Chips, radio card compact, segmented option, atau dropdown untuk pilihan.
2. Catatan opsional.
3. Validasi jelas.
4. CTA utama jelas.
5. Label Bahasa Indonesia.
6. Empty/error state user-friendly.

### Form Kondisi Harus Menampilkan Pilihan

1. Sehat.
2. Perlu Perhatian.
3. Terserang Hama.
4. Terindikasi Penyakit.
5. Rusak.
6. Mati.

### Form Fase Harus Menampilkan Pilihan

1. Awal Tanam.
2. Vegetatif.
3. Berbunga.
4. Berbuah.
5. Panen.

### Dilarang

1. Pilihan vertikal besar yang boros ruang jika bisa dipadatkan.
2. Raw enum.
3. Label kondisi di form fase.
4. Label fase di form kondisi.
5. Catatan wajib tanpa alasan kuat.
6. UUID pohon.

### Acceptance Criteria

1. User bisa menyelesaikan pencatatan dengan cepat.
2. Worker tidak perlu mengetik banyak.
3. Form kondisi dan fase jelas berbeda.
4. Validasi muncul dengan bahasa mudah dipahami.

---

## E.6 Jadwal, Tugas, dan Realisasi

### Tujuan

Screen jadwal, tugas, dan realisasi harus membedakan rencana dan eksekusi.

Owner mengelola rencana. Worker menjalankan pekerjaan. Jangan dicampur, nanti aplikasinya jadi rapat koordinasi yang menyamar sebagai UI.

### Owner Wajib Bisa

1. Melihat jadwal.
2. Membuat jadwal dari SOP.
3. Membuat jadwal manual.
4. Melihat status tugas worker.
5. Melihat tugas selesai/tertunda/belum selesai.
6. Melihat detail instruksi dan target.

### Worker Wajib Bisa

1. Melihat tugas hari ini.
2. Melihat tugas pending/belum selesai.
3. Membuka detail tugas.
4. Menyelesaikan tugas.
5. Menunda tugas.
6. Mengisi catatan realisasi jika perlu.

### List Tugas Harus Menampilkan

1. Judul tugas.
2. Tanggal pelaksanaan.
3. Target/lokasi.
4. Status.
5. Instruksi ringkas jika relevan.
6. Worker assigned untuk owner.

### Detail Tugas Harus Menampilkan

1. Judul tugas.
2. Status tugas.
3. Tanggal.
4. Target.
5. Instruksi.
6. Sumber tugas jika relevan: jadwal atau laporan operasional.
7. Aksi worker: selesai/tunda.
8. Riwayat realisasi jika tersedia.

### Dilarang

1. Semua status/filter dibuat tombol besar vertikal.
2. Raw enum seperti `pending`, `completed`, `postponed`.
3. UUID task/schedule/worker.
4. Worker melihat aksi owner.
5. Owner flow dan worker flow dibuat sama.

### Acceptance Criteria

1. Owner dapat membedakan jadwal dan status tugas.
2. Worker dapat menyelesaikan/tunda tugas tanpa bingung.
3. Filter tidak memakan layar terlalu banyak.
4. Status tampil sebagai badge Bahasa Indonesia.

---

## E.7 Laporan Operasional

### Tujuan

Laporan Operasional harus membantu worker melaporkan kejadian kebun dan membantu owner menindaklanjuti laporan tersebut.

### Worker Wajib Bisa

1. Membuat laporan operasional.
2. Memilih kategori laporan.
3. Menambahkan lokasi/catatan singkat.
4. Mengirim laporan dengan CTA jelas.

### Owner Wajib Bisa

1. Melihat daftar laporan.
2. Melihat laporan baru.
3. Membuka detail laporan.
4. Mengubah status laporan.
5. Membuat tugas tindak lanjut dari laporan.

### Detail Laporan Harus Menampilkan

1. Kategori laporan.
2. Status laporan.
3. Lokasi/catatan lokasi.
4. Deskripsi.
5. Pelapor dalam bentuk nama, bukan UUID.
6. Tanggal laporan.
7. Aksi tindak lanjut.

### Dilarang

1. Raw status seperti `new`, `in_progress`, `resolved`, `rejected`.
2. UUID laporan atau user.
3. Form laporan terlalu panjang untuk worker.
4. Kategori laporan tampil sebagai enum Inggris mentah.

### Acceptance Criteria

1. Worker bisa membuat laporan dengan cepat.
2. Owner bisa memahami laporan dan statusnya.
3. Status dan kategori tampil dengan Bahasa Indonesia.
4. Tindak lanjut menjadi tugas jelas secara UX.

---

## E.8 SOP

### Tujuan

SOP harus tampil sebagai template standar perawatan, bukan dokumen panjang. SOP membantu owner membuat jadwal dengan lebih konsisten.

### List SOP Harus Menampilkan

1. Nama SOP.
2. Kategori perawatan.
3. Interval hari.
4. Target default.
5. Status aktif/nonaktif.
6. Acuan jadwal berikutnya jika tersedia.

### Detail SOP Harus Menampilkan

1. Nama SOP.
2. Kategori.
3. Instruksi default.
4. Interval.
5. Target default.
6. Status aktif.
7. Realisasi terakhir jika tersedia.
8. Acuan jadwal berikutnya.
9. Aksi buat jadwal dari SOP.
10. Aksi edit.
11. Aksi aktif/nonaktif.

### Dilarang

1. SOP tampil seperti dokumen prosedur panjang.
2. Raw enum kategori/status.
3. UUID SOP.
4. Semua aksi tampil sebagai tombol full-width bertumpuk.

### Acceptance Criteria

1. Owner memahami SOP sebagai template.
2. Owner bisa membuat jadwal dari SOP.
3. Acuan jadwal berikutnya mudah dipahami.
4. Status aktif/nonaktif tampil user-friendly.

---

## E.9 Profile

### Tujuan

Profile harus memisahkan data user dan data kebun. User harus tahu apakah sedang mengelola akunnya sendiri atau kebun.

### Profil Akun

Profil Akun berisi:

1. Nama lengkap.
2. Email.
3. Nomor HP.
4. Edit profil.
5. Ubah password jika tersedia.
6. Logout.

### Aturan Profil Akun

1. User tanpa farm/membership tetap harus bisa membuka Profil Akun.
2. User tanpa farm/membership tetap harus bisa mengedit nama dan nomor HP.
3. Profil Akun tidak boleh terkunci hanya karena user belum punya kebun.
4. Profil Akun tidak boleh menampilkan UUID user.

### Profil Kebun

Profil Kebun berisi:

1. Nama kebun.
2. Lokasi kebun.
3. Luas kebun.
4. Join code.
5. Copy join code.
6. Worker management untuk owner.
7. SOP management untuk owner jika masuk area Kebun.
8. Status kebun untuk worker secara sederhana.

### Aturan Profil Kebun

1. Profil Kebun hanya tampil jika user punya farm context valid.
2. Owner dapat mengelola informasi kebun sesuai hak akses.
3. Worker tidak boleh mengedit Profil Kebun.
4. Worker cukup melihat informasi kebun dasar dan status aksesnya.

### Dilarang

1. Profil Akun dan Profil Kebun dicampur tanpa section jelas.
2. User tanpa farm tidak bisa edit profil akun.
3. Worker melihat aksi owner.
4. Raw status membership.
5. UUID user/farm/membership.

### Acceptance Criteria

1. User memahami perbedaan akun dan kebun.
2. User tanpa farm tetap bisa edit profil akun.
3. Owner punya area kebun yang jelas.
4. Worker melihat profil yang sederhana.

---

# F. Codex Guardrails

Aturan ini wajib dipakai sebelum membuat prompt implementasi Codex tahap UI/UX.

## F.1 Scope Guardrails

1. Jangan redesign semua screen sekaligus.
2. Jangan implement attachment/foto dulu.
3. Jangan implement `requires_photo` dulu.
4. Jangan implement permanent delete pohon dulu.
5. Jangan membuat fitur baru di luar scope MVP.
6. Jangan mengubah database kecuali tahap semantic tree code memang membutuhkannya.
7. Jangan mengubah RLS, RPC, atau service besar untuk UI-only stage.
8. Jangan menghapus fitur yang sudah berjalan.
9. Jangan menambah screen baru tanpa dasar requirement atau screen contract.
10. Jangan membuat dashboard sebagai tabel database baru.

---

## F.2 Implementation Guardrails

1. Semua perubahan harus kecil.
2. Semua perubahan harus bisa dites.
3. Semua perubahan harus bisa di-commit per tahap.
4. Setiap tahap harus punya acceptance criteria.
5. Setiap tahap harus menjaga owner flow dan worker flow.
6. Setelah setiap tahap, jalankan manual QA.
7. Setelah setiap tahap, lakukan screenshot review.
8. Jika perubahan mulai menyentuh service/database/RLS besar, hentikan dan pecah menjadi tahap khusus.
9. Jika ada konflik dengan Product Alignment Decision Log, ikuti Product Alignment Decision Log.
10. Jika ada risiko merusak fitur lama, prioritaskan regression test daripada lanjut polish.

---

## F.3 Technical Guardrails

1. UI semantic cleanup tidak boleh membuat migration.
2. Dashboard redesign harus memakai data/service yang sudah ada jika memungkinkan.
3. Tree code formatting boleh memakai formatter/service formatting layer sebelum migration diputuskan.
4. Jika unique constraint `tree_code` menghalangi replacement pohon di lokasi yang sama setelah archive, catat sebagai database issue pending audit, bukan langsung migration.
5. UUID tetap digunakan internal untuk relasi, route params, dan query.
6. UUID tidak boleh tampil sebagai label user-facing.
7. Error teknis dari Supabase harus diformat menjadi pesan yang bisa dipahami user.
8. Loading, empty, dan error state harus tetap tersedia.
9. Jangan membuat komponen UI lokal besar jika bisa memakai `components/ui.tsx`.
10. Jangan membuat warna random di screen.

---

## F.4 QA Guardrails

Setelah setiap tahap, minimal cek:

1. App bisa dibuka di Expo.
2. Login owner masih bisa.
3. Login worker masih bisa.
4. Route guard owner/worker masih benar.
5. User pending/rejected/removed tidak masuk area operasional.
6. Data utama masih tampil.
7. Submit form utama masih berjalan.
8. Tidak ada screen blank.
9. Tidak ada UUID tampil di screen yang disentuh.
10. Tidak ada raw status/raw role/raw enum tampil di screen yang disentuh.
11. Tidak ada tombol penting yang hilang.
12. Tidak ada copy-paste label salah.
13. Tidak ada perubahan scope tanpa decision log.

---

# G. Output untuk Codex

Mini-iteration lanjutan yang harus dipakai untuk implementasi UI/UX correction adalah sebagai berikut.

---

## 8A — UI Semantic Cleanup

### Fokus

Membersihkan UI user-facing dari data teknis dan bahasa mentah.

### Scope

1. Hilangkan UUID dari UI.
2. Hilangkan database ID dari UI.
3. Format raw status/role/kondisi/fase/kategori ke Bahasa Indonesia.
4. Bersihkan teks development seperti `Iteration 1`.
5. Audit empty/loading/error/toast.
6. Hapus tombol Refresh manual yang tidak perlu pada screen utama.
7. Pastikan bahasa UI konsisten Bahasa Indonesia.

### Tidak Termasuk

1. Dashboard redesign besar.
2. Tree code service migration.
3. Profile separation besar.
4. Attachment/foto.
5. `requires_photo`.
6. Permanent delete pohon.

### Acceptance Criteria

1. Tidak ada UUID tampil pada screen yang disentuh.
2. Tidak ada raw status/role/raw enum tampil pada screen yang disentuh.
3. Error dan empty state memakai Bahasa Indonesia.
4. Tombol Refresh besar yang tidak perlu hilang.
5. Fitur lama tetap berjalan.

---

## 8B — Dashboard Redesign

### Fokus

Mengubah dashboard owner menjadi insight-based dan dashboard worker menjadi task-based.

### Scope

1. Redesign Owner Dashboard.
2. Redesign Worker Dashboard.
3. Quick action dibatasi.
4. Dashboard tidak lagi menjadi tumpukan tombol navigasi.
5. Status dan metric diberi hierarchy visual.
6. Empty/loading/error state dashboard konsisten.

### Tidak Termasuk

1. Menambah tabel dashboard.
2. Membuat service agregasi besar baru jika data existing cukup.
3. Attachment/foto.
4. Permanent delete.
5. Redesign seluruh screen lain.

### Acceptance Criteria

1. Owner Dashboard menjawab kondisi prioritas kebun.
2. Worker Dashboard menjawab tugas hari ini.
3. Tidak ada tombol Refresh besar.
4. Tidak ada UUID/raw status.
5. Quick action tidak mendominasi dashboard.

---

## 8C — Tree UX Polish

### Fokus

Memperbaiki pengalaman list, detail, dan form pohon.

### Scope

1. Pohon List scan-friendly.
2. Detail Pohon story-based.
3. Umur pohon dinamis dari `planted_at`.
4. Kode pohon berbasis baris-kolom sebagai display code.
5. Form Tambah/Edit Pohon tidak menonjolkan input kode manual.
6. Form Kondisi/Fase memakai pilihan compact.
7. Riwayat pohon lebih timeline-oriented.
8. Owner-only action dan worker action dipisah jelas.

### Tidak Termasuk

1. Migration constraint tree_code langsung.
2. Attachment/foto pohon.
3. Permanent delete.
4. Redesign jadwal/tugas/laporan/SOP secara besar.

### Acceptance Criteria

1. Card pohon mudah di-scan.
2. Detail pohon punya hierarchy jelas.
3. Umur pohon tampil benar.
4. Kode pohon tampil berbasis baris-kolom.
5. Worker tidak melihat edit/archive.
6. Tidak ada UUID/raw enum.

---

## 8D — Profile Separation

### Fokus

Memisahkan Profil Akun dan Profil Kebun secara UX.

### Scope

1. Profil Akun berisi data user.
2. Profil Kebun berisi data kebun.
3. User tanpa farm/membership tetap bisa akses Profil Akun.
4. Owner punya area Kebun untuk join code, worker management, dan pengaturan kebun.
5. Worker punya profile sederhana.
6. Status membership diformat ke Bahasa Indonesia.

### Tidak Termasuk

1. Multi-farm complex.
2. Worker cross-farm history.
3. Attachment foto profil.
4. Perubahan database besar.

### Acceptance Criteria

1. User tanpa farm bisa edit profil akun.
2. Owner dan worker melihat profile sesuai role.
3. Profil Akun dan Profil Kebun tidak tercampur.
4. Tidak ada UUID/raw status.
5. Guard tidak rusak.

---

## 8E — Schedule/Task UX Polish

### Fokus

Memperbaiki UX jadwal, tugas, dan realisasi.

### Scope

1. List jadwal lebih scan-friendly.
2. List tugas worker lebih task-based.
3. Detail tugas punya hierarchy jelas.
4. Filter status/tanggal/kategori memakai chips/dropdown/segmented control.
5. Realisasi tugas cepat: selesai/tunda dan catatan opsional.
6. Owner melihat status tugas worker dengan jelas.
7. Worker tidak melihat aksi owner.

### Tidak Termasuk

1. Recurring task otomatis penuh.
2. Push notification.
3. `requires_photo`.
4. Bukti foto tugas.
5. Attachment.

### Acceptance Criteria

1. Worker mudah menemukan tugas hari ini.
2. Worker mudah menyelesaikan atau menunda tugas.
3. Owner dapat memahami status tugas.
4. Filter tidak boros ruang.
5. Tidak ada UUID/raw status.

---

## 8F — Report/SOP UX Polish

### Fokus

Memperbaiki UX laporan operasional dan SOP.

### Scope

1. Worker Create Operational Report lebih cepat dan sederhana.
2. Operational Report List lebih mudah dipindai.
3. Detail laporan punya hierarchy jelas.
4. Status laporan memakai badge Bahasa Indonesia.
5. SOP List dan SOP Detail lebih template-oriented.
6. Acuan jadwal berikutnya pada SOP mudah dipahami.
7. Aksi tindak lanjut laporan menjadi tugas jelas.

### Tidak Termasuk

1. Foto laporan.
2. Bukti tugas.
3. Attachment storage.
4. Perubahan schema SOP besar.
5. Custom target SOP baru.

### Acceptance Criteria

1. Worker dapat membuat laporan dengan cepat.
2. Owner dapat memahami laporan baru dan statusnya.
3. SOP terasa seperti template perawatan.
4. Tidak ada UUID/raw enum.
5. Tidak ada tombol full-width bertumpuk yang tidak perlu.

---

## 8G — Final Consistency and Regression QA

### Fokus

Audit akhir seluruh UI setelah tahap 8A sampai 8F.

### Scope

1. Audit visual consistency.
2. Audit copywriting Bahasa Indonesia.
3. Audit UUID/raw status/raw enum.
4. Audit empty/loading/error states.
5. Audit owner vs worker flow.
6. Audit screen yang terindikasi copy-paste salah.
7. Manual QA fitur utama.
8. Screenshot review akhir.
9. Regression test alur utama.

### Regression Checklist

1. Auth register/login/logout.
2. Owner create farm.
3. Worker join farm.
4. Owner approve/reject/remove worker.
5. Owner create/edit/archive/unarchive tree.
6. Owner/worker create condition report.
7. Owner/worker create growth phase record.
8. Owner create SOP.
9. Owner create schedule.
10. Worker view task.
11. Worker complete/postpone task.
12. Worker create operational report.
13. Owner view/update operational report.
14. Owner dashboard.
15. Worker dashboard.
16. User without farm can edit account profile.
17. Pending/rejected/removed guard.

### Acceptance Criteria

1. Tidak ada screen utama yang terlihat seperti CRUD template mentah.
2. Tidak ada UUID/raw status/raw enum tampil di UI user-facing.
3. Dashboard owner insight-based.
4. Dashboard worker task-based.
5. Worker flow lebih sederhana daripada owner flow.
6. Semua fitur utama masih berjalan.
7. App siap masuk screenshot review akhir, black-box regression, dan UAT awal.

---

# H. Final Decision

Hasil review desain screenshot versi pertama diterima sebagai dasar UI/UX correction Avology V2.

Keputusan final:

1. UI versi pertama tidak dibuang total karena fungsi utama sudah tercakup.
2. UI versi pertama harus dipoles secara bertahap karena masih terlalu terasa seperti CRUD template.
3. Fokus perbaikan bukan menambah fitur, tetapi memperbaiki hierarchy, navigation, mobile feel, semantic UI, dan screen-specific UX.
4. Product Alignment Decision Log tetap menjadi acuan product direction.
5. Dokumen ini menjadi source of truth tambahan untuk UI/UX correction sebelum prompt Codex implementasi dibuat.
6. Implementasi harus dilakukan dalam mini-iteration 8A sampai 8G.

---

# I. Non-Goals

Hal berikut bukan target dokumen dan bukan target implementasi UI/UX correction awal:

1. Membuat kode.
2. Membuat prompt Codex implementasi.
3. Membuat migration SQL.
4. Mengubah RLS.
5. Mengubah RPC besar.
6. Mengubah database untuk attachment.
7. Mengimplementasikan foto pohon.
8. Mengimplementasikan foto laporan.
9. Mengimplementasikan bukti tugas.
10. Mengimplementasikan `requires_photo`.
11. Mengimplementasikan permanent delete pohon.
12. Membuat multi-farm complex.
13. Membuat worker cross-farm history.
14. Membuat fitur non-MVP.

---

# J. Ringkasan Praktis untuk Implementasi Berikutnya

Urutan kerja paling aman:

```txt
8A UI Semantic Cleanup
↓
8B Dashboard Redesign
↓
8C Tree UX Polish
↓
8D Profile Separation
↓
8E Schedule/Task UX Polish
↓
8F Report/SOP UX Polish
↓
8G Final Consistency and Regression QA
```

Prinsip paling penting:

```txt
Jangan ubah semuanya sekaligus.
```

Avology V2 sudah punya fungsi utama. Tugas berikutnya adalah membuat fungsi itu terasa seperti produk mobile operasional kebun yang rapi, bukan museum tombol dan UUID.
