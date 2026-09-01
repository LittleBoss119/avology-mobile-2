import { router } from 'expo-router';
import React from 'react';

import { LoadingState } from '../../../../src/components/ui';
import { setTreeBrowseView } from '../../../../src/lib/treeBrowseState';

// PENGALIH, bukan layar. Denah sudah tidak punya route sendiri — ia salah satu
// dari dua tampilan di dalam /worker/trees.
//
// Kembaran dari app/(owner)/owner/trees/map.tsx; catatan lengkap soal kenapa
// route ini tidak dihapus ada di sana. Ringkasnya: dua berkas menyebut route
// sisi PEMILIK sebagai string literal di jalur cadangan goBackToMap(). Sisi
// pekerja tidak punya pemanggil semacam itu, tapi ia tetap dibuat sepasang —
// route yang hidup di satu peran dan mati di peran lain adalah selisih yang
// akan menggigit orang berikutnya yang membaca kedua _layout.
export default function WorkerFarmMapRedirect() {
  React.useEffect(() => {
    setTreeBrowseView('map');
    router.replace('/worker/trees');
  }, []);

  return <LoadingState message="Membuka denah kebun..." />;
}
