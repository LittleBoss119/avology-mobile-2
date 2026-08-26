// Siklus tanam sebagai bahan TAMPILAN: pembatas siklus di riwayat pohon, dan
// keterangan pada posisi yang sedang kosong.
//
// Murni display-layer dan bebas efek samping — tidak mengimpor supabase, tidak
// tahu apa pun soal query. Yang mengambil datanya adalah listTreePlantings.

import type { TreeHistoryItem, TreePlanting } from '../types/domain';
import { formatFullDate, toWibIsoDate } from './taskDueDate';

export type TreeHistoryCycleGroup = {
  planting: TreePlanting;
  // Benar hanya untuk siklus dengan cycle_no TERTINGGI. Sengaja bukan
  // "endedAt === null": pada posisi yang sudah kosong seluruh siklus sudah
  // ditutup, dan kalau ukurannya endedAt maka SEMUA kejadian akan diredupkan
  // sekaligus — peredupan jadi tidak membedakan apa pun. Yang paling baru tetap
  // ditampilkan penuh supaya pembacaan riwayat punya titik jangkar.
  isLatestCycle: boolean;
  items: TreeHistoryItem[];
};

// Menempatkan tiap kejadian riwayat ke siklus tanam yang memuatnya.
//
// PERKIRAAN, bukan fakta tersimpan. tree_history_view (045:241) adalah union
// empat tabel catatan dan tak satu pun punya penanda siklus, sedangkan view itu
// tidak boleh disentuh. Satu-satunya penghubung yang tersisa adalah waktu:
// siklus ke-N memuat kejadian sejak tanggal mulainya sampai SEBELUM tanggal
// mulai siklus berikutnya.
//
// Akibatnya disebut terus terang: kejadian yang tanggalnya dimundurkan melewati
// batas siklus akan jatuh ke siklus yang salah. Diterima karena pembatas ini
// penanda bacaan, bukan angka yang dipakai menghitung apa pun.
//
// Urutannya mengikuti apa yang diterima: getTreeHistory mengirim menurun
// (terbaru dulu), jadi grup pun disusun dari siklus terbaru ke terlama dan isi
// tiap grup dibiarkan pada urutan aslinya.
export function groupTreeHistoryByCycle(
  history: TreeHistoryItem[],
  plantings: TreePlanting[]
): TreeHistoryCycleGroup[] {
  if (plantings.length === 0) {
    return [];
  }

  const ascending = [...plantings].sort((left, right) => left.cycleNo - right.cycleNo);
  const latestCycleNo = ascending[ascending.length - 1].cycleNo;
  const groups = ascending.map((planting) => ({
    planting,
    isLatestCycle: planting.cycleNo === latestCycleNo,
    items: [] as TreeHistoryItem[],
  }));

  for (const item of history) {
    groups[resolveCycleIndex(ascending, item.happenedAt)].items.push(item);
  }

  return groups.reverse();
}

// Siklus TERAKHIR yang sudah ditutup. Dasar keterangan pada posisi kosong.
export function findLastEndedPlanting(plantings: TreePlanting[]): TreePlanting | null {
  const ended = plantings.filter((planting) => planting.endedAt !== null);

  if (ended.length === 0) {
    return null;
  }

  return ended.reduce((latest, planting) => (planting.cycleNo > latest.cycleNo ? planting : latest));
}

// Teks pembatas siklus di riwayat: 'Ditanam ulang · 12 Mar 2023 · Aligator'.
// Siklus pertama berbunyi 'Ditanam' — belum ada yang diulang.
export function formatCycleDividerLabel(planting: TreePlanting): string {
  const parts = [planting.cycleNo <= 1 ? 'Ditanam' : 'Ditanam ulang'];
  const plantedAt = planting.plantedAt ? formatFullDate(planting.plantedAt) : null;

  if (plantedAt) {
    parts.push(plantedAt);
  }

  const variety = planting.variety?.trim();

  if (variety) {
    parts.push(variety);
  }

  return parts.join(' · ');
}

// Kalimat pembuka kotak keterangan pada posisi kosong.
export function formatPlantingEndSummary(planting: TreePlanting | null): string {
  if (!planting || !planting.endedAt) {
    return 'Posisi ini belum ditanami.';
  }

  return `Pohon sebelumnya ${formatEndReasonPhrase(planting.endReason)} pada ${formatFullDate(planting.endedAt)}.`;
}

function formatEndReasonPhrase(endReason: TreePlanting['endReason']): string {
  if (endReason === 'mati') {
    return 'ditandai mati';
  }

  if (endReason === 'dibongkar') {
    return 'dibongkar';
  }

  if (endReason === 'diganti') {
    return 'diganti varietas';
  }

  return 'berakhir';
}

// Indeks siklus (pada daftar menaik) yang memuat sebuah kejadian.
//
// Kejadian yang LEBIH TUA dari siklus pertama tetap masuk siklus pertama.
// Itu bukan kasus mengada-ada: catatan bisa dibuat dengan tanggal mundur, dan
// membuangnya dari tampilan jauh lebih buruk daripada menempatkannya di siklus
// terdekat yang masuk akal.
function resolveCycleIndex(ascending: TreePlanting[], happenedAt: string): number {
  const happenedKey = toWibIsoDate(happenedAt);

  if (!happenedKey) {
    return 0;
  }

  let index = 0;

  for (let candidate = 0; candidate < ascending.length; candidate += 1) {
    const startKey = cycleStartKey(ascending[candidate]);

    if (startKey && startKey <= happenedKey) {
      index = candidate;
    }
  }

  return index;
}

// Awal sebuah siklus. planted_at boleh kosong (RPC start_tree_planting
// menerimanya null), jadi created_at jadi cadangannya — baris siklus itu sendiri
// tidak mungkin lahir sebelum siklusnya dimulai.
function cycleStartKey(planting: TreePlanting): string | null {
  return toWibIsoDate(planting.plantedAt) ?? toWibIsoDate(planting.createdAt);
}
