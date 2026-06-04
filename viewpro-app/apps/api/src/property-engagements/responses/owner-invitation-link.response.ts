export type OwnerInvitationLinkResponse = {
  invitationId: string;
  propertyAssetOwnerId: string;
  email: string;
  expiresAt: string;
  invitationUrl: string;
};

export type OwnerInvitationRevokeResponse = {
  propertyAssetOwnerId: string;
  revokedInvitationIds: string[];
  revokedCount: number;
};

export function mapOwnerInvitationLinkResponse(input: {
  invitationId: string;
  propertyAssetOwnerId: string;
  email: string;
  expiresAt: Date;
  invitationUrl: string;
}): OwnerInvitationLinkResponse {
  return {
    invitationId: input.invitationId,
    propertyAssetOwnerId: input.propertyAssetOwnerId,
    email: input.email,
    expiresAt: input.expiresAt.toISOString(),
    invitationUrl: input.invitationUrl,
  };
}

export function mapOwnerInvitationRevokeResponse(input: {
  propertyAssetOwnerId: string;
  revokedInvitationIds: string[];
}): OwnerInvitationRevokeResponse {
  return {
    propertyAssetOwnerId: input.propertyAssetOwnerId,
    revokedInvitationIds: input.revokedInvitationIds,
    revokedCount: input.revokedInvitationIds.length,
  };
}
