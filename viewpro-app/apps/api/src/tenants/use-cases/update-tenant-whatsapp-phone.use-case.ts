import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { parseArContactPhone } from '../../common/phone/ar-contact-phone'
import { TENANTS_REPOSITORY, type TenantsRepository } from '../tenants.repository'

export type UpdateTenantWhatsappPhoneInput = {
  tenantId: string
  whatsappPhone: string | null | undefined
}

@Injectable()
export class UpdateTenantWhatsappPhoneUseCase {
  constructor(
    @Inject(TENANTS_REPOSITORY)
    private readonly tenantsRepository: TenantsRepository,
  ) {}

  async execute(input: UpdateTenantWhatsappPhoneInput): Promise<void> {
    // Same mandatory Argentine rule as registration (#287 WU4, design.md
    // ADR-6): one rule, one module, shared with RegisterTenantUseCase.
    const phoneResult = parseArContactPhone(input.whatsappPhone)
    if (!phoneResult.ok) {
      const { errorCode } = phoneResult
      throw new BadRequestException({ errorCode })
    }

    await this.tenantsRepository.updateWhatsappPhone(input.tenantId, phoneResult.e164)
  }
}
