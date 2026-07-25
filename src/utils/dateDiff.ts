// Selisih hari berbasis TANGGAL KALENDER LOKAL perangkat (mis. Asia/Jakarta),
// BUKAN selisih jam UTC. Kedua sisi dinormalkan ke tengah malam lokal lalu
// diselisihkan, supaya hasilnya tidak meleset ±1 hari karena komponen jam/tz
// pada nilai timestamptz (mis. recorded_at growth_phase_records).
//
// Mengembalikan null bila input bukan tanggal valid, agar pemanggil bisa
// menampilkan state kosong alih-alih angka NaN.
export function daysSinceLocal(recordedAtIso: string, now: Date = new Date()): number | null {
  const recorded = new Date(recordedAtIso);

  if (Number.isNaN(recorded.getTime())) {
    return null;
  }

  const diffMs = startOfLocalDay(now) - startOfLocalDay(recorded);

  // Asia/Jakarta tanpa DST, jadi batas hari selalu kelipatan penuh 86.400.000 ms;
  // Math.round hanya jaring pengaman terhadap drift milidetik.
  return Math.max(0, Math.round(diffMs / 86_400_000));
}

function startOfLocalDay(date: Date): number {
  // getFullYear/getMonth/getDate memakai komponen tanggal LOKAL perangkat.
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
