import { Injectable } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'

@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(request: Record<string, unknown>) {
    const ip = typeof request.ip === 'string' ? request.ip : 'unknown-ip'
    const path = typeof request.path === 'string' ? request.path : 'unknown-path'
    const body = request.body as { email?: unknown } | undefined
    const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : undefined

    return [ip, path, email].filter(Boolean).join(':')
  }
}
