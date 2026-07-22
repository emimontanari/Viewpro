import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UnauthorizedException } from '@nestjs/common'
import { StepUpUseCase } from '../step-up.use-case'
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

describe('StepUpUseCase', () => {
  let useCase: StepUpUseCase
  let operatorRepository: IOperatorRepository
  let passwordHasher: IPasswordHasher
  let tokenService: Pick<TokenService, 'signStepUpToken'>

  beforeEach(() => {
    operatorRepository = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      list: vi.fn(),
      updateRole: vi.fn(),
      updateStatus: vi.fn(),
      countActiveOwners: vi.fn(),
    }
    passwordHasher = {
      hash: vi.fn(),
      verify: vi.fn(),
    }
    tokenService = {
      signStepUpToken: vi.fn().mockResolvedValue('step-up.jwt.token'),
    }

    useCase = new StepUpUseCase(
      operatorRepository,
      passwordHasher,
      tokenService as TokenService,
    )
  })

  it('correct password for the sub-resolved operator returns a token via signStepUpToken', async () => {
    const operator = makeActiveOperator()
    vi.mocked(operatorRepository.findById).mockResolvedValue(operator)
    vi.mocked(passwordHasher.verify).mockResolvedValue(true)

    const token = await useCase.execute(OPERATOR_ID, 'correct-pass')

    expect(token).toBe('step-up.jwt.token')
    expect(tokenService.signStepUpToken).toHaveBeenCalledWith({ sub: OPERATOR_ID })
  })

  it('wrong password throws UnauthorizedException and does not sign a token', async () => {
    const operator = makeActiveOperator()
    vi.mocked(operatorRepository.findById).mockResolvedValue(operator)
    vi.mocked(passwordHasher.verify).mockResolvedValue(false)

    await expect(useCase.execute(OPERATOR_ID, 'wrong-pass')).rejects.toThrow(UnauthorizedException)

    expect(tokenService.signStepUpToken).not.toHaveBeenCalled()
  })

  it('operator not found still runs a dummy-hash constant-time verify, then throws UnauthorizedException', async () => {
    vi.mocked(operatorRepository.findById).mockResolvedValue(null)
    vi.mocked(passwordHasher.verify).mockResolvedValue(false)

    await expect(useCase.execute('unknown-id', 'any-pass')).rejects.toThrow(UnauthorizedException)

    expect(passwordHasher.verify).toHaveBeenCalledTimes(1)
    expect(tokenService.signStepUpToken).not.toHaveBeenCalled()
  })

  it('operator found but not ACTIVE throws UnauthorizedException even with correct password', async () => {
    const operator = { ...makeActiveOperator(), status: 'SUSPENDED' as const }
    vi.mocked(operatorRepository.findById).mockResolvedValue(operator)
    vi.mocked(passwordHasher.verify).mockResolvedValue(true)

    await expect(useCase.execute(OPERATOR_ID, 'correct-pass')).rejects.toThrow(UnauthorizedException)

    expect(tokenService.signStepUpToken).not.toHaveBeenCalled()
  })
})
