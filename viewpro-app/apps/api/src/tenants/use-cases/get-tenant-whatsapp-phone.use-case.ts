import { Inject, Injectable } from '@nestjs/common'
import { TENANTS_REPOSITORY, type TenantsRepository } from '../tenants.repository'

export type GetTenantWhatsappPhoneInput = {
  tenantId: string
}

export type GetTenantWhatsappPhoneResult = {
  whatsappPhone: string | null
}

@Injectable()
export class GetTenantWhatsappPhoneUseCase {
  constructor(
    @Inject(TENANTS_REPOSITORY)
    private readonly tenantsRepository: TenantsRepository,
  ) {}

  async execute(input: GetTenantWhatsappPhoneInput): Promise<GetTenantWhatsappPhoneResult> {
    const record = await this.tenantsRepository.findWhatsappPhone(input.tenantId)
    // Returns { whatsappPhone: null } when tenant not found — matches design D5 (not found → null).
    return { whatsappPhone: record?.whatsappPhone ?? null }
  }
}
