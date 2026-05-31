import { apiRequest } from '@/lib/api-client';
import type {
  AcceptTeamInvitationInput,
  TeamInvitationResponse,
  TeamInvitationSession
} from './types';

export function getTeamInvitation(token: string) {
  return apiRequest<TeamInvitationResponse>(`/team-invitations/${encodeURIComponent(token)}`, {
    cache: 'no-store',
    method: 'GET'
  });
}

export function acceptTeamInvitation(token: string, input: AcceptTeamInvitationInput) {
  return apiRequest<TeamInvitationSession>(
    `/team-invitations/${encodeURIComponent(token)}/accept`,
    {
      body: input,
      method: 'POST'
    }
  );
}
