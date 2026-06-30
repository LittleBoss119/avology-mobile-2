create or replace function public.update_own_operational_report(
  p_report_id uuid,
  p_category public.operational_report_category,
  p_location_note text default null,
  p_description text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_report record;
  normalized_location_note text := nullif(trim(p_location_note), '');
  normalized_description text := nullif(trim(p_description), '');
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if normalized_location_note is null and normalized_description is null then
    raise exception 'Operational report location or description is required';
  end if;

  select id, farm_id, reported_by, status, responded_by, responded_at, owner_response_note
  into target_report
  from public.operational_reports
  where id = p_report_id;

  if not found then
    raise exception 'Operational report not found';
  end if;

  if not public.is_active_worker(target_report.farm_id, current_user_id) then
    raise exception 'Worker access is inactive';
  end if;

  if target_report.reported_by <> current_user_id then
    raise exception 'Only report creator can edit operational report';
  end if;

  if target_report.status <> 'new'
     or target_report.responded_by is not null
     or target_report.responded_at is not null
     or nullif(trim(target_report.owner_response_note), '') is not null then
    raise exception 'Operational report has already been responded to';
  end if;

  if exists (
    select 1
    from public.care_tasks ct
    where ct.operational_report_id = p_report_id
  ) then
    raise exception 'Operational report already has follow up task';
  end if;

  update public.operational_reports
  set category = p_category,
      location_note = normalized_location_note,
      description = normalized_description,
      updated_at = now()
  where id = p_report_id;
end;
$$;

revoke execute on function public.update_own_operational_report(uuid, public.operational_report_category, text, text) from public, anon;
grant execute on function public.update_own_operational_report(uuid, public.operational_report_category, text, text) to authenticated;

notify pgrst, 'reload schema';
