# SQL Schema Draft Avology V2

> **Catatan perubahan (migrasi 046 & 047).** Tabel `care_sops` beserta constraint,
> trigger, index, dan RLS policy-nya dihapus; kolom `target_row`/`target_column`
> dibuang dari `care_schedules` dan `care_tasks`; `care_tasks.category` menjadi
> `not null`; `care_schedules.repeat_every_days` ditambahkan. Constraint target
> ditulis ulang untuk tiga cabang (`farm`, `tree`, `custom`) dan ditambah
> `*_target_type_allowed_check`. Penomoran bab dirapatkan.
>
> Enum `target_type` di bab 4.8 SENGAJA dibiarkan memuat `row` dan `column`:
> PostgreSQL tidak punya `alter type ... drop value`, jadi draft ini tetap
> mencerminkan tipe yang benar-benar ada di database. Penutupannya lewat CHECK.
> Kolom `row_position`/`column_position` pada `trees` tidak terpengaruh.
> Riwayat keputusannya ada di `decision-log.md`.

> **Catatan perubahan (migrasi 048–052).** `care_schedules` bertambah kolom
> rantai dan masa toleransi, `care_tasks` bertambah penanda terlewat dan
> pelepasan, `care_activities` bertambah `postponed_until`, dan tabel jembatan
> `care_activity_trees` ditambahkan sebagai sub-bab pada bab 14 — tabel itu sudah
> ada di database sejak migrasi 025 tetapi belum pernah masuk draft ini.
> `tree_history_view` di bab 22 ditulis ulang agar mengambil pohon dari jembatan
> tersebut, sehingga perawatan bertarget seluruh kebun tidak lagi hilang dari
> riwayat pohon. Penomoran bab TIDAK bergeser. Riwayat keputusannya ada di
> `decision-log.md` (DL-034 sampai DL-038).

## 1. Tujuan SQL Schema Draft

Dokumen ini berisi rancangan awal SQL untuk implementasi database Avology V2 menggunakan Supabase/PostgreSQL.

Schema ini disusun berdasarkan:

1. MVP Scope
2. Kebutuhan Fungsional
3. Kebutuhan Non-Fungsional
4. User Story
5. Use Case
6. Activity Diagram
7. ERD Konseptual
8. Logical Database Schema

SQL dalam dokumen ini masih bersifat draft awal. Implementasi final perlu diuji secara bertahap di Supabase SQL Editor agar error dapat dilacak dengan jelas.

---

# 2. Catatan Implementasi Supabase

Avology V2 menggunakan Supabase Auth untuk autentikasi pengguna. Oleh karena itu:

* Data akun utama disimpan di `auth.users`
* Data profil aplikasi disimpan di tabel `public.profiles`
* Tabel `profiles.id` mengacu ke `auth.users.id`
* Role pengguna tidak disimpan di `profiles`
* Role dan status pengguna dalam kebun disimpan di `farm_members`

---

# 3. Extension

```sql
create extension if not exists "pgcrypto";
```

Extension `pgcrypto` digunakan untuk menghasilkan UUID melalui fungsi `gen_random_uuid()`.

---

# 4. Enum Types

## 4.1 Member Role

```sql
do $$
begin
  if not exists (select 1 from pg_type where typname = 'member_role') then
    create type member_role as enum (
      'owner',
      'worker'
    );
  end if;
end $$;
```

---

## 4.2 Member Status

```sql
do $$
begin
  if not exists (select 1 from pg_type where typname = 'member_status') then
    create type member_status as enum (
      'pending',
      'active',
      'rejected',
      'removed'
    );
  end if;
end $$;
```

---

## 4.3 Tree Condition Status

```sql
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tree_condition_status') then
    create type tree_condition_status as enum (
      'healthy',
      'needs_attention',
      'pest_attacked',
      'disease_indicated',
      'damaged',
      'dead'
    );
  end if;
end $$;
```

---

## 4.4 Growth Phase

```sql
do $$
begin
  if not exists (select 1 from pg_type where typname = 'growth_phase') then
    create type growth_phase as enum (
      'initial_planting',
      'vegetative',
      'flowering',
      'fruiting',
      'harvesting'
    );
  end if;
end $$;
```

---

## 4.5 Operational Report Category

```sql
do $$
begin
  if not exists (select 1 from pg_type where typname = 'operational_report_category') then
    create type operational_report_category as enum (
      'land_damage',
      'broken_tool',
      'out_of_stock',
      'area_pest_disease',
      'disaster_weather',
      'worker_need',
      'other'
    );
  end if;
end $$;
```

---

## 4.6 Operational Report Status

```sql
do $$
begin
  if not exists (select 1 from pg_type where typname = 'operational_report_status') then
    create type operational_report_status as enum (
      'new',
      'in_progress',
      'resolved',
      'rejected'
    );
  end if;
end $$;
```

---

## 4.7 Care Category

```sql
do $$
begin
  if not exists (select 1 from pg_type where typname = 'care_category') then
    create type care_category as enum (
      'watering',
      'fertilizing',
      'spraying',
      'weeding',
      'other'
    );
  end if;
end $$;
```

---

## 4.8 Target Type

```sql
do $$
begin
  if not exists (select 1 from pg_type where typname = 'target_type') then
    create type target_type as enum (
      'farm',
      'row',
      'column',
      'tree',
      'custom'
    );
  end if;
end $$;
```

---

## 4.9 Task Status

```sql
do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type task_status as enum (
      'pending',
      'completed',
      'postponed'
    );
  end if;
end $$;
```

---

## 4.10 Activity Status

```sql
do $$
begin
  if not exists (select 1 from pg_type where typname = 'activity_status') then
    create type activity_status as enum (
      'completed',
      'postponed'
    );
  end if;
end $$;
```

---

# 5. Function Updated At

Function ini digunakan untuk memperbarui kolom `updated_at` setiap kali data diubah.

```sql
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

---

# 6. Tabel Profiles

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
```

## Trigger Updated At

```sql
drop trigger if exists set_profiles_updated_at on public.profiles;

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();
```

---

# 7. Tabel Farms

```sql
create table if not exists public.farms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  area_size numeric,
  join_code text not null unique,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
```

## Constraint

```sql
alter table public.farms
drop constraint if exists farms_area_size_check;

alter table public.farms
add constraint farms_area_size_check
check (area_size is null or area_size > 0);
```

## Trigger Updated At

```sql
drop trigger if exists set_farms_updated_at on public.farms;

create trigger set_farms_updated_at
before update on public.farms
for each row
execute function public.set_updated_at();
```

---

# 8. Tabel Farm Members

```sql
create table if not exists public.farm_members (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role member_role not null,
  status member_status not null default 'pending',
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,

  constraint farm_members_unique_user_per_farm unique (farm_id, user_id)
);
```

## Trigger Updated At

```sql
drop trigger if exists set_farm_members_updated_at on public.farm_members;

create trigger set_farm_members_updated_at
before update on public.farm_members
for each row
execute function public.set_updated_at();
```

## Catatan

Saat owner membuat kebun, sistem harus otomatis menambahkan owner ke `farm_members` dengan:

```txt
role = owner
status = active
joined_at = now()
```

Ini bisa dilakukan melalui logic aplikasi atau database function.

---

# 9. Tabel Trees

```sql
create table if not exists public.trees (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  tree_code text not null,
  row_position text,
  column_position text,
  variety text,
  planted_at date,
  current_condition tree_condition_status not null default 'healthy',
  current_growth_phase growth_phase,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz,

  constraint trees_unique_code_per_farm unique (farm_id, tree_code)
);
```

## Trigger Updated At

```sql
drop trigger if exists set_trees_updated_at on public.trees;

create trigger set_trees_updated_at
before update on public.trees
for each row
execute function public.set_updated_at();
```

---

# 10. Tabel Tree Condition Reports

```sql
create table if not exists public.tree_condition_reports (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  tree_id uuid not null references public.trees(id) on delete cascade,
  reported_by uuid not null references public.profiles(id) on delete restrict,
  condition_status tree_condition_status not null,
  note text,
  reported_at timestamptz not null default now()
);
```

---

## Trigger Sinkronisasi Kondisi Terbaru Pohon

```sql
create or replace function public.sync_tree_current_condition()
returns trigger
language plpgsql
as $$
begin
  update public.trees
  set current_condition = new.condition_status,
      updated_at = now()
  where id = new.tree_id;

  return new;
end;
$$;
```

```sql
drop trigger if exists sync_tree_current_condition_trigger
on public.tree_condition_reports;

create trigger sync_tree_current_condition_trigger
after insert on public.tree_condition_reports
for each row
execute function public.sync_tree_current_condition();
```

---

# 11. Tabel Operational Reports

```sql
create table if not exists public.operational_reports (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  reported_by uuid not null references public.profiles(id) on delete restrict,
  category operational_report_category not null,
  location_note text,
  description text,
  status operational_report_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
```

## Trigger Updated At

```sql
drop trigger if exists set_operational_reports_updated_at
on public.operational_reports;

create trigger set_operational_reports_updated_at
before update on public.operational_reports
for each row
execute function public.set_updated_at();
```

---

# 12. Tabel Care Schedules

```sql
create table if not exists public.care_schedules (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  title text not null,
  category care_category not null,
  scheduled_date date not null,
  target_type target_type not null,
  target_tree_id uuid references public.trees(id) on delete set null,
  custom_target_note text,
  instruction text,
  repeat_every_days integer,
  date_basis text not null default 'jadwal',
  grace_days integer,
  missed_at timestamptz,
  series_id uuid,
  parent_schedule_id uuid references public.care_schedules(id) on delete set null,
  is_cancelled boolean not null default false,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete set null,
  cancel_reason text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
```

## Constraint Rantai dan Masa Toleransi

```sql
alter table public.care_schedules
drop constraint if exists care_schedules_date_basis_check;

alter table public.care_schedules
add constraint care_schedules_date_basis_check
check (date_basis in ('jadwal', 'realisasi'));

alter table public.care_schedules
drop constraint if exists care_schedules_grace_days_check;

alter table public.care_schedules
add constraint care_schedules_grace_days_check
check (grace_days is null or grace_days >= 0);
```

Nilai `grace_days = 0` sah dan berarti jadwal dinyatakan terlewat begitu tanggalnya lewat. Nilai NULL berarti jadwal tidak pernah dinyatakan terlewat.

## Constraint Target Jadwal

```sql
alter table public.care_schedules
drop constraint if exists care_schedules_target_check;

alter table public.care_schedules
add constraint care_schedules_target_check
check (
  (
    target_type = 'farm'
    and target_tree_id is null
    and custom_target_note is null
  )
  or
  (
    target_type = 'tree'
    and target_tree_id is not null
    and custom_target_note is null
  )
  or
  (
    target_type = 'custom'
    and target_tree_id is null
    and custom_target_note is not null
  )
);
```

## Constraint Nilai Target Type

Nilai `row` dan `column` masih ada di tipe enum `target_type` karena PostgreSQL
tidak menyediakan `alter type ... drop value`. Keduanya ditutup lewat CHECK.

```sql
alter table public.care_schedules
drop constraint if exists care_schedules_target_type_allowed_check;

alter table public.care_schedules
add constraint care_schedules_target_type_allowed_check
check (target_type in ('farm', 'tree', 'custom'));
```

## Constraint Interval Pengulangan

```sql
alter table public.care_schedules
drop constraint if exists care_schedules_repeat_every_days_check;

alter table public.care_schedules
add constraint care_schedules_repeat_every_days_check
check (repeat_every_days is null or repeat_every_days > 0);
```

## Trigger Updated At

```sql
drop trigger if exists set_care_schedules_updated_at
on public.care_schedules;

create trigger set_care_schedules_updated_at
before update on public.care_schedules
for each row
execute function public.set_updated_at();
```

---

# 13. Tabel Care Tasks

```sql
create table if not exists public.care_tasks (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  care_schedule_id uuid references public.care_schedules(id) on delete set null,
  operational_report_id uuid references public.operational_reports(id) on delete set null,
  assigned_to uuid not null references public.profiles(id) on delete restrict,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  category care_category not null,
  instruction text,
  target_type target_type not null,
  target_tree_id uuid references public.trees(id) on delete set null,
  custom_target_note text,
  due_date date not null,
  status task_status not null default 'pending',
  missed_at timestamptz,
  released_at timestamptz,
  released_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
```

## Constraint Pelepasan Tugas

```sql
alter table public.care_tasks
drop constraint if exists care_tasks_released_pair_check;

alter table public.care_tasks
add constraint care_tasks_released_pair_check
check (
  (released_at is null and released_reason is null)
  or (
    released_at is not null
    and released_reason in ('removed_by_owner', 'left_by_worker')
  )
);
```

Kosakata `released_reason` sengaja sama persis dengan `farm_members.removed_reason` pada kedua jalur keluar, sehingga sebab di tabel tugas dan sebab di tabel keanggotaan dapat dipadankan tanpa tabel penerjemah.

## Constraint Sumber Tugas

```sql
alter table public.care_tasks
drop constraint if exists care_tasks_source_check;

alter table public.care_tasks
add constraint care_tasks_source_check
check (
  care_schedule_id is not null
  or operational_report_id is not null
);
```

## Constraint Target Tugas

```sql
alter table public.care_tasks
drop constraint if exists care_tasks_target_check;

alter table public.care_tasks
add constraint care_tasks_target_check
check (
  (
    target_type = 'farm'
    and target_tree_id is null
    and custom_target_note is null
  )
  or
  (
    target_type = 'tree'
    and target_tree_id is not null
    and custom_target_note is null
  )
  or
  (
    target_type = 'custom'
    and target_tree_id is null
    and custom_target_note is not null
  )
);
```

## Constraint Nilai Target Type

```sql
alter table public.care_tasks
drop constraint if exists care_tasks_target_type_allowed_check;

alter table public.care_tasks
add constraint care_tasks_target_type_allowed_check
check (target_type in ('farm', 'tree', 'custom'));
```

## Trigger Updated At

```sql
drop trigger if exists set_care_tasks_updated_at
on public.care_tasks;

create trigger set_care_tasks_updated_at
before update on public.care_tasks
for each row
execute function public.set_updated_at();
```

---

# 14. Tabel Care Activities

```sql
create table if not exists public.care_activities (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  care_task_id uuid not null references public.care_tasks(id) on delete cascade,
  performed_by uuid not null references public.profiles(id) on delete restrict,
  status activity_status not null,
  note text,
  postponed_until date,
  performed_at timestamptz not null default now()
);
```

## Constraint Tanggal Penundaan

```sql
alter table public.care_activities
drop constraint if exists care_activities_postponed_until_check;

alter table public.care_activities
add constraint care_activities_postponed_until_check
check (
  (status = 'postponed' and postponed_until is not null)
  or (status = 'completed' and postponed_until is null)
);
```

---

## Trigger Sinkronisasi Status Tugas

```sql
create or replace function public.sync_task_status_from_activity()
returns trigger
language plpgsql
as $$
begin
  update public.care_tasks
  set status = new.status::task_status,
      updated_at = now()
  where id = new.care_task_id;

  return new;
end;
$$;
```

```sql
drop trigger if exists sync_task_status_from_activity_trigger
on public.care_activities;

create trigger sync_task_status_from_activity_trigger
after insert on public.care_activities
for each row
execute function public.sync_task_status_from_activity();
```

---

## Tabel Jembatan Care Activity Trees

Pohon yang dirawat tidak disimpan sebagai kolom pada `care_activities`, melainkan pada tabel jembatan berikut. Satu perawatan dapat berdampak pada banyak pohon sekaligus, sehingga hubungannya banyak-ke-banyak.

```sql
create table if not exists public.care_activity_trees (
  care_activity_id uuid not null
    references public.care_activities(id) on delete cascade,
  tree_id uuid not null
    references public.trees(id) on delete cascade,
  constraint care_activity_trees_pkey primary key (care_activity_id, tree_id)
);
```

Jembatan diisi saat aktivitas dibuat, dari dua jalur:

1. **Pencatatan inisiatif** — pelaku memilih sendiri pohon yang dirawat.
2. **Realisasi tugas terjadwal** — pohon diturunkan dari target tugas saat tugas diselesaikan:

```txt
target_type = 'tree'   -> satu baris, dari care_tasks.target_tree_id
target_type = 'farm'   -> seluruh pohon kebun dengan is_archived = false
target_type = 'custom' -> tidak ada pohon yang ditautkan
```

Pohon diresolusi pada saat penyelesaian tugas, bukan saat jadwal dibuat, agar tautannya mencerminkan pohon yang benar-benar ada ketika pekerjaan dilakukan.

Tabel ini hanya menerima `select` dan `insert`. Tanpa `update` dan `delete`, tautan yang sudah terbentuk tidak dapat dikoreksi; satu-satunya cara menghapusnya adalah menghapus aktivitas induknya, yang akan ikut menghapus tautannya lewat `on delete cascade`.

---

# 15. Tabel Growth Phase Records

```sql
create table if not exists public.growth_phase_records (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  tree_id uuid not null references public.trees(id) on delete cascade,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  phase growth_phase not null,
  note text,
  recorded_at timestamptz not null default now()
);
```

---

## Trigger Sinkronisasi Fase Terbaru Pohon

```sql
create or replace function public.sync_tree_current_growth_phase()
returns trigger
language plpgsql
as $$
begin
  update public.trees
  set current_growth_phase = new.phase,
      updated_at = now()
  where id = new.tree_id;

  return new;
end;
$$;
```

```sql
drop trigger if exists sync_tree_current_growth_phase_trigger
on public.growth_phase_records;

create trigger sync_tree_current_growth_phase_trigger
after insert on public.growth_phase_records
for each row
execute function public.sync_tree_current_growth_phase();
```

---

# 16. Function Membuat Join Code

Function ini menghasilkan kode bergabung sederhana untuk kebun.

```sql
create or replace function public.generate_join_code()
returns text
language plpgsql
as $$
declare
  code text;
begin
  loop
    code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

    exit when not exists (
      select 1
      from public.farms
      where join_code = code
    );
  end loop;

  return code;
end;
$$;
```

## Catatan

Format join code dapat dikembangkan menjadi format khusus seperti:

```txt
AVOL-2026-XXXX
```

Namun untuk MVP, kode 8 karakter sudah cukup sebagai draft awal. Tidak perlu mendesain kode seperti nomor peluncuran roket, ini cuma join code kebun.

---

# 17. Function Membuat Kebun dan Owner Membership

Function ini membuat kebun sekaligus menambahkan pembuat kebun sebagai owner aktif.

```sql
create or replace function public.create_farm_with_owner(
  p_name text,
  p_location text,
  p_area_size numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_farm_id uuid;
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'User is not authenticated';
  end if;

  insert into public.farms (
    name,
    location,
    area_size,
    join_code,
    created_by
  )
  values (
    p_name,
    p_location,
    p_area_size,
    public.generate_join_code(),
    current_user_id
  )
  returning id into new_farm_id;

  insert into public.farm_members (
    farm_id,
    user_id,
    role,
    status,
    joined_at
  )
  values (
    new_farm_id,
    current_user_id,
    'owner',
    'active',
    now()
  );

  return new_farm_id;
end;
$$;
```

---

# 18. Function Request Join Farm

Function ini digunakan worker untuk mengajukan bergabung ke kebun berdasarkan join code.

```sql
create or replace function public.request_join_farm(
  p_join_code text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_farm_id uuid;
  current_user_id uuid;
  membership_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'User is not authenticated';
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
      and status in ('pending', 'active')
  ) then
    raise exception 'User already has an active or pending membership';
  end if;

  insert into public.farm_members (
    farm_id,
    user_id,
    role,
    status
  )
  values (
    target_farm_id,
    current_user_id,
    'worker',
    'pending'
  )
  on conflict (farm_id, user_id)
  do update
  set role = 'worker',
      status = 'pending',
      updated_at = now()
  returning id into membership_id;

  return membership_id;
end;
$$;
```

---

# 19. Function Approve Worker

```sql
create or replace function public.approve_worker(
  p_farm_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_farm_id uuid;
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  select farm_id
  into target_farm_id
  from public.farm_members
  where id = p_farm_member_id
    and role = 'worker'
    and status = 'pending';

  if target_farm_id is null then
    raise exception 'Pending worker not found';
  end if;

  if not exists (
    select 1
    from public.farm_members
    where farm_id = target_farm_id
      and user_id = current_user_id
      and role = 'owner'
      and status = 'active'
  ) then
    raise exception 'Only active owner can approve worker';
  end if;

  update public.farm_members
  set status = 'active',
      joined_at = now(),
      updated_at = now()
  where id = p_farm_member_id;
end;
$$;
```

---

# 20. Function Reject Worker

```sql
create or replace function public.reject_worker(
  p_farm_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_farm_id uuid;
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  select farm_id
  into target_farm_id
  from public.farm_members
  where id = p_farm_member_id
    and role = 'worker'
    and status = 'pending';

  if target_farm_id is null then
    raise exception 'Pending worker not found';
  end if;

  if not exists (
    select 1
    from public.farm_members
    where farm_id = target_farm_id
      and user_id = current_user_id
      and role = 'owner'
      and status = 'active'
  ) then
    raise exception 'Only active owner can reject worker';
  end if;

  update public.farm_members
  set status = 'rejected',
      updated_at = now()
  where id = p_farm_member_id;
end;
$$;
```

---

# 21. Function Remove Worker

```sql
create or replace function public.remove_worker(
  p_farm_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_farm_id uuid;
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  select farm_id
  into target_farm_id
  from public.farm_members
  where id = p_farm_member_id
    and role = 'worker'
    and status = 'active';

  if target_farm_id is null then
    raise exception 'Active worker not found';
  end if;

  if not exists (
    select 1
    from public.farm_members
    where farm_id = target_farm_id
      and user_id = current_user_id
      and role = 'owner'
      and status = 'active'
  ) then
    raise exception 'Only active owner can remove worker';
  end if;

  update public.farm_members
  set status = 'removed',
      updated_at = now()
  where id = p_farm_member_id;
end;
$$;
```

---

# 22. View Tree History

View ini menampilkan riwayat pohon dari gabungan laporan kondisi, fase pertumbuhan, dan aktivitas perawatan.

```sql
create or replace view public.tree_history_view as

select
  tcr.tree_id,
  tcr.farm_id,
  'condition'::text as history_type,
  tcr.condition_status::text as title,
  tcr.note as description,
  tcr.reported_by as actor_id,
  tcr.reported_at as happened_at
from public.tree_condition_reports tcr

union all

select
  gpr.tree_id,
  gpr.farm_id,
  'phase'::text as history_type,
  gpr.phase::text as title,
  gpr.note as description,
  gpr.recorded_by as actor_id,
  gpr.recorded_at as happened_at
from public.growth_phase_records gpr

union all

select
  cat.tree_id,
  ca.farm_id,
  'care'::text as history_type,
  coalesce(ct.title, 'Perawatan inisiatif') as title,
  ca.note as description,
  ca.performed_by as actor_id,
  ca.performed_at as happened_at
from public.care_activities ca
join public.care_activity_trees cat
  on cat.care_activity_id = ca.id
left join public.care_tasks ct
  on ct.id = ca.care_task_id;
```

## Catatan

Pohon diambil dari jembatan `care_activity_trees`, bukan dari target pohon pada `care_tasks`. Akibatnya satu perawatan yang menyasar seluruh kebun muncul di riwayat SETIAP pohon yang terdampak, bukan hilang seperti pada rancangan sebelumnya.

`join` ke `care_tasks` sengaja `left join`: aktivitas dari pencatatan inisiatif tidak punya tugas induk, dan `inner join` akan membuang seluruh catatan inisiatif dari riwayat.

Perawatan bertarget catatan bebas tetap tidak muncul di riwayat pohon mana pun. Targetnya memang tidak menunjuk pohon, sehingga tidak ada yang bisa ditautkan.

---

# 23. Index

```sql
create index if not exists idx_farm_members_farm_user
on public.farm_members(farm_id, user_id);

create index if not exists idx_farm_members_farm_status
on public.farm_members(farm_id, status);

create index if not exists idx_trees_farm
on public.trees(farm_id);

create index if not exists idx_trees_farm_archived
on public.trees(farm_id, is_archived);

create index if not exists idx_trees_farm_condition
on public.trees(farm_id, current_condition);

create index if not exists idx_trees_farm_growth_phase
on public.trees(farm_id, current_growth_phase);

create index if not exists idx_tree_condition_reports_tree_reported_at
on public.tree_condition_reports(tree_id, reported_at desc);

create index if not exists idx_operational_reports_farm_status
on public.operational_reports(farm_id, status);


create index if not exists idx_care_schedules_farm_date
on public.care_schedules(farm_id, scheduled_date);

create index if not exists idx_care_tasks_assigned_due_date
on public.care_tasks(assigned_to, due_date);

create index if not exists idx_care_tasks_farm_status
on public.care_tasks(farm_id, status);

create index if not exists idx_care_tasks_open_not_missed
on public.care_tasks(farm_id, due_date)
where missed_at is null
  and released_at is null
  and status in ('pending', 'postponed');

create index if not exists idx_care_activities_task
on public.care_activities(care_task_id);

create index if not exists idx_care_activities_task_latest
on public.care_activities(care_task_id, performed_at desc, id desc);

create index if not exists idx_care_activity_trees_tree_id
on public.care_activity_trees(tree_id);

create index if not exists idx_growth_phase_records_tree_recorded_at
on public.growth_phase_records(tree_id, recorded_at desc);
```

`idx_care_tasks_open_not_missed` sengaja parsial. Predikatnya adalah definisi "tugas terbuka" yang dipakai penyapu jadwal terlewat dan seluruh penghitung tunggakan, sehingga tugas yang sudah selesai, sudah terlewat, atau sudah dilepas tidak ikut dipindai.

`idx_care_activities_task_latest` mengikuti urutan `order by performed_at desc, id desc` yang dipakai saat mencari realisasi terakhir sebuah tugas. Kolom `id` wajib ikut sebagai pemecah seri; tanpa itu, dua realisasi dengan `performed_at` identik membuat "yang terakhir" tidak deterministik.

`idx_care_activity_trees_tree_id` melayani arah baca "riwayat perawatan pohon ini". Arah sebaliknya sudah tertutup primary key jembatan.

---

# 24. Helper Function untuk RLS

RLS akan lebih bersih jika memakai helper function. Tanpa helper, policy akan panjang seperti surat permintaan maaf kepada database.

## 25.1 Check Active Farm Member

```sql
create or replace function public.is_active_farm_member(
  p_farm_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.farm_members
    where farm_id = p_farm_id
      and user_id = p_user_id
      and status = 'active'
  );
$$;
```

---

## 25.2 Check Active Owner

```sql
create or replace function public.is_active_owner(
  p_farm_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.farm_members
    where farm_id = p_farm_id
      and user_id = p_user_id
      and role = 'owner'
      and status = 'active'
  );
$$;
```

---

## 25.3 Check Active Worker

```sql
create or replace function public.is_active_worker(
  p_farm_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.farm_members
    where farm_id = p_farm_id
      and user_id = p_user_id
      and role = 'worker'
      and status = 'active'
  );
$$;
```

---

## 25.4 Check Profile Visibility

```sql
create or replace function public.can_view_profile(
  p_profile_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    p_profile_id = p_user_id
    or exists (
      select 1
      from public.farm_members viewer
      join public.farm_members target
        on target.farm_id = viewer.farm_id
      where viewer.user_id = p_user_id
        and viewer.role = 'owner'
        and viewer.status = 'active'
        and target.user_id = p_profile_id
        and target.role = 'worker'
        and target.status = 'active'
    );
$$;
```

Function ini memungkinkan owner melihat profil dasar worker aktif dalam farm yang sama. Worker tetap tidak dapat melihat profil user di luar farm-nya.

---

# 25. Enable RLS

```sql
alter table public.profiles enable row level security;
alter table public.farms enable row level security;
alter table public.farm_members enable row level security;
alter table public.trees enable row level security;
alter table public.tree_condition_reports enable row level security;
alter table public.operational_reports enable row level security;
alter table public.care_schedules enable row level security;
alter table public.care_tasks enable row level security;
alter table public.care_activities enable row level security;
alter table public.growth_phase_records enable row level security;
```

---

# 26. Draft RLS Policies

## 26.1 Profiles

Pengguna dapat melihat profilnya sendiri. Owner aktif dapat melihat profil dasar worker aktif dalam farm yang sama.

```sql
drop policy if exists "Users can view visible profiles"
on public.profiles;

create policy "Users can view visible profiles"
on public.profiles
for select
to authenticated
using (public.can_view_profile(id, auth.uid()));
```

Pengguna hanya dapat memperbarui profilnya sendiri.

```sql
drop policy if exists "Users can update own profile"
on public.profiles;

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());
```

---

## 26.2 Farms

Owner dan worker aktif dapat melihat data kebun tempat mereka tergabung.

```sql
drop policy if exists "Active members can view farm"
on public.farms;

create policy "Active members can view farm"
on public.farms
for select
to authenticated
using (
  public.is_active_farm_member(id, auth.uid())
);
```

Owner aktif dapat memperbarui data kebun.

```sql
drop policy if exists "Active owner can update farm"
on public.farms;

create policy "Active owner can update farm"
on public.farms
for update
to authenticated
using (
  public.is_active_owner(id, auth.uid())
)
with check (
  public.is_active_owner(id, auth.uid())
);
```

Catatan: insert kebun disarankan melalui function `create_farm_with_owner()`.

---

## 26.3 Farm Members

Anggota aktif dapat melihat daftar member pada kebunnya.

```sql
drop policy if exists "Active members can view farm members"
on public.farm_members;

create policy "Active members can view farm members"
on public.farm_members
for select
to authenticated
using (
  public.is_active_farm_member(farm_id, auth.uid())
);
```

Owner aktif dapat mengelola status worker.

```sql
drop policy if exists "Active owner can update farm members"
on public.farm_members;

create policy "Active owner can update farm members"
on public.farm_members
for update
to authenticated
using (
  public.is_active_owner(farm_id, auth.uid())
)
with check (
  public.is_active_owner(farm_id, auth.uid())
);
```

Catatan: proses request join, approve, reject, dan remove worker lebih aman dilakukan melalui RPC function.

---

## 26.4 Trees

Anggota aktif dapat melihat data pohon.

```sql
drop policy if exists "Active members can view trees"
on public.trees;

create policy "Active members can view trees"
on public.trees
for select
to authenticated
using (
  public.is_active_farm_member(farm_id, auth.uid())
);
```

Owner aktif dapat mengelola data pohon.

```sql
drop policy if exists "Active owner can insert trees"
on public.trees;

create policy "Active owner can insert trees"
on public.trees
for insert
to authenticated
with check (
  public.is_active_owner(farm_id, auth.uid())
);
```

```sql
drop policy if exists "Active owner can update trees"
on public.trees;

create policy "Active owner can update trees"
on public.trees
for update
to authenticated
using (
  public.is_active_owner(farm_id, auth.uid())
)
with check (
  public.is_active_owner(farm_id, auth.uid())
);
```

---

## 26.5 Tree Condition Reports

Anggota aktif dapat melihat laporan kondisi pohon.

```sql
drop policy if exists "Active members can view condition reports"
on public.tree_condition_reports;

create policy "Active members can view condition reports"
on public.tree_condition_reports
for select
to authenticated
using (
  public.is_active_farm_member(farm_id, auth.uid())
);
```

Owner atau worker aktif dapat membuat laporan kondisi.

```sql
drop policy if exists "Active members can insert condition reports"
on public.tree_condition_reports;

create policy "Active members can insert condition reports"
on public.tree_condition_reports
for insert
to authenticated
with check (
  public.is_active_farm_member(farm_id, auth.uid())
  and reported_by = auth.uid()
);
```

---

## 26.6 Operational Reports

Owner dan worker aktif dapat melihat laporan operasional kebun.

```sql
drop policy if exists "Active members can view operational reports"
on public.operational_reports;

create policy "Active members can view operational reports"
on public.operational_reports
for select
to authenticated
using (
  public.is_active_farm_member(farm_id, auth.uid())
);
```

Worker aktif dapat membuat laporan operasional.

```sql
drop policy if exists "Active worker can insert operational reports"
on public.operational_reports;

create policy "Active worker can insert operational reports"
on public.operational_reports
for insert
to authenticated
with check (
  public.is_active_worker(farm_id, auth.uid())
  and reported_by = auth.uid()
);
```

Owner aktif dapat mengubah status laporan operasional.

```sql
drop policy if exists "Active owner can update operational reports"
on public.operational_reports;

create policy "Active owner can update operational reports"
on public.operational_reports
for update
to authenticated
using (
  public.is_active_owner(farm_id, auth.uid())
)
with check (
  public.is_active_owner(farm_id, auth.uid())
);
```

---

---

## 26.7 Care Schedules

Anggota aktif dapat melihat jadwal.

```sql
drop policy if exists "Active members can view care schedules"
on public.care_schedules;

create policy "Active members can view care schedules"
on public.care_schedules
for select
to authenticated
using (
  public.is_active_farm_member(farm_id, auth.uid())
);
```

Owner aktif dapat membuat dan mengubah jadwal.

```sql
drop policy if exists "Active owner can insert care schedules"
on public.care_schedules;

create policy "Active owner can insert care schedules"
on public.care_schedules
for insert
to authenticated
with check (
  public.is_active_owner(farm_id, auth.uid())
  and created_by = auth.uid()
);
```

```sql
drop policy if exists "Active owner can update care schedules"
on public.care_schedules;

create policy "Active owner can update care schedules"
on public.care_schedules
for update
to authenticated
using (
  public.is_active_owner(farm_id, auth.uid())
)
with check (
  public.is_active_owner(farm_id, auth.uid())
);
```

---

## 26.8 Care Tasks

Owner aktif dapat melihat semua tugas pada kebunnya. Worker aktif hanya melihat tugas miliknya.

```sql
drop policy if exists "Owner can view farm tasks and worker can view own tasks"
on public.care_tasks;

create policy "Owner can view farm tasks and worker can view own tasks"
on public.care_tasks
for select
to authenticated
using (
  public.is_active_owner(farm_id, auth.uid())
  or (
    public.is_active_worker(farm_id, auth.uid())
    and assigned_to = auth.uid()
  )
);
```

Owner aktif dapat membuat tugas.

```sql
drop policy if exists "Active owner can insert care tasks"
on public.care_tasks;

create policy "Active owner can insert care tasks"
on public.care_tasks
for insert
to authenticated
with check (
  public.is_active_owner(farm_id, auth.uid())
  and assigned_by = auth.uid()
);
```

Owner aktif dapat memperbarui tugas. Worker aktif dapat memperbarui tugas miliknya secara terbatas, tetapi pembatasan kolom lebih baik dikendalikan di logic aplikasi atau RPC.

```sql
drop policy if exists "Owner can update farm tasks and worker can update own tasks"
on public.care_tasks;

create policy "Owner can update farm tasks and worker can update own tasks"
on public.care_tasks
for update
to authenticated
using (
  public.is_active_owner(farm_id, auth.uid())
  or (
    public.is_active_worker(farm_id, auth.uid())
    and assigned_to = auth.uid()
  )
)
with check (
  public.is_active_owner(farm_id, auth.uid())
  or (
    public.is_active_worker(farm_id, auth.uid())
    and assigned_to = auth.uid()
  )
);
```

---

## 26.9 Care Activities

Owner aktif dapat melihat aktivitas pada kebunnya. Worker aktif dapat melihat aktivitas tugas miliknya.

```sql
drop policy if exists "Owner can view activities and worker can view own activities"
on public.care_activities;

create policy "Owner can view activities and worker can view own activities"
on public.care_activities
for select
to authenticated
using (
  public.is_active_owner(farm_id, auth.uid())
  or (
    public.is_active_worker(farm_id, auth.uid())
    and performed_by = auth.uid()
  )
);
```

Worker aktif dapat membuat aktivitas untuk tugas miliknya.

```sql
drop policy if exists "Worker can insert own task activities"
on public.care_activities;

create policy "Worker can insert own task activities"
on public.care_activities
for insert
to authenticated
with check (
  public.is_active_worker(farm_id, auth.uid())
  and performed_by = auth.uid()
  and exists (
    select 1
    from public.care_tasks ct
    where ct.id = care_task_id
      and ct.farm_id = care_activities.farm_id
      and ct.assigned_to = auth.uid()
  )
);
```

---

## 26.10 Growth Phase Records

Anggota aktif dapat melihat catatan fase.

```sql
drop policy if exists "Active members can view growth phase records"
on public.growth_phase_records;

create policy "Active members can view growth phase records"
on public.growth_phase_records
for select
to authenticated
using (
  public.is_active_farm_member(farm_id, auth.uid())
);
```

Anggota aktif dapat mencatat fase pohon.

```sql
drop policy if exists "Active members can insert growth phase records"
on public.growth_phase_records;

create policy "Active members can insert growth phase records"
on public.growth_phase_records
for insert
to authenticated
with check (
  public.is_active_farm_member(farm_id, auth.uid())
  and recorded_by = auth.uid()
);
```

---

# 27. Catatan RLS Penting

RLS di atas adalah draft awal. Saat implementasi, beberapa operasi sebaiknya tidak dilakukan langsung dengan `insert` atau `update` dari frontend, tetapi melalui RPC function agar validasi lebih aman.

Operasi yang sebaiknya memakai RPC:

1. Membuat kebun dan owner membership
2. Request join farm
3. Approve worker
4. Reject worker
5. Remove worker
6. Membuat jadwal perawatan sekaligus membuat tugas
7. Worker menyelesaikan tugas sekaligus membuat activity
8. Worker menunda tugas sekaligus membuat activity

Kalau semua dilempar langsung dari frontend, nanti aplikasi bisa terlihat jalan, sampai suatu hari data mulai saling menggigit. Database juga punya fase tantrum, hanya saja bentuknya foreign key error.

---

# 28. Urutan Eksekusi SQL yang Disarankan

Eksekusi SQL sebaiknya bertahap:

1. Extension
2. Enum types
3. Function `set_updated_at`
4. Tabel `profiles`
5. Tabel `farms`
6. Tabel `farm_members`
7. Tabel `trees`
8. Tabel `tree_condition_reports`
9. Tabel `operational_reports`
10. Tabel `care_schedules`
11. Tabel `care_tasks`
12. Tabel `care_activities`
13. Tabel `growth_phase_records`
14. Trigger sinkronisasi
15. Function join code dan membership
16. View `tree_history_view`
17. Index
18. Helper function RLS, termasuk `can_view_profile`
19. Enable RLS
20. Policies

---

# 29. Batasan SQL Draft MVP

SQL schema draft ini belum mencakup:

1. Prediksi panen otomatis
2. Machine learning
3. Push notification
4. IoT atau sensor
5. API cuaca
6. Chat owner-worker
7. Akuntansi lengkap
8. Laporan PDF otomatis
9. Integrated farming
10. Marketplace
11. Grading buah
12. Sistem kelompok tani
13. Recurring task otomatis penuh
14. Peternakan
15. Supply chain restoran atau warung

Fitur-fitur tersebut disimpan untuk pengembangan lanjutan setelah MVP utama stabil.

---

# 30. Ringkasan Keputusan SQL Draft

1. Sistem menggunakan Supabase Auth untuk autentikasi.
2. Profil pengguna disimpan di `profiles`.
3. Role dan status pengguna disimpan di `farm_members`.
4. Data pohon disimpan secara individual di `trees`.
5. Riwayat kondisi pohon disimpan di `tree_condition_reports`.
6. Laporan umum kebun disimpan di `operational_reports`.
7. Jadwal perawatan disimpan di `care_schedules`.
8. Tugas worker disimpan di `care_tasks`.
9. Realisasi tugas disimpan di `care_activities`.
10. Fase pertumbuhan disimpan di `growth_phase_records`.
11. Riwayat pohon dibentuk melalui `tree_history_view`.
12. Worker yang dikeluarkan diberi status `removed`.
13. Pohon tidak aktif menggunakan `is_archived`.
14. Interval pengulangan jadwal membentuk rantai jadwal penerus.
15. Penerus jadwal dan penandaan terlewat dihitung pada jalur baca aplikasi, tanpa penjadwal latar.
16. RLS digunakan untuk membatasi akses berdasarkan role dan status anggota kebun.
