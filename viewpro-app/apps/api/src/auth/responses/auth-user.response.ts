import type { GlobalRole, User } from '@prisma/client'

export type AuthUserResponse = {
  id: string
  email: string
  firstName: string
  lastName: string | null
  status: string
  globalRole: GlobalRole
  emailVerifiedAt: string | null
}

export function mapAuthUser(user: User): AuthUserResponse {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
    globalRole: user.globalRole,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
  }
}
