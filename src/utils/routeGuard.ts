import type { CurrentUserFarm, Profile } from '../types/domain';

// '/profile-edit' berdiri sejajar dengan '/password': sama-sama layar akun yang
// boleh dibuka di luar kebun aktif (belum punya kebun, menunggu persetujuan,
// ditolak, atau dinonaktifkan). Tanpa entri ini, layar edit profil versi
// onboarding langsung dipental balik oleh shouldRedirectAccess().
const accountProfileRoutes = new Set(['/profile', '/profile-edit', '/password']);
const onboardingFlowRoutes = new Set(['/onboarding', '/create-farm', '/join-farm', '/profile', '/profile-edit', '/password']);
const authFlowRoutes = new Set(['/get-started', '/login', '/register']);

// CATATAN PERBAIKAN (bug Fase 3):
// Dulu ada `inactiveAccessRecoveryRoutes` + `canStayInOnboardingFlow()` yang
// membuat shouldRedirectAccess() mengembalikan false untuk user berstatus
// rejected/removed yang sedang berada di /onboarding, /join-farm, atau
// /create-farm. Itu mencampur dua pertanyaan yang berbeda: "boleh berada di
// sini?" dan "harus diarahkan ke mana?". Akibatnya resolveAccessRoute() sudah
// menghitung '/rejected' dengan benar, tapi tidak ada satu pun yang bertindak
// atas nilai itu — user tersangkut di layar pilih akses, layar pemberitahuan
// tidak pernah terjangkau, dan pengajuan ulang dari sana menimpa baris
// penolakannya (temuan R-02 lewat pintu tampilan).
//
// Sekarang rejected/removed diperlakukan persis seperti pending: state
// pemberitahuan yang WAJIB diarahkan, dan hanya rute akun (/profile,
// /profile-edit, /password) yang boleh menyela. Jalan keluarnya satu-satunya
// adalah tombol di layar pemberitahuan, yang memanggil acknowledge_access_notice
// lebih dulu sehingga relasinya benar-benar hilang sebelum rute lain terbuka.

type ResolveAccessRouteInput = {
  session: Profile | null;
  membership: CurrentUserFarm | null;
};

type AccessGuardDebugInput = {
  currentPathname: string;
  membership: CurrentUserFarm | null;
  redirect: boolean;
  session: Profile | null;
  targetRoute: string;
};

export function resolveAccessRoute({ session, membership }: ResolveAccessRouteInput): string {
  if (!session) {
    return '/get-started';
  }

  if (!membership) {
    return '/onboarding';
  }

  if (membership.status === 'pending') {
    return '/pending-approval';
  }

  if (membership.status === 'rejected') {
    return '/rejected';
  }

  if (membership.status === 'removed') {
    return '/removed-access';
  }

  if (membership.role === 'owner') {
    return '/owner';
  }

  return '/worker';
}

export function isOwnerActive(currentFarm: CurrentUserFarm | null): boolean {
  return currentFarm?.role === 'owner' && currentFarm.status === 'active';
}

export function isWorkerActive(currentFarm: CurrentUserFarm | null): boolean {
  return currentFarm?.role === 'worker' && currentFarm.status === 'active';
}

export function isAccessRouteSatisfied(pathname: string, targetRoute: string): boolean {
  const currentPath = normalizePath(pathname);
  const targetPath = normalizePath(targetRoute);

  if (authFlowRoutes.has(targetPath)) {
    return authFlowRoutes.has(currentPath);
  }

  if (targetPath === '/onboarding') {
    return onboardingFlowRoutes.has(currentPath);
  }

  if (
    targetPath === '/pending-approval' ||
    targetPath === '/rejected' ||
    targetPath === '/removed-access'
  ) {
    return currentPath === targetPath || accountProfileRoutes.has(currentPath);
  }

  if (targetPath === '/owner') {
    return currentPath === '/owner' || currentPath.startsWith('/owner/');
  }

  if (targetPath === '/worker') {
    return currentPath === '/worker' || currentPath.startsWith('/worker/');
  }

  return currentPath === targetPath;
}

// Satu pertanyaan saja: apakah rute sekarang sudah memenuhi tujuan yang dihitung
// resolveAccessRoute()? Status relasi TIDAK dibaca di sini — itu sudah habis
// dipakai saat menghitung `targetRoute`. Membacanya dua kali persis yang dulu
// melahirkan cabang "boleh bertahan" dan membuat user tersangkut.
export function shouldRedirectAccess(pathname: string, targetRoute: string): boolean {
  return !isAccessRouteSatisfied(pathname, targetRoute);
}

export function logAccessGuardDecision({
  currentPathname,
  membership,
  redirect,
  session,
  targetRoute,
}: AccessGuardDebugInput) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.debug('[access-guard]', {
      userId: session?.id ?? null,
      membershipStatus: membership?.status ?? null,
      currentPathname,
      targetRoute,
      redirect,
    });
  }
}

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }

  return pathname;
}
