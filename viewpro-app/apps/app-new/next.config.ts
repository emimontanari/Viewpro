import type { NextConfig } from 'next';

type RemotePattern = NonNullable<NonNullable<NextConfig['images']>['remotePatterns']>[number];

const remoteImagePatterns: RemotePattern[] = [
  {
    protocol: 'https',
    hostname: 'api.slingacademy.com',
    port: ''
  },
  ...buildOptionalRemotePatterns([
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NEXT_PUBLIC_PROPERTY_IMAGES_PUBLIC_BASE_URL,
    process.env.PROPERTY_IMAGES_PUBLIC_BASE_URL
  ])
];

// Define the base Next.js configuration
const baseConfig: NextConfig = {
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
  images: {
    remotePatterns: remoteImagePatterns
  },
  transpilePackages: ['geist'],
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
  }
};

const isLocalDevelopment = process.env.NODE_ENV !== 'production';
const isSentryExplicitlyEnabled = process.env.NEXT_PUBLIC_SENTRY_ENABLED === 'true';
const isSentryDisabled =
  process.env.NEXT_PUBLIC_SENTRY_DISABLED === 'true' ||
  (isLocalDevelopment && !isSentryExplicitlyEnabled);

async function getNextConfig(): Promise<NextConfig> {
  // Sentry is an upstream template integration. Keep it out of local dev by default
  // because it adds Turbopack/webpack work to every route. Set
  // NEXT_PUBLIC_SENTRY_ENABLED="true" locally only when testing monitoring.
  if (isSentryDisabled) {
    return baseConfig;
  }

  const { withSentryConfig } = await import('@sentry/nextjs');

  return withSentryConfig(baseConfig, {
    org: process.env.NEXT_PUBLIC_SENTRY_ORG,
    project: process.env.NEXT_PUBLIC_SENTRY_PROJECT,
    // Only print logs for uploading source maps in CI
    silent: !process.env.CI,

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
    tunnelRoute: '/monitoring',

    // Disable Sentry telemetry
    telemetry: false,

    // Sentry v10: moved under webpack namespace
    webpack: {
      reactComponentAnnotation: {
        enabled: true
      },
      treeshake: {
        removeDebugLogging: true
      }
    },

    // Disable source map upload when org/project are not configured
    sourcemaps: {
      disable: !process.env.NEXT_PUBLIC_SENTRY_ORG || !process.env.NEXT_PUBLIC_SENTRY_PROJECT
    }
  });
}

function buildOptionalRemotePatterns(values: Array<string | undefined>): RemotePattern[] {
  const patterns = new Map<string, RemotePattern>();

  for (const value of values) {
    const pattern = buildRemotePattern(value);
    if (!pattern) {
      continue;
    }

    patterns.set(`${pattern.protocol}://${pattern.hostname}:${pattern.port ?? ''}`, pattern);
  }

  return [...patterns.values()];
}

function buildRemotePattern(value: string | undefined): RemotePattern | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    if (url.protocol === 'http:' && !isLocalImageHost(url.hostname)) {
      return undefined;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return undefined;
    }

    return {
      protocol: url.protocol === 'https:' ? 'https' : 'http',
      hostname: url.hostname,
      port: url.port,
      pathname: '/**'
    };
  } catch {
    return undefined;
  }
}

function isLocalImageHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export default getNextConfig();
