import { PortalChooserView } from '@/features/auth/components/portal-chooser-view';
import { BRAND } from '@/lib/brand/brand';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: `Elegí tu portal · ${BRAND.metadata.appTitle}`,
  robots: { index: false, follow: false }
};

const DEFAULT_API_URL = 'http://localhost:3001/api';
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL).replace(/\/$/, '');
const AUTH_ME_TIMEOUT_MS = 3_000;

/**
 * The chooser is only a question for someone who genuinely holds both contexts.
 *
 * Checked on the server rather than trusted from the routing that sent them
 * here: the path is typeable, and a chooser offering a portal the visitor
 * cannot enter would send them to a screen that refuses them.
 */
export default async function PortalChooserPage() {
  const session = await readSession();

  if (!session) {
    redirect('/auth/sign-in');
  }

  const hasTenantContext = (session.memberships?.length ?? 0) > 0;

  if (!hasTenantContext) {
    redirect(session.hasOwnerAccess ? '/owner' : '/auth/sign-in');
  }

  if (!session.hasOwnerAccess) {
    redirect('/dashboard');
  }

  return <PortalChooserView />;
}

type SessionShape = { memberships?: unknown[]; hasOwnerAccess?: boolean };

async function readSession(): Promise<SessionShape | null> {
  const cookieStore = await cookies();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUTH_ME_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      cache: 'no-store',
      credentials: 'include',
      headers: { cookie: cookieStore.toString() },
      signal: controller.signal
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json().catch(() => null)) as SessionShape | null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
