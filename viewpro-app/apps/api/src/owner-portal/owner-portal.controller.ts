import { Controller, Get, HttpCode, Inject, Param, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { AuthGuard } from '../auth/guards/auth.guard'
import type { CurrentUser as CurrentUserContext } from '../auth/types/current-user'
// biome-ignore lint/style/useImportType: Nest validation pipe needs runtime DTO metadata.
import { ListOwnerTimelineQuery } from './dto/list-owner-timeline.query'
import { GetOwnerEngagementTimelineUseCase } from './use-cases/get-owner-engagement-timeline.use-case'
import { GetOwnerPropertyUseCase } from './use-cases/get-owner-property.use-case'
import { ListOwnerPropertiesUseCase } from './use-cases/list-owner-properties.use-case'
import { ListOwnerPropertyEngagementsUseCase } from './use-cases/list-owner-property-engagements.use-case'
import { TrackOwnerWhatsappContactClickUseCase } from './use-cases/track-owner-whatsapp-contact-click.use-case'

@Controller('owner')
@UseGuards(AuthGuard)
export class OwnerPortalController {
  constructor(
    @Inject(ListOwnerPropertiesUseCase)
    private readonly listOwnerPropertiesUseCase: ListOwnerPropertiesUseCase,
    @Inject(GetOwnerPropertyUseCase)
    private readonly getOwnerPropertyUseCase: GetOwnerPropertyUseCase,
    @Inject(ListOwnerPropertyEngagementsUseCase)
    private readonly listOwnerPropertyEngagementsUseCase: ListOwnerPropertyEngagementsUseCase,
    @Inject(GetOwnerEngagementTimelineUseCase)
    private readonly getOwnerEngagementTimelineUseCase: GetOwnerEngagementTimelineUseCase,
    @Inject(TrackOwnerWhatsappContactClickUseCase)
    private readonly trackOwnerWhatsappContactClickUseCase: TrackOwnerWhatsappContactClickUseCase,
  ) {}

  @Get('properties')
  listProperties(@CurrentUser() user: CurrentUserContext) {
    return this.listOwnerPropertiesUseCase.execute(user.id)
  }

  @Get('properties/:propertyAssetId')
  getProperty(@CurrentUser() user: CurrentUserContext, @Param('propertyAssetId') propertyAssetId: string) {
    return this.getOwnerPropertyUseCase.execute({ userId: user.id, propertyAssetId })
  }

  @Get('properties/:propertyAssetId/engagements')
  listEngagements(@CurrentUser() user: CurrentUserContext, @Param('propertyAssetId') propertyAssetId: string) {
    return this.listOwnerPropertyEngagementsUseCase.execute({ userId: user.id, propertyAssetId })
  }

  @Post('engagements/:engagementId/whatsapp-contact-click')
  @HttpCode(204)
  trackWhatsappContactClick(@CurrentUser() user: CurrentUserContext, @Param('engagementId') engagementId: string) {
    return this.trackOwnerWhatsappContactClickUseCase.execute({ userId: user.id, engagementId })
  }

  @Get('engagements/:engagementId/timeline')
  getTimeline(
    @CurrentUser() user: CurrentUserContext,
    @Param('engagementId') engagementId: string,
    @Query() query: ListOwnerTimelineQuery,
  ) {
    return this.getOwnerEngagementTimelineUseCase.execute({
      userId: user.id,
      engagementId,
      page: query.page,
      pageSize: query.pageSize,
      order: query.order,
    })
  }
}
