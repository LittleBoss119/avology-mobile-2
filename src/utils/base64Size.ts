// Ukuran bita sebenarnya dari sebuah string base64, tanpa perlu men-decode-nya.
//
// Dipakai di dua tempat yang tidak boleh berbeda hasilnya:
//   * src/lib/media.ts        -- mengukur hasil kompresi terhadap sasaran ukuran
//   * photoAttachmentService  -- memeriksa base64 masih sinkron dengan berkasnya
//
// Rumusnya sama persis dengan yang dipakai base64ToUint8Array() di
// photoAttachmentService; yang itu sengaja tidak diubah karena ia sudah memegang
// string yang dibersihkan untuk keperluan decode-nya sendiri, dan membersihkan
// ulang string berukuran megabita hanya demi berbagi satu baris justru mahal.
export function base64ByteLength(base64: string): number {
  const clean = (base64.includes(',') ? base64.split(',').pop() ?? '' : base64)
    .replace(/\s/g, '');

  if (clean.length === 0) {
    return 0;
  }

  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;

  return Math.floor((clean.length * 3) / 4) - padding;
}
