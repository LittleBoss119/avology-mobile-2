import type { CurrentUserFarm, Profile } from '../types/domain';

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
