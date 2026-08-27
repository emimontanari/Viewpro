import type { INestApplication } from '@nestjs/common'
import { BadRequestException } from '@nestjs/common'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApiApp } from '../src/bootstrap/create-app'
import { LocalDocumentStorageAdapter } from '../src/documents/storage/local-document-storage.adapter'

describe('Local document storage adapter (e2e)', () => {
  let app: INestApplication
  let storage: LocalDocumentStorageAdapter
  let storageRoot: string
  let previousRoot: string | undefined
  let previousSecret: string | undefined
  let previousPublicUrl: string | undefined

  beforeAll(async () => {
    previousRoot = process.env.DOCUMENT_STORAGE_LOCAL_ROOT
    previousSecret = process.env.DOCUMENT_STORAGE_SIGNING_SECRET
    previousPublicUrl = process.env.API_PUBLIC_URL

    storageRoot = await mkdtemp(join(tmpdir(), 'viewpro-documents-'))
    process.env.NODE_ENV = 'test'
    process.env.ACCESS_TOKEN_SECRET = 'test-access-token-secret'
    process.env.COOKIE_DOMAIN = 'localhost'
    process.env.COOKIE_SECURE = 'false'
    process.env.DOCUMENT_STORAGE_LOCAL_ROOT = storageRoot
    process.env.DOCUMENT_STORAGE_SIGNING_SECRET = 'local-document-storage-test-secret'
    process.env.API_PUBLIC_URL = 'http://localhost:3001'

    app = await createApiApp()
    await app.listen(0)
    storage = app.get(LocalDocumentStorageAdapter)
  })

  afterAll(async () => {
    await app.close()
    await rm(storageRoot, { recursive: true, force: true })
    restoreEnv('DOCUMENT_STORAGE_LOCAL_ROOT', previousRoot)
    restoreEnv('DOCUMENT_STORAGE_SIGNING_SECRET', previousSecret)
    restoreEnv('API_PUBLIC_URL', previousPublicUrl)
  })

  it('stores bytes through a signed upload URL and returns them through a signed read URL', async () => {
    const upload = await storage.createUploadUrl({
      storageKey: 'document-requests/request-1/deed.pdf',
      expiresInSeconds: 600,
      mimeType: 'application/pdf',
      sizeBytes: Buffer.byteLength('pdf-content'),
    })
    const uploadPath = new URL(upload.url).pathname

    await request(app.getHttpServer()).put(uploadPath).set('content-type', 'application/pdf').send(Buffer.from('pdf-content')).expect(200)

    const read = await storage.createReadUrl({
      storageKey: upload.storageKey,
      expiresInSeconds: 300,
    })
    const readPath = new URL(read.url).pathname
    const response = await request(app.getHttpServer()).get(readPath).expect(200)

    expect(response.headers['content-type']).toContain('application/pdf')
    expect(response.body).toEqual(Buffer.from('pdf-content'))
    await request(app.getHttpServer()).get(`/uploads/${upload.storageKey}`).expect(404)
  })

  it('rejects invalid, expired, and wrong-operation tokens', async () => {
    await request(app.getHttpServer()).put('/api/document-storage/upload/not-a-valid-token').set('content-type', 'application/pdf').send(Buffer.from('pdf')).expect(400)

    const expiredUpload = await storage.createUploadUrl({
      storageKey: 'document-requests/request-2/expired.pdf',
      expiresInSeconds: -1,
      mimeType: 'application/pdf',
      sizeBytes: 3,
    })
    await request(app.getHttpServer()).put(new URL(expiredUpload.url).pathname).set('content-type', 'application/pdf').send(Buffer.from('pdf')).expect(400)

    const read = await storage.createReadUrl({
      storageKey: 'document-requests/request-2/expired.pdf',
      expiresInSeconds: 300,
    })
    const readToken = new URL(read.url).pathname.split('/').at(-1)
    await request(app.getHttpServer()).put(`/api/document-storage/upload/${readToken}`).set('content-type', 'application/pdf').send(Buffer.from('pdf')).expect(400)

    const upload = await storage.createUploadUrl({
      storageKey: 'document-requests/request-3/wrong-operation.pdf',
      expiresInSeconds: 300,
      mimeType: 'application/pdf',
      sizeBytes: 3,
    })
    const uploadToken = new URL(upload.url).pathname.split('/').at(-1)
    await request(app.getHttpServer()).get(`/api/document-storage/read/${uploadToken}`).expect(400)
  })

  it('enforces signed MIME and size metadata on upload', async () => {
    const upload = await storage.createUploadUrl({
      storageKey: 'document-requests/request-4/strict.pdf',
      expiresInSeconds: 600,
      mimeType: 'application/pdf',
      sizeBytes: 3,
    })
    const uploadPath = new URL(upload.url).pathname

    await request(app.getHttpServer()).put(uploadPath).set('content-type', 'text/plain').send(Buffer.from('pdf')).expect(400)
    await request(app.getHttpServer()).put(uploadPath).set('content-type', 'application/pdf').send(Buffer.from('too-large')).expect(413)
    await request(app.getHttpServer()).put(uploadPath).set('content-type', 'application/pdf').send(Buffer.from('pd')).expect(400)
  })

  it('rejects path traversal storage keys before signing URLs', async () => {
    await expect(
      storage.createUploadUrl({
        storageKey: '../escape.pdf',
        expiresInSeconds: 600,
        mimeType: 'application/pdf',
        sizeBytes: 3,
      }),
    ).rejects.toThrow(BadRequestException)

    await expect(
      storage.createReadUrl({
        storageKey: 'document-requests/../../escape.pdf',
        expiresInSeconds: 300,
      }),
    ).rejects.toThrow(BadRequestException)
  })
})

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
    return
  }

  process.env[name] = value
}
