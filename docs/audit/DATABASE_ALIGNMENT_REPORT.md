# Avology V2 Database Alignment Report

## Audit Scope

This report lists database objects the frontend appears to expect from Supabase service code, route code, and migrations. It does not prove the target Supabase project has these objects deployed. DB tests were not run in this audit.

## Tables and Columns Expected by App Code

### `profiles`

Expected columns:

- `id`
- `full_name`
- `phone`
- `created_at`
- `updated_at`

Used by:

- `authService.ts`
- profile RPCs through `memberService.ts`

Migration evidence:

- `002_create_core_tables.sql`

### `farms`

Expected columns:

- `id`
- `name`
- `location`
- `area_size`
- `join_code`
- `created_by`
- `created_at`
- `updated_at`

Used by:

- `farmService.ts`
- farm profile screen

Migration evidence:

- `002_create_core_tables.sql`

### `farm_members`

Expected columns:

- `id`
- `farm_id`
- `user_id`
- `role`
- `status`
- `joined_at`
- `created_at`
- `updated_at`

Used by:

- `farmService.ts`
- `memberService.ts`
- access checks in most service modules
- dashboard pending worker count

Migration evidence:

- `002_create_core_tables.sql`

### `trees`

Expected columns:

- `id`
- `farm_id`
- `tree_code`
- `row_position`
- `column_position`
- `variety`
- `planted_at`
- `current_condition`
- `current_growth_phase`
- `is_archived`
- `created_at`
- `updated_at`

Used by:

- `treeService.ts`
- `conditionReportService.ts`
- `growthPhaseService.ts`
- `historyService.ts`
- `dashboardService.ts`
- tree list/detail/forms
- target pickers in SOP/schedule/report task forms

Migration evidence:

- `003_create_tree_and_report_tables.sql`

### `tree_condition_reports`

Expected columns:

- `id`
- `farm_id`
- `tree_id`
- `reported_by`
- `condition_status`
- `note`
- `reported_at`

Used by:

- `conditionReportService.ts`
- `historyService.ts`
- `photoAttachmentService.ts`
- tree detail/history

Migration evidence:

- `003_create_tree_and_report_tables.sql`
- `006_create_indexes_and_triggers.sql` syncs latest condition into `trees.current_condition`

### `growth_phase_records`

Expected columns:

- `id`
- `farm_id`
- `tree_id`
- `recorded_by`
- `phase`
- `note`
- `recorded_at`

Used by:

- `growthPhaseService.ts`
- `tree_history_view`

Migration evidence:

- `005_create_growth_phase_and_history_view.sql`
- `006_create_indexes_and_triggers.sql` syncs latest phase into `trees.current_growth_phase`

### `tree_history_view`

Expected columns:

- `tree_id`
- `farm_id`
- `history_type`
- `title`
- `description`
- `actor_id`
- `happened_at`

Used by:

- `historyService.ts`
- `tree-detail-screen.tsx`

Migration evidence:

- `005_create_growth_phase_and_history_view.sql`

Alignment note:

- Frontend also wants condition report `sourceId`, but the view does not expose source ids. `historyService.ts` reconstructs condition source ids from `tree_condition_reports` using condition title, actor, and timestamp. This is workable but fragile.

### `operational_reports`

Expected columns:

- `id`
- `farm_id`
- `reported_by`
- `category`
- `location_note`
- `description`
- `status`
- `created_at`
- `updated_at`

Used by:

- `operationalReportService.ts`
- `careTaskService.ts`
- `photoAttachmentService.ts`
- owner/worker report screens
- dashboard new report count

Migration evidence:

- `003_create_tree_and_report_tables.sql`
- `006_create_indexes_and_triggers.sql`

### `care_sops`

Expected columns:

- `id`
- `farm_id`
- `name`
- `category`
- `interval_days`
- `default_instruction`
- `default_target_type`
- `default_target_row`
- `default_target_column`
- `default_target_tree_id`
- `is_active`
- `created_by`
- `created_at`
- `updated_at`

Used by:

- `careSopService.ts`
- `careScheduleService.ts`
- `dashboardService.ts`
- SOP and schedule screens

Migration evidence:

- `004_create_care_sop_schedule_task_tables.sql`

### `care_schedules`

Expected columns:

- `id`
- `farm_id`
- `care_sop_id`
- `title`
- `category`
- `scheduled_date`
- `target_type`
- `target_row`
- `target_column`
- `target_tree_id`
- `custom_target_note`
- `instruction`
- `requires_photo`
- `created_by`
- `created_at`
- `updated_at`

Used by:

- `careScheduleService.ts`
- `careSopService.ts`
- owner schedule screens

Migration evidence:

- Base table in `004_create_care_sop_schedule_task_tables.sql`
- `requires_photo` added in `016_add_requires_photo_and_task_proof.sql`
- Untracked duplicate hotfix exists in `017_hotfix_requires_photo_columns.sql`

Likely mismatch/risk:

- If the target DB has migrations only through `015`, service selects will fail because `requires_photo` will not exist.
- The untracked `017` file suggests this column alignment has been a recent issue.

### `care_tasks`

Expected columns:

- `id`
- `farm_id`
- `care_schedule_id`
- `operational_report_id`
- `assigned_to`
- `assigned_by`
- `title`
- `category`
- `instruction`
- `target_type`
- `target_row`
- `target_column`
- `target_tree_id`
- `custom_target_note`
- `due_date`
- `status`
- `requires_photo`
- `created_at`
- `updated_at`

Used by:

- `careTaskService.ts`
- `careScheduleService.ts`
- `careSopService.ts`
- `dashboardService.ts`
- task list/detail screens
- tree history view for care events targeting a tree

Migration evidence:

- Base table in `004_create_care_sop_schedule_task_tables.sql`
- `requires_photo` added in `016_add_requires_photo_and_task_proof.sql`
- Untracked duplicate hotfix exists in `017_hotfix_requires_photo_columns.sql`

Likely mismatch/risk:

- Same as `care_schedules`: target DB must include `requires_photo`.

### `care_activities`

Expected columns:

- `id`
- `farm_id`
- `care_task_id`
- `performed_by`
- `status`
- `note`
- `performed_at`

Used by:

- `careTaskService.ts`
- `careSopService.ts`
- `photoAttachmentService.ts`
- task detail and proof photo screens
- tree history view

Migration evidence:

- `004_create_care_sop_schedule_task_tables.sql`

### `photo_attachments`

Expected columns:

- `id`
- `farm_id`
- `uploaded_by`
- `entity_type`
- `entity_id`
- `bucket`
- `storage_path`
- `file_name`
- `mime_type`
- `file_size`
- `caption`
- `is_primary`
- `created_at`

Expected `entity_type` values:

- `tree_main`
- `condition_record`
- `operational_report`
- `task_proof`

Used by:

- `photoAttachmentService.ts`
- tree detail/list screens
- condition report screen/detail history
- operational report screens
- task proof screens

Migration evidence:

- `013_create_photo_attachments_and_storage.sql`
- policy refinements in `014`, `015`, and `016`

Likely mismatch/risk:

- `task_proof` storage path shape is different from the other entity types: `farms/{farmId}/task-proofs/{taskId}/{activityId}/{file}`. Migration `016` updates `avology_storage_path_entity_id()` to support this. If migration `016` is not applied, task proof uploads may fail the path/entity constraint.

## Storage Buckets Expected

### `avology-photos`

Expected configuration:

- bucket id/name: `avology-photos`
- private bucket
- max file size: 5 MB
- allowed mime types: `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`

Used by:

- `photoAttachmentService.ts`
- `src/lib/media.ts`

Migration evidence:

- `013_create_photo_attachments_and_storage.sql`

Expected storage paths:

- Tree main: `farms/{farmId}/trees/{treeId}/main/{file}`
- Condition report: `farms/{farmId}/condition-reports/{conditionReportId}/{file}`
- Operational report: `farms/{farmId}/operational-reports/{reportId}/{file}`
- Task proof: `farms/{farmId}/task-proofs/{taskId}/{activityId}/{file}`

## RPCs Expected by App Code

### Auth/farm/member RPCs

- `create_farm_with_owner(p_name, p_location, p_area_size)`
- `get_current_user_access()`
- `request_join_farm(p_join_code)`
- `get_pending_workers(p_farm_id)`
- `get_active_workers(p_farm_id)`
- `get_active_workers_for_task_picker(p_farm_id)`
- `get_member_basic_profiles(p_farm_id)`
- `get_farm_actor_display_profiles(p_farm_id)`
- `approve_worker(p_farm_member_id)`
- `reject_worker(p_farm_member_id)`
- `remove_worker(p_farm_member_id)`

Migration evidence:

- `008_create_rpc_functions.sql`
- `011_create_access_and_actor_display_rpc.sql`
- `012_refine_inactive_rejoin_flow.sql`

### Schedule/task/report RPCs

- `create_schedule_from_sop(p_farm_id, p_care_sop_id, p_scheduled_date, p_assigned_worker_id, p_target_type, p_target_row, p_target_column, p_target_tree_id, p_instruction, p_requires_photo)`
- `create_manual_schedule(p_farm_id, p_title, p_category, p_scheduled_date, p_assigned_worker_id, p_target_type, p_target_row, p_target_column, p_target_tree_id, p_custom_target_note, p_instruction, p_requires_photo)`
- `create_task_from_operational_report(p_operational_report_id, p_assigned_worker_id, p_due_date, p_title, p_instruction, p_target_type, p_target_row, p_target_column, p_target_tree_id, p_custom_target_note, p_requires_photo)`
- `update_operational_report_status(p_operational_report_id, p_status)`
- `complete_task(p_task_id, p_note)`
- `postpone_task(p_task_id, p_note)`
- `rollback_completed_task_activity(p_activity_id)`

Migration evidence:

- Original RPCs in `008_create_rpc_functions.sql`
- `requires_photo` signatures and rollback RPC in `016_add_requires_photo_and_task_proof.sql`

Likely mismatch/risk:

- RPC signatures changed in `016` to include `p_requires_photo`. If the database still has earlier RPC signatures, current frontend calls will fail with missing RPC/signature errors.

## Triggers/Functions Expected

Important triggers/functions visible in migrations:

- `set_updated_at()`
- `generate_join_code()`
- `prevent_tree_delete()`
- `sync_tree_current_condition()`
- `sync_tree_current_growth_phase()`
- `sync_task_status_from_activity()`
- validation triggers for condition reports, operational reports, SOPs, schedules, tasks, activities, growth phase records
- RLS helper functions: `is_active_farm_member`, `is_active_owner`, `is_active_worker`, `is_active_worker_user`, `can_view_profile`
- storage helper functions: `avology_storage_path_farm_id`, `avology_storage_path_entity_folder`, `avology_storage_path_entity_id`, `avology_storage_path_task_id`
- task proof helpers: `can_access_task_proof_photo`, `can_upload_task_proof_photo`
- operational report photo helpers: `can_access_operational_report_photo`, `can_upload_operational_report_photo`

## Policies Expected

RLS must allow:

- Users to view/insert/update their own profile.
- Active members to view their farm.
- Active owners to update farms.
- Users to view own membership; owners to view farm members.
- Active members to view trees and condition/growth records.
- Active owners to insert/update trees, SOPs, schedules, tasks.
- Active workers to create operational reports and task activities.
- Owners to view farm reports/tasks/activities; workers to view their own reports/tasks/activities.
- Photo attachment/storage access according to entity type and role:
  - tree main: owner-managed upload/delete; members can view.
  - condition record: active farm members can upload/view.
  - operational report: policy refinements determine owner/worker access.
  - task proof: assigned worker uploads; owner and assigned worker view.

Migration evidence:

- `007_enable_rls_and_policies.sql`
- `013_create_photo_attachments_and_storage.sql`
- `014_refine_tree_main_photo_policies.sql`
- `015_refine_operational_report_photo_policies.sql`
- `016_add_requires_photo_and_task_proof.sql`

## Specific Alignment Checks

### Photo-related fields/tables

Alignment: Mostly aligned in code and migrations.

Risks:

- Requires migration `013` for base photo table/storage.
- Requires `014`/`015`/`016` for refined policies.
- Requires `016` for task proof path parsing.
- Manual media regression is still pending in docs.

### `care_schedules`

Alignment: Current code expects `requires_photo`, which is added in `016`.

Risk:

- DB without `016` will fail schedule selects/RPC calls.

### `care_tasks`

Alignment: Current code expects `requires_photo`, follow-up task links, task status sync, and activity rows.

Risk:

- DB without `016` will fail task selects/RPC calls using `p_requires_photo`.

### `care_activities`

Alignment: Code expects activity rows from `complete_task` and `postpone_task`, with proof photos attached to completed activity ids.

Risk:

- Required-photo integrity is mostly client-coordinated after `complete_task`.

### Tree reports

Alignment: `tree_condition_reports` exists; trigger syncs `trees.current_condition`; optional photo attachments link by report id.

Risk:

- Optional photo failure leaves the report without a photo.

### Worker task realization

Alignment: `care_activities` and `complete_task`/`postpone_task` exist; proof photos attach as `task_proof`.

Risk:

- Complete + upload proof is not atomic.

### Dashboard queries

Alignment: Dashboard code expects no dashboard table and uses aggregate counts from:

- `trees`
- `care_tasks`
- `operational_reports`
- `farm_members`
- `care_sops`
- `care_schedules`
- `care_activities`

Risk:

- Multiple client-side queries can fail independently.
- SOP due/overdue calculation depends on per-SOP service calls.
- Date calculations use client/device local date.

## Database Test Coverage Present

Scripts exist for:

- env/connection check
- auth/profile/membership
- worker management/RLS
- tree condition/growth/history
- SOP/schedule/task/activity
- operational reports/RPC
- dashboard queries

Files:

- `scripts/db-tests/00-check-env-and-connection.mjs`
- `scripts/db-tests/01-auth-profile-membership.test.mjs`
- `scripts/db-tests/02-worker-management-rls.test.mjs`
- `scripts/db-tests/03-tree-condition-phase-history.test.mjs`
- `scripts/db-tests/04-sop-schedule-task-activity.test.mjs`
- `scripts/db-tests/05-operational-report-rpc.test.mjs`
- `scripts/db-tests/06-dashboard-query.test.mjs`

Audit note:

- These tests were not run during this audit. They should be mandatory before using this version as the final thesis base.

