# Hitung Ulang Tabel Planning (Bab 3) — v2

Menggantikan `planning_ulang_bab3.md`. Perubahan: penambahan US-21 (perawatan non-terjadwal) & US-22 (draft offline); US-19b (push) ditegaskan **opsional**.

Metode dipertahankan dari skripsi: story point Fibonacci (1,2,3,5,8…), prioritas NAT, velocity target 10 SP/iterasi.

> Angka SP & prioritas adalah **usulan konsisten** dengan penilaian US lama. Sesuaikan jika penilaianmu berbeda — yang penting metodenya seragam.

## Tabel 3.8 (revisi) — Estimasi User Story

US-01 s/d US-16 tetap: **37 SP / 53 hari**.

| Kode | User Story | SP | Hari | Alasan SP |
|---|---|---|---|---|
| US-21 | Pencatatan perawatan non-terjadwal (merge + field asal) | 3 | 4 | Migrasi data + gabung service; struktur sudah ada, tapi menyentuh model inti. |
| US-20 | Catatan produk perawatan | 2 | 3 | Tambah field + tampil di riwayat; ringan. |
| US-19 | Penanda umur berbunga & penanda jadwal (in-app) | 3 | 4 | Perhitungan tanggal + indikator dashboard; data sebagian sudah ada. |
| US-17 | Laporan lapangan pekerja | 3 | 4 | Form + daftar + relasi kebun. |
| US-18 | Tinjau & tindak lanjut laporan | 2 | 3 | Sederhana karena tanpa status berlapis. |
| US-22 | Draft lokal & kirim ulang manual | 2 | 3 | Simpan lokal + penanda + tombol kirim ulang. **Tanpa auto-sync/resolusi konflik** — itu yang menahan SP tetap rendah. |
| **Subtotal wajib** | | **15** | **21** | |
| **TOTAL WAJIB** | | **52** | **74** | 37+15 SP / 53+21 hari |
| US-19b | *(Opsional)* Push notification | 5 | 6 | Scheduler, izin, token, uji device fisik. **Tidak dihitung dalam total wajib.** |
| **TOTAL + opsional** | | **57** | **80** | |

> **Penting untuk Bab 3:** pisahkan US-19b dari total wajib. Ini membuat transparan bahwa push adalah penyempurnaan, dan jika tidak terealisasi, tidak menggagalkan pemenuhan requirement inti.

## Tabel 3.10 (revisi) — Prioritas NAT

| Kode | User Story | Skala | Nilai | Alasan |
|---|---|---|---|---|
| US-21 | Perawatan non-terjadwal | 3 | Critical | Menutup use case nyata (inisiatif pekerja, owner turun tangan) yang tidak tertangani realisasi terjadwal. Menyentuh model data inti. |
| US-20 | Catatan produk | 2 | Standard | Menjawab "lupa merek obat". |
| US-19 | Penanda/pengingat in-app | 3 | Critical | Menjawab pain point utama (telat treatment, salah waktu petik). |
| US-17 | Laporan lapangan | 2 | Standard | Komunikasi 2 arah; penting, bukan inti pencatatan. |
| US-18 | Tinjau & tindak lanjut | 2 | Standard | Pasangan US-17. |
| US-22 | Draft offline | 2 | Standard | Mitigasi sinyal kebun; menjaga data tidak hilang. |
| US-19b | Push notification | 1 | **Optional** | Penyempurnaan. Boleh gagal tanpa menggagalkan sistem. |

Rekap NAT: **Critical = 16** (14 lama + US-19, US-21), **Standard = 8** (2 lama + US-17, 18, 20, 22), **Optional = 1** (US-19b).

> Catatan: kehadiran ≥1 Optional justru **menyehatkan** skala NAT — sebelumnya Optional = 0, yang membuat skala terlihat tidak terpakai.

## Tabel 3.11 (revisi) — Product Backlog

| Kode | Fitur | NAT | SP | Hari |
|---|---|---|---|---|
| US-01…US-16 | (tetap seperti backlog lama) | — | 37 | 53 |
| US-21 | Perawatan non-terjadwal (merge) | 3 | 3 | 4 |
| US-20 | Catatan produk perawatan | 2 | 2 | 3 |
| US-19 | Penanda umur berbunga & jadwal | 3 | 3 | 4 |
| US-17 | Laporan lapangan pekerja | 2 | 3 | 4 |
| US-18 | Tinjau & tindak lanjut | 2 | 2 | 3 |
| US-22 | Draft lokal & kirim ulang | 2 | 2 | 3 |
| **Jumlah wajib** | | | **52** | **74** |
| US-19b | *(Opsional)* Push notification | 1 | 5 | 6 |

Urutan backlog mengikuti ketergantungan: US-21 lebih dulu karena mengubah model data yang dipakai US-20.

## Tabel 3.12 (revisi) — Velocity & Iterasi

52 SP ÷ velocity 10 = 5,2 → **6 iterasi** (5 penuh + 1 kecil). Naik dari 4 iterasi versi lama.

| Iterasi | Isi | SP |
|---|---|---|
| Iterasi 1 | US-01…US-06 (auth & relasi kebun) | 12 |
| Iterasi 2 | US-07, US-08, US-13 (pohon, fase, kondisi) | 8 |
| Iterasi 3 | US-09, US-10, US-11, US-12 (SOP, jadwal, tugas, realisasi) | 9 |
| Iterasi 4 | US-14, US-15, US-16 (riwayat, panen, dashboard) | 8 |
| Iterasi 5 | US-21, US-20, US-19 (merge perawatan, produk, penanda) | 8 |
| Iterasi 6 | US-17, US-18, US-22 (laporan lapangan, draft offline) | 7 |
| *(Ekor)* | US-19b push notification — **opsional, dikerjakan jika waktu tersisa** | *(5)* |

## Pemetaan ke Iterasi kerja (landasan v4)

Penomoran iterasi skripsi (planning formal) ≠ Iterasi A–D di landasan (peta kerja). Pemetaannya:

| Landasan | Skripsi | Catatan |
|---|---|---|
| Iterasi A (pemangkasan & merge) | Iterasi 5 (US-21) + refactor B3–B5 | Pemangkasan B3–B5 adalah **refactor**, tidak muncul sebagai US baru |
| Iterasi B (fitur murah-berdampak) | Iterasi 5 (US-20, US-19) | |
| Iterasi C (laporan + offline) | Iterasi 6 (US-17, US-18, US-22) | |
| Iterasi D (penyempurnaan) | Ekor (US-19b) | Boleh gagal |

Jelaskan di Bab 3: iterasi akhir mencakup penyempurnaan & fitur pendukung; pemangkasan/refactor tercatat di retrospektif, bukan sebagai backlog fitur.

## Untuk retrospektif PXP

Catat **velocity aktual** tiap iterasi, bukan hanya target 10 SP. Proyek ini pernah mandek sekali; selisih target vs aktual adalah bahan retrospektif yang sah dan justru memperkuat penerapan metodologi.
