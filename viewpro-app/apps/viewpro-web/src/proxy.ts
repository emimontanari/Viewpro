// WU-1 stub — will be tested and hardened in WU-2 (T-11/T-12).
// Middleware performs PRESENCE-CHECK only — does NOT verify JWT signature (D3).
// Authority is viewpro-api AuthGuard + GET /auth/me.
import { type NextRequest, NextResponse } from 'next/server';

const ACCESS_TOKEN_COOKIE = 'viewpro_platform_access_token';

export default function proxy(req: NextRequest) {
  if (!isProtectedAppPath(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!token) {
    return redirectToSignIn(req);
  }

  // Cookie present — optimistic pass. The real authority is viewpro-api:
  // AuthGuard (HS256) verifies the token on every protected data call + /auth/me.
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)'
  ]
};

export function isProtectedAppPath(pathname: string) {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
}

function redirectToSignIn(req: NextRequest) {
  const signInUrl = req.nextUrl.clone();
  signInUrl.pathname = '/auth/sign-in';
  signInUrl.searchParams.set('redirect_url', `${req.nextUrl.pathname}${req.nextUrl.search}`);
  return NextResponse.redirect(signInUrl);
}
