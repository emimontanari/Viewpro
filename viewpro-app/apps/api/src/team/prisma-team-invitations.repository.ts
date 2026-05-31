import { Inject, Injectable } from '@nestjs/common'
import { TeamInvitationStatus, UserStatus, type Prisma } from '@prisma/client'
import { PrismaService } from '../database/prisma.service'
import { createTeamInvitationToken } from './team-invitation-token'
import type {
  AcceptTeamInvitationForExistingUserInput,
  AcceptTeamInvitationForNewUserInput,
  AcceptTeamInvitationResult,
  CreateTeamInvitationInput,
  CreateTeamInvitationResult,
  RevokeTeamInvitationResult,
  RotateTeamInvitationResult,
  TeamInvitationWithRawToken,
  TeamInvitationsRepository,
  ValidateTeamInvitationResult,
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

  listPendingInvitations(input: { tenantId: string; now?: Date }) {
    const now = input.now ?? new Date()

    return this.prisma.teamInvitation.findMany({
      where: {
        tenantId: input.tenantId,
        status: TeamInvitationStatus.PENDING,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        invitedByUserId: true,
      },
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

  async validateByTokenHash(input: { tokenHash: string; now?: Date }): Promise<ValidateTeamInvitationResult> {
    const now = input.now ?? new Date()
    const invitation = await this.prisma.teamInvitation.findUnique({
      where: { tokenHash: input.tokenHash },
      include: {
        tenant: { select: { id: true, name: true, slug: true, status: true } },
      },
    })

    if (!invitation) {
      return { status: 'notFound' }
    }

    const availability = mapInvitationAvailability(invitation, now)
    if (availability !== 'valid') {
      return { status: availability }
    }

    const user = await this.prisma.user.findUnique({
      where: { email: invitation.email },
      select: { id: true },
    })

    return { status: 'valid', invitation, emailRegistered: Boolean(user) }
  }

  async acceptForNewUser(input: AcceptTeamInvitationForNewUserInput): Promise<AcceptTeamInvitationResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const now = input.now ?? new Date()
        const invitation = await tx.teamInvitation.findUnique({ where: { tokenHash: input.tokenHash } })
        if (!invitation) {
          return { status: 'notFound' }
        }

        const availability = mapInvitationAvailability(invitation, now)
        if (availability !== 'valid') {
          return { status: availability }
        }

        const existingUser = await tx.user.findUnique({
          where: { email: invitation.email },
          select: { id: true },
        })

        if (existingUser) {
          return { status: 'userAlreadyExists' }
        }

        const acceptResult = await markInvitationAccepted(tx, invitation.id, now)
        if (acceptResult.status !== 'accepted') {
          return acceptResult
        }

        const user = await tx.user.create({
          data: {
            email: invitation.email,
            passwordHash: input.passwordHash,
            firstName: input.firstName,
            lastName: input.lastName,
          },
        })

        await tx.tenantMembership.create({
          data: {
            userId: user.id,
            tenantId: invitation.tenantId,
            role: invitation.role,
          },
        })

        return { status: 'accepted', user }
      })
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return { status: 'userAlreadyExists' }
      }
      throw error
    }
  }

  async acceptForExistingUser(input: AcceptTeamInvitationForExistingUserInput): Promise<AcceptTeamInvitationResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const now = input.now ?? new Date()
        const invitation = await tx.teamInvitation.findUnique({ where: { tokenHash: input.tokenHash } })
        if (!invitation) {
          return { status: 'notFound' }
        }

        const availability = mapInvitationAvailability(invitation, now)
        if (availability !== 'valid') {
          return { status: availability }
        }

        const user = await tx.user.findUnique({ where: { id: input.userId } })
        if (!user || user.status !== UserStatus.ACTIVE) {
          return { status: 'userNotFound' }
        }

        if (normalizeEmail(user.email) !== normalizeEmail(invitation.email)) {
          return { status: 'emailMismatch' }
        }

        const existingMembership = await tx.tenantMembership.findUnique({
          where: {
            userId_tenantId: {
              userId: user.id,
              tenantId: invitation.tenantId,
            },
          },
          select: { id: true },
        })

        if (existingMembership) {
          return { status: 'alreadyMember' }
        }

        const acceptResult = await markInvitationAccepted(tx, invitation.id, now)
        if (acceptResult.status !== 'accepted') {
          return acceptResult
        }

        await tx.tenantMembership.create({
          data: {
            userId: user.id,
            tenantId: invitation.tenantId,
            role: invitation.role,
          },
        })

        return { status: 'accepted', user }
      })
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return { status: 'alreadyMember' }
      }
      throw error
    }
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

async function markInvitationAccepted(tx: Prisma.TransactionClient, invitationId: string, now: Date) {
  const result = await tx.teamInvitation.updateMany({
    where: {
      id: invitationId,
      status: TeamInvitationStatus.PENDING,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    data: {
      status: TeamInvitationStatus.ACCEPTED,
      acceptedAt: now,
    },
  })

  if (result.count === 1) {
    return { status: 'accepted' as const }
  }

  const invitation = await tx.teamInvitation.findUnique({ where: { id: invitationId } })
  const availability = mapInvitationAvailability(invitation, now)
  return { status: availability === 'valid' ? 'alreadyAccepted' : availability }
}

function mapInvitationAvailability(
  invitation: {
    status: TeamInvitationStatus
    acceptedAt: Date | null
    revokedAt: Date | null
    expiresAt: Date
  } | null,
  now: Date,
): Exclude<ValidateTeamInvitationResult['status'], 'valid'> | 'valid' {
  if (!invitation) {
    return 'notFound'
  }

  if (invitation.status === TeamInvitationStatus.REVOKED || invitation.revokedAt) {
    return 'revoked'
  }

  if (invitation.status === TeamInvitationStatus.ACCEPTED || invitation.acceptedAt) {
    return 'alreadyAccepted'
  }

  if (invitation.expiresAt.getTime() <= now.getTime()) {
    return 'expired'
  }

  return 'valid'
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

function isUniqueConstraintError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}
