'use client';

import { ADMIN_ACCESS_PARAM, adminAccessNoticeMessage } from '@/lib/admin-route-access';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

/**
 * Shows why the admin console sent you back here.
 *
 * Without this the redirect is silent: a seller who typed /admin lands on the
 * dashboard with no idea what happened, which reads as the app losing their
 * click. The marker is cleared afterwards so a refresh does not repeat it.
 */
export function AdminAccessNotice() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shownFor = useRef<string | null>(null);

  const marker = searchParams.get(ADMIN_ACCESS_PARAM);

  useEffect(() => {
    const message = adminAccessNoticeMessage(marker);

    if (!message) {
      return;
    }

    // Keyed by marker, not a permanent latch: this component mounts once for
    // the whole dashboard, so a second denial in the same session used to show
    // nothing AND leave its marker stuck in the URL.
    if (shownFor.current !== marker) {
      shownFor.current = marker;
      toast.error(message);
    }

    const next = new URLSearchParams(searchParams.toString());
    next.delete(ADMIN_ACCESS_PARAM);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [marker, pathname, router, searchParams]);

  return null;
}
