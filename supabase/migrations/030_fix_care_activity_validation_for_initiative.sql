-- 030: Perbaiki validasi care_activities untuk catatan inisiatif
--
-- Kolom care_activities.care_task_id dibuat NULLABLE di migrasi 025 untuk
-- mendukung catatan perawatan inisiatif (asal='inisiatif'), tetapi trigger
-- validasi validate_care_activity() (migrasi 006) belum ikut menyesuaikan.
-- Ini perbaikannya.
--
-- BUG-nya: trigger melakukan lookup `... from public.care_tasks where id =
-- new.care_task_id`. Untuk catatan inisiatif care_task_id NULL, sehingga tidak
-- ada baris yang cocok. SELECT INTO tanpa hasil TIDAK error di PL/pgSQL --
-- variabelnya hanya dibiarkan NULL. Lalu:
--
--   if task_farm_id is distinct from new.farm_id
--
-- menjadi `NULL IS DISTINCT FROM '<uuid>'` = TRUE, karena IS DISTINCT FROM
-- sengaja memperlakukan NULL sebagai nilai yang dapat dibandingkan (berbeda
-- dari `<>`, yang menghasilkan NULL dan dianggap false oleh IF). Akibatnya
-- exception menyala JUSTRU karena tidak ada task:
--
--   P0001: 'Care activity task must belong to the same farm'
--
-- Ada TIGA cek yang semuanya mengasumsikan task selalu ada:
--   1. farm task cocok              -> NULL IS DISTINCT FROM ... = true -> gagal
--   2. pelaku = worker yang ditugas -> NULL IS DISTINCT FROM ... = true -> gagal
--   3. pelaku wajib role 'worker'   -> memblokir owner sepenuhnya, bertentangan
--      dengan policy "Active members can insert initiative activities" (027)
--      yang sengaja mengizinkan owner ATAU worker.
-- Memperbaiki cek 1 saja hanya memindahkan error ke cek 2, lalu ke cek 3.
--
-- PERBAIKAN: bercabang pada care_task_id.
--   * care_task_id IS NOT NULL (terjadwal): ketiga cek lama dipertahankan utuh,
--     tanpa perubahan perilaku sedikit pun.
--   * care_task_id IS NULL (inisiatif): seluruh cek berbasis task dilewati;
--     cukup pastikan performed_by adalah anggota aktif kebun, selaras dengan
--     policy INSERT di migrasi 027.
--
-- Migrasi 006 sengaja TIDAK disentuh: fungsinya diganti lewat `create or
-- replace`, dan trigger validate_care_activity_trigger yang sudah terpasang
-- tetap menunjuk ke nama fungsi yang sama sehingga tidak perlu dibuat ulang.
--
-- Trigger kedua (sync_task_status_from_activity_trigger) juga TIDAK disentuh
-- dan memang tidak perlu: `update public.care_tasks where id = new.care_task_id`
-- dengan NULL cocok 0 baris -- update no-op, tidak error, tidak raise.

create or replace function public.validate_care_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  task_farm_id uuid;
  task_assigned_to uuid;
begin
  -- Catatan inisiatif: tidak ada tugas induk yang bisa divalidasi.
  if new.care_task_id is null then
    if not public.is_active_farm_member(new.farm_id, new.performed_by) then
      raise exception 'Only active farm members can create initiative care activities';
    end if;

    return new;
  end if;

  -- Realisasi tugas terjadwal: perilaku migrasi 006 dipertahankan apa adanya.
  select farm_id, assigned_to
  into task_farm_id, task_assigned_to
  from public.care_tasks
  where id = new.care_task_id;

  if task_farm_id is distinct from new.farm_id then
    raise exception 'Care activity task must belong to the same farm';
  end if;

  if task_assigned_to is distinct from new.performed_by then
    raise exception 'Only the assigned worker can create care activity for a task';
  end if;

  if not exists (
    select 1
    from public.farm_members
    where farm_id = new.farm_id
      and user_id = new.performed_by
      and role = 'worker'
      and status = 'active'
  ) then
    raise exception 'Only active workers can create care activities';
  end if;

  return new;
end;
$$;
