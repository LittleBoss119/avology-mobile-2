-- 025: Care activity target bridge foundation
--
-- Menyiapkan penyatuan care_activities + manual_care_records:
--   * care_activities kini punya asal: 'terjadwal' (dari care_tasks) atau
--     'inisiatif' (pencatatan tanpa tugas terjadwal).
--   * Target pohon dipindah ke tabel jembatan public.care_activity_trees,
--     karena satu catatan perawatan dapat berdampak ke banyak pohon.
--     row/column BUKAN lagi tipe target -- hanya koordinat filter di UI.
--
-- Migrasi ini TIDAK melakukan backfill, TIDAK drop apa pun, TIDAK menyentuh
-- manual_care_records, dan TIDAK mengubah tree_history_view.

-- 1. Kolom baru pada care_activities ------------------------------------------
alter table public.care_activities
  add column if not exists asal text not null default 'terjadwal',
  add column if not exists category public.care_category,
  add column if not exists produk text;

-- 2. care_task_id menjadi nullable (pencatatan inisiatif tidak punya tugas) ----
alter table public.care_activities
  alter column care_task_id drop not null;

-- 3. CHECK constraints --------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'care_activities_asal_check'
      and conrelid = 'public.care_activities'::regclass
  ) then
    alter table public.care_activities
      add constraint care_activities_asal_check
      check (asal in ('terjadwal', 'inisiatif'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'care_activities_asal_source_check'
      and conrelid = 'public.care_activities'::regclass
  ) then
    alter table public.care_activities
      add constraint care_activities_asal_source_check
      check (
        (asal = 'terjadwal' and care_task_id is not null)
        or (asal = 'inisiatif' and care_task_id is null and category is not null)
      );
  end if;
end $$;

-- 4. Tabel jembatan care_activity_trees ---------------------------------------
create table if not exists public.care_activity_trees (
  care_activity_id uuid not null
    references public.care_activities(id) on delete cascade,
  tree_id uuid not null
    references public.trees(id) on delete cascade,
  constraint care_activity_trees_pkey primary key (care_activity_id, tree_id)
);

create index if not exists idx_care_activity_trees_tree_id
  on public.care_activity_trees(tree_id);

-- 5. RLS: samakan dengan visibilitas care_activities induk ---------------------
alter table public.care_activity_trees enable row level security;

-- Grant sengaja HANYA select + insert (tanpa update/delete), mengikuti
-- care_activities. KONSEKUENSI: user tidak dapat mengoreksi daftar pohon bila
-- salah pilih -- penghapusan tautan hanya lewat ON DELETE CASCADE saat induk
-- care_activities terhapus. Ini diterima untuk sekarang dan akan dievaluasi
-- ulang setelah uji pakai; bila perlu edit target pohon, tambah policy
-- UPDATE/DELETE di migrasi lanjutan.
--
-- Catatan: policy di bawah bersasaran role `authenticated` (trafik app via
-- PostgREST). Backfill data satu kali dijalankan sebagai owner/service role
-- yang mem-bypass RLS, sehingga tidak terpengaruh syarat performed_by = auth.uid().
grant select, insert on public.care_activity_trees to authenticated;

-- SELECT: mengikuti pola care_activities via induk -- owner melihat seluruh
-- aktivitas kebun, worker hanya aktivitas miliknya sendiri.
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
      and (
        public.is_active_owner(ca.farm_id, auth.uid())
        or (
          public.is_active_worker(ca.farm_id, auth.uid())
          and ca.performed_by = auth.uid()
        )
      )
  )
);

-- INSERT: hanya pelaku aktivitas (performed_by) yang berstatus anggota aktif
-- kebun aktivitas tersebut yang boleh menautkan pohon ke aktivitas.
drop policy if exists "Insert care activity trees for own activity" on public.care_activity_trees;
create policy "Insert care activity trees for own activity"
on public.care_activity_trees
for insert
to authenticated
with check (
  exists (
    select 1
    from public.care_activities ca
    where ca.id = care_activity_id
      and ca.performed_by = auth.uid()
      and public.is_active_farm_member(ca.farm_id, auth.uid())
  )
);

notify pgrst, 'reload schema';
