alter table public.care_schedules
add column if not exists requires_photo boolean;

update public.care_schedules
set requires_photo = false
where requires_photo is null;

alter table public.care_schedules
alter column requires_photo set default false,
alter column requires_photo set not null;

alter table public.care_tasks
add column if not exists requires_photo boolean;

update public.care_tasks
set requires_photo = false
where requires_photo is null;

alter table public.care_tasks
alter column requires_photo set default false,
alter column requires_photo set not null;

drop function if exists public.create_schedule_from_sop(
  uuid,
  uuid,
  date,
  uuid,
  public.target_type,
  text,
  text,
  uuid,
  text
);

drop function if exists public.create_manual_schedule(
  uuid,
  text,
  public.care_category,
  date,
  uuid,
  public.target_type,
  text,
  text,
  uuid,
  text,
  text
);

drop function if exists public.create_task_from_operational_report(
  uuid,
  uuid,
  date,
  text,
  text,
  public.target_type,
  text,
  text,
  uuid,
  text
);

create or replace function public.create_schedule_from_sop(
  p_farm_id uuid,
  p_care_sop_id uuid,
  p_scheduled_date date,
  p_assigned_worker_id uuid,
  p_target_type public.target_type,
  p_target_row text default null,
  p_target_column text default null,
  p_target_tree_id uuid default null,
  p_instruction text default null,
  p_requires_photo boolean default false
)
returns table (
  schedule_id uuid,
  task_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  sop_name text;
  sop_category public.care_category;
  sop_instruction text;
  new_schedule_id uuid;
  new_task_id uuid;
begin
  if not public.is_active_owner(p_farm_id, current_user_id) then
    raise exception 'Only active owners can create schedules from SOP';
  end if;

  if p_target_type = 'custom' then
    raise exception 'SOP schedules cannot use custom target';
  end if;

  if not public.is_active_worker(p_farm_id, p_assigned_worker_id) then
    raise exception 'Schedule tasks can only be assigned to active workers';
  end if;

  select name, category, default_instruction
  into sop_name, sop_category, sop_instruction
  from public.care_sops
  where id = p_care_sop_id
    and farm_id = p_farm_id
    and is_active = true;

  if sop_name is null then
    raise exception 'Active SOP not found for farm';
  end if;

  insert into public.care_schedules (
    farm_id,
    care_sop_id,
    title,
    category,
    scheduled_date,
    target_type,
    target_row,
    target_column,
    target_tree_id,
    custom_target_note,
    instruction,
    requires_photo,
    created_by
  )
  values (
    p_farm_id,
    p_care_sop_id,
    sop_name,
    sop_category,
    p_scheduled_date,
    p_target_type,
    p_target_row,
    p_target_column,
    p_target_tree_id,
    null,
    coalesce(p_instruction, sop_instruction),
    coalesce(p_requires_photo, false),
    current_user_id
  )
  returning id into new_schedule_id;

  insert into public.care_tasks (
    farm_id,
    care_schedule_id,
    assigned_to,
    assigned_by,
    title,
    category,
    instruction,
    target_type,
    target_row,
    target_column,
    target_tree_id,
    custom_target_note,
    due_date,
    requires_photo
  )
  values (
    p_farm_id,
    new_schedule_id,
    p_assigned_worker_id,
    current_user_id,
    sop_name,
    sop_category,
    coalesce(p_instruction, sop_instruction),
    p_target_type,
    p_target_row,
    p_target_column,
    p_target_tree_id,
    null,
    p_scheduled_date,
    coalesce(p_requires_photo, false)
  )
  returning id into new_task_id;

  return query select new_schedule_id, new_task_id;
end;
$$;

create or replace function public.create_manual_schedule(
  p_farm_id uuid,
  p_title text,
  p_category public.care_category,
  p_scheduled_date date,
  p_assigned_worker_id uuid,
  p_target_type public.target_type,
  p_target_row text default null,
  p_target_column text default null,
  p_target_tree_id uuid default null,
  p_custom_target_note text default null,
  p_instruction text default null,
  p_requires_photo boolean default false
)
returns table (
  schedule_id uuid,
  task_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_schedule_id uuid;
  new_task_id uuid;
begin
  if not public.is_active_owner(p_farm_id, current_user_id) then
    raise exception 'Only active owners can create manual schedules';
  end if;

  if not public.is_active_worker(p_farm_id, p_assigned_worker_id) then
    raise exception 'Schedule tasks can only be assigned to active workers';
  end if;

  insert into public.care_schedules (
    farm_id,
    care_sop_id,
    title,
    category,
    scheduled_date,
    target_type,
    target_row,
    target_column,
    target_tree_id,
    custom_target_note,
    instruction,
    requires_photo,
    created_by
  )
  values (
    p_farm_id,
    null,
    p_title,
    p_category,
    p_scheduled_date,
    p_target_type,
    p_target_row,
    p_target_column,
    p_target_tree_id,
    p_custom_target_note,
    p_instruction,
    coalesce(p_requires_photo, false),
    current_user_id
  )
  returning id into new_schedule_id;

  insert into public.care_tasks (
    farm_id,
    care_schedule_id,
    assigned_to,
    assigned_by,
    title,
    category,
    instruction,
    target_type,
    target_row,
    target_column,
    target_tree_id,
    custom_target_note,
    due_date,
    requires_photo
  )
  values (
    p_farm_id,
    new_schedule_id,
    p_assigned_worker_id,
    current_user_id,
    p_title,
    p_category,
    p_instruction,
    p_target_type,
    p_target_row,
    p_target_column,
    p_target_tree_id,
    p_custom_target_note,
    p_scheduled_date,
    coalesce(p_requires_photo, false)
  )
  returning id into new_task_id;

  return query select new_schedule_id, new_task_id;
end;
$$;

create or replace function public.create_task_from_operational_report(
  p_operational_report_id uuid,
  p_assigned_worker_id uuid,
  p_due_date date,
  p_title text,
  p_instruction text,
  p_target_type public.target_type,
  p_target_row text default null,
  p_target_column text default null,
  p_target_tree_id uuid default null,
  p_custom_target_note text default null,
  p_requires_photo boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  report_farm_id uuid;
  new_task_id uuid;
begin
  select farm_id
  into report_farm_id
  from public.operational_reports
  where id = p_operational_report_id;

  if report_farm_id is null then
    raise exception 'Operational report not found';
  end if;

  if not public.is_active_owner(report_farm_id, current_user_id) then
    raise exception 'Only active owners can create task from operational report';
  end if;

  if not public.is_active_worker(report_farm_id, p_assigned_worker_id) then
    raise exception 'Report follow-up tasks can only be assigned to active workers';
  end if;

  insert into public.care_tasks (
    farm_id,
    operational_report_id,
    assigned_to,
    assigned_by,
    title,
    category,
    instruction,
    target_type,
    target_row,
    target_column,
    target_tree_id,
    custom_target_note,
    due_date,
    requires_photo
  )
  values (
    report_farm_id,
    p_operational_report_id,
    p_assigned_worker_id,
    current_user_id,
    p_title,
    null,
    p_instruction,
    p_target_type,
    p_target_row,
    p_target_column,
    p_target_tree_id,
    p_custom_target_note,
    p_due_date,
    coalesce(p_requires_photo, false)
  )
  returning id into new_task_id;

  if exists (
    select 1
    from public.operational_reports
    where id = p_operational_report_id
      and status = 'new'
  ) then
    perform public.update_operational_report_status(
      p_operational_report_id,
      'in_progress'
    );
  end if;

  return new_task_id;
end;
$$;

revoke execute on function public.create_schedule_from_sop(uuid, uuid, date, uuid, public.target_type, text, text, uuid, text, boolean) from public, anon;
revoke execute on function public.create_manual_schedule(uuid, text, public.care_category, date, uuid, public.target_type, text, text, uuid, text, text, boolean) from public, anon;
revoke execute on function public.create_task_from_operational_report(uuid, uuid, date, text, text, public.target_type, text, text, uuid, text, boolean) from public, anon;

grant execute on function public.create_schedule_from_sop(uuid, uuid, date, uuid, public.target_type, text, text, uuid, text, boolean) to authenticated;
grant execute on function public.create_manual_schedule(uuid, text, public.care_category, date, uuid, public.target_type, text, text, uuid, text, text, boolean) to authenticated;
grant execute on function public.create_task_from_operational_report(uuid, uuid, date, text, text, public.target_type, text, text, uuid, text, boolean) to authenticated;

notify pgrst, 'reload schema';
