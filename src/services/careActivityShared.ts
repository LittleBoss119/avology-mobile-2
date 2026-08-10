// Bentuk baris `care_activities` dan pemetaannya ke domain — SATU sumber
// kebenaran untuk careActivityService dan careTaskService.
//
// Sebelumnya ketiga hal di bawah (daftar kolom, tipe baris, mapper) disalin
// PERSIS di dua file itu. Duplikat semacam itu berbahaya justru karena tidak
// pernah memicu error: menambah kolom di satu file dan lupa di file lain tetap
// lolos typecheck, lalu kolomnya diam-diam hilang di separuh layar saat
// runtime. Migrasi 043 menambah tiga kolom sekaligus, jadi duplikatnya
// disatukan lebih dulu sebelum kolomnya ditambahkan.
//
// Modul ini sengaja hanya berisi bentuk data — tidak ada query, tidak ada
// aturan akses, tidak mengimpor `supabase`. Dengan begitu kedua service tetap
// memegang jalur query-nya masing-masing dan tidak ada risiko impor melingkar.

import { isSatuanBahan, type SatuanBahan } from '../constants/satuanBahan';
import type { ActivityStatus, CareActivity, CareActivityOrigin, CareCategory } from '../types/domain';

export const CARE_ACTIVITY_SELECT =
  'id, farm_id, care_task_id, performed_by, status, note, performed_at, asal, category, produk, produk_jumlah, produk_satuan, edited_at';

export type CareActivityRow = {
  id: string;
  farm_id: string;
  care_task_id: string | null;
  performed_by: string;
  status: ActivityStatus;
  note: string | null;
  performed_at: string;
  asal: CareActivityOrigin;
  category: CareCategory | null;
  produk: string | null;
  // numeric(10,2) di database. PostgREST mengirim numeric sebagai STRING, bukan
  // number, supaya presisinya tidak rusak oleh float JavaScript. Tipenya ditulis
  // sebagai union apa adanya supaya tidak ada yang tergoda memakainya langsung
  // sebagai angka — konversinya dilakukan mapper di bawah.
  produk_jumlah: string | number | null;
  produk_satuan: string | null;
  edited_at: string | null;
};

export function mapCareActivity(row: CareActivityRow): CareActivity {
  return {
    asal: row.asal,
    careTaskId: row.care_task_id,
    category: row.category,
    editedAt: row.edited_at,
    farmId: row.farm_id,
    id: row.id,
    note: row.note,
    performedAt: row.performed_at,
    performedBy: row.performed_by,
    produk: row.produk,
    produkJumlah: toNullableNumber(row.produk_jumlah),
    produkSatuan: toNullableSatuanBahan(row.produk_satuan),
    status: row.status,
  };
}

// Menerima string ('2.50') maupun number, dan menolak apa pun yang bukan angka
// terhingga. Nilai yang tidak bisa dibaca dijadikan null, bukan NaN — NaN akan
// lolos sampai ke layar dan tampil sebagai teks aneh, bukan error yang kelihatan.
function toNullableNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

// Satuan di luar daftar yang dikenal klien diperlakukan sebagai null. Database
// sudah menjaganya lewat constraint, jadi ini hanya jaring pengaman kalau
// daftar di kedua sisi sempat berbeda versi.
function toNullableSatuanBahan(value: string | null | undefined): SatuanBahan | null {
  return isSatuanBahan(value) ? value : null;
}
