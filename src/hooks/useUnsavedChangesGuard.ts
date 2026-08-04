import { useFocusEffect } from 'expo-router';
import React from 'react';
import { BackHandler } from 'react-native';

// Penjaga "perubahan belum disimpan" untuk layar form.
//
// Dua jalan keluar bermuara ke SATU fungsi keputusan (`handleBackPress`):
//   1. Chevron back di TopAppBar — layar mengoper fungsi ini sebagai `onBack`.
//   2. Tombol back fisik Android — BackHandler dilanggan di sini.
// Tidak ada logika kembar: keduanya menanyakan pertanyaan yang sama ke tempat
// yang sama, jadi perilakunya tidak bisa menyimpang satu sama lain.
//
// Swipe-back iOS SENGAJA TIDAK dicegat di sini — ia dimatikan lewat
// `gestureEnabled: false` di Stack.Screen. Mencegatnya butuh usePreventRemove
// yang hanya tersedia lewat deep import ke build internal expo-router (API privat,
// bisa patah saat upgrade tanpa error TypeScript). Menjelang rilis, mematikan
// gestur lebih murah daripada bergantung pada jalur yang tidak dijamin.
//
// Sengaja dilanggan lewat useFocusEffect, bukan useEffect: langganan dilepas saat
// layar kehilangan fokus, bukan hanya saat unmount. Kalau memakai useEffect, layar
// ini tetap terlanggan saat tertutup layar lain — dan karena BackHandler memanggil
// listener dari yang TERAKHIR mendaftar lalu berhenti pada `true` pertama, ia akan
// menelan tombol back milik layar di atasnya.
export function useUnsavedChangesGuard({
  hasUnsavedChanges,
  onBlocked,
  onLeave,
}: {
  hasUnsavedChanges: boolean;
  onBlocked: () => void;
  onLeave: () => void;
}): { handleBackPress: () => void } {
  const stateRef = React.useRef({ hasUnsavedChanges, onBlocked, onLeave });

  // Ref disegarkan tiap render supaya langganan BackHandler tidak perlu dibongkar
  // pasang tiap ketikan, tapi keputusannya selalu memakai nilai terbaru.
  React.useEffect(() => {
    stateRef.current = { hasUnsavedChanges, onBlocked, onLeave };
  });

  const handleBackPress = React.useCallback(() => {
    const { hasUnsavedChanges: dirty, onBlocked: blocked, onLeave: leave } = stateRef.current;

    if (dirty) {
      blocked();
      return;
    }

    leave();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        handleBackPress();
        // Selalu true: navigasi keluar dikerjakan sendiri lewat onLeave, jadi
        // perilaku back native tidak boleh ikut jalan dan memunculkan pop ganda.
        return true;
      });

      return () => subscription.remove();
    }, [handleBackPress])
  );

  return { handleBackPress };
}
