-- 040_add_recurring_schedule_columns.sql
--
-- Menambahkan dukungan jadwal berulang pada care_schedules.
-- Murni aditif: tidak menyentuh satu baris pun yang sudah ada, tidak
-- mengubah RPC, tidak mengubah RLS. Aman dijalankan kapan saja.
--
-- Model rantai (chain):
--   - Satu rantai = satu series_id.
--   - Dalam satu rantai hanya boleh ada SATU jadwal terbuka pada satu waktu.
--   - Jadwal berikutnya dibuat oleh trigger (migrasi 041) saat tugas dari
--     jadwal sekarang diselesaikan, dengan tanggal = tanggal selesai + interval.
--   - Tidak ada generate ke depan, tidak ada cron.
--
-- Tidak memakai tipe enum baru -- semua kolom skalar biasa agar migrasi
-- tetap reversibel.

alter table public.care_schedules
  add column if not exists repeat_every_days integer,
  add column if not exists series_id uuid,
  add column if not exists parent_schedule_id uuid;

comment on column public.care_schedules.repeat_every_days is
  'Jarak hari ke jadwal berikutnya. NULL = jadwal sekali jalan.';
comment on column public.care_schedules.series_id is
  'Pengikat satu rantai pengulangan. Jadwal pertama memakai id dirinya sendiri.';
comment on column public.care_schedules.parent_schedule_id is
  'Jadwal sebelumnya dalam rantai. NULL untuk jadwal pertama.';

alter table public.care_schedules
  drop constraint if exists care_schedules_repeat_every_days_check;

alter table public.care_schedules
  add constraint care_schedules_repeat_every_days_check
  check (repeat_every_days is null or repeat_every_days > 0);

-- Rantai yang berulang wajib punya series_id. Jadwal sekali boleh tanpa.
alter table public.care_schedules
  drop constraint if exists care_schedules_series_check;

alter table public.care_schedules
  add constraint care_schedules_series_check
  check (repeat_every_days is null or series_id is not null);

alter table public.care_schedules
  drop constraint if exists care_schedules_parent_schedule_fk;

alter table public.care_schedules
  add constraint care_schedules_parent_schedule_fk
  foreign key (parent_schedule_id)
  references public.care_schedules (id)
  on delete set null;

create index if not exists care_schedules_series_idx
  on public.care_schedules (series_id, scheduled_date)
  where series_id is not null;

create index if not exists care_schedules_parent_idx
  on public.care_schedules (parent_schedule_id)
  where parent_schedule_id is not null;

-- Dipakai layar Jadwal owner untuk menemukan rantai yang masih berjalan.
create index if not exists care_schedules_repeat_open_idx
  on public.care_schedules (farm_id, scheduled_date)
  where repeat_every_days is not null and is_cancelled = false;

-- ---------------------------------------------------------------------------
-- TIDAK ADA BACKFILL DARI care_sops.interval_days -- ini disengaja.
--
-- Alasan (dari audit database 6 Agustus 2026):
--   - 30 dari 35 SOP adalah fixture db-test bernama "Tree Care SOP 178...".
--   - 28 dari 31 jadwal turunan SOP berasal dari fixture tersebut.
--   - SOP "penyemprotan mingguan" punya DUA jadwal aktif sekaligus; backfill
--     naif akan memberi keduanya series_id yang sama, lalu rantainya
--     bercabang dan menggandakan diri saat dua-duanya selesai.
--   - interval_days tidak pernah dibaca oleh RPC mana pun, jadi tidak ada
--     perilaku berjalan yang perlu dipertahankan.
--
-- Jadwal berulang dibuat ulang oleh owner lewat UI setelah migrasi 041.
-- ---------------------------------------------------------------------------

-- Verifikasi setelah migrasi (harus 0 baris di kedua query):
--
--   select count(*) from public.care_schedules
--   where repeat_every_days is not null and series_id is null;
--
--   select count(*) from public.care_schedules
--   where repeat_every_days is not null and repeat_every_days <= 0;
