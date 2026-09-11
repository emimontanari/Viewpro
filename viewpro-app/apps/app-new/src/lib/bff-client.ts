import { isPublicErrorCode, type PublicErrorCode } from '@viewpro/contracts';

export type { PublicErrorCode };

/**
 * The client used by feature services to reach this app's own BFF routes under
 * `src/app/api/**`.
 *
 * Separate from `@/lib/api-client` on purpose: that one calls the backend
 * directly at NEXT_PUBLIC_API_URL, this one calls the 58 route handlers this
 * app owns. Same error contract, different transport — the nine private copies
 * this replaces existed because of the transport and drifted on the contract.
 */

const APP_URL =
  typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');
const CANONICAL_UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let latestApplicationRequestId: string | undefined;

export function getLatestApplicationRequestId(): string | undefined {
  return typeof window === 'undefined' ? undefined : latestApplicationRequestId;
}

export function clearLatestApplicationRequestId(): void {
  latestApplicationRequestId = undefined;
}

/**
 * What the app is allowed to know about a failed BFF call.
 *
 * No server prose. The route handlers proxy the backend body through, so the
 * backend's own sentence used to become the toast an operator read — copy
 * nobody wrote for a user. `errorCode` is validated against the frozen
 * catalogue, so an unrecognised one is dropped rather than trusted.
 */
export class BffError extends Error {
  readonly status: number;
  readonly errorCode?: PublicErrorCode;
  readonly requestId?: string;

  constructor(status: number, errorCode?: PublicErrorCode, requestId?: string) {
    super(GENERIC_BFF_ERROR_MESSAGE);
    this.name = 'BffError';
    this.status = status;
    this.errorCode = errorCode;
    this.requestId = canonicalRequestId(requestId);
  }
}

export const GENERIC_BFF_ERROR_MESSAGE = 'No pudimos completar la solicitud.';

export function isBffError(error: unknown): error is BffError {
  return error instanceof BffError;
}

/** True when the failure carries this exact catalogued code. */
export function hasErrorCode(error: unknown, code: PublicErrorCode): boolean {
  return isBffError(error) && error.errorCode === code;
}

export type BffRequestOptions = {
  /**
   * Abort the request after this long. Every private client this replaces
   * carried its own AbortController, so migrating one without a timeout would
   * silently remove a guard the feature already had.
   */
  timeoutMs?: number;
};

export async function bffRequest<TResponse>(
  path: string,
  init: RequestInit = {},
  options: BffRequestOptions = {}
): Promise<TResponse> {
  const url = path.startsWith('http') ? path : `${APP_URL}${path}`;
  const callerSignal = init.signal;
  const controller = options.timeoutMs ? new AbortController() : undefined;
  const relayCallerAbort = () => controller?.abort();
  if (controller && callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener('abort', relayCallerAbort, { once: true });
  }
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), options.timeoutMs)
    : undefined;

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      // After the spread, not before: a caller must not be able to turn these
      // off by accident. `credentials: 'omit'` would silently drop auth and
      // `force-cache` would serve another tenant's data from the bfcache.
      cache: 'no-store',
      credentials: 'include',
      ...(controller ? { signal: controller.signal } : {})
    });
  } catch (error) {
    // 408 rather than a distinct type: callers already branch on status, and a
    // timeout is a request that did not complete in time — which is what 408 says.
    if (error instanceof Error && error.name === 'AbortError') {
      throw new BffError(408);
    }
    throw new BffError(502);
  } finally {
    if (controller && callerSignal) callerSignal.removeEventListener('abort', relayCallerAbort);
    if (timeoutId) clearTimeout(timeoutId);
  }

  const headerRequestId = canonicalRequestId(response.headers.get('x-request-id'));

  if (response.status === 204) {
    captureApplicationRequestId(headerRequestId);
    return undefined as TResponse;
  }

  const body = await response.json().catch(() => undefined);
  const requestId = headerRequestId ?? canonicalRequestId(requestIdFromBody(body));
  captureApplicationRequestId(requestId);

  if (!response.ok) {
    throw toBffError(response, body, requestId);
  }

  return body as TResponse;
}

function captureApplicationRequestId(requestId: string | undefined): void {
  if (typeof window !== 'undefined' && requestId) {
    latestApplicationRequestId = requestId;
  }
}

function canonicalRequestId(value: unknown): string | undefined {
  return typeof value === 'string' && CANONICAL_UUID_V4.test(value) ? value : undefined;
}

function requestIdFromBody(body: unknown): unknown {
  return body && typeof body === 'object' ? (body as Record<string, unknown>).requestId : undefined;
}

export function toBffError(response: Response, body: unknown, requestId?: string): BffError {
  const parsed = body && typeof body === 'object' ? (body as Record<string, unknown>) : undefined;
  const errorCode = isPublicErrorCode(parsed?.errorCode) ? parsed.errorCode : undefined;

  return new BffError(
    response.status,
    errorCode,
    canonicalRequestId(requestId) ??
      canonicalRequestId(response.headers.get('x-request-id')) ??
      canonicalRequestId(requestIdFromBody(body))
  );
}

/**
 * The sentence to show for a failure.
 *
 * A BffError carries nothing showable — its message is the generic, on purpose —
 * so the caller's own copy wins. An Error thrown locally is different: the app
 * wrote that sentence, and it is usually more specific than any fallback
 * ('La carga del documento tardó demasiado.' beats 'No se pudo subir el
 * documento'). This keeps that distinction in one place instead of asking every
 * `onError` to remember it.
 */
export function messageFor(error: unknown, fallback: string): string {
  if (isBffError(error)) {
    return fallback;
  }

  return error instanceof Error && error.message ? error.message : fallback;
}
