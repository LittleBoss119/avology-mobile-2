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

create or replace function public.get_farm_actor_display_profiles(
  p_farm_id uuid
)
returns table (
  user_id uuid,
  full_name text,
  role public.member_role,
  status public.member_status
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_farm_member(p_farm_id, auth.uid()) then
    raise exception 'Only active farm members can view farm actor display profiles';
  end if;

  return query
  select
    p.id as user_id,
    p.full_name,
    fm.role,
    fm.status
  from public.farm_members fm
  join public.profiles p
    on p.id = fm.user_id
  where fm.farm_id = p_farm_id
    and fm.status in ('pending', 'active', 'rejected', 'removed')
  order by fm.created_at desc;
end;
$$;

revoke execute on function public.get_current_user_access() from public, anon;
revoke execute on function public.get_farm_actor_display_profiles(uuid) from public, anon;

grant execute on function public.get_current_user_access() to authenticated;
grant execute on function public.get_farm_actor_display_profiles(uuid) to authenticated;
