# Review Ulang Checkpoint Avology V2 dengan Referensi Avology Design.zip

Tanggal review: 22 Juni 2026  
Objek review utama:

- `review checkpoint avology.docx`
- `Avology design.zip`
- source-of-truth Avology V2: MVP Scope, Requirement, Product Alignment Decision Log, Screen Navigation Flow, Implementation Master Plan, Traceability Matrix, UAT Plan, Black-box Testing Plan

Catatan penting: `Avology design.zip` dipakai sebagai referensi arah visual, bukan rancangan absolut. Jadi review ini tidak menuntut checkpoint harus sama pixel-perfect. Yang dinilai adalah apakah checkpoint sudah mengambil prinsip desain yang benar: mobile-first, operasional kebun, visual hierarchy kuat, penggunaan foto/placeholder, dashboard insight-based, worker task-based, dan flow tidak kembali menjadi CRUD mentah.

---

## 1. Putusan Eksekutif Baru

Setelah `Avology design.zip` bisa dibaca, output review sebelumnya berubah pada bagian desain, bukan pada urutan strategi inti.

Kesimpulan lama masih benar: **jangan langsung masuk fitur foto/media sebelum core flow stabil**.

Namun kesimpulan desain sekarang lebih keras:

**Checkpoint saat ini secara fungsi terlihat sudah bergerak maju, tapi secara kualitas visual masih jauh di bawah referensi desain.** Bukan karena warna salah. Warna hijau dan background sudah cukup konsisten. Masalahnya: checkpoint masih terlalu banyak berupa text-card list satu kolom, form besar, tombol full-width, dan detail screen yang terasa seperti database admin yang diberi cat hijau. Ya, teknologi modern: kalau diberi border radius, manusia langsung menyebutnya UI polish.

Perbandingan realistis:

| Area | Sebelum membaca design zip | Setelah membaca design zip |
| --- | --- | --- |
| Core MVP | Tetap sekitar 70% terindikasi ada | Tetap sekitar 70%, tapi perlu regression audit karena beberapa screen salah mapping |
| UI readiness | Dulu dinilai sekitar 60% | Turun ke sekitar 50-55% jika dibanding arah visual design reference |
| Visual identity | Terlihat cukup bersih | Masih kurang branded, kurang visual, kurang agritech/mobile-app |
| Tree screen | Ada, tapi belum final | Gap besar karena design reference memakai grid 2 kolom dan foto pohon |
| Detail pohon | Ada, tapi kasar | Gap sangat besar karena design reference memakai hero image, ringkasan visual, timeline lebih matang |
| Dashboard owner | Sudah bukan tombol doang | Masih jauh dari referensi yang lebih insight-based dan visual |
| Jadwal/task proof | Belum ada foto | Design reference sudah memberi sinyal `Butuh Bukti`, jadi bukti foto memang harus masuk backlog serius |
| Strategi lanjut | Stabilkan core dulu | Tetap stabilkan core dulu, lalu visual reconstruction, lalu media/foto mini-iteration |

Putusan akhir:

**Checkpoint belum siap UAT.** Bukan karena semuanya hancur, tapi karena ada dua masalah yang berbahaya: coverage fitur belum terbukti penuh dan visual implementation belum menyerap referensi desain dengan cukup baik.

---

## 2. Apa yang Berubah Setelah Avology Design.zip Terbaca

Review sebelumnya menyebut desain checkpoint “sudah membaik tapi belum final.” Setelah melihat zip, kalimat itu terlalu baik hati untuk ukuran proyek skripsi yang butuh bukti kuat.

Referensi desain memiliki beberapa kualitas yang checkpoint belum capai:

1. **Visual identity lebih kuat.** Ada logo Avology, ikon, ilustrasi, green gradient, dan elemen natural yang membuat app terasa punya brand.
2. **Pohon menjadi objek visual.** Tree list dan detail memakai foto pohon, bukan cuma teks varietas, umur, dan status.
3. **Dashboard lebih premium dan ringkas.** Owner Dashboard di referensi memakai hero card kondisi kebun, persentase, warning card, progress/distribution, dan aktivitas terbaru.
4. **Jadwal lebih operasional.** Jadwal reference menampilkan status hari ini, search, filter, badge, dan `Butuh Bukti`.
5. **Profil Kebun lebih actionable.** Kode join, worker pending, worker aktif, approve/reject, dan delete/remove worker terlihat dalam satu konsep “Kebun Saya”, bukan tersebar seperti menu admin.
6. **Navigation lebih mobile-app.** Bottom nav memakai ikon besar, FAB, dan hierarchy yang lebih terasa native app.

Checkpoint saat ini baru mengambil warna, card, dan layout dasar. Itu baru kulit luar. Daging UX-nya masih belum cukup matang.

---

## 3. Ringkasan Source-of-Truth yang Harus Jadi Acuan

Baseline MVP tetap tidak berubah. Avology V2 adalah aplikasi mobile operasional kebun alpukat untuk owner dan worker, bukan sekadar aplikasi pencatatan pohon.

Fitur final MVP yang harus tetap menjadi pembanding:

1. Auth, register, login, logout.
2. Profil akun.
3. Role owner/worker berbasis farm membership.
4. Owner membuat kebun.
5. Join code kebun.
6. Worker request join.
7. Owner approve/reject/remove worker.
8. Pending/rejected/removed access guard.
9. Manajemen pohon: create, edit, archive, unarchive, detail.
10. Laporan kondisi pohon.
11. Riwayat kondisi pohon.
12. Laporan operasional kebun.
13. Tindak lanjut laporan operasional menjadi task.
14. SOP perawatan.
15. Acuan jadwal berikutnya dari interval SOP.
16. Jadwal perawatan dari SOP.
17. Jadwal manual.
18. Tugas worker.
19. Worker complete/postpone task.
20. Realisasi tugas melalui care activities.
21. Fase pertumbuhan pohon.
22. Growth monitoring untuk berbunga/berbuah.
23. Riwayat pohon terintegrasi.
24. Dashboard owner.
25. Dashboard worker.
26. Role guard dan RLS behavior.

Fitur media/foto belum menjadi core MVP awal berdasarkan product alignment, tetapi untuk versi “full fitur sampai selesai”, foto perlu masuk setelah core stabil:

1. Foto utama pohon.
2. Foto laporan kondisi.
3. Foto laporan operasional.
4. Bukti foto realisasi tugas.
5. Optional `requires_photo` pada jadwal/tugas.
6. Supabase Storage.
7. Tabel attachment.
8. Storage policy.
9. Preview/fallback image.
10. Upload error handling.

---

## 4. Analisis Referensi Desain Avology Design.zip

### 4.1 Get Started, Login, Register

Referensi desain:

- Get Started sangat sederhana, memakai logo alpukat/lampu sebagai pusat brand.
- Login/Register clean, fokus pada form, tidak terlalu banyak card.
- Register reference punya confirm password dan password visibility.

Checkpoint:

- Get Started lebih deskriptif dengan card “Operasional kebun alpukat”. Ini bagus secara positioning, tapi brand/logo hilang.
- Login/Register sudah rapi, tetapi lebih plain dan belum punya kedalaman visual.
- Register checkpoint belum terlihat confirm password/eye toggle.

Review:

Checkpoint boleh mempertahankan copywriting operasional, tapi harus mengembalikan identitas visual dari reference: logo/illustration, spacing lebih elegan, dan password UX yang lengkap.

Keputusan:

- Auth tidak perlu rombak besar.
- Tambahkan brand logo/illustration ringan.
- Tambahkan confirm password dan password visibility jika belum ada.
- Jangan bikin auth jadi halaman brosur panjang.

---

### 4.2 Onboarding, Buat Kebun, Gabung Kebun, Status Pengajuan

Referensi desain:

- Onboarding/Gabung Kebun lebih personal: ada sapaan nama user dan icon profile.
- Status Pengajuan dan Pengajuan Ditolak punya riwayat pengajuan, status card, dan aksi lanjut.
- Buat Kebun reference lebih detail: nama kebun, lokasi, kota/kabupaten, provinsi, luas kebun, deskripsi kebun.

Checkpoint:

- Onboarding “Pilih Akses” sudah lebih jelas dan menampilkan akun aktif.
- Buat Kebun checkpoint lebih sederhana: nama, lokasi, luas.
- Gabung Kebun checkpoint sederhana dan fungsional.
- Pending approval checkpoint ada dan cukup jelas.
- Rejected/removed tidak terlihat dalam checkpoint, atau minimal tidak terbukti.

Review:

Checkpoint lebih sederhana dan lebih dekat ke source-of-truth MVP. Ini bukan masalah. Jangan mengejar semua field desain reference jika schema belum mendukung. Namun rejected/removed flow wajib ada karena itu bagian guard inti, bukan hiasan.

Keputusan:

- Pertahankan form Buat Kebun sederhana.
- Rapikan satuan luas agar tidak membingungkan.
- Pastikan Rejected Screen dan Removed Access Screen ada dan bisa diuji.
- Jangan menambah field kota/provinsi/deskripsi jika tidak ada kebutuhan implementasi sekarang.

---

### 4.3 Owner Dashboard

Referensi desain:

- Hero card “Kondisi Kebun” dengan persentase kondisi sehat.
- Data besar: total pohon, sehat, perhatian.
- Warning card “pohon butuh perhatian”.
- Performa panen dan distribusi fase pohon.
- Aktivitas terbaru.
- Bottom nav icon-based.

Checkpoint:

- Ada “Kondisi Pohon”: total 10, sehat 6, bermasalah 4.
- Ada “Perlu Perhatian”: pohon perlu perhatian dan tugas belum selesai.
- Ada monitoring kebun: berbunga, berbuah, tugas hari ini.
- Ada quick action: tambah pohon, buat jadwal, lihat laporan.
- Belum terlihat laporan operasional baru, worker pending, SOP due/overdue.
- Join code tampil di dashboard.

Review:

Checkpoint sudah lebih benar daripada dashboard CRUD, tapi belum sampai level insight-based seperti referensi. Hero card reference lebih kuat karena menjawab “seberapa sehat kebun hari ini?” Checkpoint menjawab “ini beberapa angka pohon”. Bedanya tipis secara teks, tapi besar secara UX.

Masalah:

- Dashboard masih terlalu pohon-sentris.
- Quick action terlalu dominan.
- Join code seharusnya pindah ke Profil Kebun/Kebun Saya.
- Missing insight wajib: laporan baru, worker pending, SOP terlambat/jatuh tempo.
- Tidak ada aktivitas terbaru.

Keputusan:

- Dashboard owner perlu satu tahap redesign terarah.
- Jangan hapus quick action, tapi turunkan prioritasnya.
- Tambah “Perlu Ditindaklanjuti” berbasis data: pohon bermasalah, tugas belum selesai/terlambat, laporan baru, worker pending, SOP due.
- Pakai reference sebagai arah visual: hero card, insight cards, recent activity.

---

### 4.4 Tree List Owner dan Worker

Referensi desain:

- Tree list memakai grid 2 kolom.
- Tiap card punya foto pohon.
- Ada badge status langsung di atas foto.
- Ada search besar, filter icon, chips status, dan sorting.
- FAB untuk tambah pohon.

Checkpoint:

- Tree list masih list 1 kolom.
- Card berisi kode, baris/kolom, varietas, umur, fase, status.
- Tidak ada foto/placeholder.
- Tombol tambah pohon full-width di bawah.
- Worker tree list serupa owner, tanpa aksi tambah.

Review:

Ini gap visual terbesar. Tree list checkpoint memang fungsional, tapi feel-nya masih “list record database”. Referensi desain membuat pohon terasa seperti objek kebun yang bisa dikenali visual. Untuk aplikasi kebun, ini bukan kosmetik kosong.

Namun jangan langsung upload foto dulu. Langkah aman:

1. Ubah layout tree list menjadi grid/card visual.
2. Tambahkan placeholder foto lokal/static dulu.
3. Setelah stabil, baru implement tree main photo dari storage.

Keputusan:

- Tree list harus masuk visual reconstruction.
- 2-column grid wajib untuk owner dan worker jika layar cukup.
- FAB lebih baik daripada button bawah.
- Foto/placeholder harus ada sebagai visual shell sebelum upload storage.

---

### 4.5 Tree Detail

Referensi desain:

- Hero image besar di atas.
- Kode pohon, varietas, fase, status ditampilkan ringkas.
- Info utama memakai icon card: varietas, umur, tanggal tanam, lokasi.
- Ada aksi utama: buat jadwal, buat laporan.
- Ada performa pohon dan timeline riwayat visual.
- Riwayat punya thumbnail foto pada laporan kondisi.

Checkpoint:

- Detail pohon menampilkan data lengkap.
- Timeline riwayat ada.
- Riwayat kondisi ada.
- Owner punya aksi: Catat Kondisi, Catat Fase, Edit Pohon, Arsipkan.
- Worker detail tidak punya edit/arsip, ini bagus jika benar.
- Tidak ada hero image.
- Tidak ada foto riwayat.
- Riwayat masih banyak duplikasi dan card panjang.

Review:

Core detail sudah ada, tapi checkpoint jauh dari reference. Detail screen saat ini informatif, tapi tidak elegan. Terlalu banyak teks dan label database. Kalau diuji ke user awam, mereka bisa paham, tapi tidak akan terasa “aplikasi matang”.

Masalah serius:

- `Edit Pohon Owner` di checkpoint docx tampaknya salah screenshot, karena image yang muncul adalah `Catat Fase`. Ini bisa berarti dokumen salah mapping atau route salah. Harus diaudit, jangan ditebak.
- Riwayat kondisi dan timeline terlihat dobel/overlap. Perlu satu model: timeline terintegrasi sebagai utama, tab/filter opsional.
- Belum ada visual evidence/foto.

Keputusan:

- Audit route Edit Tree dulu.
- Setelah route aman, redesign detail tree mengikuti reference: hero placeholder, info grid, action menu, timeline.
- Jangan tambah foto upload sebelum detail flow dan history sudah benar.

---

### 4.6 Catat Kondisi dan Catat Fase

Referensi desain tidak banyak menampilkan form kondisi/fase, tapi prinsipnya worker flow harus sederhana.

Checkpoint:

- Form catat kondisi/fase sudah cukup jelas.
- Pilihan dibuat sebagai tombol besar.
- Ada ringkasan pohon sebelum input.
- Catatan opsional tersedia.

Review:

Ini salah satu bagian checkpoint yang paling aman. Untuk worker lapangan, tombol besar justru membantu. Jangan over-design bagian ini dulu.

Gap:

- Belum ada foto laporan kondisi.
- Button pilihan bisa dibuat selected-state lebih jelas.
- Bottom nav pada nested form bisa mengganggu fokus.
- Validasi wajib pilih kondisi/fase harus diuji.

Keputusan:

- Jangan rombak besar.
- Tambah selected-state dan optional photo nanti.
- Jika memungkinkan, hide bottom tab di form nested agar fokus input lebih baik.

---

### 4.7 Jadwal Perawatan dan Tugas

Referensi desain:

- Jadwal owner punya hero status hari ini.
- Ada filter status horizontal.
- Ada search dan filter icon.
- List jadwal ringkas dengan badge status.
- Ada badge `Butuh Bukti`.
- FAB untuk tambah jadwal.

Checkpoint:

- List jadwal owner ada.
- Jadwal manual form ada.
- Target farm/row/column/tree/custom ada.
- Worker active bisa dipilih.
- Detail Jadwal Owner di docx tampaknya duplikat form Jadwal Manual, bukan detail jadwal.
- Belum terlihat jadwal dari SOP.
- Belum terlihat task yang dihasilkan dari jadwal.
- Belum terlihat bukti foto/requires_photo.

Review:

Ini modul paling berbahaya setelah membaca desain. Di referensi, jadwal adalah pusat operasional. Di checkpoint, jadwal masih terasa seperti “buat data jadwal manual”. Kalau flow jadwal dari SOP dan task generation belum aman, app tidak bisa disebut operasional penuh.

`Butuh Bukti` di referensi desain penting: itu bukti bahwa konsep foto realisasi tugas memang masuk arah produk, walau implementasinya ditunda. Jadi media/foto bukan ide liar. Tapi tetap jangan masuk sebelum task flow pass.

Keputusan:

- Jadwal/task harus menjadi audit prioritas tertinggi.
- Pastikan Create Schedule From SOP ada.
- Pastikan Schedule Detail benar-benar detail, bukan form duplicate.
- Pastikan jadwal menghasilkan care task.
- Pastikan worker bisa complete/postpone.
- Baru setelah itu implement `requires_photo` dan proof photo.

---

### 4.8 Laporan Operasional Owner dan Worker

Referensi desain zip tidak memberi detail sebanyak modul dashboard/tree/jadwal, tetapi source-of-truth menempatkan operational report sebagai fitur critical.

Checkpoint:

- Owner report list ada.
- Detail report owner ada.
- Update status ada.
- Tombol buat tugas tindak lanjut ada.
- Worker report screen terlihat ada.
- Foto laporan belum ada.

Review:

Owner side cukup menjanjikan. Risiko utamanya bukan UI, tapi flow tindak lanjut: apakah task benar-benar dibuat dari report dan muncul di worker task list? Kalau tidak, laporan operasional cuma kotak saran digital. Bagus buat museum kegagalan produk.

Keputusan:

- Test full flow: worker buat laporan → owner lihat → owner ubah status → owner buat task → worker lihat task → worker realisasi.
- UI filter laporan perlu diringkas setelah flow aman.
- Foto laporan operasional masuk media mini-iteration, bukan sekarang.

---

### 4.9 Profil Akun, Profil Kebun, Worker Management, SOP

Referensi desain:

- Profil akun punya avatar/icon, info akun, edit profile, password, logout.
- Kebun Owner menyatukan farm detail, join code, pending request, active workers.
- Worker approval langsung inline.

Checkpoint:

- Profil Akun ada dan dipisah dari Profil Kebun.
- Profil Kebun ada dan menyimpan data kebun + akses manajemen pekerja/SOP.
- Manajemen Pekerja ada.
- SOP Perawatan di docx tampaknya salah mapping/duplikat karena screenshot yang terlihat sama dengan Manajemen Pekerja, atau minimal tidak terbukti.

Review:

Arah checkpoint benar: profil akun dan profil kebun dipisah. Namun reference desain menunjukkan Profil Kebun bisa lebih kuat sebagai hub operasional kebun. Checkpoint sekarang terlalu menu-like: tombol Manajemen Pekerja dan SOP Perawatan. Itu tidak salah, tapi kurang efisien.

Masalah:

- SOP screen belum terbukti dari screenshot.
- Worker management card masih sangat kasar.
- Copy/status sudah cukup baik, tapi visual masih lemah.

Keputusan:

- Jangan gabungkan Akun dan Kebun lagi.
- Audit SOP route/screen.
- Profil Kebun boleh mengadopsi reference: join code copy, pending worker summary, active worker summary.
- Tab owner lebih masuk akal diberi label “Kebun” daripada “Akun”, tapi harus hati-hati agar profil akun tetap mudah dicapai.

---

### 4.10 Worker Dashboard dan Worker Task

Referensi produk menyatakan worker dashboard harus task-based.

Checkpoint:

- Worker dashboard ada.
- Tugas hari ini dominan.
- Ada tugas belum selesai dan selesai.
- Ada aksi lapangan: lihat tugas, laporkan kondisi pohon, buat laporan operasional.
- Worker task list ada.
- Detail task/complete/postpone belum cukup terbukti dari screenshot.

Review:

Worker dashboard checkpoint lebih dekat ke source-of-truth dibanding owner dashboard. Ini bagus. Tapi task detail dan realisasi tetap wajib diuji. Worker app tanpa realisasi task itu seperti payung tanpa kain. Ada rangkanya, tetap basah.

Keputusan:

- Worker dashboard jangan dibuat sekompleks owner.
- Prioritaskan task detail, complete, postpone, note realisasi.
- Proof photo masuk setelah complete/postpone stabil.

---

## 5. Gap Fitur terhadap Full Feature

### 5.1 Fitur Core yang Terlihat Ada

Berdasarkan screenshot checkpoint:

- Auth/get started/login/register.
- Onboarding role decision.
- Create farm.
- Join farm.
- Pending approval.
- Profile account.
- Owner dashboard.
- Tree list owner/worker.
- Tree detail owner/worker.
- Create condition report.
- Create growth phase.
- Schedule list.
- Manual schedule form.
- Operational report owner.
- Operational report detail owner.
- Profile owner/worker.
- Farm profile.
- Worker management.
- Worker dashboard.
- Worker task list.
- Worker report list/form indication.

### 5.2 Fitur Core yang Belum Terbukti Aman

- Rejected screen.
- Removed access screen.
- Edit tree route/screen.
- Unarchive tree.
- Create schedule from SOP.
- Schedule detail.
- Task generation from schedule.
- Worker task detail.
- Complete task.
- Postpone task.
- Care activity creation.
- Task from operational report.
- SOP list/detail/create/edit/active toggle.
- SOP next schedule reference.
- Growth monitoring dedicated screen.
- Owner task list/detail.
- Dashboard owner missing insight.
- Dashboard worker data correctness.
- Role guard and RLS behavior.

### 5.3 Fitur Media/Foto yang Belum Ada

Belum terlihat:

- Foto utama pohon.
- Placeholder foto pohon di checkpoint tree list/detail.
- Foto laporan kondisi.
- Foto laporan operasional.
- Foto bukti realisasi tugas.
- `requires_photo`.
- Supabase Storage integration.
- Tabel photo/attachment.
- Preview image.
- Replace/delete image policy.

Ini gap besar kalau targetnya “full fitur sampai selesai”. Tapi urutannya tetap harus setelah task/report/tree flow stabil.

---

## 6. Review Visual Berdasarkan Referensi Desain

### 6.1 Yang Sudah Selaras

- Warna hijau dan background soft sudah mendekati referensi.
- Card putih dengan border ringan sudah konsisten.
- Copywriting sudah lebih operasional.
- Profil Akun vs Profil Kebun mulai dipisah.
- Dashboard owner sudah mencoba menampilkan insight, bukan hanya tombol.
- Worker dashboard sudah task-based.
- Form worker memakai pilihan klik, bukan input teks bebas berlebihan.

### 6.2 Yang Belum Selaras

- Brand/logo Avology belum kuat di auth/get started.
- Dashboard checkpoint belum sekuat hero card reference.
- Tree list belum grid dan belum visual.
- Detail pohon belum punya hero image.
- Jadwal belum punya summary hero dan badge bukti seperti reference.
- Profil Kebun belum sekomprehensif reference “Kebun Saya”.
- Bottom nav checkpoint terlalu textual; reference lebih icon-based dan lebih mobile-native.
- Tombol full-width terlalu banyak.
- Filter masih memakan layar dan belum jadi chips/search/filter pattern yang matang.
- Banyak screen terasa seperti “screen header + card + button”, berulang tanpa variasi hierarchy.

### 6.3 Putusan Desain

Checkpoint layak disebut **functional UI**, belum layak disebut **final polished mobile UI**.

Kalau targetnya hanya “bisa demo internal ke diri sendiri”, cukup. Kalau targetnya UAT dan skripsi, belum. UAT menilai kemudahan, manfaat, tampilan, dan alur. UI yang terlalu tekstual bisa tetap lulus kalau fiturnya jelas, tapi akan menurunkan persepsi profesionalitas.

---

## 7. Risiko Besar Jika Langsung Lanjut Fitur Foto

Langsung masuk foto sekarang adalah keputusan yang kelihatan produktif tapi sebenarnya mahal.

Risikonya:

1. Storage/RLS error menghabiskan limit.
2. Upload berhasil tapi task flow belum benar.
3. Foto bukti masuk, tapi care activity belum tercatat rapi.
4. Tree photo masuk, tapi tree detail/list masih belum visual-ready.
5. Codex mengubah route dan menghapus flow lama lagi.
6. UAT gagal karena user bingung, bukan karena foto kurang.

Opportunity cost-nya jelas: setiap jam yang dipakai upload foto sebelum task flow stabil adalah jam yang tidak dipakai menutup lubang jadwal/SOP/task. Itu bukan trade-off kecil. Itu menukar fondasi dengan dekorasi.

---

## 8. Planning Lanjutan yang Direkomendasikan

### Phase 0 — Freeze Checkpoint

Tujuan: jangan kehilangan kondisi sekarang.

Tindakan:

1. `git status --short`
2. Commit kondisi sekarang.
3. Buat branch checkpoint.
4. Simpan screenshot/docx checkpoint.
5. Jangan prompt Codex besar.

Output:

- Baseline aman untuk rollback.

---

### Phase 1 — Audit Non-Edit oleh Codex

Tujuan: cari gap tanpa mengubah kode.

Audit harus memeriksa:

1. Daftar route owner dan worker.
2. Screen yang salah mapping.
3. Missing screen dibanding screen inventory.
4. Missing action dibanding source-of-truth.
5. Worker access guard.
6. Owner-only action.
7. Status rejected/removed.
8. Jadwal dari SOP.
9. Task generation.
10. Complete/postpone task.
11. SOP detail/create/edit/toggle.
12. Operational report → task.
13. Tree history integration.
14. UUID/raw enum leakage.
15. Perbedaan UI checkpoint vs design reference.

Output:

- File audit markdown: daftar PASS/FAIL/GAP.
- Tidak ada kode diubah.

---

### Phase 2 — Fix Core Route dan Missing Screen

Prioritas fix, urut keras:

1. Edit Tree screen yang salah tampil.
2. Detail Schedule screen yang salah/duplikat form.
3. Create Schedule From SOP.
4. Schedule → task generation.
5. Worker Task Detail.
6. Complete/Postpone Task + care activity.
7. Create Task From Operational Report.
8. SOP list/detail/create/edit/active toggle.
9. Rejected/Removed Access screen.
10. Unarchive Tree.

Output:

- Core MVP bisa diklik penuh owner/worker.

---

### Phase 3 — Regression Manual Full Flow

Test wajib:

1. Register owner.
2. Owner create farm.
3. Register worker.
4. Worker join code.
5. Owner approve worker.
6. Worker masuk dashboard.
7. Owner create tree.
8. Owner edit tree.
9. Owner archive/unarchive tree.
10. Worker view tree.
11. Worker catat kondisi.
12. Worker catat fase.
13. Owner create SOP.
14. Owner create schedule from SOP.
15. Owner create manual schedule.
16. Worker lihat task.
17. Worker complete task.
18. Worker postpone task.
19. Tree history menampilkan condition/phase/care activity.
20. Worker create operational report.
21. Owner update report status.
22. Owner create task from report.
23. Worker receive task from report.
24. Owner remove worker.
25. Removed worker tidak bisa akses data.
26. Rejected worker tidak bisa akses data.
27. Dashboard owner berubah sesuai data.
28. Dashboard worker berubah sesuai data.

Output:

- PASS/FAIL matrix.

---

### Phase 4 — Visual Reconstruction Berdasarkan Design Reference

Setelah core pass, baru polish visual.

Urutan visual polish:

1. Auth brand pass: logo/illustration, confirm password, eye toggle.
2. Owner dashboard hero card + missing insight.
3. Worker dashboard compact task priority.
4. Tree list grid 2 kolom + placeholder image + FAB.
5. Tree detail hero placeholder + info grid + timeline integrated.
6. Jadwal list hero summary + chips + badge status + FAB.
7. Profil Kebun menjadi hub: data kebun, join code copy, worker pending/active summary.
8. Laporan list filter horizontal/chips.
9. Bottom nav icon/label lebih mobile-native.
10. Remove unnecessary full-width buttons.

Output:

- UI lebih dekat ke design reference, tanpa nambah fitur storage dulu.

---

### Phase 5 — Media/Foto Mini-Iteration

Baru setelah core dan visual shell stabil.

Urutan implementasi media:

1. Buat design decision/media decision log kecil.
2. Buat schema `photo_attachments` atau attachment table yang disepakati.
3. Buat Supabase Storage bucket.
4. Buat storage policy dan RLS.
5. Implement image picker/camera utility.
6. Implement tree main photo.
7. Implement condition report optional photo.
8. Implement operational report optional photo.
9. Implement care activity proof photo.
10. Tambahkan `requires_photo` pada schedule/task jika siap.
11. Validasi: jika required, worker tidak bisa complete tanpa foto.
12. Regression test upload, preview, failed upload, permission.

Output:

- Foto masuk tanpa menghancurkan flow.

---

### Phase 6 — UAT Preparation

Setelah semua stabil:

1. Isi black-box actual result.
2. Siapkan akun owner/worker demo.
3. Siapkan dummy data kebun/pohon/jadwal/tugas/laporan.
4. Siapkan script UAT owner/worker.
5. Siapkan kuesioner.
6. Siapkan backup data sebelum UAT.

Output:

- Aplikasi siap diuji manusia sungguhan. Bagian paling berisiko dari semua sistem, tentu saja.

---

## 9. Keputusan Praktis: Apa yang Harus Dilakukan Sekarang

Langkah berikutnya bukan “lanjut foto”. Langkah berikutnya:

**Codex Audit Non-Edit: route, screen, fitur, dan gap desain.**

Kenapa?

Karena saat ini masih ada indikasi:

- screenshot salah mapping,
- detail jadwal belum benar,
- edit pohon belum terbukti,
- SOP belum terbukti,
- task realisasi belum terbukti,
- media belum ada,
- visual belum dekat ke reference.

Kalau lu langsung minta Codex implement foto, lu akan membangun atap di rumah yang pintunya belum tentu nyambung ke ruang tamu.

---

## 10. Prioritas Prompt Berikutnya

Prompt berikutnya sebaiknya tahap audit saja:

1. Baca docs source-of-truth.
2. Baca product alignment.
3. Baca design reference path kalau ada di repo.
4. Audit implementasi saat ini tanpa edit kode.
5. Bandingkan screen actual dengan screen inventory.
6. Bandingkan UI actual dengan design reference sebagai arah visual.
7. Laporkan missing/broken/core risk.
8. Beri rekomendasi batch fix kecil.
9. Jangan mengubah kode.

Setelah itu, baru fix satu batch kecil. Jangan minta “rapikan semuanya”. Itu mantra pemanggil regression.

---

## 11. Kesimpulan Akhir

Dengan design reference terbaca, review menjadi lebih jelas:

1. **Checkpoint sekarang tidak seburuk fase UI lama.** Sudah ada struktur, warna, card, dashboard, role owner/worker, dan flow besar.
2. **Checkpoint belum menyamai arah desain referensi.** Tree list, tree detail, dashboard, jadwal, profil kebun, dan navigation masih terlalu sederhana.
3. **Foto/media memang penting untuk versi full.** Referensi desain memakai foto pohon dan badge `Butuh Bukti`, jadi fitur foto bukan tambahan random.
4. **Namun foto tetap jangan jadi tahap berikutnya.** Core jadwal/SOP/task/report/history harus pass dulu.
5. **Planning berubah sedikit:** visual reconstruction sekarang harus lebih eksplisit dan lebih serius, bukan sekadar semantic cleanup.
6. **Strategi tetap:** freeze → audit non-edit → fix core flow → regression → visual reconstruction → media/foto → UAT.

Putusan final:

**Progress Avology saat ini adalah functional checkpoint, bukan final product checkpoint.** Cocok untuk dasar planning lanjut, belum cocok untuk UAT final. Kalau dipaksa UAT sekarang, risikonya bukan cuma tampilan kurang bagus, tapi alur inti bisa ketahuan belum nyambung. Dan tidak ada yang lebih menyenangkan daripada aplikasi terlihat hijau segar tapi workflow-nya layu di depan penguji.
