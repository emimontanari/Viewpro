export type OwnerInvitationLinkResponse = {
  invitationId: string;
  propertyAssetOwnerId: string;
  email: string;
  expiresAt: string;
  invitationUrl: string;
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
