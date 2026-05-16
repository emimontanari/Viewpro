const TENANT_SELECTION_KEY = 'viewpro:selected-tenant:v1'
const TENANT_SELECTION_VERSION = 1

type TenantSelectionStorage = {
  version: typeof TENANT_SELECTION_VERSION
  selectedTenantId: string
  updatedAt: string
}

export function getSelectedTenantId() {
  if (!canUseStorage()) {
    return null
  }

  const rawValue = window.localStorage.getItem(TENANT_SELECTION_KEY)
  if (!rawValue) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<TenantSelectionStorage>
    return parsed.version === TENANT_SELECTION_VERSION && typeof parsed.selectedTenantId === 'string'
      ? parsed.selectedTenantId
      : null
  } catch {
    return null
  }
}

export function setSelectedTenantId(selectedTenantId: string) {
  if (!canUseStorage()) {
    return
  }

  const value: TenantSelectionStorage = {
    selectedTenantId,
    updatedAt: new Date().toISOString(),
    version: TENANT_SELECTION_VERSION,
  }

  window.localStorage.setItem(TENANT_SELECTION_KEY, JSON.stringify(value))
}

export function clearSelectedTenantId() {
  if (!canUseStorage()) {
    return
  }

  window.localStorage.removeItem(TENANT_SELECTION_KEY)
}

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}
