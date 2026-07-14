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
