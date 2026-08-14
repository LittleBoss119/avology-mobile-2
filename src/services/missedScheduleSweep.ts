import { supabase } from '../lib/supabase';
import type { UUID } from '../types/domain';

// Penyapu masa toleransi (migrasi 048).
//
// Avology tidak punya scheduler di sisi server — tidak ada pg_cron, dan itu
// keputusan sadar sejak migrasi 040. Konsekuensinya penandaan "terlewat" harus
// dipicu oleh trafik aplikasi, jadi fungsi ini dipanggil di AWAL setiap
// pengambilan data yang datanya bisa terpengaruh: daftar jadwal owner, daftar
// tugas pekerja, dan kedua dashboard.
//
// Aman dipanggil sesering itu:
//   * RPC-nya memakai pg_try_advisory_xact_lock per kebun, jadi pemanggilan
//     bersamaan tidak menumpuk — yang kalah lock langsung keluar.
//   * Seluruh penulisannya idempoten; sapuan kedua pada keadaan yang sama tidak
//     mengubah satu baris pun.
//   * Penjaga keanggotaan ada di dalam RPC, bukan di sini.
//
// SENGAJA tidak mengembalikan error. Penyapu adalah efek samping dari membaca,
// bukan tujuannya. Kalau ia gagal, yang benar adalah daftar tetap tampil dengan
// data apa adanya — bukan layar error untuk pekerja yang cuma ingin melihat
// tugasnya. Kegagalan yang menetap akan terlihat sebagai jadwal terlewat yang
// tidak kunjung ditandai, dan jejaknya ada di log Postgres.
export async function sweepMissedSchedules(farmId: UUID | null | undefined): Promise<void> {
  if (!farmId) {
    return;
  }

  try {
    await supabase.rpc('sweep_missed_schedules', { p_farm_id: farmId });
  } catch {
    // Ditelan dengan sengaja. Lihat catatan di atas.
  }
}
