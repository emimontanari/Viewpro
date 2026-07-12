'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import {
  clearSelectedTenantId,
  getSelectedTenantCookieId,
  getSelectedTenantId,
  setSelectedTenantId,
  useSelectedTenantId
} from './tenant-selection';
import { getSessionWithRefresh, logout, type Session, type TenantMembership } from './session';

type SessionContextValue = {
  session: Session | null;
  memberships: TenantMembership[];
  selectedTenantId: string | null;
  activeMembership: TenantMembership | null;
  activeTenantId: string | null;
  hasMemberships: boolean;
  isLoading: boolean;
  isTenantLoading: boolean;
  needsTenantSelection: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
};

const SessionContext = React.createContext<SessionContextValue | null>(null);
const EMPTY_MEMBERSHIPS: TenantMembership[] = [];

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const shouldLoadSession = !pathname.startsWith('/auth');
  const selectedTenantId = useSelectedTenantId();
  const [, rerenderAfterTenantSync] = React.useReducer((version: number) => version + 1, 0);
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

  const session = sessionQuery.data ?? null;
  const memberships = session?.memberships ?? EMPTY_MEMBERSHIPS;
  const selectedMembership =
    memberships.find((membership) => membership.tenant.id === selectedTenantId) ?? null;
  const activeMembership = selectedMembership ?? memberships[0] ?? null;
  const activeTenantId = activeMembership?.tenant.id ?? null;
  const selectedTenantCookieId = getSelectedTenantCookieId();
  const shouldSyncActiveTenant = Boolean(
    shouldLoadSession &&
    !sessionQuery.isLoading &&
    activeTenantId &&
    (selectedTenantId !== activeTenantId || selectedTenantCookieId !== activeTenantId)
  );
  const isTenantLoading = Boolean(
    shouldLoadSession && (sessionQuery.isLoading || shouldSyncActiveTenant)
  );
  const hasMemberships = memberships.length > 0;
  const needsTenantSelection = Boolean(
    shouldLoadSession && !isTenantLoading && session && !hasMemberships
  );

  React.useEffect(() => {
    if (!shouldSyncActiveTenant || !activeTenantId) {
      return;
    }

    const storedTenantId = getSelectedTenantId();
    const storedTenantStillValid = memberships.some(
      (membership) => membership.tenant.id === storedTenantId
    );

    if (storedTenantStillValid && storedTenantId) {
      setSelectedTenantId(storedTenantId);
      rerenderAfterTenantSync();
      return;
    }

    setSelectedTenantId(activeTenantId);
    rerenderAfterTenantSync();
  }, [activeTenantId, memberships, shouldSyncActiveTenant]);

  const value = React.useMemo<SessionContextValue>(
    () => ({
      session,
      memberships,
      selectedTenantId,
      activeMembership,
      activeTenantId,
      hasMemberships,
      isLoading: shouldLoadSession ? sessionQuery.isLoading : false,
      isTenantLoading,
      needsTenantSelection,
      isAuthenticated: Boolean(session),
      signOut: async () => {
        await logoutMutation.mutateAsync();
      }
    }),
    [
      activeMembership,
      activeTenantId,
      hasMemberships,
      isTenantLoading,
      logoutMutation,
      memberships,
      needsTenantSelection,
      selectedTenantId,
      session,
      sessionQuery.isLoading,
      shouldLoadSession
    ]
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

export function useActiveTenant() {
  const {
    activeMembership,
    activeTenantId,
    hasMemberships,
    isTenantLoading,
    memberships,
    needsTenantSelection,
    selectedTenantId
  } = useSession();

  return {
    activeMembership,
    activeTenantId,
    hasMemberships,
    isTenantLoading,
    memberships,
    needsTenantSelection,
    selectedTenantId
  };
}
