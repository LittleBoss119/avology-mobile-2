import type { TreeConditionStatus } from '../types/domain';

export const treeConditionStatusLabels: Record<TreeConditionStatus, string> = {
  healthy: 'Sehat',
  needs_attention: 'Perlu Perhatian',
  pest_attacked: 'Terserang Hama',
  disease_indicated: 'Terindikasi Penyakit',
  damaged: 'Rusak',
  dead: 'Mati',
};

export type TreeArchiveStatus = 'active' | 'archived';

export function formatTreeConditionStatus(status: TreeConditionStatus): string {
  return treeConditionStatusLabels[status];
}

export function formatTreeLocation({
  columnPosition,
  rowPosition,
}: {
  columnPosition?: string | null;
  rowPosition?: string | null;
}): string {
  const row = normalizeOptionalText(rowPosition);
  const column = normalizeOptionalText(columnPosition);

  if (row && column) {
    return `Baris ${row} \u00B7 Kolom ${column}`;
  }

  if (row) {
    return `Baris ${row}`;
  }

  if (column) {
    return `Kolom ${column}`;
  }

  return 'Lokasi belum diisi';
}

export function formatTreeArchiveStatus(isArchived: boolean): TreeArchiveStatus {
  return isArchived ? 'archived' : 'active';
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
