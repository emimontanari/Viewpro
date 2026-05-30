import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUser, deleteUser, getUsers, updateUser } from './service';

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
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-02T10:00:00.000Z'
    }
  ]
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

  it('fails honestly for unsupported mutations', async () => {
    await expect(createUser()).rejects.toThrow('User creation is not supported yet.');
    await expect(updateUser()).rejects.toThrow('User updates are not supported yet.');
    await expect(deleteUser()).rejects.toThrow('User deletion is not supported yet.');
  });
});
