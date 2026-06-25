# Media Regression Checklist

Status awal semua item: `Manual Pending`.

## Tree Main Photo

| Test case | Expected result | Status |
| --- | --- | --- |
| Owner upload foto utama pohon dari galeri/kamera | Foto tersimpan dan tampil di detail pohon | Manual Pending |
| Owner ganti foto utama pohon | Foto baru tampil, foto lama tidak lagi menjadi primary | Manual Pending |
| Owner hapus foto utama pohon | Detail/list kembali ke placeholder | Manual Pending |
| Worker melihat pohon yang punya foto utama | Foto tampil di list dan detail worker | Manual Pending |
| Worker membuka detail pohon | Tidak ada action tambah/ganti/hapus foto | Manual Pending |
| Signed URL atau image load gagal | Placeholder tetap tampil, layout tidak rusak | Manual Pending |

## Condition Report Photo

| Test case | Expected result | Status |
| --- | --- | --- |
| Owner membuat laporan kondisi tanpa foto | Laporan tetap tersimpan | Manual Pending |
| Owner membuat laporan kondisi dengan foto | Timeline menampilkan thumbnail foto | Manual Pending |
| Worker membuat laporan kondisi tanpa foto | Laporan tetap tersimpan | Manual Pending |
| Worker membuat laporan kondisi dengan foto | Owner dan worker dapat melihat thumbnail | Manual Pending |
| Upload foto kondisi gagal | Laporan kondisi tetap tersimpan dan warning ramah tampil | Manual Pending |
| Preview thumbnail kondisi dibuka | Preview tampil aman tanpa raw URL/path | Manual Pending |

## Operational Report Photo

| Test case | Expected result | Status |
| --- | --- | --- |
| Worker membuat laporan operasional tanpa foto | Laporan tetap tersimpan | Manual Pending |
| Worker membuat laporan operasional dengan foto | Detail laporan worker menampilkan foto | Manual Pending |
| Owner membuka detail laporan dengan foto | Foto laporan tampil di section laporan | Manual Pending |
| Report list owner/worker dibuka | List tetap compact dan filter tetap berjalan | Manual Pending |
| Upload foto laporan gagal | Laporan tetap tersimpan dan warning ramah tampil | Manual Pending |
| Follow-up report flow dijalankan | Foto tidak mengubah status laporan otomatis | Manual Pending |

## Task Proof Photo

| Test case | Expected result | Status |
| --- | --- | --- |
| Owner membuat schedule manual `requires_photo = false` | Task bisa diselesaikan tanpa foto | Manual Pending |
| Owner membuat schedule manual `requires_photo = true` | Task mewarisi badge/flag butuh bukti | Manual Pending |
| Owner membuat schedule dari SOP dengan bukti foto wajib | Task hasil schedule mewarisi `requires_photo` | Manual Pending |
| Owner membuat task dari laporan dengan bukti foto wajib | Task report-linked mewarisi `requires_photo` | Manual Pending |
| Worker complete task wajib bukti tanpa foto | Submit ditolak dengan pesan ramah | Manual Pending |
| Worker complete task wajib bukti dengan foto | Activity selesai dan proof melekat ke activity | Manual Pending |
| Upload proof wajib gagal | Task tidak dibiarkan selesai tanpa bukti | Manual Pending |
| Worker postpone task wajib bukti | Postpone tetap bisa tanpa foto | Manual Pending |
| Owner task detail dibuka setelah complete | Bukti realisasi tampil sebagai thumbnail/preview | Manual Pending |
| Owner report detail task-linked dibuka | Bukti realisasi task tampil tanpa auto-resolve report | Manual Pending |

## Security And Access

| Test case | Expected result | Status |
| --- | --- | --- |
| Owner aktif membuka media farm sendiri | Metadata dan signed URL dapat dimuat | Manual Pending |
| Worker aktif membuka media yang boleh diakses | Foto tampil sesuai rule screen/service | Manual Pending |
| Worker mencoba akses task/report worker lain | Data/foto tidak dapat diakses jika rule existing membatasi | Manual Pending |
| Worker removed/rejected membuka media | Metadata dan storage object ditolak | Manual Pending |
| User farm lain membuka media | Metadata dan storage object ditolak | Manual Pending |
| Storage bucket diperiksa | `avology-photos` private, tidak memakai public URL | Manual Pending |

## Error And Fallback

| Test case | Expected result | Status |
| --- | --- | --- |
| User cancel picker galeri/kamera | Tidak muncul error merah dan app tidak crash | Manual Pending |
| Permission kamera ditolak | Pesan “Izin kamera belum diberikan.” tampil | Manual Pending |
| Permission galeri ditolak | Pesan “Izin galeri belum diberikan.” tampil | Manual Pending |
| Foto lebih dari batas ukuran | Pesan “Ukuran foto terlalu besar.” tampil | Manual Pending |
| Signed URL gagal dibuat | UI fallback aman tanpa raw storage path | Manual Pending |
| Supabase/storage error terjadi | User melihat pesan ramah, bukan stack trace/UUID/path | Manual Pending |
