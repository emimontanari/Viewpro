import { Inject, Injectable } from '@nestjs/common'
import { TeamInvitationStatus, type Prisma } from '@prisma/client'
import { PrismaService } from '../database/prisma.service'
import { createTeamInvitationToken } from './team-invitation-token'
import type {
  CreateTeamInvitationInput,
  CreateTeamInvitationResult,
  RevokeTeamInvitationResult,
  RotateTeamInvitationResult,
  TeamInvitationWithRawToken,
  TeamInvitationsRepository,
} from './team-invitations.repository'

@Injectable()
export class PrismaTeamInvitationsRepository implements TeamInvitationsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  createPendingInvitation(input: CreateTeamInvitationInput): Promise<CreateTeamInvitationResult> {
    return this.prisma.$transaction(async (tx) => {
      const now = input.now ?? new Date()
      const email = normalizeEmail(input.email)
      const existingUser = await tx.user.findUnique({
        where: { email },
        select: { id: true },
      })

      if (existingUser) {
        const existingMembership = await tx.tenantMembership.findUnique({
          where: {
            userId_tenantId: {
              userId: existingUser.id,
              tenantId: input.tenantId,
            },
          },
          select: { id: true },
        })

        if (existingMembership) {
          return { status: 'alreadyMember' }
        }
      }

      const invitation = await createFreshInvitation(tx, {
        tenantId: input.tenantId,
        email,
        role: input.role,
        invitedByUserId: input.invitedByUserId,
        now,
      })

      return { status: 'created', invitation }
    })
  }

  resendInvitation(input: {
    tenantId: string
    invitationId: string
    invitedByUserId: string
    now?: Date
  }): Promise<RotateTeamInvitationResult> {
    return this.prisma.$transaction(async (tx) => {
      const now = input.now ?? new Date()
      const existingInvitation = await tx.teamInvitation.findFirst({
        where: { id: input.invitationId, tenantId: input.tenantId },
      })

      if (!existingInvitation) {
        return { status: 'notFound' }
      }

      if (!isPendingAvailable(existingInvitation, now)) {
        return { status: 'notAvailable' }
      }

      const revokeResult = await tx.teamInvitation.updateMany({
        where: {
          id: existingInvitation.id,
          tenantId: input.tenantId,
          status: TeamInvitationStatus.PENDING,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          status: TeamInvitationStatus.REVOKED,
          revokedAt: now,
        },
      })

      if (revokeResult.count !== 1) {
        return { status: 'notAvailable' }
      }

      const invitation = await createFreshInvitation(tx, {
        tenantId: input.tenantId,
        email: existingInvitation.email,
        role: existingInvitation.role as CreateTeamInvitationInput['role'],
        invitedByUserId: input.invitedByUserId,
        now,
      })

      return { status: 'created', invitation }
    })
  }

  revokeInvitation(input: {
    tenantId: string
    invitationId: string
    now?: Date
  }): Promise<RevokeTeamInvitationResult> {
    return this.prisma.$transaction(async (tx) => {
      const now = input.now ?? new Date()
      const existingInvitation = await tx.teamInvitation.findFirst({
        where: { id: input.invitationId, tenantId: input.tenantId },
      })

      if (!existingInvitation) {
        return { status: 'notFound' }
      }

      if (!isPendingAvailable(existingInvitation, now)) {
        return { status: 'notAvailable' }
      }

      const revokeResult = await tx.teamInvitation.updateMany({
        where: {
          id: existingInvitation.id,
          tenantId: input.tenantId,
          status: TeamInvitationStatus.PENDING,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          status: TeamInvitationStatus.REVOKED,
          revokedAt: now,
        },
      })

      if (revokeResult.count !== 1) {
        return { status: 'notAvailable' }
      }

      const invitation = await tx.teamInvitation.findFirst({
        where: { id: existingInvitation.id, tenantId: input.tenantId },
      })

      return invitation ? { status: 'revoked', invitation } : { status: 'notFound' }
    })
  }
}

async function createFreshInvitation(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string
    email: string
    role: CreateTeamInvitationInput['role']
    invitedByUserId: string
    now: Date
  },
): Promise<TeamInvitationWithRawToken> {
  const { token, tokenHash, expiresAt } = createTeamInvitationToken(input.now)

  await tx.teamInvitation.updateMany({
    where: {
      tenantId: input.tenantId,
      email: input.email,
      status: TeamInvitationStatus.PENDING,
    },
    data: {
      status: TeamInvitationStatus.REVOKED,
      revokedAt: input.now,
    },
  })

  const invitation = await tx.teamInvitation.create({
    data: {
      tenantId: input.tenantId,
      email: input.email,
      role: input.role,
      invitedByUserId: input.invitedByUserId,
      tokenHash,
      expiresAt,
    },
  })

  return { ...invitation, token }
}

function isPendingAvailable(
  invitation: { status: TeamInvitationStatus; acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date },
  now: Date,
) {
  return (
    invitation.status === TeamInvitationStatus.PENDING &&
    !invitation.acceptedAt &&
    !invitation.revokedAt &&
    invitation.expiresAt.getTime() > now.getTime()
  )
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}
