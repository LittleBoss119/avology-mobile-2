import type {
  ActivityStatus,
  CareCategory,
  CareSOPDefaultTargetType,
  GrowthPhase,
  MemberRole,
  MemberStatus,
  OperationalReportCategory,
  OperationalReportStatus,
  TargetType,
  TaskStatus,
  TreeConditionStatus,
} from '../types/domain';

const uuidPattern = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const exactUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function formatRole(role: MemberRole | string | null | undefined): string {
  const labels: Record<MemberRole, string> = {
    owner: 'Pemilik',
    worker: 'Pekerja',
  };

  return role && role in labels ? labels[role as MemberRole] : 'Belum diketahui';
}

export function formatMemberStatus(status: MemberStatus | string | null | undefined): string {
  const labels: Record<MemberStatus, string> = {
    active: 'Aktif',
    pending: 'Menunggu Persetujuan',
    rejected: 'Ditolak',
    removed: 'Akses Dinonaktifkan',
  };

  return status && status in labels ? labels[status as MemberStatus] : 'Belum diketahui';
}

export function formatTreeCondition(status: TreeConditionStatus): string {
  const labels: Record<TreeConditionStatus, string> = {
    damaged: 'Rusak',
    dead: 'Mati',
    disease_indicated: 'Terindikasi Penyakit',
    healthy: 'Sehat',
    needs_attention: 'Perlu Perhatian',
    pest_attacked: 'Terserang Hama',
  };

  return labels[status];
}

export function formatGrowthPhase(phase?: GrowthPhase | null): string {
  if (!phase) {
    return 'Belum dicatat';
  }

  const labels: Record<GrowthPhase, string> = {
    flowering: 'Berbunga',
    fruiting: 'Berbuah',
    harvesting: 'Panen',
    initial_planting: 'Awal Tanam',
    vegetative: 'Vegetatif',
  };

  return labels[phase];
}

export function formatOperationalReportStatus(status: OperationalReportStatus): string {
  const labels: Record<OperationalReportStatus, string> = {
    in_progress: 'Dalam tindak lanjut',
    new: 'Belum direspons',
    rejected: 'Ditolak',
    resolved: 'Selesai',
  };

  return labels[status];
}

export function formatOperationalReportStatusShort(status: OperationalReportStatus): string {
  const labels: Record<OperationalReportStatus, string> = {
    in_progress: 'Tindak lanjut',
    new: 'Belum respons',
    rejected: 'Ditolak',
    resolved: 'Selesai',
  };

  return labels[status];
}

export function formatOperationalReportCategory(category: OperationalReportCategory): string {
  const labels: Record<OperationalReportCategory, string> = {
    area_pest_disease: 'Hama/Penyakit Area',
    broken_tool: 'Alat Rusak',
    disaster_weather: 'Cuaca/Bencana',
    land_damage: 'Kerusakan Lahan',
    other: 'Lainnya',
    out_of_stock: 'Stok Habis',
    worker_need: 'Kebutuhan Pekerja',
  };

  return labels[category];
}

export function formatCareCategory(category: CareCategory): string {
  const labels: Record<CareCategory, string> = {
    fertilizing: 'Pemupukan',
    other: 'Lainnya',
    spraying: 'Penyemprotan',
    watering: 'Penyiraman',
    weeding: 'Pengendalian Gulma',
  };

  return labels[category];
}

export function formatTaskStatus(status: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    completed: 'Selesai',
    pending: 'Belum',
    postponed: 'Ditunda',
  };

  return labels[status];
}

export function formatActivityStatus(status: ActivityStatus): string {
  const labels: Record<ActivityStatus, string> = {
    completed: 'Selesai',
    postponed: 'Ditunda',
  };

  return labels[status];
}

export function formatTargetType(targetType: TargetType | CareSOPDefaultTargetType): string {
  const labels: Record<TargetType, string> = {
    column: 'Kolom',
    custom: 'Target Khusus',
    farm: 'Seluruh Kebun',
    row: 'Baris',
    tree: 'Pohon',
  };

  return labels[targetType as TargetType];
}

export function formatTreeTargetFallback(targetTreeId: string | null | undefined): string {
  return targetTreeId ? 'Pohon terpilih' : 'Pohon belum dipilih';
}

export function isUuidLike(value?: string | null): boolean {
  return exactUuidPattern.test(value?.trim() ?? '');
}

export function sanitizeDisplayValue(value?: string | null): string | null {
  const trimmedValue = value?.trim();

  if (!trimmedValue || isUuidLike(trimmedValue)) {
    return null;
  }

  return sanitizeUserFacingMessage(trimmedValue);
}

export function formatPersonDisplayName(
  value?: string | null,
  fallback = 'Pelapor tidak tersedia'
): string {
  return sanitizeDisplayValue(value) ?? fallback;
}

export function sanitizeUserFacingMessage(message?: string | null): string | null {
  if (!message) {
    return null;
  }

  const sanitizedMessage = message
    .replace(uuidPattern, 'data terkait')
    .replace(/\bTree ID\b/gi, 'Data pohon')
    .replace(/\bSchedule ID\b/gi, 'Data jadwal')
    .replace(/\bSOP ID\b/gi, 'Data SOP')
    .replace(/\bWorker\b/g, 'Pekerja')
    .replace(/\bworker\b/g, 'pekerja')
    .replace(/\bOwner\b/g, 'Pemilik')
    .replace(/\bowner\b/g, 'pemilik')
    .replace(/\bapproval\b/gi, 'persetujuan')
    .trim();

  return isTechnicalUserMessage(sanitizedMessage)
    ? 'Terjadi kendala saat memproses data. Periksa input lalu coba lagi.'
    : sanitizedMessage;
}

function isTechnicalUserMessage(message: string): boolean {
  const normalized = message.toLowerCase();

  return (
    normalized.includes('violates row-level security') ||
    normalized.includes('violates foreign key constraint') ||
    normalized.includes('violates check constraint') ||
    normalized.includes('violates not-null constraint') ||
    normalized.includes('duplicate key value violates unique constraint') ||
    normalized.includes('invalid input syntax') ||
    normalized.includes('schema cache') ||
    normalized.includes('postgresterror') ||
    normalized.includes('sqlstate') ||
    normalized.includes('permission denied for table') ||
    normalized.includes('relation "') ||
    normalized.includes('column "') ||
    normalized.includes('stack trace')
  );
}
