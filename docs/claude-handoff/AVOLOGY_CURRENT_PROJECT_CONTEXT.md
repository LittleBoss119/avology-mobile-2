# Avology V2 Current Project Context for Claude

## 1. Executive Summary

- Avology V2 is currently a React Native Expo Router app backed by Supabase. The repository is not just a tree CRUD prototype; it has owner and worker role flows for farm access, workers, trees, reports, SOPs, schedules, tasks, dashboards, and photo attachments.
- Current code compiles with `npm run typecheck` as of this audit. Database tests and manual app/UAT tests were not run because they require a configured Supabase project and can mutate test data.
- The codebase has substantially outgrown the older implementation master plan. Later migrations add photo storage, `requires_photo`, harvest records, manual care records, owner report response notes, cancelled schedules, leave/rejoin handling, and edit/soft-delete support for tree records.
- Actual routes exist for auth, onboarding, owner dashboard, worker dashboard, tree list/detail/create/edit/archive, condition reports, growth phase, harvest, manual care, SOPs, schedules, tasks, operational reports, farm/profile, and worker management.
- Supabase integration is direct through `@supabase/supabase-js`; there is no custom backend. Most business operations are in `src/services/*`, with important transactional work delegated to database RPCs.
- Photo/media is implemented in code for tree main photos, condition records, growth phase records, operational reports, task proof photos, harvest records, and manual care records, but storage/RLS behavior still needs real Supabase/device regression testing.
- Role and access guards are real: `src/utils/routeGuard.ts` redirects anonymous, no-farm, pending, rejected, removed, owner, and worker states. Manual deep-link regression remains important.
- UI has a shared component/theme system and role bottom navigation. It is more polished than a raw scaffold, but it still uses hand-drawn glyphs instead of an icon library and should be manually reviewed on target devices for density, overflow, and visual consistency.
- Older audit docs contain stale risk context, such as an untracked `017_hotfix` migration and dirty service files. Current repository state observed before this handoff was clean and migrations now run through `024_fix_operational_report_status_rpc_overload.sql`.

## 2. Product Definition

Avology V2 is a mobile operational farm management app for avocado farms. It is designed for two roles:

- Owner: creates and manages a farm, approves/rejects/removes workers, manages tree records, monitors dashboards, manages SOP templates, creates care schedules/tasks, reviews worker operational reports, and follows up reports with tasks.
- Worker: joins a farm by code, waits for approval, sees assigned tasks, records task realization, reports operational issues, views tree data, and records tree condition/growth/harvest/care observations.

The source-of-truth docs define the product as a practical farm operations system, not an automatic prediction, IoT, accounting, or chat app. The academic/product direction emphasizes operational traceability: trees, conditions, growth phases, care activity history, worker task realization, operational reports, and concise dashboards.

## 3. Current Tech Stack

- Framework: Expo `^56.0.9`, React Native `^0.85.3`, React `19.2.3`.
- Routing: Expo Router `^56.2.9`, route groups under `app/(auth)`, `app/(onboarding)`, `app/(owner)`, and `app/(worker)`.
- Language: TypeScript `^6.0.3`.
- Backend: Supabase directly from the mobile app; no Express/Nest/custom backend.
- Database: PostgreSQL via Supabase migrations in `supabase/migrations`.
- Auth: Supabase Auth email/password, persisted with `@react-native-async-storage/async-storage`.
- Storage: Supabase Storage private bucket `avology-photos`; image picking through `expo-image-picker`; file helpers through `expo-file-system`.
- Testing scripts/tools: `npm run typecheck`, `npm run test:db:check`, `npm run test:db:all`, plus scripts under `scripts/db-tests`.
- Important packages: `@supabase/supabase-js`, `expo-router`, `expo-image-picker`, `expo-file-system`, `@react-native-community/datetimepicker`, `react-native-safe-area-context`, `react-native-gesture-handler`, `react-native-reanimated`.

## 4. Actual Repository Structure

- `app/`: Expo Router screens and route group layouts.
- `app/(auth)`: get-started, login, register.
- `app/(onboarding)`: create farm, join farm, access status screens, profile/password.
- `app/(owner)/owner`: owner routes for dashboard, farm, workers, trees, SOPs, schedules, tasks, reports, profile.
- `app/(worker)/worker`: worker routes for dashboard, farm, trees, tasks, reports, profile.
- `src/components`: shared reusable UI and feature screens, including tree detail/forms, operational report screens, profile/password screens, media components, SOP/schedule components, task proof UI.
- `src/services`: Supabase service layer for auth, farms, members, trees, condition reports, growth phases, harvest, manual care, history, operational reports, SOPs, schedules, tasks, dashboards, and photo attachments.
- `src/lib`: Supabase client setup and media picker helpers.
- `src/context`: auth/session context.
- `src/types`: domain and media TypeScript types.
- `src/utils`: display formatting, tree formatting, route guard, service-result helpers.
- `src/constants`: theme tokens.
- `supabase/migrations`: SQL migrations `001` through `024`, including schema, RLS, RPCs, storage policies, and later feature-completion migrations.
- `scripts/db-tests`: database/RLS/RPC test scripts.
- `docs/source-of-truth`: product, requirement, database, testing, UAT, and decision documentation.
- `docs/product-alignment`, `docs/reviews`, `docs/ui-review`, `docs/audit`, `docs/testing`: planning, review, audit, design, and regression references.

## 5. Current Navigation and Routes

| Role/Area | Route/Screen | File Path | Status | Notes |
| --- | --- | --- | --- | --- |
| Root | `/` access redirect | `app/index.tsx` | IMPLEMENTED | Uses auth context and route guard to redirect by membership status/role. |
| Auth | group layout | `app/(auth)/_layout.tsx` | IMPLEMENTED | Redirects signed-in users away from auth screens. |
| Auth | `/get-started` | `app/(auth)/get-started.tsx` | IMPLEMENTED | Public landing/start route. |
| Auth | `/login` | `app/(auth)/login.tsx` | IMPLEMENTED | Uses `loginUser`. |
| Auth | `/register` | `app/(auth)/register.tsx` | IMPLEMENTED | Uses `registerUser`. |
| Onboarding | group layout | `app/(onboarding)/_layout.tsx` | IMPLEMENTED | Handles no-farm and inactive membership access recovery. |
| Onboarding | `/onboarding` | `app/(onboarding)/onboarding.tsx` | IMPLEMENTED | Select create/join path. |
| Onboarding | `/create-farm` | `app/(onboarding)/create-farm.tsx` | IMPLEMENTED | Uses `createFarm`. |
| Onboarding | `/join-farm` | `app/(onboarding)/join-farm.tsx` | IMPLEMENTED | Uses `requestJoinFarm`. |
| Onboarding | `/pending-approval` | `app/(onboarding)/pending-approval.tsx` | IMPLEMENTED | Access-status screen wrapper. |
| Onboarding | `/rejected` | `app/(onboarding)/rejected.tsx` | IMPLEMENTED | Access-status screen wrapper; needs manual route regression. |
| Onboarding | `/removed-access` | `app/(onboarding)/removed-access.tsx` | IMPLEMENTED | Access-status screen wrapper; needs manual route regression. |
| Account | onboarding profile/password | `app/(onboarding)/profile.tsx`, `app/(onboarding)/password.tsx` | IMPLEMENTED | Reuses profile/password components. |
| Owner | group layout | `app/(owner)/_layout.tsx` | IMPLEMENTED | Owner guard plus role bottom navigation on top-level routes. |
| Owner | `/owner` dashboard | `app/(owner)/owner/index.tsx` | IMPLEMENTED | Uses dashboard summary service. |
| Owner | `/owner/farm` | `app/(owner)/owner/farm.tsx` | IMPLEMENTED | Farm hub with member/dashboard data. |
| Owner | `/owner/farm-profile` | `app/(owner)/owner/farm-profile.tsx` | IMPLEMENTED | Farm detail/update. |
| Owner | `/owner/workers` | `app/(owner)/owner/workers.tsx` | IMPLEMENTED | Pending/active/removed worker management. |
| Owner | `/owner/profile`, `/owner/profile-password` | `app/(owner)/owner/profile.tsx`, `app/(owner)/owner/profile-password.tsx` | IMPLEMENTED | Account profile/password. |
| Owner | `/owner/trees` | `app/(owner)/owner/trees/index.tsx` | IMPLEMENTED | List/search/filter/archive state with main photos. |
| Owner | `/owner/trees/create` | `app/(owner)/owner/trees/create.tsx` | IMPLEMENTED | Create tree with optional main photo. |
| Owner | `/owner/trees/[treeId]` | `app/(owner)/owner/trees/[treeId].tsx` | IMPLEMENTED | Shared tree detail with owner menu, photos, timeline. |
| Owner | `/owner/trees/[treeId]/edit` | `app/(owner)/owner/trees/[treeId]/edit.tsx` | IMPLEMENTED | Edit tree and main photo. |
| Owner | `/owner/trees/[treeId]/report` | `app/(owner)/owner/trees/[treeId]/report.tsx` | IMPLEMENTED | Condition report form with optional photo. |
| Owner | `/owner/trees/[treeId]/phase` | `app/(owner)/owner/trees/[treeId]/phase.tsx` | IMPLEMENTED | Growth phase form with optional photo. |
| Owner | `/owner/trees/[treeId]/harvest` | `app/(owner)/owner/trees/[treeId]/harvest.tsx` | IMPLEMENTED | Harvest record form. |
| Owner | `/owner/trees/[treeId]/care` | `app/(owner)/owner/trees/[treeId]/care.tsx` | IMPLEMENTED | Manual care record form. |
| Owner | tree record detail/edit | `app/(owner)/owner/trees/[treeId]/records/[recordType]/[recordId].tsx`, `.../edit.tsx` | IMPLEMENTED | Shared record detail/edit for condition, phase, harvest, manual care. |
| Owner | `/owner/growth-monitoring` | `app/(owner)/owner/growth-monitoring.tsx` | IMPLEMENTED | Lists flowering/fruiting trees via shared component. |
| Owner | `/owner/sops` | `app/(owner)/owner/sops/index.tsx` | IMPLEMENTED | SOP list/filter. |
| Owner | `/owner/sops/create` | `app/(owner)/owner/sops/create.tsx` | IMPLEMENTED | Create SOP. |
| Owner | `/owner/sops/[sopId]` | `app/(owner)/owner/sops/[sopId].tsx` | IMPLEMENTED | SOP detail, active toggle, next schedule reference. |
| Owner | `/owner/sops/[sopId]/edit` | `app/(owner)/owner/sops/[sopId]/edit.tsx` | IMPLEMENTED | Edit SOP. |
| Owner | `/owner/sops/[sopId]/schedule` | `app/(owner)/owner/sops/[sopId]/schedule.tsx` | IMPLEMENTED | Create schedule from SOP. |
| Owner | `/owner/schedules` | `app/(owner)/owner/schedules/index.tsx` | IMPLEMENTED | Schedule list with workers/tasks. |
| Owner | `/owner/schedules/create` | `app/(owner)/owner/schedules/create.tsx` | IMPLEMENTED | Manual schedule creation. |
| Owner | `/owner/schedules/[scheduleId]` | `app/(owner)/owner/schedules/[scheduleId].tsx` | IMPLEMENTED | Detail/cancel/tasks/proof photos. |
| Owner | `/owner/schedules/[scheduleId]/edit` | `app/(owner)/owner/schedules/[scheduleId]/edit.tsx` | PARTIAL | File exists and typechecks; not explicitly registered in owner stack layout. Expo Router may still discover it, but manual navigation/deep-link test is needed. |
| Owner | `/owner/tasks` | `app/(owner)/owner/tasks/index.tsx` | IMPLEMENTED | Farm task list with worker labels. |
| Owner | `/owner/tasks/[taskId]` | `app/(owner)/owner/tasks/[taskId].tsx` | IMPLEMENTED | Owner task detail and proof-photo viewing. |
| Owner | `/owner/reports` | `app/(owner)/owner/reports/index.tsx` | IMPLEMENTED | Operational report list/review wrapper. |
| Owner | `/owner/reports/[reportId]` | `app/(owner)/owner/reports/[reportId].tsx` | IMPLEMENTED | Operational report detail/status. |
| Owner | `/owner/reports/[reportId]/task` | `app/(owner)/owner/reports/[reportId]/task.tsx` | IMPLEMENTED | Create task from operational report. |
| Worker | group layout | `app/(worker)/_layout.tsx` | IMPLEMENTED | Worker guard plus role bottom navigation on top-level routes. |
| Worker | `/worker` dashboard | `app/(worker)/worker/index.tsx` | IMPLEMENTED | Uses worker dashboard summary. |
| Worker | `/worker/farm` | `app/(worker)/worker/farm.tsx` | IMPLEMENTED | Farm/member view and leave farm action. |
| Worker | `/worker/profile`, `/worker/profile-password` | `app/(worker)/worker/profile.tsx`, `app/(worker)/worker/profile-password.tsx` | IMPLEMENTED | Account profile/password. |
| Worker | `/worker/trees` | `app/(worker)/worker/trees/index.tsx` | IMPLEMENTED | Tree list with photos; active trees only. |
| Worker | `/worker/trees/[treeId]` | `app/(worker)/worker/trees/[treeId].tsx` | IMPLEMENTED | Shared tree detail without owner-only archive/photo menu. |
| Worker | tree report/phase/harvest/care | `app/(worker)/worker/trees/[treeId]/*` | IMPLEMENTED | Wrappers for shared forms. |
| Worker | tree record detail/edit | `app/(worker)/worker/trees/[treeId]/records/[recordType]/[recordId].tsx`, `.../edit.tsx` | IMPLEMENTED | Shared record detail/edit; author ownership rules handled by services/RPC. |
| Worker | `/worker/tasks` | `app/(worker)/worker/tasks/index.tsx` | IMPLEMENTED | Worker task list. |
| Worker | `/worker/tasks/[taskId]` | `app/(worker)/worker/tasks/[taskId].tsx` | IMPLEMENTED | Complete/postpone task, required proof photo handling. |
| Worker | `/worker/reports` | `app/(worker)/worker/reports/index.tsx` | IMPLEMENTED | Worker report list wrapper. |
| Worker | `/worker/reports/create` | `app/(worker)/worker/reports/create.tsx` | IMPLEMENTED | Create operational report with optional photo. |
| Worker | `/worker/reports/[reportId]` | `app/(worker)/worker/reports/[reportId].tsx` | IMPLEMENTED | Worker report detail. |
| Worker | `/worker/reports/[reportId]/edit` | `app/(worker)/worker/reports/[reportId]/edit.tsx` | IMPLEMENTED | Worker edit own report when eligible. |

## 6. Current Feature Audit

| Module | Intended Scope | Actual Implementation Evidence | Status | Gap / Risk |
| --- | --- | --- | --- | --- |
| Auth | Register, login, logout, session persistence. | `src/services/authService.ts`, `src/context/auth-context.tsx`, auth routes. | IMPLEMENTED | Needs real-device login/logout check with Supabase env. |
| Profile Account | View/update name/phone/password. | `src/components/profile-screen.tsx`, `src/components/account-password-screen.tsx`, owner/worker/onboarding profile routes. | IMPLEMENTED | Password update depends on Supabase session behavior. |
| Farm Creation | Owner creates farm and becomes active owner. | `app/(onboarding)/create-farm.tsx`, `createFarm`, RPC `create_farm_with_owner`. | IMPLEMENTED | Must verify RPC deployed in target DB. |
| Join Farm | Worker requests join by code. | `app/(onboarding)/join-farm.tsx`, `requestJoinFarm`, inactive rejoin migration `012` and updated migration `020`. | IMPLEMENTED | Rejoin semantics need manual test for rejected/removed users. |
| Pending/Rejected/Removed Guard | Redirect access-state users and block operational screens. | `src/utils/routeGuard.ts`, onboarding access screens, role layouts. | IMPLEMENTED | Deep-link matrix for inactive accounts still needs manual verification. |
| Worker Management | Owner approves/rejects/removes/list workers. | `app/(owner)/owner/workers.tsx`, `memberService.ts`, RPCs/migrations. | IMPLEMENTED | Owner/member profile visibility depends on RPC/RLS grants. |
| Tree Management | Owner create/edit/archive/restore; worker view only. | `treeService.ts`, owner tree routes, worker tree list/detail, archive guard. | IMPLEMENTED | Permanent delete intentionally absent. |
| Tree Detail | View identity, condition, phase, photos, timeline, actions. | `src/components/tree-detail-screen.tsx`, `tree-components.tsx`, history/photo services. | IMPLEMENTED | Needs visual/device QA for media-heavy timeline. |
| Tree Condition Reports | Owner/worker create/view/edit/delete own reports. | `conditionReportService.ts`, condition form, record detail/edit routes, migration `023`. | IMPLEMENTED | Optional photo upload is not atomic with report creation. |
| Growth Phase Records | Owner/worker create/view/edit/delete own phases. | `growthPhaseService.ts`, growth phase screen, record detail/edit routes, migration `023`. | IMPLEMENTED | No automatic prediction; docs say this is monitoring only. |
| Operational Reports | Worker create/list/detail/edit; owner list/detail/status/reopen/follow-up task. | `operationalReportService.ts`, `operational-report-screen.tsx`, owner/worker report routes, migrations `020`-`024`. | IMPLEMENTED | Optional photo upload is not atomic; RPC overload fixed in `024` but target DB must be current. |
| SOP Care Templates | Owner CRUD/active toggle/next schedule reference. | `careSopService.ts`, owner SOP routes/components. | IMPLEMENTED | Next schedule reference calculated through multiple queries, not a single DB aggregate. |
| Care Schedules | Owner creates from SOP/manual, views detail, cancels, edits if eligible. | `careScheduleService.ts`, schedule routes, migration `020` cancellation RPC. | IMPLEMENTED | Edit route file exists but is not listed in owner stack screen declarations; manual navigation test required. |
| Worker Tasks | Owner sees farm tasks; worker sees assigned tasks. | `careTaskService.ts`, owner/worker task routes. | IMPLEMENTED | Worker assignment from SOP schedule is effectively one worker despite type naming `assignedWorkerIds`. |
| Care Activities / Task Realization | Worker completes/postpones tasks; owner/worker see activity history. | `completeTask`, `postponeTask`, `updateLatestTaskRealization`, task detail screens, task proof component. | IMPLEMENTED | Complete + proof-photo upload is client-coordinated and not fully atomic. |
| Photo Attachments / Storage | Private bucket and attachment records for multiple entities. | `src/services/photoAttachmentService.ts`, `src/lib/media.ts`, `src/components/media/*`, migrations `013`-`020`. | IMPLEMENTED | Requires real Supabase Storage/RLS/device permission regression. |
| Dashboard Owner | Operational summary and priority cards. | `dashboardService.ts`, `app/(owner)/owner/index.tsx`. | IMPLEMENTED | Many independent queries; performance and partial failure behavior need realistic data testing. |
| Dashboard Worker | Today/unfinished/completed task summary and quick actions. | `dashboardService.ts`, `app/(worker)/worker/index.tsx`. | IMPLEMENTED | Date comparisons depend on device-local date; verify Asia/Jakarta behavior. |
| Role/RLS Access Control | Role-specific app routing and DB policies. | `routeGuard.ts`, layouts, migrations `007` and later policy refinements. | IMPLEMENTED | Actual deployed Supabase policies must be audited; code compile cannot prove RLS. |
| UI/UX Polish | Mobile-first owner/worker UI with reusable cards, badges, filters, forms. | `src/components/ui.tsx`, theme, bottom nav, dashboard/tree/report components. | PARTIAL | Visual polish exists but still needs manual screenshot review, overflow checks, and icon-system consistency. |
| Testing | Typecheck, DB test scripts, black-box/UAT docs. | `package.json`, `scripts/db-tests/*`, `docs/source-of-truth/16-black-box-plan-testing.md`, `17-uat-plan.md`. | PARTIAL | `npm run typecheck` passes; no saved current DB/manual/UAT results found. |

## 7. Database and Supabase State

### Tables found in migrations/schema

- Core: `profiles`, `farms`, `farm_members`.
- Tree/report foundation: `trees`, `tree_condition_reports`, `operational_reports`.
- Care operations: `care_sops`, `care_schedules`, `care_tasks`, `care_activities`.
- Growth/history: `growth_phase_records`, `tree_history_view`.
- Media: `photo_attachments`, storage bucket `avology-photos`.
- Later feature completion: `harvest_records`, `manual_care_records`.

Key files:

- `supabase/migrations/001_create_extensions_and_enums.sql`
- `supabase/migrations/002_create_core_tables.sql`
- `supabase/migrations/003_create_tree_and_report_tables.sql`
- `supabase/migrations/004_create_care_sop_schedule_task_tables.sql`
- `supabase/migrations/005_create_growth_phase_and_history_view.sql`
- `supabase/migrations/013_create_photo_attachments_and_storage.sql`
- `supabase/migrations/020_feature_completion_database_foundation.sql`
- `supabase/migrations/023_tree_record_edit_delete_foundation.sql`

### RPC/functions found

Important RPC/function families found:

- Farm/member access: `create_farm_with_owner`, `get_current_user_access`, `request_join_farm`, `approve_worker`, `reject_worker`, `remove_worker`, `leave_current_farm`.
- Worker/member display: `get_pending_workers`, `get_active_workers`, `get_active_workers_for_task_picker`, `get_member_basic_profiles`, `get_farm_actor_display_profiles`.
- Schedule/task/report: `create_schedule_from_sop`, `create_manual_schedule`, `create_task_from_operational_report`, `complete_task`, `postpone_task`, `rollback_completed_task_activity`, `cancel_care_schedule`, `update_operational_report_status`, `reopen_operational_report`, `update_own_operational_report`.
- Farm profile: `update_farm_profile`.
- Tree record edit/delete: `update_own_tree_condition_report`, `soft_delete_own_tree_condition_report`, `update_own_growth_phase_record`, `soft_delete_own_growth_phase_record`, `update_own_harvest_record`, `soft_delete_own_harvest_record`, `update_own_manual_care_record`, `soft_delete_own_manual_care_record`.
- Trigger helpers: `set_updated_at`, `generate_join_code`, `prevent_tree_delete`, `sync_tree_current_condition`, `sync_tree_current_growth_phase`, `sync_task_status_from_activity`.
- RLS helpers: `is_active_farm_member`, `is_active_owner`, `is_active_worker`, `is_active_worker_user`, `can_view_profile`.
- Storage helpers: `avology_storage_path_farm_id`, `avology_storage_path_entity_folder`, `avology_storage_path_entity_id`, `avology_storage_path_task_id`, and entity-specific photo access/upload helpers.

### RLS policies found

RLS is enabled for core tables in `007_enable_rls_and_policies.sql` and later for `photo_attachments`, `harvest_records`, and `manual_care_records`. Policies cover:

- Own profile visibility/update.
- Active member farm/tree/report/SOP/schedule visibility.
- Owner-only tree/SOP/schedule/task management.
- Worker-owned operational report insertion and task activity insertion.
- Owner/worker task/activity visibility boundaries.
- Entity-specific photo attachment/storage read/upload/delete rules.

### Storage buckets/policies found

- Bucket: `avology-photos`.
- Configuration evidence: `013_create_photo_attachments_and_storage.sql` and `019_sync_photo_attachment_entity_policies.sql`.
- Intended private bucket with 5 MB max size and image MIME types.
- Supported storage paths include trees, condition reports, growth phase records, operational reports, task proofs, harvest records, and manual care records.

### Mismatch between code expectations and database schema

- Current code expects migrations through at least `024`. A target Supabase database that only has older migrations will fail on fields/RPCs such as `requires_photo`, `owner_response_note`, `is_cancelled`, `removed_at`, `source_id`, `harvest_records`, `manual_care_records`, and updated `update_operational_report_status`/`create_task_from_operational_report` signatures.
- Older docs/audits mention only four photo entity types. Current code/types/migrations support seven: `tree_main`, `condition_record`, `growth_phase_record`, `operational_report`, `task_proof`, `harvest_record`, `manual_care_record`.
- Older `DATABASE_ALIGNMENT_REPORT.md` says `tree_history_view` lacks `source_id`. Current migration `023_tree_record_edit_delete_foundation.sql` recreates `tree_history_view` with `source_id`, and `historyService.ts` selects `source_id`.
- `CreateScheduleFromSOPInput` still has `assignedWorkerIds: UUID[]`, but service validation uses exactly one worker and sends `p_assigned_worker_id`. This is a type/API naming mismatch more than a runtime schema mismatch.

### Known errors / historical notes

- Older `docs/audit/BUG_AND_RISK_REGISTER.md` reports a dirty working tree and an untracked `017_hotfix_requires_photo_columns.sql`. Current observed repository has no `017` migration and `git status --short` was clean before creating this handoff.
- RPC overload around operational report status was addressed by `024_fix_operational_report_status_rpc_overload.sql`; deployed DB still must be verified.

## 8. Service Layer State

| Service File | Functions Found | Used By Screens | Notes / Risks |
| --- | --- | --- | --- |
| `src/services/authService.ts` | `registerUser`, `loginUser`, `logoutUser`, `getCurrentProfile`, `updateCurrentProfile`, `updatePassword` | Auth, profile/password, auth context | Supabase session/env dependent. |
| `src/services/farmService.ts` | `createFarm`, `getCurrentUserFarm`, `getFarmDetail`, `updateFarmProfile` | Create farm, auth context, farm profile | Uses RPCs for create/update/access. |
| `src/services/memberService.ts` | `requestJoinFarm`, worker list/profile RPCs, `approveWorker`, `rejectWorker`, `removeWorker`, `leaveCurrentFarm` | Join farm, workers, farm hubs, task/report labels | Profile visibility and actor labels depend on RPC grants/RLS. |
| `src/services/treeService.ts` | `getTrees`, `getTreeDetail`, `createTree`, `updateTree`, `archiveTree`, `restoreTree` | Tree list/detail/create/edit, target pickers | Owner-only mutations rely on RLS. |
| `src/services/conditionReportService.ts` | Create/list/detail/update/soft-delete condition reports | Tree condition form, detail, record detail/edit | Optional photo is separate from report insert. |
| `src/services/growthPhaseService.ts` | Create/list/detail/update/soft-delete growth phases, flowering/fruiting list | Growth phase form, growth monitoring, record detail/edit | Monitoring only; no prediction. |
| `src/services/harvestService.ts` | Create/list/detail/update/soft-delete harvest records | Harvest form, tree timeline/record detail/edit | Feature exists beyond older plans; needs UAT scope clarity. |
| `src/services/manualCareService.ts` | Create/list/detail/update/soft-delete manual care records | Manual care form, tree timeline/record detail/edit | Feature exists beyond older plans; target validation important. |
| `src/services/historyService.ts` | `getTreeHistory` | Tree detail timeline | Now expects `source_id`; target DB must include migration `023`. |
| `src/services/operationalReportService.ts` | Create/list/detail/status/reopen/edit eligibility/update own report | Owner/worker report screens, report task flow | Optional photo upload and status/task follow-up are multi-step. |
| `src/services/careSopService.ts` | SOP list/detail/create/update/active toggle/next schedule reference | SOP screens, dashboard | Next reference uses multiple queries. |
| `src/services/careScheduleService.ts` | Schedule from SOP/manual, list/detail/cancel/edit eligibility/update | Owner schedule screens and detail | Exactly one worker selected despite `assignedWorkerIds` type. |
| `src/services/careTaskService.ts` | Worker/farm task list/detail, report follow-up tasks, create task, complete/postpone/rollback/update realization | Owner/worker tasks, report task creation | Required proof flow is client-coordinated after activity creation. |
| `src/services/photoAttachmentService.ts` | Upload/list/replace/delete/signed URLs for tree, condition, growth, report, task proof, harvest, manual care photos | Tree screens, reports, tasks, media components | Largest RLS/storage risk surface; needs real Supabase Storage tests. |
| `src/services/dashboardService.ts` | Owner and worker dashboard summaries | Owner/worker dashboards, owner farm hub | Multiple direct queries and client date calculations. |

## 9. UI/UX Current State

- Overall visual quality: moderate-to-good for a thesis MVP. There is a coherent green agritech palette, reusable cards, badges, form fields, date fields, filters, loading/empty/error states, and top app bars.
- Mobile-app feel: real mobile routing and role bottom navigation exist. Layouts use safe-area handling and scrollable screens.
- Dashboard owner quality: implemented with a hero summary, priority cards, monitoring, and quick actions. More useful than a button grid, but still depends on many queries and needs realistic-data/device QA.
- Dashboard worker quality: implemented with a today-task hero, focus card, and quick actions. Simple and aligned with the worker-flow direction.
- Tree list/detail quality: tree list supports search/filter and photos; detail supports hero photo, status, archive owner menu, action buttons, and integrated timeline. This is one of the stronger UI areas.
- Forms quality: most forms have validation, user-facing error banners, date inputs, chips/selectors, and target pickers. Some are text-heavy and should be checked with long Indonesian labels.
- Photo/placeholder usage: `PhotoPickerCard`, `TreeVisualPlaceholder`, thumbnail rows, signed URLs, and delete/change flows exist. Placeholders are present when no image exists.
- Headers/bottom nav/cards/buttons/badges/filters: consistent shared components exist, but icons are mostly hand-drawn simple glyphs rather than a standard icon package.
- Raw UUID/raw enum/internal data in UI: the code has display formatters and sanitizers to reduce UUID/raw enum exposure. A manual pass is still needed because some fallback labels depend on RPC profile data and some internal IDs are used in route logic.

## 10. Known Bugs, Regressions, and Risk Areas

- Target Supabase schema may be behind repository migrations; this would cause missing column/RPC/signature errors.
- Storage/RLS policy behavior for private photos cannot be proven by TypeScript. Needs owner/worker media regression against the actual Supabase project.
- Required task proof flow is not a single DB transaction: task activity can be created before proof upload succeeds. Code has rollback support, but failure paths need UAT.
- Condition report and operational report photos are optional/multi-step; upload failure can leave the core record without a photo.
- Owner dashboard runs many independent queries and per-SOP calculations; realistic farm data may reveal performance or partial-failure issues.
- Worker dashboard date counts use device-local date; verify Asia/Jakarta behavior on target devices.
- Route guard for rejected/removed/pending users should be manually deep-link tested. Code is present, but this area is historically risky.
- Owner schedule edit route exists but is not explicitly declared in `app/(owner)/_layout.tsx`; verify route discovery/navigation manually.
- `CreateScheduleFromSOPInput.assignedWorkerIds` suggests multiple workers but implementation currently accepts exactly one worker.
- Older docs/audits are stale in places; do not blindly follow them without checking current code and latest migrations.
- No current saved DB test or UAT execution artifact was found during this audit.
- `src/lib/supabase.ts` throws at module load if `EXPO_PUBLIC_SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_ANON_KEY` is missing; local dev/test setup must include env values.

## 11. Source-of-Truth vs Actual Code Conflicts

| Topic | Docs Say | Code Seems To Do | Conflict Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Prediction/harvest estimation | Source-of-truth explicitly removes automatic prediction and reframes as growth phase monitoring. | No ML/prediction service found; growth phase monitoring exists. Harvest record screens/services also exist. | LOW | Keep thesis wording as monitoring/recording, not prediction. Explain harvest records as manual operational records. |
| Database schema finality | Older master plan final schema stops at core MVP tables and `tree_history_view`. | Migrations add photos, `requires_photo`, cancellation, harvest/manual care, owner response notes, edit/soft-delete, source IDs. | MEDIUM | Treat latest migrations as code truth; update docs if final thesis schema must match implementation. |
| Photo entity support | Older database alignment text lists only tree, condition, operational report, and task proof photo entities. | Current code/types/migrations support growth phase, harvest, and manual care photos too. | MEDIUM | Update any final DB/design docs to include all supported photo entities or intentionally de-scope unused ones. |
| `tree_history_view.source_id` | Older audit says source IDs are missing and inferred. | Current migration `023` recreates view with `source_id`; `historyService.ts` selects it. | LOW | Mark older audit as stale; verify target DB has migration `023`. |
| Dirty baseline / migration 017 | Older bug register says working tree was dirty and `017_hotfix` was untracked. | Current observed repo had clean `git status --short`; migrations include `016`, `018`, `019`, `020`, `021`, `022`, `023`, `024`, no `017`. | LOW | Do not act on stale `017` note unless it appears in another branch/environment. |
| SOP schedule worker assignment | Type name/docs imply `assignedWorkerIds` array. | Service validates exactly one worker and passes `p_assigned_worker_id`. | MEDIUM | Either rename/narrow the type or intentionally implement multiple worker tasks later. |
| UI design reference | Review docs call for stronger branded/mobile/agritech visuals, grid tree cards, hero photos, and tighter polish. | Code has improved reusable UI and photos, but still uses simple cards/hand glyphs and needs screenshot QA. | MEDIUM | Continue UI reconstruction by batches after core regression tests. |
| Testing readiness | Docs include black-box/UAT plans. | Scripts and checklists exist; no current executed result artifact found. | HIGH | Run DB tests, black-box checklist, and UAT prep before final handoff/thesis freeze. |

## 12. What Must Not Be Changed Casually

- Do not rewrite database/RLS without a table-by-table and policy-by-policy audit.
- Do not remove working features just because older planning docs omit them.
- Do not expose UUIDs, raw enum values, or Postgres/Supabase technical errors to users.
- Preserve owner/worker role behavior and inactive membership guards.
- Preserve the Supabase service layer shape unless there is a focused reason to refactor.
- Keep worker flows simple, short, and action-oriented.
- Do not add prediction/ML/IoT/chat/accounting unless explicitly approved.
- Do not do a giant all-in-one redesign. Continue in small, testable batches.
- Do not treat old docs as implementation truth when current code/migrations disagree.
- Do not run DB test scripts against production data.

## 13. Recommended Next Steps for Claude

### P0: Stabilization and Regression Audit

- Goal: prove the current repository baseline works before changing behavior.
- Files likely involved: `package.json`, `scripts/db-tests/*`, `docs/testing/*`, `app/(*)/_layout.tsx`, `src/utils/routeGuard.ts`.
- Acceptance criteria: `npm run typecheck` passes; DB tests run on a safe test Supabase project; manual route/access matrix result is captured in docs.
- Manual test checklist: auth redirect, anonymous deep link, pending worker, rejected worker, removed worker, active owner, active worker, logout.

### P1: Fix Critical Bugs/Schema Mismatches

- Goal: align deployed Supabase database with latest frontend expectations.
- Files likely involved: `supabase/migrations/018_*` through `024_*`, `src/services/careScheduleService.ts`, `src/services/careTaskService.ts`, `src/services/operationalReportService.ts`, `src/services/historyService.ts`, `src/services/photoAttachmentService.ts`.
- Acceptance criteria: target DB has required columns/RPC signatures/storage policies; DB tests pass; no schema cache errors in app.
- Manual test checklist: create schedule with `requires_photo`, create task from report, update operational report status with owner note, tree timeline source links, photo signed URL view.

### P2: Finish Missing MVP Flows

- Goal: close partial or ambiguous flows without broad redesign.
- Files likely involved: `app/(owner)/_layout.tsx`, `app/(owner)/owner/schedules/[scheduleId]/edit.tsx`, schedule/task services, relevant test docs.
- Acceptance criteria: schedule edit route is reachable and guarded; single-worker vs multi-worker assignment decision is documented; inactive access recovery behavior is verified.
- Manual test checklist: owner edits eligible schedule, cannot edit ineligible schedule, worker sees updated task, rejected/removed user cannot reach operational routes.

### P3: UI/UX Reconstruction by Batch

- Goal: polish screen groups while preserving working service behavior.
- Files likely involved: `src/components/ui.tsx`, `src/constants/theme.ts`, dashboards, tree list/detail, report/task/schedule/SOP screens.
- Acceptance criteria: no raw enum/UUID/technical errors; text fits on mobile; bottom nav/header consistent; key screens match product direction and design references.
- Manual test checklist: screenshots for owner dashboard, worker dashboard, tree list, tree detail, schedule/task detail, report detail, worker farm/profile.

### P4: Photo/Media if Core Is Stable

- Goal: validate and harden media flows after core data flows are stable.
- Files likely involved: `src/lib/media.ts`, `src/services/photoAttachmentService.ts`, `src/components/media/*`, tree/report/task/record screens, storage migrations.
- Acceptance criteria: camera/gallery permissions, size validation, upload, signed URL preview, replace/delete, and RLS access work for owner and worker.
- Manual test checklist: tree main photo, condition photo, growth photo, operational report photo, required task proof, harvest/manual care photos, unauthorized access denial.

### P5: UAT Preparation

- Goal: prepare thesis/UAT evidence without overclaiming.
- Files likely involved: `docs/source-of-truth/16-black-box-plan-testing.md`, `docs/source-of-truth/17-uat-plan.md`, new test-result docs as needed.
- Acceptance criteria: final scope statement matches implementation; test data/users are prepared; UAT scripts cover owner and worker; results are saved.
- Manual test checklist: full owner/worker scenario from registration to logout, including farm, worker approval, tree, reports, SOP/schedule/task, dashboard, and media if included.

## 14. Claude Prompt Starter

```text
You are working in the Avology V2 repository. Before changing any code, read docs/claude-handoff/AVOLOGY_CURRENT_PROJECT_CONTEXT.md completely and use it as the current project handoff.

Treat the actual codebase and latest migrations as implementation truth. Treat docs/source-of-truth and product-alignment docs as product/academic intent. If they conflict, call out the conflict before changing behavior.

Do not start with a broad rewrite. Ask me for the current goal first, then inspect the relevant files and propose a small, testable batch. Preserve owner/worker role behavior, Supabase service-layer boundaries, and existing working flows. Do not add prediction/ML/IoT/chat/accounting unless I explicitly approve it.

Current goal: [paste the specific goal here]
```

## 15. Manual Test Checklist

### Owner Flow

- Register owner account.
- Login owner.
- Create farm.
- View owner dashboard.
- View/update account profile.
- View/update farm profile and join code.
- Approve a pending worker.
- Reject a pending worker.
- Remove an active worker.
- Create tree with row/column/variety/planted date.
- Upload/change/delete tree main photo.
- View tree list filters/search.
- View tree detail and timeline.
- Create tree condition report.
- Create growth phase record.
- Create harvest record.
- Create manual care record.
- Edit/delete own tree records.
- Create SOP care template.
- Edit/activate/deactivate SOP.
- Create schedule from SOP.
- Create manual schedule.
- View/cancel/edit schedule when eligible.
- View owner task list/detail.
- View worker task proof photo.
- View operational reports.
- Update operational report status with owner response note.
- Reopen operational report if supported by flow.
- Create task from operational report.
- Verify dashboard counts update.
- Logout.

### Worker Flow

- Register worker account.
- Login worker with no farm.
- Join farm by join code.
- Verify pending approval screen.
- After owner approval, reach worker dashboard.
- View worker farm/member info.
- View/update account profile.
- View tree list/detail.
- Create condition report.
- Create growth phase record.
- Create harvest record.
- Create manual care record.
- Edit/delete own tree records where allowed.
- Create operational report with optional photo.
- Edit own operational report while eligible.
- View report status/owner response.
- View assigned task list/detail.
- Complete task without photo when allowed.
- Complete required-photo task with proof photo.
- Postpone task with note.
- Verify completed/postponed activity appears.
- Verify dashboard counts update.
- Leave farm if intended for scenario.
- Logout.

### Access/RLS Checklist

- Anonymous user cannot access owner/worker routes.
- Pending worker cannot access worker operational routes.
- Rejected worker sees rejected screen and cannot access old routes.
- Removed worker sees removed-access screen and cannot access old routes.
- Worker cannot access owner routes.
- Owner cannot accidentally land in worker routes.
- Worker cannot mutate owner-only tree/SOP/schedule/task status data.
- Owner can view farm worker/profile labels without exposing sensitive unrelated profiles.
- Photo URLs are only visible to permitted farm members.

