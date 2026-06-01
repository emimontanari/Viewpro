export type TenantRole = 'PRINCIPAL_MANAGER' | 'MANAGER' | 'AGENT';
export type TeamUserStatus = 'ACTIVE' | 'SUSPENDED';
export type TenantMembershipStatus = 'ACTIVE' | 'DEACTIVATED';

export type User = {
  membershipId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string | null;
  userStatus: TeamUserStatus;
  role: TenantRole;
  membershipStatus: TenantMembershipStatus;
  deactivatedAt: string | null;
  deactivatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserFilters = {
  page?: number;
  limit?: number;
  roles?: string;
  search?: string;
  sort?: string;
};

export type UsersResponse = {
  items: User[];
};

export type TeamInvitationRole = Extract<TenantRole, 'MANAGER' | 'AGENT'>;
export type UpdateTeamMemberRolePayload = {
  role: TeamInvitationRole;
};

export type CreateTeamInvitationPayload = {
  email: string;
  role: TeamInvitationRole;
};

export type TeamInvitationLinkResponse = {
  invitationId: string;
  email: string;
  role: TeamInvitationRole;
  status: 'PENDING';
  expiresAt: string;
  invitationUrl: string;
};

export type TeamInvitationResponse = {
  invitationId: string;
  email: string;
  role: TeamInvitationRole;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED';
  expiresAt: string;
  revokedAt: string | null;
};

export type PendingTeamInvitation = {
  invitationId: string;
  email: string;
  role: TeamInvitationRole;
  status: 'PENDING';
  expiresAt: string;
  createdAt: string;
  invitedByUserId: string;
};

export type PendingTeamInvitationsResponse = {
  items: PendingTeamInvitation[];
};

export type UserMutationPayload = Record<string, never>;
