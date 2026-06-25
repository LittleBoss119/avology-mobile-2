# Media Foundation Checklist

Batch 6A hanya memvalidasi pondasi media. Jangan gunakan checklist ini untuk menilai UI foto penuh karena tombol foto produksi belum dipasang.

## Database and Storage

- Bucket `avology-photos` ada di Supabase Storage.
- Bucket `avology-photos` private, bukan public.
- Path object mengikuti format `farms/{farmId}/{entityFolder}/{entityId}/{timestamp}-{random}.{ext}`.
- Entity folder yang disiapkan: `trees`, `condition-reports`, `operational-reports`, `task-proofs`.
- Tabel `photo_attachments` ada dan memiliki RLS aktif.
- User di luar farm tidak bisa membaca metadata attachment farm lain.
- Owner aktif bisa membaca metadata attachment farm.
- Worker aktif bisa membaca metadata attachment farm.
- Owner aktif bisa menghapus attachment dalam farm.
- Uploader aktif bisa menghapus attachment miliknya.
- Worker aktif tidak bisa menghapus attachment milik owner atau worker lain.

## App Helpers

- `pickImageFromGallery()` mengembalikan `ok(null)` saat picker dibatalkan.
- `takePhotoFromCamera()` mengembalikan `ok(null)` saat kamera dibatalkan.
- Permission denied menghasilkan pesan ramah dan tidak membuat app crash.
- File non-image ditolak.
- File di atas 5MB ditolak.

## Service

- `uploadPhotoAttachment()` bisa upload object dan insert metadata.
- `listPhotoAttachments()` hanya mengembalikan attachment sesuai farm/entity yang dapat diakses user.
- `getPhotoSignedUrl()` menghasilkan URL sementara untuk bucket private.
- `deletePhotoAttachment()` menghapus storage object dan metadata.
- Tidak ada screen produksi yang berubah untuk fitur foto penuh di Batch 6A.
