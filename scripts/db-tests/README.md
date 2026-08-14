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
- `04-sop-schedule-task-activity.test.mjs`: validates manual schedule/task creation, target constraints, task visibility, and postpone/complete activity history. The SOP assertions this file was named after were removed with migration 046; the file name is kept so stage numbering stays stable.
- `05-operational-report-rpc.test.mjs`: validates operational report insert/select, status update RPC, direct update denial, report follow-up task.
- `06-dashboard-query.test.mjs`: runs manual dashboard-style aggregate queries without adding dashboard tables.
- `07-feature-foundation.test.mjs`: validates feature-completion database foundations for harvest records, manual care records, new photo entity types, schedule cancellation, report reopen audit fields, worker leave audit fields, and tree history additions.
- `08-tree-record-edit-delete-foundation.test.mjs`: validates edit/soft-delete foundations for tree records.
- `09-farm-relation-lifecycle.test.mjs`: validates `cancel_join_request`, `acknowledge_access_notice`, and `preview_farm_by_join_code`.
- `10-grace-period-missed-sweep.test.mjs`: validates the grace period and missed sweep from migration 048 — missed marking, successor birth, two consecutive missed cycles, sweep idempotency, never-expiring schedules, and operational report tasks never being swept.
- `11-dated-postponement.test.mjs`: validates dated postponement from migration 049 — due_date shift, rejected dates, missed tasks refusing postponement, and schedule edits not overwriting the shifted due_date.
- `12-care-activity-tree-links.test.mjs`: validates tree linking from migration 050 — tree/farm/custom targets, archived tree exclusion, and scheduled care reaching `tree_history_view`.
- `13-task-release-on-membership-exit.test.mjs`: validates task release from migration 051 — both exit paths, reassignment, tunggakan counting, and rejoining without ghost tasks.
- `14-schedule-lock-on-completed-only.test.mjs`: validates the schedule lock from migration 052 — postponed work does not lock, completed work still does, released tasks do not lock, and stopping repetition is never locked.

Stages `09` through `14` are self-contained: they create their own owners, workers, and farms, and they neither read nor write `.db-test-state.local.json`. Stages `10` to `14` must stay that way — they produce missed tasks, released tasks, and schedule chains that would corrupt the shared farm's tunggakan counts checked by stage `06`.

### Simulating elapsed time

Stages `10`, `11`, and `14` never travel in time. They rely on two facts:

- `create_manual_schedule` accepts a `p_scheduled_date` in the past, so an already-expired cycle can be created directly.
- An active owner may `update` `care_schedules` and `care_tasks` of their own farm, so a successor can be back-dated to simulate a second expired cycle.

The second point is needed because `create_successor_schedule` deliberately advances the successor date past today, so a successor is never born already late. Without back-dating there is no way to observe two consecutive missed cycles in a single run.

## Assumptions From Migrations

- RPC: `create_farm_with_owner`, `request_join_farm`, `approve_worker`, `reject_worker`, `remove_worker`.
- RPC: `get_member_basic_profiles`, `get_pending_workers`, `get_active_workers`, `get_active_workers_for_task_picker`.
- RPC: `create_manual_schedule`, `update_operational_report_status`, `create_task_from_operational_report`, `postpone_task`, `complete_task`.
- RPC: `cancel_care_schedule`, `reopen_operational_report`, `update_farm_profile`, `leave_current_farm`.
- RPC: `sweep_missed_schedules`, `assign_worker_to_care_schedule`, `stop_care_schedule_repeat`.
- `create_manual_schedule` takes `p_grace_days`, `p_never_expires`, and `p_date_basis` since migration 048.
- `postpone_task` takes `p_postponed_until` since migration 049; all three parameters are required.
- `care_tasks` carries `missed_at` (048) plus `released_at` and `released_reason` (051); `care_activities` carries `postponed_until` (049).
- `care_activity_trees` is the only path from a care activity to a tree, and it is filled by `complete_task` since migration 050.
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
