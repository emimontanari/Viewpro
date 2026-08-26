import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApiApp } from '../src/bootstrap/create-app'

describe('HealthController (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    app = await createApiApp()
    await app.listen(0)
  })

  afterAll(async () => {
    await app.close()
  })

  it('returns API health status', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200)

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'viewpro-api',
      version: '0.1.0',
    })
    expect(response.body.timestamp).toEqual(expect.any(String))
    expect(response.body.uptime).toEqual(expect.any(Number))
    expect(response.headers['x-request-id']).toEqual(expect.any(String))
  })
})
