import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { DatabaseModule } from '../database/database.module'
import { HealthModule } from './health.module'
import { ConfigModule } from '../config/config.module'

describe('HealthController (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule, HealthModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /api/health returns 200 (liveness, no dependencies)', async () => {
    const response = await request(app.getHttpServer()).get('/api/health')

    expect(response.status).toBe(200)
    expect(response.body.status).toBe('ok')
    expect(response.body.service).toBe('viewpro-api')
  })

  it('GET /api/health/ready returns 200 when the database is reachable', async () => {
    const response = await request(app.getHttpServer()).get('/api/health/ready')

    expect(response.status).toBe(200)
    expect(response.body.status).toBe('ok')
    expect(response.body.dependency).toBe('database')
    expect(response.body.timestamp).toBeDefined()
  })
})
