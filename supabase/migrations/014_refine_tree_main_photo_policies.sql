create or replace function public.avology_storage_path_entity_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
begin
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
      entity_type <> 'tree_main'
      and public.is_active_farm_member(farm_id, auth.uid())
    )
  )
);

revoke execute on function public.avology_storage_path_entity_id(text) from public, anon;
grant execute on function public.avology_storage_path_entity_id(text) to authenticated;

drop policy if exists "Owners and uploaders can delete photo attachments" on public.photo_attachments;
drop policy if exists "Allowed members can delete photo attachments" on public.photo_attachments;
create policy "Allowed members can delete photo attachments"
on public.photo_attachments
for delete
to authenticated
using (
  public.is_active_owner(farm_id, auth.uid())
  or (
    entity_type <> 'tree_main'
    and public.is_active_farm_member(farm_id, auth.uid())
    and uploaded_by = auth.uid()
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
      public.avology_storage_path_entity_folder(name) in (
        'condition-reports',
        'operational-reports',
        'task-proofs'
      )
      and public.is_active_farm_member(
        public.avology_storage_path_farm_id(name),
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
        and pa.entity_type <> 'tree_main'
        and pa.uploaded_by = auth.uid()
    )
    or (
      public.avology_storage_path_entity_folder(name) <> 'trees'
      and public.is_active_farm_member(
        public.avology_storage_path_farm_id(name),
        auth.uid()
      )
      and not exists (
        select 1
        from public.photo_attachments pa
        where pa.bucket = storage.objects.bucket_id
          and pa.storage_path = storage.objects.name
      )
    )
  )
);
