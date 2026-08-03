-- 035: dukungan foto untuk laporan operasional
-- Mengembalikan kemampuan yang dicabut migration 031.
-- Path: farms/{farmId}/operational-reports/{reportId}/{file}

begin;

-- ============ 1. Helper akses ============
-- Baca: owner aktif, atau pekerja pembuat laporan.

create or replace function public.can_access_operational_report_photo(
  p_farm_id uuid,
  p_report_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path to 'public'
as $function$
  select
    exists (
      select 1
      from public.operational_reports r
      where r.id = p_report_id
        and r.farm_id = p_farm_id
    )
    and (
      public.is_active_owner(p_farm_id, p_user_id)
      or exists (
        select 1
        from public.operational_reports r
        where r.id = p_report_id
          and r.farm_id = p_farm_id
          and r.reported_by = p_user_id
          and public.is_active_worker(p_farm_id, p_user_id)
      )
    );
$function$;

-- Tulis: hanya pekerja pembuat, dan hanya selama laporan belum direspons.
-- Aturannya sengaja disamakan dengan update_own_operational_report.

create or replace function public.can_upload_operational_report_photo(
  p_farm_id uuid,
  p_report_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.operational_reports r
    where r.id = p_report_id
      and r.farm_id = p_farm_id
      and r.reported_by = p_user_id
      and r.status = 'new'
      and r.responded_by is null
      and r.responded_at is null
      and nullif(btrim(r.owner_response_note), '') is null
      and public.is_active_worker(p_farm_id, p_user_id)
  );
$function$;

grant execute on function
  public.can_access_operational_report_photo(uuid, uuid, uuid) to authenticated, anon;
grant execute on function
  public.can_upload_operational_report_photo(uuid, uuid, uuid) to authenticated, anon;

-- ============ 2. Constraint photo_attachments ============

alter table public.photo_attachments
  drop constraint if exists photo_attachments_entity_type_check;

alter table public.photo_attachments
  add constraint photo_attachments_entity_type_check
  check (entity_type = any (array[
    'tree_main'::text,
    'condition_record'::text,
    'task_proof'::text,
    'operational_report'::text
  ]));

alter table public.photo_attachments
  drop constraint if exists photo_attachments_storage_path_entity_folder_check;

alter table public.photo_attachments
  add constraint photo_attachments_storage_path_entity_folder_check
  check (
    public.avology_storage_path_entity_folder(storage_path) =
    case entity_type
      when 'tree_main' then 'trees'
      when 'condition_record' then 'condition-reports'
      when 'task_proof' then 'task-proofs'
      when 'operational_report' then 'operational-reports'
      else null
    end
  );

-- ============ 3. Policy photo_attachments ============

drop policy if exists "Allowed members can view photo attachments"
  on public.photo_attachments;

create policy "Allowed members can view photo attachments"
  on public.photo_attachments
  for select
  using (
    (entity_type = 'tree_main' and public.is_active_farm_member(farm_id, auth.uid()))
    or (entity_type = 'condition_record'
        and public.can_access_condition_record_photo(farm_id, entity_id, auth.uid()))
    or (entity_type = 'task_proof'
        and public.can_access_task_proof_photo(farm_id, entity_id, auth.uid()))
    or (entity_type = 'operational_report'
        and public.can_access_operational_report_photo(farm_id, entity_id, auth.uid()))
  );

drop policy if exists "Allowed members can insert photo attachments"
  on public.photo_attachments;

create policy "Allowed members can insert photo attachments"
  on public.photo_attachments
  for insert
  with check (
    uploaded_by = auth.uid()
    and bucket = 'avology-photos'
    and public.avology_storage_path_farm_id(storage_path) = farm_id
    and public.avology_storage_path_entity_id(storage_path) = entity_id
    and (
      (entity_type = 'tree_main' and public.is_active_owner(farm_id, auth.uid()))
      or (entity_type = 'condition_record'
          and public.can_upload_condition_record_photo(farm_id, entity_id, auth.uid()))
      or (entity_type = 'task_proof'
          and public.can_upload_task_proof_photo(
            farm_id,
            public.avology_storage_path_task_id(storage_path),
            entity_id,
            auth.uid()))
      or (entity_type = 'operational_report'
          and public.can_upload_operational_report_photo(farm_id, entity_id, auth.uid()))
    )
  );

drop policy if exists "Allowed members can delete photo attachments"
  on public.photo_attachments;

create policy "Allowed members can delete photo attachments"
  on public.photo_attachments
  for delete
  using (
    public.is_active_owner(farm_id, auth.uid())
    or (
      uploaded_by = auth.uid()
      and (
        (entity_type = 'condition_record'
          and public.can_upload_condition_record_photo(farm_id, entity_id, auth.uid()))
        or (entity_type = 'task_proof'
          and public.can_access_task_proof_photo(farm_id, entity_id, auth.uid()))
        or (entity_type = 'operational_report'
          and public.can_upload_operational_report_photo(farm_id, entity_id, auth.uid()))
      )
    )
  );

-- ============ 4. Policy storage.objects ============

drop policy if exists "Allowed members can read avology photo objects"
  on storage.objects;

create policy "Allowed members can read avology photo objects"
  on storage.objects
  for select
  using (
    bucket_id = 'avology-photos'
    and (
      (public.avology_storage_path_entity_folder(name) = 'trees'
        and public.is_active_farm_member(
          public.avology_storage_path_farm_id(name), auth.uid()))
      or (public.avology_storage_path_entity_folder(name) = 'condition-reports'
        and public.can_access_condition_record_photo(
          public.avology_storage_path_farm_id(name),
          public.avology_storage_path_entity_id(name), auth.uid()))
      or (public.avology_storage_path_entity_folder(name) = 'task-proofs'
        and public.can_access_task_proof_photo(
          public.avology_storage_path_farm_id(name),
          public.avology_storage_path_entity_id(name), auth.uid()))
      or (public.avology_storage_path_entity_folder(name) = 'operational-reports'
        and public.can_access_operational_report_photo(
          public.avology_storage_path_farm_id(name),
          public.avology_storage_path_entity_id(name), auth.uid()))
    )
  );

drop policy if exists "Allowed members can upload avology photo objects"
  on storage.objects;

create policy "Allowed members can upload avology photo objects"
  on storage.objects
  for insert
  with check (
    bucket_id = 'avology-photos'
    and (
      (public.avology_storage_path_entity_folder(name) = 'trees'
        and split_part(name, '/', 5) = 'main'
        and public.is_active_owner(
          public.avology_storage_path_farm_id(name), auth.uid()))
      or (public.avology_storage_path_entity_folder(name) = 'condition-reports'
        and public.can_upload_condition_record_photo(
          public.avology_storage_path_farm_id(name),
          public.avology_storage_path_entity_id(name), auth.uid()))
      or (public.avology_storage_path_entity_folder(name) = 'task-proofs'
        and public.can_upload_task_proof_photo(
          public.avology_storage_path_farm_id(name),
          public.avology_storage_path_task_id(name),
          public.avology_storage_path_entity_id(name), auth.uid()))
      or (public.avology_storage_path_entity_folder(name) = 'operational-reports'
        and public.can_upload_operational_report_photo(
          public.avology_storage_path_farm_id(name),
          public.avology_storage_path_entity_id(name), auth.uid()))
    )
  );

drop policy if exists "Allowed members can delete avology photo objects"
  on storage.objects;

create policy "Allowed members can delete avology photo objects"
  on storage.objects
  for delete
  using (
    bucket_id = 'avology-photos'
    and (
      public.is_active_owner(public.avology_storage_path_farm_id(name), auth.uid())
      or exists (
        select 1 from public.photo_attachments pa
        where pa.bucket = objects.bucket_id
          and pa.storage_path = objects.name
          and pa.uploaded_by = auth.uid()
      )
      or (
        not exists (
          select 1 from public.photo_attachments pa
          where pa.bucket = objects.bucket_id
            and pa.storage_path = objects.name
        )
        and (
          (public.avology_storage_path_entity_folder(name) = 'condition-reports'
            and public.can_upload_condition_record_photo(
              public.avology_storage_path_farm_id(name),
              public.avology_storage_path_entity_id(name), auth.uid()))
          or (public.avology_storage_path_entity_folder(name) = 'task-proofs'
            and public.can_upload_task_proof_photo(
              public.avology_storage_path_farm_id(name),
              public.avology_storage_path_task_id(name),
              public.avology_storage_path_entity_id(name), auth.uid()))
          or (public.avology_storage_path_entity_folder(name) = 'operational-reports'
            and public.can_upload_operational_report_photo(
              public.avology_storage_path_farm_id(name),
              public.avology_storage_path_entity_id(name), auth.uid()))
        )
      )
    )
  );

commit;