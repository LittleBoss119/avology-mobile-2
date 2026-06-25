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

create table if not exists public.photo_attachments (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  entity_type text not null,
  entity_id uuid not null,
  bucket text not null default 'avology-photos',
  storage_path text not null,
  file_name text,
  mime_type text,
  file_size integer,
  caption text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),

  constraint photo_attachments_entity_type_check
    check (entity_type in (
      'tree_main',
      'condition_record',
      'operational_report',
      'task_proof'
    )),
  constraint photo_attachments_bucket_path_unique unique (bucket, storage_path),
  constraint photo_attachments_bucket_check check (bucket = 'avology-photos'),
  constraint photo_attachments_mime_type_check
    check (mime_type is null or mime_type like 'image/%'),
  constraint photo_attachments_file_size_check
    check (file_size is null or (file_size > 0 and file_size <= 5242880))
);

create index if not exists idx_photo_attachments_entity
on public.photo_attachments(farm_id, entity_type, entity_id, created_at desc);

create index if not exists idx_photo_attachments_uploaded_by
on public.photo_attachments(uploaded_by);

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

alter table public.photo_attachments enable row level security;

drop policy if exists "Active members can view photo attachments" on public.photo_attachments;
create policy "Active members can view photo attachments"
on public.photo_attachments
for select
to authenticated
using (public.is_active_farm_member(farm_id, auth.uid()));

drop policy if exists "Active members can insert photo attachments" on public.photo_attachments;
create policy "Active members can insert photo attachments"
on public.photo_attachments
for insert
to authenticated
with check (
  public.is_active_farm_member(farm_id, auth.uid())
  and uploaded_by = auth.uid()
  and bucket = 'avology-photos'
  and public.avology_storage_path_farm_id(storage_path) = farm_id
);

drop policy if exists "Owners and uploaders can delete photo attachments" on public.photo_attachments;
create policy "Owners and uploaders can delete photo attachments"
on public.photo_attachments
for delete
to authenticated
using (
  public.is_active_owner(farm_id, auth.uid())
  or (
    public.is_active_farm_member(farm_id, auth.uid())
    and uploaded_by = auth.uid()
  )
);

drop policy if exists "Active members can read avology photo objects" on storage.objects;
create policy "Active members can read avology photo objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avology-photos'
  and public.is_active_farm_member(
    public.avology_storage_path_farm_id(name),
    auth.uid()
  )
);

drop policy if exists "Active members can upload avology photo objects" on storage.objects;
create policy "Active members can upload avology photo objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avology-photos'
  and public.avology_storage_path_entity_folder(name) in (
    'trees',
    'condition-reports',
    'operational-reports',
    'task-proofs'
  )
  and public.is_active_farm_member(
    public.avology_storage_path_farm_id(name),
    auth.uid()
  )
);

drop policy if exists "Owners uploaders and orphan owners can delete avology photo objects" on storage.objects;
create policy "Owners uploaders and orphan owners can delete avology photo objects"
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
      public.is_active_farm_member(
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

grant select, insert, delete on public.photo_attachments to authenticated;

revoke execute on function public.avology_storage_path_farm_id(text) from public, anon;
revoke execute on function public.avology_storage_path_entity_folder(text) from public, anon;

grant execute on function public.avology_storage_path_farm_id(text) to authenticated;
grant execute on function public.avology_storage_path_entity_folder(text) to authenticated;
