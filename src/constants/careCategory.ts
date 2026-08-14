import type { CareCategory } from '../types/domain';

// Daftar kategori perawatan yang ditawarkan UI, dalam urutan tampil chip.
// Nilainya sepadan dengan enum `care_category` di database (migration 001).
//
// Daftar ini dipakai tiga layar: form jadwal, form tindak lanjut laporan
// operasional, dan layar catat perawatan pohon. Dulu ia menumpang di file
// komponen milik fitur SOP, sehingga melepas fitur itu akan ikut mematikan
// ketiganya. Dipindah ke sini supaya berdiri sendiri, dan fitur SOP memang
// sudah dilepas dari aplikasi setelahnya.
//
// Jejaknya di database ikut dibuang di migrasi 046: tabel care_sops, RPC
// create_schedule_from_sop, dan kolom care_schedules.care_sop_id sudah tidak
// ada, begitu juga pill "SOP" di layar Jadwal owner.
//
// Tipe CareCategory sendiri masih hidup di src/types/domain.ts, BEDA dari pola
// membership.ts/operationalReport.ts yang menurunkan tipenya dari tuple di file
// konstanta. Perbedaan itu sengaja tidak diseragamkan di sini; lihat catatan
// laporan Tahap F1.
export const careCategoryOptions: CareCategory[] = [
  'watering',
  'fertilizing',
  'spraying',
  'weeding',
  'other',
];
