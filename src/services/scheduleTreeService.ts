// Pembaca tabel jembatan care_schedule_trees (migrasi 057).
//
// SATU-SATUNYA tempat daftar pohon sebuah jadwal dibaca. Sebelum modul ini,
// setiap layar membaca kolom bayangan target_tree_id dan menampilkannya sebagai
// teks 'Pohon terpilih' -- jadwal tiga pohon dan jadwal satu pohon terbaca
// sama persis, termasuk di layar tugas pekerja.
//
// DUA KUERI, BUKAN N. Layar daftar jadwal dan daftar tugas merender puluhan
// kartu sekaligus; membaca jembatan per kartu berarti puluhan request untuk
// satu layar. Di sini seluruh id dikumpulkan dulu, dibaca sekali per batch,
// lalu dikelompokkan di memori.
//
// Modul ini TIDAK menulis apa pun. Penulisan jembatan ada di
// create_manual_schedule (RPC) dan updateCareSchedule (careScheduleService).

import { supabase } from '../lib/supabase';
import type { ServiceResult, UUID } from '../types/domain';
import { fail, ok } from '../utils/serviceResult';

// Batas id per .in(), sepadan dengan SCHEDULE_TASK_BATCH_SIZE di
// careScheduleService: PostgREST menaruh seluruh daftar id di query string, dan
// satu .in() dengan ratusan uuid membuat URL melewati batas panjang server.
const TREE_TARGET_BATCH_SIZE = 100;

// Satu permintaan resolusi.
//
// `key` sengaja terpisah dari `scheduleId`: layar jadwal mengelompokkan hasil
// menurut id jadwal, sedangkan layar tugas menurut id TUGAS -- dua tugas dari
// jadwal yang sama berbagi daftar pohon yang sama, dan pemanggil tidak perlu
// tahu itu untuk memakai hasilnya.
export type TreeTargetRequest = {
  key: string;
  scheduleId: UUID | null | undefined;
  // Kolom bayangan. Dipakai HANYA kalau jadwalnya tidak punya baris jembatan
  // sama sekali -- jadwal lama yang luput backfill. Bukan pelengkap: kalau
  // jembatannya berisi, bayangan diabaikan sepenuhnya.
  fallbackTreeId: UUID | null | undefined;
};

export type TreeTargetResolution = {
  treeIds: UUID[];
  treeCodes: string[];
};

type ScheduleTreeRow = {
  schedule_id: string;
  tree_id: string;
};

type TreePositionRow = {
  id: string;
  tree_code: string | null;
  row_position: number | null;
  column_position: string | null;
};

// Menyelesaikan daftar pohon untuk sekumpulan jadwal atau tugas sekaligus.
//
// Hasilnya dipetakan menurut `key`. Key yang tidak punya pohon sama sekali
// TIDAK muncul di peta -- pemanggil membedakan "tidak punya pohon" dari "belum
// dimuat" lewat ada-tidaknya kunci itu.
//
// GAGAL DENGAN LEMBUT. Kalau kueri jembatan atau kueri pohon gagal, yang
// dikembalikan adalah galat, dan pemanggil bebas mengabaikannya lalu jatuh
// balik ke bayangan -- daftar jadwal tidak boleh gagal total hanya karena
// kode pohonnya tidak bisa dibaca.
export async function resolveTreeTargetCodes(
  requests: TreeTargetRequest[]
): Promise<ServiceResult<Record<string, TreeTargetResolution>>> {
  const scheduleIds = unique(
    requests
      .map((request) => request.scheduleId)
      .filter((scheduleId): scheduleId is UUID => Boolean(scheduleId))
  );

  const treeIdsBySchedule = new Map<string, string[]>();

  if (scheduleIds.length > 0) {
    const bridgeResult = await readBridgeRows(scheduleIds);

    if (bridgeResult.error) {
      return fail(bridgeResult.error);
    }

    for (const row of bridgeResult.data) {
      const existing = treeIdsBySchedule.get(row.schedule_id);

      if (existing) {
        existing.push(row.tree_id);
      } else {
        treeIdsBySchedule.set(row.schedule_id, [row.tree_id]);
      }
    }
  }

  // Daftar mentah per key: jembatan kalau ada, bayangan kalau jembatannya
  // kosong. Belum terurut dan belum punya kode -- itu langkah berikutnya.
  const rawIdsByKey = new Map<string, string[]>();

  for (const request of requests) {
    const fromBridge = request.scheduleId ? treeIdsBySchedule.get(request.scheduleId) : undefined;

    if (fromBridge && fromBridge.length > 0) {
      rawIdsByKey.set(request.key, fromBridge);
      continue;
    }

    if (request.fallbackTreeId) {
      rawIdsByKey.set(request.key, [request.fallbackTreeId]);
    }
  }

  const neededTreeIds = unique(Array.from(rawIdsByKey.values()).flat());

  if (neededTreeIds.length === 0) {
    return ok({});
  }

  const treesResult = await readTreePositions(neededTreeIds);

  if (treesResult.error) {
    return fail(treesResult.error);
  }

  const treeById = new Map(treesResult.data.map((row) => [row.id, row]));
  const resolved: Record<string, TreeTargetResolution> = {};

  for (const [key, ids] of rawIdsByKey) {
    // Pohon yang barisnya tidak terbaca dibuang, bukan ditampilkan sebagai
    // kode kosong. RLS trees memberi seluruh anggota kebun aktif akses baca,
    // jadi ini praktis hanya terjadi kalau pohonnya sudah tidak ada.
    const rows = ids
      .map((id) => treeById.get(id))
      .filter((row): row is TreePositionRow => Boolean(row))
      .sort(compareTreePosition);

    if (rows.length === 0) {
      continue;
    }

    resolved[key] = {
      treeIds: rows.map((row) => row.id),
      treeCodes: rows.map((row) => row.tree_code ?? '—'),
    };
  }

  return ok(resolved);
}

// Urutan yang SAMA dengan filter_trees_with_active_planting (migrasi 057):
// row_position lalu column_position, bukan urutan teks tree_code.
//
// Bukan kerapian. Urutan teks menaruh '10-A' sebelum '2-A', dan urutan inilah
// yang menentukan pohon mana yang jadi kolom bayangan -- kalau sisi aplikasi
// dan sisi database mengurutkan berbeda, keduanya akan memilih pohon yang
// berbeda untuk jadwal yang sama.
export function compareTreePosition(
  left: { id: string; row_position: number | null; column_position: string | null },
  right: { id: string; row_position: number | null; column_position: string | null }
): number {
  const rowDiff = (left.row_position ?? Number.MAX_SAFE_INTEGER) - (right.row_position ?? Number.MAX_SAFE_INTEGER);

  if (rowDiff !== 0) {
    return rowDiff;
  }

  const columnDiff = (left.column_position ?? '').localeCompare(right.column_position ?? '');

  if (columnDiff !== 0) {
    return columnDiff;
  }

  return left.id.localeCompare(right.id);
}

async function readBridgeRows(scheduleIds: string[]): Promise<ServiceResult<ScheduleTreeRow[]>> {
  const results = await Promise.all(
    chunk(scheduleIds).map((batch) =>
      supabase
        .from('care_schedule_trees')
        .select('schedule_id, tree_id')
        .in('schedule_id', batch)
        .returns<ScheduleTreeRow[]>()
    )
  );

  const failed = results.find((result) => result.error);

  if (failed?.error) {
    return fail(failed.error, 'Gagal memuat daftar pohon jadwal.');
  }

  return ok(results.flatMap((result) => result.data ?? []));
}

async function readTreePositions(treeIds: string[]): Promise<ServiceResult<TreePositionRow[]>> {
  const results = await Promise.all(
    chunk(treeIds).map((batch) =>
      supabase
        .from('trees')
        .select('id, tree_code, row_position, column_position')
        .in('id', batch)
        .returns<TreePositionRow[]>()
    )
  );

  const failed = results.find((result) => result.error);

  if (failed?.error) {
    return fail(failed.error, 'Gagal memuat kode pohon.');
  }

  return ok(results.flatMap((result) => result.data ?? []));
}

function chunk(values: string[]): string[][] {
  const batches: string[][] = [];

  for (let index = 0; index < values.length; index += TREE_TARGET_BATCH_SIZE) {
    batches.push(values.slice(index, index + TREE_TARGET_BATCH_SIZE));
  }

  return batches;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
