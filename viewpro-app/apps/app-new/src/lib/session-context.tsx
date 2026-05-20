'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { clearSelectedTenantId } from './tenant-selection';
import { getSessionWithRefresh, logout, type Session } from './session';

type SessionContextValue = {
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
};

const SessionContext = React.createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const shouldLoadSession = !pathname.startsWith('/auth');
  const sessionQuery = useQuery({
    queryKey: ['session'],
    queryFn: getSessionWithRefresh,
    enabled: shouldLoadSession,
    retry: false
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      clearSelectedTenantId();
      queryClient.setQueryData(['session'], null);
      void queryClient.invalidateQueries({ queryKey: ['session'] });
    }
  });

  const value = React.useMemo<SessionContextValue>(
    () => ({
      session: sessionQuery.data ?? null,
      isLoading: shouldLoadSession ? sessionQuery.isLoading : false,
      isAuthenticated: Boolean(sessionQuery.data),
      signOut: async () => {
        await logoutMutation.mutateAsync();
      }
    }),
    [logoutMutation, sessionQuery.data, sessionQuery.isLoading, shouldLoadSession]
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
