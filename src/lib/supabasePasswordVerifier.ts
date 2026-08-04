import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';

declare const process: {
  env: {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
  };
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
  );
}

// Client Supabase KEDUA, satu-satunya tugasnya: membuktikan bahwa orang yang
// menekan "Ubah password" tahu password yang sekarang. Dibuat sekali di level
// modul dan dipakai ulang, bukan per panggilan.
//
// Tiga setelan di bawah wajib dan bukan gaya-gayaan:
// - storageKey BERBEDA dari client utama (lib/supabase.ts memakai default).
//   Kalau kuncinya sama, sesi hasil verifikasi menimpa atau menghapus sesi utama
//   dan user ikut terlempar keluar. Kunci berbeda juga membuat auth-js tidak
//   menghitungnya sebagai instance kedua pada kunci yang sama, jadi peringatan
//   "Multiple GoTrueClient instances" tidak muncul (GoTrueClient.js:133-140,
//   penghitungnya per-storageKey).
// - persistSession false: sesi hasil verifikasi tidak pernah ditulis ke disk.
// - autoRefreshToken false: tidak ada timer yang memperpanjang sesi bayangan itu.
//
// BATAS YANG HARUS DISADARI: ini verifikasi di SISI KLIEN. Ia menutup skenario
// "HP ketinggalan dalam keadaan login" — orang lain tidak bisa mengganti password
// tanpa tahu password lama. Ia TIDAK menutup penyerang yang memanggil API Supabase
// langsung dengan token yang dicuri, karena di sana updateUser tetap bisa dipanggil
// tanpa melewati layar ini. Untuk menutup itu perlu penegakan di sisi server
// (RPC/Edge Function atau setelan "secure password change" di project Supabase).
export const supabasePasswordVerifier = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
    storageKey: 'avology-password-verifier',
  },
});
