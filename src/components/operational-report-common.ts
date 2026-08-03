import type { OperationalReportStatus } from '../types/domain';

// Helper tampilan yang dipakai lebih dari satu layar laporan (daftar + detail
// pekerja). Dipisah supaya tidak ada lagi salinan lokal per file.

export function getReportStatusTone(
  status: OperationalReportStatus
): 'danger' | 'info' | 'success' | 'warning' {
  if (status === 'resolved') {
    return 'success';
  }

  if (status === 'rejected') {
    return 'danger';
  }

  if (status === 'new') {
    return 'warning';
  }

  return 'info';
}

export function formatReportDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatReportDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('id-ID', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
