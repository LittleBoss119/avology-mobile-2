alter table public.care_schedules
add column if not exists requires_photo boolean not null default false;

alter table public.care_tasks
add column if not exists requires_photo boolean not null default false;

create or replace function public.avology_storage_path_entity_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  if public.avology_storage_path_entity_folder(object_name) = 'task-proofs' then
    return nullif(split_part(object_name, '/', 5), '')::uuid;
  end if;

  return nullif(split_part(object_name, '/', 4), '')::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create or replace function public.avology_storage_path_task_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  if public.avology_storage_path_entity_folder(object_name) <> 'task-proofs' then
    return null;
  end if;

  return nullif(split_part(object_name, '/', 4), '')::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

alter table public.photo_attachments
drop constraint if exists photo_attachments_storage_path_entity_id_check;

alter table public.photo_attachments
add constraint photo_attachments_storage_path_entity_id_check
check (public.avology_storage_path_entity_id(storage_path) = entity_id);

create or replace function public.can_access_task_proof_photo(
  p_farm_id uuid,
  p_activity_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    public.is_active_owner(p_farm_id, p_user_id)
    or exists (
      select 1
      from public.care_activities ca
      join public.care_tasks ct on ct.id = ca.care_task_id
      where ca.id = p_activity_id
        and ca.farm_id = p_farm_id
        and ct.farm_id = p_farm_id
        and ca.performed_by = p_user_id
        and ct.assigned_to = p_user_id
        and public.is_active_worker(p_farm_id, p_user_id)
    );
$$;

create or replace function public.can_upload_task_proof_photo(
  p_farm_id uuid,
  p_task_id uuid,
  p_activity_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.care_activities ca
    join public.care_tasks ct on ct.id = ca.care_task_id
    where ca.id = p_activity_id
      and ca.care_task_id = p_task_id
      and ca.farm_id = p_farm_id
      and ct.farm_id = p_farm_id
      and ca.performed_by = p_user_id
      and ct.assigned_to = p_user_id
      and public.is_active_worker(p_farm_id, p_user_id)
  );
$$;

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

create or replace function public.rollback_completed_task_activity(
  p_activity_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_activity record;
  previous_status public.task_status;
begin
  select ca.id, ca.farm_id, ca.care_task_id, ca.performed_by, ca.status, ct.assigned_to
  into target_activity
  from public.care_activities ca
  join public.care_tasks ct on ct.id = ca.care_task_id
  where ca.id = p_activity_id;

  if target_activity.id is null then
    raise exception 'Activity not found';
  end if;

  if target_activity.status <> 'completed' then
    raise exception 'Only completed activities can be rolled back';
  end if;

  if target_activity.performed_by is distinct from current_user_id
    or target_activity.assigned_to is distinct from current_user_id then
    raise exception 'Only the assigned worker can rollback this activity';
  end if;

  if not public.is_active_worker(target_activity.farm_id, current_user_id) then
    raise exception 'Only active workers can rollback task activities';
  end if;

  delete from public.care_activities
  where id = target_activity.id;

  select (ca.status::text)::public.task_status
  into previous_status
  from public.care_activities ca
  where ca.care_task_id = target_activity.care_task_id
  order by ca.performed_at desc
  limit 1;

  update public.care_tasks
  set status = coalesce(previous_status, 'pending'::public.task_status),
      updated_at = now()
  where id = target_activity.care_task_id;
end;
$$;

drop policy if exists "Allowed members can view photo attachments" on public.photo_attachments;
create policy "Allowed members can view photo attachments"
on public.photo_attachments
for select
to authenticated
using (
  (
    entity_type = 'operational_report'
    and public.can_access_operational_report_photo(farm_id, entity_id, auth.uid())
  )
  or (
    entity_type = 'task_proof'
    and public.can_access_task_proof_photo(farm_id, entity_id, auth.uid())
  )
  or (
    entity_type not in ('operational_report', 'task_proof')
    and public.is_active_farm_member(farm_id, auth.uid())
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
      entity_type not in ('tree_main', 'operational_report', 'task_proof')
      and public.is_active_farm_member(farm_id, auth.uid())
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
      public.avology_storage_path_entity_folder(name) not in ('operational-reports', 'task-proofs')
      and public.is_active_farm_member(
        public.avology_storage_path_farm_id(name),
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
      public.avology_storage_path_entity_folder(name) = 'condition-reports'
      and public.is_active_farm_member(
        public.avology_storage_path_farm_id(name),
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
        and pa.entity_type <> 'tree_main'
        and pa.uploaded_by = auth.uid()
    )
    or (
      public.avology_storage_path_entity_folder(name) <> 'trees'
      and not exists (
        select 1
        from public.photo_attachments pa
        where pa.bucket = storage.objects.bucket_id
          and pa.storage_path = storage.objects.name
      )
      and (
        (
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
          public.avology_storage_path_entity_folder(name) = 'condition-reports'
          and public.is_active_farm_member(
            public.avology_storage_path_farm_id(name),
            auth.uid()
          )
        )
      )
    )
  )
);

revoke execute on function public.avology_storage_path_task_id(text) from public, anon;
revoke execute on function public.can_access_task_proof_photo(uuid, uuid, uuid) from public, anon;
revoke execute on function public.can_upload_task_proof_photo(uuid, uuid, uuid, uuid) from public, anon;
revoke execute on function public.create_schedule_from_sop(uuid, uuid, date, uuid, public.target_type, text, text, uuid, text, boolean) from public, anon;
revoke execute on function public.create_manual_schedule(uuid, text, public.care_category, date, uuid, public.target_type, text, text, uuid, text, text, boolean) from public, anon;
revoke execute on function public.create_task_from_operational_report(uuid, uuid, date, text, text, public.target_type, text, text, uuid, text, boolean) from public, anon;
revoke execute on function public.rollback_completed_task_activity(uuid) from public, anon;

grant execute on function public.avology_storage_path_task_id(text) to authenticated;
grant execute on function public.can_access_task_proof_photo(uuid, uuid, uuid) to authenticated;
grant execute on function public.can_upload_task_proof_photo(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.create_schedule_from_sop(uuid, uuid, date, uuid, public.target_type, text, text, uuid, text, boolean) to authenticated;
grant execute on function public.create_manual_schedule(uuid, text, public.care_category, date, uuid, public.target_type, text, text, uuid, text, text, boolean) to authenticated;
grant execute on function public.create_task_from_operational_report(uuid, uuid, date, text, text, public.target_type, text, text, uuid, text, boolean) to authenticated;
grant execute on function public.rollback_completed_task_activity(uuid) to authenticated;
