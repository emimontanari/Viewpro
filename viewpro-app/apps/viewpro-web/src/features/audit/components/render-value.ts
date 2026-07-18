/**
 * Defensive old→new value rendering for the global audit feed (R4).
 * `previousValue`/`newValue` are loose JSON server-side — this helper never
 * throws regardless of shape: null/undefined degrade to an em-dash, plain
 * objects render one "key: value" line per field (e.g. limits deltas),
 * everything else falls back to String(v).
 */
export function renderValue(v: unknown): string {
  if (v === null || v === undefined) {
    return '—';
  }

  if (isPlainObject(v)) {
    return Object.entries(v)
      .map(([key, value]) => `${key}: ${primitiveToString(value)}`)
      .join('\n');
  }

  return String(v);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function primitiveToString(v: unknown): string {
  if (v === null || v === undefined) {
    return '—';
  }

  return String(v);
}

// Q4 — free-string `action`; known values map to es-AR labels, unmapped
// values render raw rather than throwing.
const ACTION_LABELS: Record<string, string> = {
  TENANT_STATUS_CHANGED: 'Estado',
  TENANT_LIMITS_UPDATED: 'Límites',
  // A4 — VIEWPRO_NATIVE operator-management actions.
  OPERATOR_CREATED: 'Operador creado',
  OPERATOR_ROLE_CHANGED: 'Rol de operador cambiado',
  OPERATOR_SUSPENDED: 'Operador suspendido',
  OPERATOR_REACTIVATED: 'Operador reactivado'
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}
