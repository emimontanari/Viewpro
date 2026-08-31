import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CurrentUser } from "../../auth/types/current-user";
import { EMAIL_SENDER, type EmailSender } from "../../email/email-sender.port";
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
  private readonly logger = new Logger(CreateOwnerInvitationLinkUseCase.name);

  constructor(
    @Inject(PROPERTY_ENGAGEMENTS_REPOSITORY)
    private readonly propertyEngagementsRepository: PropertyEngagementsRepository,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
    @Inject(EMAIL_SENDER)
    private readonly emailSender: EmailSender,
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
        propertyEngagementId: engagement.id,
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

    // Best-effort: an email failure must never fail the invitation request.
    try {
      await this.emailSender.sendOwnerInvitation({
        to: result.invitation.email,
        invitationUrl,
        expiresAt: result.invitation.expiresAt,
        agencyName: result.agencyName,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send owner invitation email to ${result.invitation.email}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return mapOwnerInvitationLinkResponse({
      invitationId: result.invitation.id,
      propertyAssetOwnerId: result.invitation.propertyAssetOwnerId,
      email: result.invitation.email,
      expiresAt: result.invitation.expiresAt,
      invitationUrl,
    });
  }
}
