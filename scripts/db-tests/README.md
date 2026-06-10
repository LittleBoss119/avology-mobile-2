# Avology V2 Database Manual Test Suite

Semi-automated database tests for validating Supabase schema, RLS, RPC, and the main MVP flows after `supabase db push`.

These tests use only `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Do not use a `service_role` key here; the goal is to validate RLS through normal Supabase Auth sessions.

## Setup

Create `.env.test.local` at the project root:

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

Install dependencies:

```bash
npm install
```

The tests create unique email users automatically with a timestamp-based suffix. Email confirmation should be disabled for the test project, or the generated users must be confirmable before sign-in.

## Commands

Run the environment and connection check:

```bash
npm run test:db:check
```

Run all database stages in order:

```bash
npm run test:db:all
```

Run one stage directly:

```bash
node scripts/db-tests/01-auth-profile-membership.test.mjs
```

Stages share generated test ids in `scripts/db-tests/.db-test-state.local.json`. Run stage `01` first, or use `npm run test:db:all`, before running later stages independently.

## Stages

- `00-check-env-and-connection.mjs`: validates env and anon client connection.
- `01-auth-profile-membership.test.mjs`: signs up owner/worker, creates profiles, creates farm, verifies pending membership.
- `02-worker-management-rls.test.mjs`: validates pending/active worker RPCs, worker membership visibility, removed/rejected access denial.
- `03-tree-condition-phase-history.test.mjs`: validates tree archive/unarchive, condition reports, growth phase monitoring, and `tree_history_view`.
- `04-sop-schedule-task-activity.test.mjs`: validates SOP constraints, schedule/task creation, task visibility, postpone/complete activity history.
- `05-operational-report-rpc.test.mjs`: validates operational report insert/select, status update RPC, direct update denial, report follow-up task.
- `06-dashboard-query.test.mjs`: runs manual dashboard-style aggregate queries without adding dashboard tables.

## Assumptions From Migrations

- RPC: `create_farm_with_owner`, `request_join_farm`, `approve_worker`, `reject_worker`, `remove_worker`.
- RPC: `get_member_basic_profiles`, `get_pending_workers`, `get_active_workers`, `get_active_workers_for_task_picker`.
- RPC: `create_schedule_from_sop`, `create_manual_schedule`, `update_operational_report_status`, `create_task_from_operational_report`, `postpone_task`, `complete_task`.
- Enums: `member_role`, `member_status`, `tree_condition_status`, `growth_phase`, `operational_report_category`, `operational_report_status`, `care_category`, `target_type`, `task_status`, `activity_status`.
- Trees use `is_archived`; tests do not permanently delete trees.
- Growth phase is treated as monitoring only. The tests do not validate harvest prediction or harvest estimation.
- Dashboard checks are manual aggregate queries because there is no dashboard table/RPC in the MVP migrations.

## If You See `invalid api key`

- Confirm `.env.test.local` is at the project root.
- Confirm the key is the project anon key, not service_role and not a key from another project.
- Confirm `SUPABASE_URL` matches the same Supabase project as the anon key.
- Re-copy the anon key from Supabase project settings if the project was recreated.
- Restart the shell after editing env values if your terminal keeps old variables.
