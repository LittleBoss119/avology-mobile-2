-- 028: tree_history_view mengikuti model perawatan multi-pohon
--
-- Perubahan pada sumber 'care':
--   * Target pohon kini diambil dari jembatan care_activity_trees, BUKAN dari
--     care_tasks.target_tree_id. Akibatnya satu perawatan yang berdampak ke
--     banyak pohon muncul di riwayat SETIAP pohon terdampak.
--   * JOIN ke care_tasks menjadi LEFT JOIN karena care_task_id sekarang NULL
--     untuk catatan inisiatif (025). INNER JOIN akan menghilangkan seluruh
--     catatan inisiatif dari riwayat.
--   * Kolom baru `asal` diekspos untuk badge Terjadwal/Inisiatif di UI.
--     Sumber non-care bernilai NULL.
--
-- Sumber 'manual_care' DIHAPUS: manual_care_records tidak lagi menjadi sumber
-- riwayat (tabelnya masih ada sebagai cadangan sampai migrasi pembersih akhir).
--
-- Aman dilakukan sekarang karena data perawatan sudah dikosongkan oleh 026.
--
-- CATATAN VISIBILITAS: view ini security_invoker, sehingga tunduk pada policy
-- SELECT care_activities -- owner melihat seluruh aktivitas kebun, worker hanya
-- aktivitas miliknya sendiri. Ini LEBIH KETAT daripada manual_care_records dulu
-- (semua anggota aktif bisa melihat semua catatan). Konsekuensinya riwayat
-- pohon yang dilihat worker tidak memuat perawatan worker lain.

drop view if exists public.tree_history_view;

create view public.tree_history_view
with (security_invoker = true)
as
select
  tcr.id as source_id,
  tcr.tree_id,
  tcr.farm_id,
  'condition'::text as history_type,
  tcr.condition_status::text as title,
  tcr.note as description,
  tcr.reported_by as actor_id,
  tcr.reported_at as happened_at,
  null::text as asal
from public.tree_condition_reports tcr
where tcr.is_deleted = false

union all

select
  gpr.id as source_id,
  gpr.tree_id,
  gpr.farm_id,
  'phase'::text as history_type,
  gpr.phase::text as title,
  gpr.note as description,
  gpr.recorded_by as actor_id,
  gpr.recorded_at as happened_at,
  null::text as asal
from public.growth_phase_records gpr
where gpr.is_deleted = false

union all

select
  ca.id as source_id,
  cat.tree_id,
  ca.farm_id,
  'care'::text as history_type,
  coalesce(ct.title, 'Perawatan inisiatif') as title,
  coalesce(nullif(trim(ca.note), ''), ca.category::text) as description,
  ca.performed_by as actor_id,
  ca.performed_at as happened_at,
  ca.asal
from public.care_activities ca
join public.care_activity_trees cat
  on cat.care_activity_id = ca.id
left join public.care_tasks ct
  on ct.id = ca.care_task_id

union all

select
  hr.id as source_id,
  hr.tree_id,
  hr.farm_id,
  'harvest'::text as history_type,
  'Panen dicatat'::text as title,
  trim(concat(
    'Jumlah buah: ',
    hr.fruit_count::text,
    case
      when nullif(trim(hr.fruit_condition), '') is not null
        then concat('. Kondisi: ', trim(hr.fruit_condition))
      else ''
    end,
    case
      when nullif(trim(hr.note), '') is not null
        then concat('. Catatan: ', trim(hr.note))
      else ''
    end
  )) as description,
  hr.harvested_by as actor_id,
  hr.harvested_at as happened_at,
  null::text as asal
from public.harvest_records hr
where hr.is_deleted = false;

grant select on public.tree_history_view to authenticated;

notify pgrst, 'reload schema';
