alter table public.photo_attachments
drop constraint if exists photo_attachments_entity_type_check;

alter table public.photo_attachments
add constraint photo_attachments_entity_type_check
check (entity_type in (
  'tree_main',
  'condition_record',
  'growth_phase_record',
  'operational_report',
  'task_proof',
  'harvest_record',
  'manual_care_record'
));

alter table public.photo_attachments
drop constraint if exists photo_attachments_storage_path_entity_folder_check;

alter table public.photo_attachments
add constraint photo_attachments_storage_path_entity_folder_check
check (
  public.avology_storage_path_entity_folder(storage_path) =
  case entity_type
    when 'tree_main' then 'trees'
    when 'condition_record' then 'condition-reports'
    when 'growth_phase_record' then 'growth-phase-records'
    when 'operational_report' then 'operational-reports'
    when 'task_proof' then 'task-proofs'
    when 'harvest_record' then 'harvest-records'
    when 'manual_care_record' then 'manual-care-records'
  end
);

create table if not exists public.harvest_records (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  tree_id uuid not null references public.trees(id) on delete cascade,
  harvested_by uuid not null references public.profiles(id) on delete restrict,
  fruit_count integer not null,
  fruit_condition text,
  note text,
  harvested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz,

  constraint harvest_records_fruit_count_check check (fruit_count > 0)
);

create table if not exists public.manual_care_records (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  category public.care_category not null,
  target_type public.target_type not null,
  target_row text,
  target_column text,
  target_tree_id uuid references public.trees(id) on delete set null,
  custom_target_note text,
  note text,
  performed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz,

  constraint manual_care_records_target_check
    check (
      (
        target_type = 'farm'
        and target_row is null
        and target_column is null
        and target_tree_id is null
        and custom_target_note is null
      )
      or (
        target_type = 'row'
        and target_row is not null
        and target_column is null
        and target_tree_id is null
        and custom_target_note is null
      )
      or (
        target_type = 'column'
        and target_row is null
        and target_column is not null
        and target_tree_id is null
        and custom_target_note is null
      )
      or (
        target_type = 'tree'
        and target_row is null
        and target_column is null
        and target_tree_id is not null
        and custom_target_note is null
      )
      or (
        target_type = 'custom'
        and target_row is null
        and target_column is null
        and target_tree_id is null
        and custom_target_note is not null
      )
    )
);

create index if not exists idx_harvest_records_tree_harvested_at
on public.harvest_records(tree_id, harvested_at desc);

create index if not exists idx_harvest_records_farm_harvested_at
on public.harvest_records(farm_id, harvested_at desc);

create index if not exists idx_manual_care_records_farm_performed_at
on public.manual_care_records(farm_id, performed_at desc);

create index if not exists idx_manual_care_records_tree_performed_at
on public.manual_care_records(target_tree_id, performed_at desc)
where target_type = 'tree' and target_tree_id is not null;

alter table public.care_schedules
add column if not exists is_cancelled boolean not null default false,
add column if not exists cancelled_at timestamptz,
add column if not exists cancelled_by uuid,
add column if not exists cancel_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'care_schedules_cancelled_by_fkey'
      and conrelid = 'public.care_schedules'::regclass
  ) then
    alter table public.care_schedules
    add constraint care_schedules_cancelled_by_fkey
    foreign key (cancelled_by) references public.profiles(id) on delete set null;
  end if;
end $$;

alter table public.operational_reports
add column if not exists owner_response_note text,
add column if not exists responded_by uuid,
add column if not exists responded_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'operational_reports_responded_by_fkey'
      and conrelid = 'public.operational_reports'::regclass
  ) then
    alter table public.operational_reports
    add constraint operational_reports_responded_by_fkey
    foreign key (responded_by) references public.profiles(id) on delete set null;
  end if;
end $$;

alter table public.farm_members
add column if not exists removed_at timestamptz,
add column if not exists removed_by uuid,
add column if not exists removed_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'farm_members_removed_by_fkey'
      and conrelid = 'public.farm_members'::regclass
  ) then
    alter table public.farm_members
    add constraint farm_members_removed_by_fkey
    foreign key (removed_by) references public.profiles(id) on delete set null;
  end if;
end $$;

create or replace function public.validate_harvest_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tree_farm_id uuid;
begin
  select farm_id into tree_farm_id
  from public.trees
  where id = new.tree_id;

  if tree_farm_id is distinct from new.farm_id then
    raise exception 'Harvest record tree must belong to the same farm';
  end if;

  if not public.is_active_farm_member(new.farm_id, new.harvested_by) then
    raise exception 'Only active farm members can manage harvest records';
  end if;

  return new;
end;
$$;

create or replace function public.validate_manual_care_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tree_farm_id uuid;
begin
  if new.target_type = 'tree' then
    select farm_id into tree_farm_id
    from public.trees
    where id = new.target_tree_id;

    if tree_farm_id is distinct from new.farm_id then
      raise exception 'Manual care target tree must belong to the same farm';
    end if;
  end if;

  if not public.is_active_farm_member(new.farm_id, new.recorded_by) then
    raise exception 'Only active farm members can manage manual care records';
  end if;

  return new;
end;
$$;

drop trigger if exists set_harvest_records_updated_at on public.harvest_records;
create trigger set_harvest_records_updated_at
before update on public.harvest_records
for each row
execute function public.set_updated_at();

drop trigger if exists set_manual_care_records_updated_at on public.manual_care_records;
create trigger set_manual_care_records_updated_at
before update on public.manual_care_records
for each row
execute function public.set_updated_at();

drop trigger if exists validate_harvest_record_trigger on public.harvest_records;
create trigger validate_harvest_record_trigger
before insert or update on public.harvest_records
for each row
execute function public.validate_harvest_record();

drop trigger if exists validate_manual_care_record_trigger on public.manual_care_records;
create trigger validate_manual_care_record_trigger
before insert or update on public.manual_care_records
for each row
execute function public.validate_manual_care_record();

alter table public.harvest_records enable row level security;
alter table public.manual_care_records enable row level security;

drop policy if exists "Active members can view harvest records" on public.harvest_records;
create policy "Active members can view harvest records"
on public.harvest_records
for select
to authenticated
using (public.is_active_farm_member(farm_id, auth.uid()));

drop policy if exists "Active members can insert harvest records" on public.harvest_records;
create policy "Active members can insert harvest records"
on public.harvest_records
for insert
to authenticated
with check (
  harvested_by = auth.uid()
  and public.is_active_farm_member(farm_id, auth.uid())
);

drop policy if exists "Owners and authors can update harvest records" on public.harvest_records;
create policy "Owners and authors can update harvest records"
on public.harvest_records
for update
to authenticated
using (
  public.is_active_owner(farm_id, auth.uid())
  or (
    harvested_by = auth.uid()
    and public.is_active_farm_member(farm_id, auth.uid())
  )
)
with check (
  public.is_active_owner(farm_id, auth.uid())
  or (
    harvested_by = auth.uid()
    and public.is_active_farm_member(farm_id, auth.uid())
  )
);

drop policy if exists "Active owner can delete harvest records" on public.harvest_records;
create policy "Active owner can delete harvest records"
on public.harvest_records
for delete
to authenticated
using (public.is_active_owner(farm_id, auth.uid()));

drop policy if exists "Active members can view manual care records" on public.manual_care_records;
create policy "Active members can view manual care records"
on public.manual_care_records
for select
to authenticated
using (public.is_active_farm_member(farm_id, auth.uid()));

drop policy if exists "Active members can insert manual care records" on public.manual_care_records;
create policy "Active members can insert manual care records"
on public.manual_care_records
for insert
to authenticated
with check (
  recorded_by = auth.uid()
  and public.is_active_farm_member(farm_id, auth.uid())
);

drop policy if exists "Owners and authors can update manual care records" on public.manual_care_records;
create policy "Owners and authors can update manual care records"
on public.manual_care_records
for update
to authenticated
using (
  public.is_active_owner(farm_id, auth.uid())
  or (
    recorded_by = auth.uid()
    and public.is_active_farm_member(farm_id, auth.uid())
  )
)
with check (
  public.is_active_owner(farm_id, auth.uid())
  or (
    recorded_by = auth.uid()
    and public.is_active_farm_member(farm_id, auth.uid())
  )
);

drop policy if exists "Active owner can delete manual care records" on public.manual_care_records;
create policy "Active owner can delete manual care records"
on public.manual_care_records
for delete
to authenticated
using (public.is_active_owner(farm_id, auth.uid()));

create or replace function public.can_access_growth_phase_record_photo(
  p_farm_id uuid,
  p_growth_phase_record_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.growth_phase_records gpr
    where gpr.id = p_growth_phase_record_id
      and gpr.farm_id = p_farm_id
      and public.is_active_farm_member(p_farm_id, p_user_id)
  );
$$;

create or replace function public.can_upload_growth_phase_record_photo(
  p_farm_id uuid,
  p_growth_phase_record_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.growth_phase_records gpr
    where gpr.id = p_growth_phase_record_id
      and gpr.farm_id = p_farm_id
      and gpr.recorded_by = p_user_id
      and public.is_active_farm_member(p_farm_id, p_user_id)
  );
$$;

create or replace function public.can_access_harvest_record_photo(
  p_farm_id uuid,
  p_harvest_record_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.harvest_records hr
    where hr.id = p_harvest_record_id
      and hr.farm_id = p_farm_id
      and public.is_active_farm_member(p_farm_id, p_user_id)
  );
$$;

create or replace function public.can_upload_harvest_record_photo(
  p_farm_id uuid,
  p_harvest_record_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.harvest_records hr
    where hr.id = p_harvest_record_id
      and hr.farm_id = p_farm_id
      and hr.harvested_by = p_user_id
      and public.is_active_farm_member(p_farm_id, p_user_id)
  );
$$;

create or replace function public.can_access_manual_care_record_photo(
  p_farm_id uuid,
  p_manual_care_record_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.manual_care_records mcr
    where mcr.id = p_manual_care_record_id
      and mcr.farm_id = p_farm_id
      and public.is_active_farm_member(p_farm_id, p_user_id)
  );
$$;

create or replace function public.can_upload_manual_care_record_photo(
  p_farm_id uuid,
  p_manual_care_record_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.manual_care_records mcr
    where mcr.id = p_manual_care_record_id
      and mcr.farm_id = p_farm_id
      and mcr.recorded_by = p_user_id
      and public.is_active_farm_member(p_farm_id, p_user_id)
  );
$$;

drop policy if exists "Allowed members can view photo attachments" on public.photo_attachments;
create policy "Allowed members can view photo attachments"
on public.photo_attachments
for select
to authenticated
using (
  (
    entity_type = 'tree_main'
    and public.is_active_farm_member(farm_id, auth.uid())
  )
  or (
    entity_type = 'condition_record'
    and public.can_access_condition_record_photo(farm_id, entity_id, auth.uid())
  )
  or (
    entity_type = 'growth_phase_record'
    and public.can_access_growth_phase_record_photo(farm_id, entity_id, auth.uid())
  )
  or (
    entity_type = 'operational_report'
    and public.can_access_operational_report_photo(farm_id, entity_id, auth.uid())
  )
  or (
    entity_type = 'task_proof'
    and public.can_access_task_proof_photo(farm_id, entity_id, auth.uid())
  )
  or (
    entity_type = 'harvest_record'
    and public.can_access_harvest_record_photo(farm_id, entity_id, auth.uid())
  )
  or (
    entity_type = 'manual_care_record'
    and public.can_access_manual_care_record_photo(farm_id, entity_id, auth.uid())
  )
);

drop policy if exists "Allowed members can insert photo attachments" on public.photo_attachments;
create policy "Allowed members can insert photo attachments"
on public.photo_attachments
for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and bucket = 'avology-photos'
  and public.avology_storage_path_farm_id(storage_path) = farm_id
  and public.avology_storage_path_entity_id(storage_path) = entity_id
  and (
    (
      entity_type = 'tree_main'
      and public.is_active_owner(farm_id, auth.uid())
    )
    or (
      entity_type = 'condition_record'
      and public.can_upload_condition_record_photo(farm_id, entity_id, auth.uid())
    )
    or (
      entity_type = 'growth_phase_record'
      and public.can_upload_growth_phase_record_photo(farm_id, entity_id, auth.uid())
    )
    or (
      entity_type = 'operational_report'
      and public.can_upload_operational_report_photo(farm_id, entity_id, auth.uid())
    )
    or (
      entity_type = 'task_proof'
      and public.can_upload_task_proof_photo(
        farm_id,
        public.avology_storage_path_task_id(storage_path),
        entity_id,
        auth.uid()
      )
    )
    or (
      entity_type = 'harvest_record'
      and public.can_upload_harvest_record_photo(farm_id, entity_id, auth.uid())
    )
    or (
      entity_type = 'manual_care_record'
      and public.can_upload_manual_care_record_photo(farm_id, entity_id, auth.uid())
    )
  )
);

drop policy if exists "Allowed members can delete photo attachments" on public.photo_attachments;
create policy "Allowed members can delete photo attachments"
on public.photo_attachments
for delete
to authenticated
using (
  public.is_active_owner(farm_id, auth.uid())
  or (
    uploaded_by = auth.uid()
    and (
      (
        entity_type = 'condition_record'
        and public.can_upload_condition_record_photo(farm_id, entity_id, auth.uid())
      )
      or (
        entity_type = 'growth_phase_record'
        and public.can_upload_growth_phase_record_photo(farm_id, entity_id, auth.uid())
      )
      or (
        entity_type = 'operational_report'
        and public.can_upload_operational_report_photo(farm_id, entity_id, auth.uid())
      )
      or (
        entity_type = 'task_proof'
        and public.can_access_task_proof_photo(farm_id, entity_id, auth.uid())
      )
      or (
        entity_type = 'harvest_record'
        and public.can_upload_harvest_record_photo(farm_id, entity_id, auth.uid())
      )
      or (
        entity_type = 'manual_care_record'
        and public.can_upload_manual_care_record_photo(farm_id, entity_id, auth.uid())
      )
    )
  )
);

drop policy if exists "Allowed members can read avology photo objects" on storage.objects;
create policy "Allowed members can read avology photo objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avology-photos'
  and (
    (
      public.avology_storage_path_entity_folder(name) = 'trees'
      and public.is_active_farm_member(
        public.avology_storage_path_farm_id(name),
        auth.uid()
      )
    )
    or (
      public.avology_storage_path_entity_folder(name) = 'condition-reports'
      and public.can_access_condition_record_photo(
        public.avology_storage_path_farm_id(name),
        public.avology_storage_path_entity_id(name),
        auth.uid()
      )
    )
    or (
      public.avology_storage_path_entity_folder(name) = 'growth-phase-records'
      and public.can_access_growth_phase_record_photo(
        public.avology_storage_path_farm_id(name),
        public.avology_storage_path_entity_id(name),
        auth.uid()
      )
    )
    or (
      public.avology_storage_path_entity_folder(name) = 'operational-reports'
      and public.can_access_operational_report_photo(
        public.avology_storage_path_farm_id(name),
        public.avology_storage_path_entity_id(name),
        auth.uid()
      )
    )
    or (
      public.avology_storage_path_entity_folder(name) = 'task-proofs'
      and public.can_access_task_proof_photo(
        public.avology_storage_path_farm_id(name),
        public.avology_storage_path_entity_id(name),
        auth.uid()
      )
    )
    or (
      public.avology_storage_path_entity_folder(name) = 'harvest-records'
      and public.can_access_harvest_record_photo(
        public.avology_storage_path_farm_id(name),
        public.avology_storage_path_entity_id(name),
        auth.uid()
      )
    )
    or (
      public.avology_storage_path_entity_folder(name) = 'manual-care-records'
      and public.can_access_manual_care_record_photo(
        public.avology_storage_path_farm_id(name),
        public.avology_storage_path_entity_id(name),
        auth.uid()
      )
    )
  )
);

drop policy if exists "Allowed members can upload avology photo objects" on storage.objects;
create policy "Allowed members can upload avology photo objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avology-photos'
  and (
    (
      public.avology_storage_path_entity_folder(name) = 'trees'
      and split_part(name, '/', 5) = 'main'
      and public.is_active_owner(
        public.avology_storage_path_farm_id(name),
        auth.uid()
      )
    )
    or (
      public.avology_storage_path_entity_folder(name) = 'condition-reports'
      and public.can_upload_condition_record_photo(
        public.avology_storage_path_farm_id(name),
        public.avology_storage_path_entity_id(name),
        auth.uid()
      )
    )
    or (
      public.avology_storage_path_entity_folder(name) = 'growth-phase-records'
      and public.can_upload_growth_phase_record_photo(
        public.avology_storage_path_farm_id(name),
        public.avology_storage_path_entity_id(name),
        auth.uid()
      )
    )
    or (
      public.avology_storage_path_entity_folder(name) = 'operational-reports'
      and public.can_upload_operational_report_photo(
        public.avology_storage_path_farm_id(name),
        public.avology_storage_path_entity_id(name),
        auth.uid()
      )
    )
    or (
      public.avology_storage_path_entity_folder(name) = 'task-proofs'
      and public.can_upload_task_proof_photo(
        public.avology_storage_path_farm_id(name),
        public.avology_storage_path_task_id(name),
        public.avology_storage_path_entity_id(name),
        auth.uid()
      )
    )
    or (
      public.avology_storage_path_entity_folder(name) = 'harvest-records'
      and public.can_upload_harvest_record_photo(
        public.avology_storage_path_farm_id(name),
        public.avology_storage_path_entity_id(name),
        auth.uid()
      )
    )
    or (
      public.avology_storage_path_entity_folder(name) = 'manual-care-records'
      and public.can_upload_manual_care_record_photo(
        public.avology_storage_path_farm_id(name),
        public.avology_storage_path_entity_id(name),
        auth.uid()
      )
    )
  )
);

drop policy if exists "Allowed members can delete avology photo objects" on storage.objects;
create policy "Allowed members can delete avology photo objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avology-photos'
  and (
    public.is_active_owner(
      public.avology_storage_path_farm_id(name),
      auth.uid()
    )
    or exists (
      select 1
      from public.photo_attachments pa
      where pa.bucket = storage.objects.bucket_id
        and pa.storage_path = storage.objects.name
        and pa.uploaded_by = auth.uid()
    )
    or (
      not exists (
        select 1
        from public.photo_attachments pa
        where pa.bucket = storage.objects.bucket_id
          and pa.storage_path = storage.objects.name
      )
      and (
        (
          public.avology_storage_path_entity_folder(name) = 'condition-reports'
          and public.can_upload_condition_record_photo(
            public.avology_storage_path_farm_id(name),
            public.avology_storage_path_entity_id(name),
            auth.uid()
          )
        )
        or (
          public.avology_storage_path_entity_folder(name) = 'growth-phase-records'
          and public.can_upload_growth_phase_record_photo(
            public.avology_storage_path_farm_id(name),
            public.avology_storage_path_entity_id(name),
            auth.uid()
          )
        )
        or (
          public.avology_storage_path_entity_folder(name) = 'operational-reports'
          and public.can_upload_operational_report_photo(
            public.avology_storage_path_farm_id(name),
            public.avology_storage_path_entity_id(name),
            auth.uid()
          )
        )
        or (
          public.avology_storage_path_entity_folder(name) = 'task-proofs'
          and public.can_upload_task_proof_photo(
            public.avology_storage_path_farm_id(name),
            public.avology_storage_path_task_id(name),
            public.avology_storage_path_entity_id(name),
            auth.uid()
          )
        )
        or (
          public.avology_storage_path_entity_folder(name) = 'harvest-records'
          and public.can_upload_harvest_record_photo(
            public.avology_storage_path_farm_id(name),
            public.avology_storage_path_entity_id(name),
            auth.uid()
          )
        )
        or (
          public.avology_storage_path_entity_folder(name) = 'manual-care-records'
          and public.can_upload_manual_care_record_photo(
            public.avology_storage_path_farm_id(name),
            public.avology_storage_path_entity_id(name),
            auth.uid()
          )
        )
      )
    )
  )
);

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

create or replace function public.update_operational_report_status(
  p_operational_report_id uuid,
  p_status public.operational_report_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  report_farm_id uuid;
begin
  select farm_id
  into report_farm_id
  from public.operational_reports
  where id = p_operational_report_id;

  if report_farm_id is null then
    raise exception 'Operational report not found';
  end if;

  if not public.is_active_owner(report_farm_id, current_user_id) then
    raise exception 'Only active owners can update operational report status';
  end if;

  update public.operational_reports
  set status = p_status,
      responded_by = current_user_id,
      responded_at = now(),
      updated_at = now()
  where id = p_operational_report_id;
end;
$$;

create or replace function public.reopen_operational_report(
  p_report_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_report record;
begin
  select id, farm_id, status, owner_response_note
  into target_report
  from public.operational_reports
  where id = p_report_id;

  if target_report.id is null then
    raise exception 'Operational report not found';
  end if;

  if not public.is_active_owner(target_report.farm_id, current_user_id) then
    raise exception 'Only active owners can reopen operational reports';
  end if;

  if target_report.status not in ('resolved', 'rejected') then
    raise exception 'Only resolved or rejected reports can be reopened';
  end if;

  update public.operational_reports
  set status = 'in_progress',
      owner_response_note = coalesce(nullif(trim(p_note), ''), owner_response_note),
      responded_by = current_user_id,
      responded_at = now(),
      updated_at = now()
  where id = p_report_id;
end;
$$;

create or replace function public.update_farm_profile(
  p_farm_id uuid,
  p_name text,
  p_location text default null,
  p_area_size numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_name text := nullif(trim(p_name), '');
begin
  if normalized_name is null then
    raise exception 'Farm name is required';
  end if;

  if not public.is_active_owner(p_farm_id, current_user_id) then
    raise exception 'Only active owners can update farm profile';
  end if;

  update public.farms
  set name = normalized_name,
      location = nullif(trim(p_location), ''),
      area_size = p_area_size,
      updated_at = now()
  where id = p_farm_id;
end;
$$;

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

  if exists (
    select 1
    from public.farm_members
    where farm_id = target_farm_id
      and user_id = current_user_id
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

  return membership_id;
end;
$$;

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
begin
  select farm_id
  into target_farm_id
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
end;
$$;

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
begin
  select farm_id
  into target_farm_id
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
end;
$$;

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
end;
$$;

drop function if exists public.get_current_user_access();

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
  order by coalesce(fm.updated_at, fm.created_at) desc
  limit 1;
end;
$$;

create or replace view public.tree_history_view
with (security_invoker = true)
as
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
  ct.target_tree_id as tree_id,
  ca.farm_id,
  'care'::text as history_type,
  ct.title as title,
  ca.note as description,
  ca.performed_by as actor_id,
  ca.performed_at as happened_at
from public.care_activities ca
join public.care_tasks ct
  on ct.id = ca.care_task_id
where ct.target_type = 'tree'
  and ct.target_tree_id is not null

union all

select
  hr.tree_id,
  hr.farm_id,
  'harvest'::text as history_type,
  'Panen dicatat'::text as title,
  trim(concat(
    'Jumlah buah: ',
    hr.fruit_count::text,
    case
      when nullif(trim(hr.fruit_condition), '') is not null
        then concat('. Kondisi: ', trim(hr.fruit_condition))
      else ''
    end,
    case
      when nullif(trim(hr.note), '') is not null
        then concat('. Catatan: ', trim(hr.note))
      else ''
    end
  )) as description,
  hr.harvested_by as actor_id,
  hr.harvested_at as happened_at
from public.harvest_records hr

union all

select
  mcr.target_tree_id as tree_id,
  mcr.farm_id,
  'manual_care'::text as history_type,
  'Perawatan manual'::text as title,
  coalesce(nullif(trim(mcr.note), ''), mcr.category::text) as description,
  mcr.recorded_by as actor_id,
  mcr.performed_at as happened_at
from public.manual_care_records mcr
where mcr.target_type = 'tree'
  and mcr.target_tree_id is not null;

grant select, insert, update, delete on public.harvest_records to authenticated;
grant select, insert, update, delete on public.manual_care_records to authenticated;
grant select on public.tree_history_view to authenticated;

revoke execute on function public.validate_harvest_record() from public, anon;
revoke execute on function public.validate_manual_care_record() from public, anon;
revoke execute on function public.can_access_growth_phase_record_photo(uuid, uuid, uuid) from public, anon;
revoke execute on function public.can_upload_growth_phase_record_photo(uuid, uuid, uuid) from public, anon;
revoke execute on function public.can_access_harvest_record_photo(uuid, uuid, uuid) from public, anon;
revoke execute on function public.can_upload_harvest_record_photo(uuid, uuid, uuid) from public, anon;
revoke execute on function public.can_access_manual_care_record_photo(uuid, uuid, uuid) from public, anon;
revoke execute on function public.can_upload_manual_care_record_photo(uuid, uuid, uuid) from public, anon;
revoke execute on function public.cancel_care_schedule(uuid, text) from public, anon;
revoke execute on function public.update_operational_report_status(uuid, public.operational_report_status) from public, anon;
revoke execute on function public.reopen_operational_report(uuid, text) from public, anon;
revoke execute on function public.update_farm_profile(uuid, text, text, numeric) from public, anon;
revoke execute on function public.request_join_farm(text) from public, anon;
revoke execute on function public.approve_worker(uuid) from public, anon;
revoke execute on function public.remove_worker(uuid) from public, anon;
revoke execute on function public.leave_current_farm(uuid) from public, anon;
revoke execute on function public.get_current_user_access() from public, anon;

grant execute on function public.can_access_growth_phase_record_photo(uuid, uuid, uuid) to authenticated;
grant execute on function public.can_upload_growth_phase_record_photo(uuid, uuid, uuid) to authenticated;
grant execute on function public.can_access_harvest_record_photo(uuid, uuid, uuid) to authenticated;
grant execute on function public.can_upload_harvest_record_photo(uuid, uuid, uuid) to authenticated;
grant execute on function public.can_access_manual_care_record_photo(uuid, uuid, uuid) to authenticated;
grant execute on function public.can_upload_manual_care_record_photo(uuid, uuid, uuid) to authenticated;
grant execute on function public.cancel_care_schedule(uuid, text) to authenticated;
grant execute on function public.update_operational_report_status(uuid, public.operational_report_status) to authenticated;
grant execute on function public.reopen_operational_report(uuid, text) to authenticated;
grant execute on function public.update_farm_profile(uuid, text, text, numeric) to authenticated;
grant execute on function public.request_join_farm(text) to authenticated;
grant execute on function public.approve_worker(uuid) to authenticated;
grant execute on function public.remove_worker(uuid) to authenticated;
grant execute on function public.leave_current_farm(uuid) to authenticated;
grant execute on function public.get_current_user_access() to authenticated;

notify pgrst, 'reload schema';
