import type { CurrentUserFarm, Profile } from '../types/domain';

const accountProfileRoutes = new Set(['/profile', '/password']);
const onboardingFlowRoutes = new Set(['/onboarding', '/create-farm', '/join-farm', '/profile', '/password']);
const inactiveAccessRecoveryRoutes = new Set(['/onboarding', '/create-farm', '/join-farm', '/profile', '/password']);
const authFlowRoutes = new Set(['/get-started', '/login', '/register']);

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

export function getHomeRoute(profile: Profile | null, currentFarm: CurrentUserFarm | null): string {
  return resolveAccessRoute({ session: profile, membership: currentFarm });
}

export function isOwnerActive(currentFarm: CurrentUserFarm | null): boolean {
  return currentFarm?.role === 'owner' && currentFarm.status === 'active';
}

export function isWorkerActive(currentFarm: CurrentUserFarm | null): boolean {
  return currentFarm?.role === 'worker' && currentFarm.status === 'active';
}

export function isAllowedOnboardingRoute(
  pathname: string,
  profile: Profile | null,
  currentFarm: CurrentUserFarm | null,
  options: { allowInactiveAccessRecovery?: boolean } = {}
): boolean {
  if (!profile) {
    return false;
  }

  if (!currentFarm) {
    return onboardingFlowRoutes.has(pathname);
  }

  if (canStayInOnboardingFlow(pathname, currentFarm, options)) {
    return true;
  }

  return pathname === getHomeRoute(profile, currentFarm);
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

export function canStayInOnboardingFlow(
  pathname: string,
  membership: CurrentUserFarm | null,
  _options: { allowInactiveAccessRecovery?: boolean } = {}
): boolean {
  const normalizedPath = normalizePath(pathname);

  if (!membership || (membership.status !== 'rejected' && membership.status !== 'removed')) {
    return false;
  }

  return inactiveAccessRecoveryRoutes.has(normalizedPath);
}

export function shouldRedirectAccess(
  pathname: string,
  targetRoute: string,
  membership: CurrentUserFarm | null,
  options: { allowInactiveAccessRecovery?: boolean } = {}
): boolean {
  if (canStayInOnboardingFlow(pathname, membership, options)) {
    return false;
  }

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
