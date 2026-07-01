alter table public.tree_condition_reports
add column if not exists is_deleted boolean not null default false,
add column if not exists deleted_at timestamptz,
add column if not exists deleted_by uuid,
add column if not exists delete_reason text,
add column if not exists created_at timestamptz not null default now(),
add column if not exists updated_at timestamptz;

alter table public.growth_phase_records
add column if not exists is_deleted boolean not null default false,
add column if not exists deleted_at timestamptz,
add column if not exists deleted_by uuid,
add column if not exists delete_reason text,
add column if not exists created_at timestamptz not null default now(),
add column if not exists updated_at timestamptz;

alter table public.harvest_records
add column if not exists is_deleted boolean not null default false,
add column if not exists deleted_at timestamptz,
add column if not exists deleted_by uuid,
add column if not exists delete_reason text;

alter table public.manual_care_records
add column if not exists is_deleted boolean not null default false,
add column if not exists deleted_at timestamptz,
add column if not exists deleted_by uuid,
add column if not exists delete_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tree_condition_reports_deleted_by_fkey'
      and conrelid = 'public.tree_condition_reports'::regclass
  ) then
    alter table public.tree_condition_reports
    add constraint tree_condition_reports_deleted_by_fkey
    foreign key (deleted_by) references public.profiles(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'growth_phase_records_deleted_by_fkey'
      and conrelid = 'public.growth_phase_records'::regclass
  ) then
    alter table public.growth_phase_records
    add constraint growth_phase_records_deleted_by_fkey
    foreign key (deleted_by) references public.profiles(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'harvest_records_deleted_by_fkey'
      and conrelid = 'public.harvest_records'::regclass
  ) then
    alter table public.harvest_records
    add constraint harvest_records_deleted_by_fkey
    foreign key (deleted_by) references public.profiles(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'manual_care_records_deleted_by_fkey'
      and conrelid = 'public.manual_care_records'::regclass
  ) then
    alter table public.manual_care_records
    add constraint manual_care_records_deleted_by_fkey
    foreign key (deleted_by) references public.profiles(id) on delete set null;
  end if;
end $$;

drop policy if exists "Owners and authors can update harvest records" on public.harvest_records;
create policy "Authors can update harvest records"
on public.harvest_records
for update
to authenticated
using (
  harvested_by = auth.uid()
  and is_deleted = false
  and public.is_active_farm_member(farm_id, auth.uid())
)
with check (
  harvested_by = auth.uid()
  and public.is_active_farm_member(farm_id, auth.uid())
);

drop policy if exists "Active owner can delete harvest records" on public.harvest_records;

drop policy if exists "Owners and authors can update manual care records" on public.manual_care_records;
create policy "Authors can update manual care records"
on public.manual_care_records
for update
to authenticated
using (
  recorded_by = auth.uid()
  and is_deleted = false
  and public.is_active_farm_member(farm_id, auth.uid())
)
with check (
  recorded_by = auth.uid()
  and public.is_active_farm_member(farm_id, auth.uid())
);

drop policy if exists "Active owner can delete manual care records" on public.manual_care_records;

create index if not exists idx_tree_condition_reports_tree_not_deleted_reported_at
on public.tree_condition_reports(tree_id, reported_at desc)
where is_deleted = false;

create index if not exists idx_growth_phase_records_tree_not_deleted_recorded_at
on public.growth_phase_records(tree_id, recorded_at desc)
where is_deleted = false;

create index if not exists idx_harvest_records_tree_not_deleted_harvested_at
on public.harvest_records(tree_id, harvested_at desc)
where is_deleted = false;

create index if not exists idx_manual_care_records_tree_not_deleted_performed_at
on public.manual_care_records(target_tree_id, performed_at desc)
where target_type = 'tree' and target_tree_id is not null and is_deleted = false;

drop trigger if exists set_tree_condition_reports_updated_at on public.tree_condition_reports;
create trigger set_tree_condition_reports_updated_at
before update on public.tree_condition_reports
for each row
execute function public.set_updated_at();

drop trigger if exists set_growth_phase_records_updated_at on public.growth_phase_records;
create trigger set_growth_phase_records_updated_at
before update on public.growth_phase_records
for each row
execute function public.set_updated_at();

create or replace function public.recalculate_tree_current_condition(
  p_tree_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  latest_condition public.tree_condition_status;
begin
  select condition_status
  into latest_condition
  from public.tree_condition_reports
  where tree_id = p_tree_id
    and is_deleted = false
  order by reported_at desc, created_at desc, id desc
  limit 1;

  update public.trees
  set current_condition = coalesce(latest_condition, 'healthy'::public.tree_condition_status),
      updated_at = now()
  where id = p_tree_id;
end;
$$;

create or replace function public.recalculate_tree_current_growth_phase(
  p_tree_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  latest_phase public.growth_phase;
begin
  select phase
  into latest_phase
  from public.growth_phase_records
  where tree_id = p_tree_id
    and is_deleted = false
  order by recorded_at desc, created_at desc, id desc
  limit 1;

  update public.trees
  set current_growth_phase = latest_phase,
      updated_at = now()
  where id = p_tree_id;
end;
$$;

create or replace function public.sync_tree_current_condition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_tree_current_condition(new.tree_id);
  return new;
end;
$$;

create or replace function public.sync_tree_current_growth_phase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_tree_current_growth_phase(new.tree_id);
  return new;
end;
$$;

create or replace function public.ensure_record_owner_active_member(
  p_farm_id uuid,
  p_author_id uuid,
  p_current_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_current_user_id is null then
    raise exception 'User is not authenticated';
  end if;

  if p_author_id is distinct from p_current_user_id then
    raise exception 'Only record author can change this record';
  end if;

  if not public.is_active_farm_member(p_farm_id, p_current_user_id) then
    raise exception 'Only active farm members can change this record';
  end if;
end;
$$;

create or replace function public.update_own_tree_condition_report(
  p_report_id uuid,
  p_condition_status public.tree_condition_status,
  p_note text default null,
  p_reported_at timestamptz default null
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
  select id, farm_id, tree_id, reported_by, is_deleted
  into target_report
  from public.tree_condition_reports
  where id = p_report_id;

  if not found then
    raise exception 'Tree condition report not found';
  end if;

  if target_report.is_deleted then
    raise exception 'Tree condition report is deleted';
  end if;

  perform public.ensure_record_owner_active_member(
    target_report.farm_id,
    target_report.reported_by,
    current_user_id
  );

  update public.tree_condition_reports
  set condition_status = p_condition_status,
      note = nullif(trim(p_note), ''),
      reported_at = coalesce(p_reported_at, reported_at)
  where id = p_report_id;

  perform public.recalculate_tree_current_condition(target_report.tree_id);
end;
$$;

create or replace function public.soft_delete_own_tree_condition_report(
  p_report_id uuid,
  p_reason text default null
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
  select id, farm_id, tree_id, reported_by, is_deleted
  into target_report
  from public.tree_condition_reports
  where id = p_report_id;

  if not found then
    raise exception 'Tree condition report not found';
  end if;

  if target_report.is_deleted then
    raise exception 'Tree condition report is deleted';
  end if;

  perform public.ensure_record_owner_active_member(
    target_report.farm_id,
    target_report.reported_by,
    current_user_id
  );

  update public.tree_condition_reports
  set is_deleted = true,
      deleted_at = now(),
      deleted_by = current_user_id,
      delete_reason = nullif(trim(p_reason), '')
  where id = p_report_id;

  perform public.recalculate_tree_current_condition(target_report.tree_id);
end;
$$;

create or replace function public.update_own_growth_phase_record(
  p_record_id uuid,
  p_phase public.growth_phase,
  p_note text default null,
  p_recorded_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_record record;
begin
  select id, farm_id, tree_id, recorded_by, is_deleted
  into target_record
  from public.growth_phase_records
  where id = p_record_id;

  if not found then
    raise exception 'Growth phase record not found';
  end if;

  if target_record.is_deleted then
    raise exception 'Growth phase record is deleted';
  end if;

  perform public.ensure_record_owner_active_member(
    target_record.farm_id,
    target_record.recorded_by,
    current_user_id
  );

  update public.growth_phase_records
  set phase = p_phase,
      note = nullif(trim(p_note), ''),
      recorded_at = coalesce(p_recorded_at, recorded_at)
  where id = p_record_id;

  perform public.recalculate_tree_current_growth_phase(target_record.tree_id);
end;
$$;

create or replace function public.soft_delete_own_growth_phase_record(
  p_record_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_record record;
begin
  select id, farm_id, tree_id, recorded_by, is_deleted
  into target_record
  from public.growth_phase_records
  where id = p_record_id;

  if not found then
    raise exception 'Growth phase record not found';
  end if;

  if target_record.is_deleted then
    raise exception 'Growth phase record is deleted';
  end if;

  perform public.ensure_record_owner_active_member(
    target_record.farm_id,
    target_record.recorded_by,
    current_user_id
  );

  update public.growth_phase_records
  set is_deleted = true,
      deleted_at = now(),
      deleted_by = current_user_id,
      delete_reason = nullif(trim(p_reason), '')
  where id = p_record_id;

  perform public.recalculate_tree_current_growth_phase(target_record.tree_id);
end;
$$;

create or replace function public.update_own_harvest_record(
  p_record_id uuid,
  p_fruit_count integer,
  p_fruit_condition text default null,
  p_note text default null,
  p_harvested_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_record record;
begin
  if p_fruit_count is null or p_fruit_count <= 0 then
    raise exception 'Harvest fruit count must be greater than 0';
  end if;

  select id, farm_id, harvested_by, is_deleted
  into target_record
  from public.harvest_records
  where id = p_record_id;

  if not found then
    raise exception 'Harvest record not found';
  end if;

  if target_record.is_deleted then
    raise exception 'Harvest record is deleted';
  end if;

  perform public.ensure_record_owner_active_member(
    target_record.farm_id,
    target_record.harvested_by,
    current_user_id
  );

  update public.harvest_records
  set fruit_count = p_fruit_count,
      fruit_condition = nullif(trim(p_fruit_condition), ''),
      note = nullif(trim(p_note), ''),
      harvested_at = coalesce(p_harvested_at, harvested_at)
  where id = p_record_id;
end;
$$;

create or replace function public.soft_delete_own_harvest_record(
  p_record_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_record record;
begin
  select id, farm_id, harvested_by, is_deleted
  into target_record
  from public.harvest_records
  where id = p_record_id;

  if not found then
    raise exception 'Harvest record not found';
  end if;

  if target_record.is_deleted then
    raise exception 'Harvest record is deleted';
  end if;

  perform public.ensure_record_owner_active_member(
    target_record.farm_id,
    target_record.harvested_by,
    current_user_id
  );

  update public.harvest_records
  set is_deleted = true,
      deleted_at = now(),
      deleted_by = current_user_id,
      delete_reason = nullif(trim(p_reason), '')
  where id = p_record_id;
end;
$$;

create or replace function public.update_own_manual_care_record(
  p_record_id uuid,
  p_category public.care_category,
  p_target_type public.target_type,
  p_target_row text default null,
  p_target_column text default null,
  p_target_tree_id uuid default null,
  p_custom_target_note text default null,
  p_note text default null,
  p_performed_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_record record;
  target_tree_farm_id uuid;
begin
  select id, farm_id, recorded_by, is_deleted
  into target_record
  from public.manual_care_records
  where id = p_record_id;

  if not found then
    raise exception 'Manual care record not found';
  end if;

  if target_record.is_deleted then
    raise exception 'Manual care record is deleted';
  end if;

  perform public.ensure_record_owner_active_member(
    target_record.farm_id,
    target_record.recorded_by,
    current_user_id
  );

  if p_target_type = 'tree' then
    select farm_id
    into target_tree_farm_id
    from public.trees
    where id = p_target_tree_id;

    if target_tree_farm_id is distinct from target_record.farm_id then
      raise exception 'Manual care target tree must belong to the same farm';
    end if;
  end if;

  update public.manual_care_records
  set category = p_category,
      target_type = p_target_type,
      target_row = nullif(trim(p_target_row), ''),
      target_column = nullif(trim(p_target_column), ''),
      target_tree_id = p_target_tree_id,
      custom_target_note = nullif(trim(p_custom_target_note), ''),
      note = nullif(trim(p_note), ''),
      performed_at = coalesce(p_performed_at, performed_at)
  where id = p_record_id;
end;
$$;

create or replace function public.soft_delete_own_manual_care_record(
  p_record_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_record record;
begin
  select id, farm_id, recorded_by, is_deleted
  into target_record
  from public.manual_care_records
  where id = p_record_id;

  if not found then
    raise exception 'Manual care record not found';
  end if;

  if target_record.is_deleted then
    raise exception 'Manual care record is deleted';
  end if;

  perform public.ensure_record_owner_active_member(
    target_record.farm_id,
    target_record.recorded_by,
    current_user_id
  );

  update public.manual_care_records
  set is_deleted = true,
      deleted_at = now(),
      deleted_by = current_user_id,
      delete_reason = nullif(trim(p_reason), '')
  where id = p_record_id;
end;
$$;

drop view if exists public.tree_history_view;

create view public.tree_history_view
with (security_invoker = true)
as
select
  tcr.id as source_id,
  tcr.tree_id,
  tcr.farm_id,
  'condition'::text as history_type,
  tcr.condition_status::text as title,
  tcr.note as description,
  tcr.reported_by as actor_id,
  tcr.reported_at as happened_at
from public.tree_condition_reports tcr
where tcr.is_deleted = false

union all

select
  gpr.id as source_id,
  gpr.tree_id,
  gpr.farm_id,
  'phase'::text as history_type,
  gpr.phase::text as title,
  gpr.note as description,
  gpr.recorded_by as actor_id,
  gpr.recorded_at as happened_at
from public.growth_phase_records gpr
where gpr.is_deleted = false

union all

select
  ca.id as source_id,
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
  hr.id as source_id,
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
where hr.is_deleted = false

union all

select
  mcr.id as source_id,
  mcr.target_tree_id as tree_id,
  mcr.farm_id,
  'manual_care'::text as history_type,
  'Perawatan manual'::text as title,
  coalesce(nullif(trim(mcr.note), ''), mcr.category::text) as description,
  mcr.recorded_by as actor_id,
  mcr.performed_at as happened_at
from public.manual_care_records mcr
where mcr.target_type = 'tree'
  and mcr.target_tree_id is not null
  and mcr.is_deleted = false;

grant select on public.tree_history_view to authenticated;

revoke execute on function public.recalculate_tree_current_condition(uuid) from public, anon;
revoke execute on function public.recalculate_tree_current_growth_phase(uuid) from public, anon;
revoke execute on function public.ensure_record_owner_active_member(uuid, uuid, uuid) from public, anon;
revoke execute on function public.update_own_tree_condition_report(uuid, public.tree_condition_status, text, timestamptz) from public, anon;
revoke execute on function public.soft_delete_own_tree_condition_report(uuid, text) from public, anon;
revoke execute on function public.update_own_growth_phase_record(uuid, public.growth_phase, text, timestamptz) from public, anon;
revoke execute on function public.soft_delete_own_growth_phase_record(uuid, text) from public, anon;
revoke execute on function public.update_own_harvest_record(uuid, integer, text, text, timestamptz) from public, anon;
revoke execute on function public.soft_delete_own_harvest_record(uuid, text) from public, anon;
revoke execute on function public.update_own_manual_care_record(uuid, public.care_category, public.target_type, text, text, uuid, text, text, timestamptz) from public, anon;
revoke execute on function public.soft_delete_own_manual_care_record(uuid, text) from public, anon;

grant execute on function public.update_own_tree_condition_report(uuid, public.tree_condition_status, text, timestamptz) to authenticated;
grant execute on function public.soft_delete_own_tree_condition_report(uuid, text) to authenticated;
grant execute on function public.update_own_growth_phase_record(uuid, public.growth_phase, text, timestamptz) to authenticated;
grant execute on function public.soft_delete_own_growth_phase_record(uuid, text) to authenticated;
grant execute on function public.update_own_harvest_record(uuid, integer, text, text, timestamptz) to authenticated;
grant execute on function public.soft_delete_own_harvest_record(uuid, text) to authenticated;
grant execute on function public.update_own_manual_care_record(uuid, public.care_category, public.target_type, text, text, uuid, text, text, timestamptz) to authenticated;
grant execute on function public.soft_delete_own_manual_care_record(uuid, text) to authenticated;

revoke update, delete on public.harvest_records from authenticated;
revoke update, delete on public.manual_care_records from authenticated;

notify pgrst, 'reload schema';
