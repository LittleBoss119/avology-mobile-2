create or replace function public.is_active_farm_member(
  p_farm_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.farm_members
    where farm_id = p_farm_id
      and user_id = p_user_id
      and status = 'active'
  );
$$;

create or replace function public.is_active_owner(
  p_farm_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.farm_members
    where farm_id = p_farm_id
      and user_id = p_user_id
      and role = 'owner'
      and status = 'active'
  );
$$;

create or replace function public.is_active_worker(
  p_farm_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.farm_members
    where farm_id = p_farm_id
      and user_id = p_user_id
      and role = 'worker'
      and status = 'active'
  );
$$;

create or replace function public.is_active_worker_user(
  p_farm_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_active_worker(p_farm_id, p_user_id);
$$;

create or replace function public.can_view_profile(
  p_profile_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select p_profile_id = p_user_id;
$$;

alter table public.profiles enable row level security;
alter table public.farms enable row level security;
alter table public.farm_members enable row level security;
alter table public.trees enable row level security;
alter table public.tree_condition_reports enable row level security;
alter table public.operational_reports enable row level security;
alter table public.care_sops enable row level security;
alter table public.care_schedules enable row level security;
alter table public.care_tasks enable row level security;
alter table public.care_activities enable row level security;
alter table public.growth_phase_records enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles
for select
to authenticated
using (public.can_view_profile(id, auth.uid()));

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Active members can view farm" on public.farms;
create policy "Active members can view farm"
on public.farms
for select
to authenticated
using (public.is_active_farm_member(id, auth.uid()));

drop policy if exists "Active owner can update farm" on public.farms;
create policy "Active owner can update farm"
on public.farms
for update
to authenticated
using (public.is_active_owner(id, auth.uid()))
with check (public.is_active_owner(id, auth.uid()));

drop policy if exists "Members can view allowed memberships" on public.farm_members;
drop policy if exists "Users view own membership and owners view farm members" on public.farm_members;
create policy "Users view own membership and owners view farm members"
on public.farm_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_active_owner(farm_id, auth.uid())
);

drop policy if exists "Active members can view trees" on public.trees;
create policy "Active members can view trees"
on public.trees
for select
to authenticated
using (public.is_active_farm_member(farm_id, auth.uid()));

drop policy if exists "Active owner can insert trees" on public.trees;
create policy "Active owner can insert trees"
on public.trees
for insert
to authenticated
with check (public.is_active_owner(farm_id, auth.uid()));

drop policy if exists "Active owner can update trees" on public.trees;
create policy "Active owner can update trees"
on public.trees
for update
to authenticated
using (public.is_active_owner(farm_id, auth.uid()))
with check (public.is_active_owner(farm_id, auth.uid()));

drop policy if exists "Active members can view condition reports" on public.tree_condition_reports;
create policy "Active members can view condition reports"
on public.tree_condition_reports
for select
to authenticated
using (public.is_active_farm_member(farm_id, auth.uid()));

drop policy if exists "Active members can insert condition reports" on public.tree_condition_reports;
create policy "Active members can insert condition reports"
on public.tree_condition_reports
for insert
to authenticated
with check (
  public.is_active_farm_member(farm_id, auth.uid())
  and reported_by = auth.uid()
);

drop policy if exists "Active members can view operational reports" on public.operational_reports;
drop policy if exists "Owners view farm operational reports and workers view own reports" on public.operational_reports;
create policy "Owners view farm operational reports and workers view own reports"
on public.operational_reports
for select
to authenticated
using (
  public.is_active_owner(farm_id, auth.uid())
  or (
    public.is_active_worker(farm_id, auth.uid())
    and reported_by = auth.uid()
  )
);

drop policy if exists "Active worker can insert operational reports" on public.operational_reports;
create policy "Active worker can insert operational reports"
on public.operational_reports
for insert
to authenticated
with check (
  public.is_active_worker(farm_id, auth.uid())
  and reported_by = auth.uid()
);

drop policy if exists "Active owner can update operational reports" on public.operational_reports;

drop policy if exists "Active members can view care sops" on public.care_sops;
create policy "Active members can view care sops"
on public.care_sops
for select
to authenticated
using (public.is_active_farm_member(farm_id, auth.uid()));

drop policy if exists "Active owner can insert care sops" on public.care_sops;
create policy "Active owner can insert care sops"
on public.care_sops
for insert
to authenticated
with check (
  public.is_active_owner(farm_id, auth.uid())
  and created_by = auth.uid()
);

drop policy if exists "Active owner can update care sops" on public.care_sops;
create policy "Active owner can update care sops"
on public.care_sops
for update
to authenticated
using (public.is_active_owner(farm_id, auth.uid()))
with check (
  public.is_active_owner(farm_id, auth.uid())
  and created_by = auth.uid()
);

drop policy if exists "Active members can view care schedules" on public.care_schedules;
create policy "Active members can view care schedules"
on public.care_schedules
for select
to authenticated
using (public.is_active_farm_member(farm_id, auth.uid()));

drop policy if exists "Active owner can insert care schedules" on public.care_schedules;
create policy "Active owner can insert care schedules"
on public.care_schedules
for insert
to authenticated
with check (
  public.is_active_owner(farm_id, auth.uid())
  and created_by = auth.uid()
);

drop policy if exists "Active owner can update care schedules" on public.care_schedules;
create policy "Active owner can update care schedules"
on public.care_schedules
for update
to authenticated
using (public.is_active_owner(farm_id, auth.uid()))
with check (
  public.is_active_owner(farm_id, auth.uid())
  and created_by = auth.uid()
);

drop policy if exists "Owners view farm tasks and workers view own tasks" on public.care_tasks;
create policy "Owners view farm tasks and workers view own tasks"
on public.care_tasks
for select
to authenticated
using (
  public.is_active_owner(farm_id, auth.uid())
  or (
    public.is_active_worker(farm_id, auth.uid())
    and assigned_to = auth.uid()
  )
);

drop policy if exists "Active owner can insert care tasks" on public.care_tasks;
create policy "Active owner can insert care tasks"
on public.care_tasks
for insert
to authenticated
with check (
  public.is_active_owner(farm_id, auth.uid())
  and assigned_by = auth.uid()
  and public.is_active_worker_user(farm_id, assigned_to)
);

drop policy if exists "Active owner can update care tasks" on public.care_tasks;
create policy "Active owner can update care tasks"
on public.care_tasks
for update
to authenticated
using (public.is_active_owner(farm_id, auth.uid()))
with check (
  public.is_active_owner(farm_id, auth.uid())
  and assigned_by = auth.uid()
  and public.is_active_worker_user(farm_id, assigned_to)
);

drop policy if exists "Owners view farm activities and workers view own activities" on public.care_activities;
create policy "Owners view farm activities and workers view own activities"
on public.care_activities
for select
to authenticated
using (
  public.is_active_owner(farm_id, auth.uid())
  or (
    public.is_active_worker(farm_id, auth.uid())
    and performed_by = auth.uid()
  )
);

drop policy if exists "Worker can insert own task activities" on public.care_activities;
create policy "Worker can insert own task activities"
on public.care_activities
for insert
to authenticated
with check (
  public.is_active_worker(farm_id, auth.uid())
  and performed_by = auth.uid()
  and exists (
    select 1
    from public.care_tasks ct
    where ct.id = care_task_id
      and ct.farm_id = care_activities.farm_id
      and ct.assigned_to = auth.uid()
  )
);

drop policy if exists "Active members can view growth phase records" on public.growth_phase_records;
create policy "Active members can view growth phase records"
on public.growth_phase_records
for select
to authenticated
using (public.is_active_farm_member(farm_id, auth.uid()));

drop policy if exists "Active members can insert growth phase records" on public.growth_phase_records;
create policy "Active members can insert growth phase records"
on public.growth_phase_records
for insert
to authenticated
with check (
  public.is_active_farm_member(farm_id, auth.uid())
  and recorded_by = auth.uid()
);

grant usage on schema public to authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, update on public.farms to authenticated;
grant select on public.farm_members to authenticated;
grant select, insert, update on public.trees to authenticated;
grant select, insert on public.tree_condition_reports to authenticated;
revoke update on public.operational_reports from authenticated;
grant select, insert on public.operational_reports to authenticated;
grant select, insert, update on public.care_sops to authenticated;
grant select, insert, update on public.care_schedules to authenticated;
grant select, insert, update on public.care_tasks to authenticated;
grant select, insert on public.care_activities to authenticated;
grant select, insert on public.growth_phase_records to authenticated;
grant select on public.tree_history_view to authenticated;

revoke execute on function public.is_active_farm_member(uuid, uuid) from public, anon;
revoke execute on function public.is_active_owner(uuid, uuid) from public, anon;
revoke execute on function public.is_active_worker(uuid, uuid) from public, anon;
revoke execute on function public.is_active_worker_user(uuid, uuid) from public, anon;
revoke execute on function public.can_view_profile(uuid, uuid) from public, anon;

grant execute on function public.is_active_farm_member(uuid, uuid) to authenticated;
grant execute on function public.is_active_owner(uuid, uuid) to authenticated;
grant execute on function public.is_active_worker(uuid, uuid) to authenticated;
grant execute on function public.is_active_worker_user(uuid, uuid) to authenticated;
grant execute on function public.can_view_profile(uuid, uuid) to authenticated;
