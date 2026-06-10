create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.farms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  area_size numeric,
  join_code text not null unique,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz,

  constraint farms_area_size_check
    check (area_size is null or area_size > 0)
);

create table if not exists public.farm_members (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null,
  status public.member_status not null default 'pending',
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,

  constraint farm_members_unique_user_per_farm unique (farm_id, user_id),
  constraint farm_members_joined_at_check
    check (
      (status = 'active' and joined_at is not null)
      or status <> 'active'
    )
);
