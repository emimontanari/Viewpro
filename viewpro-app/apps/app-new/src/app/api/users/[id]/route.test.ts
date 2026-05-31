import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { DELETE, PUT } from './route';

describe('single user BFF route', () => {
  it('returns unsupported for PUT', async () => {
    const response = await PUT(
      new NextRequest('http://localhost/api/users/user-1', {
        body: JSON.stringify({ firstName: 'Updated' }),
        method: 'PUT'
      }),
      { params: Promise.resolve({ id: 'user-1' }) }
    );

    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toMatchObject({
      message: expect.stringMatching(/not supported|unsupported/i)
    });
  });

  it('returns unsupported for DELETE', async () => {
    const response = await DELETE(new NextRequest('http://localhost/api/users/user-1'), {
      params: Promise.resolve({ id: 'user-1' })
    });

    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toMatchObject({
      message: expect.stringMatching(/not supported|unsupported/i)
    });
  });
});
