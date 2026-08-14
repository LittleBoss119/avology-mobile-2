-- 052_lock_schedule_only_on_completed_activity.sql
--
-- Jadwal hanya terkunci oleh hasil kerja yang BENAR-BENAR terjadi.
--
-- MASALAHNYA: cancel_care_schedule (020:825) menolak pembatalan begitu ada
-- baris care_activities APA PUN yang menempel pada tugas jadwal itu. Sejak
-- penundaan ikut menulis baris aktivitas, satu kali pekerja menekan "Tunda"
-- sudah cukup untuk mengunci jadwalnya selamanya.
--
-- Kombinasinya dengan aturan kembar di sisi aplikasi menghasilkan jalan buntu
-- yang sudah dikonfirmasi di perangkat: jadwal yang tugasnya ditunda tidak bisa
-- diedit DAN tidak bisa dibatalkan. Owner tidak punya satu pun aksi tersisa
-- untuk pekerjaan yang justru belum dikerjakan.
--
-- ATURAN BARUNYA: kunci hanya kalau ada aktivitas ber-status 'completed'.
--
-- Alasannya bukan kemudahan, tapi apa yang sebenarnya dilindungi penguncian
-- ini. Yang dilindungi adalah RIWAYAT: begitu pekerjaan benar-benar dilakukan,
-- mengedit jadwalnya akan membuat catatan lama berbicara tentang pekerjaan
-- yang tidak pernah diperintahkan seperti itu. Penundaan tidak membawa risiko
-- itu sama sekali -- tidak ada pekerjaan yang terjadi, tidak ada takaran bahan
-- yang tercatat, tidak ada pohon yang tertaut (050 hanya menautkan pohon pada
-- jalur complete_task), dan tidak ada foto bukti. Yang ada hanya pernyataan
-- "belum saya kerjakan, rencananya tanggal sekian".
--
-- PRASYARAT: 046-051 sudah dijalankan dan terverifikasi.
--
-- LINGKUP: migrasi ini HANYA menyentuh cancel_care_schedule. Dua tempat lain
-- yang memuat aturan kembar hidup di sisi aplikasi dan diubah pada commit yang
-- sama:
--   * careScheduleService.ts -- getScheduleEditEligibilityFromDetail
--   * app/(owner)/owner/schedules/[scheduleId].tsx -- scheduleHasWorkResult,
--     yang mengunci tombol "Edit jadwal" DAN "Batalkan jadwal" di bottom sheet
--     "Kelola jadwal". Tempat ketiga ini tidak terdaftar di instruksi dan
--     justru ia yang menentukan apa yang terlihat di perangkat: tanpa ikut
--     diubah, kedua tombol tetap mati dan pelonggaran di sini tidak pernah
--     terpakai.
--
-- YANG SENGAJA TIDAK DISENTUH:
--   * stop_care_schedule_repeat (041:406) -- sudah diperiksa, memang tidak
--     punya penjaga aktivitas sama sekali, dan itu disengaja: menghentikan
--     rantai justru paling masuk akal saat jadwalnya sudah dikerjakan.
--   * Policy UPDATE care_schedules (007:251) -- hanya menguji kepemilikan
--     owner aktif, tidak pernah menyebut aktivitas.
--   * update_task_realization, postpone_task, dan seluruh 048/049/051.

begin;

-- ===========================================================================
-- 1. cancel_care_schedule -- penjaga menyempit ke aktivitas 'completed'
--
-- Signature TETAP (uuid, text), jadi `create or replace` cukup dan grant dari
-- 020:1296 tidak perlu ditulis ulang -- tidak ada DROP FUNCTION di migrasi ini.
-- Badan 020:795-842 dipertahankan VERBATIM kecuali satu baris pada penjaga.
--
-- Pesan errornya SENGAJA tidak diubah. 'task realization exists' justru
-- menjadi lebih tepat setelah perubahan ini, bukan kurang tepat: sekarang ia
-- benar-benar hanya berbunyi ketika ada realisasi. Membiarkannya utuh juga
-- menjaga penanganan error di klien tidak bergeser.
--
-- INTERAKSI DENGAN 051 (dan ini memenuhi syarat 4 tanpa baris tambahan):
-- penjaga ini tidak menyaring tugas yang dilepas, dan memang tidak perlu.
-- release_open_tasks_for_member hanya melepas tugas ber-status 'pending' atau
-- 'postponed', sehingga tugas terlepas TIDAK PERNAH punya aktivitas
-- 'completed'. Kalau ia punya baris aktivitas, isinya pasti 'postponed' --
-- dan sejak migrasi ini baris seperti itu tidak lagi mengunci apa pun. Jadwal
-- yang tugasnya dilepas karena itu tetap bisa dibatalkan owner.
-- ===========================================================================

create or replace function public.cancel_care_schedule(
  p_schedule_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_schedule record;
begin
  select id, farm_id, is_cancelled
  into target_schedule
  from public.care_schedules
  where id = p_schedule_id;

  if target_schedule.id is null then
    raise exception 'Care schedule not found';
  end if;

  if not public.is_active_owner(target_schedule.farm_id, current_user_id) then
    raise exception 'Only active owners can cancel care schedules';
  end if;

  if target_schedule.is_cancelled then
    raise exception 'Care schedule is already cancelled';
  end if;

  if exists (
    select 1
    from public.care_tasks ct
    join public.care_activities ca
      on ca.care_task_id = ct.id
    where ct.care_schedule_id = p_schedule_id
      -- DIPERSEMPIT: dulu baris aktivitas APA PUN mengunci pembatalan,
      -- termasuk penundaan. Penundaan bukan realisasi -- tidak ada pekerjaan
      -- yang terjadi dan tidak ada riwayat yang bisa dipalsukan dengan
      -- membatalkan jadwalnya. Lihat kepala file.
      and ca.status = 'completed'
  ) then
    raise exception 'Care schedule cannot be cancelled after task realization exists';
  end if;

  update public.care_schedules
  set is_cancelled = true,
      cancelled_at = now(),
      cancelled_by = current_user_id,
      cancel_reason = nullif(trim(p_reason), ''),
      updated_at = now()
  where id = p_schedule_id;
end;
$$;

-- ===========================================================================
-- 2. Muat ulang cache schema PostgREST
--
-- Signature tidak berubah, hanya definisinya. Reload murah dan konsisten
-- dengan seluruh migrasi sebelumnya.
-- ===========================================================================

notify pgrst, 'reload schema';

commit;

-- ===========================================================================
-- VERIFIKASI SETELAH MENJALANKAN (jalankan manual, jangan diasumsikan)
--
-- 1. Fungsi TIDAK ter-overload -- tepat satu baris, signature sama seperti
--    sebelum migrasi ini:
--
--      select p.oid::regprocedure
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public' and p.proname = 'cancel_care_schedule';
--
--    -> harus: cancel_care_schedule(uuid, text)
--
-- 2. Grant masih menempel (tidak ada DROP FUNCTION, jadi seharusnya utuh):
--
--      select grantee, privilege_type
--      from information_schema.routine_privileges
--      where routine_name = 'cancel_care_schedule';
--
--    -> `authenticated` wajib muncul.
--
-- 3. Penjaga benar-benar tertulis ulang, bukan versi lama yang bertahan:
--
--      select pg_get_functiondef(p.oid)
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public' and p.proname = 'cancel_care_schedule';
--
--    -> definisinya WAJIB memuat `ca.status = 'completed'`. Kalau tidak, STOP.
--
-- 4. ALUR NYATA jalan buntu yang jadi sebab migrasi ini. Lewat aplikasi:
--      a. Buat jadwal, tugaskan ke pekerja.
--      b. Sebagai pekerja: TUNDA tugas itu (wajib bertanggal sejak 049).
--      c. Sebagai owner: buka detail jadwal -> "Kelola jadwal".
--      -> "Edit jadwal" dan "Batalkan jadwal" HARUS aktif, dan kalimat
--         "Jadwal sudah punya hasil kerja..." TIDAK boleh muncul.
--      d. Batalkan jadwalnya. -> harus BERHASIL.
--         Sebelum migrasi ini pasti gagal dengan 'cannot be cancelled after
--         task realization exists'.
--
-- 5. Penguncian yang SAH tidak ikut longgar -- ini pagar yang tidak boleh
--    jebol. Selesaikan sebuah tugas (bukan menunda), lalu sebagai owner coba
--    batalkan jadwalnya.
--      -> harus TETAP gagal dengan pesan yang sama persis seperti dulu, dan
--         kedua tombol di "Kelola jadwal" harus MATI dengan kalimat kunci.
--
-- 6. Tugas yang ditunda LALU diselesaikan tetap mengunci. Tunda dulu, lalu
--    selesaikan tugas yang sama, lalu coba batalkan jadwalnya.
--      -> harus gagal. Baris 'postponed' dan 'completed' hidup berdampingan di
--         log (model 043), dan keberadaan yang 'completed' sudah cukup.
--
-- 7. INTERAKSI 049 -- perilaku ini baru benar-benar bisa dijalankan lewat
--    aplikasi SETELAH migrasi ini, karena sebelumnya jadwal dengan tugas
--    tertunda selalu terkunci sehingga layar Edit tidak pernah terbuka:
--      a. Tunda tugas ke tanggal X.
--      b. Sebagai owner: edit jadwal, ubah HANYA judul/instruksi, JANGAN
--         sentuh tanggal jadwal. Simpan.
--      -> care_tasks.due_date WAJIB tetap X. Kalau ia melompat kembali ke
--         care_schedules.scheduled_date, penjaga 049 bocor. STOP.
--
--         select t.due_date, s.scheduled_date
--         from public.care_tasks t
--         join public.care_schedules s on s.id = t.care_schedule_id
--         where t.id = '<task uuid>';
--
--      c. Ulangi, tapi kali ini UBAH tanggal jadwalnya.
--      -> due_date sekarang HARUS ikut pindah ke tanggal baru. Itu
--         penjadwalan ulang yang disengaja owner dan memang menang atas
--         penundaan pekerja.
--
-- 8. INTERAKSI 051. Buat jadwal, tugaskan, keluarkan pekerjanya (tugas dilepas),
--    lalu sebagai owner buka "Kelola jadwal".
--      -> "Edit jadwal" dan "Batalkan jadwal" harus aktif, dan pembatalannya
--         berhasil. Uji juga varian yang tugasnya SUDAH DITUNDA sebelum
--         pekerjanya keluar -- di situ ada baris aktivitas 'postponed' milik
--         tugas terlepas, kombinasi yang paling mungkin lolos dari perhatian.
-- ===========================================================================
