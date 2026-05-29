export type OwnerInvitationProperty = {
  id: string;
  title: string;
  addressLine: string;
  city: string;
  province: string;
};

export type OwnerInvitationResponse = {
  id: string;
  propertyAssetOwnerId: string;
  email: string;
  ownerFirstName: string;
  ownerLastName: string;
  property: OwnerInvitationProperty;
  expiresAt: string;
};

export type AcceptOwnerInvitationInput = {
  firstName: string;
  lastName?: string;
  password: string;
};
