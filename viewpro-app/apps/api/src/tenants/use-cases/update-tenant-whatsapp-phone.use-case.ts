import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import {
  isValidWhatsappPhone,
  normalizeWhatsappPhone,
} from '../../common/whatsapp/whatsapp-phone.utils'
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
    const normalized = normalizeWhatsappPhone(input.whatsappPhone)

    if (!isValidWhatsappPhone(normalized)) {
      throw new BadRequestException({ code: 'phone.too_short' })
    }

    await this.tenantsRepository.updateWhatsappPhone(input.tenantId, normalized)
  }
}
