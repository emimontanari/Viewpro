import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@prisma-platform/client': fileURLToPath(
        new URL('./src/generated/prisma/index.js', import.meta.url),
      ),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    // Keep files serial until the suite has per-worker database isolation.
    fileParallelism: false,
    // Suites that boot a full Nest app + connect to Postgres in beforeAll can
    // exceed vitest's 10s default on slower CI runners (locally they land ~9.9s).
    // Give app/DB bootstrap real headroom so CI is deterministic, not on the edge.
    testTimeout: 30000,
    hookTimeout: 30000,
    // Same rationale as apps/api: best-effort async side effects (ingest/mirror
    // writes) can race assertions on slower CI runners. Stopgap until per-worker
    // DB isolation lands; a retry cannot rescue a deterministic failure.
    retry: process.env.VIEWPRO_PLATFORM_TEST_RETRY === '0' ? 0 : 2,
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    setupFiles: ['./test/setup-env.ts'],
  },
})
