-- 029: Longgarkan visibilitas catatan perawatan
--
-- Policy SELECT care_activities sebelumnya (migrasi 007) berbunyi: owner
-- melihat seluruh aktivitas kebun, worker HANYA aktivitas miliknya sendiri.
-- Setelah manual care disatukan ke care_activities, aturan itu membuat riwayat
-- pohon tidak lengkap -- perawatan yang dicatat owner tidak terlihat oleh
-- worker dan sebaliknya. Itu menggagalkan tujuan fitur riwayat: menelusuri
-- balik treatment mana yang efektif pada sebuah pohon.
--
-- Dilonggarkan menjadi: semua anggota aktif kebun melihat semua catatan
-- perawatan di kebunnya -- menyamai perilaku lama manual_care_records
-- ("Active members can view manual care records", migrasi 020). Konteksnya
-- kebun kecil (1 owner + 1 pekerja); tidak ada alasan menyembunyikan data
-- perawatan antar keduanya.
--
-- Cakupan sengaja HANYA visibilitas catatan perawatan. Policy lain yang memakai
-- pemisahan owner/worker (mis. care_tasks, can_access_task_proof_photo) tidak
-- disentuh.
--
-- KEPUTUSAN SADAR -- FOTO: catatan perawatan inisiatif TIDAK mendukung lampiran
-- foto. entity_type='care_activity' sengaja TIDAK ditambahkan ke
-- photo_attachments. Foto dipangkas dan hanya disisakan untuk kondisi pohon dan
-- bukti tugas. Ini regresi yang diterima sadar dari manual_care_records (yang
-- dulu mendukung foto), bukan kelalaian.

-- 1. care_activities: semua anggota aktif kebun ------------------------------
drop policy if exists "Owners view farm activities and workers view own activities" on public.care_activities;
drop policy if exists "Active members can view care activities" on public.care_activities;
create policy "Active members can view care activities"
on public.care_activities
for select
to authenticated
using (public.is_active_farm_member(farm_id, auth.uid()));

-- 2. care_activity_trees: ikut dilonggarkan agar konsisten dengan induknya ----
-- Sebelumnya (025) policy ini me-mirror pemisahan owner/worker. Karena induknya
-- kini terbuka untuk semua anggota aktif, jembatan mengikuti -- kalau tidak,
-- baris jembatan tersaring dan pohon terdampak hilang dari riwayat meskipun
-- aktivitasnya terlihat.
drop policy if exists "View care activity trees by parent visibility" on public.care_activity_trees;
create policy "View care activity trees by parent visibility"
on public.care_activity_trees
for select
to authenticated
using (
  exists (
    select 1
    from public.care_activities ca
    where ca.id = care_activity_id
      and public.is_active_farm_member(ca.farm_id, auth.uid())
  )
);

notify pgrst, 'reload schema';
