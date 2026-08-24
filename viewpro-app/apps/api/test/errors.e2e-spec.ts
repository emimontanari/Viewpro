import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common'
import type { ArgumentsHost, INestApplication } from '@nestjs/common'
import { PUBLIC_ERROR_CODES } from '@viewpro/contracts'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createApiApp } from '../src/bootstrap/create-app'
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const PUBLIC_ERROR_CASES = [
  ...PUBLIC_ERROR_CODES.map((errorCode) => [errorCode, errorCode] as const),
  [undefined, 'REQUEST_FAILED'],
  ['unknown-code', 'REQUEST_FAILED'],
] as const

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

  it('keeps the legacy error body and replaces an incoming request ID', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/missing-route')
      .set('x-request-id', 'attacker-request-id')
      .expect(404)

    expect(response.body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      message: 'Cannot GET /api/missing-route',
      path: '/api/missing-route',
      requestId: expect.stringMatching(UUID_V4),
    })
    expect(response.body.requestId).not.toBe('attacker-request-id')
    expect(response.body.timestamp).toEqual(expect.any(String))
    expect(response.headers['x-request-id']).toBe(response.body.requestId)
  })
})

describe('GlobalExceptionFilter Sentry capture policy', () => {
  it('captures unexpected errors with safe request context only', () => {
    const captureException = vi.fn()
    const filter = new GlobalExceptionFilter('production', {
      captureException,
    })
    const error = new Error('database password leaked in original error')

    filter.catch(error, createMockArgumentsHost('/api/admin/summary', 'request-500'))

    expect(captureException).toHaveBeenCalledWith({ type: 'UnhandledException', statusCode: 500 }, {
      requestId: 'request-500',
      path: 'unmatched_route',
      statusCode: 500,
      environment: 'production',
    })
    expect(captureException.mock.calls[0]).not.toContain(error)
    expect(JSON.stringify(captureException.mock.calls[0])).not.toContain('database password leaked')
  })

  it('captures HTTP 5xx errors and skips normal 4xx denials', () => {
    const captureException = vi.fn()
    const filter = new GlobalExceptionFilter('production', {
      captureException,
    })
    const serverError = new HttpException('Upstream failed', HttpStatus.BAD_GATEWAY)

    filter.catch(serverError, createMockArgumentsHost('/api/documents', 'request-502'))
    filter.catch(new BadRequestException('Invalid payload'), createMockArgumentsHost('/api/documents', 'request-400'))

    expect(captureException).toHaveBeenCalledTimes(1)
    expect(captureException).toHaveBeenCalledWith({ type: 'HttpException', statusCode: 502 }, {
      requestId: 'request-502',
      path: 'unmatched_route',
      statusCode: 502,
      environment: 'production',
    })
    expect(captureException.mock.calls[0]).not.toContain(serverError)
    expect(JSON.stringify(captureException.mock.calls[0])).not.toContain('Upstream failed')
  })

  it('keeps production responses sanitized while preserving request id', () => {
    const json = vi.fn()
    const status = vi.fn(() => ({ json }))
    const filter = new GlobalExceptionFilter('production', {
      captureException: vi.fn(),
    })

    filter.catch(
      new Error('private token should never be returned'),
      createMockArgumentsHost('/api/private', 'request-sanitized', status),
    )

    expect(status).toHaveBeenCalledWith(500)
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Unexpected error',
        path: '/api/private',
        requestId: 'request-sanitized',
      }),
    )
    expect(json.mock.calls[0][0].message).not.toContain('token')
  })
})

function createMockArgumentsHost(path: string, requestId: string, status = vi.fn(() => ({ json: vi.fn() }))): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: path, requestId }),
    }),
  } as ArgumentsHost
}

describe('GlobalExceptionFilter direct boundary', () => {
  it.each(PUBLIC_ERROR_CASES)('shapes enabled %s as %s', (errorCode, expectedErrorCode) => {
    const host = createDirectArgumentsHost({ requestId: 'server-request-id' })
    const filter = createEnabledFilter()

    filter.catch(
      new HttpException({ errorCode, message: 'private producer message' }, HttpStatus.CONFLICT),
      host.argumentsHost,
    )

    expect(host.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.CONFLICT,
      errorCode: expectedErrorCode,
      requestId: 'server-request-id',
    })
  })

  it('uses a matched route template without leaking the raw URL', () => {
    const captureException = vi.fn()
    const filter = new GlobalExceptionFilter('production', { captureException })
    const host = createDirectArgumentsHost({
      path: '/api/team-invitations/credential-token?redirect=https://attacker.example',
      requestId: 'request-500',
      routePath: '/api/team-invitations/:token',
    })

    filter.catch(new Error('database password leaked in original error'), host.argumentsHost)

    expect(captureException).toHaveBeenCalledWith(
      { type: 'UnhandledException', statusCode: HttpStatus.INTERNAL_SERVER_ERROR },
      expect.objectContaining({ path: '/api/team-invitations/:token' }),
    )
    expect(JSON.stringify(captureException.mock.calls[0])).not.toMatch(
      /database password leaked|credential-token|attacker\.example/,
    )
  })

  it('uses an unmatched route and fresh ID when telemetry throws', () => {
    const captureException = vi.fn(() => {
      throw new Error('telemetry unavailable')
    })
    const filter = createEnabledFilter({ captureException })
    const host = createDirectArgumentsHost({
      path: '/api/team-invitations/credential-token?redirect=https://attacker.example',
    })

    filter.catch(new Error('producer failed'), host.argumentsHost)

    expect(host.request.requestId).toMatch(UUID_V4)
    expect(host.setHeader).toHaveBeenCalledWith('x-request-id', host.request.requestId)
    expect(host.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: 'REQUEST_FAILED',
      requestId: host.request.requestId,
    })
    expect(captureException).toHaveBeenCalledWith(
      { type: 'UnhandledException', statusCode: HttpStatus.INTERNAL_SERVER_ERROR },
      expect.objectContaining({ requestId: host.request.requestId, path: 'unmatched_route' }),
    )
  })
})

type DirectArgumentsHostOptions = {
  path?: string
  requestId?: string
  routePath?: string
}

function createDirectArgumentsHost({
  path = '/api/test',
  requestId,
  routePath,
}: DirectArgumentsHostOptions = {}) {
  const json = vi.fn()
  const status = vi.fn(() => ({ json }))
  const setHeader = vi.fn()
  const request = {
    url: path,
    ...(requestId ? { requestId } : {}),
    ...(routePath ? { route: { path: routePath } } : {}),
  } as { requestId?: string; url: string }

  return {
    argumentsHost: {
      switchToHttp: () => ({
        getResponse: () => ({ status, setHeader }),
        getRequest: () => request,
      }),
    } as ArgumentsHost,
    json,
    request,
    setHeader,
    status,
  }
}

function createEnabledFilter(sentryService?: { captureException: ReturnType<typeof vi.fn> }) {
  return new GlobalExceptionFilter('test', sentryService, { publicErrorEnvelopeEnabled: true })
}

describe('GlobalExceptionFilter production sanitization (e2e)', () => {
  let app: INestApplication
  let previousAppPublicUrl: string | undefined
  let previousDocumentStorageDriver: string | undefined
  let previousS3Bucket: string | undefined
  let previousS3AccessKeyId: string | undefined
  let previousS3SecretAccessKey: string | undefined
  let previousPropertyImagesStorageDriver: string | undefined
  let previousPropertyImagesS3Bucket: string | undefined
  let previousPropertyImagesS3AccessKeyId: string | undefined
  let previousPropertyImagesS3SecretAccessKey: string | undefined
  let previousPropertyImagesPublicBaseUrl: string | undefined

  beforeAll(async () => {
    previousAppPublicUrl = process.env.APP_PUBLIC_URL
    previousDocumentStorageDriver = process.env.DOCUMENT_STORAGE_DRIVER
    previousS3Bucket = process.env.DOCUMENT_STORAGE_S3_BUCKET
    previousS3AccessKeyId = process.env.DOCUMENT_STORAGE_S3_ACCESS_KEY_ID
    previousS3SecretAccessKey = process.env.DOCUMENT_STORAGE_S3_SECRET_ACCESS_KEY
    previousPropertyImagesStorageDriver = process.env.PROPERTY_IMAGES_STORAGE_DRIVER
    previousPropertyImagesS3Bucket = process.env.PROPERTY_IMAGES_S3_BUCKET
    previousPropertyImagesS3AccessKeyId = process.env.PROPERTY_IMAGES_S3_ACCESS_KEY_ID
    previousPropertyImagesS3SecretAccessKey = process.env.PROPERTY_IMAGES_S3_SECRET_ACCESS_KEY
    previousPropertyImagesPublicBaseUrl = process.env.PROPERTY_IMAGES_PUBLIC_BASE_URL
    process.env.NODE_ENV = 'production'
    process.env.APP_PUBLIC_URL = 'https://app.viewpro.example'
    process.env.CORS_ORIGIN = 'https://app.viewpro.example'
    process.env.DOCUMENT_STORAGE_DRIVER = 's3'
    process.env.DOCUMENT_STORAGE_S3_BUCKET = 'test-documents'
    process.env.DOCUMENT_STORAGE_S3_ACCESS_KEY_ID = 'test-access-key'
    process.env.DOCUMENT_STORAGE_S3_SECRET_ACCESS_KEY = 'test-secret-key'
    process.env.PROPERTY_IMAGES_STORAGE_DRIVER = 's3'
    process.env.PROPERTY_IMAGES_S3_BUCKET = 'test-property-images'
    process.env.PROPERTY_IMAGES_S3_ACCESS_KEY_ID = 'test-access-key'
    process.env.PROPERTY_IMAGES_S3_SECRET_ACCESS_KEY = 'test-secret-key'
    process.env.PROPERTY_IMAGES_PUBLIC_BASE_URL = 'https://images.viewpro.example'

    app = await createApiApp()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
    process.env.NODE_ENV = 'test'
    restoreEnv('APP_PUBLIC_URL', previousAppPublicUrl)
    delete process.env.CORS_ORIGIN
    restoreEnv('DOCUMENT_STORAGE_DRIVER', previousDocumentStorageDriver)
    restoreEnv('DOCUMENT_STORAGE_S3_BUCKET', previousS3Bucket)
    restoreEnv('DOCUMENT_STORAGE_S3_ACCESS_KEY_ID', previousS3AccessKeyId)
    restoreEnv('DOCUMENT_STORAGE_S3_SECRET_ACCESS_KEY', previousS3SecretAccessKey)
    restoreEnv('PROPERTY_IMAGES_STORAGE_DRIVER', previousPropertyImagesStorageDriver)
    restoreEnv('PROPERTY_IMAGES_S3_BUCKET', previousPropertyImagesS3Bucket)
    restoreEnv('PROPERTY_IMAGES_S3_ACCESS_KEY_ID', previousPropertyImagesS3AccessKeyId)
    restoreEnv('PROPERTY_IMAGES_S3_SECRET_ACCESS_KEY', previousPropertyImagesS3SecretAccessKey)
    restoreEnv('PROPERTY_IMAGES_PUBLIC_BASE_URL', previousPropertyImagesPublicBaseUrl)
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
      requestId: expect.stringMatching(UUID_V4),
    })
    expect(response.body.requestId).not.toBe('production-request-id')
    expect(response.body.message).not.toContain('/api/production-missing-route')
    expect(response.body.timestamp).toEqual(expect.any(String))
    expect(response.headers['x-request-id']).toBe(response.body.requestId)
  })
})

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
    return
  }

  process.env[name] = value
}
