-- 044_reconcile_ledger_drift.sql
--
-- MIGRASI REKONSILIASI. Tidak ada fitur baru di sini.
--
-- Tujuannya menyamakan kembali isi database dengan isi folder migrasi setelah
-- ditemukan dua penyimpangan yang tidak tercatat di ledger.
--
-- ---------------------------------------------------------------------------
-- PENYIMPANGAN 1 -- fungsi hilang tanpa jejak
--
--   supabase_migrations.schema_migrations mencatat migrasi 016 SUDAH terpasang,
--   tetapi public.rollback_completed_task_activity TIDAK ADA di pg_proc
--   (diverifikasi dua kali lewat query berbeda di database produksi).
--
--   Tidak ada satu pun file di supabase/migrations/ yang men-drop fungsi itu.
--   Sudah dicari menyeluruh: 28 pernyataan `drop function` di seluruh folder,
--   tidak satu pun menyebut namanya. Loop drop dinamis di migrasi 034 juga
--   hanya menyasar update_operational_report_status dan
--   create_task_from_operational_report.
--
--   Kesimpulan: fungsi ini dihapus DI LUAR ledger. Dugaan terkuat adalah saat
--   migrasi 031 diterapkan manual lewat SQL Editor -- 031 memang berisi
--   serangkaian `drop function` untuk RPC deprecated, dan catatan di kepala
--   file 031 sendiri menyatakan perubahannya "SUDAH diterapkan ke DB live lewat
--   SQL Editor". Satu baris drop yang tidak ikut tersalin ke file adalah
--   penjelasan paling sederhana.
--
--   DAMPAK SELAMA FUNGSI HILANG:
--   src/services/careTaskService.ts memanggilnya lewat supabase.rpc() pada
--   jalur rollback ketika upload foto bukti GAGAL untuk tugas yang mewajibkan
--   foto. Karena fungsinya tidak ada, RPC selalu gagal, dan klien menelan
--   kegagalan itu jadi pesan generik "Status tugas perlu diperiksa kembali."
--   Akibatnya tugas ber-requires_photo bisa berakhir 'completed' TANPA bukti
--   foto, dan tidak ada yang tahu. Itu sebabnya pemulihan ini didahulukan.
--
-- ---------------------------------------------------------------------------
-- PENYIMPANGAN 2 -- fungsi yatim tertinggal
--
--   public.validate_manual_care_record() masih ada di pg_proc padahal tabel
--   public.manual_care_records sudah tidak ada
--   (to_regclass('public.manual_care_records') = null).
--
--   Fungsi itu dibuat migrasi 020 sebagai trigger BEFORE INSERT OR UPDATE pada
--   manual_care_records. Migrasi 031 men-drop tabelnya (yang otomatis ikut
--   membuang trigger-nya) tetapi TIDAK pernah men-drop fungsi triggernya.
--   Kali ini penyebabnya bukan eksekusi manual -- file 031 memang tidak
--   menyertakan baris itu. Jadi ini kelalaian di file, bukan drift.
--
-- ---------------------------------------------------------------------------
-- CATATAN UNTUK PEMBACA BERIKUTNYA
--
--   Nomor 017 dan 042 memang tidak pernah ada. Bukan hilang, bukan drift --
--   jangan mencoba mengisinya.
--
--   Pelajaran operasionalnya: jangan menerapkan DDL lewat SQL Editor lalu
--   menyalinnya ke file migrasi belakangan. Yang tersalin belum tentu lengkap,
--   dan ledger jadi berbohong tanpa ada yang sadar sampai ada yang mengaudit
--   pg_proc satu per satu.

-- ---------------------------------------------------------------------------
-- 1. Pulihkan rollback_completed_task_activity
--
-- Definisi di bawah adalah pemulihan SETIA dari migrasi 016 (baris 453-504).
-- Sudah diverifikasi ulang terhadap skema sekarang, bukan disalin buta:
--
--   * Tabel & kolom yang dirujuk semuanya masih ada -- care_activities
--     (id, farm_id, care_task_id, performed_by, status, performed_at) dan
--     care_tasks (id, assigned_to, status, updated_at).
--   * Fungsi bantu public.is_active_worker(uuid, uuid) masih hidup.
--   * Tipe public.task_status dan public.activity_status masih hidup, jadi
--     cast (ca.status::text)::public.task_status tetap sah.
--   * Kolom baru dari migrasi 040/041 (rantai jadwal) ada di care_schedules,
--     bukan di dua tabel yang disentuh fungsi ini -- tidak bersinggungan.
--   * Kolom baru dari migrasi 043 (produk_jumlah, produk_satuan, edited_at)
--     semuanya nullable dan tidak disebut fungsi ini. DELETE tidak peduli
--     kolom tambahan, jadi tidak ada yang perlu disesuaikan.
--
-- ADA DUA PERUBAHAN dari versi 016. Selain itu semuanya identik, termasuk
-- pesan exception berbahasa Inggris yang SENGAJA dibiarkan apa adanya supaya
-- penanganan error di klien tidak bergeser.
--
--   PERUBAHAN 1 (kosmetik) -- `set search_path = public` ditulis sebagai
--   `set search_path to 'public'`. Keduanya identik secara semantik; bentuk
--   ini dipakai supaya seragam dengan migrasi 043.
--
--   PERUBAHAN 2 (perilaku) -- query pemulihan status di bawah diurutkan
--   `order by ca.performed_at desc, ca.id desc`, bukan lagi hanya
--   `order by ca.performed_at desc` seperti di 016.
--
--     Alasannya dua, dan keduanya berasal dari migrasi 043:
--
--       a. Konvensi "baris terakhir per tugas" sudah diseragamkan di sana.
--          update_task_realization memakai `order by performed_at desc,
--          id desc` dan menolak mengedit baris yang bukan terakhir. Kalau
--          fungsi ini memakai definisi "terakhir" yang berbeda, dua jalur
--          bisa menunjuk baris yang berlainan untuk tugas yang sama.
--
--       b. Urutan ini cocok persis dengan index yang dibuat 043,
--          idx_care_activities_task_latest
--          (care_task_id, performed_at desc, id desc), sehingga query di
--          bawah bisa dilayani index tanpa sort tambahan.
--
--     Tanpa tie-breaker, dua baris ber-performed_at identik membuat "baris
--     terakhir" tidak deterministik -- dan di fungsi ini akibatnya konkret:
--     care_tasks.status dipulihkan dari baris yang salah.
--
-- Dua interaksi yang SUDAH diperiksa dan memang aman:
--
--   a. DELETE di bawah membangunkan trigger zz_cleanup_orphan_recurring_
--      schedule_trigger (AFTER DELETE, migrasi 041). Itu memang disengaja --
--      041 dibangun persis untuk fungsi ini, supaya penerus rantai yang
--      terlanjur dibuat ikut dibatalkan. Penerus yang dihapus trigger itu
--      milik JADWAL LAIN, jadi tidak bentrok dengan update care_tasks di
--      baris terakhir fungsi ini.
--
--   b. Migrasi 043 mencabut grant DELETE pada care_activities dari anon dan
--      authenticated. Fungsi ini SECURITY DEFINER sehingga berjalan sebagai
--      pemilik tabel dan tetap bisa menghapus. Justru setelah 043, fungsi ini
--      adalah SATU-SATUNYA jalan sah menghapus baris realisasi.
-- ---------------------------------------------------------------------------

create or replace function public.rollback_completed_task_activity(
  p_activity_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  current_user_id uuid := auth.uid();
  target_activity record;
  previous_status public.task_status;
begin
  select ca.id, ca.farm_id, ca.care_task_id, ca.performed_by, ca.status, ct.assigned_to
  into target_activity
  from public.care_activities ca
  join public.care_tasks ct on ct.id = ca.care_task_id
  where ca.id = p_activity_id;

  if target_activity.id is null then
    raise exception 'Activity not found';
  end if;

  if target_activity.status <> 'completed' then
    raise exception 'Only completed activities can be rolled back';
  end if;

  if target_activity.performed_by is distinct from current_user_id
    or target_activity.assigned_to is distinct from current_user_id then
    raise exception 'Only the assigned worker can rollback this activity';
  end if;

  if not public.is_active_worker(target_activity.farm_id, current_user_id) then
    raise exception 'Only active workers can rollback task activities';
  end if;

  delete from public.care_activities
  where id = target_activity.id;

  select (ca.status::text)::public.task_status
  into previous_status
  from public.care_activities ca
  where ca.care_task_id = target_activity.care_task_id
  order by ca.performed_at desc, ca.id desc
  limit 1;

  update public.care_tasks
  set status = coalesce(previous_status, 'pending'::public.task_status),
      updated_at = now()
  where id = target_activity.care_task_id;
end;
$function$;

-- Grant ditulis eksplisit mengikuti pola migrasi 043. Ini bukan sekadar
-- formalitas: fungsinya sempat lenyap, jadi hak aksesnya juga ikut lenyap dan
-- harus dipasang ulang. Tanpa dua baris ini klien kena "permission denied".
revoke execute on function public.rollback_completed_task_activity(uuid)
  from public, anon;

grant execute on function public.rollback_completed_task_activity(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Buang fungsi trigger yatim
--
-- SENGAJA TANPA CASCADE. Kalau ternyata masih ada objek lain yang bergantung
-- pada fungsi ini, migrasi ini HARUS gagal keras supaya ketahuan. Menghapus
-- dependennya diam-diam justru menambah drift baru -- persis penyakit yang
-- sedang diobati file ini.
--
-- Kalau migrasi ini gagal di baris berikut, JANGAN menambahkan cascade.
-- Jalankan dulu query ini untuk melihat siapa yang masih memakainya:
--
--   select tgname, tgrelid::regclass as tabel
--   from pg_trigger
--   where tgfoid = 'public.validate_manual_care_record()'::regprocedure;
-- ---------------------------------------------------------------------------

drop function if exists public.validate_manual_care_record();

-- ---------------------------------------------------------------------------
-- 3. Muat ulang cache schema PostgREST
--
-- rollback_completed_task_activity dipanggil klien lewat supabase.rpc(),
-- sehingga PostgREST harus tahu fungsinya sudah ada lagi.
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- VERIFIKASI SETELAH MENJALANKAN (jalankan manual, jangan diasumsikan)
--
-- 1. Fungsi sudah kembali, TEPAT SATU baris:
--
--      select p.oid::regprocedure
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public'
--        and p.proname = 'rollback_completed_task_activity';
--
-- 2. Grant-nya menempel -- `authenticated` wajib muncul:
--
--      select grantee, privilege_type
--      from information_schema.routine_privileges
--      where routine_name = 'rollback_completed_task_activity';
--
-- 3. Fungsi yatim sudah hilang -- harus 0 baris:
--
--      select p.oid::regprocedure
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public'
--        and p.proname = 'validate_manual_care_record';
--
-- 4. Jumlah fungsi di public: 67 sebelum migrasi ini, harus tetap 67 sesudahnya
--    (satu masuk, satu keluar):
--
--      select count(*)
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public';
-- ---------------------------------------------------------------------------
