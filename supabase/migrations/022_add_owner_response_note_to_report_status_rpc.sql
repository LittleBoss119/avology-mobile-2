create or replace function public.update_operational_report_status(
  p_operational_report_id uuid,
  p_status public.operational_report_status,
  p_owner_response_note text default null
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

revoke execute on function public.update_operational_report_status(uuid, public.operational_report_status, text) from public, anon;
grant execute on function public.update_operational_report_status(uuid, public.operational_report_status, text) to authenticated;

notify pgrst, 'reload schema';
