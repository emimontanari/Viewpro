import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { AUTH_REQUIRED_CODE } from './auth.constants'
import { LoginDto } from './dto/login.dto'
import { StepUpDto } from './dto/step-up.dto'
import { AuthGuard, type AuthenticatedRequest } from './guards/auth.guard'
import { AuthThrottlerGuard } from './guards/auth-throttler.guard'
import { OPERATOR_REPOSITORY, type IOperatorRepository } from './repositories/operator.repository'
import { TokenService } from './tokens/token.service'
import { LoginUseCase } from './use-cases/login.use-case'
import { StepUpUseCase } from './use-cases/step-up.use-case'

export type OperatorMeResponse = { operator: { id: string; email: string } }

// Same stable 401 body the AuthGuard emits on session expiry. A non-ACTIVE or
// removed operator is treated as a terminated session so the FE (which keys on
// `AUTH_REQUIRED`) redirects to sign-in — NOT 403, which would leave the
// suspended operator's session alive.
const AUTH_REQUIRED_RESPONSE = {
  statusCode: 401,
  code: AUTH_REQUIRED_CODE,
  message: 'Authentication required',
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly stepUpUseCase: StepUpUseCase,
    private readonly tokenService: TokenService,
    @Inject(OPERATOR_REPOSITORY) private readonly operatorRepository: IOperatorRepository,
  ) {}

  @Post('login')
  @HttpCode(200)
  @UseGuards(AuthThrottlerGuard)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.loginUseCase.execute(dto)
    this.tokenService.setAccessCookie(response, result.token)
    return { operator: result.operator }
  }

  @Post('step-up')
  @HttpCode(200)
  @UseGuards(AuthGuard, AuthThrottlerGuard)
  async stepUp(
    @Body() dto: StepUpDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = await this.stepUpUseCase.execute(req.user!.id, dto.password)
    this.tokenService.setStepUpCookie(response, token)
    return { success: true }
  }

  // Unguarded: clearing an already-absent or expired cookie is harmless,
  // and an expired session must still be able to trigger a clean logout (D5 follow-up).
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) response: Response) {
    this.tokenService.clearAccessCookie(response)
    this.tokenService.clearStepUpCookie(response)
    return { success: true }
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async getMe(@Req() req: AuthenticatedRequest): Promise<OperatorMeResponse> {
    // AuthGuard has set req.user = { id, email } from the verified JWT. A valid
    // token is NOT proof of an ACTIVE session: re-check the operator's CURRENT
    // status so a SUSPENDED or removed operator's live session is terminated on
    // their next /me poll (mirrors the idle-timeout / session-expiry 401).
    const operator = await this.operatorRepository.findById(req.user!.id)
    if (!operator || operator.status !== 'ACTIVE') {
      throw new UnauthorizedException(AUTH_REQUIRED_RESPONSE)
    }
    return { operator: { id: operator.id, email: operator.email } }
  }
}
