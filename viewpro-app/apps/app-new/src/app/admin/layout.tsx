import {
  adminAccessRedirectPath,
  decideAdminRouteAccess,
  probeAdminAccess,
  resolveAdminProbeApiUrl
} from '@/lib/admin-route-access';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const PROBE_API = resolveAdminProbeApiUrl(process.env.NEXT_PUBLIC_API_URL);

/**
 * The server boundary for the whole /admin tree.
 *
 * Being a layout is the point: every descendant and catch-all under /admin is
 * covered structurally, so nobody has to remember to guard a new page. Hiding
 * the sidebar entry (#284) never did this — typing the URL still rendered the
 * console.
 *
 * This is UX, not authorization. GlobalAdminGuard on the API is what actually
 * protects admin data. The decision and the probe live in @/lib so both are
 * reachable from tests; this file only wires them to the request.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // A deployed build with no API URL locks every administrator out, so say it
  // where an operator can find it rather than leaving a generic toast as the
  // only trace.
  if (PROBE_API.usingFallback && process.env.NODE_ENV === 'production') {
    console.error(
      '[admin] NEXT_PUBLIC_API_URL is not set; the admin gate is dialling the local development API and will refuse everyone.'
    );
  }

  const cookieStore = await cookies();
  const decision = decideAdminRouteAccess(
    await probeAdminAccess({
      fetchImpl: fetch,
      apiUrl: PROBE_API.url,
      cookieHeader: cookieStore.toString()
    })
  );

  if (decision.kind !== 'allow') {
    redirect(adminAccessRedirectPath(decision));
  }

  return <>{children}</>;
}
