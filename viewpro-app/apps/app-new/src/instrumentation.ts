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
  const value = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0);

  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 1);
}

function getSentryOptions() {
  return {
    // Sentry DSN
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Enable Spotlight only when Sentry is explicitly enabled in development.
    spotlight: process.env.NODE_ENV === 'development',

    // Do not collect request headers, IP address, or other default PII.
    sendDefaultPii: false,

    // Default to no tracing unless explicitly configured with SENTRY_TRACES_SAMPLE_RATE.
    tracesSampleRate: getTraceSampleRate(),

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false
  };
}

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.VIEWPRO_RUNTIME_MARKER_PORT) {
    const { startRuntimeContractMarker } = await import('./instrumentation-node');
    await startRuntimeContractMarker(process.env.VIEWPRO_RUNTIME_MARKER_PORT);
  }

  if (!isSentryEnabled()) {
    return;
  }

  const Sentry = await import('@sentry/nextjs');
  Sentry.init(getSentryOptions());
}

export async function onRequestError(...args: unknown[]) {
  if (!isSentryEnabled()) {
    return;
  }

  const Sentry = await import('@sentry/nextjs');
  const captureRequestError = Sentry.captureRequestError as (
    ...requestErrorArgs: unknown[]
  ) => unknown;
  return captureRequestError(...args);
}
