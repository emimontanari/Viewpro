import { describe, expect, it, vi } from 'vitest';
import {
  ADMIN_ACCESS_PARAM,
  ADMIN_DENIED_MESSAGE,
  ADMIN_UNAVAILABLE_MESSAGE,
  decideAdminRouteAccess,
  adminAccessNoticeMessage,
  adminAccessRedirectPath,
  OPERATIONAL_HOME_PATH,
  probeAdminAccess,
  resolveAdminProbeApiUrl,
  SIGN_IN_PATH
} from '../admin-route-access';

describe('decideAdminRouteAccess', () => {
  it('lets a ViewPro admin through', () => {
    expect(
      decideAdminRouteAccess({ kind: 'session', globalRole: 'VIEWPRO_ADMIN', userStatus: 'ACTIVE' })
    ).toEqual({ kind: 'allow' });
  });

  it('sends a plain user back to the operational home, denied', () => {
    const decision = decideAdminRouteAccess({
      kind: 'session',
      globalRole: 'USER',
      userStatus: 'ACTIVE'
    });

    expect(decision).toEqual({
      kind: 'deny',
      redirectTo: OPERATIONAL_HOME_PATH,
      message: ADMIN_DENIED_MESSAGE
    });
  });

  it('denies an admin whose account is not active, mirroring the API guard', () => {
    // GlobalAdminGuard refuses on `status !== ACTIVE` as well as on the role.
    // If the UI let a suspended admin in, every call behind it would 403 and
    // the page would look broken rather than refused.
    for (const userStatus of ['SUSPENDED', 'DEACTIVATED', 'PENDING']) {
      expect(
        decideAdminRouteAccess({ kind: 'session', globalRole: 'VIEWPRO_ADMIN', userStatus }).kind
      ).toBe('deny');
    }
  });

  it('sends someone with no session to sign-in, not to a denial', () => {
    expect(decideAdminRouteAccess({ kind: 'unauthenticated' })).toEqual({
      kind: 'unauthenticated',
      redirectTo: SIGN_IN_PATH
    });
  });

  it('separates "we could not check" from "you are not allowed"', () => {
    // Criterion 8 of #307. Telling an admin they lack permission because the
    // API was unreachable is a lie, and it sends them to argue about
    // permissions instead of looking at the outage.
    const decision = decideAdminRouteAccess({ kind: 'unavailable' });

    expect(decision.kind).toBe('unavailable');
    expect(decision).not.toMatchObject({ message: ADMIN_DENIED_MESSAGE });
    expect(decision).toMatchObject({
      redirectTo: OPERATIONAL_HOME_PATH,
      message: ADMIN_UNAVAILABLE_MESSAGE
    });
  });

  it('never redirects anywhere but a fixed internal path', () => {
    // "sin redirecciones abiertas": every target is a literal owned by this
    // module, so nothing reachable from a URL can steer it.
    const targets = [
      decideAdminRouteAccess({ kind: 'session', globalRole: 'USER', userStatus: 'ACTIVE' }),
      decideAdminRouteAccess({ kind: 'unauthenticated' }),
      decideAdminRouteAccess({ kind: 'unavailable' })
    ].map((d) => ('redirectTo' in d ? d.redirectTo : ''));

    for (const target of targets) {
      expect(target.startsWith('/')).toBe(true);
      expect(target.startsWith('//')).toBe(false);
      expect([OPERATIONAL_HOME_PATH, SIGN_IN_PATH]).toContain(target);
    }
  });
});

describe('adminAccessRedirectPath', () => {
  it('carries a denial as a fixed internal marker', () => {
    const decision = decideAdminRouteAccess({
      kind: 'session',
      globalRole: 'USER',
      userStatus: 'ACTIVE'
    });

    expect(adminAccessRedirectPath(decision)).toBe(
      `${OPERATIONAL_HOME_PATH}?${ADMIN_ACCESS_PARAM}=denied`
    );
  });

  it('marks an unavailable check as its own thing, not as a denial', () => {
    expect(adminAccessRedirectPath(decideAdminRouteAccess({ kind: 'unavailable' }))).toBe(
      `${OPERATIONAL_HOME_PATH}?${ADMIN_ACCESS_PARAM}=unavailable`
    );
  });

  it('sends an unauthenticated visitor to sign-in with no marker at all', () => {
    // Nothing was denied and nothing broke: they are simply not signed in, and
    // a notice about admin access would be noise on a login screen.
    expect(adminAccessRedirectPath(decideAdminRouteAccess({ kind: 'unauthenticated' }))).toBe(
      SIGN_IN_PATH
    );
  });
});

describe('adminAccessNoticeMessage', () => {
  it('maps each marker to the copy this app owns', () => {
    expect(adminAccessNoticeMessage('denied')).toBe(ADMIN_DENIED_MESSAGE);
    expect(adminAccessNoticeMessage('unavailable')).toBe(ADMIN_UNAVAILABLE_MESSAGE);
  });

  it('shows nothing for an absent, unknown or hand-typed marker', () => {
    // The value arrives from the URL, so anyone can type anything there. Only
    // the two markers this module writes produce a notice.
    for (const value of [null, '', 'denied ', 'DENIED', 'whatever', '<script>']) {
      expect(adminAccessNoticeMessage(value)).toBeNull();
    }
  });

  it('returns null for inherited object keys, which are not markers', () => {
    // This was a real defect: the lookup was a plain object literal, so
    // `?adminAccess=toString` resolved Object.prototype.toString and handed
    // back a function. `?? null` never caught it, because a function is
    // neither null nor undefined.
    for (const value of ['toString', 'valueOf', 'constructor', 'hasOwnProperty', '__proto__']) {
      expect(adminAccessNoticeMessage(value)).toBeNull();
    }
  });
});

const deps = (fetchImpl: typeof fetch) => ({
  fetchImpl,
  apiUrl: 'https://api.test/api',
  cookieHeader: 'session=abc'
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });

describe('probeAdminAccess', () => {

  it('reports the session when the API answers with one', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json(200, { user: { globalRole: 'VIEWPRO_ADMIN', status: 'ACTIVE' } })
    );

    await expect(probeAdminAccess(deps(fetchMock as never))).resolves.toEqual({
      kind: 'session',
      globalRole: 'VIEWPRO_ADMIN',
      userStatus: 'ACTIVE'
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/api/auth/me',
      expect.objectContaining({ cache: 'no-store', headers: { cookie: 'session=abc' } })
    );
  });

  it('treats 401 as not signed in', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(401, {}));

    await expect(probeAdminAccess(deps(fetchMock as never))).resolves.toEqual({
      kind: 'unauthenticated'
    });
  });

  it('treats 403 as "could not check", never as a verdict', async () => {
    // /auth/me runs no permission check of its own, so a 403 there comes from
    // something in front of the API — a WAF, an edge rate limiter shedding
    // load. Reading it as a denial tells a real admin they lack access during
    // an incident. An earlier revision of this file did exactly that.
    const fetchMock = vi.fn().mockResolvedValue(json(403, {}));

    await expect(probeAdminAccess(deps(fetchMock as never))).resolves.toEqual({
      kind: 'unavailable'
    });
  });

  it.each([
    ['a 500', json(500, {})],
    ['a body with no user', json(200, {})],
    ['a body whose user is missing its role', json(200, { user: { status: 'ACTIVE' } })],
    ['a body that is not JSON at all', new Response('<html>', { status: 200 })]
  ])('reports %s as unavailable, never as a denial', async (_label, response) => {
    const fetchMock = vi.fn().mockResolvedValue(response);

    await expect(probeAdminAccess(deps(fetchMock as never))).resolves.toEqual({
      kind: 'unavailable'
    });
  });

  it('reports a thrown network failure as unavailable', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(probeAdminAccess(deps(fetchMock as never))).resolves.toEqual({
      kind: 'unavailable'
    });
  });

  it('retries once, so a single blip does not eject an authorized admin', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('connection reset'))
      .mockResolvedValueOnce(json(200, { user: { globalRole: 'VIEWPRO_ADMIN', status: 'ACTIVE' } }));

    await expect(probeAdminAccess(deps(fetchMock as never))).resolves.toMatchObject({
      kind: 'session',
      globalRole: 'VIEWPRO_ADMIN'
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a verdict, only an unavailable answer', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(401, {}));

    await probeAdminAccess(deps(fetchMock as never));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('resolveAdminProbeApiUrl', () => {
  it('uses the configured API and drops a trailing slash', () => {
    expect(resolveAdminProbeApiUrl('https://api.inmoview.app/api/')).toEqual({
      url: 'https://api.inmoview.app/api',
      usingFallback: false
    });
  });

  it('reports that it fell back, so a missing variable is not silent', () => {
    // A deployed build with no API URL dials a local port nothing answers, both
    // probe attempts fail, and every administrator is bounced out with the
    // generic "could not verify" — a lockout caused by configuration and
    // indistinguishable at runtime from an outage unless somebody says so.
    for (const value of [undefined, '', '   ']) {
      expect(resolveAdminProbeApiUrl(value).usingFallback).toBe(true);
    }
  });
});

