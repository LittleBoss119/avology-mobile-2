import type { CareSchedule, CareScheduleDetail, TaskStatus } from '../types/domain';

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
