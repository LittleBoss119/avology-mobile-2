import React from 'react';

import { supabase } from '../lib/supabase';
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
  const refreshVersionRef = React.useRef(0);

  const refresh = React.useCallback(async () => {
    const refreshVersion = refreshVersionRef.current + 1;
    refreshVersionRef.current = refreshVersion;

    setStableError(setError, null);

    const profileResult = await getCurrentProfile();

    if (refreshVersion !== refreshVersionRef.current) {
      return;
    }

    if (profileResult.error) {
      setStableProfile(setProfile, null);
      setStableCurrentFarm(setCurrentFarm, null);
      setStableError(setError, profileResult.error);
      return;
    }

    if (!profileResult.data) {
      setStableProfile(setProfile, null);
      setStableCurrentFarm(setCurrentFarm, null);
      return;
    }

    const farmResult = await getCurrentUserFarm();

    if (refreshVersion !== refreshVersionRef.current) {
      return;
    }

    if (farmResult.error) {
      setStableProfile(setProfile, profileResult.data);
      setStableCurrentFarm(setCurrentFarm, null);
      setStableError(setError, farmResult.error);
      return;
    }

    setStableProfile(setProfile, profileResult.data);
    setStableCurrentFarm(setCurrentFarm, farmResult.data);
  }, []);

  React.useEffect(() => {
    let isMounted = true;

    refresh()
      .catch((unknownError) => {
        if (isMounted) {
          setStableError(setError, toServiceError(unknownError, 'Gagal memuat sesi pengguna.'));
        }
      })
      .finally(() => {
        if (isMounted) {
          setInitializing(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (!isMounted) {
        return;
      }

      if (event === 'SIGNED_OUT') {
        refreshVersionRef.current += 1;
        setStableProfile(setProfile, null);
        setStableCurrentFarm(setCurrentFarm, null);
        setStableError(setError, null);
        setInitializing(false);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        void refresh().catch((unknownError) => {
          setStableError(setError, toServiceError(unknownError, 'Gagal memuat sesi pengguna.'));
        });
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [refresh]);

  const signOut = React.useCallback(async () => {
    refreshVersionRef.current += 1;

    const result = await logoutUser();

    if (result.error) {
      setStableError(setError, result.error);
      return result.error;
    }

    setStableProfile(setProfile, null);
    setStableCurrentFarm(setCurrentFarm, null);
    setStableError(setError, null);
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

function setStableProfile(
  setState: React.Dispatch<React.SetStateAction<Profile | null>>,
  next: Profile | null
) {
  setState((previous) => (isSameProfile(previous, next) ? previous : next));
}

function setStableCurrentFarm(
  setState: React.Dispatch<React.SetStateAction<CurrentUserFarm | null>>,
  next: CurrentUserFarm | null
) {
  setState((previous) => (isSameCurrentFarm(previous, next) ? previous : next));
}

function setStableError(
  setState: React.Dispatch<React.SetStateAction<ServiceError | null>>,
  next: ServiceError | null
) {
  setState((previous) => (isSameError(previous, next) ? previous : next));
}

function isSameProfile(first: Profile | null, second: Profile | null): boolean {
  return (
    first?.id === second?.id &&
    first?.fullName === second?.fullName &&
    first?.phone === second?.phone &&
    first?.email === second?.email &&
    first?.createdAt === second?.createdAt &&
    first?.updatedAt === second?.updatedAt
  );
}

function isSameCurrentFarm(first: CurrentUserFarm | null, second: CurrentUserFarm | null): boolean {
  return (
    first?.membershipId === second?.membershipId &&
    first?.farmId === second?.farmId &&
    first?.userId === second?.userId &&
    first?.role === second?.role &&
    first?.status === second?.status &&
    first?.joinedAt === second?.joinedAt &&
    first?.createdAt === second?.createdAt &&
    first?.updatedAt === second?.updatedAt &&
    first?.farm?.id === second?.farm?.id &&
    first?.farm?.name === second?.farm?.name &&
    first?.farm?.location === second?.farm?.location &&
    first?.farm?.areaSize === second?.farm?.areaSize &&
    first?.farm?.joinCode === second?.farm?.joinCode &&
    first?.farm?.createdBy === second?.farm?.createdBy &&
    first?.farm?.createdAt === second?.farm?.createdAt &&
    first?.farm?.updatedAt === second?.farm?.updatedAt
  );
}

function isSameError(first: ServiceError | null, second: ServiceError | null): boolean {
  return (
    first?.message === second?.message &&
    first?.code === second?.code &&
    first?.rawMessage === second?.rawMessage
  );
}
