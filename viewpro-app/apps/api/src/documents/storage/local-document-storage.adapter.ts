import { BadRequestException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, posix, resolve, sep } from 'node:path'
import type { Readable } from 'node:stream'
import { ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_UPLOAD_SIZE_BYTES } from '../document-upload-constraints'
import type { CreateDocumentReadUrlInput, CreateDocumentUploadUrlInput, DocumentStoragePort, SignedStorageUrl } from './document-storage.port'

type LocalDocumentStorageOperation = 'upload' | 'read'

type LocalDocumentStorageTokenPayload = {
  operation: LocalDocumentStorageOperation
  storageKey: string
  expiresAt: number
  mimeType?: string
  sizeBytes?: number
}

type StoredDocumentMetadata = {
  mimeType: string
  sizeBytes: number
}

const LOCAL_STORAGE_UPLOAD_ROUTE = '/api/document-storage/upload'
const LOCAL_STORAGE_READ_ROUTE = '/api/document-storage/read'
const DEFAULT_LOCAL_DOCUMENT_STORAGE_ROOT = '.document-storage'
const INVALID_TOKEN_MESSAGE = 'Invalid or expired document storage token'

@Injectable()
export class LocalDocumentStorageAdapter implements DocumentStoragePort {
  async createUploadUrl(input: CreateDocumentUploadUrlInput): Promise<SignedStorageUrl> {
    this.resolveStoragePath(input.storageKey)
    if (input.mimeType && !ALLOWED_DOCUMENT_MIME_TYPES.has(input.mimeType)) {
      throw new BadRequestException('Unsupported document MIME type')
    }
    if (input.sizeBytes !== undefined && (input.sizeBytes < 1 || input.sizeBytes > MAX_DOCUMENT_UPLOAD_SIZE_BYTES)) {
      throw new BadRequestException('Invalid document upload size')
    }

    const token = this.signToken({
      operation: 'upload',
      storageKey: input.storageKey,
      expiresAt: this.getExpiresAt(input.expiresInSeconds),
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    })

    return {
      url: `${getPublicApiOrigin()}${LOCAL_STORAGE_UPLOAD_ROUTE}/${token}`,
      storageKey: input.storageKey,
      expiresInSeconds: input.expiresInSeconds,
    }
  }

  async createReadUrl(input: CreateDocumentReadUrlInput): Promise<SignedStorageUrl> {
    this.resolveStoragePath(input.storageKey)
    const token = this.signToken({
      operation: 'read',
      storageKey: input.storageKey,
      expiresAt: this.getExpiresAt(input.expiresInSeconds),
    })

    return {
      url: `${getPublicApiOrigin()}${LOCAL_STORAGE_READ_ROUTE}/${token}`,
      storageKey: input.storageKey,
      expiresInSeconds: input.expiresInSeconds,
    }
  }

  async storeSignedUpload(input: {
    token: string
    body: Readable
    contentType?: string
    contentLength?: number
  }): Promise<{ storageKey: string; sizeBytes: number; mimeType: string }> {
    const payload = this.verifyToken(input.token, 'upload')
    const expectedMimeType = payload.mimeType
    const actualMimeType = normalizeContentType(input.contentType)
    if (!actualMimeType || !ALLOWED_DOCUMENT_MIME_TYPES.has(actualMimeType)) {
      throw new BadRequestException('Unsupported document MIME type')
    }
    if (expectedMimeType && actualMimeType !== expectedMimeType) {
      throw new BadRequestException('Document MIME type does not match signed upload URL')
    }

    const maxSizeBytes = payload.sizeBytes ?? MAX_DOCUMENT_UPLOAD_SIZE_BYTES
    if (input.contentLength !== undefined && input.contentLength > maxSizeBytes) {
      throw new PayloadTooLargeException('Document file exceeds signed upload size')
    }

    const buffer = await readRequestBody(input.body, maxSizeBytes)
    if (payload.sizeBytes !== undefined && buffer.byteLength !== payload.sizeBytes) {
      throw new BadRequestException('Document file size does not match signed upload URL')
    }

    const documentPath = this.resolveStoragePath(payload.storageKey)
    await mkdir(dirname(documentPath), { recursive: true })
    await writeFile(documentPath, buffer)
    await writeFile(
      this.resolveMetadataPath(payload.storageKey),
      JSON.stringify({
        mimeType: actualMimeType,
        sizeBytes: buffer.byteLength,
      }),
    )

    return {
      storageKey: payload.storageKey,
      sizeBytes: buffer.byteLength,
      mimeType: actualMimeType,
    }
  }

  async readSignedDocument(token: string): Promise<{
    storageKey: string
    body: Buffer
    mimeType: string
    sizeBytes: number
  }> {
    const payload = this.verifyToken(token, 'read')
    const documentPath = this.resolveStoragePath(payload.storageKey)
    try {
      const [body, metadata] = await Promise.all([readFile(documentPath), this.readMetadata(payload.storageKey)])
      return {
        storageKey: payload.storageKey,
        body,
        mimeType: metadata.mimeType,
        sizeBytes: body.byteLength,
      }
    } catch (error) {
      if (isMissingFileError(error)) {
        throw new NotFoundException('Document file not found')
      }
      throw error
    }
  }

  private async readMetadata(storageKey: string): Promise<StoredDocumentMetadata> {
    try {
      const raw = await readFile(this.resolveMetadataPath(storageKey), 'utf8')
      const parsed = JSON.parse(raw) as Partial<StoredDocumentMetadata>
      if (parsed.mimeType && typeof parsed.sizeBytes === 'number') {
        return { mimeType: parsed.mimeType, sizeBytes: parsed.sizeBytes }
      }
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error
      }
    }

    return { mimeType: 'application/octet-stream', sizeBytes: 0 }
  }

  private signToken(payload: LocalDocumentStorageTokenPayload): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const signature = this.sign(encodedPayload)
    return `${encodedPayload}.${signature}`
  }

  private verifyToken(token: string, expectedOperation: LocalDocumentStorageOperation): LocalDocumentStorageTokenPayload {
    const [encodedPayload, signature, extra] = token.split('.')
    if (!encodedPayload || !signature || extra !== undefined) {
      throw new BadRequestException(INVALID_TOKEN_MESSAGE)
    }

    const expectedSignature = this.sign(encodedPayload)
    if (!safeEqual(signature, expectedSignature)) {
      throw new BadRequestException(INVALID_TOKEN_MESSAGE)
    }

    let payload: LocalDocumentStorageTokenPayload
    try {
      payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as LocalDocumentStorageTokenPayload
    } catch {
      throw new BadRequestException(INVALID_TOKEN_MESSAGE)
    }

    if (payload.operation !== expectedOperation || payload.expiresAt <= getCurrentEpochSeconds()) {
      throw new BadRequestException(INVALID_TOKEN_MESSAGE)
    }

    this.resolveStoragePath(payload.storageKey)
    return payload
  }

  private sign(value: string): string {
    return createHmac('sha256', getSigningSecret()).update(value).digest('base64url')
  }

  private getExpiresAt(expiresInSeconds: number): number {
    return getCurrentEpochSeconds() + expiresInSeconds
  }

  private resolveStoragePath(storageKey: string): string {
    const normalizedStorageKey = normalizeStorageKey(storageKey)
    const root = getLocalDocumentStorageRoot()
    const absolutePath = resolve(root, normalizedStorageKey)

    if (absolutePath !== root && !absolutePath.startsWith(`${root}${sep}`)) {
      throw new BadRequestException('Invalid document storage key')
    }

    return absolutePath
  }

  private resolveMetadataPath(storageKey: string): string {
    return `${this.resolveStoragePath(storageKey)}.metadata.json`
  }
}

function normalizeStorageKey(storageKey: string): string {
  if (!storageKey || storageKey.includes('\0') || storageKey.includes('\\')) {
    throw new BadRequestException('Invalid document storage key')
  }

  const segments = storageKey.split('/')
  if (segments.some((segment) => segment === '..' || segment === '.')) {
    throw new BadRequestException('Invalid document storage key')
  }

  const normalized = posix.normalize(storageKey)
  if (normalized === '.' || normalized.startsWith('../') || normalized === '..' || posix.isAbsolute(normalized)) {
    throw new BadRequestException('Invalid document storage key')
  }

  return normalized
}

function getLocalDocumentStorageRoot() {
  return resolve(process.env.DOCUMENT_STORAGE_LOCAL_ROOT ?? join(process.cwd(), DEFAULT_LOCAL_DOCUMENT_STORAGE_ROOT))
}

function getSigningSecret() {
  const explicitSecret = process.env.DOCUMENT_STORAGE_SIGNING_SECRET
  if (explicitSecret) {
    return explicitSecret
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('DOCUMENT_STORAGE_SIGNING_SECRET is required when local document storage is used in production')
  }

  return process.env.ACCESS_TOKEN_SECRET ?? 'viewpro-local-document-storage-dev-secret'
}

function getPublicApiOrigin() {
  const explicitOrigin = process.env.API_PUBLIC_URL
  if (explicitOrigin) {
    return trimTrailingSlash(explicitOrigin)
  }

  return `http://localhost:${process.env.PORT ?? 3001}`
}

function normalizeContentType(contentType: string | undefined) {
  return contentType?.split(';')[0]?.trim().toLowerCase()
}

async function readRequestBody(body: Readable, maxSizeBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = []
  let totalBytes = 0

  for await (const chunk of body) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    totalBytes += buffer.byteLength
    if (totalBytes > maxSizeBytes) {
      throw new PayloadTooLargeException('Document file exceeds signed upload size')
    }
    chunks.push(buffer)
  }

  if (totalBytes < 1) {
    throw new BadRequestException('Document file is empty')
  }

  return Buffer.concat(chunks)
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.byteLength === right.byteLength && timingSafeEqual(left, right)
}

function isMissingFileError(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
}

function getCurrentEpochSeconds() {
  return Math.floor(Date.now() / 1000)
}

function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value
}
