import { bffRequest, isBffError } from '@/lib/bff-client';
import type {
  CreateTeamInvitationPayload,
  PendingTeamInvitationsResponse,
  TeamInvitationLinkResponse,
  TeamInvitationResponse,
  UpdateTeamMemberRolePayload,
  User,
  UserFilters,
  UserMutationPayload,
  UsersResponse
} from './types';

const USERS_API_PATH = '/api/users';
const TEAM_INVITATIONS_API_PATH = '/api/team/invitations';
const TEAM_MEMBERS_API_PATH = '/api/team/members';
const USERS_REQUEST_TIMEOUT_MS = 10_000;

const options = { timeoutMs: USERS_REQUEST_TIMEOUT_MS };

export async function getUsers(
  _filters: UserFilters = {},
  init: RequestInit = {}
): Promise<UsersResponse> {
  return bffRequest<UsersResponse>(USERS_API_PATH, init, options);
}

export async function getTeamInvitations(
  init: RequestInit = {}
): Promise<PendingTeamInvitationsResponse> {
  return bffRequest<PendingTeamInvitationsResponse>(TEAM_INVITATIONS_API_PATH, init, options);
}

export async function getTeamInvitationsOrEmptyOnForbidden(
  init: RequestInit = {}
): Promise<PendingTeamInvitationsResponse> {
  try {
    return await getTeamInvitations(init);
  } catch (error) {
    // A member who cannot see invitations is not an error to report: the panel
    // renders empty. Only 403 — anything else still propagates, because a 500
    // silently rendering "no invitations" is how a real outage looks like a
    // quiet team.
    if (isBffError(error) && error.status === 403) {
      return { items: [] };
    }

    throw error;
  }
}

export async function createTeamInvitation(
  data: CreateTeamInvitationPayload
): Promise<TeamInvitationLinkResponse> {
  return bffRequest<TeamInvitationLinkResponse>(
    TEAM_INVITATIONS_API_PATH,
    {
      body: JSON.stringify(data),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    },
    options
  );
}

export async function resendTeamInvitation(id: string): Promise<TeamInvitationLinkResponse> {
  return bffRequest<TeamInvitationLinkResponse>(
    teamInvitationActionPath(id, 'resend'),
    { method: 'POST' },
    options
  );
}

export async function revokeTeamInvitation(id: string): Promise<TeamInvitationResponse> {
  return bffRequest<TeamInvitationResponse>(
    teamInvitationActionPath(id, 'revoke'),
    { method: 'POST' },
    options
  );
}

export async function updateTeamMemberRole(
  membershipId: string,
  payload: UpdateTeamMemberRolePayload
): Promise<User> {
  return bffRequest<User>(
    teamMemberActionPath(membershipId, 'role'),
    {
      body: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' },
      method: 'PATCH'
    },
    options
  );
}

export async function deactivateTeamMember(membershipId: string): Promise<User> {
  return bffRequest<User>(
    teamMemberActionPath(membershipId, 'deactivate'),
    { method: 'POST' },
    options
  );
}

export async function createUser(_data?: UserMutationPayload): Promise<never> {
  throw new Error('User creation is not supported yet.');
}

export async function updateUser(
  _id?: number | string,
  _data?: UserMutationPayload
): Promise<never> {
  throw new Error('User updates are not supported yet.');
}

export async function deleteUser(_id?: number | string): Promise<never> {
  throw new Error('User deletion is not supported yet.');
}

function teamInvitationActionPath(id: string, action: 'resend' | 'revoke') {
  return `${TEAM_INVITATIONS_API_PATH}/${encodeURIComponent(id)}/${action}`;
}

function teamMemberActionPath(membershipId: string, action: 'role' | 'deactivate') {
  return `${TEAM_MEMBERS_API_PATH}/${encodeURIComponent(membershipId)}/${action}`;
}
