import { describe, expect, it } from 'vitest'
import { seedPlatformSyncOperatorFixture } from './platform-sync.fixture'

const unavailableApp = {
  get: () => { throw new Error('fixture dependencies must not resolve') },
  select: () => { throw new Error('fixture dependencies must not resolve') },
}

describe('seedPlatformSyncOperatorFixture', () => {
  it('refuses to resolve dependencies outside the test runtime', async () => {
    const environment = process.env

    try {
      process.env = { ...environment, NODE_ENV: 'development', VITEST: undefined, VIEWPRO_TEST_RUN: undefined }
      await expect(seedPlatformSyncOperatorFixture(unavailableApp as never, { email: 'fixture@viewpro.test', password: 'fixture-password' }))
        .rejects.toThrow('Platform sync fixture requires test runtime')
    } finally {
      process.env = environment
    }
  })

  it.each([
    ['blank email', { email: '   ', password: 'fixture-password' }, 'Platform sync fixture email is required'],
    ['blank password', { email: 'fixture@viewpro.test', password: '   ' }, 'Platform sync fixture password is required'],
  ])('rejects %s before resolving dependencies', async (_label, input, message) => {
    const environment = process.env

    try {
      process.env = { ...environment, NODE_ENV: 'test', DATABASE_URL: undefined }
      await expect(seedPlatformSyncOperatorFixture(unavailableApp as never, input)).rejects.toThrow(message)
    } finally {
      process.env = environment
    }
  })
})
