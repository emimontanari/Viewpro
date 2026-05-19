import * as Sentry from '@sentry/nextjs';

function isSentryDisabled() {
  return process.env.NEXT_PUBLIC_SENTRY_DISABLED === 'true';
}

function getTraceSampleRate() {
  const value = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0);

  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 1);
}

const sentryOptions: Sentry.NodeOptions | Sentry.EdgeOptions = {
  // Sentry DSN
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Enable Spotlight in development
  spotlight: process.env.NODE_ENV === 'development',

  // Do not collect request headers, IP address, or other default PII.
  sendDefaultPii: false,

  // Default to no tracing unless explicitly configured with SENTRY_TRACES_SAMPLE_RATE.
  tracesSampleRate: getTraceSampleRate(),

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false
};

export async function register() {
  if (!isSentryDisabled()) {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      // Node.js Sentry configuration
      Sentry.init(sentryOptions);
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
      // Edge Sentry configuration
      Sentry.init(sentryOptions);
    }
  }
}

export const onRequestError = Sentry.captureRequestError;
