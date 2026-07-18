import { Injectable } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'

@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  /**
   * Tracker key: per-IP only (confirmed — JD follow-up).
   *
   * Email was previously included in the key but has been removed.
   * Rationale: keying by email lets an attacker lock out any victim's account
   * by flooding requests with that email. Per-IP-only is correct when viewpro-api
   * is behind `trust proxy 1` (single proxy, real IP in X-Forwarded-For).
   */
  protected override async getTracker(request: Record<string, unknown>) {
    const ip = typeof request.ip === 'string' ? request.ip : 'unknown-ip'
    const path = typeof request.path === 'string' ? request.path : 'unknown-path'

    return [ip, path].join(':')
  }
}
