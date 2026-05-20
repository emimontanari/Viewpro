import { Injectable } from '@nestjs/common'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'

export type SavePropertyImageInput = {
  tenantId: string
  propertyAssetId: string
  imageId: string
  originalFilename: string
  mimeType: string
  buffer: Buffer
}

export type SavedPropertyImage = {
  storageKey: string
  url: string
}

const PROPERTY_IMAGES_STORAGE_PREFIX = 'property-images'
const UPLOADS_PUBLIC_PREFIX = '/uploads'

@Injectable()
export class LocalPropertyImagesStorage {
  async save(input: SavePropertyImageInput): Promise<SavedPropertyImage> {
    const extension = getSafeExtension(input.originalFilename, input.mimeType)
    const storageKey = [
      PROPERTY_IMAGES_STORAGE_PREFIX,
      input.tenantId,
      input.propertyAssetId,
      `${input.imageId}${extension}`,
    ].join('/')
    const absolutePath = join(getUploadsRoot(), storageKey)

    await mkdir(
      join(
        getUploadsRoot(),
        PROPERTY_IMAGES_STORAGE_PREFIX,
        input.tenantId,
        input.propertyAssetId,
      ),
      {
        recursive: true,
      },
    )
    await writeFile(absolutePath, input.buffer)

    return { storageKey, url: buildPropertyImageUrl(storageKey) }
  }

  async delete(storageKey: string): Promise<void> {
    try {
      await unlink(join(getUploadsRoot(), storageKey))
    } catch (error) {
      if (isMissingFileError(error)) {
        return
      }

      throw error
    }
  }
}

export function buildPropertyImageUrl(storageKey: string) {
  const origin = getPublicApiOrigin()
  return `${origin}${UPLOADS_PUBLIC_PREFIX}/${storageKey}`
}

export function getUploadsRoot() {
  const configuredRoot = process.env.PROPERTY_IMAGES_UPLOADS_ROOT

  if (configuredRoot) {
    return resolve(configuredRoot)
  }

  return join(process.cwd(), 'uploads')
}

function getPublicApiOrigin() {
  const explicitOrigin = process.env.API_PUBLIC_URL
  if (explicitOrigin) {
    return trimTrailingSlash(explicitOrigin)
  }

  return `http://localhost:${process.env.PORT ?? 3001}`
}

function getSafeExtension(originalFilename: string, mimeType: string) {
  const extension = extname(originalFilename).toLowerCase()

  if (['.jpg', '.jpeg', '.png', '.webp'].includes(extension)) {
    return extension
  }

  const extensionByMimeType: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  }

  return extensionByMimeType[mimeType] ?? '.bin'
}

function isMissingFileError(error: unknown) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT',
  )
}

function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value
}
