import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { ClsModule } from 'nestjs-cls'
import { DatabaseModule } from '../database/database.module'
import { EmailModule } from '../email/email.module'
import { EmailHealthRecorder } from '../email/email-health.recorder'
import { HealthModule } from './health.module'
import { ConfigModule } from '../config/config.module'

describe('HealthController (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ClsModule.forRoot({ global: true }), ConfigModule, DatabaseModule, EmailModule, HealthModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('api')
    await app.listen(0)
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

  describe('GET /api/health/email (#293)', () => {
    it('reports every purpose, so one that stopped sending shows as zero rather than vanishing', async () => {
      const response = await request(app.getHttpServer()).get('/api/health/email').expect(200)

      expect(response.body.status).toBe('ok')
      expect(Object.keys(response.body.purposes).sort()).toEqual([
        'email_verification',
        'owner_invitation',
        'owner_notification',
        'password_reset',
        'team_invitation',
      ])
    })

    it('surfaces a failure as degraded, naming the purpose and the kind but no address', async () => {
      app.get(EmailHealthRecorder).recordFailure(
        'password_reset',
        new Error('Cannot send to jane@example.com: too many requests'),
      )

      const response = await request(app.getHttpServer()).get('/api/health/email').expect(200)

      expect(response.body.status).toBe('degraded')
      expect(response.body.degradedPurposes).toEqual(['password_reset'])
      expect(response.body.purposes.password_reset.lastFailureKind).toBe('rate_limited')
      expect(JSON.stringify(response.body)).not.toContain('jane@example.com')
    })
  })
})
