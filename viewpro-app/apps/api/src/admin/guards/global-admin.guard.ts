import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { GlobalRole, UserStatus } from '@prisma/client'
import type { AuthenticatedRequest } from '../../auth/guards/auth.guard'
import { USERS_REPOSITORY, type UsersRepository } from '../../users/users.repository'

@Injectable()
export class GlobalAdminGuard implements CanActivate {
  constructor(@Inject(USERS_REPOSITORY) private readonly usersRepository: UsersRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()

    if (!request.user) {
      throw new UnauthorizedException('Authentication required')
    }

    const user = await this.usersRepository.findById(request.user.id)

    if (!user || user.status !== UserStatus.ACTIVE || user.globalRole !== GlobalRole.VIEWPRO_ADMIN) {
      throw new ForbiddenException('ViewPro admin access required')
    }

    return true
  }
}
