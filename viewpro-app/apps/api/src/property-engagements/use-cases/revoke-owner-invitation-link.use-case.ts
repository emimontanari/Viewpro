import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { CurrentUser } from "../../auth/types/current-user";
import { PERMISSIONS } from "../../permissions/permissions.constants";
import type { TenantContext } from "../../tenant-context/tenant-context.types";
import {
  PROPERTY_ENGAGEMENTS_REPOSITORY,
  type PropertyEngagementsRepository,
} from "../property-engagements.repository";
import {
  mapOwnerInvitationRevokeResponse,
  type OwnerInvitationRevokeResponse,
} from "../responses/owner-invitation-link.response";

@Injectable()
export class RevokeOwnerInvitationLinkUseCase {
  constructor(
    @Inject(PROPERTY_ENGAGEMENTS_REPOSITORY)
    private readonly propertyEngagementsRepository: PropertyEngagementsRepository,
  ) {}

  async execute(
    tenant: TenantContext,
    currentUser: CurrentUser,
    engagementId: string,
    ownerId: string,
  ): Promise<OwnerInvitationRevokeResponse> {
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
      await this.propertyEngagementsRepository.revokeOwnerInvitationLink({
        propertyAssetId: engagement.propertyAssetId,
        ownerId,
        now: new Date(),
      });

    if (result.status === "ownerNotFound") {
      throw new NotFoundException("Property owner not found");
    }

    if (result.status === "ownerNotInvited") {
      throw new ConflictException(
        "Owner invitation link can only be revoked for invited owners",
      );
    }

    if (result.status === "noPendingInvitation") {
      throw new ConflictException("No pending owner invitation link found");
    }

    return mapOwnerInvitationRevokeResponse({
      propertyAssetOwnerId: result.propertyAssetOwnerId,
      revokedInvitationIds: result.revokedInvitationIds,
    });
  }
}
