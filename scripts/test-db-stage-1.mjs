import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

function createAnonClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function logStep(title) {
  console.log('\n==============================');
  console.log(title);
  console.log('==============================');
}

function logResult(label, error, data) {
  if (error) {
    console.log(`❌ ${label}`);
    console.log(error.message);
    if (error.details) console.log('details:', error.details);
    if (error.hint) console.log('hint:', error.hint);
  } else {
    console.log(`✅ ${label}`);
    if (data !== undefined) console.dir(data, { depth: null });
  }
}

async function signUpOrSignIn(email, password, fullName, phone) {
  const client = createAnonClient();

  let { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone,
      },
    },
  });

  if (error && !error.message.toLowerCase().includes('already registered')) {
    console.log(`Sign up error for ${email}:`, error.message);
  }

  const login = await client.auth.signInWithPassword({ email, password });

  if (login.error) {
    throw new Error(`Login failed for ${email}: ${login.error.message}`);
  }

  return client;
}

async function getCurrentUser(client) {
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  return data.user;
}

async function main() {
  const ownerEmail = `owner.avology.test+${Date.now()}@example.com`;
  const workerEmail = `worker.avology.test+${Date.now()}@example.com`;
  const password = 'Test123456!';

  let farmId = null;
  let joinCode = null;
  let workerMembershipId = null;

  logStep('1. Sign up / login owner dan worker');

  const owner = await signUpOrSignIn(ownerEmail, password, 'Owner Test', '081111111111');
  const worker = await signUpOrSignIn(workerEmail, password, 'Worker Test', '082222222222');

  const ownerUser = await getCurrentUser(owner);
  const workerUser = await getCurrentUser(worker);

  console.log('Owner user id:', ownerUser.id);
  console.log('Worker user id:', workerUser.id);

  logStep('2. Cek profiles terbentuk');

  const ownerProfile = await owner.from('profiles').select('*').eq('id', ownerUser.id).single();
  logResult('Owner bisa lihat profile sendiri', ownerProfile.error, ownerProfile.data);

  const workerProfile = await worker.from('profiles').select('*').eq('id', workerUser.id).single();
  logResult('Worker bisa lihat profile sendiri', workerProfile.error, workerProfile.data);

  const workerTryOwnerProfile = await worker.from('profiles').select('*').eq('id', ownerUser.id);
  if (workerTryOwnerProfile.error) {
    console.log('✅ Worker tidak bisa lihat profile owner');
  } else if (workerTryOwnerProfile.data.length === 0) {
    console.log('✅ Worker tidak bisa lihat profile owner, result kosong');
  } else {
    console.log('❌ Worker bisa lihat profile owner, ini kebuka');
    console.dir(workerTryOwnerProfile.data, { depth: null });
  }

  logStep('3. Owner create farm');

  // Sesuaikan nama RPC kalau di migration lu beda.
  let createFarmResult = await owner.rpc('create_farm_with_owner', {
    p_name: 'Kebun Test Avology',
    p_location: 'Tegal',
    p_area_size: 6500,
  });

  if (createFarmResult.error) {
    console.log('RPC create_farm_with_owner gagal. Coba fallback insert langsung ke farms.');
    console.log(createFarmResult.error.message);

    const insertFarm = await owner
      .from('farms')
      .insert({
        name: 'Kebun Test Avology',
        location: 'Tegal',
        area_size: 6500,
      })
      .select('*')
      .single();

    logResult('Owner insert farm langsung', insertFarm.error, insertFarm.data);

    if (insertFarm.error) {
      throw new Error('Tidak bisa create farm. Cek nama RPC atau policy insert farms.');
    }

    farmId = insertFarm.data.id;
    joinCode = insertFarm.data.join_code;
  } else {
    logResult('Owner create farm via RPC', null, createFarmResult.data);

    const result = Array.isArray(createFarmResult.data)
      ? createFarmResult.data[0]
      : createFarmResult.data;

    farmId = result?.farm_id || result?.id || result?.farm?.id;
    joinCode = result?.join_code || result?.farm?.join_code;

    if (!farmId || !joinCode) {
      const farmCheck = await owner.from('farms').select('*').limit(1);
      logResult('Cek farms setelah create RPC', farmCheck.error, farmCheck.data);
      farmId = farmCheck.data?.[0]?.id;
      joinCode = farmCheck.data?.[0]?.join_code;
    }
  }

  console.log('farmId:', farmId);
  console.log('joinCode:', joinCode);

  if (!farmId || !joinCode) {
    throw new Error('farmId atau joinCode tidak ketemu. Sesuaikan parsing result RPC create farm.');
  }

  logStep('4. Worker request join');

  const requestJoin = await worker.rpc('request_join_farm', {
    p_join_code: joinCode,
  });

  logResult('Worker request join farm', requestJoin.error, requestJoin.data);

  logStep('5. Worker pending tidak boleh akses data operasional');

  const pendingTrees = await worker.from('trees').select('*').eq('farm_id', farmId);
  if (pendingTrees.error) {
    console.log('✅ Worker pending tidak bisa akses trees');
    console.log(pendingTrees.error.message);
  } else if (pendingTrees.data.length === 0) {
    console.log('✅ Worker pending tidak melihat trees, result kosong');
  } else {
    console.log('❌ Worker pending bisa akses trees');
    console.dir(pendingTrees.data, { depth: null });
  }

  logStep('6. Owner lihat pending worker');

  const pendingWorkers = await owner.rpc('get_pending_workers', {
    p_farm_id: farmId,
  });

  logResult('Owner get_pending_workers', pendingWorkers.error, pendingWorkers.data);

  if (!pendingWorkers.error) {
    const row = pendingWorkers.data?.[0];
    workerMembershipId = row?.membership_id || row?.id || row?.farm_member_id;
    console.log('workerMembershipId:', workerMembershipId);

    if (!row?.full_name || !row?.phone) {
      console.log('❌ Pending worker tidak menampilkan full_name atau phone');
    } else {
      console.log('✅ Pending worker punya full_name dan phone');
    }
  }

  if (!workerMembershipId) {
    console.log('Membership id tidak ketemu dari RPC. Coba cek farm_members sebagai owner.');

    const fm = await owner
      .from('farm_members')
      .select('*')
      .eq('farm_id', farmId)
      .eq('user_id', workerUser.id)
      .single();

    logResult('Owner cek farm_members worker pending', fm.error, fm.data);
    workerMembershipId = fm.data?.id;
  }

  if (!workerMembershipId) {
    throw new Error('workerMembershipId tidak ditemukan. Cek return RPC get_pending_workers.');
  }

  logStep('7. Owner approve worker');

  const approve = await owner.rpc('approve_worker', {
    p_membership_id: workerMembershipId,
  });

  logResult('Owner approve worker', approve.error, approve.data);

  logStep('8. Worker active akses data yang boleh');

  const workerOwnMembership = await worker
    .from('farm_members')
    .select('*')
    .eq('user_id', workerUser.id);

  logResult('Worker lihat membership dirinya sendiri', workerOwnMembership.error, workerOwnMembership.data);

  const workerAllMembership = await worker
    .from('farm_members')
    .select('*')
    .eq('farm_id', farmId);

  if (workerAllMembership.error) {
    console.log('✅ Worker tidak bisa select semua membership farm');
    console.log(workerAllMembership.error.message);
  } else if (workerAllMembership.data.length <= 1) {
    console.log('✅ Worker tidak melihat membership user lain');
    console.dir(workerAllMembership.data, { depth: null });
  } else {
    console.log('❌ Worker bisa melihat membership user lain');
    console.dir(workerAllMembership.data, { depth: null });
  }

  logStep('9. Owner create tree untuk data operasional minimal');

  const createTree = await owner
    .from('trees')
    .insert({
      farm_id: farmId,
      tree_code: 'T-001',
      row_number: 1,
      column_number: 1,
      variety: 'Miki',
      planted_at: '2024-01-01',
    })
    .select('*')
    .single();

  logResult('Owner create tree', createTree.error, createTree.data);

  const workerTreesActive = await worker
    .from('trees')
    .select('*')
    .eq('farm_id', farmId);

  logResult('Worker active bisa lihat trees', workerTreesActive.error, workerTreesActive.data);

  // Langkah 10-12 lama (buat laporan operasional, ubah statusnya lewat RPC, dan
  // pastikan UPDATE langsung ditolak) dibuang bersama modul laporan
  // (migrasi 053).

  logStep('SELESAI');

  console.log('Manual DB test tahap 1 selesai. Baca hasil ✅/❌ di atas.');
}

main().catch((error) => {
  console.error('\nTEST FAILED');
  console.error(error);
  process.exit(1);
});