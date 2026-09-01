import { router } from 'expo-router';
import React from 'react';

import { LoadingState } from '../../../../src/components/ui';
import { setTreeBrowseView } from '../../../../src/lib/treeBrowseState';

// PENGALIH, bukan layar. Denah sudah tidak punya route sendiri — ia salah satu
// dari dua tampilan di dalam /owner/trees.
//
// KENAPA ROUTE INI TIDAK DIHAPUS SAJA. Dua berkas menyebutnya sebagai string
// literal di jalur cadangan `goBackToMap()`:
//
//   src/components/farm-add-trees-screen.tsx:242
//   src/components/farm-care-record-screen.tsx:352
//
// Keduanya berbunyi `router.canGoBack() ? router.back() : router.replace(...)`.
// Cabang replace itu justru cabang untuk keadaan tidak normal — cold start,
// state navigasi yang dipulihkan — dan di sanalah route yang hilang paling
// merugikan: pemilik yang baru saja menyimpan pohon massal akan terlempar ke
// layar yang tidak ada. Membiarkan route ini hidup sebagai pengalih jauh lebih
// murah daripada menyulam ulang kedua jalur itu.
//
// Urutannya penting: modul disetel LEBIH DULU, baru pindah. Route tujuan
// membaca nilai itu di fase render sekaligus di useFocusEffect-nya, jadi ia
// sampai pada tampilan yang benar baik saat ia dipasang ulang maupun saat ia
// ternyata dipakai ulang dari tumpukan.
export default function OwnerFarmMapRedirect() {
  React.useEffect(() => {
    setTreeBrowseView('map');
    router.replace('/owner/trees');
  }, []);

  return <LoadingState message="Membuka denah kebun..." />;
}
