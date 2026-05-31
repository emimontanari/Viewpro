export type TenantRole = 'PRINCIPAL_MANAGER' | 'MANAGER' | 'AGENT';
export type TeamUserStatus = 'ACTIVE' | 'SUSPENDED';

export type User = {
  membershipId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string | null;
  userStatus: TeamUserStatus;
  role: TenantRole;
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

export type UserMutationPayload = Record<string, never>;
