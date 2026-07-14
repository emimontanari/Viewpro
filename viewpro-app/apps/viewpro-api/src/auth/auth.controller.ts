import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { LoginDto } from './dto/login.dto'
import { AuthGuard, type AuthenticatedRequest } from './guards/auth.guard'
import { AuthThrottlerGuard } from './guards/auth-throttler.guard'
import { TokenService } from './tokens/token.service'
import { LoginUseCase } from './use-cases/login.use-case'

export type OperatorMeResponse = { operator: { id: string; email: string } }

@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
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

  // Unguarded: clearing an already-absent or expired cookie is harmless,
  // and an expired session must still be able to trigger a clean logout (D5 follow-up).
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) response: Response) {
    this.tokenService.clearAccessCookie(response)
    return { success: true }
  }

  @Get('me')
  @UseGuards(AuthGuard)
  getMe(@Req() req: AuthenticatedRequest): OperatorMeResponse {
    // AuthGuard has set req.user = { id, email } from the verified JWT (no DB).
    return { operator: { id: req.user!.id, email: req.user!.email } }
  }
}
