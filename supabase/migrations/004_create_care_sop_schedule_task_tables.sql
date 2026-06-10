create table if not exists public.care_sops (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  name text not null,
  category public.care_category not null,
  interval_days integer,
  default_instruction text,
  default_target_type public.target_type not null default 'farm',
  default_target_row text,
  default_target_column text,
  default_target_tree_id uuid references public.trees(id) on delete set null,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz,

  constraint care_sops_interval_days_check
    check (interval_days is null or interval_days > 0),
  constraint care_sops_default_target_check
    check (
      (
        default_target_type = 'farm'
        and default_target_row is null
        and default_target_column is null
        and default_target_tree_id is null
      )
      or (
        default_target_type = 'row'
        and default_target_row is not null
        and default_target_column is null
        and default_target_tree_id is null
      )
      or (
        default_target_type = 'column'
        and default_target_row is null
        and default_target_column is not null
        and default_target_tree_id is null
      )
      or (
        default_target_type = 'tree'
        and default_target_row is null
        and default_target_column is null
        and default_target_tree_id is not null
      )
    )
);

create table if not exists public.care_schedules (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  care_sop_id uuid references public.care_sops(id) on delete set null,
  title text not null,
  category public.care_category not null,
  scheduled_date date not null,
  target_type public.target_type not null,
  target_row text,
  target_column text,
  target_tree_id uuid references public.trees(id) on delete set null,
  custom_target_note text,
  instruction text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz,

  constraint care_schedules_target_check
    check (
      (
        target_type = 'farm'
        and target_row is null
        and target_column is null
        and target_tree_id is null
        and custom_target_note is null
      )
      or (
        target_type = 'row'
        and target_row is not null
        and target_column is null
        and target_tree_id is null
        and custom_target_note is null
      )
      or (
        target_type = 'column'
        and target_row is null
        and target_column is not null
        and target_tree_id is null
        and custom_target_note is null
      )
      or (
        target_type = 'tree'
        and target_row is null
        and target_column is null
        and target_tree_id is not null
        and custom_target_note is null
      )
      or (
        target_type = 'custom'
        and care_sop_id is null
        and target_row is null
        and target_column is null
        and target_tree_id is null
        and custom_target_note is not null
      )
    )
);

create table if not exists public.care_tasks (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  care_schedule_id uuid references public.care_schedules(id) on delete set null,
  operational_report_id uuid references public.operational_reports(id) on delete set null,
  assigned_to uuid not null references public.profiles(id) on delete restrict,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  category public.care_category,
  instruction text,
  target_type public.target_type not null,
  target_row text,
  target_column text,
  target_tree_id uuid references public.trees(id) on delete set null,
  custom_target_note text,
  due_date date not null,
  status public.task_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz,

  constraint care_tasks_source_check
    check (care_schedule_id is not null or operational_report_id is not null),
  constraint care_tasks_target_check
    check (
      (
        target_type = 'farm'
        and target_row is null
        and target_column is null
        and target_tree_id is null
        and custom_target_note is null
      )
      or (
        target_type = 'row'
        and target_row is not null
        and target_column is null
        and target_tree_id is null
        and custom_target_note is null
      )
      or (
        target_type = 'column'
        and target_row is null
        and target_column is not null
        and target_tree_id is null
        and custom_target_note is null
      )
      or (
        target_type = 'tree'
        and target_row is null
        and target_column is null
        and target_tree_id is not null
        and custom_target_note is null
      )
      or (
        target_type = 'custom'
        and target_row is null
        and target_column is null
        and target_tree_id is null
        and custom_target_note is not null
      )
    )
);

create table if not exists public.care_activities (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  care_task_id uuid not null references public.care_tasks(id) on delete cascade,
  performed_by uuid not null references public.profiles(id) on delete restrict,
  status public.activity_status not null,
  note text,
  performed_at timestamptz not null default now()
);
