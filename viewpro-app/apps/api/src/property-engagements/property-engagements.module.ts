import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MembershipsModule } from "../memberships/memberships.module";
import { PermissionsModule } from "../permissions/permissions.module";
import { TenantContextModule } from "../tenant-context/tenant-context.module";
import { UsersModule } from "../users/users.module";
import { PrismaPropertyEngagementsRepository } from "./prisma-property-engagements.repository";
import { PropertyEngagementsController } from "./property-engagements.controller";
import { PROPERTY_ENGAGEMENTS_REPOSITORY } from "./property-engagements.repository";
import { LocalPropertyImagesStorage } from "./property-images.storage";
import { AssignPropertyAgentUseCase } from "./use-cases/assign-property-agent.use-case";
import { ArchivePropertyEngagementUseCase } from "./use-cases/archive-property-engagement.use-case";
import { CreateOwnerInvitationLinkUseCase } from "./use-cases/create-owner-invitation-link.use-case";
import { CreatePropertyEngagementUseCase } from "./use-cases/create-property-engagement.use-case";
import { DeletePropertyImageUseCase } from "./use-cases/delete-property-image.use-case";
import { GetPropertyEngagementUseCase } from "./use-cases/get-property-engagement.use-case";
import { LinkPropertyOwnerUseCase } from "./use-cases/link-property-owner.use-case";
import { ListAssignablePropertyAgentsUseCase } from "./use-cases/list-assignable-property-agents.use-case";
import { ListPropertyEngagementsUseCase } from "./use-cases/list-property-engagements.use-case";
import { RemovePropertyAgentUseCase } from "./use-cases/remove-property-agent.use-case";
import { RestorePropertyEngagementUseCase } from "./use-cases/restore-property-engagement.use-case";
import { SetPropertyImagePrimaryUseCase } from "./use-cases/set-property-image-primary.use-case";
import { UpdatePropertyEngagementUseCase } from "./use-cases/update-property-engagement.use-case";
import { UploadPropertyImageUseCase } from "./use-cases/upload-property-image.use-case";

const propertyEngagementUseCases = [
  CreatePropertyEngagementUseCase,
  ListPropertyEngagementsUseCase,
  GetPropertyEngagementUseCase,
  UpdatePropertyEngagementUseCase,
  ArchivePropertyEngagementUseCase,
  RestorePropertyEngagementUseCase,
  AssignPropertyAgentUseCase,
  RemovePropertyAgentUseCase,
  ListAssignablePropertyAgentsUseCase,
  LinkPropertyOwnerUseCase,
  CreateOwnerInvitationLinkUseCase,
  UploadPropertyImageUseCase,
  DeletePropertyImageUseCase,
  SetPropertyImagePrimaryUseCase,
];

@Module({
  imports: [
    AuthModule,
    MembershipsModule,
    PermissionsModule,
    TenantContextModule,
    UsersModule,
  ],
  controllers: [PropertyEngagementsController],
  providers: [
    {
      provide: PROPERTY_ENGAGEMENTS_REPOSITORY,
      useClass: PrismaPropertyEngagementsRepository,
    },
    LocalPropertyImagesStorage,
    ...propertyEngagementUseCases,
  ],
  exports: [PROPERTY_ENGAGEMENTS_REPOSITORY, ...propertyEngagementUseCases],
})
export class PropertyEngagementsModule {}
