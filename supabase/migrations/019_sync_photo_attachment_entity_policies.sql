insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avology-photos',
  'avology-photos',
  false,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.avology_storage_path_farm_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  if split_part(object_name, '/', 1) <> 'farms' then
    return null;
  end if;

  return nullif(split_part(object_name, '/', 2), '')::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create or replace function public.avology_storage_path_entity_folder(object_name text)
returns text
language sql
immutable
as $$
  select nullif(split_part(object_name, '/', 3), '');
$$;

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
drop constraint if exists photo_attachments_entity_type_check;

alter table public.photo_attachments
add constraint photo_attachments_entity_type_check
check (entity_type in (
  'tree_main',
  'condition_record',
  'operational_report',
  'task_proof'
));

alter table public.photo_attachments
drop constraint if exists photo_attachments_storage_path_farm_check;

alter table public.photo_attachments
add constraint photo_attachments_storage_path_farm_check
check (public.avology_storage_path_farm_id(storage_path) = farm_id);

alter table public.photo_attachments
drop constraint if exists photo_attachments_storage_path_entity_folder_check;

alter table public.photo_attachments
add constraint photo_attachments_storage_path_entity_folder_check
check (
  public.avology_storage_path_entity_folder(storage_path) =
  case entity_type
    when 'tree_main' then 'trees'
    when 'condition_record' then 'condition-reports'
    when 'operational_report' then 'operational-reports'
    when 'task_proof' then 'task-proofs'
  end
);

alter table public.photo_attachments
drop constraint if exists photo_attachments_storage_path_entity_id_check;

alter table public.photo_attachments
add constraint photo_attachments_storage_path_entity_id_check
check (public.avology_storage_path_entity_id(storage_path) = entity_id);

create or replace function public.can_access_condition_record_photo(
  p_farm_id uuid,
  p_condition_record_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tree_condition_reports tcr
    where tcr.id = p_condition_record_id
      and tcr.farm_id = p_farm_id
      and public.is_active_farm_member(p_farm_id, p_user_id)
  );
$$;

create or replace function public.can_upload_condition_record_photo(
  p_farm_id uuid,
  p_condition_record_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tree_condition_reports tcr
    where tcr.id = p_condition_record_id
      and tcr.farm_id = p_farm_id
      and tcr.reported_by = p_user_id
      and public.is_active_farm_member(p_farm_id, p_user_id)
  );
$$;

create or replace function public.can_access_operational_report_photo(
  p_farm_id uuid,
  p_report_id uuid,
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
      from public.operational_reports opr
      where opr.id = p_report_id
        and opr.farm_id = p_farm_id
        and opr.reported_by = p_user_id
        and public.is_active_worker(p_farm_id, p_user_id)
    );
$$;

create or replace function public.can_upload_operational_report_photo(
  p_farm_id uuid,
  p_report_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.operational_reports opr
    where opr.id = p_report_id
      and opr.farm_id = p_farm_id
      and opr.reported_by = p_user_id
      and public.is_active_worker(p_farm_id, p_user_id)
  );
$$;

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

drop policy if exists "Active members can view photo attachments" on public.photo_attachments;
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
    entity_type = 'operational_report'
    and public.can_access_operational_report_photo(farm_id, entity_id, auth.uid())
  )
  or (
    entity_type = 'task_proof'
    and public.can_access_task_proof_photo(farm_id, entity_id, auth.uid())
  )
);

drop policy if exists "Active members can insert photo attachments" on public.photo_attachments;
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
  )
);

drop policy if exists "Owners and uploaders can delete photo attachments" on public.photo_attachments;
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
        entity_type = 'operational_report'
        and public.can_upload_operational_report_photo(farm_id, entity_id, auth.uid())
      )
      or (
        entity_type = 'task_proof'
        and public.can_access_task_proof_photo(farm_id, entity_id, auth.uid())
      )
    )
  )
);

drop policy if exists "Active members can read avology photo objects" on storage.objects;
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
  )
);

drop policy if exists "Active members can upload avology photo objects" on storage.objects;
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
  )
);

drop policy if exists "Owners uploaders and orphan owners can delete avology photo objects" on storage.objects;
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
      )
    )
  )
);

grant select, insert, delete on public.photo_attachments to authenticated;

revoke execute on function public.avology_storage_path_farm_id(text) from public, anon;
revoke execute on function public.avology_storage_path_entity_folder(text) from public, anon;
revoke execute on function public.avology_storage_path_entity_id(text) from public, anon;
revoke execute on function public.avology_storage_path_task_id(text) from public, anon;
revoke execute on function public.can_access_condition_record_photo(uuid, uuid, uuid) from public, anon;
revoke execute on function public.can_upload_condition_record_photo(uuid, uuid, uuid) from public, anon;
revoke execute on function public.can_access_operational_report_photo(uuid, uuid, uuid) from public, anon;
revoke execute on function public.can_upload_operational_report_photo(uuid, uuid, uuid) from public, anon;
revoke execute on function public.can_access_task_proof_photo(uuid, uuid, uuid) from public, anon;
revoke execute on function public.can_upload_task_proof_photo(uuid, uuid, uuid, uuid) from public, anon;

grant execute on function public.avology_storage_path_farm_id(text) to authenticated;
grant execute on function public.avology_storage_path_entity_folder(text) to authenticated;
grant execute on function public.avology_storage_path_entity_id(text) to authenticated;
grant execute on function public.avology_storage_path_task_id(text) to authenticated;
grant execute on function public.can_access_condition_record_photo(uuid, uuid, uuid) to authenticated;
grant execute on function public.can_upload_condition_record_photo(uuid, uuid, uuid) to authenticated;
grant execute on function public.can_access_operational_report_photo(uuid, uuid, uuid) to authenticated;
grant execute on function public.can_upload_operational_report_photo(uuid, uuid, uuid) to authenticated;
grant execute on function public.can_access_task_proof_photo(uuid, uuid, uuid) to authenticated;
grant execute on function public.can_upload_task_proof_photo(uuid, uuid, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
