// Bentuk baris `tree_plantings` dan pemetaannya ke domain — SATU sumber
// kebenaran untuk treeService dan growthPhaseService.
//
// Mengikuti pola careActivityShared.ts, dan untuk alasan yang sama: daftar
// kolom, tipe baris, dan mapper yang disalin di dua tempat tidak pernah memicu
// error saat salah satunya ketinggalan. Menambah kolom di satu file dan lupa di
// file lain tetap lolos typecheck, lalu kolomnya diam-diam hilang di separuh
// layar saat runtime. Migrasi 055 memperkenalkan tabel ini ke DUA service
// sekaligus, jadi bentuknya disatukan sejak awal alih-alih disalin dulu.
//
// Modul ini sengaja hanya berisi bentuk data — tidak ada query, tidak ada
// aturan akses, tidak mengimpor `supabase`.

import type { TreePlanting, TreePlantingEndReason } from '../types/domain';

export const TREE_PLANTING_COLUMNS =
  'id, tree_id, farm_id, cycle_no, variety, planted_at, ended_at, end_reason, ended_by, created_by, created_at';

// Daftar kolom pohon berikut siklus tanamnya sebagai embedded resource.
//
// PENTING: select ini TIDAK membatasi ke siklus aktif. Yang membatasinya adalah
// filter `.is('tree_plantings.ended_at', null)` yang WAJIB disertakan setiap
// query yang memakainya. PostgREST menyaring baris embedded, bukan induknya,
// sehingga pohon yang posisinya sedang kosong tetap terbawa dengan array kosong
// — dan itu memang yang diinginkan: posisi kosong tetap harus tampil.
// current_growth_phase_since (migrasi 066) ikut di sini, BUKAN di select
// terpisah: ia kolom turunan yang database jamin selalu sejalan dengan
// current_growth_phase — keduanya ditulis recalculate_tree_current_growth_phase
// dari BARIS catatan yang sama. Mengambilnya terpisah dari pasangannya akan
// membuka celah untuk membacanya pada waktu yang berbeda.
export const TREE_SELECT_WITH_ACTIVE_PLANTING =
  `id, farm_id, tree_code, row_position, column_position, current_condition, current_growth_phase, current_growth_phase_since, is_archived, created_at, updated_at, tree_plantings(${TREE_PLANTING_COLUMNS})`;

export type TreePlantingRow = {
  id: string;
  tree_id: string;
  farm_id: string;
  cycle_no: number;
  variety: string | null;
  planted_at: string | null;
  ended_at: string | null;
  end_reason: string | null;
  ended_by: string | null;
  created_by: string;
  created_at: string;
};

export function mapTreePlanting(row: TreePlantingRow): TreePlanting {
  return {
    createdAt: row.created_at,
    createdBy: row.created_by,
    cycleNo: row.cycle_no,
    endReason: toEndReason(row.end_reason),
    endedAt: row.ended_at,
    endedBy: row.ended_by,
    farmId: row.farm_id,
    id: row.id,
    plantedAt: row.planted_at,
    treeId: row.tree_id,
    variety: row.variety,
  };
}

// Baris embedded sudah tersaring ke `ended_at is null` oleh query, dan database
// menjamin paling banyak satu lewat partial unique index
// tree_plantings_one_active_per_tree. [0] karenanya aman, bukan asumsi.
export function readActivePlanting(
  plantings: TreePlantingRow[] | null | undefined
): TreePlanting | null {
  const active = plantings?.[0];
  return active ? mapTreePlanting(active) : null;
}

// end_reason adalah text ber-CHECK di database, bukan enum. Nilai di luar
// daftar dijatuhkan ke null alih-alih membuat layar pecah — pola yang sama
// dengan toNullableSatuanBahan (careActivityShared) dan mapper grade panen.
function toEndReason(value: string | null): TreePlantingEndReason | null {
  return value === 'mati' || value === 'dibongkar' || value === 'diganti' ? value : null;
}
