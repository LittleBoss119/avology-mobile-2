create index if not exists idx_farm_members_farm_user
on public.farm_members(farm_id, user_id);

create index if not exists idx_farm_members_farm_status
on public.farm_members(farm_id, status);

create index if not exists idx_farm_members_user_status
on public.farm_members(user_id, status);

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

create index if not exists idx_care_sops_farm_active
on public.care_sops(farm_id, is_active);

create index if not exists idx_care_schedules_farm_date
on public.care_schedules(farm_id, scheduled_date);

create index if not exists idx_care_tasks_assigned_due_date
on public.care_tasks(assigned_to, due_date);

create index if not exists idx_care_tasks_farm_status
on public.care_tasks(farm_id, status);

create index if not exists idx_care_tasks_schedule
on public.care_tasks(care_schedule_id);

create index if not exists idx_care_tasks_operational_report
on public.care_tasks(operational_report_id);

create index if not exists idx_care_activities_task
on public.care_activities(care_task_id);

create index if not exists idx_growth_phase_records_tree_recorded_at
on public.growth_phase_records(tree_id, recorded_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.generate_join_code()
returns text
language plpgsql
security definer
set search_path = public
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

create or replace function public.prevent_tree_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Trees must be archived or unarchived, not permanently deleted';
end;
$$;

create or replace function public.sync_tree_current_condition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.trees
  set current_condition = new.condition_status,
      updated_at = now()
  where id = new.tree_id;

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
  update public.trees
  set current_growth_phase = new.phase,
      updated_at = now()
  where id = new.tree_id;

  return new;
end;
$$;

create or replace function public.sync_task_status_from_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.care_tasks
  set status = new.status::public.task_status,
      updated_at = now()
  where id = new.care_task_id;

  return new;
end;
$$;

create or replace function public.validate_tree_condition_report()
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
    raise exception 'Tree condition report tree must belong to the same farm';
  end if;

  if not exists (
    select 1
    from public.farm_members
    where farm_id = new.farm_id
      and user_id = new.reported_by
      and status = 'active'
  ) then
    raise exception 'Only active farm members can create tree condition reports';
  end if;

  return new;
end;
$$;

create or replace function public.validate_operational_report_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.farm_members
    where farm_id = new.farm_id
      and user_id = new.reported_by
      and role = 'worker'
      and status = 'active'
  ) then
    raise exception 'Only active workers can create operational reports';
  end if;

  return new;
end;
$$;

create or replace function public.validate_care_sop()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tree_farm_id uuid;
begin
  if new.default_target_type = 'tree' then
    select farm_id into tree_farm_id
    from public.trees
    where id = new.default_target_tree_id;

    if tree_farm_id is distinct from new.farm_id then
      raise exception 'SOP default target tree must belong to the same farm';
    end if;
  end if;

  if not exists (
    select 1
    from public.farm_members
    where farm_id = new.farm_id
      and user_id = new.created_by
      and role = 'owner'
      and status = 'active'
  ) then
    raise exception 'Only active owners can manage care SOPs';
  end if;

  return new;
end;
$$;

create or replace function public.validate_care_schedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sop_farm_id uuid;
  tree_farm_id uuid;
begin
  if new.care_sop_id is not null then
    select farm_id into sop_farm_id
    from public.care_sops
    where id = new.care_sop_id;

    if sop_farm_id is distinct from new.farm_id then
      raise exception 'Care schedule SOP must belong to the same farm';
    end if;
  end if;

  if new.target_type = 'tree' then
    select farm_id into tree_farm_id
    from public.trees
    where id = new.target_tree_id;

    if tree_farm_id is distinct from new.farm_id then
      raise exception 'Care schedule target tree must belong to the same farm';
    end if;
  end if;

  if not exists (
    select 1
    from public.farm_members
    where farm_id = new.farm_id
      and user_id = new.created_by
      and role = 'owner'
      and status = 'active'
  ) then
    raise exception 'Only active owners can manage care schedules';
  end if;

  return new;
end;
$$;

create or replace function public.validate_care_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  schedule_farm_id uuid;
  schedule_from_sop boolean := false;
  report_farm_id uuid;
  tree_farm_id uuid;
begin
  if new.care_schedule_id is not null then
    select farm_id, care_sop_id is not null
    into schedule_farm_id, schedule_from_sop
    from public.care_schedules
    where id = new.care_schedule_id;

    if schedule_farm_id is distinct from new.farm_id then
      raise exception 'Care task schedule must belong to the same farm';
    end if;
  end if;

  if new.operational_report_id is not null then
    select farm_id into report_farm_id
    from public.operational_reports
    where id = new.operational_report_id;

    if report_farm_id is distinct from new.farm_id then
      raise exception 'Care task operational report must belong to the same farm';
    end if;
  end if;

  if new.target_type = 'tree' then
    select farm_id into tree_farm_id
    from public.trees
    where id = new.target_tree_id;

    if tree_farm_id is distinct from new.farm_id then
      raise exception 'Care task target tree must belong to the same farm';
    end if;
  end if;

  if new.target_type = 'custom' and schedule_from_sop then
    raise exception 'Tasks created from SOP schedules cannot use custom target';
  end if;

  if not exists (
    select 1
    from public.farm_members
    where farm_id = new.farm_id
      and user_id = new.assigned_to
      and role = 'worker'
      and status = 'active'
  ) then
    raise exception 'Care tasks can only be assigned to active workers';
  end if;

  if not exists (
    select 1
    from public.farm_members
    where farm_id = new.farm_id
      and user_id = new.assigned_by
      and role = 'owner'
      and status = 'active'
  ) then
    raise exception 'Care tasks can only be assigned by active owners';
  end if;

  return new;
end;
$$;

create or replace function public.validate_care_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  task_farm_id uuid;
  task_assigned_to uuid;
begin
  select farm_id, assigned_to
  into task_farm_id, task_assigned_to
  from public.care_tasks
  where id = new.care_task_id;

  if task_farm_id is distinct from new.farm_id then
    raise exception 'Care activity task must belong to the same farm';
  end if;

  if task_assigned_to is distinct from new.performed_by then
    raise exception 'Only the assigned worker can create care activity for a task';
  end if;

  if not exists (
    select 1
    from public.farm_members
    where farm_id = new.farm_id
      and user_id = new.performed_by
      and role = 'worker'
      and status = 'active'
  ) then
    raise exception 'Only active workers can create care activities';
  end if;

  return new;
end;
$$;

create or replace function public.validate_growth_phase_record()
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
    raise exception 'Growth phase record tree must belong to the same farm';
  end if;

  if not exists (
    select 1
    from public.farm_members
    where farm_id = new.farm_id
      and user_id = new.recorded_by
      and status = 'active'
  ) then
    raise exception 'Only active farm members can create growth phase records';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_tree_delete_trigger on public.trees;
create trigger prevent_tree_delete_trigger
before delete on public.trees
for each row
execute function public.prevent_tree_delete();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_farms_updated_at on public.farms;
create trigger set_farms_updated_at
before update on public.farms
for each row
execute function public.set_updated_at();

drop trigger if exists set_farm_members_updated_at on public.farm_members;
create trigger set_farm_members_updated_at
before update on public.farm_members
for each row
execute function public.set_updated_at();

drop trigger if exists set_trees_updated_at on public.trees;
create trigger set_trees_updated_at
before update on public.trees
for each row
execute function public.set_updated_at();

drop trigger if exists set_operational_reports_updated_at on public.operational_reports;
create trigger set_operational_reports_updated_at
before update on public.operational_reports
for each row
execute function public.set_updated_at();

drop trigger if exists set_care_sops_updated_at on public.care_sops;
create trigger set_care_sops_updated_at
before update on public.care_sops
for each row
execute function public.set_updated_at();

drop trigger if exists set_care_schedules_updated_at on public.care_schedules;
create trigger set_care_schedules_updated_at
before update on public.care_schedules
for each row
execute function public.set_updated_at();

drop trigger if exists set_care_tasks_updated_at on public.care_tasks;
create trigger set_care_tasks_updated_at
before update on public.care_tasks
for each row
execute function public.set_updated_at();

drop trigger if exists validate_tree_condition_report_trigger on public.tree_condition_reports;
create trigger validate_tree_condition_report_trigger
before insert on public.tree_condition_reports
for each row
execute function public.validate_tree_condition_report();

drop trigger if exists sync_tree_current_condition_trigger on public.tree_condition_reports;
create trigger sync_tree_current_condition_trigger
after insert on public.tree_condition_reports
for each row
execute function public.sync_tree_current_condition();

drop trigger if exists validate_operational_report_insert_trigger on public.operational_reports;
create trigger validate_operational_report_insert_trigger
before insert on public.operational_reports
for each row
execute function public.validate_operational_report_insert();

drop trigger if exists validate_care_sop_trigger on public.care_sops;
create trigger validate_care_sop_trigger
before insert or update on public.care_sops
for each row
execute function public.validate_care_sop();

drop trigger if exists validate_care_schedule_trigger on public.care_schedules;
create trigger validate_care_schedule_trigger
before insert or update on public.care_schedules
for each row
execute function public.validate_care_schedule();

drop trigger if exists validate_care_task_trigger on public.care_tasks;
create trigger validate_care_task_trigger
before insert or update on public.care_tasks
for each row
execute function public.validate_care_task();

drop trigger if exists validate_care_activity_trigger on public.care_activities;
create trigger validate_care_activity_trigger
before insert on public.care_activities
for each row
execute function public.validate_care_activity();

drop trigger if exists sync_task_status_from_activity_trigger on public.care_activities;
create trigger sync_task_status_from_activity_trigger
after insert on public.care_activities
for each row
execute function public.sync_task_status_from_activity();

drop trigger if exists validate_growth_phase_record_trigger on public.growth_phase_records;
create trigger validate_growth_phase_record_trigger
before insert on public.growth_phase_records
for each row
execute function public.validate_growth_phase_record();

drop trigger if exists sync_tree_current_growth_phase_trigger on public.growth_phase_records;
create trigger sync_tree_current_growth_phase_trigger
after insert on public.growth_phase_records
for each row
execute function public.sync_tree_current_growth_phase();
