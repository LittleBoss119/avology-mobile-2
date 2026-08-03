import type {
  OperationalReportResolution,
  OperationalReportStatus,
} from '../types/domain';
import type { IconName } from './icons';

// Tabel keputusan owner atas sebuah laporan. Fungsi murni, tanpa React:
// masuk keadaan laporan, keluar daftar aksi yang SAH. Layar hanya me-render
// hasilnya — tidak ada lagi rantai if bercabang status di dalam komponen.
//
// Aturan di sini adalah cermin guard RPC (migration 034). Yang tidak muncul
// di daftar berarti memang akan ditolak database, jadi tidak pernah dirender
// sebagai tombol mati.

export type OwnerReportActionKey =
  | 'create_task'
  | 'self_handled'
  | 'already_ok'
  | 'reject'
  | 'close';

export type OwnerReportActionConfirm = {
  title: string;
  // Kalimat konsekuensi: apa yang berubah setelah aksi ini dijalankan.
  consequence: string;
  confirmLabel: string;
  // Pesan snackbar setelah aksi berhasil.
  successMessage: string;
  noteLabel: string;
  notePlaceholder: string;
  noteRequired: boolean;
};

export type OwnerReportAction = {
  key: OwnerReportActionKey;
  title: string;
  description: string;
  icon: IconName;
  emphasis: 'default' | 'primary' | 'danger';
  // null = aksi tidak dikonfirmasi lewat sheet, tapi pindah ke rute penuh
  // (create_task -> /owner/reports/{id}/task).
  confirm: OwnerReportActionConfirm | null;
};

const CREATE_TASK_NEW: OwnerReportAction = {
  confirm: null,
  description: 'Pekerja dapat tugas baru',
  emphasis: 'default',
  icon: 'list-check',
  key: 'create_task',
  title: 'Buat tugas untuk pekerja',
};

const CREATE_TASK_AGAIN: OwnerReportAction = {
  confirm: null,
  description: 'Pekerja dapat tugas baru',
  emphasis: 'default',
  icon: 'list-check',
  key: 'create_task',
  title: 'Buat tugas lagi',
};

const CREATE_TASK_ESCALATE: OwnerReportAction = {
  confirm: null,
  description: 'Eskalasi ke pekerja',
  emphasis: 'default',
  icon: 'list-check',
  key: 'create_task',
  title: 'Buat tugas untuk pekerja',
};

const SELF_HANDLED: OwnerReportAction = {
  confirm: {
    confirmLabel: 'Simpan keputusan',
    consequence: 'Laporan jadi Diproses dan pekerja tidak menerima tugas.',
    noteLabel: 'Apa yang kamu lakukan?',
    notePlaceholder: 'Contoh: Selang sudah saya ganti sore ini',
    noteRequired: true,
    successMessage: 'Laporan ditandai diproses.',
    title: 'Saya urus sendiri',
  },
  description: 'Diproses tanpa tugas ke pekerja',
  emphasis: 'default',
  icon: 'user',
  key: 'self_handled',
  title: 'Saya urus sendiri',
};

const ALREADY_OK: OwnerReportAction = {
  confirm: {
    confirmLabel: 'Tandai sudah beres',
    consequence: 'Laporan langsung ditutup tanpa tugas untuk pekerja.',
    noteLabel: 'Catatan (opsional)',
    notePlaceholder: 'Contoh: Kondisi sudah normal saat dicek',
    noteRequired: false,
    successMessage: 'Laporan ditandai selesai.',
    title: 'Tandai sudah beres',
  },
  description: 'Langsung tutup laporan ini',
  emphasis: 'default',
  icon: 'check',
  key: 'already_ok',
  title: 'Tandai sudah beres',
};

const REJECT: OwnerReportAction = {
  confirm: {
    confirmLabel: 'Tolak laporan',
    consequence: 'Laporan ditutup sebagai ditolak. Alasan ini dibaca pekerja yang melapor.',
    noteLabel: 'Alasan penolakan',
    notePlaceholder: 'Contoh: Kondisi ini sudah ditangani minggu lalu',
    noteRequired: true,
    successMessage: 'Laporan ditolak.',
    title: 'Tolak laporan',
  },
  description: 'Perlu alasan yang dibaca pekerja',
  emphasis: 'danger',
  icon: 'x',
  key: 'reject',
  title: 'Tolak laporan',
};

const CLOSE: OwnerReportAction = {
  confirm: {
    confirmLabel: 'Tandai selesai',
    consequence: 'Laporan ditutup. Keputusan sebelumnya tetap tercatat.',
    noteLabel: 'Catatan penutup (opsional)',
    notePlaceholder: 'Contoh: Hasil kerja sudah saya cek di lapangan',
    noteRequired: false,
    successMessage: 'Laporan ditandai selesai.',
    title: 'Tandai laporan selesai',
  },
  description: 'Tutup laporan ini',
  emphasis: 'primary',
  icon: 'check',
  key: 'close',
  title: 'Tandai laporan selesai',
};

export function getOwnerReportActions(input: {
  status: OperationalReportStatus;
  resolution: OperationalReportResolution | null;
  // Ada care_task berstatus pending atau postponed.
  hasOpenTask: boolean;
}): OwnerReportAction[] {
  const { hasOpenTask, resolution, status } = input;

  if (status === 'new') {
    return [CREATE_TASK_NEW, SELF_HANDLED, ALREADY_OK, REJECT];
  }

  if (status === 'in_progress') {
    // Tolak sengaja TIDAK ada di sini: RPC hanya mengizinkan penolakan dari
    // laporan yang belum disentuh sama sekali.
    if (resolution === 'task') {
      return hasOpenTask ? [CLOSE] : [CLOSE, CREATE_TASK_AGAIN];
    }

    if (resolution === 'self_handled') {
      return hasOpenTask ? [CLOSE] : [CLOSE, CREATE_TASK_ESCALATE];
    }

    // Tidak tercapai selama constraint resolution_status_check aktif.
    return [];
  }

  // resolved / rejected: laporan sudah tertutup, tidak ada aksi lanjutan.
  return [];
}

export function formatOwnerReportResolution(input: {
  status: OperationalReportStatus;
  resolution: OperationalReportResolution | null;
}): string {
  if (input.resolution === 'task') {
    return 'Buat tugas untuk pekerja';
  }

  if (input.resolution === 'self_handled') {
    return 'Saya urus sendiri';
  }

  if (input.resolution === 'already_ok') {
    return 'Sudah beres';
  }

  return input.status === 'rejected' ? 'Laporan ditolak' : 'Belum ada keputusan';
}
