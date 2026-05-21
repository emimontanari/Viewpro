import * as React from 'react';

const TENANT_SELECTION_KEY = 'viewpro:selected-tenant:v1';
const TENANT_SELECTION_EVENT = 'viewpro:selected-tenant-changed';
export const SELECTED_TENANT_COOKIE = 'viewpro_selected_tenant_id';

export function getSelectedTenantId() {
  if (!canUseStorage()) {
    return null;
  }

  const rawValue = window.localStorage.getItem(TENANT_SELECTION_KEY);
  if (!rawValue) {
    return null;
  }

  return rawValue;
}

export function setSelectedTenantId(selectedTenantId: string) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(TENANT_SELECTION_KEY, selectedTenantId);
  writeSelectedTenantCookie(selectedTenantId);
  window.dispatchEvent(new Event(TENANT_SELECTION_EVENT));
}

export function clearSelectedTenantId() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(TENANT_SELECTION_KEY);
  writeSelectedTenantCookie(null);
  window.dispatchEvent(new Event(TENANT_SELECTION_EVENT));
}

export function useSelectedTenantId() {
  return React.useSyncExternalStore(subscribeToTenantSelection, getSelectedTenantId, () => null);
}

function subscribeToTenantSelection(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === TENANT_SELECTION_KEY) {
      onStoreChange();
    }
  };

  window.addEventListener(TENANT_SELECTION_EVENT, onStoreChange);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(TENANT_SELECTION_EVENT, onStoreChange);
    window.removeEventListener('storage', handleStorage);
  };
}

function writeSelectedTenantCookie(selectedTenantId: string | null) {
  if (typeof document === 'undefined') {
    return;
  }

  if (!selectedTenantId) {
    document.cookie = `${SELECTED_TENANT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    return;
  }

  document.cookie = `${SELECTED_TENANT_COOKIE}=${encodeURIComponent(
    selectedTenantId
  )}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}
