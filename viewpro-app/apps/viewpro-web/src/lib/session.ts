// WU-1 stub — will be expanded in WU-2 (T-09/T-10).
// Operator-only session: no memberships, no tenant context (D2).
import { apiRequest } from './api-client';

export type Session = {
  operator: { id: string; email: string };
};

export type LoginInput = {
  email: string;
  password: string;
};

export function login(input: LoginInput) {
  return apiRequest<Session>('/auth/login', {
    body: input,
    method: 'POST'
  });
}

export function getSession() {
  return apiRequest<Session>('/auth/me');
}

// Server-side logout: instructs viewpro-api to clear the httpOnly cookie.
// Best-effort — errors are intentionally swallowed by the caller (signOut in session-context).
export function logout(): Promise<unknown> {
  return apiRequest<unknown>('/auth/logout', { method: 'POST' });
}

// Step-up re-authentication (D6/D13): re-verifies the operator's current
// password and, on success, sets a short-lived step-up cookie server-side.
// A 401 here (wrong password) is scoped to this call and handled inline by
// the caller (useStepUpGate) — never treated as a session-expiry logout.
export function stepUp(password: string): Promise<{ success: true }> {
  return apiRequest<{ success: true }>('/auth/step-up', {
    body: { password },
    method: 'POST'
  });
}
