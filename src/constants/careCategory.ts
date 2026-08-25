import type { CareCategory } from '../types/domain';

// Daftar kategori perawatan yang ditawarkan UI, dalam urutan tampil chip.
// Nilainya sepadan dengan enum `care_category` di database (migration 001).
//
// Daftar ini dipakai dua layar: form jadwal dan layar catat perawatan pohon.
// (Layar ketiga, form tindak lanjut laporan operasional, ikut dibuang bersama
// modulnya di migrasi 053.) Dulu ia menumpang di file komponen milik fitur SOP,
// sehingga melepas fitur itu akan ikut mematikan semuanya. Dipindah ke sini
// supaya berdiri sendiri, dan fitur SOP memang sudah dilepas dari aplikasi
// setelahnya.
//
// Jejaknya di database ikut dibuang di migrasi 046: tabel care_sops, RPC
// create_schedule_from_sop, dan kolom care_schedules.care_sop_id sudah tidak
// ada, begitu juga pill "SOP" di layar Jadwal owner.
//
// Tipe CareCategory sendiri masih hidup di src/types/domain.ts, BEDA dari pola
// membership.ts/satuanBahan.ts yang menurunkan tipenya dari tuple di file
// konstanta. Perbedaan itu sengaja tidak diseragamkan di sini; lihat catatan
// laporan Tahap F1.
export const careCategoryOptions: CareCategory[] = [
  'watering',
  'fertilizing',
  'spraying',
  'weeding',
  'other',
];
