import type { GrowthPhase, Tree, TreeConditionStatus } from '../types/domain';
import {
  formatGrowthPhase as formatDisplayGrowthPhase,
  formatTreeCondition,
} from './displayFormat';

export const treeConditionStatusLabels: Record<TreeConditionStatus, string> = {
  healthy: 'Sehat',
  needs_attention: 'Perlu Perhatian',
  pest_attacked: 'Terserang Hama',
  disease_indicated: 'Terindikasi Penyakit',
  damaged: 'Rusak',
  dead: 'Mati',
};

export const growthPhaseLabels: Record<GrowthPhase, string> = {
  initial_planting: 'Awal Tanam',
  vegetative: 'Vegetatif',
  flowering: 'Berbunga',
  fruiting: 'Berbuah',
  harvesting: 'Panen',
};

export type TreeArchiveStatus = 'active' | 'archived';

export function formatTreeConditionStatus(status: TreeConditionStatus): string {
  return formatTreeCondition(status);
}

export function formatGrowthPhase(phase?: GrowthPhase | null): string {
  return formatDisplayGrowthPhase(phase);
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

export function buildTreeDisplayCode({
  columnPosition,
  rowPosition,
}: {
  columnPosition?: string | null;
  rowPosition?: string | null;
}): string | null {
  const row = normalizeTreeRow(rowPosition);
  const column = normalizeTreeColumn(columnPosition);

  if (!row || !column) {
    return null;
  }

  return `${row}-${column}`;
}

export function formatTreeDisplayCode(tree: Pick<Tree, 'columnPosition' | 'rowPosition' | 'treeCode'>): string {
  const displayCode = buildTreeDisplayCode(tree);

  if (displayCode) {
    return displayCode;
  }

  const row = normalizeOptionalText(tree.rowPosition);
  const column = normalizeOptionalText(tree.columnPosition);
  const legacyCode = !row && !column ? normalizeOptionalText(tree.treeCode) : null;

  return legacyCode ?? 'Lokasi belum lengkap';
}

export function formatTreeAge(plantedAt?: string | null): string {
  const normalized = normalizeOptionalText(plantedAt);

  if (!normalized) {
    return 'Tanggal tanam belum diisi';
  }

  const plantedDate = new Date(normalized);

  if (Number.isNaN(plantedDate.getTime())) {
    return 'Tanggal tanam tidak valid';
  }

  const today = new Date();
  const diffMs = today.getTime() - plantedDate.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / 86_400_000));
  const monthDiff = getFullMonthDiff(plantedDate, today);

  if (monthDiff < 1) {
    return `${diffDays} hari`;
  }

  if (monthDiff < 12) {
    return `${monthDiff} bulan`;
  }

  return `${Math.floor(monthDiff / 12)} tahun`;
}

export function formatTreeArchiveStatus(isArchived: boolean): TreeArchiveStatus {
  return isArchived ? 'archived' : 'active';
}

export function formatTreeArchiveStatusLabel(isArchived: boolean): string {
  return isArchived ? 'Diarsipkan' : 'Aktif';
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeTreeRow(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalText(value);
  return normalized ? normalized.toUpperCase() : null;
}

function normalizeTreeColumn(value: string | null | undefined): string | null {
  return normalizeOptionalText(value);
}

function getFullMonthDiff(startDate: Date, endDate: Date): number {
  let months =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    endDate.getMonth() -
    startDate.getMonth();

  if (endDate.getDate() < startDate.getDate()) {
    months -= 1;
  }

  return Math.max(0, months);
}
