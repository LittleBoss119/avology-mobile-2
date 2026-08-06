import { assertEnv } from './config.mjs';
import {
  assertCondition,
  assertEqual,
  createUserWithProfile,
  expectFailure,
  expectSuccess,
  expectZeroRows,
  firstRpcRow,
  makeRunId,
  runStage,
  uniqueEmail,
} from './test-utils.mjs';

// Menguji tiga RPC yang belum pernah dieksekusi sekali pun sejak ditulis:
//   - cancel_join_request        (migration 036)
//   - acknowledge_access_notice  (migration 037)
//   - preview_farm_by_join_code  (migration 037)
//
// Stage ini SENGAJA berdiri sendiri: tidak memanggil requireState, tidak
// memanggil mergeState, dan tidak menyentuh satu pun akun/kebun yang sudah ada.
// Semua pelaku dibuat di dalam tes supaya urutan menjalankannya bebas dan
// state bersama milik stage 01-08 tidak ikut berubah.
//
// Butuh DUA kebun karena tiga hal hanya bisa dibuktikan lintas kebun: baris
// stale di dua kebun berbeda, guard "sudah punya relasi di kebun lain", dan
// baris stale yang menyergap setelah pembatalan.

const STAGE = '09 farm relation lifecycle';

await runStage(STAGE, async () => {
  assertEnv();

  const runId = makeRunId();

  // ---------- Persiapan: dua pemilik, dua kebun ----------

  const ownerA = await signUp(runId, 'avology-relasi-owner-a', `Owner A ${runId}`, '081000000001');
  const ownerB = await signUp(runId, 'avology-relasi-owner-b', `Owner B ${runId}`, '081000000002');

  const farmA = await createFarm(ownerA, `Kebun Relasi A ${runId}`, 'Lokasi Uji A', 1500);
  const farmB = await createFarm(ownerB, `Kebun Relasi B ${runId}`, 'Lokasi Uji B', 2500);

  // ---------- 1. cancel_join_request ----------

  const cancelWorker = await signUp(
    runId,
    'avology-relasi-cancel',
    `Cancel Worker ${runId}`,
    '082000000001'
  );
  await requestJoin(cancelWorker, farmA.join_code, 'cancel worker requests join to farm A');

  const cancelEventsBefore = await readOwnEvents(
    cancelWorker,
    'cancel worker reads own access events before cancelling'
  );
  assertEqual(
    STAGE,
    'request_join_farm wrote exactly one requested event',
    summarizeEvents(cancelEventsBefore),
    'requested',
    'request_join_farm (migration 036) should append one requested event.'
  );

  await expectSuccess(
    STAGE,
    'worker calls cancel_join_request',
    cancelWorker.client.rpc('cancel_join_request'),
    'Check cancel_join_request() exists, is granted to authenticated, and finds the pending row.'
  );

  await expectZeroRows(
    STAGE,
    'cancel_join_request deleted the farm_members row',
    cancelWorker.client.from('farm_members').select('id').eq('user_id', cancelWorker.userId),
    'cancel_join_request should DELETE the pending row, not just flag it.'
  );

  const cancelEventsAfter = await readOwnEvents(
    cancelWorker,
    'cancel worker still reads own access events after the row is deleted'
  );
  assertEqual(
    STAGE,
    'cancelled event appended and requested event survived',
    summarizeEvents(cancelEventsAfter),
    'cancelled,requested',
    'cancel_join_request should append cancelled and leave the older requested event untouched.'
  );
  assertCondition(
    STAGE,
    'cancelled event kept the farm it was aimed at',
    cancelEventsAfter.every((row) => row.farm_id === farmA.id),
    'Cancelled event lost its farm_id.',
    'Event must be written BEFORE the farm_members row is deleted — that row is the only source of farm_id.'
  );
  assertCondition(
    STAGE,
    'cancelled event records the user as its own actor',
    cancelEventsAfter.some((row) => row.event === 'cancelled' && row.actor_id === cancelWorker.userId),
    'Cancelled event actor_id did not match the user who cancelled.',
    'cancel_join_request should set actor_id to auth.uid().'
  );

  const cancelSecondAttempt = await expectFailure(
    STAGE,
    'second cancel_join_request is rejected',
    cancelWorker.client.rpc('cancel_join_request'),
    'cancel_join_request should raise when the caller has no pending row.'
  );
  assertErrorMessage(
    'second cancel reports no pending request',
    cancelSecondAttempt,
    'Pending join request not found',
    'Exception text is mapped in src/utils/serviceResult.ts and must not drift.'
  );

  // ---------- 2. acknowledge_access_notice ----------
  // Data nyata tidak punya user dengan dua baris stale sekaligus, jadi kondisinya
  // dibangun di sini: ditolak di kebun A, lalu diterima dan dinonaktifkan di
  // kebun B. Partial unique index hanya melarang dua baris pending/active, jadi
  // dua baris stale memang sah.

  const staleWorker = await signUp(
    runId,
    'avology-relasi-stale',
    `Stale Worker ${runId}`,
    '082000000002'
  );

  const staleAtA = await requestJoin(staleWorker, farmA.join_code, 'stale worker requests join to farm A');
  await expectSuccess(
    STAGE,
    'owner A rejects stale worker',
    ownerA.client.rpc('reject_worker', { p_farm_member_id: staleAtA }),
    'Check reject_worker(p_farm_member_id uuid) and active owner validation.'
  );

  const staleAtB = await requestJoin(
    staleWorker,
    farmB.join_code,
    'rejected worker may still request join to a different farm'
  );
  await expectSuccess(
    STAGE,
    'owner B approves stale worker',
    ownerB.client.rpc('approve_worker', { p_farm_member_id: staleAtB }),
    'Check approve_worker(p_farm_member_id uuid) and active owner validation.'
  );
  await expectSuccess(
    STAGE,
    'owner B removes stale worker',
    ownerB.client.rpc('remove_worker', { p_farm_member_id: staleAtB }),
    'Check remove_worker(p_farm_member_id uuid) and active owner validation.'
  );

  const staleRows = await expectSuccess(
    STAGE,
    'stale worker holds two stale rows in two farms',
    staleWorker.client.from('farm_members').select('id, farm_id, status').eq('user_id', staleWorker.userId),
    'A user may hold several rejected/removed rows; only pending/active is limited to one.'
  );
  assertEqual(
    STAGE,
    'stale worker has exactly two farm_members rows',
    staleRows.length,
    2,
    'Setup for the acknowledge test requires two stale rows.'
  );
  assertEqual(
    STAGE,
    'stale rows are rejected in farm A and removed in farm B',
    staleRows
      .map((row) => `${row.status}@${row.farm_id === farmA.id ? 'A' : row.farm_id === farmB.id ? 'B' : '?'}`)
      .sort()
      .join(','),
    'rejected@A,removed@B',
    'reject_worker and remove_worker should leave the rows in place with these statuses.'
  );

  const staleEventsBefore = await readOwnEvents(
    staleWorker,
    'stale worker reads own access events before acknowledging'
  );
  assertEqual(
    STAGE,
    'stale worker accumulated five access events',
    summarizeEvents(staleEventsBefore),
    'approved,rejected,removed,requested,requested',
    'Expected requested+rejected in farm A and requested+approved+removed in farm B.'
  );

  await expectSuccess(
    STAGE,
    'worker calls acknowledge_access_notice',
    staleWorker.client.rpc('acknowledge_access_notice'),
    'Check acknowledge_access_notice() exists and is granted to authenticated.'
  );

  await expectZeroRows(
    STAGE,
    'acknowledge_access_notice cleared BOTH stale rows in one call',
    staleWorker.client.from('farm_members').select('id').eq('user_id', staleWorker.userId),
    'acknowledge_access_notice should delete every rejected/removed row of the caller, not just one.'
  );

  const staleEventsAfter = await readOwnEvents(
    staleWorker,
    'stale worker reads own access events after acknowledging'
  );
  assertEqual(
    STAGE,
    'acknowledge_access_notice wrote no event at all',
    summarizeEvents(staleEventsAfter),
    summarizeEvents(staleEventsBefore),
    'Acknowledging is a display-state change, not an access event — it must not append to farm_access_events.'
  );

  const acknowledgeSecondAttempt = await expectFailure(
    STAGE,
    'second acknowledge_access_notice is rejected',
    staleWorker.client.rpc('acknowledge_access_notice'),
    'acknowledge_access_notice should raise when the caller has no stale row.'
  );
  assertErrorMessage(
    'second acknowledge reports no access notice',
    acknowledgeSecondAttempt,
    'Access notice not found',
    'Exception text is mapped in src/utils/serviceResult.ts and must not drift.'
  );

  // ---------- 3. preview_farm_by_join_code ----------

  const previewWorker = await signUp(
    runId,
    'avology-relasi-preview',
    `Preview Worker ${runId}`,
    '082000000003'
  );

  const previewRows = await expectSuccess(
    STAGE,
    'unattached user previews a farm by join code',
    previewWorker.client.rpc('preview_farm_by_join_code', { p_join_code: farmA.join_code }),
    'Check preview_farm_by_join_code(p_join_code text) and its guards.'
  );
  const preview = firstRpcRow(previewRows);
  assertCondition(
    STAGE,
    'preview returns exactly three columns and nothing else',
    Boolean(preview) && Object.keys(preview).sort().join(',') === 'farm_location,farm_name,owner_name',
    `Preview returned columns: ${preview ? Object.keys(preview).sort().join(',') : 'no row'}`,
    'preview_farm_by_join_code is SECURITY DEFINER and bypasses RLS — extra columns are a leak. It must never return farms.id, join_code, created_by, area_size, member counts, or phone numbers.'
  );
  assertEqual(
    STAGE,
    'preview returns the right farm name',
    preview.farm_name,
    farmA.name,
    'preview_farm_by_join_code should resolve the farm by normalised join code.'
  );
  assertEqual(
    STAGE,
    'preview returns the farm location',
    preview.farm_location,
    'Lokasi Uji A',
    'preview_farm_by_join_code should return farms.location.'
  );
  assertEqual(
    STAGE,
    'preview returns the active owner name',
    preview.owner_name,
    `Owner A ${runId}`,
    'owner_name should come from profiles.full_name of the role=owner status=active member.'
  );

  const lowercaseRows = await expectSuccess(
    STAGE,
    'preview normalises a lowercase join code',
    previewWorker.client.rpc('preview_farm_by_join_code', {
      p_join_code: ` ${farmA.join_code.toLowerCase()} `,
    }),
    'preview_farm_by_join_code must apply upper(trim(...)) exactly like request_join_farm.'
  );
  assertEqual(
    STAGE,
    'lowercase join code resolves to the same farm',
    firstRpcRow(lowercaseRows)?.farm_name,
    farmA.name,
    'Normalisation drift between preview and request would let step 2 fail after step 1 succeeded.'
  );

  const invalidCodeError = await expectFailure(
    STAGE,
    'preview rejects an unknown join code',
    previewWorker.client.rpc('preview_farm_by_join_code', { p_join_code: 'ZZZZZZZZ' }),
    'preview_farm_by_join_code should raise for a code that matches no farm.'
  );
  assertErrorMessage(
    'unknown join code reports Join code is invalid',
    invalidCodeError,
    'Join code is invalid',
    'Guard text must stay identical to request_join_farm so both steps map to the same user-facing message.'
  );

  const ownFarmError = await expectFailure(
    STAGE,
    'preview rejects the caller own farm code',
    ownerA.client.rpc('preview_farm_by_join_code', { p_join_code: farmA.join_code }),
    'preview_farm_by_join_code should raise when the caller owns that farm.'
  );
  assertErrorMessage(
    'own farm code reports Cannot join a farm you own',
    ownFarmError,
    'Cannot join a farm you own',
    'The owner branch must be checked BEFORE the global relation guard, otherwise the owner gets the wrong message.'
  );

  const boundWorker = await signUp(
    runId,
    'avology-relasi-bound',
    `Bound Worker ${runId}`,
    '082000000004'
  );
  const boundMembership = await requestJoin(
    boundWorker,
    farmB.join_code,
    'bound worker requests join to farm B'
  );
  await expectSuccess(
    STAGE,
    'owner B approves bound worker',
    ownerB.client.rpc('approve_worker', { p_farm_member_id: boundMembership }),
    'Check approve_worker(p_farm_member_id uuid) and active owner validation.'
  );

  const boundError = await expectFailure(
    STAGE,
    'preview rejects a user already attached to another farm',
    boundWorker.client.rpc('preview_farm_by_join_code', { p_join_code: farmA.join_code }),
    'preview_farm_by_join_code should apply the same GLOBAL relation guard as request_join_farm.'
  );
  assertErrorMessage(
    'attached user reports the global relation guard',
    boundError,
    'User already has a pending or active membership',
    'Guard must look across all farms, not only the target farm.'
  );

  const boundRequestError = await expectFailure(
    STAGE,
    'request_join_farm rejects the same user for the same reason',
    boundWorker.client.rpc('request_join_farm', { p_join_code: farmA.join_code }),
    'request_join_farm carries the same global guard since migration 036.'
  );
  assertErrorMessage(
    'preview and request agree on the guard text',
    boundRequestError,
    'User already has a pending or active membership',
    'If preview and request disagree, step 2 can fail after step 1 succeeded — the most confusing failure shape for this audience.'
  );

  // ---------- 4. Regresi: baris stale setelah pembatalan ----------
  // Skenario yang diantisipasi audit: user punya baris rejected menganggur di
  // kebun A dan pengajuan pending di kebun B. Sebelum migration 038, pembatalan
  // hanya menghapus baris pending, sehingga baris rejected lama naik jadi
  // satu-satunya baris dan get_current_user_access mengembalikannya — user
  // terlempar ke layar penolakan untuk kebun yang sudah lama tidak ada
  // urusannya.
  //
  // Sejak migration 038 pembatalan menyapu keduanya dalam satu transaksi, jadi
  // yang diuji di sini adalah: setelah membatalkan, user benar-benar bersih
  // tanpa perlu panggilan kedua dari klien.

  const regressionWorker = await signUp(
    runId,
    'avology-relasi-regresi',
    `Regression Worker ${runId}`,
    '082000000005'
  );

  const regressionAtA = await requestJoin(
    regressionWorker,
    farmA.join_code,
    'regression worker requests join to farm A'
  );
  await expectSuccess(
    STAGE,
    'owner A rejects regression worker',
    ownerA.client.rpc('reject_worker', { p_farm_member_id: regressionAtA }),
    'Check reject_worker(p_farm_member_id uuid).'
  );
  await requestJoin(
    regressionWorker,
    farmB.join_code,
    'regression worker requests join to farm B while holding a stale row in farm A'
  );

  const accessWithPending = firstRpcRow(
    await expectSuccess(
      STAGE,
      'get_current_user_access while a pending request exists',
      regressionWorker.client.rpc('get_current_user_access'),
      'Check get_current_user_access() ordering: active, then pending, then the rest.'
    )
  );
  assertEqual(
    STAGE,
    'pending request outranks the stale rejected row',
    `${accessWithPending?.status}@${accessWithPending?.farm_id === farmB.id ? 'B' : 'other'}`,
    'pending@B',
    'get_current_user_access must not surface a stale row while a live pending row exists.'
  );

  await expectSuccess(
    STAGE,
    'regression worker cancels the pending request',
    regressionWorker.client.rpc('cancel_join_request'),
    'Check cancel_join_request().'
  );

  // Sejak migration 038 pembatalan menyapu baris stale sekalian, dalam transaksi
  // yang sama. Menyusulkan panggilan kedua dari klien tidak atomik, dan pengguna
  // aplikasi ini sering berada di koneksi buruk.
  await expectZeroRows(
    STAGE,
    'cancelling swept the stale row in farm A along with the pending row',
    regressionWorker.client.from('farm_members').select('id').eq('user_id', regressionWorker.userId),
    'cancel_join_request (migration 038) should delete the pending row AND every rejected/removed row of the caller in one transaction.'
  );

  const accessAfterCancel = await expectSuccess(
    STAGE,
    'get_current_user_access right after cancelling',
    regressionWorker.client.rpc('get_current_user_access'),
    'Check get_current_user_access() after cancel_join_request cleared every row.'
  );
  assertEqual(
    STAGE,
    'cancelling alone leaves the user with no relation at all — no acknowledge needed',
    Array.isArray(accessAfterCancel) ? accessAfterCancel.length : -1,
    0,
    'A stale row surfacing here would send the user to a rejection screen for a farm they no longer have anything to do with.'
  );

  const acknowledgeAfterCancel = await expectFailure(
    STAGE,
    'acknowledge_access_notice after cancelling is rejected',
    regressionWorker.client.rpc('acknowledge_access_notice'),
    'acknowledge_access_notice should raise once cancel_join_request already swept every stale row.'
  );
  assertErrorMessage(
    'nothing left for acknowledge to clear',
    acknowledgeAfterCancel,
    'Access notice not found',
    'Exception text is mapped in src/utils/serviceResult.ts and must not drift.'
  );

  const regressionEvents = await readOwnEvents(
    regressionWorker,
    'regression worker access history survived every deletion'
  );
  assertEqual(
    STAGE,
    'full history is preserved even though no farm_members row remains',
    summarizeEvents(regressionEvents),
    'cancelled,rejected,requested,requested',
    'farm_access_events is append-only — deleting membership rows must never cost history (temuan R-02).'
  );

  console.log(`\nℹ️  run ${runId} left 7 test accounts and 2 farms behind (same as the other stages).`);
});

// ---------- Helper lokal ----------

async function signUp(runId, label, fullName, phone) {
  const email = uniqueEmail(label, runId);
  const { client, user } = await createUserWithProfile({ email, fullName, phone });

  return { client, email, fullName, phone, userId: user.id };
}

async function createFarm(owner, name, location, areaSize) {
  const farmId = await expectSuccess(
    STAGE,
    `owner creates farm ${name}`,
    owner.client.rpc('create_farm_with_owner', {
      p_name: name,
      p_location: location,
      p_area_size: areaSize,
    }),
    'Check create_farm_with_owner(p_name, p_location, p_area_size).'
  );

  const farm = await expectSuccess(
    STAGE,
    `owner reads join code of ${name}`,
    owner.client.from('farms').select('id, name, location, join_code').eq('id', farmId).single(),
    'Active owner should be able to read their own farm.'
  );

  return farm;
}

async function requestJoin(worker, joinCode, operation) {
  const membershipId = await expectSuccess(
    STAGE,
    operation,
    worker.client.rpc('request_join_farm', { p_join_code: joinCode }),
    'Check request_join_farm(p_join_code text) and its guards.'
  );

  return firstRpcRow(membershipId);
}

async function readOwnEvents(actor, operation) {
  return expectSuccess(
    STAGE,
    operation,
    actor.client
      .from('farm_access_events')
      .select('id, farm_id, event, actor_id, created_at')
      .eq('user_id', actor.userId)
      .order('created_at', { ascending: true }),
    'farm_access_events SELECT policy should let a user read events about themselves, including after their membership row is gone.'
  );
}

// Urutan event dengan created_at identik tidak dijamin, jadi perbandingannya
// memakai daftar terurut abjad, bukan urutan baris apa adanya.
function summarizeEvents(rows) {
  return rows
    .map((row) => row.event)
    .sort()
    .join(',');
}

function assertErrorMessage(operation, error, expected, cause) {
  assertCondition(
    STAGE,
    operation,
    (error?.message ?? '').includes(expected),
    `Expected an error containing "${expected}", got "${error?.message ?? ''}"`,
    cause
  );
}
