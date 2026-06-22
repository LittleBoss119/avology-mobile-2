create or replace function public.get_current_user_access()
returns table (
  membership_id uuid,
  farm_id uuid,
  user_id uuid,
  role public.member_role,
  status public.member_status,
  joined_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  farm_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'User is not authenticated';
  end if;

  return query
  select
    fm.id as membership_id,
    fm.farm_id,
    fm.user_id,
    fm.role,
    fm.status,
    fm.joined_at,
    fm.created_at,
    fm.updated_at,
    f.name as farm_name
  from public.farm_members fm
  left join public.farms f
    on f.id = fm.farm_id
  where fm.user_id = auth.uid()
  order by coalesce(fm.updated_at, fm.created_at) desc
  limit 1;
end;
$$;

create or replace function public.request_join_farm(
  p_join_code text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_farm_id uuid;
  membership_id uuid;
begin
  if current_user_id is null then
    raise exception 'User is not authenticated';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = current_user_id
  ) then
    raise exception 'Profile must exist before joining a farm';
  end if;

  select id
  into target_farm_id
  from public.farms
  where join_code = upper(trim(p_join_code));

  if target_farm_id is null then
    raise exception 'Join code is invalid';
  end if;

  if exists (
    select 1
    from public.farm_members
    where farm_id = target_farm_id
      and user_id = current_user_id
      and status in ('pending', 'active')
  ) then
    raise exception 'User already has a pending or active membership';
  end if;

  insert into public.farm_members (
    farm_id,
    user_id,
    role,
    status,
    joined_at
  )
  values (
    target_farm_id,
    current_user_id,
    'worker',
    'pending',
    null
  )
  on conflict (farm_id, user_id)
  do update set
    role = 'worker',
    status = 'pending',
    joined_at = null,
    updated_at = now()
  where public.farm_members.status in ('rejected', 'removed')
  returning id into membership_id;

  if membership_id is null then
    raise exception 'User already has a pending or active membership';
  end if;

  return membership_id;
end;
$$;

revoke execute on function public.get_current_user_access() from public, anon;
revoke execute on function public.request_join_farm(text) from public, anon;

grant execute on function public.get_current_user_access() to authenticated;
grant execute on function public.request_join_farm(text) to authenticated;
