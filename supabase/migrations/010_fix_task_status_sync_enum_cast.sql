create or replace function public.sync_task_status_from_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.care_tasks
  set status = (new.status::text)::public.task_status,
      updated_at = now()
  where id = new.care_task_id;

  return new;
end;
$$;
