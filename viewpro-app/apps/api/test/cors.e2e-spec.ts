import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApiApp } from '../src/bootstrap/create-app'

describe('CORS configuration (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.CORS_ORIGIN = 'http://localhost:3000,http://127.0.0.1:3100'

    app = await createApiApp()
    await app.listen(0)
  })

  afterAll(async () => {
    await app.close()
    delete process.env.CORS_ORIGIN
  })

  it('allows configured credentialed origins', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204)

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000')
    expect(response.headers['access-control-allow-credentials']).toBe('true')
  })

  it('allows secondary configured origins', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/auth/login')
      .set('Origin', 'http://127.0.0.1:3100')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204)

    expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:3100')
    expect(response.headers['access-control-allow-credentials']).toBe('true')
  })

  it('does not approve disallowed origins for credentialed requests', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/auth/login')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST')

    expect(response.headers['access-control-allow-origin']).toBeUndefined()
    expect(response.headers['access-control-allow-credentials']).toBeUndefined()
  })

  it('allows requests without an origin header', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200)

    expect(response.headers['access-control-allow-origin']).toBeUndefined()
    expect(response.headers['access-control-allow-credentials']).toBe('true')
  })
})
