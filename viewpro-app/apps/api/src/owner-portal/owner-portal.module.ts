import { Module } from "@nestjs/common";
import { AnalyticsCoreModule } from "../analytics/analytics-core.module";
import { AuthModule } from "../auth/auth.module";
import { OwnerPortalController } from "./owner-portal.controller";
import { OWNER_PORTAL_REPOSITORY } from "./owner-portal.repository";
import { PrismaOwnerPortalRepository } from "./prisma-owner-portal.repository";
import { GetOwnerEngagementTimelineUseCase } from "./use-cases/get-owner-engagement-timeline.use-case";
import { GetOwnerPropertyUseCase } from "./use-cases/get-owner-property.use-case";
import { ListOwnerPropertiesUseCase } from "./use-cases/list-owner-properties.use-case";
import { ListOwnerPropertyEngagementsUseCase } from "./use-cases/list-owner-property-engagements.use-case";
import { TrackOwnerMovementWhatsappContactClickUseCase } from "./use-cases/track-owner-movement-whatsapp-contact-click.use-case";
import { TrackOwnerWhatsappContactClickUseCase } from "./use-cases/track-owner-whatsapp-contact-click.use-case";

const ownerPortalUseCases = [
	ListOwnerPropertiesUseCase,
	GetOwnerPropertyUseCase,
	ListOwnerPropertyEngagementsUseCase,
	GetOwnerEngagementTimelineUseCase,
	TrackOwnerWhatsappContactClickUseCase,
	TrackOwnerMovementWhatsappContactClickUseCase,
];

@Module({
	imports: [AnalyticsCoreModule, AuthModule],
	controllers: [OwnerPortalController],
	providers: [
		{ provide: OWNER_PORTAL_REPOSITORY, useClass: PrismaOwnerPortalRepository },
		...ownerPortalUseCases,
	],
	exports: [OWNER_PORTAL_REPOSITORY, ...ownerPortalUseCases],
})
export class OwnerPortalModule {}
