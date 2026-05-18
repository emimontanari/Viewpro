import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApiApp } from '../src/bootstrap/create-app'

describe('GlobalExceptionFilter (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    app = await createApiApp()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('returns consistent not found error payload with request id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/missing-route')
      .set('x-request-id', 'test-request-id')
      .expect(404)

    expect(response.body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      message: 'Cannot GET /api/missing-route',
      path: '/api/missing-route',
      requestId: 'test-request-id',
    })
    expect(response.body.timestamp).toEqual(expect.any(String))
    expect(response.headers['x-request-id']).toBe('test-request-id')
  })
})

describe('GlobalExceptionFilter production sanitization (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    process.env.NODE_ENV = 'production'
    process.env.CORS_ORIGIN = 'https://app.viewpro.example'

    app = await createApiApp()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
    process.env.NODE_ENV = 'test'
    delete process.env.CORS_ORIGIN
  })

  it('removes route internals while preserving diagnostic envelope fields', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/production-missing-route')
      .set('x-request-id', 'production-request-id')
      .expect(404)

    expect(response.body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      message: 'Resource not found',
      path: '/api/production-missing-route',
      requestId: 'production-request-id',
    })
    expect(response.body.message).not.toContain('/api/production-missing-route')
    expect(response.body.timestamp).toEqual(expect.any(String))
    expect(response.headers['x-request-id']).toBe('production-request-id')
  })
})
