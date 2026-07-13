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
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    setupFiles: ['./test/setup-env.ts'],
  },
})
