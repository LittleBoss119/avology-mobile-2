-- 038: cancel_join_request menyapu baris stale sekalian
-- Satu perubahan saja: badan fungsi cancel_join_request. Tidak ada perubahan
-- skema, tidak ada fungsi lain yang disentuh.
--
-- Sebelumnya fungsi ini hanya menghapus baris pending. Akibatnya baris
-- rejected/removed lama yang menganggur langsung naik jadi satu-satunya baris
-- dan get_current_user_access mengembalikannya — user yang membatalkan
-- pengajuan mendarat di layar penolakan untuk kebun yang sudah lama tidak ada
-- urusannya. Pembersihannya dulu diserahkan ke panggilan kedua
-- (acknowledge_access_notice) dari sisi klien.
--
-- Kenapa digabung ke satu fungsi: dua panggilan RPC berurutan dari klien TIDAK
-- atomik. Pengguna aplikasi ini sering berada di koneksi buruk, dan panggilan
-- kedua yang gagal meninggalkan user persis di kondisi yang mau dihindari.
--
-- Konsekuensi yang sudah diterima: pemberitahuan stale yang belum sempat dibaca
-- ikut hilang. Itu boleh, karena riwayatnya utuh di farm_access_events sejak
-- migration 036.
--
-- acknowledge_access_notice (migration 037) SENGAJA TIDAK DISENTUH — ia tetap
-- punya intent sendiri untuk layar pemberitahuan, dipanggil saat user menutup
-- pemberitahuan tanpa ada pengajuan yang dibatalkan.
--
-- CATATAN UNTUK PEMBACA MIGRATION 037: komentar di bagian 2 file itu menyebut
-- bahwa acknowledge_access_notice adalah yang menyelesaikan masalah baris stale
-- setelah pembatalan. Sejak migration ini, pembatalan menyelesaikannya sendiri.
-- File 037 sengaja tidak diedit karena sudah dijalankan — ledger migration tidak
-- ditulis ulang.
--
-- Perilaku event tidak berubah: tetap satu event 'cancelled' untuk kebun yang
-- dibatalkan, dan tetap TIDAK ada event untuk baris stale yang tersapu. Sama
-- seperti acknowledge_access_notice — menutup pemberitahuan adalah perubahan
-- state tampilan, bukan peristiwa akses. Check constraint
-- farm_access_events_event_check tidak perlu disentuh.

begin;

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
  -- dipakai event hanya hidup di baris itu. Satu event saja, untuk kebun yang
  -- pengajuannya dibatalkan.
  insert into public.farm_access_events (farm_id, user_id, event, actor_id)
  values (target_farm_id, current_user_id, 'cancelled', current_user_id);

  -- Menyapu baris pending yang dibatalkan SEKALIGUS seluruh baris stale milik
  -- pemanggil, dalam transaksi yang sama. 'active' sengaja tidak masuk daftar:
  -- partial unique index farm_members_one_active_relation_idx sudah menjamin
  -- pemanggil yang punya baris pending tidak mungkin punya baris active, dan
  -- menyebutkan status secara eksplisit membuat maksudnya terbaca.
  delete from public.farm_members
  where user_id = current_user_id
    and status in ('pending', 'rejected', 'removed');
end;
$$;

revoke execute on function public.cancel_join_request() from public, anon;
grant execute on function public.cancel_join_request() to authenticated;

commit;
