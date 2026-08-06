// Tujuan pemulihan sekali-pakai untuk layar pemberitahuan akses.
//
// Kenapa ada: layar pemberitahuan TIDAK boleh menavigasi sendiri. Kalau ia
// memanggil router.replace() sendiri, ia berlomba dengan guard di
// app/(onboarding)/_layout.tsx — guard membaca relasi yang basi, memantulkan
// user, lalu memantulkannya sekali lagi setelah relasi berubah, dan user
// mendarat di tempat yang tidak diminta siapa pun.
//
// Jadi layar cuma MENYATAKAN tujuannya, dan guard yang menavigasi — satu-satunya
// pihak yang berwenang memindahkan layar di grup ini. Nilainya hanya dihormati
// saat relasi benar-benar sudah teramati null, jadi ia tidak bisa dipakai
// menembus penguncian rejected/removed.
//
// Modul-level, dibaca-sekaligus-dihapus, mengikuti pola src/lib/pendingFeedback.ts
// — dan dengan alasan yang sama: tanpa query param yang menumpuk instance rute.
let pendingRoute: string | null = null;

export function setPendingAccessRoute(route: string): void {
  pendingRoute = route;
}

// Dibaca saat render untuk menghitung tujuan. Tidak menghapus, supaya render
// yang sama bisa dijalankan ulang tanpa kehilangan niatnya.
export function peekPendingAccessRoute(): string | null {
  return pendingRoute;
}

export function consumePendingAccessRoute(): void {
  pendingRoute = null;
}
