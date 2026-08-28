import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const stages = [
  '00-check-env-and-connection.mjs',
  '01-auth-profile-membership.test.mjs',
  '02-worker-management-rls.test.mjs',
  '03-tree-condition-phase-history.test.mjs',
  '04-sop-schedule-task-activity.test.mjs',
  '06-dashboard-query.test.mjs',
  '07-feature-foundation.test.mjs',
  '08-tree-record-edit-delete-foundation.test.mjs',
  '09-farm-relation-lifecycle.test.mjs',
  '10-grace-period-missed-sweep.test.mjs',
  '11-dated-postponement.test.mjs',
  '12-care-activity-tree-links.test.mjs',
  '13-task-release-on-membership-exit.test.mjs',
  '14-schedule-lock-on-completed-only.test.mjs',
  '15-tree-planting-cycle.test.mjs',
  '16-multi-tree-schedule.test.mjs',
  '17-photo-attachment-policies.test.mjs',
  '18-bulk-tree-creation.test.mjs',
];

const summary = {
  pass: 0,
  fail: 0,
  failedStage: null,
};

function runNode(fileName) {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [resolve(__dirname, fileName)], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
    });

    child.on('close', (code) => resolvePromise(code ?? 1));
  });
}

for (const stage of stages) {
  const code = await runNode(stage);

  if (code === 0) {
    summary.pass += 1;
    continue;
  }

  summary.fail += 1;
  summary.failedStage = stage;
  break;
}

console.log('\nDatabase test summary');
console.log('---------------------');
console.log(`✅ Stage pass: ${summary.pass}`);
console.log(`❌ Stage fail: ${summary.fail}`);

if (summary.failedStage) {
  console.log(`❌ Failed stage: ${summary.failedStage}`);
  console.log('\nRun one stage:');
  console.log(`node scripts/db-tests/${summary.failedStage}`);
  console.log('\nRun all stages:');
  console.log('npm run test:db:all');
  process.exitCode = 1;
} else {
  console.log('✅ All database test stages passed');
  console.log('\nRun one stage:');
  console.log('node scripts/db-tests/00-check-env-and-connection.mjs');
  console.log('\nRun all stages:');
  console.log('npm run test:db:all');
}
