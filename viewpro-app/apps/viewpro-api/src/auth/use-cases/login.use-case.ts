import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type { LoginDto } from '../dto/login.dto'
import type { IOperatorRepository } from '../repositories/operator.repository'
import { OPERATOR_REPOSITORY } from '../repositories/operator.repository'
import { DUMMY_PASSWORD_HASH } from '../security/dummy-password-hash'
import type { IPasswordHasher } from '../security/password-hasher'
import { PASSWORD_HASHER } from '../security/password-hasher'
import { TokenService } from '../tokens/token.service'

export type LoginResult = {
  operator: { id: string; email: string }
  token: string
}

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(OPERATOR_REPOSITORY) private readonly operatorRepository: IOperatorRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: IPasswordHasher,
    private readonly tokenService: TokenService,
  ) {}

  async execute(dto: LoginDto): Promise<LoginResult> {
    const normalizedEmail = dto.email.toLowerCase().trim()
    const operator = await this.operatorRepository.findByEmail(normalizedEmail)

    // Always verify against a hash — the operator's, or a dummy — so response
    // timing does not reveal whether the email exists (no user enumeration).
    const validPassword = await this.passwordHasher.verify(
      operator?.passwordHash ?? DUMMY_PASSWORD_HASH,
      dto.password,
    )

    if (!operator || !validPassword || operator.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid email or password')
    }

    const token = await this.tokenService.signAccessToken({
      sub: operator.id,
      email: operator.email,
    })

    return { operator: { id: operator.id, email: operator.email }, token }
  }
}
