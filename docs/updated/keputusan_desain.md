# Keputusan Desain Avology

Dokumen ini mencatat **apa yang sengaja TIDAK ada** dan kenapa. Tujuannya satu: mencegah fitur ditambahkan ulang karena lupa alasannya.

**Cara pakai:** setiap kali muncul pertanyaan "kok nggak ada X?", cek dokumen ini dulu. Kalau X ada di sini, berarti sengaja — jangan tambahkan tanpa alasan baru. Kalau tidak ada di sini, baru diskusikan.

Simpan di `docs/` dalam repo agar ikut versi kode, bukan di folder Downloads.

---

## Prinsip pengikat

1. **Modul utama = manajemen kebun.** Selain itu pelengkap, boleh gagal.
2. **Simplicity di atas kelengkapan.** Prinsip GIGO pemilik: *"kalau input ribet, Om Ari nggak akan mau pakai."*
3. **Kebutuhan user, bukan keinginan developer.** Fitur harus lolos ≥2 sumber triangulasi (wawancara / observasi / literatur).
4. **Sistem informasi, bukan prediksi/IoT.**
5. **Sukses = dipakai, bukan lolos tes.**

---

## Yang SENGAJA tidak ada

| Fitur | Status | Alasan | Boleh ditinjau ulang kalau... |
|---|---|---|---|
| **Foto di catatan perawatan** | Dibuang (B3) | Beban input tanpa dasar kebutuhan. "Nyiram pohon" tidak butuh bukti foto. Foto hanya disisakan di **kondisi pohon** (dokumentasi penyakit) & **bukti task**. | Pemilik/pekerja secara spesifik minta saat UAT |
| **Foto di fase pertumbuhan, panen, laporan operasional** | Dibuang (B3) | Sama: beban input, tidak diminta. | Sama |
| **Foto pohon utama (`tree_main`)** | **Ditahan, belum diputuskan** | Mungkin berguna sebagai identitas visual pohon, beda kelas dari foto-sebagai-bukti. | Konfirmasi saat UAT |
| **Edit & hapus catatan perawatan** | Dilepas (B4) | CRUD penuh + soft-delete di setiap record = biang ~100 layar di V2. | Pekerja mengeluh salah catat tidak bisa dikoreksi (pantau di UAT) |
| **Soft-delete per record** | Dilepas (B4) | Sama. | Sama |
| **Layar detail terpisah "dicatat sendiri" vs "orang lain"** | Digabung (B4) | Dua file untuk satu tujuan. Cukup beda di kondisi tampil tombol. | — |
| **Buka ulang laporan (reopen)** | Dihapus (B5) | Turunan laporan operasional yang berlebih. | — |
| **Status berlapis di laporan lapangan** | Disederhanakan (RF-10) | Alur 4 status + tolak + follow-up tidak pernah diminta. | — |
| **Jalur pencatatan perawatan ganda** | Digabung (B2→RF-13) | `manual_care_records` vs realisasi task = dua tabel untuk hal sama → pekerja bingung "catat lewat mana". Sekarang satu tabel, dibedakan field `asal`. | — |
| **Multi-select pohon di layar catat perawatan (dari detail pohon)** | Dihapus | Kalau masuk dari detail pohon A-2, konteksnya sudah jelas. Menyuruh memilih pohon lain di situ membingungkan. Model data (`care_activity_trees`) tetap many-to-many — hanya UI-nya yang disederhanakan. | Terbukti pemilik/pekerja sering merawat beberapa pohon sekaligus (tanya saat UAT) |
| **Layar khusus perawatan multi-pohon** | Belum dibangun | Belum terbukti dibutuhkan. Model data sudah siap, tinggal bikin layar kalau perlu. | Jawaban UAT: "kalau nyemprot, sekali jalan kena beberapa pohon" |
| **Prediksi/estimasi panen** | Tidak akan ada | 6 bulan hanya rata-rata kasar; bisa lebih cepat/lambat/layu. Tanpa ML tidak bisa prediksi. Sistem hanya menampilkan **"N hari sejak berbunga"** — keputusan panen tetap manusia. | — (bertentangan dengan batasan masalah) |
| **Pencatatan finansial / upah pekerja** | Out of scope | Diminta pemilik, tapi di luar ruang lingkup skripsi. Dicatat jujur di Batasan Masalah, bukan disembunyikan. | Pengembangan lanjutan |
| **Target kuantitas & grading panen** | Out of scope | Nyata tapi memperluas scope. | Roadmap |
| **Integrated farming (ternak, resto, kelompok tani)** | Out of scope | Pemilik sendiri menyebut app ini "langkah awal". | — |
| **Push notification** | Opsional, Iterasi D | Boleh gagal. Penanda in-app sudah menutup kebutuhan inti. Kandidat terkuat penyebab proyek mandek jilid dua. | — |
| **Sync engine offline** | Tidak akan ada | Sekelas/lebih berat dari push. Diganti: draft lokal + tombol kirim ulang manual. | — |
| **IoT, sensor, drone, GIS** | Tidak akan ada | Batasan masalah skripsi. | — |

---

## Yang MASIH kurang (bukan keputusan, tapi celah)

| Item | Catatan |
|---|---|
| **Detail read-only catatan perawatan** | Saat ini catatan inisiatif **tidak bisa dibuka sama sekali** dari riwayat. Ini bukan bagian dari keputusan "lepas edit/hapus" — user tetap harus bisa **membaca** catatannya sendiri. Melihat ≠ mengedit. Ini bagian dari US-14 (riwayat pohon). **Perlu dibangun.** |

---

## Jejak keputusan penting (kenapa sesuatu jadi begini)

- **`row`/`column` bukan tipe target.** Itu koordinat lokasi pohon, bukan unit kerja. Pekerja tidak berpikir "saya menyemprot kolom 3". Di UI, baris/kolom hanya alat bantu memfilter saat memilih pohon.
- **`care_activity_trees` (jembatan many-to-many) dipertahankan** walau UI hanya kirim 1 pohon. Alasan: aman untuk kedua kemungkinan. Kalau ternyata multi-pohon dibutuhkan, tinggal bikin layar — tidak perlu ubah database.
- **Backfill dibatalkan** karena data lama hanya 11 baris manual care + 73 realisasi, semuanya data tes pengembang. Membangun 4 migration untuk menyelamatkan data palsu tidak sepadan. Sistem dimulai bersih.
- **Visibilitas riwayat dilonggarkan** (029): semua anggota aktif kebun melihat semua catatan perawatan. Alasan: kalau owner mencatat perawatan tapi worker tidak melihatnya, riwayat jadi bohong — menggagalkan tujuan US-14 (*"kehilangan track record obat efektif"*).
- **Trigger `validate_care_activity` diperbaiki** (030): cabang `care_task_id IS NULL` — yang mengizinkan pencatatan inisiatif — berasal dari **migration 030, BUKAN 006**. Versi 006 justru **menolak** insert inisiatif: untuk `care_task_id` NULL, lookup ke `care_tasks` tidak mendapat baris, lalu `task_farm_id IS DISTINCT FROM new.farm_id` menjadi `NULL IS DISTINCT FROM <uuid>` = TRUE → exception *"task must belong to the same farm"* menyala justru karena tidak ada task. Membuat kolom nullable (025) tidak pernah cuma soal kolom — semua yang berasumsi "kolom ini selalu terisi" ikut kena. **(Koreksi asal-usul — jangan lagi mengira cabang ini sudah ada sejak 006.)**

---

## Aturan main untuk diri sendiri

1. **Sebelum menambah fitur, cek dokumen ini.** Kalau ada di daftar "sengaja tidak ada", jangan tambah tanpa alasan baru yang lolos triangulasi.
2. **Kalau merasa "kok nggak ada X?"** — itu sinyal cek dokumen, bukan sinyal langsung bangun.
3. **Fitur baru harus punya dasar**: minimal 2 dari 3 sumber (wawancara / observasi / literatur). "Kayaknya perlu deh" bukan dasar.
4. **Kalau UAT menunjukkan sesuatu kurang, itu alasan sah.** Catat di sini, lalu bangun. Itu siklus PXP yang benar — bukan kegagalan.
5. **Dokumen ini ikut commit.** Kalau keputusan berubah, ubah di sini juga, jangan cuma di kepala.
