import { apiRequest } from '@/lib/api-client';
import type { Session } from '@/lib/session';
import type { AcceptOwnerInvitationInput, OwnerInvitationResponse } from './types';

export function getOwnerInvitation(token: string) {
  return apiRequest<OwnerInvitationResponse>(`/owner-invitations/${encodeURIComponent(token)}`, {
    cache: 'no-store',
    method: 'GET'
  });
}

export function acceptOwnerInvitation(token: string, input: AcceptOwnerInvitationInput) {
  return apiRequest<Session>(`/owner-invitations/${encodeURIComponent(token)}/accept`, {
    body: input,
    method: 'POST'
  });
}
