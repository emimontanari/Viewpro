import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CurrentUser } from "../../auth/types/current-user";
import { PERMISSIONS } from "../../permissions/permissions.constants";
import type { TenantContext } from "../../tenant-context/tenant-context.types";
import {
  PROPERTY_ENGAGEMENTS_REPOSITORY,
  type PropertyEngagementsRepository,
} from "../property-engagements.repository";
import {
  mapOwnerInvitationLinkResponse,
  type OwnerInvitationLinkResponse,
} from "../responses/owner-invitation-link.response";

@Injectable()
export class CreateOwnerInvitationLinkUseCase {
  constructor(
    @Inject(PROPERTY_ENGAGEMENTS_REPOSITORY)
    private readonly propertyEngagementsRepository: PropertyEngagementsRepository,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {}

  async execute(
    tenant: TenantContext,
    currentUser: CurrentUser,
    engagementId: string,
    ownerId: string,
  ): Promise<OwnerInvitationLinkResponse> {
    if (!tenant.permissions.includes(PERMISSIONS.ENGAGEMENTS_CREATE)) {
      throw new ForbiddenException("Insufficient permissions");
    }

    const engagement =
      await this.propertyEngagementsRepository.findByIdForTenant({
        tenantId: tenant.tenantId,
        engagementId,
        userId: currentUser.id,
        canViewAll: tenant.permissions.includes(
          PERMISSIONS.ENGAGEMENTS_VIEW_ALL,
        ),
      });

    if (!engagement) {
      throw new NotFoundException("Property engagement not found");
    }

    const result =
      await this.propertyEngagementsRepository.createOwnerInvitationLink({
        propertyAssetId: engagement.propertyAssetId,
        ownerId,
      });

    if (result.status === "ownerNotFound") {
      throw new NotFoundException("Property owner not found");
    }

    if (result.status === "ownerNotInvited") {
      throw new ConflictException(
        "Owner invitation link can only be generated for invited owners",
      );
    }

    const appPublicUrl = this.configService.getOrThrow<string>("app.publicUrl");
    const invitationUrl = `${appPublicUrl}/owner-invitations/${encodeURIComponent(
      result.invitation.token,
    )}`;

    return mapOwnerInvitationLinkResponse({
      invitationId: result.invitation.id,
      propertyAssetOwnerId: result.invitation.propertyAssetOwnerId,
      email: result.invitation.email,
      expiresAt: result.invitation.expiresAt,
      invitationUrl,
    });
  }
}
