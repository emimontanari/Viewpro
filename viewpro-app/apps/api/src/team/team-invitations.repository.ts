import type { TeamInvitation, TenantRole } from '@prisma/client'

export const TEAM_INVITATIONS_REPOSITORY = Symbol('TEAM_INVITATIONS_REPOSITORY')

export type TeamInvitationRole = Extract<TenantRole, 'MANAGER' | 'AGENT'>

export type TeamInvitationWithRawToken = TeamInvitation & { token: string }

export type CreateTeamInvitationInput = {
  tenantId: string
  email: string
  role: TeamInvitationRole
  invitedByUserId: string
  now?: Date
}

export type CreateTeamInvitationResult =
  | { status: 'created'; invitation: TeamInvitationWithRawToken }
  | { status: 'alreadyMember' }

export type RotateTeamInvitationResult =
  | { status: 'created'; invitation: TeamInvitationWithRawToken }
  | { status: 'notFound' }
  | { status: 'notAvailable' }

export type RevokeTeamInvitationResult =
  | { status: 'revoked'; invitation: TeamInvitation }
  | { status: 'notFound' }
  | { status: 'notAvailable' }

export type TeamInvitationsRepository = {
  createPendingInvitation(input: CreateTeamInvitationInput): Promise<CreateTeamInvitationResult>
  resendInvitation(input: {
    tenantId: string
    invitationId: string
    invitedByUserId: string
    now?: Date
  }): Promise<RotateTeamInvitationResult>
  revokeInvitation(input: {
    tenantId: string
    invitationId: string
    now?: Date
  }): Promise<RevokeTeamInvitationResult>
}
