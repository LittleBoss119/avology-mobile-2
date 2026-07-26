-- 033_restore_farm_actor_display_profiles.sql
-- Fix bug nama pencatat (B-2b, Iterasi B).
--
-- MASALAH:
--   historyService/memberService memanggil RPC get_farm_actor_display_profiles
--   untuk me-resolve nama pencatat di riwayat pohon. RPC ini SEHARUSNYA ada sejak
--   migration 011, TAPI live DB tidak memilikinya (dikonfirmasi via SQL Editor:
--   hanya get_member_basic_profiles yang eksis). Ini DRIFT DB<->repo — bukan drop
--   yang tercatat di migration mana pun (031 cleanup Iterasi A tidak menyentuhnya).
--
--   Akibatnya: setiap panggilan RPC utama gagal -> kode jatuh ke fallback
--   get_member_basic_profiles yang OWNER-ONLY (raise exception kalau bukan owner).
--   -> Owner viewer: fallback lolos, nama muncul.
--   -> Worker viewer: fallback ditolak, nama aktor lain jadi null -> "Anggota kebun".
--   Terbukti via log runtime [B2B]: owner actorName terisi, worker actorName null.
--
-- PERBAIKAN:
--   Buat (ulang) get_farm_actor_display_profiles PERSIS seperti definisi di
--   migration 011 -- signature & kolom sudah cocok dengan yang diharapkan klien
--   (mapFarmActorDisplayProfile: user_id/full_name/role/status).
--   Guard-nya is_active_farm_member (owner ATAU worker), BUKAN owner-only,
--   sehingga worker pun bisa me-resolve nama sesama anggota kebun.
--
-- CATATAN AUDITABILITY (untuk skripsi):
--   Ini memulihkan drift, bukan menambah fitur baru. Definisi disalin dari
--   migration 011 (create_access_and_actor_display_rpc). Dicatat juga di
--   keputusan_desain.md sebagai temuan drift DB<->repo.
--
-- Fakta terverifikasi sebelum migration ini ditulis (via SQL Editor):
--   - get_farm_actor_display_profiles TIDAK ADA di public (query pg_proc: nihil).
--   - get_member_basic_profiles ADA dan owner-only (is_active_owner guard).
--   - Klien mengharapkan RETURNS TABLE(user_id uuid, full_name text,
--     role member_role, status member_status), param tunggal p_farm_id uuid.
--   - Tipe member_role & member_status ada (dipakai di tabel farm_members).

begin;

-- Drop dulu bila entah bagaimana ada versi dengan signature berbeda (aman:
-- IF EXISTS). Menghindari bentrok/overload seperti pelajaran migration 024.
drop function if exists public.get_farm_actor_display_profiles(uuid);

create or replace function public.get_farm_actor_display_profiles(p_farm_id uuid)
returns table (
  user_id uuid,
  full_name text,
  role public.member_role,
  status public.member_status
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Guard: anggota AKTIF mana pun (owner ATAU worker) boleh me-resolve nama
  -- sesama anggota kebun. Ini kunci perbaikan -- worker di lapangan berhak
  -- melihat siapa yang mencatat.
  if not public.is_active_farm_member(p_farm_id, auth.uid()) then
    raise exception 'Only active farm members can view actor display profiles';
  end if;

  return query
  select
    p.id as user_id,
    p.full_name,
    fm.role,
    fm.status
  from public.farm_members fm
  join public.profiles p
    on p.id = fm.user_id
  where fm.farm_id = p_farm_id
    and fm.status in ('pending', 'active', 'rejected', 'removed')
  order by fm.created_at desc;
end;
$function$;

grant execute on function public.get_farm_actor_display_profiles(uuid) to authenticated;

commit;

-- ============================================================
-- VERIFIKASI SETELAH MENJALANKAN (jalankan manual)
-- ============================================================
--
-- a. Fungsi ada dengan signature benar (harus TEPAT SATU baris):
--      select p.proname, pg_get_function_arguments(p.oid) as args,
--             pg_get_function_result(p.oid) as returns
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public' and p.proname = 'get_farm_actor_display_profiles';
--    -> args: p_farm_id uuid
--    -> returns: TABLE(user_id uuid, full_name text, role member_role, status member_status)
--
-- b. Grant authenticated ada:
--      select grantee, privilege_type
--      from information_schema.routine_privileges
--      where routine_name = 'get_farm_actor_display_profiles';
--    -> harus ada baris grantee 'authenticated' privilege 'EXECUTE'.
--
-- c. is_active_farm_member ADA (guard bergantung padanya -- kalau tidak ada,
--    fungsi akan error saat dipanggil):
--      select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public' and proname = 'is_active_farm_member';
--    -> harus muncul. Kalau TIDAK ada, STOP & kabari -- guard perlu fungsi lain.
