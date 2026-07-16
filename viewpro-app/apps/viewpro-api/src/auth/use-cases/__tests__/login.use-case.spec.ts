import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UnauthorizedException } from '@nestjs/common'
import { LoginUseCase } from '../login.use-case'
import type { IOperatorRepository } from '../../repositories/operator.repository'
import type { IPasswordHasher } from '../../security/password-hasher'
import type { TokenService } from '../../tokens/token.service'

const OPERATOR_ID = 'test-operator-id'
const OPERATOR_EMAIL = 'operator@viewpro.app'
const PASSWORD_HASH = '$argon2id$hashed'

function makeActiveOperator() {
  return {
    id: OPERATOR_ID,
    email: OPERATOR_EMAIL,
    passwordHash: PASSWORD_HASH,
    status: 'ACTIVE' as const,
    role: 'OWNER' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('LoginUseCase', () => {
  let useCase: LoginUseCase
  let operatorRepository: IOperatorRepository
  let passwordHasher: IPasswordHasher
  let tokenService: Pick<TokenService, 'signAccessToken'>

  beforeEach(() => {
    operatorRepository = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
    }
    passwordHasher = {
      hash: vi.fn(),
      verify: vi.fn(),
    }
    tokenService = {
      signAccessToken: vi.fn().mockResolvedValue('jwt.token.value'),
    }

    useCase = new LoginUseCase(
      operatorRepository,
      passwordHasher,
      tokenService as TokenService,
    )
  })

  it('happy path: valid credentials return operator and token', async () => {
    const operator = makeActiveOperator()
    vi.mocked(operatorRepository.findByEmail).mockResolvedValue(operator)
    vi.mocked(passwordHasher.verify).mockResolvedValue(true)

    const result = await useCase.execute({ email: OPERATOR_EMAIL, password: 'correct-pass' })

    expect(result.operator.id).toBe(OPERATOR_ID)
    expect(result.operator.email).toBe(OPERATOR_EMAIL)
    expect(result.token).toBe('jwt.token.value')
    expect(result.operator).not.toHaveProperty('passwordHash')
  })

  it('wrong password: throws UnauthorizedException with generic message', async () => {
    const operator = makeActiveOperator()
    vi.mocked(operatorRepository.findByEmail).mockResolvedValue(operator)
    vi.mocked(passwordHasher.verify).mockResolvedValue(false)

    await expect(
      useCase.execute({ email: OPERATOR_EMAIL, password: 'wrong-pass' }),
    ).rejects.toThrow(new UnauthorizedException('Invalid email or password'))
  })

  it('unknown email: throws UnauthorizedException with generic message', async () => {
    vi.mocked(operatorRepository.findByEmail).mockResolvedValue(null)

    await expect(
      useCase.execute({ email: 'unknown@viewpro.app', password: 'any-pass' }),
    ).rejects.toThrow(new UnauthorizedException('Invalid email or password'))
  })

  it('unknown email: still runs a password verify to equalize timing (no user enumeration)', async () => {
    vi.mocked(operatorRepository.findByEmail).mockResolvedValue(null)
    vi.mocked(passwordHasher.verify).mockResolvedValue(false)

    await expect(
      useCase.execute({ email: 'unknown@viewpro.app', password: 'any-pass' }),
    ).rejects.toThrow(UnauthorizedException)

    expect(passwordHasher.verify).toHaveBeenCalledTimes(1)
  })

  it('suspended operator: throws UnauthorizedException even with correct password', async () => {
    const operator = { ...makeActiveOperator(), status: 'SUSPENDED' as const }
    vi.mocked(operatorRepository.findByEmail).mockResolvedValue(operator)
    vi.mocked(passwordHasher.verify).mockResolvedValue(true)

    await expect(
      useCase.execute({ email: OPERATOR_EMAIL, password: 'correct-pass' }),
    ).rejects.toThrow(new UnauthorizedException('Invalid email or password'))
  })
})
