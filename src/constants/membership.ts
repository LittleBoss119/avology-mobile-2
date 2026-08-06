// Satu-satunya sumber kebenaran peran, status keanggotaan, dan jenis event
// akses kebun di sisi TypeScript. Pasangannya di sisi database adalah enum
// `member_role` / `member_status` (migration 001) dan check constraint
// `farm_access_events_event_check` (migration 036).
// Dua sisi ini tidak bisa diturunkan otomatis, jadi harus dijaga sinkron manual.
//
// CATATAN TRANSISI: `MemberRole` dan `MemberStatus` untuk sementara masih punya
// kembaran di src/types/domain.ts, dan label peran/status masih dipakai lewat
// src/utils/displayFormat.ts. Nilainya sengaja disalin persis supaya tidak ada
// perbedaan perilaku. Penyatuan keduanya adalah pekerjaan Fase 6 — file ini
// dibuat lebih dulu supaya sumber kebenarannya sudah ada saat dibutuhkan.

export const MEMBER_ROLES = ['owner', 'worker'] as const;

export type MemberRole = (typeof MEMBER_ROLES)[number];

// Urutannya adalah urutan siklus hidup, bukan urutan tampil:
//   pending  -> baru mengajukan, belum diproses pemilik
//   active   -> anggota sah kebun
//   rejected -> pengajuannya ditolak pemilik
//   removed  -> aksesnya berakhir (dinonaktifkan pemilik ATAU keluar sendiri —
//               pembedanya ada di farm_members.removed_reason)
export const MEMBER_STATUSES = ['pending', 'active', 'rejected', 'removed'] as const;

export type MemberStatus = (typeof MEMBER_STATUSES)[number];

// Status yang berarti user sedang terikat pada sebuah kebun. Sejak migration 036
// seorang user hanya boleh punya satu baris farm_members dengan salah satu
// status ini, dijaga partial unique index farm_members_one_active_relation_idx.
export const ENGAGED_MEMBER_STATUSES = ['pending', 'active'] as const;

// Jenis event di tabel farm_access_events (migration 036). Tabel itu append-only:
// tidak pernah di-UPDATE, tidak pernah di-DELETE.
//   requested -> user mengirim pengajuan dengan kode kebun
//   approved  -> pemilik menerima pengajuan
//   rejected  -> pemilik menolak pengajuan
//   cancelled -> user membatalkan pengajuannya sendiri sebelum diproses
//   left      -> pekerja keluar dari kebun atas kemauan sendiri
//   removed   -> pemilik menonaktifkan akses pekerja
export const FARM_ACCESS_EVENTS = [
  'requested',
  'approved',
  'rejected',
  'cancelled',
  'left',
  'removed',
] as const;

export type FarmAccessEvent = (typeof FARM_ACCESS_EVENTS)[number];

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Pemilik',
  worker: 'Pekerja',
};

export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  active: 'Aktif',
  pending: 'Menunggu Persetujuan',
  rejected: 'Ditolak',
  removed: 'Akses Dinonaktifkan',
};

// Label event ditulis dari sudut pandang pembaca riwayat (pemilik kebun), jadi
// subjeknya adalah orang yang bersangkutan: "Mengajukan", "Diterima", dst.
// Layar riwayat akses baru dikerjakan di Fase 4 — kata-kata final ditetapkan
// di sana, ini nilai awal yang konsisten dengan label status di atas.
export const FARM_ACCESS_EVENT_LABELS: Record<FarmAccessEvent, string> = {
  approved: 'Diterima',
  cancelled: 'Dibatalkan',
  left: 'Keluar sendiri',
  rejected: 'Ditolak',
  requested: 'Mengajukan',
  removed: 'Dinonaktifkan',
};

export function isMemberRole(value: unknown): value is MemberRole {
  return typeof value === 'string' && (MEMBER_ROLES as readonly string[]).includes(value);
}

export function isMemberStatus(value: unknown): value is MemberStatus {
  return typeof value === 'string' && (MEMBER_STATUSES as readonly string[]).includes(value);
}

export function isFarmAccessEvent(value: unknown): value is FarmAccessEvent {
  return typeof value === 'string' && (FARM_ACCESS_EVENTS as readonly string[]).includes(value);
}

// Cerminan guard RPC request_join_farm: user yang punya baris pending atau
// active di kebun MANA PUN tidak boleh mengajukan ke kebun lain.
export function isEngagedMemberStatus(status: MemberStatus): boolean {
  return (ENGAGED_MEMBER_STATUSES as readonly string[]).includes(status);
}
