import { Controller, Get, Header, Inject, NotFoundException, Param, Put, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { LocalDocumentStorageAdapter } from './local-document-storage.adapter'

@Controller('document-storage')
export class LocalDocumentStorageController {
  constructor(@Inject(LocalDocumentStorageAdapter) private readonly localDocumentStorage: LocalDocumentStorageAdapter) {}

  @Put('upload/:token')
  async upload(@Param('token') token: string, @Req() request: Request) {
    assertLocalDocumentStorageEnabled()
    const contentLength = parseContentLength(request.headers['content-length'])
    return this.localDocumentStorage.storeSignedUpload({
      token,
      body: request,
      contentType: request.headers['content-type'],
      contentLength,
    })
  }

  @Get('read/:token')
  @Header('cache-control', 'private, max-age=0, no-store')
  async read(@Param('token') token: string, @Res() response: Response) {
    assertLocalDocumentStorageEnabled()
    const document = await this.localDocumentStorage.readSignedDocument(token)
    response.setHeader('content-type', document.mimeType)
    response.setHeader('content-length', document.sizeBytes.toString())
    response.send(document.body)
  }
}

function assertLocalDocumentStorageEnabled() {
  if (process.env.DOCUMENT_STORAGE_DRIVER !== 'local' && process.env.NODE_ENV !== 'test') {
    throw new NotFoundException('Document storage route not found')
  }
}

function parseContentLength(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value
  if (!rawValue) {
    return undefined
  }

  const parsed = Number(rawValue)
  return Number.isFinite(parsed) ? parsed : undefined
}
