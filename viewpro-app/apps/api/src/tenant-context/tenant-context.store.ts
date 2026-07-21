import { Injectable } from '@nestjs/common'
import { ClsService } from 'nestjs-cls'

const TENANT_ID_KEY = 'tenantId'

/**
 * Request-scoped store for the active tenant id, backed by AsyncLocalStorage
 * (nestjs-cls). Populated by TenantMembershipGuard after it validates the
 * membership, and read downstream.
 *
 * Phase 1 of the multi-tenant isolation backstop: this only PROPAGATES the id
 * through the request. Enforcement in the Prisma layer (inject/validate
 * `where: { tenantId }`) lands in later phases and reads from here.
 */
@Injectable()
export class TenantContextStore {
  constructor(private readonly cls: ClsService) {}

  setTenantId(tenantId: string): void {
    this.cls.set(TENANT_ID_KEY, tenantId)
  }

  /**
   * The active tenant id, or undefined when there is no request context or the
   * request is not tenant-scoped (auth, platform lane, owner portal, jobs).
   * Never throws — reads outside an active context are safe.
   */
  getTenantId(): string | undefined {
    if (!this.cls.isActive()) {
      return undefined
    }

    return this.cls.get<string | undefined>(TENANT_ID_KEY)
  }
}
