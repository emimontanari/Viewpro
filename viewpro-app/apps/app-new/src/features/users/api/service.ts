import type { UserFilters, UserMutationPayload, UsersResponse } from './types';

const DEFAULT_APP_URL = 'http://localhost:3000';
const USERS_API_PATH = '/api/users';
const USERS_REQUEST_TIMEOUT_MS = 10_000;
const APP_URL = trimTrailingSlash(process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL);

export async function getUsers(
  _filters: UserFilters = {},
  init: RequestInit = {}
): Promise<UsersResponse> {
  const response = await apiFetch(USERS_API_PATH, init);
  return parseJsonResponse<UsersResponse>(response);
}

export async function createUser(_data?: UserMutationPayload): Promise<never> {
  throw new Error('User creation is not supported yet.');
}

export async function updateUser(
  _id?: number | string,
  _data?: UserMutationPayload
): Promise<never> {
  throw new Error('User updates are not supported yet.');
}

export async function deleteUser(_id?: number | string): Promise<never> {
  throw new Error('User deletion is not supported yet.');
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), USERS_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(getFetchUrl(path), {
      cache: 'no-store',
      credentials: 'include',
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('La solicitud del equipo tardó demasiado.', { cause: error });
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function getFetchUrl(path: string) {
  if (path.startsWith('http://') || path.startsWith('https://') || typeof window !== 'undefined') {
    return path;
  }

  return `${APP_URL}${path}`;
}

async function parseJsonResponse<TResponse>(response: Response): Promise<TResponse> {
  const body = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new Error(getErrorMessage(body, response.statusText));
  }

  return body as TResponse;
}

function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function getErrorMessage(body: unknown, fallback: string) {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message?: unknown }).message;

    if (typeof message === 'string') {
      return message;
    }

    if (Array.isArray(message)) {
      return message.join(', ');
    }
  }

  return fallback || 'No se pudo cargar el equipo.';
}
