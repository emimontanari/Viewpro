import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type { IOperatorRepository } from '../repositories/operator.repository'
import { OPERATOR_REPOSITORY } from '../repositories/operator.repository'
import { DUMMY_PASSWORD_HASH } from '../security/dummy-password-hash'
import type { IPasswordHasher } from '../security/password-hasher'
import { PASSWORD_HASHER } from '../security/password-hasher'
import { TokenService } from '../tokens/token.service'

/**
 * StepUpUseCase — re-verifies an already-authenticated operator's CURRENT
 * password (pure local check, no InmoView call) before a destructive tenant
 * action. Mirrors LoginUseCase's constant-time dummy-hash pattern, but
 * resolves the operator by the AuthGuard-verified `sub` instead of an email
 * from the request body (design D7).
 */
@Injectable()
export class StepUpUseCase {
  constructor(
    @Inject(OPERATOR_REPOSITORY) private readonly operatorRepository: IOperatorRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: IPasswordHasher,
    private readonly tokenService: TokenService,
  ) {}

  async execute(operatorId: string, password: string): Promise<string> {
    const operator = await this.operatorRepository.findById(operatorId)

    // Always verify against a hash — the operator's, or a dummy — so response
    // timing does not reveal whether the operator exists (no enumeration),
    // even though the caller is already authenticated.
    const validPassword = await this.passwordHasher.verify(
      operator?.passwordHash ?? DUMMY_PASSWORD_HASH,
      password,
    )

    if (!operator || !validPassword || operator.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid password')
    }

    return this.tokenService.signStepUpToken({ sub: operator.id })
  }
}
