export type OwnerInvitationProperty = {
  id: string;
  title: string;
  city: string;
  province: string;
};

export type OwnerInvitationResponse = {
  id: string;
  propertyAssetOwnerId: string;
  email: string;
  emailRegistered: boolean;
  ownerFirstName: string;
  ownerLastName: string;
  property: OwnerInvitationProperty;
  expiresAt: string;
};

export type AcceptOwnerInvitationInput =
  | {
      mode?: 'register';
      firstName: string;
      lastName?: string;
      password: string;
    }
  | {
      mode: 'login';
      password: string;
    }
  | {
      mode: 'current-session';
    };
