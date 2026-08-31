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
  /**
   * Who sent the invitation. Null when the invitation predates the engagement
   * being recorded on it: the surface then says nothing rather than naming an
   * agency the API had to guess (#303).
   */
  agencyName: string | null;
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
