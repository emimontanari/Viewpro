import { jwtVerify, type JWTPayload } from 'jose';
import { type NextRequest, NextResponse } from 'next/server';

const ACCESS_TOKEN_COOKIE = 'viewpro_access_token';
const REFRESH_TOKEN_COOKIE = 'viewpro_refresh_token';
const DEFAULT_API_URL = 'http://localhost:3001/api';
const AUTH_REFRESH_TIMEOUT_MS = 3_000;
const DEV_ACCESS_TOKEN_SECRET = 'change-me-in-real-env';
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const API_URL = trimTrailingSlash(process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL);

export default async function proxy(req: NextRequest) {
  if (!isProtectedAppPath(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const accessTokenSecret = getAccessTokenSecret();

  if (!accessTokenSecret) {
    return redirectToSignIn(req);
  }

  const token = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const hasValidAccessToken = token ? await verifyAccessToken(token, accessTokenSecret) : false;

  if (hasValidAccessToken) {
    return NextResponse.next();
  }

  const refreshResponse = await refreshSession(req);

  if (refreshResponse) {
    return refreshResponse;
  }

  return redirectToSignIn(req);
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)'
  ]
};

export function isProtectedAppPath(pathname: string) {
  return (
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/owner' ||
    pathname.startsWith('/owner/') ||
    // T-21: /admin paths require authentication at the proxy layer (server-side protection).
    // This is defense-in-depth; InmoView's own AdminGuard remains the authoritative gate.
    pathname === '/admin' ||
    pathname.startsWith('/admin/')
  );
}

function redirectToSignIn(req: NextRequest) {
  const signInUrl = req.nextUrl.clone();
  signInUrl.pathname = '/auth/sign-in';
  signInUrl.searchParams.set('redirect_url', `${req.nextUrl.pathname}${req.nextUrl.search}`);
  return NextResponse.redirect(signInUrl);
}

async function verifyAccessToken(token: string, secret: string) {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ['HS256']
    });

    return hasRequiredAccessTokenClaims(payload);
  } catch {
    return false;
  }
}

async function refreshSession(req: NextRequest) {
  const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!refreshToken) {
    return null;
  }

  let response: Response;

  try {
    response = await fetchWithTimeout(
      `${API_URL}/auth/refresh`,
      {
        cache: 'no-store',
        credentials: 'include',
        headers: {
          cookie: `${REFRESH_TOKEN_COOKIE}=${refreshToken}`
        },
        method: 'POST'
      },
      AUTH_REFRESH_TIMEOUT_MS
    );
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  const nextResponse = NextResponse.next();
  const setCookieHeaders = getSetCookieHeaders(response.headers);

  for (const setCookieHeader of setCookieHeaders) {
    nextResponse.headers.append('set-cookie', setCookieHeader);
  }

  return nextResponse;
}

function hasRequiredAccessTokenClaims(payload: JWTPayload) {
  return typeof payload.sub === 'string' && typeof payload.email === 'string';
}

function getAccessTokenSecret() {
  if (ACCESS_TOKEN_SECRET) {
    return ACCESS_TOKEN_SECRET;
  }

  return process.env.NODE_ENV === 'production' ? undefined : DEV_ACCESS_TOKEN_SECRET;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function getSetCookieHeaders(headers: Headers) {
  const headersWithCookieList = headers as Headers & { getSetCookie?: () => string[] };
  const setCookieHeaders = headersWithCookieList.getSetCookie?.();

  if (setCookieHeaders?.length) {
    return setCookieHeaders;
  }

  const setCookie = headers.get('set-cookie');
  return setCookie ? [setCookie] : [];
}
