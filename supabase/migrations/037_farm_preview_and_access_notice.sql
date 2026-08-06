-- 037: pratinjau kode kebun + penutupan pemberitahuan akses (Fase 2)
-- Rujukan temuan: docs/audit-relasi-kebun.md Bagian 4 (G1) dan Bagian 7 (R-05, R-12).
-- Berdiri di atas migration 036 (farm_access_events, guard global, cancel_join_request).
--
-- - RPC preview_farm_by_join_code: validasi kode + pratinjau, tanpa efek samping
-- - RPC acknowledge_access_notice: menutup pemberitahuan rejected/removed
-- - RPC get_farm_access_events: sumber data layar "Riwayat akses" sisi pemilik
--
-- CATATAN TIPE: migration ini tidak menambah nilai apa pun ke enum mana pun dan
-- tidak menyentuh check constraint farm_access_events_event_check. Lihat alasan
-- di bagian 2 — menutup pemberitahuan sengaja BUKAN peristiwa akses.

begin;

-- ============ 1. preview_farm_by_join_code ============
-- Langkah pertama dari alur gabung dua langkah: user mengetik kode, melihat
-- kebun apa yang dituju, baru menekan "Ajukan gabung".
--
-- TANPA EFEK SAMPING. Tidak menulis farm_access_events, tidak menulis baris apa
-- pun. Percobaan melihat pratinjau bukan peristiwa akses, dan mencatatnya cuma
-- membuat riwayat berisik.
--
-- KOLOM YANG DIKEMBALIKAN SENGAJA CUMA TIGA. Ini fungsi DEFINER yang menembus
-- RLS dan bisa dipanggil siapa pun yang login dengan kode tebakan, jadi setiap
-- kolom tambahan adalah kebocoran. Yang TIDAK boleh ikut keluar: farms.id,
-- join_code, created_by, area_size, jumlah anggota, dan nomor HP siapa pun.
-- Pengajuan tetap dikirim memakai KODE lewat request_join_farm, bukan farm_id,
-- supaya fungsi pengajuan tidak bisa dipakai menebak UUID kebun.
--
-- GUARD-NYA IDENTIK DENGAN request_join_farm (migration 036), pesan exception
-- sama persis dan urutan pemeriksaannya sama. Alasannya: user tidak boleh
-- pernah diperlihatkan pratinjau kebun yang ternyata tidak bisa dia ajukan.
-- Kalau guard-nya berbeda, langkah kedua bisa gagal setelah langkah pertama
-- berhasil — bentuk kegagalan yang paling membingungkan untuk pengguna yang
-- tidak akrab teknologi.

create or replace function public.preview_farm_by_join_code(
  p_join_code text
)
returns table (
  farm_name text,
  farm_location text,
  owner_name text
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  current_user_id uuid := auth.uid();
  target_farm_id uuid;
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

  return query
  select
    f.name as farm_name,
    f.location as farm_location,
    p.full_name as owner_name
  from public.farms f
  left join public.farm_members fm
    on fm.farm_id = f.id
   and fm.role = 'owner'
   and fm.status = 'active'
  left join public.profiles p
    on p.id = fm.user_id
  where f.id = target_farm_id;
end;
$$;

-- ============ 2. acknowledge_access_notice ============
-- Menutup pemberitahuan penolakan / penonaktifan milik pemanggil sendiri.
--
-- TIDAK MENULIS EVENT. Menerima pemberitahuan adalah perubahan state tampilan,
-- bukan peristiwa akses — riwayatnya sudah lengkap tercatat di
-- farm_access_events saat penolakan/penonaktifan terjadi. Konsekuensi yang
-- disengaja: check constraint farm_access_events_event_check tidak perlu
-- disentuh sama sekali oleh migration ini.
--
-- BARIS DIHAPUS, BUKAN DIBERI PENANDA. Baris rejected/removed di farm_members
-- adalah pemberitahuan sekali pakai, tapi selama ini disimpan selamanya seolah
-- status permanen. Sejak migration 036 riwayatnya aman di farm_access_events,
-- jadi barisnya tidak perlu bertahan. Konsisten dengan cancel_join_request yang
-- juga menghapus barisnya.
--
-- Masalah yang ini selesaikan: setelah pembatalan menghapus baris pending,
-- baris rejected lama yang menganggur akan naik jadi pemenang di
-- get_current_user_access dan melempar user ke layar penolakan untuk kebun yang
-- sudah lama tidak ada urusannya.
--
-- MENGHAPUS SELURUH baris rejected/removed milik pemanggil sekali panggil, bukan
-- satu baris saja, supaya tidak ada baris stale yang tersisa untuk menyergap di
-- kemudian hari.
--
-- Cabang `on conflict do update ... where status in ('rejected','removed')` di
-- request_join_farm (migration 036) TETAP DIPERTAHANKAN: baris yang belum
-- di-acknowledge masih mungkin ada, dan mereka tetap harus bisa ditimpa jadi
-- pending saat orangnya mengajukan ulang.

create or replace function public.acknowledge_access_notice()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  current_user_id uuid := auth.uid();
  deleted_count integer;
begin
  if current_user_id is null then
    raise exception 'User is not authenticated';
  end if;

  delete from public.farm_members
  where user_id = current_user_id
    and status in ('rejected', 'removed');

  get diagnostics deleted_count = row_count;

  if deleted_count = 0 then
    raise exception 'Access notice not found';
  end if;
end;
$$;

-- ============ 3. get_farm_access_events ============
-- Sumber data layar "Riwayat akses" sisi pemilik.
--
-- Pakai RPC alih-alih query langsung karena layar butuh nama dari profiles,
-- sedangkan policy profiles (can_view_profile, migration 007) hanya
-- mengizinkan seseorang membaca profilnya SENDIRI. Query langsung akan
-- menghasilkan nama kosong pada setiap baris riwayat. Guard-nya mengikuti pola
-- get_pending_workers di migration 008.
--
-- actor_name null berarti pelakunya memang tidak pernah tercatat — 22 event
-- removed warisan dari sebelum migration 020. Layar tidak boleh menebak.

create or replace function public.get_farm_access_events(
  p_farm_id uuid
)
returns table (
  id uuid,
  user_id uuid,
  full_name text,
  event text,
  actor_id uuid,
  actor_name text,
  reason text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_active_owner(p_farm_id, auth.uid()) then
    raise exception 'Only active owners can view farm access events';
  end if;

  return query
  select
    e.id,
    e.user_id,
    subject.full_name,
    e.event,
    e.actor_id,
    actor.full_name as actor_name,
    e.reason,
    e.created_at
  from public.farm_access_events e
  join public.profiles subject
    on subject.id = e.user_id
  left join public.profiles actor
    on actor.id = e.actor_id
  where e.farm_id = p_farm_id
  order by e.created_at desc;
end;
$$;

-- ============ 4. Grant ============

revoke execute on function public.preview_farm_by_join_code(text) from public, anon;
revoke execute on function public.acknowledge_access_notice() from public, anon;
revoke execute on function public.get_farm_access_events(uuid) from public, anon;

grant execute on function public.preview_farm_by_join_code(text) to authenticated;
grant execute on function public.acknowledge_access_notice() to authenticated;
grant execute on function public.get_farm_access_events(uuid) to authenticated;

commit;
