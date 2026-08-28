import { supabase } from '../lib/supabase';
import type {
  CreateTreeData,
  CreateTreeInput,
  CreateTreesAtPositionsData,
  CreateTreesAtPositionsInput,
  GetTreeDetailInput,
  GetTreePlantingsInput,
  GetTreesInput,
  GrowthPhase,
  MemberRole,
  MemberStatus,
  ServiceResult,
  SuccessData,
  EndTreePlantingInput,
  StartTreePlantingData,
  StartTreePlantingInput,
  Tree,
  TreeConditionStatus,
  TreePlanting,
  UpdateTreeInput,
  UUID,
} from '../types/domain';
import {
  mapTreePlanting,
  readActivePlanting,
  TREE_PLANTING_COLUMNS,
  TREE_SELECT_WITH_ACTIVE_PLANTING,
  type TreePlantingRow,
} from './treePlantingShared';
import { fail, ok } from '../utils/serviceResult';
const TREE_SELECT = TREE_SELECT_WITH_ACTIVE_PLANTING;

// Bentuk mentah satu baris kembalian create_trees_at_positions (migrasi 062),
// dalam penamaan snake_case apa adanya dari PostgREST. Dipetakan ke
// CreateTreesAtPositionsData di createTreesAtPositions().
type CreateTreesAtPositionsRow = {
  created_tree_ids: string[] | null;
  created_codes: string[] | null;
  rejected_occupied: string[] | null;
  rejected_out_of_grid: string[] | null;
  rejected_malformed: string[] | null;
  duplicate_codes: string[] | null;
  blank_count: number | null;
};

type TreeRow = {
  id: string;
  farm_id: string;
  // Kolom generated (migrasi 054) — hanya dibaca, tidak pernah ditulis.
  tree_code: string;
  // smallint di database; PostgREST mengirimnya sebagai number.
  row_position: number | null;
  column_position: string | null;
  // Sudah tersaring ke siklus aktif oleh filter di query. Paling banyak satu
  // baris — dijamin partial unique index tree_plantings_one_active_per_tree.
  tree_plantings: TreePlantingRow[] | null;
  current_condition: TreeConditionStatus;
  current_growth_phase: GrowthPhase | null;
  is_archived: boolean;
  created_at?: string;
  updated_at?: string | null;
};

type TreeFarmRow = {
  id: string;
  farm_id: string;
};

type MembershipRow = {
  role: MemberRole;
  status: MemberStatus;
};

export async function getTrees(input: GetTreesInput): Promise<ServiceResult<Tree[]>> {
  const accessResult = await ensureActiveFarmMember(input.farmId);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  let query = supabase
    .from('trees')
    .select(TREE_SELECT)
    .eq('farm_id', input.farmId)
    // Menyaring baris EMBEDDED, bukan induknya: pohon yang posisinya sedang
    // kosong tetap terbawa, hanya dengan tree_plantings kosong.
    .is('tree_plantings.ended_at', null);

  const search = normalizeOptionalText(input.search);

  if (search) {
    const sanitizedSearch = sanitizeSearchTerm(search);

    if (sanitizedSearch) {
      const pattern = `%${sanitizedSearch}%`;
      // Tinggal tree_code. Dua cabang lain dibuang karena kolomnya tidak lagi
      // ada di trees:
      //   * row_position -- smallint sejak 054; `ilike` pada angka ditolak
      //     Postgres dan menggagalkan SELURUH query, bukan cuma cabangnya.
      //     column_position ikut dibuang karena mubazir: tree_code adalah kolom
      //     generated '{baris}-{kolom}', jadi ia sudah mencakup keduanya.
      //   * variety -- pindah ke tree_plantings di 055.
      //
      // Varietas TIDAK dicarikan lewat resource embedded. Filter PostgREST pada
      // embedded resource menyaring baris ANAK, bukan induknya, jadi ia tidak
      // bisa dipakai untuk membuang pohon dari hasil; menjangkaunya menuntut
      // `!inner` join yang mengubah bentuk query dan diam-diam membuang pohon
      // berposisi kosong.
      //
      // Tidak mendesak: penyaring `search` ini TIDAK PERNAH dipakai. Ketujuh
      // pemanggil getTrees hanya mengirim farmId dan archived; pencarian yang
      // benar-benar dilihat pengguna dilakukan di sisi klien pada layar daftar
      // pohon, dan di sana varietas tetap ikut tercari.
      query = query.or([`tree_code.ilike.${pattern}`].join(','));
    }
  }

  if (input.condition && input.condition !== 'all') {
    query = query.eq('current_condition', input.condition);
  }

  if (input.growthPhase && input.growthPhase !== 'all') {
    query = query.eq('current_growth_phase', input.growthPhase);
  }

  if (typeof input.archived === 'boolean') {
    query = query.eq('is_archived', input.archived);
  }

  const { data, error } = await query
    .order('tree_code', { ascending: true })
    .order('created_at', { ascending: false })
    .returns<TreeRow[]>();

  if (error) {
    return fail(error, 'Gagal memuat daftar pohon.');
  }

  return ok((data ?? []).map(mapTree));
}

export async function getTreeDetail(
  input: GetTreeDetailInput
): Promise<ServiceResult<Tree>> {
  const { data, error } = await supabase
    .from('trees')
    .select(TREE_SELECT)
    .eq('id', input.treeId)
    .is('tree_plantings.ended_at', null)
    .maybeSingle<TreeRow>();

  if (error) {
    return fail(error, 'Gagal memuat detail pohon.');
  }

  if (!data) {
    return fail(new Error('Data pohon tidak ditemukan atau tidak dapat diakses.'));
  }

  return ok(mapTree(data));
}

// SELURUH siklus tanam sebuah posisi, terurut cycle_no menaik — termasuk yang
// sudah ditutup.
//
// Sengaja TIDAK digabung ke getTreeDetail. Query di sana wajib membawa filter
// `.is('tree_plantings.ended_at', null)`; melonggarkannya akan membuat
// readActivePlanting mengambil baris [0] yang bisa jadi siklus lama, dan itu
// merusak SELURUH pemanggil getTrees/getTreeDetail sekaligus. Siklus lama
// karenanya diambil lewat query terpisah yang hanya dipanggil layar yang
// benar-benar membutuhkannya.
//
// Dua pemakainya: keterangan pada posisi yang sedang kosong (kapan dan kenapa
// pohon sebelumnya berakhir) dan pembatas siklus di riwayat pohon.
//
// Pekerja ikut boleh membacanya — riwayat pohon memang terbuka untuk pekerja
// aktif, dan grant select pada tree_plantings (055:3) memberikannya ke seluruh
// anggota kebun aktif, bukan hanya pemilik.
export async function listTreePlantings(
  input: GetTreePlantingsInput
): Promise<ServiceResult<TreePlanting[]>> {
  const farmIdResult = await getAccessibleTreeFarmId(input.treeId);

  if (farmIdResult.error) {
    return fail(farmIdResult.error);
  }

  const accessResult = await ensureActiveFarmMember(farmIdResult.data);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const { data, error } = await supabase
    .from('tree_plantings')
    .select(TREE_PLANTING_COLUMNS)
    .eq('tree_id', input.treeId)
    .order('cycle_no', { ascending: true })
    .returns<TreePlantingRow[]>();

  if (error) {
    return fail(error, 'Gagal memuat siklus tanam pohon.');
  }

  return ok((data ?? []).map(mapTreePlanting));
}

export async function createTree(
  input: CreateTreeInput
): Promise<ServiceResult<CreateTreeData>> {
  const position = normalizeTreePosition(input.rowPosition, input.columnPosition);

  if (position instanceof Error) {
    return fail(position);
  }

  const accessResult = await ensureActiveOwner(input.farmId);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  // Lewat RPC, bukan INSERT langsung. Membuat pohon berarti membuat DUA baris —
  // posisinya di trees dan siklus tanam pertamanya di tree_plantings — dan
  // pohon tanpa siklus adalah keadaan yang tidak sah. Hanya transaksi di sisi
  // database yang bisa menjaminnya, dan klien Supabase tidak bisa membungkus
  // dua statement dalam satu transaksi.
  //
  // Rentang posisi terhadap ukuran kebun tidak diperiksa di sini maupun di RPC:
  // itu milik validate_tree_position_trigger (migrasi 054).
  const { data, error } = await supabase.rpc('create_tree_with_planting', {
    p_column_position: position.columnPosition,
    p_farm_id: input.farmId,
    p_planted_at: normalizeOptionalText(input.plantedAt),
    p_row_position: position.rowPosition,
    p_variety: normalizeOptionalText(input.variety),
  });

  if (error) {
    return fail(error, 'Gagal menambahkan pohon.');
  }

  if (!data) {
    return fail(new Error('RPC create_tree_with_planting tidak mengembalikan tree id.'));
  }

  return ok({
    treeId: data as UUID,
  });
}

// Membuat BANYAK posisi sekaligus, lewat create_trees_at_positions (migrasi
// 062). Hanya untuk posisi yang BELUM PERNAH ditanami.
//
// KENAPA BUKAN createTree() DIULANG. 196 panggilan berarti 196 transaksi
// terpisah, dan gagal di tengah meninggalkan baris trees yang TIDAK BISA
// dikoreksi: prevent_tree_delete_trigger menolak setiap DELETE ke trees, dan
// mengarsipkan tidak membebaskan kodenya karena trees_unique_code_per_farm
// bukan constraint partial. Satu RPC berarti satu transaksi: semua jadi, atau
// tidak sama sekali.
//
// SATU PANGGILAN, JADI TIDAK ADA YANG PERLU DIANGKAT KELUAR LOOP. ensureActiveOwner
// tetap dipanggil sekali di sini, sama seperti createTree — biayanya satu
// permintaan untuk seluruh himpunan, bukan satu per posisi. Tidak ada yang
// mengejutkan di sini; yang mahal justru versi yang TIDAK dipakai.
//
// RPC-nya MENYARING lalu MELAPORKAN; ia tidak melempar saat sebagian ditolak,
// dan tidak melempar pula saat SELURUHNYA ditolak. Nol dibuat adalah hasil yang
// sah, bukan galat — pemanggil yang memperlakukannya sebagai galat akan
// membuang laporan yang justru satu-satunya hal berguna pada keadaan itu.
export async function createTreesAtPositions(
  input: CreateTreesAtPositionsInput
): Promise<ServiceResult<CreateTreesAtPositionsData>> {
  const positionCodes = normalizePositionCodes(input.positionCodes);

  if (positionCodes.length === 0) {
    return fail(new Error('Belum ada posisi yang dipilih.'));
  }

  const accessResult = await ensureActiveOwner(input.farmId);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const { data, error } = await supabase.rpc('create_trees_at_positions', {
    p_farm_id: input.farmId,
    p_planted_at: normalizeOptionalText(input.plantedAt),
    p_position_codes: positionCodes,
    p_variety: normalizeOptionalText(input.variety),
  });

  if (error) {
    return fail(error, 'Gagal menambahkan pohon.');
  }

  // `returns table (...)` sampai di klien sebagai ARRAY berisi satu baris.
  // Pola yang sama dipakai careScheduleService terhadap create_manual_schedule.
  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    return fail(new Error('RPC create_trees_at_positions tidak mengembalikan hasil.'));
  }

  const summary = row as CreateTreesAtPositionsRow;

  // Ketujuh field dipetakan, nol dibuang. Layar hasil membutuhkan seluruhnya:
  // ketiga ember penolakan punya arti yang berbeda bagi pembacanya, dan
  // menggabungkannya di sini akan membuang perbedaan yang sengaja dijaga
  // migrasi 062.
  //
  // coalesce di sisi database sudah menjamin array-nya tidak pernah NULL, tapi
  // `?? []` tetap dipasang: yang menyeberang ke sini adalah JSON, dan sebuah
  // field yang hilang di masa depan akan menjadi `undefined`, bukan array
  // kosong — dan layar hasil membaca `.length` pada keenamnya.
  return ok({
    blankCount: summary.blank_count ?? 0,
    createdCodes: summary.created_codes ?? [],
    createdTreeIds: (summary.created_tree_ids ?? []) as UUID[],
    duplicateCodes: summary.duplicate_codes ?? [],
    rejectedMalformed: summary.rejected_malformed ?? [],
    rejectedOccupied: summary.rejected_occupied ?? [],
    rejectedOutOfGrid: summary.rejected_out_of_grid ?? [],
  });
}

// Membuang entri kosong dan merapikan spasi SEBELUM dikirim.
//
// Bukan mengambil alih validasi RPC: bentuk kanoniknya tetap diputuskan di sana,
// dan kode yang salah bentuk tetap dikirim supaya ia balik sebagai
// rejected_malformed dan bisa disebutkan ke pengguna. Yang dibuang di sini
// hanya entri yang tidak punya apa pun untuk dilaporkan.
function normalizePositionCodes(codes: readonly string[] | null | undefined): string[] {
  if (!Array.isArray(codes)) {
    return [];
  }

  return codes.map((code) => code?.trim()).filter((code): code is string => Boolean(code));
}

// Menutup siklus tanam yang sedang berjalan di sebuah posisi.
//
// SENGAJA tidak menyentuh kondisi pohon. Mencatat kondisi 'mati' tidak
// memanggil fungsi ini, dan fungsi ini tidak mengubah currentCondition —
// kondisi adalah pengamatan lapangan yang bisa dikoreksi, akhir siklus adalah
// keputusan owner yang tersimpan permanen.
export async function endTreePlanting(
  input: EndTreePlantingInput
): Promise<ServiceResult<SuccessData>> {
  const { error } = await supabase.rpc('end_tree_planting', {
    p_end_reason: input.endReason,
    p_ended_at: normalizeOptionalText(input.endedAt),
    p_tree_id: input.treeId,
  });

  if (error) {
    return fail(error, 'Gagal menutup siklus tanam.');
  }

  return ok({
    success: true,
  });
}

// Menanami ulang posisi yang siklus sebelumnya sudah ditutup. RPC menolak
// kalau masih ada siklus aktif, dan menghitung cycle_no berikutnya sendiri.
export async function startTreePlanting(
  input: StartTreePlantingInput
): Promise<ServiceResult<StartTreePlantingData>> {
  const { data, error } = await supabase.rpc('start_tree_planting', {
    p_planted_at: normalizeOptionalText(input.plantedAt),
    p_tree_id: input.treeId,
    p_variety: normalizeOptionalText(input.variety),
  });

  if (error) {
    return fail(error, 'Gagal memulai siklus tanam baru.');
  }

  if (!data) {
    return fail(new Error('RPC start_tree_planting tidak mengembalikan planting id.'));
  }

  return ok({
    plantingId: data as UUID,
  });
}

// MENGOREKSI data pohon: posisinya di trees, dan varietas serta tanggal tanam
// pada siklus tanam yang SEDANG AKTIF.
//
// Koreksi, bukan penanaman ulang. cycle_no tidak naik dan tidak ada siklus baru
// yang lahir — kalau pohonnya sungguh diganti, itu endTreePlanting lalu
// startTreePlanting, bukan fungsi ini.
//
// Lewat RPC, bukan UPDATE langsung. Satu edit menyentuh DUA tabel; kalau
// dikirim sebagai dua panggilan terpisah, edit yang mengubah posisi sekaligus
// varietas bisa berhasil separuh dan tidak ada cara membatalkannya dari sini.
// RPC-nya juga menolak posisi yang tidak punya siklus aktif.
export async function updateTree(
  input: UpdateTreeInput
): Promise<ServiceResult<SuccessData>> {
  const position = normalizeTreePosition(input.rowPosition, input.columnPosition);

  if (position instanceof Error) {
    return fail(position);
  }

  const farmIdResult = await getAccessibleTreeFarmId(input.treeId);

  if (farmIdResult.error) {
    return fail(farmIdResult.error);
  }

  const accessResult = await ensureActiveOwner(farmIdResult.data);

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const { error } = await supabase.rpc('update_tree_with_planting', {
    p_column_position: position.columnPosition,
    p_planted_at: normalizeOptionalText(input.plantedAt),
    p_row_position: position.rowPosition,
    p_tree_id: input.treeId,
    p_variety: normalizeOptionalText(input.variety),
  });

  if (error) {
    return fail(error, 'Gagal memperbarui data pohon.');
  }

  return ok({
    success: true,
  });
}

// archiveTree/restoreTree/setTreeArchived DICABUT bersama UI arsip pohon.
// Ketiganya adalah satu-satunya jalur di aplikasi yang pernah MENULIS
// is_archived, dan ia menulis lewat PostgREST langsung, bukan lewat RPC.
//
// Kolomnya sendiri TETAP, begitu pula policy UPDATE trees dari migrasi 056 yang
// dulu mengizinkan tulisan itu. Yang tersisa hanya PEMBACAAN: parameter
// `archived` di getTrees, Tree.isArchived, penyaring di growthPhaseService dan
// dashboardService, serta cabang 'farm' di complete_task. Jangan cabut itu —
// posisi berarsip tetap harus terhitung terisi (invarian 062).

async function getAccessibleTreeFarmId(treeId: UUID): Promise<ServiceResult<UUID>> {
  const { data, error } = await supabase
    .from('trees')
    .select('id, farm_id')
    .eq('id', treeId)
    .maybeSingle<TreeFarmRow>();

  if (error) {
    return fail(error, 'Gagal memeriksa akses pohon.');
  }

  if (!data) {
    return fail(new Error('Data pohon tidak ditemukan atau tidak dapat diakses.'));
  }

  return ok(data.farm_id);
}

async function ensureActiveFarmMember(farmId: UUID): Promise<ServiceResult<SuccessData>> {
  const membershipResult = await getCurrentUserMembership(farmId);

  if (membershipResult.error) {
    return fail(membershipResult.error);
  }

  if (membershipResult.data?.status !== 'active') {
    return fail(new Error('Hanya anggota kebun aktif yang dapat mengakses data pohon.'));
  }

  return ok({
    success: true,
  });
}

async function ensureActiveOwner(farmId: UUID): Promise<ServiceResult<SuccessData>> {
  const membershipResult = await getCurrentUserMembership(farmId);

  if (membershipResult.error) {
    return fail(membershipResult.error);
  }

  if (membershipResult.data?.role !== 'owner' || membershipResult.data.status !== 'active') {
    return fail(new Error('Hanya pemilik aktif yang dapat mengelola data pohon.'));
  }

  return ok({
    success: true,
  });
}

async function getCurrentUserMembership(
  farmId: UUID
): Promise<ServiceResult<MembershipRow | null>> {
  const userResult = await supabase.auth.getUser();

  if (userResult.error) {
    if (isMissingSessionError(userResult.error)) {
      return fail(new Error('Silakan login terlebih dahulu.'));
    }

    return fail(userResult.error, 'Gagal memuat pengguna saat ini.');
  }

  const userId = userResult.data.user?.id;

  if (!userId) {
    return fail(new Error('Silakan login terlebih dahulu.'));
  }

  const { data, error } = await supabase
    .from('farm_members')
    .select('role, status')
    .eq('farm_id', farmId)
    .eq('user_id', userId)
    .maybeSingle<MembershipRow>();

  if (error) {
    return fail(error, 'Gagal memeriksa akses kebun.');
  }

  return ok(data);
}

function mapTree(row: TreeRow): Tree {
  return {
    id: row.id,
    farmId: row.farm_id,
    treeCode: row.tree_code,
    rowPosition: row.row_position,
    columnPosition: row.column_position,
    activePlanting: readActivePlanting(row.tree_plantings),
    currentCondition: row.current_condition,
    currentGrowthPhase: row.current_growth_phase,
    isArchived: row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Satu-satunya tempat nilai form diubah jadi bentuk yang diterima database.
//
// Aturannya cerminan constraint di migrasi 054: row_position smallint dengan
// CHECK 1..999, column_position text dengan CHECK '^[A-Z]$'. Ditegakkan di sini
// juga supaya pesannya terbaca pekerja, bukan "violates check constraint".
//
// Rentang terhadap UKURAN KEBUN sengaja TIDAK diperiksa di sini — itu milik
// trigger validate_tree_position, yang punya akses ke baris farms. Klien hanya
// menutup bentuknya.
function normalizeTreePosition(
  rowValue: string | null | undefined,
  columnValue: string | null | undefined
): { rowPosition: number; columnPosition: string } | Error {
  const rawRow = normalizeOptionalText(rowValue);
  const rawColumn = normalizeOptionalText(columnValue);

  if (!rawRow || !rawColumn) {
    return new Error('Baris dan kolom wajib diisi.');
  }

  if (!/^\d+$/.test(rawRow)) {
    return new Error('Baris harus berupa angka.');
  }

  const rowPosition = Number(rawRow);

  if (rowPosition < 1 || rowPosition > 999) {
    return new Error('Baris harus antara 1 dan 999.');
  }

  const columnPosition = rawColumn.toUpperCase();

  if (!/^[A-Z]$/.test(columnPosition)) {
    return new Error('Kolom harus satu huruf A sampai Z.');
  }

  return { columnPosition, rowPosition };
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function sanitizeSearchTerm(value: string): string {
  return value.replace(/[%,()]/g, ' ').trim();
}

function isMissingSessionError(error: { message?: string; name?: string }): boolean {
  return (
    error.name === 'AuthSessionMissingError' ||
    error.message?.toLowerCase().includes('auth session missing') === true
  );
}
