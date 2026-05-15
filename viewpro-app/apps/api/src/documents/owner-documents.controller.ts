import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { AuthGuard } from '../auth/guards/auth.guard'
import type { CurrentUser as CurrentUserContext } from '../auth/types/current-user'
import { CreateDocumentUploadUrlDto } from './dto/create-document-upload-url.dto'
import { ListDocumentRequestsQuery } from './dto/list-document-requests.query'
import { ConfirmOwnerDocumentUploadUseCase } from './use-cases/confirm-owner-document-upload.use-case'
import { CreateOwnerDocumentReadUrlUseCase } from './use-cases/create-owner-document-read-url.use-case'
import { CreateOwnerDocumentUploadUrlUseCase } from './use-cases/create-owner-document-upload-url.use-case'
import { GetOwnerDocumentRequestUseCase } from './use-cases/get-owner-document-request.use-case'
import { ListOwnerDocumentRequestsUseCase } from './use-cases/list-owner-document-requests.use-case'

@Controller('owner')
@ApiTags('Owner documents')
@UseGuards(AuthGuard)
export class OwnerDocumentsController {
  constructor(
    private readonly listOwnerDocumentRequestsUseCase: ListOwnerDocumentRequestsUseCase,
    private readonly getOwnerDocumentRequestUseCase: GetOwnerDocumentRequestUseCase,
    private readonly createOwnerDocumentUploadUrlUseCase: CreateOwnerDocumentUploadUrlUseCase,
    private readonly confirmOwnerDocumentUploadUseCase: ConfirmOwnerDocumentUploadUseCase,
    private readonly createOwnerDocumentReadUrlUseCase: CreateOwnerDocumentReadUrlUseCase,
  ) {}

  @Get('document-requests')
  @ApiOperation({ summary: 'List document requests addressed to the authenticated owner' })
  list(@CurrentUser() currentUser: CurrentUserContext, @Query() query: ListDocumentRequestsQuery) {
    return this.listOwnerDocumentRequestsUseCase.execute(currentUser, query)
  }

  @Get('document-requests/:id')
  @ApiOperation({ summary: 'Get an owner document request addressed to the authenticated owner' })
  get(@CurrentUser() currentUser: CurrentUserContext, @Param('id') id: string) {
    return this.getOwnerDocumentRequestUseCase.execute(currentUser, id)
  }

  @Post('document-requests/:id/upload-url')
  @ApiOperation({ summary: 'Create a signed upload URL for an owner document request' })
  createUploadUrl(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('id') id: string,
    @Body() body: CreateDocumentUploadUrlDto,
  ) {
    return this.createOwnerDocumentUploadUrlUseCase.execute(currentUser, id, body)
  }

  @Post('document-versions/:id/confirm-upload')
  @ApiOperation({ summary: 'Confirm an owner document upload after storage upload completes' })
  confirmUpload(@CurrentUser() currentUser: CurrentUserContext, @Param('id') id: string) {
    return this.confirmOwnerDocumentUploadUseCase.execute(currentUser, id)
  }

  @Post('document-versions/:id/read-url')
  @ApiOperation({ summary: 'Create a signed read URL for an owner document version' })
  createReadUrl(@CurrentUser() currentUser: CurrentUserContext, @Param('id') id: string) {
    return this.createOwnerDocumentReadUrlUseCase.execute(currentUser, id)
  }
}
