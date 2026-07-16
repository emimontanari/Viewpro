// viewpro-web talks ONLY to viewpro-api (Design B isolation).
// Point NEXT_PUBLIC_API_URL at http://localhost:3002/api locally.
const DEFAULT_API_URL = 'http://localhost:3002/api';

export type ApiError = {
  status: number;
  message: string;
  code?: string;
  details?: unknown;
};

type ApiRequestOptions = Omit<RequestInit, 'body' | 'credentials'> & {
  body?: unknown;
};

type ErrorResponseBody = {
  message?: string | string[];
  error?: string;
  statusCode?: number;
  code?: string;
};

export const apiUrl = trimTrailingSlash(process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL);

// D7: a 401 from a login/step-up/logout ATTEMPT means bad credentials, not an
// expired session — those must stay inline instead of bouncing to sign-in.
// `/auth/me` is the SessionProvider session probe fired on EVERY route
// (including /auth/sign-in): its 401 is already handled softly by
// session-context (router.push, a client-side no-op on the sign-in page).
// Letting the hard-redirect interceptor also handle it loops a logged-out
// visitor forever (assign → reload → remount → /auth/me 401 → assign …), so
// the probe is exempt here — the interceptor exists for 401s on AUTHENTICATED
// FEATURE requests (tenants/audit/limits) that have no other handler.
const SESSION_EXEMPT_401_PATHS = ['/auth/login', '/auth/step-up', '/auth/logout', '/auth/me'];

// Suppresses duplicate sign-in redirects when several concurrent requests
// all come back 401 at once (e.g. a page firing multiple queries).
let redirecting = false;

// bfcache: a document restored from the back/forward cache keeps module state,
// so `redirecting` would stay `true` after a prior redirect and silently
// swallow a later legitimate session-expiry redirect. Reset it on
// pageshow/pagehide so a restored page can redirect again. SSR-safe.
if (typeof window !== 'undefined') {
  const resetRedirecting = () => {
    redirecting = false;
  };
  window.addEventListener('pageshow', resetRedirecting);
  window.addEventListener('pagehide', resetRedirecting);
}

// Sends the operator back to sign-in with a session-expired indication,
// preserving the current location as `redirect_url`. SSR-safe, deduped, and —
// belt-and-suspenders against the sign-in 401 loop — a no-op when the browser
// is already on any `/auth/*` route (so even a future exempt-list miss can
// never bounce the sign-in page onto itself).
export function redirectToSignIn() {
  if (typeof window === 'undefined' || redirecting) {
    return;
  }

  if (window.location.pathname.startsWith('/auth/')) {
    return;
  }

  redirecting = true;
  const redirectUrl = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.assign(`/auth/sign-in?reason=session_expired&redirect_url=${redirectUrl}`);
}

export function getApiErrorMessage(error: unknown) {
  if (isApiError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Algo salió mal. Volvé a intentarlo.';
}

export function isApiError(error: unknown): error is ApiError {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  );
}

// The API's AuthGuard rejects an expired/absent ACCESS session with a 401
// carrying the STABLE error code AUTH_REQUIRED — thrown BEFORE any handler runs,
// for every reject path (missing/invalid token, missing/non-finite sessionExp,
// past absolute deadline). Keying off the code (not the human message)
// distinguishes a session-expiry 401 from a DOMAIN 401 such as a wrong step-up
// password (StepUpUseCase → "Invalid password", NO code) and survives copy
// changes. Callers on interceptor-exempt paths (e.g. /auth/step-up) use this to
// still bounce an EXPIRED session to sign-in without misreading a genuine wrong
// password as an expiry.
export function isSessionExpiredError(error: unknown): error is ApiError {
  return isApiError(error) && error.status === 401 && error.code === 'AUTH_REQUIRED';
}

// D12: distinguishes a step-up-gated 403 from every other error so callers can
// re-open the step-up modal instead of treating it as a generic failure (or,
// worse, a 401 that would trigger a logout).
export function isStepUpRequiredError(error: unknown): error is ApiError {
  return isApiError(error) && error.status === 403 && error.code === 'STEP_UP_REQUIRED';
}

export async function apiRequest<TResponse>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<TResponse> {
  // No x-tenant-id: operators are global, not scoped to a tenant (Design B isolation).
  const { body, headers, ...requestOptions } = options;
  const requestHeaders = new Headers(headers);

  const requestBody = body === undefined ? undefined : JSON.stringify(body);

  if (requestBody && !requestHeaders.has('content-type')) {
    requestHeaders.set('content-type', 'application/json');
  }

  const response = await fetch(`${apiUrl}${normalizeApiPath(path)}`, {
    ...requestOptions,
    body: requestBody,
    credentials: 'include',
    headers: requestHeaders
  });

  const responseBody = await parseJsonResponse(response);

  if (!response.ok) {
    // D7: any authenticated 401 (not a login/step-up/logout/me attempt) means
    // the session expired — send the operator back to sign-in. A 403 (e.g.
    // STEP_UP_REQUIRED) is untouched by construction: this only matches 401.
    if (response.status === 401 && !SESSION_EXEMPT_401_PATHS.includes(normalizeApiPath(path))) {
      redirectToSignIn();
    }

    throw toApiError(response, responseBody);
  }

  return responseBody as TResponse;
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const text = await response.text();
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function toApiError(response: Response, body: unknown): ApiError {
  const parsedBody = isErrorResponseBody(body) ? body : undefined;
  const message = Array.isArray(parsedBody?.message)
    ? parsedBody.message.join(', ')
    : parsedBody?.message || parsedBody?.error || response.statusText || 'La solicitud falló.';

  return {
    code: parsedBody?.code,
    details: body,
    message,
    status: response.status
  };
}

function isErrorResponseBody(body: unknown): body is ErrorResponseBody {
  if (!body || typeof body !== 'object') {
    return false;
  }

  const candidate = body as {
    error?: unknown;
    message?: unknown;
    statusCode?: unknown;
    code?: unknown;
  };
  const hasValidMessage =
    candidate.message === undefined ||
    typeof candidate.message === 'string' ||
    (Array.isArray(candidate.message) &&
      candidate.message.every((message) => typeof message === 'string'));
  const hasValidError = candidate.error === undefined || typeof candidate.error === 'string';
  const hasValidStatusCode =
    candidate.statusCode === undefined || typeof candidate.statusCode === 'number';
  const hasValidCode = candidate.code === undefined || typeof candidate.code === 'string';

  return hasValidMessage && hasValidError && hasValidStatusCode && hasValidCode;
}

function normalizeApiPath(path: string) {
  return path.startsWith('/') ? path : `/${path}`;
}

function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
