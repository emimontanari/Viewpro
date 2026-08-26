import { IsOptional, IsString } from 'class-validator'

export class UpdateWhatsappPhoneDto {
  /**
   * Raw WhatsApp phone value. The use case parses and validates it with
   * `parseArContactPhone`, the same Argentine mandatory rule enforced at
   * registration (#287 WU4, design.md ADR-6). The phone is mandatory now:
   * an absent key or an explicit `null` both reach the use case and both
   * become `phone.required`.
   *
   * MUST stay `@IsOptional() @IsString()`, never `@IsDefined()`. The global
   * `ValidationPipe` has no `exceptionFactory`, so a `class-validator`
   * rejection carries no `errorCode` — the verdict is thrown from the use
   * case, always (design.md ADR-3, ADR-6).
   */
  @IsOptional()
  @IsString()
  whatsappPhone?: string | null
}
