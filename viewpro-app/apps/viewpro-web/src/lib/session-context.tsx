'use client';

// Operator-only session context (D2, D4, D5, D6).
// Rehydrates via GET /auth/me on mount — client-only, no SSR (D4).
// On 401/error → redirects to /auth/sign-in (D6).
// signOut is client-side only: no backend logout endpoint exists on viewpro-api (D5).
import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { getSession, type Session } from './session';

type SessionContextValue = {
  session: Session | null;
  isLoading: boolean;
  signOut: () => void;
};

const SessionContext = React.createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const sessionQuery = useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    retry: false,
    staleTime: 60_000
  });

  // D6: 401/403 from /auth/me → redirect to sign-in (no refresh).
  React.useEffect(() => {
    if (sessionQuery.isError) {
      router.push('/auth/sign-in');
    }
  }, [sessionQuery.isError, router]);

  function signOut() {
    // No backend logout endpoint exists on viewpro-api (D5). Cookie expires at TTL.
    // Follow-up: add POST /auth/logout to viewpro-api.
    queryClient.setQueryData(['session'], null);
    queryClient.clear();
    router.push('/auth/sign-in');
  }

  const value = React.useMemo<SessionContextValue>(
    () => ({
      session: sessionQuery.data ?? null,
      isLoading: sessionQuery.isLoading,
      signOut
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionQuery.data, sessionQuery.isLoading]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = React.useContext(SessionContext);

  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }

  return context;
}
