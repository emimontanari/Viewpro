import { IsOptional, IsString } from 'class-validator'

export class UpdateWhatsappPhoneDto {
  /**
   * Raw WhatsApp phone value. The use case normalizes and validates it.
   * Pass null to clear the stored phone number.
   */
  @IsOptional()
  @IsString()
  whatsappPhone?: string | null
}
