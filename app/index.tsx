import { router, usePathname } from 'expo-router';
import React from 'react';

import { ErrorBanner, LoadingState, Screen } from '../src/components/ui';
import { useAuth } from '../src/context/auth-context';
import {
  logAccessGuardDecision,
  resolveAccessRoute,
  shouldRedirectAccess,
} from '../src/utils/routeGuard';

export default function IndexRoute() {
  const { currentFarm, error, initializing, profile } = useAuth();
  const pathname = usePathname();
  const targetRoute = resolveAccessRoute({ session: profile, membership: currentFarm });
  const errorMessage = profile ? error?.message : undefined;
  const hasBlockingError = Boolean(errorMessage);
  const sessionUserId = profile?.id ?? null;
  const membershipKey = currentFarm
    ? `${currentFarm.membershipId}:${currentFarm.role}:${currentFarm.status}`
    : 'none';

  React.useEffect(() => {
    if (initializing || hasBlockingError) {
      return;
    }

    const shouldRedirect = shouldRedirectAccess(pathname, targetRoute);

    logAccessGuardDecision({
      currentPathname: pathname,
      membership: currentFarm,
      redirect: shouldRedirect,
      session: profile,
      targetRoute,
    });

    if (shouldRedirect) {
      router.replace(targetRoute);
    }
  }, [hasBlockingError, initializing, membershipKey, pathname, sessionUserId, targetRoute]);

  if (initializing) {
    return <LoadingState message="Memeriksa akses..." />;
  }

  if (hasBlockingError) {
    return (
      <Screen applyTopInset>
        <ErrorBanner message={errorMessage} />
      </Screen>
    );
  }

  return <LoadingState message="Mengarahkan..." />;
}
