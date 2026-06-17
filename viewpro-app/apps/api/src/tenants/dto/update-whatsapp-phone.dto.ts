import { IsDefined, IsString, ValidateIf } from 'class-validator'

export class UpdateWhatsappPhoneDto {
  /**
   * Raw WhatsApp phone value. The use case normalizes and validates it.
   * Pass null to clear the stored phone number.
   *
   * The key is required: omitting it would be ambiguous between "no change"
   * and "clear to null". Callers must send either a string or explicit null.
   * This mirrors the BFF Zod contract `z.object({ whatsappPhone: z.string().nullable() })`.
   */
  @IsDefined()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  whatsappPhone!: string | null
}
