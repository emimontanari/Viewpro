'use client';

import NextError from 'next/error';
import { useEffect } from 'react';

function isLocalDevelopment() {
  return process.env.NODE_ENV !== 'production';
}

function isSentryEnabled() {
  return (
    process.env.NEXT_PUBLIC_SENTRY_DISABLED !== 'true' &&
    (!isLocalDevelopment() || process.env.NEXT_PUBLIC_SENTRY_ENABLED === 'true')
  );
}

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    if (!isSentryEnabled()) {
      return;
    }

    void import('@sentry/nextjs').then((Sentry) => {
      Sentry.captureException(error);
    });
  }, [error]);

  return (
    <html lang='en'>
      <body>
        {/* `NextError` is the default Next.js error page component. Its type
        definition requires a `statusCode` prop. However, since the App Router
        does not expose status codes for errors, we simply pass 0 to render a
        generic error message. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
