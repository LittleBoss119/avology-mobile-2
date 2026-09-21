import React from 'react';
import { BackHandler } from 'react-native';

import { useSnackbar } from '../components/snackbar';

// Jendela tekanan kedua. Dua detik: cukup lama untuk orang yang memang ingin
// keluar dan menekan lagi dengan sengaja, cukup pendek supaya tekanan tak
// sengaja beberapa detik kemudian tidak ikut menutup aplikasi.
const EXIT_WINDOW_MS = 2000;

// "Tekan kembali dua kali untuk keluar", HANYA di layar root tab.
//
// KENAPA ADA: keempat tab dibuka lewat router.replace(), jadi masing-masing
// adalah entri paling bawah di tumpukannya. Tanpa penjaga ini, satu tekanan
// tombol kembali perangkat di Beranda langsung menutup aplikasi — dan pemakai
// aplikasi ini menekan tombol itu dengan ibu jari yang sama yang dipakai
// menggulir.
//
// URUTAN BACKHANDLER, dan kenapa hook ini aman terhadap penanganan yang sudah
// ada: BackHandler memanggil listener dari yang TERAKHIR mendaftar dan berhenti
// pada `true` pertama. Hook ini dipasang sekali di bar navigasi (dimuat bersama
// layout peran, jauh sebelum layar mana pun difokus), sedangkan mode pilih
// denah dan useUnsavedChangesGuard mendaftar SAAT layarnya difokus — jadi
// keduanya selalu mendapat giliran lebih dulu. Mode pilih denah tetap batal
// pada tekanan pertama; tekanan berikutnya baru sampai ke sini.
//
// Di luar layar root tab listener ini mengembalikan `false`: navigasi bawaan
// (pop tumpukan) berjalan seperti tanpa hook ini sama sekali.
//
// `isRootTab` dibaca lewat ref, bukan lewat dependensi effect: pathname berubah
// pada setiap navigasi, dan membongkar-pasang langganan tiap kali itu akan
// memindahkan listener ini ke UJUNG rantai — di depan listener layar yang
// seharusnya menang.
export function useDoubleBackToExit(isRootTab: boolean): void {
  const showSnackbar = useSnackbar();
  const isRootTabRef = React.useRef(isRootTab);
  const lastPressRef = React.useRef(0);

  React.useEffect(() => {
    isRootTabRef.current = isRootTab;

    // Berpindah layar membatalkan tekanan pertama yang menggantung. Tanpa ini,
    // menekan kembali di Beranda, pindah tab, lalu menekan kembali sekali di
    // tab lain dalam dua detik akan menutup aplikasi dengan satu tekanan.
    lastPressRef.current = 0;
  }, [isRootTab]);

  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isRootTabRef.current) {
        return false;
      }

      const now = Date.now();

      if (now - lastPressRef.current < EXIT_WINDOW_MS) {
        // exitApp, bukan `return false`. Mengembalikan false menyerahkan
        // keputusannya ke navigator, dan navigator yang tumpukannya kebetulan
        // masih memegang entri di bawah tab (jalur onboarding yang tidak memakai
        // replace) akan mem-pop alih-alih keluar — tekanan kedua yang dijanjikan
        // snackbar justru membawa ke layar lain.
        BackHandler.exitApp();
        return true;
      }

      lastPressRef.current = now;
      showSnackbar('Tekan sekali lagi untuk keluar.');
      return true;
    });

    return () => subscription.remove();
  }, [showSnackbar]);
}
