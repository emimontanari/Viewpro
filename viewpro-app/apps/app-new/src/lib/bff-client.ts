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

  constructor(status: number, errorCode?: PublicErrorCode) {
    super(GENERIC_BFF_ERROR_MESSAGE);
    this.name = 'BffError';
    this.status = status;
    this.errorCode = errorCode;
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
  const controller = options.timeoutMs ? new AbortController() : undefined;
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
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  const body = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw toBffError(response, body);
  }

  return body as TResponse;
}

export function toBffError(response: Response, body: unknown): BffError {
  const parsed = body && typeof body === 'object' ? (body as Record<string, unknown>) : undefined;
  const errorCode = isPublicErrorCode(parsed?.errorCode) ? parsed.errorCode : undefined;

  return new BffError(response.status, errorCode);
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
