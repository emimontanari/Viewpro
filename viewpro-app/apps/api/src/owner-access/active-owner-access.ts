import type { Prisma } from '@prisma/client'

/**
 * The single definition of "this user can see this property as its owner".
 *
 * Shared with the owner portal's own queries on purpose: if the portal listed
 * properties under one rule and the session answered "you have a portal" under
 * another, the chooser could offer a portal that renders nothing — or hide one
 * that has properties in it (#326).
 */
export const activeOwnerAccess = (userId: string) =>
  ({
    owners: { some: { userId, accessStatus: 'ACTIVE' } },
  }) satisfies Prisma.PropertyAssetWhereInput
