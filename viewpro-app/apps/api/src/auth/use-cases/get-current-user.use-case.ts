import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { UserStatus } from '@prisma/client'
import type { MembershipsRepository } from '../../memberships/memberships.repository'
import { MEMBERSHIPS_REPOSITORY } from '../../memberships/memberships.repository'
import type { OwnerAccessRepository } from '../../owner-access/owner-access.repository'
import { OWNER_ACCESS_REPOSITORY } from '../../owner-access/owner-access.repository'
import type { UsersRepository } from '../../users/users.repository'
import { USERS_REPOSITORY } from '../../users/users.repository'
import { mapAuthUser } from '../responses/auth-user.response'
import { mapMembership, type MeResponse } from '../responses/me.response'

@Injectable()
export class GetCurrentUserUseCase {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly usersRepository: UsersRepository,
    @Inject(MEMBERSHIPS_REPOSITORY) private readonly membershipsRepository: MembershipsRepository,
    // Appended last on purpose: the specs construct these positionally, so
    // inserting in the middle silently shifts every argument after it.
    @Inject(OWNER_ACCESS_REPOSITORY) private readonly ownerAccessRepository: OwnerAccessRepository,
  ) {}

  async execute(userId: string): Promise<MeResponse> {
    const user = await this.usersRepository.findById(userId)

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException({ errorCode: 'SESSION_EXPIRED', message: 'Authentication required' })
    }

    const [memberships, hasOwnerAccess] = await Promise.all([
      this.membershipsRepository.findActiveManyByUserId(user.id),
      this.ownerAccessRepository.hasActiveOwnerAccess(user.id),
    ])

    return {
      user: mapAuthUser(user),
      memberships: memberships.map(mapMembership),
      hasOwnerAccess,
    }
  }
}
