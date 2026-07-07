# Avology V2 Project Status Report

Audit date: 2026-06-27  
Mode: read-only source audit, except creation of these audit documents  
Verification performed: `npm run typecheck` passed with `tsc --noEmit`

## Current Implementation Summary

Avology V2 is a React Native Expo Router application backed by Supabase Auth, Postgres tables, RLS policies, RPC functions, triggers, and Supabase Storage. The implemented app targets two main roles:

- `owner`: manages farm data, workers, trees, SOPs, schedules, worker tasks, operational reports, dashboard, and profile.
- `worker`: views assigned tasks, records task realization, reports tree condition, records growth phase, creates operational reports, views dashboard, and profile.

The codebase has substantial MVP coverage. Most core flows exist in route files, reusable screen components, service modules, Supabase migrations, and database test scripts. The current version is not a clean baseline: `src/services/careScheduleService.ts` and `src/services/careTaskService.ts` are modified, and `supabase/migrations/017_hotfix_requires_photo_columns.sql` is untracked.

The strongest implementation areas are the service layer, route guards, Supabase schema/RPC coverage, and role-specific navigation. The riskiest areas are final database alignment, media/photo regression, inactive worker route behavior, lack of executed black-box/UAT evidence in this audit, and the uncommitted migration/state.

## App Structure

- `app/`: Expo Router route groups and screens.
- `app/(auth)/`: get started, login, register.
- `app/(onboarding)/`: create farm, join farm, profile, pending approval, rejected, removed access.
- `app/(owner)/`: owner dashboard and owner-only management flows.
- `app/(worker)/`: worker dashboard and worker operational flows.
- `src/context/`: auth context and current farm/session refresh.
- `src/services/`: Supabase service layer.
- `src/components/`: shared UI and reusable domain screens.
- `src/lib/`: Supabase client and image picker/media utilities.
- `src/types/`: domain and media TypeScript types.
- `src/utils/`: route guard, formatting, service result helpers.
- `supabase/migrations/`: schema, RLS, triggers, RPCs, storage, photo/task-proof changes.
- `scripts/db-tests/`: semi-automated Supabase/RLS/RPC test stages.
- `docs/source-of-truth/`: thesis/product scope, requirements, navigation, traceability, black-box/UAT plans.

## Main Screens/Routes

Auth and access:

- `/` redirects based on session and membership.
- `/(auth)/get-started`
- `/(auth)/login`
- `/(auth)/register`
- `/(onboarding)/onboarding`
- `/(onboarding)/create-farm`
- `/(onboarding)/join-farm`
- `/(onboarding)/profile`
- `/(onboarding)/pending-approval`
- `/(onboarding)/rejected`
- `/(onboarding)/removed-access`

Owner:

- `/owner`
- `/owner/growth-monitoring`
- `/owner/trees`
- `/owner/trees/create`
- `/owner/trees/[treeId]`
- `/owner/trees/[treeId]/edit`
- `/owner/trees/[treeId]/report`
- `/owner/trees/[treeId]/phase`
- `/owner/sops`
- `/owner/sops/create`
- `/owner/sops/[sopId]`
- `/owner/sops/[sopId]/edit`
- `/owner/sops/[sopId]/schedule`
- `/owner/schedules`
- `/owner/schedules/create`
- `/owner/schedules/[scheduleId]`
- `/owner/tasks`
- `/owner/tasks/[taskId]`
- `/owner/reports`
- `/owner/reports/[reportId]`
- `/owner/reports/[reportId]/task`
- `/owner/workers`
- `/owner/profile`
- `/owner/farm-profile`

Worker:

- `/worker`
- `/worker/trees`
- `/worker/trees/[treeId]`
- `/worker/trees/[treeId]/report`
- `/worker/trees/[treeId]/phase`
- `/worker/tasks`
- `/worker/tasks/[taskId]`
- `/worker/reports`
- `/worker/reports/create`
- `/worker/reports/[reportId]`
- `/worker/profile`

## Main Services/Hooks/Components

Context and guards:

- `src/context/auth-context.tsx`: loads profile and current farm membership, refreshes on auth state changes.
- `src/utils/routeGuard.ts`: maps session/membership to role-specific routes and blocks invalid access.

Services:

- `authService.ts`: register, login, logout, profile load/update.
- `farmService.ts`: create farm, current farm access, farm detail.
- `memberService.ts`: join farm, pending/active workers, approve/reject/remove, member display profiles.
- `treeService.ts`: list/detail/create/update/archive/restore trees.
- `conditionReportService.ts`: tree condition reports.
- `growthPhaseService.ts`: growth phase records and flowering/fruiting monitoring.
- `historyService.ts`: `tree_history_view` read and actor display enrichment.
- `careSopService.ts`: SOP CRUD, active toggle, next schedule reference.
- `careScheduleService.ts`: manual schedules and SOP-derived schedules.
- `careTaskService.ts`: task lists/details, complete/postpone, report follow-up tasks, required-photo rollback.
- `operationalReportService.ts`: worker operational reports and owner status updates.
- `photoAttachmentService.ts`: photo upload/list/delete/signed URLs for tree main, condition report, operational report, and task proof photos.
- `dashboardService.ts`: owner and worker dashboard aggregations.

Components:

- `src/components/ui.tsx`: shared UI primitives.
- `role-bottom-navigation.tsx`: role-specific bottom navigation.
- `profile-screen.tsx`: shared profile screen.
- `tree-*`: tree detail, condition report, growth phase record, tree cards/forms.
- `care-sop-components.tsx`: SOP cards/forms/formatters.
- `care-schedule-components.tsx`: schedule/task cards/forms/proof toggle.
- `operational-report-screen.tsx`: worker/owner report screens and follow-up task creation.
- `task-proof-photo.tsx`: proof picker and preview.
- `growth-monitoring-screen.tsx`: flowering/fruiting monitoring.

## Main Database Tables Expected by the App

Tables/views:

- `profiles`
- `farms`
- `farm_members`
- `trees`
- `tree_condition_reports`
- `growth_phase_records`
- `tree_history_view`
- `operational_reports`
- `care_sops`
- `care_schedules`
- `care_tasks`
- `care_activities`
- `photo_attachments`

Storage:

- private bucket `avology-photos`

RPC/functions expected by app code:

- `create_farm_with_owner`
- `get_current_user_access`
- `request_join_farm`
- `get_pending_workers`
- `get_active_workers`
- `get_member_basic_profiles`
- `get_farm_actor_display_profiles`
- `get_active_workers_for_task_picker`
- `approve_worker`
- `reject_worker`
- `remove_worker`
- `create_manual_schedule`
- `create_schedule_from_sop`
- `create_task_from_operational_report`
- `update_operational_report_status`
- `complete_task`
- `postpone_task`
- `rollback_completed_task_activity`

## Current Strengths

- Broad MVP feature surface is present in code.
- TypeScript compiles successfully.
- Role-separated route groups and route guards are implemented.
- Supabase access is mostly centralized in services, which helps testing and traceability.
- Database migrations include schema, RLS, indexes, triggers, views, RPCs, storage bucket, and photo policies.
- Database test scripts exist for auth/profile/membership, worker management/RLS, tree condition/phase/history, SOP/schedule/task/activity, operational reports, and dashboard queries.
- Product docs explicitly align MVP with black-box/UAT and remove automatic harvest prediction from scope.
- Photo support exists for main tree photos, condition reports, operational reports, and task proof photos.
- Worker task completion handles required-photo failure with rollback attempt.
- Dashboard is based on live aggregate queries rather than fake/static counters.

## Current Weaknesses

- Current working tree is not clean; modified service files and an untracked migration make this unsafe to declare as final without consolidation.
- The audit did not run the Supabase DB tests or mobile app manually; runtime/RLS/storage behavior is therefore not proven here.
- Existing media regression docs show manual media checks as pending.
- Route-guard regression docs identify inactive worker rejected/removed flow as a known risk requiring re-test before full UAT.
- Required-photo support depends on the latest migrations being applied and schema cache being refreshed.
- Dashboard performs multiple independent client-side queries, including SOP due calculation through repeated service calls; this can be slower and more failure-prone than a single RPC.
- Harvest estimation is not implemented as automatic estimation. The project scope documents intentionally replace it with growth phase monitoring.
- Some photo flows are multi-step client operations: create record/task activity first, then upload photo metadata/storage object.
- No automated UI tests or black-box execution results were found in the codebase.
- Owner report/task screens enrich worker names through separate RPCs; missing profile/RLS data can degrade labels to fallback text.

