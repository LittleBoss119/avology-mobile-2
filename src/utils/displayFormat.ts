import { SATUAN_BAHAN_LABELS } from '../constants/satuanBahan';
import type {
  ActivityStatus,
  CareCategory,
  GrowthPhase,
  MemberRole,
  MemberStatus,
  SatuanBahan,
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

// SATU-SATUNYA daftar label kondisi di seluruh aplikasi.
//
// Dulu ada lima: dua bentuk panjang (di sini dan treeConditionStatusLabels di
// treeFormat.ts, yang nol pemanggil) dan tiga bentuk pendek
// (formatCompactConditionStatus di tree-components.tsx, plus conditionOptions
// yang ditulis tangan di kedua layar daftar pohon). Akibatnya satu status
// disebut dua nama di dua layar — pemilik memfilter "Perhatian" di daftar
// pohon lalu menemukan "Perlu Perhatian" di peta.
//
// BENTUK PENDEK yang dipilih, bukan panjang: label ini duduk di badge dan chip
// yang lebarnya terbatas, dan bentuk panjang berisiko membungkus di tempat yang
// belum pernah diuji.
export function formatTreeCondition(status: TreeConditionStatus): string {
  const labels: Record<TreeConditionStatus, string> = {
    damaged: 'Rusak',
    dead: 'Mati',
    disease_indicated: 'Penyakit',
    healthy: 'Sehat',
    needs_attention: 'Perhatian',
    pest_attacked: 'Hama',
  };

  return labels[status];
}

export function formatGrowthPhase(phase?: GrowthPhase | null): string {
  if (!phase) {
    return 'Belum dicatat';
  }

  // SATU-SATUNYA daftar label fase, dengan alasan yang sama seperti
  // formatTreeCondition di atas. Bentuk pendek: 'Awal', bukan 'Awal Tanam'.
  const labels: Record<GrowthPhase, string> = {
    flowering: 'Berbunga',
    fruiting: 'Berbuah',
    harvesting: 'Panen',
    initial_planting: 'Awal',
    vegetative: 'Vegetatif',
  };

  return labels[phase];
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

// Takaran bahan jadi satu potong teks siap tampil: "2 kg", "0,5 liter".
//
// Mengembalikan null (bukan string kosong, bukan tanda hubung) kalau takarannya
// tidak lengkap, supaya pemanggil bisa memutuskan sendiri apakah barisnya
// disembunyikan atau diberi teks pengganti. Kolomnya memang berpasangan —
// dijaga constraint care_activities_produk_qty_pair_check — tapi fungsi ini
// tetap menolak pasangan setengah, karena data lama bisa saja lewat jalur lain.
//
// Angkanya diformat dengan locale id-ID sehingga pemisah desimalnya koma, dan
// nol di belakang koma dibuang: 2.00 -> "2", 0.50 -> "0,5".
export function formatTakaranBahan(
  jumlah?: number | null,
  satuan?: SatuanBahan | null
): string | null {
  if (jumlah === null || jumlah === undefined || !satuan) {
    return null;
  }

  if (!Number.isFinite(jumlah)) {
    return null;
  }

  const jumlahTeks = jumlah.toLocaleString('id-ID', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });

  return `${jumlahTeks} ${SATUAN_BAHAN_LABELS[satuan]}`;
}

// Nama bahan digabung takarannya bila ada: "NPK Mutiara · 2 kg".
// Tanpa takaran, hanya nama bahannya. Tanpa nama bahan, null — takaran tanpa
// nama bahan tidak pernah tersimpan (constraint), jadi tidak perlu ditampilkan.
export function formatProdukDenganTakaran(
  produk?: string | null,
  jumlah?: number | null,
  satuan?: SatuanBahan | null
): string | null {
  const namaBahan = produk?.trim();

  if (!namaBahan) {
    return null;
  }

  const takaran = formatTakaranBahan(jumlah, satuan);

  return takaran ? `${namaBahan} · ${takaran}` : namaBahan;
}

export function formatDateOnly(value: string): string {
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

export function formatTargetType(targetType: TargetType): string {
  const labels: Record<TargetType, string> = {
    custom: 'Target Khusus',
    farm: 'Seluruh Kebun',
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
