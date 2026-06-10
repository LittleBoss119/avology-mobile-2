create table if not exists public.growth_phase_records (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  tree_id uuid not null references public.trees(id) on delete cascade,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  phase public.growth_phase not null,
  note text,
  recorded_at timestamptz not null default now()
);

create or replace view public.tree_history_view
with (security_invoker = true)
as
select
  tcr.tree_id,
  tcr.farm_id,
  'condition'::text as history_type,
  tcr.condition_status::text as title,
  tcr.note as description,
  tcr.reported_by as actor_id,
  tcr.reported_at as happened_at
from public.tree_condition_reports tcr

union all

select
  gpr.tree_id,
  gpr.farm_id,
  'phase'::text as history_type,
  gpr.phase::text as title,
  gpr.note as description,
  gpr.recorded_by as actor_id,
  gpr.recorded_at as happened_at
from public.growth_phase_records gpr

union all

select
  ct.target_tree_id as tree_id,
  ca.farm_id,
  'care'::text as history_type,
  ct.title as title,
  ca.note as description,
  ca.performed_by as actor_id,
  ca.performed_at as happened_at
from public.care_activities ca
join public.care_tasks ct
  on ct.id = ca.care_task_id
where ct.target_type = 'tree'
  and ct.target_tree_id is not null;
