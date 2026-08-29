import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { UserStatus } from '@prisma/client'
import type { MembershipsRepository } from '../../memberships/memberships.repository'
import { MEMBERSHIPS_REPOSITORY } from '../../memberships/memberships.repository'
import type { UsersRepository } from '../../users/users.repository'
import { USERS_REPOSITORY } from '../../users/users.repository'
import { mapAuthUser } from '../responses/auth-user.response'
import { mapMembership, type MeResponse } from '../responses/me.response'

@Injectable()
export class GetCurrentUserUseCase {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly usersRepository: UsersRepository,
    @Inject(MEMBERSHIPS_REPOSITORY) private readonly membershipsRepository: MembershipsRepository,
  ) {}

  async execute(userId: string): Promise<MeResponse> {
    const user = await this.usersRepository.findById(userId)

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException({ errorCode: 'SESSION_EXPIRED', message: 'Authentication required' })
    }

    const memberships = await this.membershipsRepository.findActiveManyByUserId(user.id)
    return { user: mapAuthUser(user), memberships: memberships.map(mapMembership) }
  }
}
