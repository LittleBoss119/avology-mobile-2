-- 034: model keputusan laporan operasional
-- - kolom resolution + resolved_at
-- - perbaikan laporan rejected yang punya tugas
-- - guard transisi status di RPC
-- - owner_response_note bisa dikosongkan
-- - kategori pada tugas tindak lanjut
-- - hapus laporan sendiri

begin;

-- ============ 1. Kolom baru ============

alter table public.operational_reports
  add column if not exists resolution text,
  add column if not exists resolved_at timestamptz;

alter table public.operational_reports
  drop constraint if exists operational_reports_resolution_check;

alter table public.operational_reports
  add constraint operational_reports_resolution_check
  check (resolution is null or resolution in ('task', 'self_handled', 'already_ok'));

-- ============ 2. Perbaikan data ============
-- Laporan ditolak yang ternyata punya tugas tindak lanjut.
-- Semua tugas selesai -> resolved. Masih ada yang berjalan -> in_progress.

update public.operational_reports r
set status = case
      when not exists (
        select 1 from public.care_tasks t
        where t.operational_report_id = r.id
          and t.status <> 'completed'
      ) then 'resolved'::public.operational_report_status
      else 'in_progress'::public.operational_report_status
    end,
    updated_at = now()
where r.status = 'rejected'
  and exists (
    select 1 from public.care_tasks t where t.operational_report_id = r.id
  );

-- ============ 3. Backfill ============

update public.operational_reports r
set resolution = case
      when exists (
        select 1 from public.care_tasks t where t.operational_report_id = r.id
      ) then 'task'
      when r.status = 'in_progress' then 'self_handled'
      when r.status = 'resolved' then 'already_ok'
      else null
    end,
    resolved_at = case
      when r.status in ('resolved', 'rejected')
        then coalesce(r.responded_at, r.updated_at, r.created_at)
      else null
    end
where r.status <> 'new'
  and r.resolution is null;

alter table public.operational_reports
  drop constraint if exists operational_reports_resolution_status_check;

alter table public.operational_reports
  add constraint operational_reports_resolution_status_check
  check (
    (status = 'new' and resolution is null and resolved_at is null)
    or (status = 'in_progress' and resolution in ('task', 'self_handled'))
    or (status = 'resolved' and resolution is not null)
    or (status = 'rejected' and resolution is null)
  ) not valid;

-- ============ 4. Bersihkan overload lama ============

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'update_operational_report_status',
        'create_task_from_operational_report'
      )
  loop
    execute format('drop function if exists %s', fn.sig);
  end loop;
end;
$$;

-- ============ 5. update_operational_report_status ============
-- p_owner_response_note: null = pertahankan catatan lama,
--                        '' = hapus catatan, teks = ganti catatan.
-- p_resolution: null = pertahankan resolution lama.

create or replace function public.update_operational_report_status(
  p_operational_report_id uuid,
  p_status public.operational_report_status,
  p_owner_response_note text default null,
  p_resolution text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  current_user_id uuid := auth.uid();
  target_report record;
  final_note text;
  final_resolution text;
  has_task boolean;
begin
  select id, farm_id, status, owner_response_note, resolution
  into target_report
  from public.operational_reports
  where id = p_operational_report_id;

  if not found then
    raise exception 'Operational report not found';
  end if;

  if not public.is_active_owner(target_report.farm_id, current_user_id) then
    raise exception 'Only active owners can update operational report status';
  end if;

  if target_report.status not in ('new', 'in_progress') then
    raise exception 'Operational report is already closed';
  end if;

  if p_status = 'new' then
    raise exception 'Operational report cannot be moved back to new';
  end if;

  if p_owner_response_note is null then
    final_note := target_report.owner_response_note;
  else
    final_note := nullif(btrim(p_owner_response_note), '');
  end if;

  select exists (
    select 1 from public.care_tasks t
    where t.operational_report_id = p_operational_report_id
  ) into has_task;

  if p_status = 'rejected' then
    if target_report.status <> 'new' then
      raise exception 'Only untouched operational reports can be rejected';
    end if;
    if has_task then
      raise exception 'Operational report with follow up task cannot be rejected';
    end if;
    if final_note is null then
      raise exception 'Rejection reason is required';
    end if;
    final_resolution := null;
  else
    final_resolution := coalesce(nullif(btrim(p_resolution), ''), target_report.resolution);

    if p_status = 'in_progress'
       and (final_resolution is null or final_resolution not in ('task', 'self_handled')) then
      raise exception 'Operational report resolution is required';
    end if;

    if p_status = 'resolved' and final_resolution is null then
      raise exception 'Operational report resolution is required';
    end if;

    if final_resolution = 'self_handled' and final_note is null then
      raise exception 'Owner note is required when handling the report directly';
    end if;

    if final_resolution = 'task' and not has_task then
      raise exception 'Operational report has no follow up task';
    end if;
  end if;

  update public.operational_reports
  set status = p_status,
      owner_response_note = final_note,
      resolution = final_resolution,
      responded_by = current_user_id,
      responded_at = now(),
      resolved_at = case
        when p_status in ('resolved', 'rejected') then now()
        else null
      end,
      updated_at = now()
  where id = p_operational_report_id;
end;
$function$;

-- ============ 6. create_task_from_operational_report ============

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
  p_requires_photo boolean default false,
  p_category public.care_category default null,
  p_owner_response_note text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  current_user_id uuid := auth.uid();
  target_report record;
  new_task_id uuid;
  final_note text;
begin
  select id, farm_id, status, owner_response_note
  into target_report
  from public.operational_reports
  where id = p_operational_report_id;

  if not found then
    raise exception 'Operational report not found';
  end if;

  if not public.is_active_owner(target_report.farm_id, current_user_id) then
    raise exception 'Only active owners can create task from operational report';
  end if;

  if target_report.status not in ('new', 'in_progress') then
    raise exception 'Operational report is already closed';
  end if;

  if not public.is_active_worker(target_report.farm_id, p_assigned_worker_id) then
    raise exception 'Report follow-up tasks can only be assigned to active workers';
  end if;

  if exists (
    select 1 from public.care_tasks t
    where t.operational_report_id = p_operational_report_id
      and t.status in ('pending', 'postponed')
  ) then
    raise exception 'Operational report already has an open follow up task';
  end if;

  if p_owner_response_note is null then
    final_note := target_report.owner_response_note;
  else
    final_note := nullif(btrim(p_owner_response_note), '');
  end if;

  insert into public.care_tasks (
    farm_id, operational_report_id, assigned_to, assigned_by,
    title, category, instruction,
    target_type, target_row, target_column, target_tree_id, custom_target_note,
    due_date, requires_photo
  )
  values (
    target_report.farm_id, p_operational_report_id, p_assigned_worker_id, current_user_id,
    p_title, p_category, p_instruction,
    p_target_type, p_target_row, p_target_column, p_target_tree_id, p_custom_target_note,
    p_due_date, coalesce(p_requires_photo, false)
  )
  returning id into new_task_id;

  update public.operational_reports
  set status = 'in_progress'::public.operational_report_status,
      resolution = 'task',
      owner_response_note = final_note,
      responded_by = current_user_id,
      responded_at = now(),
      resolved_at = null,
      updated_at = now()
  where id = p_operational_report_id;

  return new_task_id;
end;
$function$;

-- ============ 7. delete_own_operational_report ============

create or replace function public.delete_own_operational_report(
  p_report_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  current_user_id uuid := auth.uid();
  target_report record;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
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
    raise exception 'Only report creator can delete operational report';
  end if;

  if target_report.status <> 'new'
     or target_report.responded_by is not null
     or target_report.responded_at is not null
     or nullif(btrim(target_report.owner_response_note), '') is not null then
    raise exception 'Operational report has already been responded to';
  end if;

  if exists (
    select 1 from public.care_tasks t where t.operational_report_id = p_report_id
  ) then
    raise exception 'Operational report already has follow up task';
  end if;

  delete from public.photo_attachments
  where entity_type = 'operational_report'
    and entity_id = p_report_id;

  delete from public.operational_reports where id = p_report_id;
end;
$function$;

-- ============ 8. Grant ============

grant execute on function public.update_operational_report_status(
  uuid, public.operational_report_status, text, text
) to authenticated;

grant execute on function public.create_task_from_operational_report(
  uuid, uuid, date, text, text, public.target_type,
  text, text, uuid, text, boolean, public.care_category, text
) to authenticated;

grant execute on function public.delete_own_operational_report(uuid) to authenticated;

commit;