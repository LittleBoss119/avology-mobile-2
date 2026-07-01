drop function if exists public.update_operational_report_status(
  uuid,
  public.operational_report_status
);

drop function if exists public.update_operational_report_status(
  uuid,
  public.operational_report_status,
  text
);

create function public.update_operational_report_status(
  p_operational_report_id uuid,
  p_status public.operational_report_status,
  p_owner_response_note text
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
      owner_response_note = coalesce(nullif(trim(p_owner_response_note), ''), owner_response_note),
      responded_by = current_user_id,
      responded_at = now(),
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
      'in_progress'::public.operational_report_status,
      null
    );
  end if;

  return new_task_id;
end;
$$;

revoke execute on function public.update_operational_report_status(
  uuid,
  public.operational_report_status,
  text
) from public, anon;

revoke execute on function public.create_task_from_operational_report(
  uuid,
  uuid,
  date,
  text,
  text,
  public.target_type,
  text,
  text,
  uuid,
  text,
  boolean
) from public, anon;

grant execute on function public.update_operational_report_status(
  uuid,
  public.operational_report_status,
  text
) to authenticated;

grant execute on function public.create_task_from_operational_report(
  uuid,
  uuid,
  date,
  text,
  text,
  public.target_type,
  text,
  text,
  uuid,
  text,
  boolean
) to authenticated;

notify pgrst, 'reload schema';
