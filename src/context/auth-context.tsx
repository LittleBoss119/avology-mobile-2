import React from 'react';

import { getCurrentProfile, logoutUser } from '../services/authService';
import { getCurrentUserFarm } from '../services/farmService';
import type { CurrentUserFarm, Profile, ServiceError } from '../types/domain';
import { toServiceError } from '../utils/serviceResult';

type AuthContextValue = {
  currentFarm: CurrentUserFarm | null;
  error: ServiceError | null;
  initializing: boolean;
  profile: Profile | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<ServiceError | null>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [currentFarm, setCurrentFarm] = React.useState<CurrentUserFarm | null>(null);
  const [initializing, setInitializing] = React.useState(true);
  const [error, setError] = React.useState<ServiceError | null>(null);

  const refresh = React.useCallback(async () => {
    setError(null);

    const profileResult = await getCurrentProfile();

    if (profileResult.error) {
      setProfile(null);
      setCurrentFarm(null);
      setError(profileResult.error);
      return;
    }

    setProfile(profileResult.data);

    if (!profileResult.data) {
      setCurrentFarm(null);
      return;
    }

    const farmResult = await getCurrentUserFarm();

    if (farmResult.error) {
      setCurrentFarm(null);
      setError(farmResult.error);
      return;
    }

    setCurrentFarm(farmResult.data);
  }, []);

  React.useEffect(() => {
    refresh()
      .catch((unknownError) => {
        setError(toServiceError(unknownError, 'Gagal memuat sesi pengguna.'));
      })
      .finally(() => setInitializing(false));
  }, [refresh]);

  const signOut = React.useCallback(async () => {
    const result = await logoutUser();

    if (result.error) {
      setError(result.error);
      return result.error;
    }

    setProfile(null);
    setCurrentFarm(null);
    setError(null);
    return null;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentFarm,
        error,
        initializing,
        profile,
        refresh,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = React.use(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return value;
}
