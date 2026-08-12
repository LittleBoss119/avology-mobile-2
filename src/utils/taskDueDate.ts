import type { CareSchedule, CareScheduleDetail, CareTask, TaskStatus } from '../types/domain';

// Tanggal "hari ini" milik aplikasi, sumber tunggal untuk semua todayIso di
// file ini dan pemanggilnya. SENGAJA dipatok ke WIB (UTC+7), bukan zona waktu
// perangkat.
//
// Alasannya ada di database: trigger rantai jadwal berulang (migration 041)
// menghitung tanggal jadwal penerus dengan
// `(new.performed_at at time zone 'Asia/Jakarta')::date`. Kalau aplikasi
// mengklasifikasi "terlambat / hari ini" memakai zona perangkat, perangkat di
// luar WIB akan menilai tanggal buatan server itu dengan penggaris berbeda —
// jadwal yang menurut server jatuh tempo hari ini bisa tampil "terlambat", dan
// jadwal yang baru saja dibuat rantai bisa tampil sudah lewat.
//
// Offsetnya dihitung manual, bukan lewat Intl/timeZone: Hermes tidak menjamin
// data zona waktu IANA tersedia di semua build. Aman dipatok karena WIB tidak
// pernah memakai DST dan sudah tetap di UTC+7 sejak 1964 — nilai yang sama
// dengan yang dipakai Postgres untuk 'Asia/Jakarta' pada tanggal masa kini.
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

// Inti konversi WIB: satu-satunya tempat WIB_OFFSET_MS benar-benar diterapkan.
// getTodayIsoDate dan toWibIsoDate keduanya lewat sini supaya tidak ada jalur
// kedua yang bisa bergeser sendiri.
function wibIsoDateFromDate(date: Date): string {
  const wibDate = new Date(date.getTime() + WIB_OFFSET_MS);
  const year = wibDate.getUTCFullYear();
  const month = `${wibDate.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${wibDate.getUTCDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function getTodayIsoDate(now: Date = new Date()): string {
  return wibIsoDateFromDate(now);
}

// Timestamptz dari database (mis. '2026-08-10T04:12:00+00:00') menjadi tanggal
// WIB 'YYYY-MM-DD', bentuk yang dimengerti dayDifference dan seluruh util di
// file ini. Kolom seperti operational_reports.responded_at adalah timestamptz,
// sedangkan semua klasifikasi waktu di sini bekerja pada tanggal murni — ini
// jembatannya, dan sengaja tinggal di file ini supaya layar tidak pernah
// menghitung offset WIB sendiri.
//
// null untuk nilai kosong maupun nilai yang tidak bisa diurai: pemanggil harus
// memilih untuk TIDAK menampilkan apa pun, bukan menampilkan tanggal karangan.
export function toWibIsoDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return wibIsoDateFromDate(parsed);
}

// Dua sistem klasifikasi waktu hidup berdampingan di file ini. Keduanya
// display-layer & pure: STRING-COMPARE 'YYYY-MM-DD' terhadap tanggal LOKAL
// hari ini (todayIso), bukan daysSinceLocal (timestamptz).
//
// (1) taskDueMarker / scheduleDueMarker → TaskDueMarker ('overdue' | 'due_today').
//     Penanda jatuh tempo RINGKAS untuk badge kartu (RF-11b). Hanya menandai
//     tugas 'pending'; completed/postponed/masa depan → null (tak ditandai).
//
// (2) taskTimeBucket / scheduleTimeBucket → TimeBucket
//     ('overdue' | 'today' | 'upcoming' | 'inactive'). Ember waktu EKSHAUSTIF
//     untuk pengelompokan/segmentasi list: setiap item selalu jatuh ke satu
//     ember. Beda dari (1): masa depan punya nilai eksplisit 'upcoming', dan
//     'postponed' TIDAK 'inactive' (tetap dikelompokkan menurut tanggalnya);
//     'inactive' = jadwal dibatalkan atau tugas 'completed'.

// RF-11b: klasifikasi jatuh tempo tugas untuk penanda in-app (display-layer, pure).
// NON-PREDIKTIF: tidak menghitung perkiraan apa pun dan tidak membaca sumber
// rencana di atas tugas — murni dari care_tasks.due_date + status yang sudah
// ada. due_date adalah date murni, jadi cukup STRING-COMPARE 'YYYY-MM-DD'
// terhadap tanggal LOKAL hari ini (todayIso). Bukan daysSinceLocal (itu timestamptz).
export type TaskDueMarker = 'overdue' | 'due_today';

export function taskDueMarker(
  task: { status: TaskStatus; dueDate: string; scheduleIsCancelled?: boolean },
  todayIso: string
): TaskDueMarker | null {
  // Tugas dari jadwal yang dibatalkan tetap tampil di list, tapi tidak ditandai.
  if (task.scheduleIsCancelled === true) {
    return null;
  }

  // Hanya tugas 'pending' yang bisa terlambat/jatuh tempo. completed/postponed → null.
  if (task.status !== 'pending') {
    return null;
  }

  if (task.dueDate < todayIso) {
    return 'overdue';
  }

  if (task.dueDate === todayIso) {
    return 'due_today';
  }

  return null;
}

// RF-11b (level jadwal): satu jadwal berisi banyak task, masing-masing punya
// due_date + status sendiri. Definisi "perhalus": jadwal ditandai "Terlambat"
// jika ADA task pending yang due_date-nya sudah lewat; "Hari ini" jika ada task
// pending due hari ini (dan tidak ada yang sudah terlambat — terlambat menang).
// Jadwal dibatalkan → tidak ditandai. Memakai due_date PER-TASK (bukan
// scheduledDate jadwal), lewat taskDueMarker.
export function scheduleDueMarker(
  schedule: CareSchedule,
  detail: CareScheduleDetail | undefined,
  todayIso: string
): TaskDueMarker | null {
  if (schedule.isCancelled || detail?.isCancelled) {
    return null;
  }

  if (!detail) {
    return null;
  }

  let hasDueToday = false;

  for (const task of detail.tasks) {
    const marker = taskDueMarker(task, todayIso);

    if (marker === 'overdue') {
      return 'overdue';
    }

    if (marker === 'due_today') {
      hasDueToday = true;
    }
  }

  return hasDueToday ? 'due_today' : null;
}

// Sistem (2): ember waktu ekshaustif. Lihat komentar kepala file untuk beda
// dengan sistem (1). scheduleIsCancelled diterima sebagai argumen terpisah
// (bukan di dalam `task`) supaya pemanggil bebas menyuplai status pembatalan
// jadwal induk dari sumber mana pun.
export type TimeBucket = 'overdue' | 'today' | 'upcoming' | 'inactive';

export function taskTimeBucket(
  task: { status: TaskStatus; dueDate: string },
  todayIso: string,
  scheduleIsCancelled: boolean
): TimeBucket {
  if (scheduleIsCancelled === true) {
    return 'inactive';
  }

  if (task.status === 'completed') {
    return 'inactive';
  }

  // Catatan: 'postponed' sengaja lolos ke sini — tetap dikelompokkan menurut tanggalnya.
  if (task.dueDate < todayIso) {
    return 'overdue';
  }

  if (task.dueDate === todayIso) {
    return 'today';
  }

  return 'upcoming';
}

// Deskriptor pill tenggat (display-layer, pure). ADITIF — tidak mengubah
// taskDueMarker / scheduleDueMarker / bucket. Sama seperti util lain: bandingkan
// tanggal saja (STRING-COMPARE 'YYYY-MM-DD' terhadap todayIso lokal), abaikan jam.
export type DueDatePillTone = 'warning' | 'success' | 'neutral';
export type DueDatePill = { tone: DueDatePillTone; label: string };

const MONTHS_ID_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

// Alasannya sama dengan MONTHS_ID_SHORT: jangan bergantung pada data locale
// Intl yang tidak dijamin lengkap di semua build Hermes. Indeks mengikuti
// Date.getDay() — 0 = Minggu.
const DAYS_ID_LONG = [
  'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu',
];

function parseIsoDateParts(iso: string): { day: number; month: number; year: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return null;
  }

  const [year, month, day] = iso.split('-').map(Number);
  return { day, month, year };
}

// "06 Jun"
function formatShortDate(iso: string): string {
  const parts = parseIsoDateParts(iso);

  if (!parts) {
    return iso;
  }

  return `${`${parts.day}`.padStart(2, '0')} ${MONTHS_ID_SHORT[parts.month - 1]}`;
}

// "27 Jun 2026"
//
// Diekspor untuk menggantikan helper `formatDate` lokal yang dulu disalin di
// layar jadwal owner dan layar tugas pekerja. Kedua salinan itu memakai
// `new Date('YYYY-MM-DD')`, yang menurut spesifikasi diurai sebagai UTC —
// di zona waktu negatif tanggalnya mundur sehari, padahal seluruh klasifikasi
// di file ini sudah dipatok WIB lewat getTodayIsoDate(). Versi ini tidak
// menyentuh Date sama sekali: murni pecah string, jadi tidak bisa bergeser.
export function formatFullDate(iso: string): string {
  const parts = parseIsoDateParts(iso);

  if (!parts) {
    return iso;
  }

  return `${`${parts.day}`.padStart(2, '0')} ${MONTHS_ID_SHORT[parts.month - 1]} ${parts.year}`;
}

// Geser tanggal ISO sejumlah hari (boleh negatif). Diangkat dari layar jadwal
// owner. Berbeda dari versi lama yang mengurai lewat `new Date(iso + 'T00:00:00')`,
// di sini tanggalnya dibangun dari komponen — sama seperti dayDifference — jadi
// tidak ada jalur penguraian string tanggal kedua di basis kode ini.
export function addDaysToIsoDate(iso: string, days: number): string {
  const parts = parseIsoDateParts(iso);

  if (!parts) {
    return iso;
  }

  const date = new Date(parts.year, parts.month - 1, parts.day);
  date.setDate(date.getDate() + days);

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

// Judul section agenda per tanggal, dipakai bersama layar jadwal owner dan
// layar tugas pekerja: "Hari ini · 27 Jun 2026", "Besok · 28 Jun 2026", selain
// itu "Senin, 29 Jun 2026".
//
// Nama harinya diambil dari DAYS_ID_LONG, bukan toLocaleDateString dengan
// { weekday: 'long' } seperti versi lama di layar owner. Hasilnya identik pada
// build yang datanya lengkap, dan tidak lagi bisa jatuh ke bahasa Inggris pada
// build yang tidak lengkap.
export function formatAgendaSectionTitle(iso: string, todayIso: string): string {
  if (iso === todayIso) {
    return `Hari ini · ${formatFullDate(iso)}`;
  }

  if (iso === addDaysToIsoDate(todayIso, 1)) {
    return `Besok · ${formatFullDate(iso)}`;
  }

  const parts = parseIsoDateParts(iso);

  if (!parts) {
    return iso;
  }

  const weekday = DAYS_ID_LONG[new Date(parts.year, parts.month - 1, parts.day).getDay()];

  return `${weekday}, ${formatFullDate(iso)}`;
}

// Selisih hari bulat dari fromIso ke toIso pada tengah malam lokal.
// Diekspor supaya layar agenda memakai perhitungan yang sama dengan dueDatePill,
// bukan salinan aritmetika tanggalnya sendiri.
export function dayDifference(fromIso: string, toIso: string): number {
  const from = parseIsoDateParts(fromIso);
  const to = parseIsoDateParts(toIso);

  if (!from || !to) {
    return 0;
  }

  const fromMs = new Date(from.year, from.month - 1, from.day).getTime();
  const toMs = new Date(to.year, to.month - 1, to.day).getTime();
  return Math.round((toMs - fromMs) / 86_400_000);
}

// Varian task: pakai dueDate + status tugas.
export function dueDatePill(
  task: { status: TaskStatus; dueDate: string },
  todayIso: string
): DueDatePill {
  const isActive = task.status === 'pending' || task.status === 'postponed';

  if (isActive && task.dueDate < todayIso) {
    const overdueDays = dayDifference(task.dueDate, todayIso);
    return {
      tone: 'warning',
      label: `Terlambat ${overdueDays} hari · ${formatShortDate(task.dueDate)}`,
    };
  }

  if (isActive && task.dueDate === todayIso) {
    return {
      tone: 'success',
      label: `Jatuh tempo hari ini · ${formatShortDate(task.dueDate)}`,
    };
  }

  return {
    tone: 'neutral',
    label: formatFullDate(task.dueDate),
  };
}

// Varian jadwal: pakai scheduledDate + status turunan dari tugas-tugasnya.
// Jadwal dianggap "selesai" (→ neutral) hanya jika ada tugas dan semuanya
// completed; selain itu diperlakukan aktif (pending/postponed sama saja untuk
// pill). Pembatalan jadwal ditangani oleh pemanggil, bukan di sini.
export function scheduleDueDatePill(
  schedule: { scheduledDate: string },
  tasks: { status: TaskStatus }[],
  todayIso: string
): DueDatePill {
  const derivedStatus: TaskStatus =
    tasks.length > 0 && tasks.every((task) => task.status === 'completed')
      ? 'completed'
      : 'pending';

  return dueDatePill({ status: derivedStatus, dueDate: schedule.scheduledDate }, todayIso);
}

// Agregasi ember waktu level-jadwal, meniru pola prioritas scheduleDueMarker
// (overdue menang, lalu today, lalu upcoming, selain itu inactive).
export function scheduleTimeBucket(
  schedule: CareSchedule,
  tasks: CareTask[],
  todayIso: string
): TimeBucket {
  if (schedule.isCancelled === true) {
    return 'inactive';
  }

  // Sejak migration 041 sebuah jadwal boleh punya NOL tugas: penerus rantai
  // dibuat tanpa tugas kalau pekerjanya sudah keluar dari kebun. Tanpa cabang
  // ini, loop di bawah tidak pernah menyetel flag apa pun dan jadwal jatuh ke
  // 'inactive' — hilang dari chip Terlambat/Hari ini/Mendatang dan hanya muncul
  // di chip Semua, padahal justru jadwal inilah yang paling butuh perhatian
  // owner. Klasifikasinya memakai scheduledDate jadwal itu sendiri, satu-satunya
  // tanggal yang tersedia saat belum ada tugas.
  if (tasks.length === 0) {
    if (schedule.scheduledDate < todayIso) {
      return 'overdue';
    }

    if (schedule.scheduledDate === todayIso) {
      return 'today';
    }

    return 'upcoming';
  }

  let hasToday = false;
  let hasUpcoming = false;

  for (const task of tasks) {
    const bucket = taskTimeBucket(task, todayIso, false);

    if (bucket === 'overdue') {
      return 'overdue';
    }

    if (bucket === 'today') {
      hasToday = true;
    } else if (bucket === 'upcoming') {
      hasUpcoming = true;
    }
  }

  if (hasToday) {
    return 'today';
  }

  if (hasUpcoming) {
    return 'upcoming';
  }

  return 'inactive';
}
