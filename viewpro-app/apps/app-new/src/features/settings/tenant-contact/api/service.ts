import { bffRequest } from '@/lib/bff-client';
import type { UpdateWhatsappPhonePayload, WhatsappPhoneResponse } from './types';

export async function getTenantWhatsappPhone(): Promise<WhatsappPhoneResponse> {
  return bffRequest<WhatsappPhoneResponse>('/api/tenants/me/whatsapp-phone');
}

export async function updateTenantWhatsappPhone(
  payload: UpdateWhatsappPhonePayload
): Promise<void> {
  return bffRequest<void>('/api/tenants/me/whatsapp-phone', {
    body: JSON.stringify(payload),
    headers: { 'content-type': 'application/json' },
    method: 'PATCH'
  });
}
