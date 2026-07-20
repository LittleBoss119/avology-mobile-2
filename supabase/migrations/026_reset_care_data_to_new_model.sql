-- 026: Reset data perawatan ke model baru
--
-- KEPUTUSAN: rencana backfill (kolom provenance + Tahap A/B/C) DIBATALKAN.
-- Alasan: manual_care_records hanya berisi 11 baris data tes non-operasional
-- (seluruhnya target_type='tree'). Backfill tidak sepadan untuk 11 baris data
-- non-operasional; sistem dimulai bersih dengan model baru
-- (care_activities + asal/category/produk + jembatan care_activity_trees).
--
-- manual_care_records SENGAJA TIDAK di-drop. Tabelnya dibiarkan utuh sebagai
-- cadangan sampai kode selesai dibersihkan; drop dilakukan di migrasi
-- pembersih paling akhir.
--
-- BLAST RADIUS (sudah diverifikasi terhadap skema):
--   * care_activity_trees adalah SATU-SATUNYA tabel ber-FK ke care_activities,
--     jadi CASCADE di bawah hanya menyentuh tabel itu.
--   * manual_care_records tidak punya dependen FK, jadi tidak perlu CASCADE.
--   * photo_attachments bersifat polimorfik TANPA FK (entity_type + entity_id),
--     sehingga TIDAK ikut ter-truncate. Setelah migrasi ini akan tersisa baris
--     yatim untuk entity_type='manual_care_record' dan entity_type='task_proof'
--     (task_proof.entity_id menunjuk care_activities.id), berikut objek fisiknya
--     di Storage. Pembersihan foto SENGAJA tidak termasuk di migrasi ini dan
--     harus ditangani terpisah -- lihat verifikasi #4 di bawah.

truncate table public.manual_care_records;

truncate table public.care_activities cascade;

-- VERIFIKASI (jalankan setelah migrasi):
--   1. select count(*) from public.manual_care_records;   -- harus 0
--   2. select count(*) from public.care_activities;        -- harus 0
--   3. select count(*) from public.care_activity_trees;    -- harus 0 (via CASCADE)
--   4. select entity_type, count(*) from public.photo_attachments
--      where entity_type in ('manual_care_record','task_proof')
--      group by entity_type;                               -- baris yatim yang tersisa
