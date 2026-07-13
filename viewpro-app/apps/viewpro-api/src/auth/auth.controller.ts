import { Body, Controller, HttpCode, Post, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { LoginDto } from './dto/login.dto'
import { AuthThrottlerGuard } from './guards/auth-throttler.guard'
import { TokenService } from './tokens/token.service'
import { LoginUseCase } from './use-cases/login.use-case'

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
}
