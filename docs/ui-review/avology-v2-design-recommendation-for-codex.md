# Rekomendasi Desain Avology V2 untuk Implementasi Codex

**Tujuan dokumen:** memberi instruksi desain yang mudah dipahami AI agent/Codex untuk merevisi UI Avology V2 tanpa merusak logic fitur yang sudah berjalan.

**Target akhir:** Avology V2 terasa seperti aplikasi mobile operasional kebun yang sederhana, ramah, cepat dipahami, dan tidak terlihat seperti template CRUD/web admin.

---

## 1. Guardrail Implementasi Wajib

Codex harus mengikuti batas ini:

1. **Jangan ubah database, RLS, migration, atau service besar kecuali diminta eksplisit.** Fokus awal adalah UI/UX.
2. **Jangan hapus fitur yang sudah berjalan.** Revisi tampilan, bukan amputasi fungsi. Jangan jadi dokter bedah dengan gergaji mesin.
3. **Jangan membuat screen baru jika screen lama bisa dirapikan.**
4. **Jangan tampilkan UUID/raw enum/status teknis.** Semua label user-facing harus bahasa Indonesia.
5. **Jangan ubah route utama tanpa alasan kuat.** Kalau perlu ubah navigasi, pastikan route lama tetap kompatibel.
6. **Jangan menggabungkan perubahan semua modul dalam satu batch.** Implementasi harus bertahap dan bisa dites.
7. **Foto/upload yang sudah ada jangan dihapus.** Rapikan pola UI-nya. Kalau storage/service belum stabil, gunakan placeholder dan jangan tambah kompleksitas.
8. **Setiap aksi berhasil/gagal harus memberi feedback.** Toast/alert/confirm wajib reusable.
9. **Aksi destruktif wajib confirm dialog.** Arsip, hapus catatan, tolak laporan, buka ulang laporan, nonaktifkan SOP, logout.
10. **Worker flow harus lebih sederhana daripada owner.** Worker fokus kerja lapangan, bukan mengelola sistem.

---

## 2. Prinsip Desain Final

### 2.1 Satu Screen, Satu Tujuan

Setiap screen harus menjawab satu pertanyaan utama:

| Screen | Pertanyaan yang harus dijawab |
| --- | --- |
| Dashboard Owner | Apa yang perlu pemilik perhatikan hari ini? |
| Dashboard Worker | Apa yang harus pekerja kerjakan hari ini? |
| Pohon | Pohon mana yang dicari atau perlu diperiksa? |
| Detail Pohon | Bagaimana kondisi pohon ini dan aksi apa yang bisa dilakukan? |
| Jadwal/Tugas Owner | Pekerjaan apa yang dijadwalkan dan bagaimana progres pekerja? |
| Tugas Worker | Tugas mana yang harus dikerjakan/diselesaikan? |
| Laporan Owner | Laporan mana yang belum ditanggapi? |
| Laporan Worker | Laporan apa yang sudah dikirim dan statusnya apa? |
| Kebun | Data kebun, kode gabung, anggota, dan pengaturan operasional. |
| Profil Akun | Data pribadi akun dan logout. |

Jika satu screen punya lebih dari satu tujuan besar, pisahkan secara visual atau pindahkan ke detail.

### 2.2 Kurangi Penjelasan

Hapus atau ringkas copy yang menjelaskan fungsi obvious.

Contoh buruk:

```txt
Kelola data pribadi akun Avology kamu.
Gunakan akun ini untuk masuk ke aplikasi.
```

Contoh cukup:

```txt
Profil Akun
```

Microcopy hanya dipakai untuk error, empty state, dan instruksi yang benar-benar perlu.

### 2.3 Card Dipakai Secukupnya

Gunakan card hanya untuk:

1. Hero summary.
2. List item.
3. Detail informasi penting.
4. Empty/loading/error state.
5. Confirmation content.

Jangan membungkus setiap field/form/action ke dalam card terpisah.

### 2.4 List Harus Bisa Di-scan Cepat

List card maksimum berisi:

1. Title/kode.
2. Satu badge/status utama.
3. Satu baris metadata.
4. Satu indikator kecil jika penting.

Informasi panjang pindah ke detail.

### 2.5 Foto Menjadi Elemen Visual, Bukan Beban Form

Foto harus tampil natural:

- Pohon: foto/placeholder di grid dan hero detail.
- Laporan: foto preview di detail, icon kecil di list jika ada foto.
- Tugas: bukti foto tampil di detail realisasi, bukan badge teks besar di list.
- Form: seluruh placeholder foto clickable.

---

## 3. Design Tokens Direkomendasikan

Gunakan token yang sudah ada jika project sudah punya `ui.tsx`. Jangan membuat style random per screen.

```txt
Color:
Primary Green: #065F2E
Primary Green Dark: #044722
Primary Green Soft: #E7F5EC
Background: #F7FAF3
Surface: #FFFFFF
Surface Soft: #F1F6EA
Text Primary: #17231B
Text Secondary: #5B6B60
Text Muted: #8A978D
Border: #DDE8D8
Success: #16803C
Warning: #B7791F
Danger: #C2410C
Info: #2563EB

Radius:
Screen card: 18
Input: 14
Button: 14
Small chip: 999
Image card: 16

Spacing:
Screen horizontal padding: 16
Section gap: 18
Card padding: 14-16
List gap: 10-12
Button height: 48-52
Bottom nav height: existing + safe area

Typography:
Title: 28-32 / bold
Screen title in header: 18-20 / semibold
Section title: 16-18 / semibold
Body: 14-15
Caption/meta: 12-13
Badge: 11-12
```

Font realistis:

1. Gunakan system font dulu jika belum ada custom font loader.
2. Jika ingin lebih friendly, gunakan `Nunito Sans` atau `Inter`.
3. Jangan pakai font terlalu playful untuk data operasional. Quicksand terasa ramah, tapi bisa lemah untuk angka dan label padat.

---

## 4. Komponen UI Reusable yang Harus Ada

Codex harus membuat/memperbaiki komponen reusable, bukan styling ulang tiap screen.

### 4.1 AppScreen

- Background `#F7FAF3`.
- Safe area.
- Optional `hideBottomNavOnNestedForm` jika routing mendukung.

### 4.2 ScreenHeader

Variant:

1. `main`: title + optional profile icon.
2. `detail`: back button + centered title + optional menu.
3. `plain`: title only.

Aturan:

- Header auth boleh centered.
- Header main tab tidak perlu deskripsi panjang.
- Jangan tampilkan logout di header.

### 4.3 AppButton

Variant:

1. `primary`: aksi utama.
2. `secondary`: aksi alternatif.
3. `ghost`: link/action kecil.
4. `danger`: destruktif.
5. `icon`: copy, filter, overflow, kamera.

### 4.4 StatusBadge

Badge hanya untuk status yang memengaruhi keputusan:

- Sehat, Perlu Perhatian, Hama, Penyakit, Rusak, Mati.
- Belum, Selesai, Tertunda.
- Baru, Diproses, Ditolak, Selesai.
- Aktif/Nonaktif SOP.

Jangan membuat badge untuk hal tidak penting seperti `Manual` atau `Ada Foto`. Gunakan icon kecil.

### 4.5 FilterChipsRow

Pola filter global:

```txt
Search bar (opsional)
Horizontal filter chips/dropdowns
List
```

Contoh:

```txt
[Kondisi v] [Fase v] [Umur v] [Varietas v] [Baris v] [Status v]
```

Aturan:

- Tidak perlu tombol “Filter” yang membuka panel besar.
- Filter aktif harus punya visual selected.
- Reset filter kecil hanya muncul jika ada filter aktif.

### 4.6 PhotoPickerCard

Spesifikasi:

- Seluruh area clickable.
- Jika kosong: icon kamera + teks “Tambah foto”.
- Jika ada foto: image preview full area.
- Remove icon kecil di pojok kanan atas.
- Opsi kamera/galeri muncul setelah card ditekan.
- Jangan tampilkan dua tombol besar `Ambil Foto` dan `Pilih Galeri` di bawah placeholder jika ruang sempit.

### 4.7 Feedback System

Minimal:

```ts
showSuccessToast('Pohon berhasil ditambahkan')
showErrorToast('Ups, varietas belum diisi')
showConfirmDialog({ title, message, confirmLabel, danger })
```

Copy harus pendek, jelas, dan manusiawi:

- “Pohon berhasil ditambahkan.”
- “Jadwal berhasil dibuat.”
- “Ups, kode kebun belum diisi.”
- “Arsipkan pohon ini?”
- “Tolak laporan ini?”

---

## 5. Navigasi Final yang Direkomendasikan

Gunakan bottom nav yang konsisten secara posisi.

### 5.1 Bottom Nav

Rekomendasi paling simpel:

```txt
Beranda | Tugas | Pohon | Laporan | Kebun
```

Untuk owner:

- `Tugas` berisi jadwal perawatan, tugas pekerja, dan pembuatan jadwal.
- Header screen boleh menampilkan “Jadwal & Tugas”.

Untuk worker:

- `Tugas` berisi daftar tugas yang diberikan owner.

Alasan: posisi tab sama, mental model sama, tetapi isi menyesuaikan role. Memaksa owner/worker punya label berbeda membuat struktur terasa rapi di dokumen, tapi di HP sering bikin user bingung pindah role saat testing.

### 5.2 Profil Akun

Profil Akun jangan berada terlalu dalam.

Rekomendasi:

- Tambahkan icon user kecil di kanan atas setiap main tab header.
- Tap icon user membuka `Profil Akun`.
- Logout hanya tersedia di `Profil Akun`.
- Tab `Kebun` tetap untuk data kebun, anggota, SOP, kode gabung.

Dengan ini logout tidak muncul sembarangan, tapi juga tidak disembunyikan di labirin. Manusia senang labirin hanya kalau ada hadiah, bukan saat mau keluar akun.

---

## 6. Rekomendasi Per Modul

## 6.1 Get Started

Target:

- Simple, branded, tidak jadi brosur.

Layout:

```txt
[Logo Avology]
Avology
Kelola kebun alpukat dengan lebih rapi.

[Mulai]
Masuk
```

Aturan:

- Maksimal 1 kalimat tagline.
- Tidak perlu card “Operasional kebun alpukat”.
- Boleh 1 CTA utama `Mulai`, lalu link/tombol secondary `Masuk`.
- Jangan tampilkan banyak deskripsi fitur.

Acceptance criteria:

- Screen terlihat selesai dalam 3 detik.
- Tidak ada paragraph panjang.
- CTA utama jelas.

---

## 6.2 Login & Register

Target:

- Clean, fokus form, tidak terasa web admin.

Layout Login:

```txt
[Back]
Masuk

Email
Password [eye]

[Masuk]
Belum punya akun? Daftar
```

Layout Register:

```txt
[Back]
Daftar

Nama lengkap
Nomor HP
Email
Password [eye]
Konfirmasi Password [eye]

[Daftar]
Sudah punya akun? Masuk
```

Aturan:

- Logo tidak wajib di auth jika Get Started sudah kuat.
- Header boleh centered/clean.
- Input tidak perlu dibungkus card besar.
- Link daftar/masuk sebagai inline text.

Acceptance criteria:

- Password eye toggle berfungsi.
- Error field muncul jelas.
- Tidak ada copy penjelasan panjang.

---

## 6.3 Onboarding, Buat Kebun, Gabung Kebun, Pending

### Onboarding

Layout:

```txt
Pilih Akses

[Card Owner]
Buat Kebun
Buat ruang kerja kebun baru.

[Card Worker]
Gabung Kebun
Masukkan kode dari pemilik.
```

Aturan:

- Jangan tampilkan detail akun.
- Jangan tampilkan logout.
- Profil akun lewat icon header.

### Buat Kebun

- Nama kebun wajib.
- Lokasi wajib/opsional sesuai service saat ini.
- Luas pakai suffix `m²`.
- CTA `Simpan Kebun`.

### Gabung Kebun

- Input kode kebun.
- CTA `Ajukan Gabung`.
- Microcopy satu baris.

### Pending Approval

- Tampilkan status dan nama kebun jika ada.
- CTA `Cek Status`.
- Link/icon ke Profil Akun.
- Jangan tampilkan logout langsung.

---

## 6.4 Dashboard Owner

Target pertanyaan: **Apa yang harus owner perhatikan hari ini?**

Struktur:

```txt
Header: Halo, [nama]

Hero: Kondisi Kebun
- Persentase sehat
- Total pohon
- Bermasalah
- Perlu perhatian

Section: Perlu Ditindaklanjuti
- Pohon bermasalah
- Tugas terlambat/belum selesai
- Laporan baru
- Worker pending
- SOP jatuh tempo/terlambat

Section: Monitoring
- Berbunga
- Berbuah
- Tugas hari ini

Section: Aktivitas Terbaru
- 3-5 event terakhir

Quick Actions kecil
- Tambah Pohon
- Buat Jadwal
- Buat Laporan/Tinjau Laporan
```

Aturan:

- Join code pindah ke tab Kebun.
- Quick action bukan isi utama.
- Jangan tampilkan semua angka dalam kotak setara.
- Prioritaskan kondisi yang butuh tindakan.

Acceptance criteria:

- Dalam 5 detik owner tahu masalah utama hari ini.
- Ada empty state jika semua aman.
- Tidak ada tumpukan tombol navigasi.

---

## 6.5 Dashboard Worker

Target pertanyaan: **Apa yang harus worker kerjakan sekarang?**

Struktur:

```txt
Header: Halo, [nama]

Hero: Tugas Hari Ini
- Jumlah belum selesai
- Tugas berikutnya / prioritas

Section: Prioritas Tugas
- Tugas belum selesai/terlewat

Quick Actions
- Lihat Tugas
- Lapor Kondisi
- Buat Laporan

Section: Laporan Terakhir
- 1-2 laporan terbaru
```

Aturan:

- Worker tidak perlu analitik kompleks.
- Jangan buat dashboard worker mirip owner.
- CTA harus cepat dan besar.

---

## 6.6 Pohon List Owner/Worker

Target:

- Tree list visual, cepat discan, tidak penuh teks.

Card pohon:

```txt
[Foto / placeholder]
Kode: A-12
Badge kondisi
Fase: Berbuah
```

Jangan tampilkan di card:

- Umur.
- Baris/Kolom detail jika kode sudah mewakili.
- Tanggal tanam.
- Varietas panjang jika membuat card padat.

Aturan grid:

- 2 kolom.
- Item terakhir tidak boleh melebar full-width jika jumlah ganjil.
- Gunakan `FlatList numColumns=2` dengan item width tetap.
- Owner punya FAB tambah pohon.
- Worker tidak punya FAB tambah pohon.

Filter:

```txt
Search kode/varietas
[Kondisi] [Fase] [Umur] [Varietas] [Baris] [Kolom] [Status]
```

Worker filter cukup:

```txt
Search
[Kondisi] [Fase]
```

---

## 6.7 Detail Pohon

Target:

- Pohon terasa sebagai objek visual, bukan record database.

Struktur:

```txt
Hero image / placeholder
Kode Pohon + Status
Varietas + fase

Info utama grid:
- Tanggal tanam
- Umur
- Lokasi
- Status arsip

Aksi utama:
[Catat]
- Kondisi
- Fase
- Panen
- Perawatan

Timeline Riwayat
- Kondisi
- Fase
- Panen
- Perawatan
```

Aturan:

- Owner overflow menu: `Edit Pohon`, `Arsipkan Pohon` / `Aktifkan kembali`.
- Jangan taruh `Ganti Foto`/`Hapus Foto` di menu detail.
- Worker hanya punya aksi catat kondisi/fase sesuai permission.
- Timeline gunakan icon relevan, bukan simbol acak seperti `!`, `+`, `#`, `*`.
- Jangan tampilkan timeline ganda.

Catat action:

- Gunakan satu button `Catat`.
- Saat ditekan, tampilkan anchored menu dekat tombol:
  - Kondisi
  - Fase
  - Panen
  - Perawatan
- Jangan gunakan bottom sheet besar.

---

## 6.8 Tambah/Edit Pohon

Target:

- Form cepat, tidak banyak scroll, foto natural.

Field:

1. Baris wajib.
2. Kolom wajib.
3. Preview kode otomatis `{baris}-{kolom}`.
4. Varietas wajib.
5. Tanggal tanam wajib, default tanggal hari ini untuk tambah data.
6. Foto pohon opsional/utama jika service sudah mendukung.

Aturan:

- Hapus input kode pohon manual.
- Jangan tampilkan tombol `Gunakan hari ini` atau `Kosongkan` jika tanggal wajib.
- Photo placeholder harus clickable.
- Remove photo pakai icon kecil, bukan tombol merah besar.

Feedback:

- Berhasil tambah: “Pohon berhasil ditambahkan.”
- Berhasil edit: “Data pohon berhasil diperbarui.”
- Error: “Ups, varietas belum diisi.”

---

## 6.9 Catat Kondisi / Fase / Panen / Perawatan

Target:

- Form lapangan cepat.

Aturan umum:

- Tampilkan ringkasan pohon compact di atas.
- Option pakai button/chip besar dengan selected state jelas.
- Catatan opsional.
- Foto opsional compact.
- Hide bottom nav di nested form jika memungkinkan.
- Setelah simpan, tampilkan success toast lalu kembali ke detail/list secara natural.

Khusus perawatan:

- Target pohon tampil sebagai kode pohon.
- Kategori 2 kolom.
- Catatan/instruksi tidak perlu panjang.

Khusus panen:

- Jangan beri label prediksi/estimasi.
- Panen hanya pencatatan historis jika memang sudah menjadi fitur.

---

## 6.10 Jadwal/Tugas Owner

Target:

- Owner bisa melihat jadwal dan progres pekerja tanpa masuk terlalu dalam.

Tab `Tugas` owner bisa berisi:

```txt
Header: Jadwal & Tugas
Search
[Hari ini] [Belum] [Terlambat] [Selesai] [SOP]
Sort: Terdekat/Terjauh

List jadwal/tugas
FAB +
```

Card jadwal:

```txt
Judul jadwal
Kategori + target ringkas
Tanggal
Status
Icon kamera jika butuh bukti
Badge SOP jika dari SOP
```

Aturan:

- Jangan tampilkan badge `Manual`.
- Jika dari SOP, badge `SOP` boleh.
- `Butuh Bukti` diganti icon kamera kecil.
- Summary besar jadwal tidak perlu jika dashboard sudah menampilkan.
- Sort terdekat/terjauh harus jelas dan clickable.

FAB:

- Tap FAB expand dekat tombol:
  - Dari SOP
  - Buat Jadwal
- Jangan bottom sheet full-screen bawah.

---

## 6.11 Buat Jadwal

Rename:

- `Buat Jadwal Manual` → `Buat Jadwal`
- Jika dari SOP, screen title `Buat Jadwal dari SOP`.

Form:

1. Judul.
2. Kategori.
3. Tanggal.
4. Target.
5. Worker.
6. Instruksi.
7. Butuh bukti foto? jika field sudah ada.

Aturan:

- Target tree picker tampilkan kode pohon, bukan lokasi panjang.
- Kategori/target pakai 2 kolom atau selector compact.
- Jangan tampilkan terlalu banyak section card.
- CTA sticky bawah.

---

## 6.12 Detail Jadwal dan Detail Tugas Owner

Masalah sekarang: owner masuk detail jadwal, lalu klik tugas pekerja, lalu masuk detail tugas yang isinya mirip.

Rekomendasi:

### Detail Jadwal

Tampilkan langsung:

1. Informasi jadwal.
2. Instruksi.
3. Tugas pekerja sebagai list compact.
4. Status realisasi per worker.
5. Bukti foto mini thumbnail jika ada.
6. Expand row untuk melihat detail realisasi.

Detail Tugas Owner hanya diperlukan jika:

- Bukti foto perlu dilihat besar.
- Ada banyak histori realisasi.
- Ada catatan panjang.

Acceptance criteria:

- Owner tidak perlu masuk 2-3 screen hanya untuk tahu tugas sudah selesai atau belum.

---

## 6.13 Tugas Worker

Target:

- Worker langsung tahu tugas hari ini dan bisa realisasi cepat.

List:

```txt
Header: Tugas
[Hari ini] [Terlewat] [Belum] [Selesai]

Card:
Judul
Target
Tanggal
Status
Icon kamera jika bukti wajib
```

Tidak perlu search by default. Search bisa ditambahkan jika jumlah tugas besar, tapi jangan menjadi elemen utama.

Detail tugas:

- Informasi tugas compact.
- Instruksi.
- Realisasi:
  - `Selesai`
  - `Tunda`
  - Catatan opsional
  - Foto jika wajib/opsional
- Setelah selesai/tertunda, tampilkan mode view.
- Tombol `Edit Realisasi` boleh ada jika memang dibutuhkan, tapi harus jelas aturan datanya.

Aturan edit realisasi:

- Izinkan edit jika task belum dikunci owner.
- Tampilkan confirm: “Ubah realisasi tugas ini?”
- Jangan membuat duplikasi care activity kecuali memang service mendukung histori revisi.

---

## 6.14 SOP Perawatan

Definisi UI yang harus jelas:

```txt
SOP = template perawatan yang bisa dipakai owner untuk membuat jadwal lebih cepat.
Interval = acuan kapan perawatan berikutnya perlu dilakukan.
Aktif = bisa dipilih saat membuat jadwal.
Nonaktif = disimpan sebagai arsip template, tidak muncul di pilihan jadwal baru.
```

List SOP:

```txt
Nama SOP
Kategori
Target
Interval: 7 hari
Status acuan: Terlambat 3 hari / Jatuh tempo hari ini / Belum jatuh tempo
Status aktif
```

Jangan tampilkan di card:

- Instruksi lengkap.
- Tanggal diperbarui.
- “Belum ada realisasi” sebagai badge besar.

Detail SOP:

- Info SOP.
- Instruksi default.
- Acuan jadwal berikutnya.
- CTA utama `Buat Jadwal dari SOP`.
- Menu header: Edit, Nonaktifkan/Aktifkan.

Aturan:

- Jangan ada tombol edit duplikat di bawah dan di menu sekaligus.
- Tambahkan filter kategori, target, aktif/nonaktif.

---

## 6.15 Laporan Owner

Target:

- Owner cepat melihat laporan yang belum direspons.

List:

```txt
Search
[Belum Respons] [Diproses] [Selesai] [Ditolak] [Kategori]

Card:
Judul laporan
Kategori
Lokasi singkat
Tanggal
Status
Icon foto jika ada
```

Aturan:

- Buang summary warna-warni besar.
- Default sort: belum respons paling atas, lalu diproses, lalu terbaru.
- Catatan/deskripsi jangan tampil penuh di list.
- Foto jangan jadi badge teks; pakai icon kamera.

Detail laporan owner:

- Foto jika ada.
- Ringkasan laporan.
- Catatan.
- Status.
- Tindak lanjut sebagai compact task row.
- Aksi sesuai status:
  - Baru: Tandai Diproses, Buat Tugas, Tolak
  - Diproses: Tandai Selesai, Buat Tugas, Tolak
  - Ditolak: Buka Ulang
  - Selesai: Buka Ulang jika perlu

Semua aksi status penting wajib confirm.

---

## 6.16 Laporan Worker

Target:

- Worker mudah membuat laporan dan memantau statusnya.

List:

- Filter chips: Semua, Belum Respons, Diproses, Selesai, Ditolak.
- Card compact.
- FAB `+` untuk buat laporan.

Buat laporan:

- Kategori sebagai grid/chips.
- Lokasi/target singkat.
- Catatan/deskripsi.
- Foto opsional via PhotoPickerCard.
- CTA `Kirim Laporan`.

Detail laporan worker:

- Status owner paling atas.
- Detail laporan.
- Foto jika ada.
- Tindak lanjut jika sudah dibuat owner.
- Jika ditolak, tampilkan alasan/catatan owner jika tersedia.

---

## 6.17 Kebun Owner

Jadikan tab `Kebun` sebagai hub tunggal. Jangan ada halaman duplikat `Kebun Saya/Profil Kebun` jika isinya sama.

Struktur tab Kebun owner:

```txt
Header: Kebun

Profil Kebun
- Nama
- Lokasi
- Luas
- Edit kebun

Kode Bergabung
- 85CBFCD4 [copy icon]

Anggota Kebun
- Pending count
- Active count
- Ringkasan 3 anggota
- Kelola Pekerja

Operasional
- SOP Perawatan
- Pengaturan lain jika ada
```

Aturan:

- Jangan tampilkan logout di Kebun.
- Jangan tampilkan hapus kebun/keluar kebun untuk owner sekarang.
- Jangan ada dua tombol menuju Manajemen Pekerja.
- Copy join code pakai icon copy, bukan button besar.

---

## 6.18 Kebun Worker

Struktur:

```txt
Header: Kebun

Data Kebun
- Nama
- Lokasi
- Luas

Anggota Kebun
- Pemilik
- Pekerja aktif jika permission sudah benar

Akses Saya
- Role: Pekerja
- Status: Aktif
```

Aturan:

- Read-only.
- Tidak ada edit kebun.
- Tidak ada manajemen pekerja.
- Profil akun via icon header.

---

## 6.19 Manajemen Pekerja

Target:

- Owner cepat approve/reject dan melihat worker aktif.

Layout:

```txt
Pengajuan Baru
- Worker row compact: nama, phone, tanggal, Setujui, Tolak

Pekerja Aktif
- Worker row compact: nama, phone, Keluarkan
```

Aturan:

- Card jangan terlalu tinggi.
- Tidak perlu histori tidak aktif secara default.
- Inactive/rejected/removed bisa collapsible “Riwayat akses” jika benar-benar perlu.
- Approve/reject/remove wajib feedback dan confirm untuk remove/reject.

---

## 6.20 Profil Akun

Target:

- Profil pribadi dan logout, tidak campur kebun.

Struktur:

```txt
Header: Profil Akun

Icon user kecil + nama + role saat ini

Data Pribadi
- Nama lengkap
- Nomor HP
- Email

[Edit Profil]
[Ubah Password]

Keluar Akun
[Keluar]
```

Aturan:

- Tidak perlu avatar huruf besar jika tidak ada fitur foto profil.
- Pakai icon user sederhana.
- Jangan pakai section “Aksi Akun”. Langsung tombol.
- Jangan ada penjelasan panjang logout.
- Logout danger button + confirm.

---

## 7. Urutan Implementasi Codex

### Batch 0 - Audit Tanpa Edit

Tujuan: mencegah Codex ngawur.

Prompt objective:

```txt
Audit current screens/components/routes for Avology V2 UI revision. Do not edit files. Report where auth, onboarding, dashboard, tree, schedule/task, SOP, report, farm, worker management, and profile screens are implemented. Identify reusable UI components and risky service dependencies.
```

Output wajib:

- daftar file screen,
- daftar reusable components,
- daftar route yang sensitif,
- daftar service yang tidak boleh disentuh.

### Batch 1 - UI Foundation & Feedback System

Scope:

- Rapikan tokens di `ui.tsx`.
- Tambah/rapikan AppButton variants.
- Tambah FilterChipsRow.
- Tambah PhotoPickerCard UI wrapper jika belum ada.
- Tambah Toast/Alert/ConfirmDialog reusable.

Do not touch:

- database,
- Supabase service,
- route guard.

Test:

- App compile.
- Existing screens masih render.

### Batch 2 - Auth, Onboarding, Profile

Scope:

- Get Started simple.
- Login/Register clean + password eye.
- Onboarding tanpa profil/logout.
- Pending tanpa logout langsung.
- Profil akun jadi single place untuk logout.

Acceptance:

- Register/login tetap jalan.
- User tanpa kebun bisa buka profil akun.
- Logout hanya di profil akun.

### Batch 3 - Navigation & Header

Scope:

- Bottom nav konsisten: Beranda, Tugas, Pohon, Laporan, Kebun.
- Header main tab punya profile icon.
- Nested forms/detail tetap punya back button.

Acceptance:

- Owner route aman.
- Worker route aman.
- Profile reachable maksimal 1 tap dari main tab.

### Batch 4 - Dashboard Owner/Worker

Scope:

- Owner dashboard insight-based.
- Worker dashboard task-first.
- Join code pindah ke Kebun.
- Quick action jadi pendukung.

Acceptance:

- Tidak ada dashboard berupa tumpukan tombol.
- Owner melihat prioritas.
- Worker melihat tugas.

### Batch 5 - Pohon List, Detail, Form

Scope:

- Tree card ringkas.
- Grid 2 kolom fix item ganjil.
- Filter horizontal.
- Detail pohon hero + timeline tunggal.
- Action `Catat` compact.
- Foto hanya dikelola di tambah/edit pohon.
- Tambah/edit pohon compact.

Acceptance:

- Create/edit/archive pohon tetap jalan.
- Worker tidak bisa edit/archive.
- Foto existing tidak rusak.

### Batch 6 - Jadwal/Tugas

Scope:

- Owner tab Tugas/Jadwal compact.
- Filter chips.
- FAB expand near button.
- Detail jadwal menampilkan realisasi worker langsung.
- Worker task detail lebih sederhana.
- Edit realisasi jelas.

Acceptance:

- Owner buat jadwal.
- Worker melihat tugas.
- Worker selesai/tunda.
- Owner melihat realisasi.

### Batch 7 - SOP, Laporan, Kebun, Worker Management

Scope:

- SOP card compact + filter.
- Detail SOP tanpa edit duplikat.
- Laporan owner/worker compact + FAB.
- Tab Kebun jadi hub tunggal.
- Hapus duplikasi Profil Kebun jika redundant.
- Worker management compact.

Acceptance:

- SOP create/edit/toggle tetap jalan.
- Worker laporan → owner tindak lanjut → worker task tetap jalan.
- Join code copy berjalan.
- Approve/reject/remove worker berjalan.

### Batch 8 - QA Regression

Wajib test manual:

1. Register.
2. Login.
3. Logout dari Profil Akun.
4. User tanpa kebun buka profil.
5. Owner buat kebun.
6. Worker join.
7. Owner approve/reject/remove.
8. Owner tambah/edit/archive pohon.
9. Worker lihat pohon dan catat kondisi/fase.
10. Owner buat SOP.
11. Owner buat jadwal dari SOP jika ada.
12. Owner buat jadwal biasa.
13. Worker selesai/tunda tugas.
14. Worker buat laporan.
15. Owner proses/tolak/selesai laporan.
16. Owner buat tugas tindak lanjut.
17. Dashboard owner/worker tidak error.
18. Tidak ada raw UUID/raw enum di UI.
19. Tidak ada console error utama.

---

## 8. Larangan Desain Spesifik

Codex tidak boleh:

1. Membuat semua input dalam card besar.
2. Membuat semua section menjadi kotak berlapis.
3. Menaruh logout di onboarding/pending/kebun.
4. Menampilkan badge untuk semua hal kecil.
5. Menampilkan “Manual” sebagai badge jadwal.
6. Menampilkan “Ada Foto” sebagai badge teks.
7. Membuka filter sebagai panel turun besar.
8. Membuka action tambah sebagai bottom sheet besar.
9. Menampilkan instruksi panjang di list card.
10. Menghapus fitur foto yang sudah ada.
11. Mengubah schema/service karena alasan visual.
12. Membuat dashboard jadi menu shortcut.

---

## 9. Definition of Done UI Revision

Revisi desain dianggap selesai jika:

1. Setiap main tab punya tujuan jelas.
2. Auth/onboarding/profile tidak bercampur.
3. Dashboard owner insight-based.
4. Dashboard worker task-based.
5. Tree list ringkas dan visual.
6. Detail pohon tidak timeline ganda.
7. Filter horizontal konsisten.
8. List card SOP/jadwal/laporan/pekerja compact.
9. Feedback success/error/confirm tersedia.
10. Logout hanya di Profil Akun.
11. Tidak ada UUID/raw enum/status teknis tampil.
12. Semua core flow masih pass manual test.
13. Tidak ada perubahan besar di service/database tanpa alasan eksplisit.

---

## 10. Prompt Template untuk Codex per Batch

Gunakan format ini untuk tiap batch, jangan satu prompt monster.

```txt
You are working on Avology V2, a React Native Expo mobile app with Supabase.
Focus only on [BATCH NAME].

Goal:
[one clear goal]

Files to inspect first:
[list expected screen/component files, ask Codex to find exact paths]

Hard constraints:
- Do not change database schema/migrations/RLS.
- Do not rewrite service logic unless required for UI formatting.
- Do not remove existing working features.
- Preserve owner/worker role behavior.
- Keep changes small and reviewable.

Design rules:
[paste relevant rules from this document]

Required implementation:
[numbered implementation tasks]

Acceptance criteria:
[numbered testable criteria]

After implementation:
- Report changed files.
- Explain what was intentionally not changed.
- Provide manual test checklist.
```

---

## 11. Final Direction

Avology tidak perlu jadi aplikasi “wah”. Targetnya lebih realistis: **mobile app kebun yang sederhana, jelas, dan terasa selesai**.

Revisi terbaik bukan mempercantik semua layar sekaligus, tetapi membangun sistem visual yang konsisten:

1. Header rapi.
2. Bottom nav jelas.
3. Card ringkas.
4. Filter horizontal.
5. Foto natural.
6. Action jelas.
7. Feedback konsisten.
8. Role owner/worker tidak campur.

Kalau ini dijalankan bertahap, Avology akan terlihat seperti aplikasi mobile yang benar. Kalau langsung rombak besar, kemungkinan besar aplikasi berubah jadi eksperimen botani React Native yang tumbuh liar dan memakan limit Codex.
