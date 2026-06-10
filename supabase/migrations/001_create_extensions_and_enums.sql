create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'member_role') then
    create type public.member_role as enum ('owner', 'worker');
  end if;

  if not exists (select 1 from pg_type where typname = 'member_status') then
    create type public.member_status as enum ('pending', 'active', 'rejected', 'removed');
  end if;

  if not exists (select 1 from pg_type where typname = 'tree_condition_status') then
    create type public.tree_condition_status as enum (
      'healthy',
      'needs_attention',
      'pest_attacked',
      'disease_indicated',
      'damaged',
      'dead'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'growth_phase') then
    create type public.growth_phase as enum (
      'initial_planting',
      'vegetative',
      'flowering',
      'fruiting',
      'harvesting'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'operational_report_category') then
    create type public.operational_report_category as enum (
      'land_damage',
      'broken_tool',
      'out_of_stock',
      'area_pest_disease',
      'disaster_weather',
      'worker_need',
      'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'operational_report_status') then
    create type public.operational_report_status as enum (
      'new',
      'in_progress',
      'resolved',
      'rejected'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'care_category') then
    create type public.care_category as enum (
      'watering',
      'fertilizing',
      'spraying',
      'weeding',
      'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'target_type') then
    create type public.target_type as enum (
      'farm',
      'row',
      'column',
      'tree',
      'custom'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type public.task_status as enum (
      'pending',
      'completed',
      'postponed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'activity_status') then
    create type public.activity_status as enum (
      'completed',
      'postponed'
    );
  end if;
end $$;
