import { isPublicErrorCode, type PublicErrorCode } from '@viewpro/contracts';

const DEFAULT_API_URL = 'http://localhost:3001/api';
const GENERIC_API_ERROR_MESSAGE = 'La solicitud falló.';
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type ApiError = {
  status: number;
  message: string;
  errorCode?: PublicErrorCode;
  requestId?: string;
};

type ApiRequestOptions = Omit<RequestInit, 'body' | 'credentials'> & {
  body?: unknown;
  tenantId?: string | null;
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
  const { body, headers, tenantId, ...requestOptions } = options;
  const requestHeaders = new Headers(headers);

  if (tenantId) {
    requestHeaders.set('x-tenant-id', tenantId);
  }

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

  try {
    const text = await response.text();
    if (!text) {
      return undefined;
    }

    try {
      return JSON.parse(text) as unknown;
    } catch {
      return undefined;
    }
  } catch {
    return undefined;
  }
}

function toApiError(response: Response, body: unknown): ApiError {
  const parsedBody = asRecord(body);
  const errorCode = isPublicErrorCode(parsedBody?.errorCode) ? parsedBody.errorCode : undefined;
  const requestId = isCanonicalRequestId(parsedBody?.requestId) ? parsedBody.requestId : undefined;

  return {
    status: response.status,
    message: GENERIC_API_ERROR_MESSAGE,
    ...(errorCode ? { errorCode } : {}),
    ...(requestId ? { requestId } : {})
  };
}

function asRecord(body: unknown): Record<string, unknown> | undefined {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : undefined;
}

function isCanonicalRequestId(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4_PATTERN.test(value);
}

function normalizeApiPath(path: string) {
  return path.startsWith('/') ? path : `/${path}`;
}

function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
