create table if not exists public.trees (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  tree_code text not null,
  row_position text,
  column_position text,
  variety text,
  planted_at date,
  current_condition public.tree_condition_status not null default 'healthy',
  current_growth_phase public.growth_phase,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz,

  constraint trees_unique_code_per_farm unique (farm_id, tree_code)
);

create table if not exists public.tree_condition_reports (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  tree_id uuid not null references public.trees(id) on delete cascade,
  reported_by uuid not null references public.profiles(id) on delete restrict,
  condition_status public.tree_condition_status not null,
  note text,
  reported_at timestamptz not null default now()
);

create table if not exists public.operational_reports (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  reported_by uuid not null references public.profiles(id) on delete restrict,
  category public.operational_report_category not null,
  location_note text,
  description text,
  status public.operational_report_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
