/**
 * Who may enter the /admin route tree, decided on the server.
 *
 * Navigation filtering (#284) hides the admin entry from a seller's sidebar,
 * but hiding a link is not a boundary: typing the URL still rendered the admin
 * shell, and every call behind it then failed with the API's own 403. The user
 * saw a console that looked broken instead of one that refused them.
 *
 * This is UX, never authorization. `GlobalAdminGuard` on the API remains the
 * only thing standing between a request and admin data; this module exists so
 * the interface stops promising a door the API will shut.
 */

export const OPERATIONAL_HOME_PATH = '/dashboard';
export const SIGN_IN_PATH = '/auth/sign-in';

export const ADMIN_DENIED_MESSAGE = 'No tenés acceso a la consola de administración.';
export const ADMIN_UNAVAILABLE_MESSAGE =
  'No pudimos verificar tus permisos. Probá de nuevo en un momento.';

/** What the server managed to learn about the visitor before deciding. */
export type AdminAccessProbe =
  | { kind: 'session'; globalRole: string; userStatus: string }
  | { kind: 'unauthenticated' }
  | { kind: 'unavailable' };

export type AdminAccessDecision =
  | { kind: 'allow' }
  | { kind: 'deny'; redirectTo: string; message: string }
  | { kind: 'unauthenticated'; redirectTo: string }
  | { kind: 'unavailable'; redirectTo: string; message: string };

const VIEWPRO_ADMIN = 'VIEWPRO_ADMIN';
const ACTIVE = 'ACTIVE';

export function decideAdminRouteAccess(probe: AdminAccessProbe): AdminAccessDecision {
  if (probe.kind === 'unauthenticated') {
    return { kind: 'unauthenticated', redirectTo: SIGN_IN_PATH };
  }

  // Fail closed, but do not call it a denial. An outage that reports "you lack
  // permission" sends an admin to argue about their role instead of looking at
  // the outage.
  if (probe.kind === 'unavailable') {
    return {
      kind: 'unavailable',
      redirectTo: OPERATIONAL_HOME_PATH,
      message: ADMIN_UNAVAILABLE_MESSAGE
    };
  }

  // Mirrors GlobalAdminGuard exactly: both the role and an active account.
  // Diverging here would put the UI and the API on different answers.
  if (probe.globalRole !== VIEWPRO_ADMIN || probe.userStatus !== ACTIVE) {
    return {
      kind: 'deny',
      redirectTo: OPERATIONAL_HOME_PATH,
      message: ADMIN_DENIED_MESSAGE
    };
  }

  return { kind: 'allow' };
}

export const ADMIN_ACCESS_PARAM = 'adminAccess';

export const ADMIN_ACCESS_DENIED_MARKER = 'denied';
export const ADMIN_ACCESS_UNAVAILABLE_MARKER = 'unavailable';

// A Map, not an object literal: the marker comes from the URL, and indexing a
// plain object with it resolves inherited Object.prototype keys. `?adminAccess=
// toString` returned a function, which `?? null` does not catch because a
// function is neither null nor undefined. A Map has no inherited keys.
const NOTICE_MESSAGES = new Map<string, string>([
  [ADMIN_ACCESS_DENIED_MARKER, ADMIN_DENIED_MESSAGE],
  [ADMIN_ACCESS_UNAVAILABLE_MARKER, ADMIN_UNAVAILABLE_MESSAGE]
]);

/** Where to send the visitor, carrying a fixed marker the home screen can read. */
export function adminAccessRedirectPath(decision: AdminAccessDecision): string {
  switch (decision.kind) {
    case 'deny':
      return `${OPERATIONAL_HOME_PATH}?${ADMIN_ACCESS_PARAM}=${ADMIN_ACCESS_DENIED_MARKER}`;
    case 'unavailable':
      return `${OPERATIONAL_HOME_PATH}?${ADMIN_ACCESS_PARAM}=${ADMIN_ACCESS_UNAVAILABLE_MARKER}`;
    case 'unauthenticated':
      // No marker: nothing was denied and nothing broke, and a notice about
      // admin access would be noise on a login screen.
      return SIGN_IN_PATH;
    case 'allow':
      // Asking where to redirect someone who was let through is a caller bug.
      // Answering with a plausible path would hide it.
      throw new Error('adminAccessRedirectPath called for an allowed visitor');
  }
}

/**
 * The notice for a marker read back from the URL.
 *
 * The value is reachable by anyone who can type in the address bar, so only the
 * exact markers this module writes produce copy. Anything else is nothing.
 */
export function adminAccessNoticeMessage(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return NOTICE_MESSAGES.get(value) ?? null;
}

const AUTH_ME_TIMEOUT_MS = 3_000;
/**
 * One retry, because a single 3s call with none ejects an authorized admin from
 * the whole console on one dropped connection or one API restart — precisely
 * during the incident they opened the console to look at.
 */
const PROBE_ATTEMPTS = 2;

export type ProbeDeps = {
  fetchImpl: typeof fetch;
  apiUrl: string;
  cookieHeader: string;
};

/**
 * Ask the API who the visitor is, and classify the answer.
 *
 * Separated from the layout so every branch below is reachable from a test: the
 * layout that used to hold this had no coverage at all.
 */
export async function probeAdminAccess({
  fetchImpl,
  apiUrl,
  cookieHeader
}: ProbeDeps): Promise<AdminAccessProbe> {
  let last: AdminAccessProbe = { kind: 'unavailable' };

  for (let attempt = 0; attempt < PROBE_ATTEMPTS; attempt += 1) {
    last = await probeOnce({ fetchImpl, apiUrl, cookieHeader });

    // Only an unavailable answer is worth asking again. A verdict is a verdict.
    if (last.kind !== 'unavailable') {
      return last;
    }
  }

  return last;
}

async function probeOnce({
  fetchImpl,
  apiUrl,
  cookieHeader
}: ProbeDeps): Promise<AdminAccessProbe> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUTH_ME_TIMEOUT_MS);

  try {
    const response = await fetchImpl(`${apiUrl}/auth/me`, {
      cache: 'no-store',
      credentials: 'include',
      headers: { cookie: cookieHeader },
      signal: controller.signal
    });

    // 401 is the only status this endpoint uses to say "not signed in".
    if (response.status === 401) {
      return { kind: 'unauthenticated' };
    }

    // A 403 is NOT treated as a denial. /auth/me runs no permission check of
    // its own — the role comparison happens further down in this module — so a
    // 403 here comes from something in front of the API: a WAF rule, an edge
    // rate limiter shedding load, an expired upstream credential. Reading it as
    // a verdict tells a real admin they lack access during an incident, which
    // is the exact lie this module exists to avoid. Failing to "we could not
    // check" is the honest direction: it asks them to retry instead of sending
    // them to argue about a role they do have.
    if (!response.ok) {
      return { kind: 'unavailable' };
    }

    const body = (await response.json().catch(() => undefined)) as
      | { user?: { globalRole?: unknown; status?: unknown } }
      | undefined;

    // A response we cannot read is an outage, not a permission verdict. Telling
    // someone they lack access because the body was the wrong shape is a lie.
    if (
      typeof body?.user?.globalRole !== 'string' ||
      typeof body.user.status !== 'string'
    ) {
      return { kind: 'unavailable' };
    }

    return {
      kind: 'session',
      globalRole: body.user.globalRole,
      userStatus: body.user.status
    };
  } catch {
    return { kind: 'unavailable' };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Where the admin probe should call, and whether that was actually configured.
 *
 * The localhost default keeps local development working, but in a deployed
 * build it is a lie: every probe dials a port nothing answers, both attempts
 * fail, and every administrator is bounced out with "we could not verify your
 * permissions" — a total lockout produced by a missing environment variable and
 * indistinguishable at runtime from a real outage. Callers get the fact back so
 * they can say so out loud instead of leaving it to be guessed.
 */
export const DEFAULT_ADMIN_PROBE_API_URL = 'http://localhost:3001/api';

export function resolveAdminProbeApiUrl(configured: string | undefined): {
  url: string;
  usingFallback: boolean;
} {
  const trimmed = configured?.trim();

  if (!trimmed) {
    return { url: DEFAULT_ADMIN_PROBE_API_URL, usingFallback: true };
  }

  return { url: trimmed.replace(/\/$/, ''), usingFallback: false };
}
