# Landasan Avology — v4 (FINAL untuk Versi 1)

Menggantikan v3. Menetapkan ruang lingkup Avology berdasarkan triangulasi kebutuhan (Wawancara × Observasi × Studi Literatur, fase *requirements* PXP).

Status: **dikunci untuk implementasi Versi 1.** Perubahan selanjutnya menunggu hasil UAT dan masukan pembimbing.

---

## 1. Prinsip penuntun

1. **Modul utama harus bekerja: manajemen kebun.** Semua yang bukan itu adalah pelengkap dan boleh gagal.
2. **Simplicity di atas kelengkapan.** Prinsip GIGO pemilik + temuan literatur (kesederhanaan = penentu adopsi petani).
3. **Kebutuhan user, bukan keinginan developer.** Tiap fitur lolos ≥ 2 sumber triangulasi.
4. **Sistem informasi, bukan prediksi/IoT.** Sistem mencatat & menyajikan; keputusan tetap di tangan manusia.
5. **Definisi selesai yang keras.** Tidak ada "poles UI tanpa akhir".
6. **Sukses = dipakai, bukan lolos tes.** Fitur yang lulus DoD teknis tapi tidak dipakai = gagal.

---

## 2. Perubahan dari v3 (jejak keputusan)

| # | Item | v3 | v4 (final) | Alasan |
|---|---|---|---|---|
| 1 | **B2 Catat perawatan manual** | De-scope / hapus | **Merge: satu tabel perawatan + field asal (`terjadwal` / `inisiatif`)** → naik jadi RF-13/US-21 | Ada use case nyata: pekerja berinisiatif tanpa instruksi, dan owner turun tangan langsung lalu mencatat setelahnya. Keduanya tidak bisa lewat realisasi tugas (butuh jadwal lebih dulu). Masalah aslinya bukan fiturnya, tapi **dua tabel untuk hal yang sama**. |
| 2 | **C5 Push notification** | In-scope penuh | **In-app reminder wajib (Iterasi B); push notification opsional (Iterasi D, boleh gagal)** | Modul utama diprioritaskan. Push adalah kandidat terkuat penyebab proyek mandek jilid dua. |
| 3 | **Offline** | Tidak ada | **Draft lokal + kirim ulang manual** (bukan sync engine) | Sinyal kebun tidak menentu. Sync engine penuh (ID offline, resolusi konflik, urutan operasi) sekelas atau lebih berat dari push. Versi murah menutup skenario nyata. |
| 4 | **Validasi pekerja** | Wawancara Om Ari | **Observasi Om Ari memegang HP saat UAT** | Abah pernah bekerja langsung di kebun sehingga memahami beban lapangan. Yang belum tertutup hanya hambatan pekerja terhadap perangkat (HP, sinyal, kebiasaan input) — cukup ditutup lewat observasi UAT, bukan wawancara baru. |

Tetap dari v3: estimasi panen → **penanda umur sejak berbunga (non-prediktif)**.

---

## 3. Kebutuhan Fungsional final (RF)

| Kode | Kebutuhan | Keterangan | Status |
|---|---|---|---|
| RF-01 | Manajemen Identitas & Autentikasi | Registrasi, login, session. | Lama |
| RF-02 | Manajemen Entitas Kebun | Buat kebun + kode unik. | Lama |
| RF-03 | Manajemen Kolaborasi & Keanggotaan | Gabung via kode, approval owner. | Lama |
| RF-04 | Kontrol Akses Berbasis Peran | Hak owner vs pekerja. | Lama |
| RF-05 | Inventarisasi & Lifecycle Pohon | Data pohon, fase pertumbuhan, kondisi. | Lama |
| RF-06 | Standarisasi (SOP) & Penjadwalan | SOP + jadwal perawatan. | Lama |
| RF-07 | Pelaksanaan & Pelaporan Aktivitas | Jadwal → tugas → realisasi. | Lama |
| RF-08 | Riwayat Perawatan Pohon | Log fase, perawatan, kondisi, panen. | Lama |
| RF-09 | Dashboard | Status kebun ringkas untuk owner. | Lama |
| **RF-10** | **Pelaporan Lapangan Pekerja** | Pekerja melaporkan kondisi/kebutuhan lapangan → owner meninjau & menindaklanjuti. Ramping: tanpa status berlapis/reopen. | Baru (B1) |
| **RF-11** | **Penanda & Pengingat Perawatan/Panen** | Penanda umur sejak berbunga + penanda jadwal jatuh tempo (in-app). Push notification = lapisan opsional. | Baru (C1+C5) |
| **RF-12** | **Catatan Produk Perawatan** | Nama merek pupuk/pestisida pada aktivitas perawatan, dapat ditelusuri balik. | Baru (C2) |
| **RF-13** | **Pencatatan Perawatan Non-Terjadwal** | Perawatan atas inisiatif pekerja atau yang dikerjakan owner langsung, dicatat tanpa perlu jadwal. Disimpan pada penyimpanan yang sama dengan realisasi terjadwal, dibedakan oleh asal pencatatan. | Baru (B2 merge) |

---

## 4. User Story final (US)

US-01 s/d US-16 tetap. Tambahan:

| Kode | Aktor | User Story | RF |
|---|---|---|---|
| **US-17** | Pekerja | Melaporkan kondisi/kebutuhan lapangan agar owner dapat menindaklanjuti. | RF-10 |
| **US-18** | Pemilik | Meninjau laporan lapangan & membuat tindak lanjut. | RF-10 |
| **US-19** | Pemilik/Pekerja | Melihat penanda umur sejak berbunga & penanda jadwal jatuh tempo. | RF-11 |
| **US-20** | Pemilik/Pekerja | Mencatat merek produk perawatan agar dapat ditelusuri balik. | RF-12 |
| **US-21** | Pekerja/Pemilik | Mencatat perawatan yang dilakukan atas inisiatif sendiri atau dikerjakan langsung, tanpa menunggu jadwal. | RF-13 |
| **US-22** | Pemilik/Pekerja | Menyimpan catatan sebagai draft saat tidak ada koneksi dan mengirim ulang setelah online. | RF-07/RF-13 |
| **US-19b** | Pemilik | *(Opsional)* Menerima notifikasi pengingat jadwal di perangkat. | RF-11 |

---

## 5. Model data perawatan (keputusan kunci)

Satu penyimpanan, dua asal. Ini inti perbaikan B2.

```
catatan_perawatan
├─ id
├─ pohon_id
├─ jenis_perawatan      (siram / pupuk / semprot / gulma)
├─ tanggal
├─ dicatat_oleh         (user)
├─ asal                 ◄── 'terjadwal' | 'inisiatif'
├─ tugas_id             (diisi hanya jika asal = 'terjadwal', null jika inisiatif)
├─ produk               ◄── RF-12: merek pupuk/pestisida
└─ catatan
```

Konsekuensi positif:
- Riwayat pohon membaca **satu sumber**, tidak menggabung dua tabel.
- Satu form, satu jalan masuk → pekerja tidak bingung "catat lewat mana".
- Owner bisa melihat proporsi perawatan **inisiatif vs terjadwal** — insight nyata soal kemandirian pekerja.
- `manual_care_records` tidak dihapus fungsinya, tapi **dilebur** ke sini.

---

## 6. Definisi Selesai (DoD) — teknis

| Fitur | Selesai jika... |
|---|---|
| RF-13 Perawatan non-terjadwal | Satu tabel `catatan_perawatan` dengan field `asal`. Pekerja bisa catat tanpa jadwal. Riwayat pohon membaca satu sumber. Tidak ada tabel manual care terpisah. |
| RF-10 Laporan lapangan | Pekerja kirim laporan (kategori + catatan, foto opsional 1); owner lihat daftar & buat 1 tindak lanjut. Tanpa status berlapis, tanpa reopen. |
| RF-11 Penanda umur berbunga | Dashboard/detail pohon menampilkan "N hari sejak berbunga". **Tidak ada klaim "layak panen".** |
| RF-11 Penanda jadwal (in-app) | Dashboard menandai jadwal jatuh tempo/terlambat. Tanpa proses latar. |
| RF-11b Push notification | *(Opsional)* Terkirim untuk jadwal jatuh tempo, teruji ≥1 device fisik. **Boleh gagal — tidak memblokir rilis.** |
| RF-12 Catatan produk | Field produk pada form perawatan; tampil & dapat ditelusuri di riwayat pohon. |
| Draft offline | Catatan gagal kirim tersimpan lokal, ditandai "belum terkirim", ada tombol kirim ulang manual. **Tanpa auto-sync, tanpa resolusi konflik.** |
| Pemangkasan B3–B5 | Foto disisakan di kondisi & bukti task; CRUD disederhanakan; reopen dihapus; tidak ada kode/route yatim. |

---

## 7. Kriteria Keberhasilan — "dipakai, bukan ditinggal"

DoD teknis tidak cukup. Versi 1 dinyatakan berhasil jika, dalam periode uji pakai (saran: 2 minggu setelah rilis ke kebun):

| # | Kriteria | Cara ukur |
|---|---|---|
| K1 | Pekerja mencatat realisasi/perawatan **tanpa diingatkan pengembang** | Hitung catatan yang masuk; target ≥ 5 hari aktif dari 14 hari |
| K2 | Owner membuka dashboard atas inisiatif sendiri | Frekuensi buka; target ≥ 3× seminggu |
| K3 | Minimal 1 keputusan nyata diambil berdasarkan data di aplikasi | Wawancara singkat pasca-pakai |
| K4 | Pekerja dapat menyelesaikan 1 pencatatan **tanpa bertanya** | Observasi langsung saat UAT |
| K5 | Tidak ada pencatatan yang gagal permanen karena sinyal | Cek antrian draft |

> **K4 wajib diobservasi langsung**: Om Ari yang memegang HP, pengembang hanya mengamati tanpa membantu. Ini menutup satu-satunya lubang validasi yang tersisa (hambatan pekerja terhadap perangkat, bukan pemahaman kebun).

---

## 8. Urutan Iterasi (peta kerja)

| Iterasi | Isi | Sifat |
|---|---|---|
| **A — Pemangkasan & merge** | Merge manual care → `catatan_perawatan` + field `asal` (RF-13). Pangkas B3 (foto → 2 entitas), B4 (CRUD & soft-delete), B5 (reopen). | Refactor. Wajib. |
| **B — Fitur murah-berdampak** | RF-12 catatan produk. RF-11 penanda umur berbunga + penanda jadwal in-app. | Wajib. Data sebagian sudah ada. |
| **C — Laporan lapangan + offline draft** | RF-10 versi ramping. Draft lokal + kirim ulang. | Wajib. |
| **D — Penyempurnaan** | Push notification (opsional). Poles UI seperlunya. | **Boleh gagal.** Jangan memblokir rilis. |

Aturan: **kerjakan satu iterasi sampai tuntas.** Jangan paralel. Jika waktu menipis, potong dari D, bukan dari A–C.

---

## 9. Konsekuensi untuk skripsi

1. **Tabel 3.5 (RF)** — tambah RF-10, RF-11, RF-12, RF-13.
2. **Tabel 3.7–3.12 (US, SP, NAT, backlog, iterasi)** — tambah US-17…US-22; hitung ulang (lihat `planning_ulang_bab3.md`).
3. **Batasan Masalah** — lihat `revisi_batasan_masalah.md`. Penyesuaian v4: push notification dinyatakan **opsional/penyempurnaan**, bukan fitur inti; tambahkan pernyataan draft offline terbatas (tanpa sinkronisasi otomatis).
4. **Use Case / Activity / Sitemap** — tambahkan alur RF-10, RF-11, RF-13.
5. **UAT** — framing **kualitatif** (observasi penggunaan + wawancara pasca-pakai), bukan skor kuesioner. Dengan n=2, angka Likert/SUS tidak bermakna secara statistik. Instrumen diturunkan dari RF/US final ini.

---

## 10. Risiko yang diterima secara sadar

Dicatat agar dapat dipertanggungjawabkan di retrospektif/sidang, bukan disembunyikan:

| Risiko | Status | Mitigasi |
|---|---|---|
| Pembimbing belum menyetujui perubahan scope (cabut batasan, +4 RF, iterasi naik) | **Diterima** — implementasi jalan dulu | Kirim landasan ini sebagai info tertulis ke pembimbing tanpa menunggu balasan. Biaya ~10 menit, tidak memperlambat. Jika keberatan muncul, diketahui sekarang bukan saat sidang. |
| Pekerja (Om Ari) belum divalidasi langsung | **Diterima** | Ditutup lewat K4 saat UAT |
| RF-10 berpotensi ditinggal (beban di pekerja, manfaat di owner) | **Diterima** | Pantau lewat K1; jika tidak dipakai, catat jujur di retrospektif |
| Studi kasus tunggal, 1 narasumber utama | **Diterima** | Nyatakan eksplisit sebagai keterbatasan penelitian; sah untuk PXP (metodologi personal) |
| Sumber literatur sebagian produk komersial (non-akademis) | **Perlu tindak lanjut** | Gunakan hanya sebagai pembanding praktik; cari padanan akademis untuk landasan teori |
| Estimasi 47 SP / 67 hari belum teruji | **Diterima** | Catat velocity aktual per iterasi untuk retrospektif PXP |

---

## 11. Batas keandalan dokumen

- Penomoran RF-10…RF-13 & US-17…US-22 adalah usulan; sesuaikan dengan konvensi skripsi.
- Kolom Observasi pada tabel triangulasi masih perlu dilengkapi dari catatan lapangan aktual sebelum dijadikan lampiran.
- Nama tabel/field pada §5 bersifat konseptual; sesuaikan dengan konvensi penamaan kodebase.
- Keputusan di sini mengikat untuk Versi 1; hasil UAT dapat mengubahnya, dan itu **sesuai siklus PXP**, bukan kegagalan.
