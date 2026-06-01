import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createTeamInvitation,
  createUser,
  deleteUser,
  deactivateTeamMember,
  getTeamInvitations,
  getTeamInvitationsOrEmptyOnForbidden,
  getUsers,
  resendTeamInvitation,
  revokeTeamInvitation,
  updateTeamMemberRole,
  updateUser
} from './service';

const teamMembersResponse = {
  items: [
    {
      membershipId: 'membership-1',
      userId: 'user-1',
      email: 'ana@example.com',
      firstName: 'Ana',
      lastName: 'Gómez',
      userStatus: 'ACTIVE',
      role: 'MANAGER',
      membershipStatus: 'ACTIVE',
      deactivatedAt: null,
      deactivatedByUserId: null,
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-02T10:00:00.000Z'
    }
  ]
};

const invitationResponse = {
  invitationId: 'invitation-1',
  email: 'agente@example.com',
  role: 'AGENT',
  status: 'PENDING',
  expiresAt: '2026-06-14T10:00:00.000Z',
  invitationUrl: 'http://localhost:3000/team-invitations/raw-token-1'
};

const pendingInvitationsResponse = {
  items: [
    {
      invitationId: 'invitation-1',
      email: 'agente@example.com',
      role: 'AGENT',
      status: 'PENDING',
      expiresAt: '2026-06-14T10:00:00.000Z',
      createdAt: '2026-05-31T10:00:00.000Z',
      invitedByUserId: 'user-1'
    }
  ]
};

const revokeResponse = {
  invitationId: 'invitation-1',
  email: 'agente@example.com',
  role: 'AGENT',
  status: 'REVOKED',
  expiresAt: '2026-06-14T10:00:00.000Z',
  revokedAt: '2026-06-01T10:00:00.000Z'
};

const updatedMemberResponse = {
  membershipId: 'membership-1',
  userId: 'user-1',
  email: 'ana@example.com',
  firstName: 'Ana',
  lastName: 'Gómez',
  userStatus: 'ACTIVE',
  role: 'AGENT',
  membershipStatus: 'ACTIVE',
  deactivatedAt: null,
  deactivatedByUserId: null,
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-03T10:00:00.000Z'
};

const deactivatedMemberResponse = {
  ...updatedMemberResponse,
  membershipStatus: 'DEACTIVATED',
  deactivatedAt: '2026-06-01T10:00:00.000Z',
  deactivatedByUserId: 'user-principal',
  updatedAt: '2026-06-01T10:00:00.000Z'
};

describe('users API service', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads team members through the users BFF route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(teamMembersResponse), {
        headers: { 'content-type': 'application/json' },
        status: 200
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(getUsers()).resolves.toEqual(teamMembersResponse);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/users',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        signal: expect.any(AbortSignal)
      })
    );
  });

  it('forwards provided server request headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(teamMembersResponse), {
        headers: { 'content-type': 'application/json' },
        status: 200
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const requestHeaders = new Headers({
      cookie: 'viewpro_session=session-token',
      'x-tenant-id': 'tenant-1'
    });

    await expect(getUsers({}, { headers: requestHeaders })).resolves.toEqual(teamMembersResponse);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/users',
      expect.objectContaining({
        headers: requestHeaders
      })
    );
  });

  it('loads pending team invitations through the explicit team invitations BFF route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(pendingInvitationsResponse), {
        headers: { 'content-type': 'application/json' },
        status: 200
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(getTeamInvitations()).resolves.toEqual(pendingInvitationsResponse);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/team/invitations',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        signal: expect.any(AbortSignal)
      })
    );
  });

  it('returns an empty pending invitation list when management is forbidden', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Insufficient permissions' }), {
        headers: { 'content-type': 'application/json' },
        status: 403
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(getTeamInvitationsOrEmptyOnForbidden()).resolves.toEqual({ items: [] });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/team/invitations',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        signal: expect.any(AbortSignal)
      })
    );
  });

  it('creates a team invitation through the explicit team invitations BFF route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(invitationResponse), {
        headers: { 'content-type': 'application/json' },
        status: 201
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createTeamInvitation({ email: 'agente@example.com', role: 'AGENT' })
    ).resolves.toEqual(invitationResponse);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/team/invitations',
      expect.objectContaining({
        body: JSON.stringify({ email: 'agente@example.com', role: 'AGENT' }),
        cache: 'no-store',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        method: 'POST',
        signal: expect.any(AbortSignal)
      })
    );
  });

  it('regenerates a team invitation link through the action BFF route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(invitationResponse), {
        headers: { 'content-type': 'application/json' },
        status: 200
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(resendTeamInvitation('invitation 1')).resolves.toEqual(invitationResponse);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/team/invitations/invitation%201/resend',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        method: 'POST',
        signal: expect.any(AbortSignal)
      })
    );
  });

  it('revokes a team invitation through the action BFF route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(revokeResponse), {
        headers: { 'content-type': 'application/json' },
        status: 200
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(revokeTeamInvitation('invitation-1')).resolves.toEqual(revokeResponse);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/team/invitations/invitation-1/revoke',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        method: 'POST',
        signal: expect.any(AbortSignal)
      })
    );
  });

  it('updates a team member role through the team members BFF route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(updatedMemberResponse), {
        headers: { 'content-type': 'application/json' },
        status: 200
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(updateTeamMemberRole('membership 1', { role: 'AGENT' })).resolves.toEqual(
      updatedMemberResponse
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/team/members/membership%201/role',
      expect.objectContaining({
        body: JSON.stringify({ role: 'AGENT' }),
        cache: 'no-store',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        method: 'PATCH',
        signal: expect.any(AbortSignal)
      })
    );
  });

  it('deactivates a team member through the team members BFF route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(deactivatedMemberResponse), {
        headers: { 'content-type': 'application/json' },
        status: 200
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(deactivateTeamMember('membership-1')).resolves.toEqual(deactivatedMemberResponse);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/team/members/membership-1/deactivate',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        method: 'POST',
        signal: expect.any(AbortSignal)
      })
    );
  });

  it('fails honestly for unsupported mutations', async () => {
    await expect(createUser()).rejects.toThrow('User creation is not supported yet.');
    await expect(updateUser()).rejects.toThrow('User updates are not supported yet.');
    await expect(deleteUser()).rejects.toThrow('User deletion is not supported yet.');
  });
});
