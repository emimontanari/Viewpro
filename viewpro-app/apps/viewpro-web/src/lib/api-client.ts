// viewpro-web talks ONLY to viewpro-api (Design B isolation).
// Point NEXT_PUBLIC_API_URL at http://localhost:3002/api locally.
const DEFAULT_API_URL = 'http://localhost:3002/api';

export type ApiError = {
  status: number;
  message: string;
  details?: unknown;
};

type ApiRequestOptions = Omit<RequestInit, 'body' | 'credentials'> & {
  body?: unknown;
};

type ErrorResponseBody = {
  message?: string | string[];
  error?: string;
  statusCode?: number;
};

export const apiUrl = trimTrailingSlash(process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL);

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
    details: body,
    message,
    status: response.status
  };
}

function isErrorResponseBody(body: unknown): body is ErrorResponseBody {
  if (!body || typeof body !== 'object') {
    return false;
  }

  const candidate = body as { error?: unknown; message?: unknown; statusCode?: unknown };
  const hasValidMessage =
    candidate.message === undefined ||
    typeof candidate.message === 'string' ||
    (Array.isArray(candidate.message) &&
      candidate.message.every((message) => typeof message === 'string'));
  const hasValidError = candidate.error === undefined || typeof candidate.error === 'string';
  const hasValidStatusCode =
    candidate.statusCode === undefined || typeof candidate.statusCode === 'number';

  return hasValidMessage && hasValidError && hasValidStatusCode;
}

function normalizeApiPath(path: string) {
  return path.startsWith('/') ? path : `/${path}`;
}

function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
