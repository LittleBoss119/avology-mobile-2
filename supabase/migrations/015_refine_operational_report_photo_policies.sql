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

drop policy if exists "Active members can view photo attachments" on public.photo_attachments;
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
    entity_type <> 'operational_report'
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
      entity_type not in ('tree_main', 'operational_report')
      and public.is_active_farm_member(farm_id, auth.uid())
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
      public.avology_storage_path_entity_folder(name) = 'operational-reports'
      and public.can_access_operational_report_photo(
        public.avology_storage_path_farm_id(name),
        public.avology_storage_path_entity_id(name),
        auth.uid()
      )
    )
    or (
      public.avology_storage_path_entity_folder(name) <> 'operational-reports'
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
      public.avology_storage_path_entity_folder(name) in (
        'condition-reports',
        'task-proofs'
      )
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
          public.avology_storage_path_entity_folder(name) <> 'operational-reports'
          and public.is_active_farm_member(
            public.avology_storage_path_farm_id(name),
            auth.uid()
          )
        )
      )
    )
  )
);

revoke execute on function public.can_access_operational_report_photo(uuid, uuid, uuid) from public, anon;
revoke execute on function public.can_upload_operational_report_photo(uuid, uuid, uuid) from public, anon;
grant execute on function public.can_access_operational_report_photo(uuid, uuid, uuid) to authenticated;
grant execute on function public.can_upload_operational_report_photo(uuid, uuid, uuid) to authenticated;
