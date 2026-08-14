import { assertEnv } from './config.mjs';
import {
  assertCondition,
  assertEqual,
  createSignedInClient,
  expectDeniedOrNoRows,
  expectFailure,
  expectSuccess,
  getSingle,
  mergeState,
  requireState,
  runStage,
  todayIso,
} from './test-utils.mjs';

const STAGE = '05 operational report rpc';

await runStage(STAGE, async () => {
  assertEnv();
  const state = requireState(STAGE, [
    'runId',
    'ownerEmail',
    'workerEmail',
    'farmId',
    'workerId',
  ]);

  const { client: ownerClient } = await createSignedInClient(state.ownerEmail, state.password);
  const { client: workerClient } = await createSignedInClient(state.workerEmail, state.password);

  const report = await getSingle(
    STAGE,
    'worker creates operational_report',
    workerClient
      .from('operational_reports')
      .insert({
        farm_id: state.farmId,
        reported_by: state.workerId,
        category: 'broken_tool',
        location_note: 'Database test shed',
        description: 'Database test operational report',
      })
      .select('id, farm_id, reported_by, category, location_note, description, status, created_at, updated_at')
      .single(),
    'Active workers should be allowed to insert operational_reports for their farm.'
  );
  assertEqual(STAGE, 'operational_report default status is new', report.status, 'new',
    'operational_report_status default should be new.');

  const ownerReport = await getSingle(
    STAGE,
    'owner can see farm operational_report',
    ownerClient
      .from('operational_reports')
      .select('id, farm_id, reported_by, category, location_note, description, status, created_at, updated_at')
      .eq('id', report.id)
      .single(),
    'Owner active should be able to select operational reports in their farm.'
  );

  await expectSuccess(
    STAGE,
    'owner updates operational_report status through RPC',
    ownerClient.rpc('update_operational_report_status', {
      p_operational_report_id: report.id,
      p_owner_response_note: null,
      p_status: 'resolved',
    }),
    'Check update_operational_report_status(p_operational_report_id uuid, p_status operational_report_status, p_owner_response_note text).'
  );

  const updatedReport = await getSingle(
    STAGE,
    'RPC updates only status and updated_at',
    ownerClient
      .from('operational_reports')
      .select('id, farm_id, reported_by, category, location_note, description, status, created_at, updated_at')
      .eq('id', report.id)
      .single(),
    'RPC should update status and updated_at without changing immutable report fields.'
  );
  assertEqual(STAGE, 'report status changed by RPC', updatedReport.status, 'resolved',
    'update_operational_report_status should set status.');
  assertCondition(STAGE, 'report updated_at changed by RPC', Boolean(updatedReport.updated_at),
    'updated_at was not set by RPC/trigger.',
    'Check set_updated_at trigger and RPC update statement.');

  for (const column of ['farm_id', 'reported_by', 'category', 'location_note', 'description', 'created_at']) {
    assertEqual(
      STAGE,
      `RPC did not mutate ${column}`,
      updatedReport[column],
      ownerReport[column],
      'update_operational_report_status must not change immutable operational report columns.'
    );
  }

  await expectFailure(
    STAGE,
    'owner direct update to operational_reports is rejected',
    ownerClient
      .from('operational_reports')
      .update({ description: 'Owner should not update directly' })
      .eq('id', report.id),
    'authenticated should not have direct UPDATE privilege on operational_reports.'
  );

  await expectFailure(
    STAGE,
    'worker direct status update is rejected',
    workerClient
      .from('operational_reports')
      .update({ status: 'in_progress' })
      .eq('id', report.id),
    'Workers should not update operational report status after creation.'
  );

  await expectDeniedOrNoRows(
    STAGE,
    'worker cannot update report status through owner RPC',
    workerClient.rpc('update_operational_report_status', {
      p_operational_report_id: report.id,
      p_owner_response_note: null,
      p_status: 'in_progress',
    }),
    'update_operational_report_status should validate auth.uid() is active owner for the report farm.'
  );

  const followUpTaskId = await expectSuccess(
    STAGE,
    'owner creates follow-up task from report',
    ownerClient.rpc('create_task_from_operational_report', {
      p_operational_report_id: report.id,
      p_assigned_worker_id: state.workerId,
      p_due_date: todayIso(),
      p_title: `Follow up report ${state.runId}`,
      p_instruction: 'Resolve report follow-up',
      p_target_type: 'farm',
      // Wajib sejak migrasi 047: p_category kehilangan `default null` seiring
      // care_tasks.category menjadi NOT NULL. Tanpa argumen ini PostgREST tidak
      // menemukan signature yang cocok dan gagal dengan PGRST202.
      p_category: 'other',
      p_target_tree_id: null,
      p_custom_target_note: null,
    }),
    'Check create_task_from_operational_report RPC and active worker assignment.'
  );

  const workerFollowUp = await expectSuccess(
    STAGE,
    'task from report appears for assigned worker',
    workerClient.from('care_tasks').select('id, operational_report_id, assigned_to').eq('id', followUpTaskId),
    'Assigned worker should be able to view task created from operational report.'
  );
  assertCondition(
    STAGE,
    'worker sees report follow-up task',
    workerFollowUp.length === 1
      && workerFollowUp[0].operational_report_id === report.id
      && workerFollowUp[0].assigned_to === state.workerId,
    'Worker did not see follow-up task created from report.',
    'Check care_tasks SELECT policy and create_task_from_operational_report output.'
  );

  mergeState({
    operationalReportId: report.id,
    followUpTaskId,
  });
});
