import type { CareSchedule, CareScheduleDetail, CareTask, TaskStatus } from '../types/domain';

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
// NON-PREDIKTIF & bukan level SOP — murni dari care_tasks.due_date + status yang
// sudah ada. due_date adalah date murni, jadi cukup STRING-COMPARE 'YYYY-MM-DD'
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
function formatFullDate(iso: string): string {
  const parts = parseIsoDateParts(iso);

  if (!parts) {
    return iso;
  }

  return `${`${parts.day}`.padStart(2, '0')} ${MONTHS_ID_SHORT[parts.month - 1]} ${parts.year}`;
}

// Selisih hari bulat dari fromIso ke toIso pada tengah malam lokal.
function dayDifference(fromIso: string, toIso: string): number {
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
