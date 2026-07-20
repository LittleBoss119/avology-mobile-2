-- 027: Jalur tulis pencatatan perawatan inisiatif (multi-pohon)
--
-- Melengkapi 025: schema sudah mengizinkan asal='inisiatif' (care_task_id NULL),
-- tetapi policy INSERT care_activities yang ada ("Worker can insert own task
-- activities", migrasi 007) mensyaratkan care_task_id cocok dengan care_tasks
-- milik worker. Untuk catatan inisiatif care_task_id NULL, sehingga INSERT
-- selalu ditolak. Policy di bawah menutup celah itu.
--
-- Cakupan akses sengaja MENYAMAI policy lama manual_care_records
-- ("Active members can insert manual care records", migrasi 020): owner ATAU
-- worker aktif boleh mencatat, selama mencatat atas nama dirinya sendiri.
--
-- CATATAN DESAIN (disengaja): catatan inisiatif TIDAK dapat diedit atau
-- dihapus. care_activities tidak punya is_deleted/updated_at dan grant-nya
-- hanya select+insert. Ini penyederhanaan CRUD yang disepakati, menggantikan
-- update_own_manual_care_record / soft_delete_own_manual_care_record, dan akan
-- dievaluasi ulang setelah uji pakai user.

-- 1. Policy INSERT untuk catatan inisiatif ------------------------------------
-- Policy INSERT bersifat permissive dan di-OR: policy 'terjadwal' dari migrasi
-- 007 tetap berlaku apa adanya untuk care_task_id yang tidak NULL.
drop policy if exists "Active members can insert initiative activities" on public.care_activities;
create policy "Active members can insert initiative activities"
on public.care_activities
for insert
to authenticated
with check (
  asal = 'inisiatif'
  and care_task_id is null
  and performed_by = auth.uid()
  and public.is_active_farm_member(farm_id, auth.uid())
);

-- 2. RPC: satu transaksi untuk 1 care_activities + N care_activity_trees ------
-- Klien Supabase tidak bisa membungkus banyak statement dalam satu transaksi,
-- jadi penulisan multi-pohon harus lewat RPC agar atomik.
--
-- Sengaja SECURITY INVOKER (default plpgsql), berbeda dari RPC update_own_*
-- di migrasi 023 yang SECURITY DEFINER. Alasannya: fungsi ini tidak perlu
-- mem-bypass apa pun -- ia hanya butuh atomisitas. Dengan invoker, RLS tetap
-- menjadi sumber kebenaran dan kedua INSERT tetap diuji oleh policy.
create or replace function public.create_care_activity(
  p_farm_id uuid,
  p_category public.care_category,
  p_tree_ids uuid[],
  p_note text default null,
  p_produk text default null,
  p_performed_at timestamptz default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_activity_id uuid;
  invalid_tree_count integer;
begin
  if current_user_id is null then
    raise exception 'User is not authenticated';
  end if;

  if p_tree_ids is null or array_length(p_tree_ids, 1) is null then
    raise exception 'Minimal satu pohon harus dipilih';
  end if;

  -- Semua pohon wajib berada di kebun yang sama dengan aktivitasnya.
  select count(*)
  into invalid_tree_count
  from unnest(p_tree_ids) as t(tree_id)
  where not exists (
    select 1
    from public.trees tr
    where tr.id = t.tree_id
      and tr.farm_id = p_farm_id
  );

  if invalid_tree_count > 0 then
    raise exception 'Semua pohon harus berada di kebun yang sama';
  end if;

  insert into public.care_activities (
    farm_id,
    care_task_id,
    performed_by,
    status,
    note,
    performed_at,
    asal,
    category,
    produk
  )
  values (
    p_farm_id,
    null,
    current_user_id,
    'completed',
    nullif(trim(p_note), ''),
    coalesce(p_performed_at, now()),
    'inisiatif',
    p_category,
    nullif(trim(p_produk), '')
  )
  returning id into new_activity_id;

  -- distinct: pilihan pohon ganda dari UI tidak boleh menabrak PK jembatan.
  insert into public.care_activity_trees (care_activity_id, tree_id)
  select distinct new_activity_id, t.tree_id
  from unnest(p_tree_ids) as t(tree_id);

  return new_activity_id;
end;
$$;

revoke execute on function public.create_care_activity(uuid, public.care_category, uuid[], text, text, timestamptz) from public, anon;
grant execute on function public.create_care_activity(uuid, public.care_category, uuid[], text, text, timestamptz) to authenticated;

notify pgrst, 'reload schema';
