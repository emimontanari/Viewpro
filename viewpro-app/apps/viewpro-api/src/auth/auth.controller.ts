import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { LoginDto } from './dto/login.dto'
import { StepUpDto } from './dto/step-up.dto'
import { AuthGuard, type AuthenticatedRequest } from './guards/auth.guard'
import { AuthThrottlerGuard } from './guards/auth-throttler.guard'
import { TokenService } from './tokens/token.service'
import { LoginUseCase } from './use-cases/login.use-case'
import { StepUpUseCase } from './use-cases/step-up.use-case'

export type OperatorMeResponse = { operator: { id: string; email: string } }

@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly stepUpUseCase: StepUpUseCase,
    private readonly tokenService: TokenService,
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
  getMe(@Req() req: AuthenticatedRequest): OperatorMeResponse {
    // AuthGuard has set req.user = { id, email } from the verified JWT (no DB).
    return { operator: { id: req.user!.id, email: req.user!.email } }
  }
}
