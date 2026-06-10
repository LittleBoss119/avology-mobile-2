import { Redirect } from 'expo-router';

import { ErrorBanner, LoadingState, Screen } from '../src/components/ui';
import { useAuth } from '../src/context/auth-context';
import { getHomeRoute } from '../src/utils/routeGuard';

export default function IndexRoute() {
  const { currentFarm, error, initializing, profile } = useAuth();

  if (initializing) {
    return <LoadingState message="Memeriksa sesi..." />;
  }

  if (error && profile) {
    return (
      <Screen>
        <ErrorBanner message={error.message} />
      </Screen>
    );
  }

  return <Redirect href={getHomeRoute(profile, currentFarm)} />;
}
