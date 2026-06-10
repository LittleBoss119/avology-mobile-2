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
  current_user_id uuid := auth.uid();
  new_farm_id uuid;
begin
  if current_user_id is null then
    raise exception 'User is not authenticated';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = current_user_id
  ) then
    raise exception 'Profile must exist before creating a farm';
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
    updated_at = now()
  returning id into membership_id;

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
      updated_at = now()
  where id = p_farm_member_id;
end;
$$;

create or replace function public.reject_worker(
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
    raise exception 'Only active owners can reject workers';
  end if;

  update public.farm_members
  set status = 'rejected',
      joined_at = null,
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
      updated_at = now()
  where id = p_farm_member_id;
end;
$$;

drop function if exists public.get_farm_member_basic_profiles(uuid, public.member_status);

create or replace function public.get_member_basic_profiles(
  p_farm_id uuid
)
returns table (
  user_id uuid,
  full_name text,
  phone text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_owner(p_farm_id, auth.uid()) then
    raise exception 'Only active owners can view farm member profiles';
  end if;

  return query
  select
    p.id as user_id,
    p.full_name,
    p.phone
  from public.farm_members fm
  join public.profiles p
    on p.id = fm.user_id
  where fm.farm_id = p_farm_id
    and fm.status in ('pending', 'active', 'rejected', 'removed')
  order by fm.created_at desc;
end;
$$;

create or replace function public.get_pending_workers(
  p_farm_id uuid
)
returns table (
  membership_id uuid,
  user_id uuid,
  full_name text,
  phone text,
  role public.member_role,
  status public.member_status,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_owner(p_farm_id, auth.uid()) then
    raise exception 'Only active owners can view pending workers';
  end if;

  return query
  select
    fm.id as membership_id,
    p.id as user_id,
    p.full_name,
    p.phone,
    fm.role,
    fm.status,
    fm.created_at
  from public.farm_members fm
  join public.profiles p
    on p.id = fm.user_id
  where fm.farm_id = p_farm_id
    and fm.role = 'worker'
    and fm.status = 'pending'
  order by fm.created_at desc;
end;
$$;

create or replace function public.get_active_workers(
  p_farm_id uuid
)
returns table (
  membership_id uuid,
  user_id uuid,
  full_name text,
  phone text,
  role public.member_role,
  status public.member_status,
  joined_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_owner(p_farm_id, auth.uid()) then
    raise exception 'Only active owners can view active workers';
  end if;

  return query
  select
    fm.id as membership_id,
    p.id as user_id,
    p.full_name,
    p.phone,
    fm.role,
    fm.status,
    fm.joined_at
  from public.farm_members fm
  join public.profiles p
    on p.id = fm.user_id
  where fm.farm_id = p_farm_id
    and fm.role = 'worker'
    and fm.status = 'active'
  order by fm.joined_at desc nulls last, fm.created_at desc;
end;
$$;

drop function if exists public.get_active_workers_for_picker(uuid);

create or replace function public.get_active_workers_for_task_picker(
  p_farm_id uuid
)
returns table (
  user_id uuid,
  full_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_owner(p_farm_id, auth.uid()) then
    raise exception 'Only active owners can view active worker picker';
  end if;

  return query
  select
    p.id as user_id,
    p.full_name
  from public.farm_members fm
  join public.profiles p
    on p.id = fm.user_id
  where fm.farm_id = p_farm_id
    and fm.role = 'worker'
    and fm.status = 'active'
  order by p.full_name;
end;
$$;

create or replace function public.create_schedule_from_sop(
  p_farm_id uuid,
  p_care_sop_id uuid,
  p_scheduled_date date,
  p_assigned_worker_id uuid,
  p_target_type public.target_type,
  p_target_row text default null,
  p_target_column text default null,
  p_target_tree_id uuid default null,
  p_instruction text default null
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
    due_date
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
    p_scheduled_date
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
  p_instruction text default null
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
    due_date
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
    p_scheduled_date
  )
  returning id into new_task_id;

  return query select new_schedule_id, new_task_id;
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
      updated_at = now()
  where id = p_operational_report_id;
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
  p_custom_target_note text default null
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
    due_date
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
    p_due_date
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

create or replace function public.complete_task(
  p_task_id uuid,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  task_farm_id uuid;
  task_assigned_to uuid;
  new_activity_id uuid;
begin
  select farm_id, assigned_to
  into task_farm_id, task_assigned_to
  from public.care_tasks
  where id = p_task_id;

  if task_farm_id is null then
    raise exception 'Task not found';
  end if;

  if task_assigned_to is distinct from current_user_id then
    raise exception 'Only the assigned worker can complete this task';
  end if;

  if not public.is_active_worker(task_farm_id, current_user_id) then
    raise exception 'Only active workers can complete tasks';
  end if;

  insert into public.care_activities (
    farm_id,
    care_task_id,
    performed_by,
    status,
    note
  )
  values (
    task_farm_id,
    p_task_id,
    current_user_id,
    'completed',
    p_note
  )
  returning id into new_activity_id;

  return new_activity_id;
end;
$$;

create or replace function public.postpone_task(
  p_task_id uuid,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  task_farm_id uuid;
  task_assigned_to uuid;
  new_activity_id uuid;
begin
  if p_note is null or length(trim(p_note)) = 0 then
    raise exception 'Postpone note is required';
  end if;

  select farm_id, assigned_to
  into task_farm_id, task_assigned_to
  from public.care_tasks
  where id = p_task_id;

  if task_farm_id is null then
    raise exception 'Task not found';
  end if;

  if task_assigned_to is distinct from current_user_id then
    raise exception 'Only the assigned worker can postpone this task';
  end if;

  if not public.is_active_worker(task_farm_id, current_user_id) then
    raise exception 'Only active workers can postpone tasks';
  end if;

  insert into public.care_activities (
    farm_id,
    care_task_id,
    performed_by,
    status,
    note
  )
  values (
    task_farm_id,
    p_task_id,
    current_user_id,
    'postponed',
    p_note
  )
  returning id into new_activity_id;

  return new_activity_id;
end;
$$;

revoke execute on function public.create_farm_with_owner(text, text, numeric) from public, anon;
revoke execute on function public.request_join_farm(text) from public, anon;
revoke execute on function public.approve_worker(uuid) from public, anon;
revoke execute on function public.reject_worker(uuid) from public, anon;
revoke execute on function public.remove_worker(uuid) from public, anon;
revoke execute on function public.get_member_basic_profiles(uuid) from public, anon;
revoke execute on function public.get_pending_workers(uuid) from public, anon;
revoke execute on function public.get_active_workers(uuid) from public, anon;
revoke execute on function public.get_active_workers_for_task_picker(uuid) from public, anon;
revoke execute on function public.create_schedule_from_sop(uuid, uuid, date, uuid, public.target_type, text, text, uuid, text) from public, anon;
revoke execute on function public.create_manual_schedule(uuid, text, public.care_category, date, uuid, public.target_type, text, text, uuid, text, text) from public, anon;
revoke execute on function public.create_task_from_operational_report(uuid, uuid, date, text, text, public.target_type, text, text, uuid, text) from public, anon;
revoke execute on function public.update_operational_report_status(uuid, public.operational_report_status) from public, anon;
revoke execute on function public.complete_task(uuid, text) from public, anon;
revoke execute on function public.postpone_task(uuid, text) from public, anon;

grant execute on function public.create_farm_with_owner(text, text, numeric) to authenticated;
grant execute on function public.request_join_farm(text) to authenticated;
grant execute on function public.approve_worker(uuid) to authenticated;
grant execute on function public.reject_worker(uuid) to authenticated;
grant execute on function public.remove_worker(uuid) to authenticated;
grant execute on function public.get_member_basic_profiles(uuid) to authenticated;
grant execute on function public.get_pending_workers(uuid) to authenticated;
grant execute on function public.get_active_workers(uuid) to authenticated;
grant execute on function public.get_active_workers_for_task_picker(uuid) to authenticated;
grant execute on function public.create_schedule_from_sop(uuid, uuid, date, uuid, public.target_type, text, text, uuid, text) to authenticated;
grant execute on function public.create_manual_schedule(uuid, text, public.care_category, date, uuid, public.target_type, text, text, uuid, text, text) to authenticated;
grant execute on function public.create_task_from_operational_report(uuid, uuid, date, text, text, public.target_type, text, text, uuid, text) to authenticated;
grant execute on function public.update_operational_report_status(uuid, public.operational_report_status) to authenticated;
grant execute on function public.complete_task(uuid, text) to authenticated;
grant execute on function public.postpone_task(uuid, text) to authenticated;
