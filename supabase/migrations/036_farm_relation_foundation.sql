-- 036: fondasi relasi kebun (Fase 1)
-- Rujukan temuan: docs/audit-relasi-kebun.md Bagian 7 (R-01, R-02, R-03, R-11).
--
-- - tabel event akses append-only + backfill dari farm_members
-- - satu relasi pending/active per user (partial unique index + guard RPC global)
-- - urutan get_current_user_access berdasarkan prioritas status, bukan waktu saja
-- - reject_worker diselaraskan dengan remove_worker
-- - semua RPC keanggotaan menulis event dalam transaksi yang sama
-- - RPC baru cancel_join_request
-- - drop index duplikat idx_farm_members_farm_user
--
-- CATATAN TIPE: kolom `event` sengaja text + check constraint, BUKAN enum
-- PostgreSQL. Nilai enum tidak bisa dicabut sehingga migration jadi tidak
-- reversibel. Keputusan yang sama dipakai di migration 034 (kolom resolution).
--
-- CATATAN RIWAYAT: sampai Fase 4, layar "Riwayat akses" masih membaca
-- farm_members. Backfill di bawah bersifat MENAMBAH, tidak mengubah satu pun
-- baris farm_members, jadi layar itu tetap berjalan seperti sebelumnya.

begin;

-- ============ 1. Tabel event akses ============
-- Append-only: tidak pernah di-UPDATE, tidak pernah di-DELETE.
-- Ini yang membuat riwayat berhenti bergantung pada `status` saat ini (R-02).

create table if not exists public.farm_access_events (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),

  constraint farm_access_events_event_check
    check (event in ('requested', 'approved', 'rejected', 'cancelled', 'left', 'removed'))
);

create index if not exists idx_farm_access_events_farm_created
on public.farm_access_events(farm_id, created_at desc);

create index if not exists idx_farm_access_events_user_created
on public.farm_access_events(user_id, created_at desc);

alter table public.farm_access_events enable row level security;

-- Hanya SELECT. Tidak ada policy INSERT/UPDATE/DELETE: seluruh penulisan lewat
-- RPC SECURITY DEFINER, yang berjalan sebagai pemilik fungsi dan melewati RLS.
drop policy if exists "Users view own access events and owners view farm events"
  on public.farm_access_events;
create policy "Users view own access events and owners view farm events"
on public.farm_access_events
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_active_owner(farm_id, auth.uid())
);

revoke all on public.farm_access_events from anon;
revoke all on public.farm_access_events from authenticated;
grant select on public.farm_access_events to authenticated;

-- ============ 2. Backfill dari farm_members ============
-- Hanya baris role = 'worker'. Baris pemilik dilewati.
-- Dibungkus penjaga "tabel masih kosong" supaya migration aman kalau terlanjur
-- dijalankan dua kali.

do $$
begin
  if exists (select 1 from public.farm_access_events) then
    raise notice '036: farm_access_events sudah berisi data, backfill dilewati';
    return;
  end if;

  -- 2a. requested — setiap baris worker pernah mengajukan.
  insert into public.farm_access_events (farm_id, user_id, event, actor_id, reason, created_at)
  select fm.farm_id, fm.user_id, 'requested', fm.user_id, null, fm.created_at
  from public.farm_members fm
  where fm.role = 'worker';

  -- 2b. approved — hanya baris yang SEKARANG aktif.
  -- Baris yang sudah removed tidak mendapat event approved meskipun dulu pernah
  -- disetujui: tanggal persetujuannya sudah tidak tersimpan di mana pun setelah
  -- joined_at ikut berubah. Menebak lebih buruk daripada tidak mencatat.
  insert into public.farm_access_events (farm_id, user_id, event, actor_id, reason, created_at)
  select fm.farm_id, fm.user_id, 'approved', null, null, fm.joined_at
  from public.farm_members fm
  where fm.role = 'worker'
    and fm.status = 'active';

  -- 2c. rejected — reject_worker versi lama tidak pernah mengisi removed_at,
  -- jadi updated_at adalah stempel waktu terbaik yang tersedia (R-03).
  insert into public.farm_access_events (farm_id, user_id, event, actor_id, reason, created_at)
  select fm.farm_id, fm.user_id, 'rejected', null, null, coalesce(fm.updated_at, fm.created_at)
  from public.farm_members fm
  where fm.role = 'worker'
    and fm.status = 'rejected';

  -- 2d. left — pekerja keluar atas kemauan sendiri.
  insert into public.farm_access_events (farm_id, user_id, event, actor_id, reason, created_at)
  select
    fm.farm_id,
    fm.user_id,
    'left',
    fm.user_id,
    null,
    coalesce(fm.removed_at, fm.updated_at, fm.created_at)
  from public.farm_members fm
  where fm.role = 'worker'
    and fm.status = 'removed'
    and fm.removed_reason = 'left_by_worker';

  -- 2e. removed — dinonaktifkan pemilik, pelakunya tercatat.
  insert into public.farm_access_events (farm_id, user_id, event, actor_id, reason, created_at)
  select
    fm.farm_id,
    fm.user_id,
    'removed',
    fm.removed_by,
    null,
    coalesce(fm.removed_at, fm.updated_at, fm.created_at)
  from public.farm_members fm
  where fm.role = 'worker'
    and fm.status = 'removed'
    and fm.removed_reason = 'removed_by_owner';

  -- 2f. removed warisan — 22 baris yang dinonaktifkan sebelum migration 020,
  -- jadi removed_reason/removed_by/removed_at kosong total. actor_id sengaja
  -- null: kita TIDAK tahu apakah orangnya keluar sendiri atau dikeluarkan, dan
  -- menebak lebih buruk daripada mengakui data itu tidak tercatat.
  -- Predikatnya sengaja menampung nilai removed_reason tak dikenal juga, supaya
  -- setiap baris removed dijamin menghasilkan tepat satu event.
  insert into public.farm_access_events (farm_id, user_id, event, actor_id, reason, created_at)
  select fm.farm_id, fm.user_id, 'removed', null, null, coalesce(fm.updated_at, fm.created_at)
  from public.farm_members fm
  where fm.role = 'worker'
    and fm.status = 'removed'
    and (
      fm.removed_reason is null
      or fm.removed_reason not in ('left_by_worker', 'removed_by_owner')
    );
end $$;

-- ============ 3. Satu relasi pending/active per user ============
-- R-01. Sebelum ini yang menjaga hanya route guard di klien; RPC sendiri cuma
-- memeriksa kebun tujuan, sehingga pemanggilan langsung bisa membuat satu user
-- punya beberapa relasi sekaligus.

create unique index if not exists farm_members_one_active_relation_idx
on public.farm_members(user_id)
where status in ('pending', 'active');

-- ============ 4. Drop index duplikat ============
-- idx_farm_members_farm_user (migration 006) identik dengan unique index milik
-- constraint farm_members_unique_user_per_farm (migration 002): dua-duanya
-- btree pada (farm_id, user_id).

drop index if exists public.idx_farm_members_farm_user;

-- ============ 5. request_join_farm ============
-- Perubahan terhadap versi migration 020:
--   - cabang khusus pemilik kebun sendiri, dengan pesan tersendiri (R-11)
--   - guard relasi aktif jadi GLOBAL, bukan lagi hanya kebun tujuan (R-01)
--   - menulis event 'requested'

create or replace function public.request_join_farm(
  p_join_code text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_farm_id uuid;
  membership_id uuid;
begin
  if current_user_id is null then
    raise exception 'User is not authenticated';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = current_user_id
  ) then
    raise exception 'Profile must exist before joining a farm';
  end if;

  select id
  into target_farm_id
  from public.farms
  where join_code = upper(trim(p_join_code));

  if target_farm_id is null then
    raise exception 'Join code is invalid';
  end if;

  -- Diperiksa SEBELUM guard relasi aktif. Kalau urutannya dibalik, pemilik yang
  -- memasukkan kodenya sendiri akan menerima pesan "sudah punya pengajuan" yang
  -- salah sasaran.
  if exists (
    select 1
    from public.farm_members
    where farm_id = target_farm_id
      and user_id = current_user_id
      and role = 'owner'
  ) then
    raise exception 'Cannot join a farm you own';
  end if;

  if exists (
    select 1
    from public.farm_members
    where user_id = current_user_id
      and status in ('pending', 'active')
  ) then
    raise exception 'User already has a pending or active membership';
  end if;

  insert into public.farm_members (
    farm_id,
    user_id,
    role,
    status,
    joined_at
  )
  values (
    target_farm_id,
    current_user_id,
    'worker',
    'pending',
    null
  )
  on conflict (farm_id, user_id)
  do update set
    role = 'worker',
    status = 'pending',
    joined_at = null,
    removed_at = null,
    removed_by = null,
    removed_reason = null,
    updated_at = now()
  where public.farm_members.status in ('rejected', 'removed')
  returning id into membership_id;

  if membership_id is null then
    raise exception 'User already has a pending or active membership';
  end if;

  insert into public.farm_access_events (farm_id, user_id, event, actor_id)
  values (target_farm_id, current_user_id, 'requested', current_user_id);

  return membership_id;
exception
  when unique_violation then
    -- Dua permintaan paralel lolos guard di atas lalu bertabrakan di
    -- farm_members_one_active_relation_idx. Disamakan dengan pesan guard supaya
    -- detail constraint tidak bocor ke user.
    raise exception 'User already has a pending or active membership';
end;
$$;

-- ============ 6. get_current_user_access ============
-- Sebelumnya `order by coalesce(updated_at, created_at) desc limit 1` tanpa
-- memperhatikan status. Akibatnya pekerja aktif di kebun B yang punya baris
-- rejected lebih baru di kebun A akan dikembalikan sebagai "ditolak", dan
-- routeGuard melemparnya ke layar Pengajuan Ditolak tanpa jalan kembali.
-- Sekarang: prioritas status dulu (active -> pending -> sisanya), baru waktu.

create or replace function public.get_current_user_access()
returns table (
  membership_id uuid,
  farm_id uuid,
  user_id uuid,
  role public.member_role,
  status public.member_status,
  joined_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  removed_at timestamptz,
  removed_by uuid,
  removed_reason text,
  farm_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'User is not authenticated';
  end if;

  return query
  select
    fm.id as membership_id,
    fm.farm_id,
    fm.user_id,
    fm.role,
    fm.status,
    fm.joined_at,
    fm.created_at,
    fm.updated_at,
    fm.removed_at,
    fm.removed_by,
    fm.removed_reason,
    f.name as farm_name
  from public.farm_members fm
  left join public.farms f
    on f.id = fm.farm_id
  where fm.user_id = auth.uid()
  order by
    case fm.status
      when 'active' then 0
      when 'pending' then 1
      else 2
    end,
    coalesce(fm.updated_at, fm.created_at) desc
  limit 1;
end;
$$;

-- ============ 7. approve_worker ============
-- Sama seperti versi 020, ditambah penulisan event dalam transaksi yang sama.

create or replace function public.approve_worker(
  p_farm_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_farm_id uuid;
  target_user_id uuid;
begin
  select farm_id, user_id
  into target_farm_id, target_user_id
  from public.farm_members
  where id = p_farm_member_id
    and role = 'worker'
    and status = 'pending';

  if target_farm_id is null then
    raise exception 'Pending worker not found';
  end if;

  if not public.is_active_owner(target_farm_id, current_user_id) then
    raise exception 'Only active owners can approve workers';
  end if;

  update public.farm_members
  set status = 'active',
      joined_at = now(),
      removed_at = null,
      removed_by = null,
      removed_reason = null,
      updated_at = now()
  where id = p_farm_member_id;

  insert into public.farm_access_events (farm_id, user_id, event, actor_id)
  values (target_farm_id, target_user_id, 'approved', current_user_id);
end;
$$;

-- ============ 8. reject_worker ============
-- R-03: satu-satunya RPC keanggotaan yang tidak ikut diperbarui di migration
-- 020, sehingga penolakan tidak pernah mengisi removed_at/removed_by. Sekarang
-- disamakan dengan remove_worker, plus penulisan event.

create or replace function public.reject_worker(
  p_farm_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_farm_id uuid;
  target_user_id uuid;
begin
  select farm_id, user_id
  into target_farm_id, target_user_id
  from public.farm_members
  where id = p_farm_member_id
    and role = 'worker'
    and status = 'pending';

  if target_farm_id is null then
    raise exception 'Pending worker not found';
  end if;

  if not public.is_active_owner(target_farm_id, current_user_id) then
    raise exception 'Only active owners can reject workers';
  end if;

  update public.farm_members
  set status = 'rejected',
      joined_at = null,
      removed_at = now(),
      removed_by = current_user_id,
      removed_reason = 'rejected_by_owner',
      updated_at = now()
  where id = p_farm_member_id;

  insert into public.farm_access_events (farm_id, user_id, event, actor_id)
  values (target_farm_id, target_user_id, 'rejected', current_user_id);
end;
$$;

-- ============ 9. remove_worker ============

create or replace function public.remove_worker(
  p_farm_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_farm_id uuid;
  target_user_id uuid;
begin
  select farm_id, user_id
  into target_farm_id, target_user_id
  from public.farm_members
  where id = p_farm_member_id
    and role = 'worker'
    and status = 'active';

  if target_farm_id is null then
    raise exception 'Active worker not found';
  end if;

  if not public.is_active_owner(target_farm_id, current_user_id) then
    raise exception 'Only active owners can remove workers';
  end if;

  update public.farm_members
  set status = 'removed',
      removed_at = now(),
      removed_by = current_user_id,
      removed_reason = 'removed_by_owner',
      updated_at = now()
  where id = p_farm_member_id;

  insert into public.farm_access_events (farm_id, user_id, event, actor_id)
  values (target_farm_id, target_user_id, 'removed', current_user_id);
end;
$$;

-- ============ 10. leave_current_farm ============

create or replace function public.leave_current_farm(
  p_farm_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_membership_id uuid;
begin
  select id
  into target_membership_id
  from public.farm_members
  where farm_id = p_farm_id
    and user_id = current_user_id
    and role = 'worker'
    and status = 'active';

  if target_membership_id is null then
    raise exception 'Active worker membership not found';
  end if;

  update public.farm_members
  set status = 'removed',
      removed_at = now(),
      removed_by = current_user_id,
      removed_reason = 'left_by_worker',
      updated_at = now()
  where id = target_membership_id;

  insert into public.farm_access_events (farm_id, user_id, event, actor_id)
  values (p_farm_id, current_user_id, 'left', current_user_id);
end;
$$;

-- ============ 11. cancel_join_request (baru) ============
-- Tanpa parameter: hanya bekerja pada baris milik auth.uid() sendiri yang
-- berstatus pending. Partial unique index di bagian 3 menjamin paling banyak
-- ada satu baris seperti itu.
--
-- Barisnya DIHAPUS, bukan diberi status baru, supaya member_status tidak perlu
-- nilai enum tambahan yang tidak bisa dicabut. Jejaknya tetap ada di
-- farm_access_events.

create or replace function public.cancel_join_request()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_membership_id uuid;
  target_farm_id uuid;
begin
  if current_user_id is null then
    raise exception 'User is not authenticated';
  end if;

  select id, farm_id
  into target_membership_id, target_farm_id
  from public.farm_members
  where user_id = current_user_id
    and status = 'pending';

  if target_membership_id is null then
    raise exception 'Pending join request not found';
  end if;

  -- Urutan disengaja: event ditulis SEBELUM baris dihapus, karena farm_id yang
  -- dipakai event hanya hidup di baris itu. Membalik urutannya membuat event
  -- kehilangan kebun tujuannya.
  insert into public.farm_access_events (farm_id, user_id, event, actor_id)
  values (target_farm_id, current_user_id, 'cancelled', current_user_id);

  delete from public.farm_members
  where id = target_membership_id;
end;
$$;

-- ============ 12. Grant ============

revoke execute on function public.request_join_farm(text) from public, anon;
revoke execute on function public.get_current_user_access() from public, anon;
revoke execute on function public.approve_worker(uuid) from public, anon;
revoke execute on function public.reject_worker(uuid) from public, anon;
revoke execute on function public.remove_worker(uuid) from public, anon;
revoke execute on function public.leave_current_farm(uuid) from public, anon;
revoke execute on function public.cancel_join_request() from public, anon;

grant execute on function public.request_join_farm(text) to authenticated;
grant execute on function public.get_current_user_access() to authenticated;
grant execute on function public.approve_worker(uuid) to authenticated;
grant execute on function public.reject_worker(uuid) to authenticated;
grant execute on function public.remove_worker(uuid) to authenticated;
grant execute on function public.leave_current_farm(uuid) to authenticated;
grant execute on function public.cancel_join_request() to authenticated;

commit;
