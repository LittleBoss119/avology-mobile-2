import { supabase } from '../lib/supabase';
import type {
  AssignWorkerToScheduleData,
  AssignWorkerToScheduleInput,
  CareCategory,
  CareSchedule,
  CareScheduleDetail,
  CareTask,
  CancelCareScheduleData,
  CancelCareScheduleInput,
  CreateManualScheduleData,
  CreateManualScheduleInput,
  GetCareScheduleDetailInput,
  GetCareSchedulesWithTasksInput,
  GetScheduleEditEligibilityInput,
  MemberRole,
  MemberStatus,
  ScheduleDateBasis,
  ScheduleEditEligibility,
  ServiceResult,
  StopScheduleRepeatData,
  StopScheduleRepeatInput,
  SuccessData,
  TargetType,
  TaskStatus,
  UpdateCareScheduleInput,
  UUID,
} from '../types/domain';
import { sweepMissedSchedules } from './missedScheduleSweep';
import { compareTreePosition, resolveTreeTargetCodes } from './scheduleTreeService';
import { formatCareCategory, formatTargetType } from '../utils/displayFormat';
import { fail, ok } from '../utils/serviceResult';

// Judul jadwal, dirakit program. Menggantikan kolom teks bebas yang dulu diketik
// pemilik: itu satu-satunya keyboard di alur buat jadwal, dan isinya terbukti
// jadi sampah ("Test", "awas", "Besok ajah") — kata yang hanya berarti bagi
// orang yang mengetiknya, pada hari ia mengetiknya.
//
// Bentuknya "<jenis> · <target>": "Pemupukan · 12 pohon", "Penyiraman · Semua
// pohon", "Pemupukan · Parit sisi utara".
//
// DI SINI, bukan di layar, karena title adalah kolom yang dipersistensi
// (care_schedules.title NOT NULL) — merakitnya logika domain, bukan presentasi.
// Satu implementasi dipakai tiga tempat: payload buat, payload edit, dan baris
// ringkasan di atas tombol simpan. Baris ringkasan itu MENJANJIKAN string yang
// sama dengan yang akan tersimpan, dan janji itu hanya bisa dijaga kalau
// sumbernya satu.
//
// Ruas targetnya memakai formatTargetType untuk 'farm' — bukan literal "Semua
// pohon" — supaya judul dan label pilihan di formulir tidak bisa berselisih
// kata.
//
// Mengembalikan null kalau bahannya belum lengkap. Itu keadaan NORMAL saat
// dipakai baris ringkasan (pemilik belum memilih apa-apa), dan tidak pernah
// terjadi di jalur simpan karena validateScheduleForm sudah menahannya lebih
// dulu — pemanggil di sana memperlakukan null sebagai galat, bukan menuliskan
// judul kosong ke kolom NOT NULL.
export function buildScheduleTitle(input: {
  category: CareCategory | '';
  customTargetNote?: string | null;
  targetTreeIds?: UUID[] | null;
  targetType: TargetType;
}): string | null {
  if (!input.category) {
    return null;
  }

  const target = buildScheduleTitleTarget(input);

  if (!target) {
    return null;
  }

  return `${formatCareCategory(input.category)} · ${target}`;
}

// Sengaja TIDAK memakai formatCareTarget: yang itu meringkas untuk dibaca di
// baris daftar (ia butuh kode pohon, dan menulis "Pohon 1-A" untuk satu pohon).
// Judul butuh bentuk yang stabil dan tidak bergantung pada kode pohon yang
// mungkin belum termuat, jadi cabang 'tree' selalu berupa hitungan.
function buildScheduleTitleTarget(input: {
  customTargetNote?: string | null;
  targetTreeIds?: UUID[] | null;
  targetType: TargetType;
}): string | null {
  if (input.targetType === 'farm') {
    return formatTargetType('farm');
  }

  if (input.targetType === 'tree') {
    const count = input.targetTreeIds?.length ?? 0;

    return count > 0 ? `${count} pohon` : null;
  }

  // 'custom': isi catatannya sendiri, bukan kata "Area lain". "Pemupukan ·
  // Parit sisi utara" memberi tahu sesuatu; "Pemupukan · Area lain" tidak.
  return input.customTargetNote?.trim() || null;
}

const CARE_SCHEDULE_SELECT =
  'id, farm_id, title, category, scheduled_date, target_type, target_tree_id, custom_target_note, instruction, requires_photo, is_cancelled, cancelled_at, cancelled_by, cancel_reason, repeat_every_days, series_id, parent_schedule_id, missed_at, grace_days, date_basis, created_by, created_at, updated_at';

// Batas id per query .in(). PostgREST menaruh seluruh daftar id di query string,
// jadi satu .in() dengan ratusan uuid membuat URL melewati batas panjang server.
const SCHEDULE_TASK_BATCH_SIZE = 100;

const CARE_TASK_SELECT =
  'id, farm_id, care_schedule_id, assigned_to, assigned_by, title, category, instruction, target_type, target_tree_id, custom_target_note, due_date, status, missed_at, requires_photo, created_at, updated_at';

// Dipakai untuk SETIAP kegagalan penulisan di updateCareSchedule setelah
// penulisan pertama dimulai.
//
// Dilempar sebagai `new Error(...)`, bukan sebagai fallbackMessage pada
// fail(error, fallback). Alasannya bentuk toServiceError: fallbackMessage hanya
// dipakai kalau errornya TIDAK punya message, sedangkan galat Supabase selalu
// punya -- dan galat teknis apa pun akan dipetakan jadi "Terjadi kendala saat
// memproses data. Periksa input lalu coba lagi.", saran yang salah di sini
// karena tidak ada input yang bisa dibetulkan.
const PARTIAL_SAVE_MESSAGE =
  'Perubahan belum tersimpan seluruhnya. Buka ulang jadwal ini, lalu periksa daftar pohonnya.';

const careCategories: CareCategory[] = [
  'watering',
  'fertilizing',
  'spraying',
  'weeding',
  'other',
];

type MembershipRow = {
  role: MemberRole;
  status: MemberStatus;
};

type ActiveWorkerPickerRow = {
  user_id: string;
  full_name: string;
};

// Tiga kolom terakhir ditambahkan create_manual_schedule di migrasi 057.
// Sebelumnya PostgREST tetap mengirimnya dan tipe ini diam-diam membuangnya,
// jadi pemilik tidak pernah diberi tahu pohon mana yang ditolak.
type ScheduleTaskRpcRow = {
  schedule_id: string;
  task_id: string;
  scheduled_tree_ids: string[] | null;
  rejected_tree_ids: string[] | null;
  rejected_message: string | null;
};

type ScheduleTreeBridgeRow = {
  tree_id: string;
};

type TreePositionRow = {
  id: string;
  row_position: number | null;
  column_position: string | null;
};

type CareScheduleRow = {
  id: string;
  farm_id: string;
  title: string;
  category: CareCategory;
  scheduled_date: string;
  target_type: TargetType;
  target_tree_id: string | null;
  custom_target_note: string | null;
  instruction: string | null;
  requires_photo: boolean | null;
  is_cancelled?: boolean | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancel_reason?: string | null;
  repeat_every_days?: number | null;
  series_id?: string | null;
  parent_schedule_id?: string | null;
  missed_at?: string | null;
  grace_days?: number | null;
  date_basis?: ScheduleDateBasis | null;
  created_by?: string;
  created_at?: string;
  updated_at?: string | null;
};

type CareTaskRow = {
  id: string;
  farm_id: string;
  care_schedule_id: string | null;
  assigned_to: string;
  assigned_by: string;
  title: string;
  category: CareCategory | null;
  instruction: string | null;
  target_type: TargetType;
  target_tree_id: string | null;
  custom_target_note: string | null;
  due_date: string;
  status: TaskStatus;
  missed_at?: string | null;
  requires_photo: boolean | null;
  created_at?: string;
  updated_at?: string | null;
};

type CareActivityIdRow = {
  id: string;
};

type NormalizedManualTarget = {
  targetType: TargetType;
  // Kosong untuk target 'farm' dan 'custom'. Untuk 'tree' dijamin berisi
  // minimal satu id, sudah di-trim dan tanpa kembar.
  targetTreeIds: string[];
  customTargetNote: string | null;
};

type EditableScheduleUpdate = {
  assignedWorkerId: UUID | null;
  category: CareCategory;
  // undefined = jangan sentuh kolomnya; null = setel jadi "tidak pernah terlewat".
  graceDays: number | null | undefined;
  dateBasis: ScheduleDateBasis | undefined;
  customTargetNote: string | null;
  instruction: string | null;
  requiresPhoto: boolean;
  scheduledDate: string;
  targetTreeIds: string[];
  targetType: TargetType;
  title: string;
};

export async function createManualSchedule(
  input: CreateManualScheduleInput
): Promise<ServiceResult<CreateManualScheduleData>> {
  const title = normalizeOptionalText(input.title);

  if (!title) {
    return fail(new Error('Judul jadwal wajib diisi.'));
  }

  const category = validateCareCategory(input.category);

  if (category instanceof Error) {
    return fail(category);
  }

  const scheduledDate = normalizeScheduleDate(input.scheduledDate);

  if (scheduledDate instanceof Error) {
    return fail(scheduledDate);
  }

  const workerIds = normalizeWorkerIds([input.assignedWorkerId]);

  if (workerIds instanceof Error) {
    return fail(workerIds);
  }

  const target = normalizeManualTarget({
    customTargetNote: input.customTargetNote,
    targetTreeIds: input.targetTreeIds,
    targetType: input.targetType,
  });

  if (target instanceof Error) {
    return fail(target);
  }

  const accessResult = await ensureActiveOwner(
    input.farmId,
    'Hanya pemilik aktif yang dapat membuat jadwal manual.'
  );

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const workersResult = await ensureActiveWorkers(input.farmId, workerIds);

  if (workersResult.error) {
    return fail(workersResult.error);
  }

  const { data, error } = await supabase.rpc('create_manual_schedule', {
    p_assigned_worker_id: workerIds[0],
    p_category: category,
    p_custom_target_note: target.customTargetNote,
    p_farm_id: input.farmId,
    p_instruction: normalizeOptionalText(input.instruction),
    p_repeat_every_days: normalizeRepeatEveryDays(input.repeatEveryDays),
    p_requires_photo: input.requiresPhoto ?? false,
    p_scheduled_date: scheduledDate,
    // p_target_tree_ids, BUKAN p_target_tree_id. Yang tunggal masih ada di
    // signature RPC demi pemanggil lama, tapi hanya yang jamak yang bisa
    // membawa lebih dari satu pohon ke care_schedule_trees.
    p_target_tree_ids: target.targetTreeIds.length > 0 ? target.targetTreeIds : null,
    p_target_type: target.targetType,
    p_title: title,
  });

  if (error) {
    return fail(error, 'Gagal membuat jadwal manual dan tugas pekerja.');
  }

  const row = ((data ?? []) as ScheduleTaskRpcRow[])[0];

  if (!row?.schedule_id || !row.task_id) {
    return fail(new Error('RPC create_manual_schedule tidak mengembalikan schedule dan task.'));
  }

  return ok({
    scheduleId: row.schedule_id,
    taskId: row.task_id,
    scheduledTreeIds: row.scheduled_tree_ids ?? [],
    rejectedTreeIds: row.rejected_tree_ids ?? [],
    // Bukan galat. Jadwalnya sudah jadi; ini keterangan untuk pemilik soal
    // pohon yang tidak ikut karena posisinya sedang tidak ditanami.
    rejectedMessage: normalizeOptionalText(row.rejected_message),
  });
}

// Versi daftar yang sudah membawa tugasnya. Menggantikan pola lama "ambil
// daftar, lalu getCareScheduleDetail satu per satu": pola itu memanggil
// ensureActiveOwner untuk SETIAP jadwal, sehingga jumlah request tumbuh linear
// terhadap jumlah jadwal — dan sejak jadwal berulang ada (migration 041),
// jumlah jadwal tumbuh sendiri seiring waktu tanpa campur tangan owner.
//
// Di sini otorisasi dicek SEKALI, jadwal diambil sekali, dan tugasnya diambil
// dalam satu query per batch id. Jumlah request jadi tetap (lihat
// SCHEDULE_TASK_BATCH_SIZE), berapa pun jumlah jadwalnya.
//
// getCareScheduleDetail sengaja dibiarkan hidup untuk layar detail, yang memang
// hanya butuh satu jadwal.
export async function getCareSchedulesWithTasks(
  input: GetCareSchedulesWithTasksInput
): Promise<ServiceResult<CareScheduleDetail[]>> {
  const accessResult = await ensureActiveOwner(
    input.farmId,
    'Hanya pemilik aktif yang dapat melihat jadwal perawatan.'
  );

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  // Tandai jadwal yang lewat masa toleransi sebelum membaca, supaya daftar
  // yang tampil sudah mencerminkan keadaan terkini.
  await sweepMissedSchedules(input.farmId);

  const scheduledFrom = normalizeOptionalText(input.scheduledFrom);
  let scheduleQuery = supabase
    .from('care_schedules')
    .select(CARE_SCHEDULE_SELECT)
    .eq('farm_id', input.farmId);

  // Satu-satunya penyaringan yang benar-benar terjadi di server. Ini yang
  // memotong pertumbuhan baris saat rantai berulang sudah berjalan lama.
  if (scheduledFrom) {
    scheduleQuery = scheduleQuery.gte('scheduled_date', scheduledFrom);
  }

  const { data, error } = await scheduleQuery
    .order('scheduled_date', { ascending: false })
    .order('created_at', { ascending: false })
    .returns<CareScheduleRow[]>();

  if (error) {
    return fail(error, 'Gagal memuat daftar jadwal perawatan.');
  }

  const scheduleRows = data ?? [];

  if (scheduledFrom && input.includeOlderOpenWork) {
    const tailResult = await getOlderOpenScheduleRows(
      input.farmId,
      new Set(scheduleRows.map((row) => row.id))
    );

    if (tailResult.error) {
      return fail(tailResult.error);
    }

    scheduleRows.push(...tailResult.data);
    // Urutan kontraknya tetap scheduled_date menurun, created_at menurun —
    // baris susulan disisipkan lewat sort, bukan ditempel di ekor.
    scheduleRows.sort(compareScheduleRowsDescending);
  }

  const schedules = scheduleRows.map(mapCareSchedule);
  const tasksResult = await getTasksByScheduleId(schedules.map((schedule) => schedule.id));

  if (tasksResult.error) {
    return fail(tasksResult.error);
  }

  // SATU pembacaan jembatan untuk SELURUH kartu yang akan dirender, bukan satu
  // per kartu. Daftar jadwal owner rutin menampilkan puluhan baris sekaligus;
  // membaca per kartu berarti puluhan request untuk satu layar.
  const treeCodesBySchedule = await attachTreeTargets(schedules);

  const withTasks = schedules.map((schedule) => {
    const treeTarget = treeCodesBySchedule[schedule.id];

    return {
      ...schedule,
      targetTreeIds: treeTarget?.treeIds,
      targetTreeCodes: treeTarget?.treeCodes,
      // Sejak migration 041 sebuah jadwal boleh punya NOL tugas: penerus rantai
      // dibuat tanpa tugas kalau pekerjanya sudah keluar dari kebun.
      //
      // Tugas meminjam daftar pohon milik jadwalnya -- tidak ada
      // care_task_trees, dan tidak ada pembacaan kedua untuk mengisinya.
      tasks: (tasksResult.data.get(schedule.id) ?? []).map((task) => ({
        ...task,
        targetTreeIds: treeTarget?.treeIds,
        targetTreeCodes: treeTarget?.treeCodes,
      })),
    };
  });

  if (!input.excludeCompleted) {
    return ok(withTasks);
  }

  // Disaring di klien, BUKAN di server. "Semua tugasnya completed" tidak bisa
  // dinyatakan sebagai filter care_schedules tanpa join ke care_tasks, dan
  // embed inner join PostgREST justru akan MEMBUANG jadwal tanpa tugas —
  // persis baris yang paling tidak boleh hilang. Filter server yang benar
  // butuh view atau RPC baru, dan tahap ini tidak boleh menyentuh migrasi.
  // Jadi ini mengurangi baris yang dirender, bukan baris yang diambil.
  return ok(
    withTasks.filter(
      (schedule) =>
        schedule.tasks.length === 0 ||
        !schedule.tasks.every((task) => task.status === 'completed')
    )
  );
}

export async function getCareScheduleDetail(
  input: GetCareScheduleDetailInput
): Promise<ServiceResult<CareScheduleDetail>> {
  const scheduleResult = await supabase
    .from('care_schedules')
    .select(CARE_SCHEDULE_SELECT)
    .eq('id', input.scheduleId)
    .maybeSingle<CareScheduleRow>();

  if (scheduleResult.error) {
    return fail(scheduleResult.error, 'Gagal memuat detail jadwal perawatan.');
  }

  if (!scheduleResult.data) {
    return fail(new Error('Jadwal perawatan tidak ditemukan atau tidak dapat diakses.'));
  }

  const accessResult = await ensureActiveOwner(
    scheduleResult.data.farm_id,
    'Hanya pemilik aktif yang dapat melihat jadwal perawatan.'
  );

  if (accessResult.error) {
    return fail(accessResult.error);
  }

  const tasksResult = await supabase
    .from('care_tasks')
    .select(CARE_TASK_SELECT)
    .eq('care_schedule_id', input.scheduleId)
    // Tugas yang dilepas saat pekerjanya keluar dari kebun (migrasi 051) tidak
    // ikut ditampilkan. Barisnya sengaja dipertahankan di database sebagai
    // jejak, tapi bagi owner jadwal ini harus terbaca "belum ada pekerja" --
    // bukan tugas menunggu atas nama orang yang sudah pergi.
    .is('released_at', null)
    .order('due_date', { ascending: true })
    .order('created_at', { ascending: true })
    .returns<CareTaskRow[]>();

  if (tasksResult.error) {
    return fail(tasksResult.error, 'Gagal memuat tugas dari jadwal.');
  }

  const schedule = mapCareSchedule(scheduleResult.data);
  const treeTarget = (await attachTreeTargets([schedule]))[schedule.id];

  return ok({
    ...schedule,
    targetTreeIds: treeTarget?.treeIds,
    targetTreeCodes: treeTarget?.treeCodes,
    tasks: (tasksResult.data ?? []).map((row) => ({
      ...mapCareTask(row),
      targetTreeIds: treeTarget?.treeIds,
      targetTreeCodes: treeTarget?.treeCodes,
    })),
  });
}

// Membaca daftar pohon untuk sekumpulan jadwal sekaligus.
//
// SENGAJA TIDAK mengembalikan galat. Kode pohon adalah pelengkap tampilan;
// kalau jembatannya tidak bisa dibaca, daftar jadwal tetap harus muncul dan
// tampilannya jatuh balik ke bayangan lewat formatCareTarget. Menggagalkan
// seluruh layar demi satu baris teks menukar hal besar dengan hal kecil.
async function attachTreeTargets(
  schedules: CareSchedule[]
): Promise<Record<string, { treeIds: UUID[]; treeCodes: string[] }>> {
  // Hanya jadwal bertarget pohon yang punya baris jembatan. Jadwal 'farm' dan
  // 'custom' dibuang dari daftar id supaya query string .in() tidak menggendong
  // id yang sudah pasti tidak menghasilkan apa-apa -- dan di kebun nyata
  // jadwal 'farm' justru yang paling banyak.
  const treeSchedules = schedules.filter((schedule) => schedule.targetType === 'tree');

  if (treeSchedules.length === 0) {
    return {};
  }

  const result = await resolveTreeTargetCodes(
    treeSchedules.map((schedule) => ({
      key: schedule.id,
      scheduleId: schedule.id,
      // Jadwal lama yang luput backfill 057 tidak punya baris jembatan sama
      // sekali. Di situ -- dan HANYA di situ -- bayangannya dipakai.
      fallbackTreeId: schedule.targetTreeId,
    }))
  );

  return result.data ?? {};
}

export async function cancelCareSchedule(
  input: CancelCareScheduleInput
): Promise<ServiceResult<CancelCareScheduleData>> {
  const scheduleId = normalizeOptionalText(input.scheduleId);

  if (!scheduleId) {
    return fail(new Error('Jadwal perawatan tidak ditemukan.'));
  }

  const { error } = await supabase.rpc('cancel_care_schedule', {
    p_reason: normalizeOptionalText(input.reason),
    p_schedule_id: scheduleId,
  });

  if (error) {
    return fail(error, 'Gagal membatalkan jadwal perawatan.');
  }

  return ok({
    success: true,
  });
}

// Jalur resmi untuk jadwal yang belum punya tugas (penerus rantai yang lahir
// saat pekerjanya sudah keluar). RPC-nya menolak jadwal yang sudah punya tugas,
// jadi ini bukan pengganti updateCareSchedule.
export async function assignWorkerToSchedule(
  input: AssignWorkerToScheduleInput
): Promise<ServiceResult<AssignWorkerToScheduleData>> {
  const scheduleId = normalizeOptionalText(input.scheduleId);

  if (!scheduleId) {
    return fail(new Error('Jadwal perawatan tidak ditemukan.'));
  }

  const workerId = normalizeOptionalText(input.workerId);

  if (!workerId) {
    return fail(new Error('Pilih satu pekerja aktif.'));
  }

  const { data, error } = await supabase.rpc('assign_worker_to_care_schedule', {
    p_schedule_id: scheduleId,
    p_worker_id: workerId,
  });

  if (error) {
    return fail(error, 'Gagal menugaskan pekerja ke jadwal.');
  }

  const taskId = typeof data === 'string' ? normalizeOptionalText(data) : null;

  if (!taskId) {
    return fail(new Error('RPC assign_worker_to_care_schedule tidak mengembalikan tugas baru.'));
  }

  return ok({
    taskId,
  });
}

// Menghentikan kelanjutan rantai TANPA membatalkan jadwal yang sedang berjalan
// — berbeda dari cancelCareSchedule, tugas yang sudah ada tetap harus dikerjakan.
export async function stopScheduleRepeat(
  input: StopScheduleRepeatInput
): Promise<ServiceResult<StopScheduleRepeatData>> {
  const scheduleId = normalizeOptionalText(input.scheduleId);

  if (!scheduleId) {
    return fail(new Error('Jadwal perawatan tidak ditemukan.'));
  }

  const { error } = await supabase.rpc('stop_care_schedule_repeat', {
    p_schedule_id: scheduleId,
  });

  if (error) {
    return fail(error, 'Gagal menghentikan pengulangan jadwal.');
  }

  return ok({
    success: true,
  });
}

export async function getScheduleEditEligibility(
  input: GetScheduleEditEligibilityInput
): Promise<ServiceResult<ScheduleEditEligibility>> {
  const scheduleResult = await getCareScheduleDetail({
    scheduleId: input.scheduleId,
  });

  if (scheduleResult.error) {
    return fail(scheduleResult.error);
  }

  return getScheduleEditEligibilityFromDetail(scheduleResult.data);
}

export async function updateCareSchedule(
  input: UpdateCareScheduleInput
): Promise<ServiceResult<SuccessData>> {
  const scheduleResult = await getCareScheduleDetail({
    scheduleId: input.scheduleId,
  });

  if (scheduleResult.error) {
    return fail(scheduleResult.error);
  }

  const schedule = scheduleResult.data;
  const eligibilityResult = await getScheduleEditEligibilityFromDetail(schedule);

  if (eligibilityResult.error) {
    return fail(eligibilityResult.error);
  }

  if (!eligibilityResult.data.canEdit) {
    return fail(new Error(eligibilityResult.data.reason ?? 'Jadwal ini tidak bisa diedit.'));
  }

  const normalized = normalizeScheduleUpdateInput(input);

  if (normalized instanceof Error) {
    return fail(normalized);
  }

  // Jadwal tanpa tugas tidak punya apa pun untuk dipindahtangankan. Dulu blok
  // update tugas di bawah dilewati diam-diam sementara fungsi ini tetap
  // melaporkan sukses, jadi owner melihat "Perubahan tersimpan" padahal pekerja
  // yang dia pilih tidak pernah tersimpan di mana pun. Ditolak sebelum satu pun
  // penulisan terjadi, supaya tidak ada perubahan separuh jalan.
  if (normalized.assignedWorkerId && schedule.tasks.length === 0) {
    return fail(
      new Error(
        'Jadwal ini belum punya tugas. Tugaskan pekerja lebih dulu dari halaman detail jadwal.'
      )
    );
  }

  if (normalized.assignedWorkerId) {
    const workersResult = await ensureActiveWorkers(schedule.farmId, [normalized.assignedWorkerId]);

    if (workersResult.error) {
      return fail(workersResult.error);
    }
  }

  // Dibandingkan SEBELUM jadwal ditulis: setelah update, schedule.scheduledDate
  // yang dipegang di sini sudah menjadi salinan lama, jadi perbandingan harus
  // terjadi di titik ini.
  const scheduleDateChanged = schedule.scheduledDate !== normalized.scheduledDate;

  // ---------------------------------------------------------------------------
  // Dua pembacaan, NOL penulisan. Sengaja dituntaskan sebelum penulisan pertama:
  // kalau salah satunya gagal, tidak ada apa pun yang sudah terlanjur berubah.
  // ---------------------------------------------------------------------------
  const currentBridgeResult = await supabase
    .from('care_schedule_trees')
    .select('tree_id')
    .eq('schedule_id', schedule.id)
    .returns<ScheduleTreeBridgeRow[]>();

  if (currentBridgeResult.error) {
    return fail(currentBridgeResult.error, 'Gagal memuat daftar pohon jadwal ini.');
  }

  const currentTreeIds = new Set((currentBridgeResult.data ?? []).map((row) => row.tree_id));
  const nextTreeIds = normalized.targetType === 'tree' ? normalized.targetTreeIds : [];

  // Kolom bayangan diisi pohon yang SAMA dengan yang dipilih RPC: urutan
  // row_position lalu column_position. Bukan urutan teks tree_code -- urutan
  // teks menaruh '10-A' sebelum '2-A', dan kalau sisi aplikasi memilih pohon
  // yang berbeda dari sisi database, bayangan jadwal hasil sunting akan
  // berbeda dari bayangan jadwal hasil buat.
  let shadowTreeId: string | null = null;

  if (nextTreeIds.length > 0) {
    const shadowResult = await pickShadowTreeId(nextTreeIds);

    if (shadowResult.error) {
      return fail(shadowResult.error);
    }

    shadowTreeId = shadowResult.data;
  }

  const now = new Date().toISOString();
  // ---------------------------------------------------------------------------
  // URUTAN PENULISAN WAJIB: insert jembatan -> delete jembatan -> update
  // bayangan. Jangan ditukar.
  //
  // Alasannya keadaan di tengah. Kalau delete berjalan lebih dulu lalu insert
  // gagal, jadwal ini berdiri tanpa satu pun pohon -- dan complete_task yang
  // membaca jembatan akan menautkan pekerjaan ke nol pohon, atau jatuh ke
  // cadangan bayangan yang saat itu juga sudah tidak sepadan. Dengan insert
  // lebih dulu, kegagalan di tengah menyisakan jadwal yang menyasar TERLALU
  // BANYAK pohon -- keadaan yang salah tapi bisa dilihat dan dibetulkan owner,
  // bukan pekerjaan yang hilang tanpa jejak.
  //
  // Tidak ada transaksi yang bisa membungkus ketiganya: jalur sunting sengaja
  // TIDAK lewat RPC (keputusan 057), dan klien Supabase tidak bisa membungkus
  // beberapa statement PostgREST dalam satu transaksi.
  // ---------------------------------------------------------------------------

  // 1. Insert pohon yang baru.
  const treeIdsToInsert = nextTreeIds.filter((treeId) => !currentTreeIds.has(treeId));

  if (treeIdsToInsert.length > 0) {
    const insertResult = await supabase
      .from('care_schedule_trees')
      .upsert(
        treeIdsToInsert.map((treeId) => ({ schedule_id: schedule.id, tree_id: treeId })),
        { ignoreDuplicates: true, onConflict: 'schedule_id,tree_id' }
      );

    if (insertResult.error) {
      return fail(new Error(PARTIAL_SAVE_MESSAGE));
    }
  }

  // 2. Delete pohon yang tidak lagi dipilih.
  const nextTreeIdSet = new Set(nextTreeIds);
  const treeIdsToDelete = Array.from(currentTreeIds).filter((treeId) => !nextTreeIdSet.has(treeId));

  if (treeIdsToDelete.length > 0) {
    const deleteResult = await supabase
      .from('care_schedule_trees')
      .delete()
      .eq('schedule_id', schedule.id)
      .in('tree_id', treeIdsToDelete);

    if (deleteResult.error) {
      return fail(new Error(PARTIAL_SAVE_MESSAGE));
    }
  }

  // 3. Update kolom bayangan (bersama sisa field jadwal).
  const scheduleUpdate = {
    // Keduanya hanya ikut dikirim kalau pemanggil memang menyebutkannya;
    // `undefined` berarti kolomnya tidak disentuh.
    ...(normalized.graceDays !== undefined ? { grace_days: normalized.graceDays } : {}),
    ...(normalized.dateBasis !== undefined ? { date_basis: normalized.dateBasis } : {}),
    category: normalized.category,
    custom_target_note: normalized.customTargetNote,
    instruction: normalized.instruction,
    requires_photo: normalized.requiresPhoto,
    scheduled_date: normalized.scheduledDate,
    target_tree_id: shadowTreeId,
    target_type: normalized.targetType,
    title: normalized.title,
    updated_at: now,
  };

  const scheduleUpdateResult = await supabase
    .from('care_schedules')
    .update(scheduleUpdate)
    .eq('id', schedule.id);

  if (scheduleUpdateResult.error) {
    // Jembatan sudah berubah tapi bayangannya belum. Pesannya menyebut itu
    // apa adanya, bukan 'Gagal memperbarui jadwal' yang membuat owner mengira
    // tidak ada apa pun yang berubah.
    return fail(new Error(PARTIAL_SAVE_MESSAGE));
  }

  if (schedule.tasks.length > 0) {
    const taskIds = schedule.tasks.map((task) => task.id);
    const taskUpdateResult = await supabase
      .from('care_tasks')
      .update({
        // Hanya dipindahtangankan kalau pemanggil memang menyertakan pekerja.
        ...(normalized.assignedWorkerId ? { assigned_to: normalized.assignedWorkerId } : {}),
        category: normalized.category,
        custom_target_note: normalized.customTargetNote,
        // due_date HANYA ditimpa kalau owner benar-benar memindahkan tanggal
        // jadwal pada penyuntingan ini.
        //
        // Sebelum migrasi 049 baris ini tidak bersyarat, sehingga owner yang
        // sekadar membetulkan judul ikut menarik kembali tenggat setiap tugas
        // ke scheduled_date — menghapus tanggal penundaan yang baru saja
        // disepakati pekerja, tanpa peringatan apa pun.
        //
        // Kalau tanggal jadwal memang diubah, itu penjadwalan ulang yang
        // disengaja owner dan wajar menang atas penundaan pekerja.
        ...(scheduleDateChanged ? { due_date: normalized.scheduledDate } : {}),
        instruction: normalized.instruction,
        requires_photo: normalized.requiresPhoto,
        target_tree_id: shadowTreeId,
        target_type: normalized.targetType,
        title: normalized.title,
        updated_at: now,
      })
      .in('id', taskIds);

    if (taskUpdateResult.error) {
      return fail(new Error(PARTIAL_SAVE_MESSAGE));
    }
  }

  return ok({
    success: true,
  });
}

// Jaring pengaman untuk scheduledFrom: memungut jadwal di LUAR jendela tanggal
// yang tugasnya masih terbuka, supaya pekerjaan tertunggak tidak pernah hilang
// dari daftar hanya karena tanggalnya sudah lewat jauh.
//
// Berangkat dari care_tasks, bukan care_schedules: himpunan tugas yang masih
// pending/postponed di masa lalu terbatas pada pekerjaan yang benar-benar
// mandek (biasanya nol sampai segelintir), sementara "semua jadwal sebelum
// tanggal X" justru himpunan tak terbatas yang sedang kita hindari.
//
// LUBANG YANG DIKETAHUI: jadwal yang belum punya tugas sama sekali tidak punya
// baris care_tasks, jadi tidak terjangkau dari sini. Selama jadwal seperti itu
// masih di dalam jendela tanggal ia tetap muncul; kalau menua melewati batas
// tanpa pernah ditugaskan, ia lolos. Menutupnya butuh anti-join (view atau RPC)
// yang tidak bisa dibuat tanpa migrasi baru.
//
// Penyaring `due_date < scheduledFrom` DIBUANG di migrasi 049. Sejak penundaan
// bertanggal, due_date sebuah tugas bisa MAJU melewati jendela sementara
// scheduled_date jadwal induknya tetap tertinggal jauh di belakang. Tugas
// seperti itu tidak terambil kueri utama (jadwalnya di luar jendela) dan dulu
// juga tidak terambil di sini (due_date-nya sudah tidak lebih kecil dari
// scheduledFrom) — jadi ia hilang sama sekali dari daftar owner.
//
// Tanpa penyaring itu, kueri ini memungut SELURUH tugas terbuka milik kebun.
// Himpunannya tetap kecil dengan alasan yang sama seperti sebelumnya: yang
// pending/postponed dan belum hangus adalah pekerjaan yang benar-benar
// menunggu. Jadwal yang sudah termuat kueri utama tetap dibuang lewat
// alreadyLoadedIds di bawah, jadi tidak ada baris ganda.
async function getOlderOpenScheduleRows(
  farmId: UUID,
  alreadyLoadedIds: Set<UUID>
): Promise<ServiceResult<CareScheduleRow[]>> {
  const openTasksResult = await supabase
    .from('care_tasks')
    .select('care_schedule_id')
    .eq('farm_id', farmId)
    .in('status', ['pending', 'postponed'])
    // Tugas yang sudah dinyatakan terlewat (migrasi 048) tidak lagi dipungut
    // ke dalam daftar. Penerusnya sudah dibuat penyapu, jadi menyeretnya terus
    // dari luar jendela tanggal hanya membuat daftar owner tumbuh tanpa batas
    // seiring rantai berjalan.
    .is('missed_at', null)
    // Tugas yang dilepas (migrasi 051) juga bukan tunggakan: pekerjaannya tidak
    // lagi jadi tanggungan siapa pun sampai owner menugaskannya ulang. Tanpa
    // baris ini, jadwal yang pekerjanya keluar tetap menyeret dirinya ke daftar
    // owner sebagai pekerjaan mandek -- persis gejala yang diperbaiki 051.
    .is('released_at', null)
    .returns<{ care_schedule_id: string | null }[]>();

  if (openTasksResult.error) {
    return fail(openTasksResult.error, 'Gagal memeriksa tugas yang masih tertunggak.');
  }

  const tailIds = Array.from(
    new Set(
      (openTasksResult.data ?? [])
        .map((row) => row.care_schedule_id)
        .filter((scheduleId): scheduleId is string => Boolean(scheduleId))
        .filter((scheduleId) => !alreadyLoadedIds.has(scheduleId))
    )
  );

  if (tailIds.length === 0) {
    return ok([]);
  }

  const rows: CareScheduleRow[] = [];

  for (let index = 0; index < tailIds.length; index += SCHEDULE_TASK_BATCH_SIZE) {
    const batch = tailIds.slice(index, index + SCHEDULE_TASK_BATCH_SIZE);
    const { data, error } = await supabase
      .from('care_schedules')
      .select(CARE_SCHEDULE_SELECT)
      .in('id', batch)
      .returns<CareScheduleRow[]>();

    if (error) {
      return fail(error, 'Gagal memuat jadwal yang masih tertunggak.');
    }

    rows.push(...(data ?? []));
  }

  return ok(rows);
}

function compareScheduleRowsDescending(a: CareScheduleRow, b: CareScheduleRow): number {
  if (a.scheduled_date !== b.scheduled_date) {
    return a.scheduled_date < b.scheduled_date ? 1 : -1;
  }

  const aCreatedAt = a.created_at ?? '';
  const bCreatedAt = b.created_at ?? '';

  if (aCreatedAt === bCreatedAt) {
    return 0;
  }

  return aCreatedAt < bCreatedAt ? 1 : -1;
}

// Mengambil tugas untuk banyak jadwal sekaligus, dipecah per batch supaya URL
// PostgREST tidak kepanjangan. Batch dijalankan paralel; setiap jadwal selalu
// jatuh utuh ke satu batch, jadi urutan due_date/created_at per jadwal tetap
// sama dengan getCareScheduleDetail.
async function getTasksByScheduleId(
  scheduleIds: UUID[]
): Promise<ServiceResult<Map<UUID, CareTask[]>>> {
  const tasksByScheduleId = new Map<UUID, CareTask[]>();

  if (scheduleIds.length === 0) {
    return ok(tasksByScheduleId);
  }

  const batches: UUID[][] = [];

  for (let index = 0; index < scheduleIds.length; index += SCHEDULE_TASK_BATCH_SIZE) {
    batches.push(scheduleIds.slice(index, index + SCHEDULE_TASK_BATCH_SIZE));
  }

  const batchResults = await Promise.all(
    batches.map((batch) =>
      supabase
        .from('care_tasks')
        .select(CARE_TASK_SELECT)
        .in('care_schedule_id', batch)
        // Sama seperti kueri detail jadwal: tugas yang dilepas (migrasi 051)
        // tidak dihitung sebagai tugas jadwal. Inilah yang membuat
        // schedule.tasks.length jatuh ke 0 sehingga baris jadwal menampilkan
        // penanda "Belum ada pekerja" yang sudah ada, tanpa penanda baru.
        .is('released_at', null)
        .order('due_date', { ascending: true })
        .order('created_at', { ascending: true })
        .returns<CareTaskRow[]>()
    )
  );

  const failedBatch = batchResults.find((result) => result.error);

  if (failedBatch?.error) {
    return fail(failedBatch.error, 'Gagal memuat tugas dari jadwal.');
  }

  for (const batchResult of batchResults) {
    for (const row of batchResult.data ?? []) {
      if (!row.care_schedule_id) {
        continue;
      }

      const existing = tasksByScheduleId.get(row.care_schedule_id);

      if (existing) {
        existing.push(mapCareTask(row));
      } else {
        tasksByScheduleId.set(row.care_schedule_id, [mapCareTask(row)]);
      }
    }
  }

  return ok(tasksByScheduleId);
}

// Pohon berkode terkecil dari sebuah daftar, dipakai mengisi kolom bayangan.
//
// Urutannya WAJIB sepadan dengan filter_trees_with_active_planting (migrasi
// 057) -- lihat compareTreePosition di scheduleTreeService, yang dipakai
// bersama supaya tidak ada dua definisi "terkecil" di basis kode ini.
async function pickShadowTreeId(treeIds: string[]): Promise<ServiceResult<string>> {
  const { data, error } = await supabase
    .from('trees')
    .select('id, row_position, column_position')
    .in('id', treeIds)
    .returns<TreePositionRow[]>();

  if (error) {
    return fail(error, 'Gagal memeriksa pohon yang dipilih.');
  }

  const rows = [...(data ?? [])].sort(compareTreePosition);

  if (rows.length === 0) {
    return fail(new Error('Pohon yang dipilih tidak ditemukan di kebun ini.'));
  }

  return ok(rows[0].id);
}

async function getScheduleEditEligibilityFromDetail(
  schedule: CareScheduleDetail
): Promise<ServiceResult<ScheduleEditEligibility>> {
  const accessResult = await ensureActiveOwner(
    schedule.farmId,
    'Hanya owner aktif yang dapat mengubah jadwal.'
  );

  if (accessResult.error) {
    return ok({
      canEdit: false,
      reason: accessResult.error.message,
    });
  }

  if (schedule.isCancelled) {
    return ok({
      canEdit: false,
      reason: 'Jadwal yang sudah dibatalkan tidak bisa diedit.',
    });
  }

  const taskIds = schedule.tasks.map((task) => task.id);

  if (taskIds.length === 0) {
    return ok({
      canEdit: true,
      reason: null,
    });
  }

  const { data, error } = await supabase
    .from('care_activities')
    .select('id')
    .in('care_task_id', taskIds)
    // Hanya hasil kerja yang BENAR-BENAR terjadi yang mengunci jadwal
    // (migrasi 052). Sebelumnya baris aktivitas apa pun mengunci, sehingga
    // satu kali "Tunda" dari pekerja membuat jadwalnya tidak bisa diedit
    // maupun dibatalkan — jalan buntu, karena penundaan justru berarti
    // pekerjaannya BELUM dikerjakan.
    //
    // Cerminan penjaga yang sama di cancel_care_schedule. Keduanya harus
    // bergerak bersama: kalau yang satu longgar dan yang lain tidak, tombolnya
    // hidup tapi RPC-nya menolak (atau sebaliknya, tombol mati padahal boleh).
    .eq('status', 'completed')
    .limit(1)
    .returns<CareActivityIdRow[]>();

  if (error) {
    return fail(error, 'Gagal memeriksa hasil kerja pada jadwal.');
  }

  if ((data ?? []).length > 0) {
    return ok({
      canEdit: false,
      reason: 'Jadwal ini sudah punya hasil kerja, jadi tidak bisa diedit.',
    });
  }

  return ok({
    canEdit: true,
    reason: null,
  });
}

async function ensureActiveOwner(
  farmId: UUID,
  forbiddenMessage = 'Hanya pemilik aktif yang dapat mengelola jadwal perawatan.'
): Promise<ServiceResult<SuccessData>> {
  const membershipResult = await getCurrentUserMembership(farmId);

  if (membershipResult.error) {
    return fail(membershipResult.error);
  }

  if (membershipResult.data?.role !== 'owner' || membershipResult.data.status !== 'active') {
    return fail(new Error(forbiddenMessage));
  }

  return ok({
    success: true,
  });
}

function validateCareCategory(category: CareCategory | undefined | null): CareCategory | Error {
  if (!category) {
    return new Error('Kategori jadwal wajib dipilih.');
  }

  if (!careCategories.includes(category)) {
    return new Error('Kategori jadwal tidak valid.');
  }

  return category;
}

async function ensureActiveWorkers(
  farmId: UUID,
  workerIds: UUID[]
): Promise<ServiceResult<SuccessData>> {
  const { data, error } = await supabase.rpc('get_active_workers_for_task_picker', {
    p_farm_id: farmId,
  });

  if (error) {
    return fail(error, 'Gagal memuat pekerja aktif.');
  }

  const activeWorkerIds = new Set(
    ((data ?? []) as ActiveWorkerPickerRow[]).map((worker) => worker.user_id)
  );
  const invalidWorkerIds = workerIds.filter((workerId) => !activeWorkerIds.has(workerId));

  if (invalidWorkerIds.length > 0) {
    return fail(new Error('Tugas hanya dapat diberikan kepada pekerja aktif pada kebun ini.'));
  }

  return ok({
    success: true,
  });
}

async function getCurrentUserMembership(
  farmId: UUID
): Promise<ServiceResult<MembershipRow | null>> {
  const userIdResult = await getCurrentUserId();

  if (userIdResult.error) {
    return fail(userIdResult.error);
  }

  const { data, error } = await supabase
    .from('farm_members')
    .select('role, status')
    .eq('farm_id', farmId)
    .eq('user_id', userIdResult.data)
    .maybeSingle<MembershipRow>();

  if (error) {
    return fail(error, 'Gagal memeriksa akses kebun.');
  }

  return ok(data);
}

async function getCurrentUserId(): Promise<ServiceResult<UUID>> {
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

  return ok(userId);
}

function normalizeWorkerIds(workerIds: UUID[]): UUID[] | Error {
  const uniqueWorkerIds = Array.from(
    new Set(workerIds.map((workerId) => workerId.trim()).filter(Boolean))
  );

  if (uniqueWorkerIds.length === 0) {
    return new Error('Pilih minimal satu pekerja aktif.');
  }

  return uniqueWorkerIds;
}

// Interval hanya dikirim kalau bilangan bulat positif; undefined/null/0/negatif
// -> null (jadwal sekali jalan). Math.trunc menjaga pecahan tidak sampai ke
// parameter integer RPC. RPC-nya menjepit ulang nilai ini, jadi ini penjaga
// sisi klien supaya pesan errornya tidak pernah jadi galat tipe Postgres.
function normalizeRepeatEveryDays(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const days = Math.trunc(value);

  return days > 0 ? days : null;
}

function normalizeScheduleDate(value: string): string | Error {
  const normalized = value.trim();

  if (!normalized) {
    return new Error('Tanggal jadwal wajib diisi.');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return new Error('Tanggal jadwal harus memakai format YYYY-MM-DD.');
  }

  const date = new Date(`${normalized}T00:00:00`);

  if (Number.isNaN(date.getTime()) || toLocalIsoDate(date) !== normalized) {
    return new Error('Tanggal jadwal tidak valid.');
  }

  return normalized;
}

// Dipakai DUA jalur: buat jadwal (lewat RPC) dan sunting jadwal (lewat UPDATE
// tabel langsung). Keduanya sudah diperiksa sebelum bentuk ini dilonggarkan
// dari satu pohon menjadi satu-sampai-banyak.
function normalizeManualTarget(input: {
  targetType: TargetType | string | null | undefined;
  targetTreeIds?: readonly (string | null | undefined)[] | null;
  customTargetNote?: string | null;
}): NormalizedManualTarget | Error {
  if (!input.targetType) {
    return new Error('Target jadwal wajib dipilih.');
  }

  // 'row' dan 'column' dibuang di migrasi 047. Nilainya masih ada di enum
  // target_type (PostgreSQL tidak bisa mencabut nilai enum), tapi ditutup CHECK
  // di kedua tabel — menerimanya di sini hanya berujung pelanggaran constraint
  // dengan pesan yang tidak terbaca pengguna.
  if (!['farm', 'tree', 'custom'].includes(input.targetType)) {
    return new Error('Target jadwal tidak valid.');
  }

  if (input.targetType === 'farm') {
    return {
      customTargetNote: null,
      targetTreeIds: [],
      targetType: 'farm',
    };
  }

  if (input.targetType === 'tree') {
    // Kembar dibuang di sini, bukan diserahkan ke primary key jembatan:
    // pelanggarannya berbunyi "duplicate key value violates unique constraint"
    // dan itu tidak memberi tahu pemilik apa pun.
    const treeIds = Array.from(
      new Set(
        (input.targetTreeIds ?? [])
          .map((treeId) => normalizeOptionalText(treeId))
          .filter((treeId): treeId is string => Boolean(treeId))
      )
    );

    if (treeIds.length === 0) {
      return new Error('Pilih minimal satu pohon.');
    }

    return {
      customTargetNote: null,
      targetTreeIds: treeIds,
      targetType: 'tree',
    };
  }

  const customTargetNote = normalizeOptionalText(input.customTargetNote);

  if (!customTargetNote) {
    return new Error('Catatan target khusus wajib diisi.');
  }

  return {
    customTargetNote,
    targetTreeIds: [],
    targetType: 'custom',
  };
}

// Presedensi masa toleransi, sepadan dengan create_manual_schedule (migrasi 048):
//   neverExpires true -> null, jadwal tidak pernah dinyatakan terlewat
//   graceDays diisi    -> dipakai apa adanya
//   keduanya kosong    -> undefined, artinya kolomnya tidak disentuh sama sekali
//
// Mengirim keduanya sekaligus ditolak, bukan salah satunya menang diam-diam:
// itu tanda pemanggil bingung, dan lebih baik ketahuan sebagai error.
function normalizeGraceDays(input: UpdateCareScheduleInput): number | null | undefined | Error {
  const neverExpires = input.neverExpires === true;

  if (neverExpires && input.graceDays !== undefined && input.graceDays !== null) {
    return new Error('Pilih salah satu: tidak pernah terlewat atau masa toleransi, jangan keduanya.');
  }

  if (neverExpires) {
    return null;
  }

  if (input.graceDays === undefined || input.graceDays === null) {
    return undefined;
  }

  if (!Number.isInteger(input.graceDays) || input.graceDays < 0) {
    return new Error('Masa toleransi harus bilangan bulat tidak negatif.');
  }

  return input.graceDays;
}

function normalizeScheduleUpdateInput(input: UpdateCareScheduleInput): EditableScheduleUpdate | Error {
  const title = normalizeOptionalText(input.title);

  if (!title) {
    return new Error('Judul jadwal wajib diisi.');
  }

  const category = validateCareCategory(input.category);

  if (category instanceof Error) {
    return category;
  }

  const scheduledDate = normalizeScheduleDate(input.scheduledDate);

  if (scheduledDate instanceof Error) {
    return scheduledDate;
  }

  // Boleh kosong: jadwal tanpa tugas tetap bisa diubah judul/tanggal/targetnya.
  // Penolakan "diisi tapi jadwalnya belum punya tugas" ditangani pemanggil,
  // yang punya akses ke schedule.tasks.
  const assignedWorkerId = normalizeOptionalText(input.assignedWorkerId);

  const target = normalizeManualTarget({
    customTargetNote: input.customTargetNote,
    targetTreeIds: input.targetTreeIds,
    targetType: input.targetType,
  });

  if (target instanceof Error) {
    return target;
  }

  const graceDays = normalizeGraceDays(input);

  if (graceDays instanceof Error) {
    return graceDays;
  }

  if (input.dateBasis !== undefined && input.dateBasis !== 'jadwal' && input.dateBasis !== 'realisasi') {
    return new Error('Dasar tanggal jadwal tidak valid.');
  }

  return {
    assignedWorkerId,
    category,
    dateBasis: input.dateBasis,
    graceDays,
    customTargetNote: target.customTargetNote,
    instruction: normalizeOptionalText(input.instruction),
    requiresPhoto: input.requiresPhoto ?? false,
    scheduledDate,
    targetTreeIds: target.targetTreeIds,
    targetType: target.targetType,
    title,
  };
}

function mapCareSchedule(row: CareScheduleRow): CareSchedule {
  return {
    category: row.category,
    createdAt: row.created_at,
    createdBy: row.created_by,
    customTargetNote: row.custom_target_note,
    farmId: row.farm_id,
    id: row.id,
    instruction: row.instruction,
    isCancelled: row.is_cancelled ?? false,
    parentScheduleId: row.parent_schedule_id ?? null,
    missedAt: row.missed_at ?? null,
    graceDays: row.grace_days ?? null,
    dateBasis: row.date_basis ?? 'jadwal',
    repeatEveryDays: row.repeat_every_days ?? null,
    requiresPhoto: row.requires_photo ?? false,
    scheduledDate: row.scheduled_date,
    seriesId: row.series_id ?? null,
    cancelledAt: row.cancelled_at,
    cancelledBy: row.cancelled_by,
    cancelReason: row.cancel_reason,
    targetTreeId: row.target_tree_id,
    targetType: row.target_type,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

function mapCareTask(row: CareTaskRow): CareTask {
  return {
    assignedBy: row.assigned_by,
    assignedTo: row.assigned_to,
    careScheduleId: row.care_schedule_id,
    category: row.category,
    createdAt: row.created_at,
    customTargetNote: row.custom_target_note,
    dueDate: row.due_date,
    missedAt: row.missed_at ?? null,
    farmId: row.farm_id,
    id: row.id,
    instruction: row.instruction,
    requiresPhoto: row.requires_photo ?? false,
    status: row.status,
    targetTreeId: row.target_tree_id,
    targetType: row.target_type,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isMissingSessionError(error: { message?: string; name?: string }): boolean {
  return (
    error.name === 'AuthSessionMissingError' ||
    error.message?.toLowerCase().includes('auth session missing') === true
  );
}
