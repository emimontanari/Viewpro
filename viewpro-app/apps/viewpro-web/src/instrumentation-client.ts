// This file configures optional Sentry client instrumentation.
// Keep @sentry/nextjs out of the default local development bundle unless it is
// explicitly enabled with NEXT_PUBLIC_SENTRY_ENABLED="true".

function isLocalDevelopment() {
  return process.env.NODE_ENV !== 'production';
}

function isSentryEnabled() {
  return (
    process.env.NEXT_PUBLIC_SENTRY_DISABLED !== 'true' &&
    (!isLocalDevelopment() || process.env.NEXT_PUBLIC_SENTRY_ENABLED === 'true')
  );
}

function getTraceSampleRate() {
  const value = Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '1');
  return Number.isFinite(value) ? value : 1;
}

if (isSentryEnabled()) {
  void import('@sentry/nextjs').then((Sentry) => {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

      // Keep client telemetry privacy-safe unless a future change explicitly opts in.
      sendDefaultPii: false,

      // Define how likely traces are sampled. Adjust this value in production.
      tracesSampleRate: getTraceSampleRate(),

      // Setting this option to true will print useful information to the console while you're setting up Sentry.
      debug: false
    });
  });
}

// Required by Next.js to instrument router transitions for Sentry tracing.
export function onRouterTransitionStart(...args: unknown[]) {
  if (!isSentryEnabled()) {
    return;
  }

  void import('@sentry/nextjs').then((Sentry) => {
    const captureRouterTransitionStart = (
      Sentry as { captureRouterTransitionStart?: (...routerArgs: unknown[]) => void }
    ).captureRouterTransitionStart;
    captureRouterTransitionStart?.(...args);
  });
}
