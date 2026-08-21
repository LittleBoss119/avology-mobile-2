import type { Farm } from '../types/domain';

// Baris kedua identitas kebun: "lokasi · luas". Dulu ada DUA salinan fungsi ini
// yang identik sampai ke spasi — satu di app/(owner)/owner/farm.tsx, satu di
// app/(worker)/worker/farm.tsx. Sejak identitas kebun pindah ke Beranda, kedua
// dashboard ikut membutuhkannya, jadi salinannya akan jadi empat. Diangkat ke
// sini sekali, dan kedua salinan lama dihapus.
//
// Mengembalikan string KOSONG kalau kebun belum punya lokasi maupun luas —
// pemanggil yang memutuskan untuk tidak merender barisnya sama sekali, bukan
// memajang pemisah "·" yang menggantung atau placeholder "-".
export function buildFarmMetaLine(farm: Pick<Farm, 'areaSize' | 'location'>): string {
  const parts: string[] = [];
  const location = farm.location?.trim();

  if (location) {
    parts.push(location);
  }

  const area = formatArea(farm.areaSize);

  if (area) {
    parts.push(area);
  }

  return parts.join(' · ');
}

export function formatArea(value?: number | null): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return `${new Intl.NumberFormat('id-ID').format(value)} m²`;
}
