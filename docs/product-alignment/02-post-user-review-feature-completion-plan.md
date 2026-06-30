# Avology V2 Post-User-Review Feature Completion Plan

**Status:** Accepted as the next implementation reference for the feature-completion phase  
**Phase purpose:** Complete missing product features and stabilize feature logic before final UI/UX redesign  
**Primary user-review source:** `V2 Review 2-2.docx`  
**Target project path when copied into repository:** `docs/product-alignment/02-post-user-review-feature-completion-plan.md`

---

## 1. Executive Decision

Avology V2 must stop doing broad UI polish for now.

The next phase is not a visual redesign phase. The next phase is a feature-completion and flow-stabilization phase based on user testing and owner/worker feedback.

The reason is simple: several screens already look cleaner than before, but the product flow is still incomplete. If final UI/UX redesign is done before the missing features are implemented, the design will be rebuilt again after new features are added. That wastes implementation time and Codex usage.

### Final decision for the next phase

```txt
Complete missing features first
↓
Stabilize owner and worker flows
↓
Run regression testing
↓
Only then continue final design logic and visual polish
```

---

## 2. Source-of-Truth Hierarchy for This Phase

For the next implementation phase, Codex must follow this order when there is conflict:

1. `docs/product-alignment/02-post-user-review-feature-completion-plan.md` ← this document
2. `docs/product-alignment/01-product-alignment-decision-log.md`
3. `docs/source-of-truth/decision-log.md` or `decision-log.md`
4. `docs/source-of-truth/04-mvp_scope.md`
5. `docs/source-of-truth/05-requirement.md`
6. `docs/source-of-truth/09-erd.md`
7. `docs/source-of-truth/10-logical-database-schema.md`
8. `docs/source-of-truth/11-sql-schema-draft.md`
9. `docs/source-of-truth/12-service-layer-design.md`
10. `docs/source-of-truth/13-screen-navigation-flow.md`
11. Current implementation code
12. Final UI/UX design docs

### Important rule

If this document introduces a feature that older source-of-truth documents do not contain, Codex must treat it as an accepted post-user-review extension, but must implement it safely and incrementally.

---

## 3. Product Positioning That Must Not Change

Avology V2 remains:

> A mobile operational management application for an avocado farm that helps owner and worker manage trees, care tasks, field reports, care history, growth phase records, and farm monitoring.

Avology V2 is not:

1. A harvest prediction system.
2. A machine-learning system.
3. An IoT system.
4. A chat system.
5. A full accounting system.
6. A marketplace.
7. A full automatic recurring-task scheduler.

---

## 4. Core Problems Found After User Review

The user review shows five major problems:

### 4.1 Feature gaps

Several important operational actions are still missing or incomplete:

1. Growth phase record cannot attach photo.
2. Harvest record does not exist yet.
3. Manual care record does not exist yet.
4. Some task/photo proof flow is still incomplete or not flexible enough.
5. Owner cannot edit or cancel schedule before realization.
6. Worker cannot edit task realization if input is wrong.
7. Worker cannot edit operational report before owner response.
8. Owner cannot reopen or correct rejected operational report.
9. Owner cannot edit farm data.
10. Join code cannot be copied easily.
11. Worker cannot leave farm.

### 4.2 Flow duplication

Several screens or buttons duplicate each other:

1. Farm page and farm profile page repeat the same information.
2. Worker management can be reached by duplicate actions.
3. Owner schedule detail and owner task detail require too many taps to see realization.
4. Profile account is mixed too much with farm page.

### 4.3 Data model gaps

Several new flows need database support:

1. Generic photo attachment relation.
2. Harvest history per tree.
3. Manual care activity not tied to assigned task.
4. Optional photo-proof requirement on schedule/task.
5. Schedule cancellation or lock rule.
6. Editable report/task-realization guard.
7. Worker leave membership status or action.

### 4.4 UX logic gaps

The app still behaves too much like CRUD screens. For this phase, Codex should not do final visual redesign, but it must make the flow logically correct:

1. Owner should not need too many nested screens to see task realization.
2. Worker task flow should remain direct and simple.
3. Important actions should have confirm dialogs.
4. Rejected or finalized data should not become dead-end mistakes.
5. Data with history should not be permanently deleted.

### 4.5 Final visual redesign is premature

The app still needs better visual design later, but feature completion comes first.

Codex must not spend this phase redesigning colors, typography, dashboard visuals, card shapes, or decorative UI unless required by the feature being implemented.

---

## 5. Accepted Feature Extensions

The following extensions are accepted for the next phase.

---

### EXT-01 Generic Photo Attachments

#### Status

Accepted as MVP extension.

#### Reason

Photos are now needed across multiple operational flows, not just as UI decoration.

#### Scope

Photo attachments must support:

1. Main tree photo.
2. Tree condition report photo.
3. Growth phase record photo.
4. Operational report photo.
5. Task realization proof photo.
6. Harvest record photo.
7. Manual care record photo.

#### Database recommendation

Create a generic table:

```sql
photo_attachments
```

Suggested columns:

```txt
id uuid primary key
farm_id uuid not null
entity_type text not null
entity_id uuid not null
storage_path text not null
file_name text
mime_type text
file_size integer
uploaded_by uuid not null
created_at timestamptz not null default now()
```

Suggested allowed `entity_type` values:

```txt
tree
tree_condition_report
growth_phase_record
operational_report
care_activity
harvest_record
manual_care_record
```

Codex may implement this as a Postgres enum if existing schema conventions prefer enums. If enum migration risk is high, use text with a check constraint.

#### Storage

Use Supabase Storage bucket:

```txt
avology-photos
```

Expected storage folder pattern:

```txt
{farm_id}/{entity_type}/{entity_id}/{timestamp-or-random-file-name}.jpg
```

#### Rules

1. Photos are optional unless task requires photo proof.
2. User can upload from camera or gallery if current app already supports both. If not, implement with the least risky existing Expo image picker/camera approach used in the project.
3. Deleting a record should not physically delete photos unless there is an existing safe deletion pattern.
4. If image upload fails, the main record should not be silently created with missing required proof.
5. User-facing error messages must be understandable, not raw Supabase errors.

---

### EXT-02 Required Photo Proof for Task/Schedule

#### Status

Accepted.

#### Reason

Some care tasks need proof of completion.

#### Scope

Owner can choose whether a schedule/task requires photo proof.

#### Database recommendation

Add:

```txt
care_schedules.requires_photo boolean not null default false
care_tasks.requires_photo boolean not null default false
```

When schedule creates tasks, `care_tasks.requires_photo` should inherit from `care_schedules.requires_photo`.

#### Worker rule

If `care_tasks.requires_photo = true`, worker cannot mark task completed without at least one attached photo linked to the resulting `care_activity`.

#### Owner rule

Owner can see proof photos in schedule/task realization view.

---

### EXT-03 Harvest Record

#### Status

Accepted as actual harvest logging only.

#### Important boundary

This is not harvest prediction and not automatic harvest estimation.

Never add labels such as:

```txt
Prediksi Panen
Estimasi Otomatis
AI Panen
Akurasi Panen
```

Allowed labels:

```txt
Catat Panen
Riwayat Panen
Hasil Panen
Performa Panen Pohon
```

#### Database recommendation

Create:

```sql
harvest_records
```

Suggested columns:

```txt
id uuid primary key
farm_id uuid not null
tree_id uuid not null
harvested_by uuid not null
harvested_at timestamptz not null default now()
fruit_count integer not null
fruit_condition text
note text
created_at timestamptz not null default now()
```

Suggested constraints:

```txt
fruit_count > 0
```

#### UI scope

Add from tree detail:

```txt
Catat Panen
```

Tree detail history should include harvest records.

#### Photo

Photo should be linked through `photo_attachments` with:

```txt
entity_type = harvest_record
entity_id = harvest_records.id
```

---

### EXT-04 Manual Care Record

#### Status

Accepted.

#### Reason

Not every care activity comes from an owner-created task. Owner may work alone. Worker may do initiative work that should still be recorded.

#### Implementation options

Preferred option:

Extend `care_activities` to allow manual activity without `care_task_id`.

Suggested new or adjusted fields:

```txt
care_task_id nullable
activity_source text not null default 'task'
category care_category nullable or text
farm_id uuid not null
target_type target_type not null
target_row text nullable
target_column text nullable
target_tree_id uuid nullable
custom_target_note text nullable
performed_by uuid not null
status activity_status not null default 'completed'
note text nullable
performed_at timestamptz not null default now()
```

Allowed `activity_source`:

```txt
task
manual
```

Fallback option:

If changing `care_activities` is too risky, create a separate table:

```sql
manual_care_records
```

Suggested columns:

```txt
id uuid primary key
farm_id uuid not null
performed_by uuid not null
category care_category not null
target_type target_type not null
target_row text nullable
target_column text nullable
target_tree_id uuid nullable
custom_target_note text nullable
note text nullable
performed_at timestamptz not null default now()
created_at timestamptz not null default now()
```

#### Decision for Codex

Codex must inspect the existing database and service implementation first.

Use the lowest-risk approach:

1. If `care_activities.care_task_id` is easy to make nullable without breaking current service, use the preferred option.
2. If it is risky, use the fallback separate table.

#### UI scope

Add from tree detail:

```txt
Catat Perawatan
```

Manual care must appear in tree history when linked to a tree.

#### Photo

Photo should be linked through `photo_attachments`.

---

### EXT-05 Schedule Edit and Cancel

#### Status

Accepted.

#### Reason

Owner can currently create and view schedules, but cannot correct mistakes safely.

#### Scope

Owner can edit or cancel a schedule only if no realization exists for its tasks.

#### Lock rule

A schedule is locked when at least one related task has a realization/activity record.

Locked schedules cannot be edited or cancelled.

#### Database recommendation

Add either:

```txt
care_schedules.status text not null default 'scheduled'
```

Allowed values:

```txt
scheduled
cancelled
completed
```

Or safer minimal fields:

```txt
care_schedules.is_cancelled boolean not null default false
care_schedules.cancelled_at timestamptz nullable
care_schedules.cancelled_by uuid nullable
care_schedules.cancel_reason text nullable
```

Codex must choose the approach that best matches current schema and minimizes enum migration risk.

#### UI scope

Owner schedule detail should support:

1. Edit schedule.
2. Cancel schedule.
3. Show locked state if realization already exists.
4. Show confirmation dialog before cancel.

#### Delete rule

Do not implement hard delete for schedules in this phase.

Use cancel, not delete.

---

### EXT-06 Worker Task Realization Edit

#### Status

Accepted.

#### Reason

Worker may accidentally mark task completed/postponed or upload wrong proof photo.

#### Scope

Worker can edit the latest realization for their own task.

#### Rules

1. Worker can only edit task assigned to them.
2. Worker can only edit latest realization.
3. If task requires photo and status is completed, proof photo remains required.
4. Owner must see updated realization.
5. Do not allow worker to edit other worker's realization.

#### UI scope

Worker task detail should support:

1. Edit realization note/status.
2. Replace or add proof photo if required.
3. Clear confirmation before overwriting submitted realization.

---

### EXT-07 Owner Schedule Detail Realization Summary

#### Status

Accepted.

#### Reason

Owner currently must open schedule detail, then open task detail, just to see realization. That is too many taps.

#### Scope

Owner schedule detail should show worker task realization summary inline.

#### Expected display

For each task in the schedule detail:

```txt
Worker name
Task status
Realization status
Realization note preview
Proof photo indicator if available
Button/link: Buka Detail Tugas
```

#### Rule

Do not remove owner task detail. Just reduce the need to open it for basic monitoring.

---

### EXT-08 Operational Report Edit Before Owner Response

#### Status

Accepted.

#### Reason

Worker may submit report with typo, wrong category, missing photo, or wrong location note.

#### Scope

Worker can edit own operational report only while status is:

```txt
new
```

Worker cannot edit when report is:

```txt
in_progress
resolved
rejected
```

#### UI scope

Worker operational report detail should show Edit action only when editable.

---

### EXT-09 Operational Report Reopen / Correct Owner Decision

#### Status

Accepted.

#### Reason

If owner rejects a report by mistake, worker should not be forced to submit duplicate report.

#### Scope

Owner can reopen rejected report back to:

```txt
new
```

or move it to:

```txt
in_progress
```

depending on current implementation.

#### Rule

Every status-changing action must use confirm dialog.

#### UI scope

Owner report detail should support:

1. Mark in progress.
2. Mark resolved.
3. Reject.
4. Reopen rejected report.
5. Create task from report.

#### Hard rule

Owner must not freely edit the worker's original report content. Owner can add response/status/task, but should not rewrite worker-submitted facts.

---

### EXT-10 Farm Edit and Copy Join Code

#### Status

Accepted.

#### Scope for owner

Owner can:

1. Edit farm name.
2. Edit location.
3. Edit area size.
4. Copy join code.

#### Out of scope

Owner must not delete farm or leave farm in this phase.

#### UI scope

Farm page should expose:

1. Edit Farm.
2. Copy Join Code.
3. Worker Management.
4. SOP Management.

Do not duplicate farm profile page if farm page already shows the same information.

---

### EXT-11 Worker Leave Farm

#### Status

Accepted with caution.

#### Scope

Worker can leave current farm so they can join another farm or create their own farm later.

#### Database options

Preferred clean option:

Add member status:

```txt
left
```

Fallback low-risk option:

Reuse status:

```txt
removed
```

with a reason/audit field if available or added.

#### Recommendation

If adding enum value is safe in current migration setup, add `left`.

If enum migration is risky, use `removed` and add:

```txt
farm_members.removed_reason text nullable
farm_members.removed_by uuid nullable
```

For worker self-leave:

```txt
removed_reason = 'left_by_worker'
removed_by = user_id
```

#### UI scope

Worker farm page should show:

```txt
Keluar dari Kebun
```

with strong confirmation.

#### Rule

Leaving farm must not delete any old task, report, or activity history.

---

### EXT-12 SOP Clarity and Filters

#### Status

Accepted as feature-flow improvement, not final visual redesign.

#### Reason

SOP currently feels abstract and not obviously useful.

#### Scope

Make SOP value clearer by showing:

1. Category.
2. Target.
3. Active/inactive status.
4. Interval days.
5. Last realization date if calculable.
6. Next schedule reference if calculable.
7. Due state: not due, due today, overdue.
8. Action: create schedule from this SOP.

#### Rule

SOP does not automatically create recurring tasks.

Owner must still confirm schedule creation.

#### UI scope

Add filter chips/dropdowns for:

1. Category.
2. Target type.
3. Status active/inactive.

---

## 6. Deferred to Final Design Phase

The following items are important but should wait until feature completion is stable:

1. Full dashboard redesign.
2. Final color palette adjustment.
3. Font change.
4. More organic/non-boxy card visual system.
5. Auth screen visual simplification.
6. Tree list visual redesign with final grid/card system.
7. Final filter component visual design.
8. Bottom nav redesign.
9. Final floating action button behavior.
10. Final detail page visual hierarchy.

Codex must not spend the feature-completion phase doing broad visual polish.

---

## 7. Explicit Non-Goals for This Phase

Codex must not implement:

1. Harvest prediction.
2. Automatic harvest estimation.
3. Machine learning.
4. Push notifications.
5. IoT integration.
6. Weather API.
7. Owner-worker chat.
8. Accounting / profit-loss report.
9. Marketplace.
10. Permanent delete for trees with history.
11. Delete farm.
12. Full recurring automatic task generation.
13. Major navigation redesign.
14. Full UI redesign.
15. Refactor all screens at once.

---

## 8. Database Delta Summary

Codex must inspect existing migrations/schema before implementing. Do not blindly duplicate columns or tables.

### Required or likely required changes

| Area | Change |
| --- | --- |
| Photos | Add `photo_attachments` table and storage bucket/policies |
| Task proof | Add `requires_photo` to `care_schedules` and `care_tasks` if missing |
| Harvest | Add `harvest_records` table |
| Manual care | Extend `care_activities` for manual source, or add `manual_care_records` |
| Schedule cancel | Add schedule status/cancel fields |
| Farm edit | Ensure farm update service/RLS exists |
| Worker leave | Add status `left` or safe removed-reason fields |
| History | Update tree history view/service to include harvest and manual care |

### Migration rules

1. Migrations must be additive and safe.
2. Do not drop existing tables.
3. Do not rewrite existing data destructively.
4. Do not break old task and report records.
5. Do not expose UUIDs in UI.
6. Maintain RLS rules for owner/worker access.

---

## 9. Service Layer Delta Summary

Codex should add or update services in existing service files if they already exist. Avoid creating random duplicate service names.

### Suggested services

```txt
photoService.ts
- uploadPhotoAttachment
- getPhotoAttachments
- getPrimaryPhotoForEntity
- deletePhotoAttachmentMetadataIfSafe
```

```txt
harvestService.ts
- createHarvestRecord
- getHarvestRecordsByTree
- getHarvestRecordDetail
```

```txt
manualCareService.ts or careTaskService.ts extension
- createManualCareRecord
- getManualCareRecordsByTree
```

```txt
careScheduleService.ts
- updateCareSchedule
- cancelCareSchedule
- getScheduleLockState
```

```txt
careTaskService.ts
- completeTaskWithOptionalPhoto
- postponeTaskWithOptionalPhoto
- updateTaskRealization
- getTaskRealizationSummary
```

```txt
operationalReportService.ts
- updateOwnOperationalReport
- reopenOperationalReport
- updateOperationalReportStatusWithConfirmSupport
```

```txt
farmService.ts
- updateFarm
- copyJoinCode is UI-level, but farm detail must expose joinCode
```

```txt
memberService.ts
- leaveCurrentFarm
```

```txt
historyService.ts
- include harvest records
- include manual care records
- include photo indicator if useful
```

---

## 10. Screen Delta Summary

### Owner screens to update

| Screen | Required change |
| --- | --- |
| Tree Detail | Add actions: Catat Kondisi, Catat Fase, Catat Panen, Catat Perawatan |
| Create Growth Phase | Add optional photo upload |
| Create Harvest Record | New screen/form |
| Create Manual Care Record | New screen/form |
| Schedule Detail | Show inline task realization summary; add edit/cancel if unlocked |
| Edit Schedule | New or reuse create schedule form in edit mode |
| Task Detail Owner | Show proof photos and realization detail |
| Operational Report Detail | Add reopen rejected report and confirm status changes |
| Farm/Kebun | Add edit farm, copy join code, remove duplicate navigation |
| Worker Management | Simplify active/pending focus; old inactive history can be hidden/collapsed |
| SOP List/Detail | Add useful filter and clarify next schedule reference |

### Worker screens to update

| Screen | Required change |
| --- | --- |
| Task Detail | Required proof photo if task requires photo; edit latest realization |
| Tree Detail | Add Catat Kondisi, Catat Fase, Catat Panen if allowed, Catat Perawatan if allowed |
| Create Growth Phase | Add optional photo upload |
| Create Manual Care Record | New screen/form |
| Operational Report Detail | Allow edit only while status is `new` |
| Create/Edit Operational Report | Support photo upload |
| Farm/Kebun | Add leave farm action with confirmation |

### Shared screens/components

| Component | Required change |
| --- | --- |
| Photo picker/uploader | Reusable component for optional/required photo |
| Confirm dialog | Reusable for destructive/status-changing actions |
| Attachment preview | Reusable photo preview grid/list |
| Empty/error state | Must not show raw IDs or raw Supabase errors |

---

## 11. Role and Permission Rules

### Owner

Owner can:

1. Manage farm data.
2. Copy join code.
3. Manage workers.
4. Manage trees.
5. Create condition, phase, harvest, and manual care records.
6. Create/edit/cancel unlocked schedules.
7. Create schedule from SOP/manual.
8. See worker task realization and proof photos.
9. Manage operational report status.
10. Reopen rejected operational report.
11. Create task from operational report.

Owner cannot:

1. Delete farm in this phase.
2. Permanently delete historical data.
3. Freely rewrite worker report content.

### Worker

Worker can:

1. See assigned tasks.
2. Complete or postpone assigned tasks.
3. Upload proof when required.
4. Edit latest realization for own task.
5. Create condition and phase records.
6. Create manual care record if allowed by current role policy.
7. Create operational report with photo.
8. Edit own operational report only while status is `new`.
9. Leave farm with confirmation.

Worker cannot:

1. Edit tree master data.
2. Manage SOP.
3. Manage schedules.
4. Manage workers.
5. Access owner-only reports beyond allowed data.
6. Edit reports after owner response.

---

## 12. Implementation Batches

This section is the main Codex roadmap. Do not skip batches unless the feature already exists and has been verified.

---

### Batch 0 — Audit Current Implementation

#### Goal

Inspect current implementation and produce a precise gap report before editing code.

#### Codex must check

1. Existing database migrations/schema.
2. Existing Supabase storage setup.
3. Existing photo upload implementation.
4. Existing `requires_photo` columns.
5. Existing tree photo implementation.
6. Existing condition report photo implementation.
7. Existing task proof implementation.
8. Existing schedule edit/cancel support.
9. Existing report edit/reopen support.
10. Existing farm edit/copy/worker leave support.
11. Existing services and routes.

#### Output

A report with:

```txt
Already implemented:
Missing:
Partially implemented:
Risky areas:
Recommended implementation order:
Files inspected:
No code changed.
```

#### Hard rule

No code changes in Batch 0.

---

### Batch 1 — Database and Type Foundation

#### Goal

Add all missing database foundation for feature-completion phase.

#### Scope

1. `photo_attachments` table.
2. Supabase storage bucket/policy if project handles this through SQL.
3. `requires_photo` columns in schedules/tasks if missing.
4. `harvest_records` table.
5. Manual care foundation: extend `care_activities` or create `manual_care_records`.
6. Schedule cancel/status fields.
7. Worker leave support: `left` status or safe removed-reason fields.
8. Update generated/custom TypeScript database/domain types if project uses them manually.

#### Do not

1. Do not modify UI broadly.
2. Do not implement full upload UI yet.
3. Do not rewrite old migrations.
4. Do not drop existing data.

#### Testing

1. TypeScript should still compile.
2. Existing auth/farm/tree/task screens should not break.
3. Existing DB tests, if available, should pass.

---

### Batch 2 — Media Service and Reusable Attachment UI

#### Goal

Create reusable media infrastructure without wiring every screen yet.

#### Scope

1. Add `photoService` or extend existing media service.
2. Add reusable photo picker/uploader component.
3. Add reusable attachment preview component.
4. Add helper to upload photo after entity creation.
5. Add helper to fetch photo attachments by entity.
6. Add safe error handling.

#### Rules

1. Keep UI simple.
2. Do not redesign screens.
3. Do not force all forms to use photos yet.
4. Reuse existing Expo ImagePicker/Camera setup if already installed.
5. If dependency is missing, Codex must report required install command instead of silently adding random incompatible packages.

#### Testing

1. TypeScript compile.
2. Photo helper functions import correctly.
3. No existing screen breaks.

---

### Batch 3 — Tree, Condition, and Growth Phase Photos

#### Goal

Complete photo support for tree-related records.

#### Scope

1. Main tree photo attach/change/view.
2. Condition report optional photo.
3. Growth phase record optional photo.
4. Tree detail shows main tree photo or fallback.
5. Tree history shows photo indicator or preview for condition/phase items if practical.

#### Rules

1. Worker still cannot edit tree master data.
2. Tree main photo owner-only unless current product decision allows worker. Default: owner-only.
3. Condition and phase photo optional.
4. No broad visual redesign.

#### Testing

Owner:

1. Add/change tree photo.
2. Create condition report with photo.
3. Create growth phase record with photo.
4. Open tree detail and verify image appears.

Worker:

1. Create condition report with photo.
2. Create growth phase record with photo.
3. Verify worker cannot edit tree master data.

---

### Batch 4 — Task Proof Photo and Required Proof Flow

#### Goal

Make `requires_photo` meaningful in schedules/tasks and worker realization.

#### Scope

1. Owner can set `requires_photo` when creating schedule from SOP/manual.
2. Generated task inherits `requires_photo`.
3. Worker task detail shows whether proof is required.
4. Worker cannot complete required-photo task without photo.
5. Worker can postpone task with or without photo unless product logic currently requires otherwise.
6. Owner can view proof photo in task detail and schedule realization summary.

#### Rules

1. Do not break tasks that do not require photo.
2. Do not block postponed status unless explicitly required.
3. No push notification.

#### Testing

1. Create schedule requiring photo.
2. Login worker.
3. Try completing without photo, must fail with friendly message.
4. Complete with photo, must succeed.
5. Owner sees proof photo.
6. Schedule/task without photo requirement still works.

---

### Batch 5 — Harvest Record and Manual Care Record

#### Goal

Add the two missing tree-operational logs.

#### Scope

1. Add Catat Panen flow.
2. Add Catat Perawatan Manual flow.
3. Add optional photos for both.
4. Add both to tree history.
5. Add service functions.
6. Add minimal black-box test notes or test cases if project has docs/tests.

#### Harvest fields

```txt
Tree
Fruit count
Fruit condition
Harvest date/time
Note
Optional photo
```

#### Manual care fields

```txt
Category
Target
Performed date/time
Note
Optional photo
```

If opened from tree detail, target tree should be prefilled.

#### Boundary

Never implement harvest prediction.

---

### Batch 6 — Schedule Edit, Cancel, and Owner Realization Summary

#### Goal

Make owner schedule management complete but safe.

#### Scope

1. Add edit schedule flow for unlocked schedules.
2. Add cancel schedule flow for unlocked schedules.
3. Lock schedule after realization exists.
4. Show locked message on schedule detail.
5. Show inline task realization summary on schedule detail.
6. Keep task detail available for full detail.

#### Rules

1. No hard delete.
2. No edit after realization.
3. Confirm before cancel.
4. Cancelled schedules should not appear as active tasks unless current logic already handles status filtering.

#### Testing

1. Owner edits new schedule before realization.
2. Owner cancels new schedule before realization.
3. Worker completes task from a schedule.
4. Owner can no longer edit/cancel that schedule.
5. Owner sees realization summary without opening task detail.

---

### Batch 7 — Operational Report Edit, Reopen, and Confirmation Guards

#### Goal

Fix report dead-end flows and reduce accidental wrong status changes.

#### Scope

1. Worker can edit own report while status is `new`.
2. Worker cannot edit after report is `in_progress`, `resolved`, or `rejected`.
3. Owner can reopen rejected report.
4. Owner status changes use confirm dialog.
5. Owner can still create task from report.
6. Report detail task cards are simplified, with full task detail still accessible.

#### Rules

1. Owner cannot rewrite original worker report content.
2. Avoid duplicate reports just because of wrong rejection.
3. No broad visual redesign.

#### Testing

1. Worker creates report.
2. Worker edits report before owner response.
3. Owner marks report rejected.
4. Worker cannot edit rejected report.
5. Owner reopens report.
6. Owner creates follow-up task.

---

### Batch 8 — Farm, Account, and Worker Membership Flow Completion

#### Goal

Fix farm/account operational gaps.

#### Scope

1. Owner can edit farm data.
2. Owner can copy join code.
3. Worker can leave farm with confirmation.
4. Farm page removes duplicate navigation/actions where safe.
5. Profile account remains separate from farm concept.
6. Owner must not delete farm or leave farm.

#### Rules

1. Do not destroy old worker history.
2. Worker leaving farm must remove operational access.
3. After leave, worker should go to onboarding/no-farm flow.
4. Logout should remain easy to find for both owner and worker.

#### Testing

1. Owner edits farm name/location/area.
2. Owner copies join code.
3. Worker leaves farm.
4. Worker no longer accesses old farm data.
5. Worker can access onboarding again.
6. Old task/report history remains visible to owner.

---

### Batch 9 — SOP Usefulness and List Filter Logic

#### Goal

Make SOP feature understandable and useful without building recurring automation.

#### Scope

1. SOP list/detail shows interval meaning clearly.
2. SOP detail shows last realization and next suggested schedule if calculable.
3. SOP list supports basic filters: category, target, active/inactive.
4. Inactive SOP cannot be used to create new schedule unless reactivated.
5. Create schedule from SOP remains owner-confirmed.

#### Rules

1. No automatic recurring task generation.
2. No push notification.
3. Do not remove SOP.

#### Testing

1. Owner creates active SOP.
2. Owner creates schedule from SOP.
3. Worker realizes task.
4. SOP detail shows last realization and next reference if implemented.
5. Owner deactivates SOP.
6. Inactive SOP is not offered for new schedule unless reactivated.

---

### Batch 10 — Regression Hardening and Documentation Update

#### Goal

Stabilize everything before final UI redesign.

#### Scope

1. Run available typecheck/lint/test scripts.
2. Fix regressions.
3. Verify owner core flow.
4. Verify worker core flow.
5. Update relevant docs if the project keeps docs in repo.
6. Produce final feature-completion report.

#### Required manual flow test

Owner:

```txt
Login
Open dashboard
Open tree list
Create tree
Attach tree photo
Create condition report with photo
Create phase record with photo
Create harvest record
Create manual care record
Create SOP
Create schedule requiring photo
Open schedule detail
View worker realization summary
Open operational report
Create task from report
Edit farm
Copy join code
Logout
```

Worker:

```txt
Login
Open task list
Open required-photo task
Try complete without photo and fail
Complete with photo
Edit realization
Open tree detail
Create condition report with photo
Create phase record with photo
Create manual care record
Create operational report with photo
Edit report while new
Leave farm
Confirm access removed
Logout
```

---

## 13. Batch Prompt Template for Codex

Use this template for each Codex batch.

```txt
We are continuing Avology V2 feature-completion phase.

Read and follow:
- docs/product-alignment/02-post-user-review-feature-completion-plan.md
- docs/product-alignment/01-product-alignment-decision-log.md
- docs/source-of-truth/decision-log.md or decision-log.md
- docs/source-of-truth/04-mvp_scope.md
- docs/source-of-truth/12-service-layer-design.md
- docs/source-of-truth/13-screen-navigation-flow.md

Current batch: [BATCH NUMBER AND NAME]

Goal:
[PASTE BATCH GOAL]

Scope:
[PASTE BATCH SCOPE]

Hard rules:
- Implement only this batch.
- Do not do broad visual redesign.
- Do not remove working features.
- Do not expose UUIDs to users.
- Do not implement harvest prediction, ML, push notification, chat, accounting, or automatic recurring task generation.
- Preserve owner/worker role guards.
- Preserve historical data.
- Use existing project conventions and existing service structure.
- Inspect current implementation before editing.

After implementation, report:
1. Files changed.
2. Database/migration changes.
3. Services added/updated.
4. Screens updated.
5. Manual test checklist.
6. Known risks or unfinished items.
```

---

## 14. Recommended Prompting Sequence

Use this exact order in the ChatGPT conversation when asking for Codex prompts:

```txt
Batch 0 - Audit Current Implementation
Batch 1 - Database and Type Foundation
Batch 2 - Media Service and Reusable Attachment UI
Batch 3 - Tree, Condition, and Growth Phase Photos
Batch 4 - Task Proof Photo and Required Proof Flow
Batch 5 - Harvest Record and Manual Care Record
Batch 6 - Schedule Edit, Cancel, and Owner Realization Summary
Batch 7 - Operational Report Edit, Reopen, and Confirmation Guards
Batch 8 - Farm, Account, and Worker Membership Flow Completion
Batch 9 - SOP Usefulness and List Filter Logic
Batch 10 - Regression Hardening and Documentation Update
```

Do not combine batches unless the previous batch passed manual testing.

---

## 15. Stop Conditions

Stop and do not continue to the next batch if any of these happen:

1. App cannot start.
2. Login owner fails.
3. Login worker fails.
4. Existing tree list breaks.
5. Existing task list breaks.
6. Existing operational report flow breaks.
7. RLS blocks valid owner/worker operations.
8. A migration fails and leaves database in unclear state.
9. Codex changes unrelated visual design broadly.
10. Codex removes existing working screens or actions.

When a stop condition happens, the next prompt must be a bug-fix prompt, not a new feature prompt.

---

## 16. Final Acceptance Criteria for Feature-Completion Phase

This phase is complete only when:

1. Photo attachments work for tree, condition, phase, operational report, task proof, harvest, and manual care.
2. Required proof photo blocks task completion when missing.
3. Harvest record exists and appears in tree history.
4. Manual care record exists and appears in tree history.
5. Owner can edit/cancel schedule before realization.
6. Schedule locks after realization.
7. Owner sees task realization summary from schedule detail.
8. Worker can edit latest realization safely.
9. Worker can edit operational report only before owner response.
10. Owner can reopen rejected operational report.
11. Owner can edit farm data.
12. Owner can copy join code.
13. Worker can leave farm without deleting history.
14. SOP has clearer operational value through interval/reference/filter support.
15. Existing owner and worker role guards still work.
16. No prediction/ML/push/chat/accounting features were added.
17. App is ready for final UI/UX redesign phase.

---

## 17. Notes for Final UI/UX Phase After This

After this feature-completion phase passes regression, create a separate design document for:

1. Dashboard redesign.
2. Auth simplification.
3. Tree grid/card final visual system.
4. Filter component visual standard.
5. Detail tree hero/timeline system.
6. Schedule/task/report card design.
7. Farm/profile navigation cleanup.
8. Button and confirm-dialog visual consistency.
9. Typography and palette correction.

Do not mix that phase into feature completion.
