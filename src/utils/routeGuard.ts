import type { CurrentUserFarm, Profile } from '../types/domain';

const onboardingFlowRoutes = new Set(['/onboarding', '/create-farm', '/join-farm']);

export function getHomeRoute(profile: Profile | null, currentFarm: CurrentUserFarm | null): string {
  if (!profile) {
    return '/get-started';
  }

  if (!currentFarm) {
    return '/onboarding';
  }

  if (currentFarm.status === 'pending') {
    return '/pending-approval';
  }

  if (currentFarm.status === 'rejected') {
    return '/rejected';
  }

  if (currentFarm.status === 'removed') {
    return '/removed-access';
  }

  if (currentFarm.role === 'owner') {
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

export function isAllowedOnboardingRoute(
  pathname: string,
  profile: Profile | null,
  currentFarm: CurrentUserFarm | null
): boolean {
  if (!profile) {
    return false;
  }

  if (!currentFarm) {
    return onboardingFlowRoutes.has(pathname);
  }

  return pathname === getHomeRoute(profile, currentFarm);
}
