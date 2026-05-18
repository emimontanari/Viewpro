import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  reactStrictMode: true,
}

export default withSentryConfig(nextConfig, {
  sourcemaps: {
    disable: true,
  },
  telemetry: false,
  silent: true,
  suppressOnRouterTransitionStartWarning: true,
  routeManifestInjection: false,
})
