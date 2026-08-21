import { router, usePathname } from 'expo-router';
import React from 'react';

import { AccessGate } from '../src/components/access-gate';
import { ErrorBanner, Screen } from '../src/components/ui';
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
    return <AccessGate />;
  }

  if (hasBlockingError) {
    return (
      <Screen applyTopInset>
        <ErrorBanner message={errorMessage} />
      </Screen>
    );
  }

  // Cabang yang sama dengan `initializing` di atas, dan itu memang disengaja:
  // dari sudut pandang user, "sedang memeriksa" dan "sedang mengarahkan" adalah
  // satu penantian yang sama. Membedakannya secara visual hanya menambah satu
  // pergantian layar di tengah cold start.
  return <AccessGate />;
}
