import type { UpdateWhatsappPhonePayload, WhatsappPhoneResponse } from './types'

const APP_URL =
  typeof window !== 'undefined'
    ? ''
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = path.startsWith('http') ? path : `${APP_URL}${path}`
  return fetch(url, {
    cache: 'no-store',
    credentials: 'include',
    ...init
  })
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T
  }
  const body = await response.json().catch(() => undefined)
  if (!response.ok) {
    const errorCode =
      body && typeof body === 'object' && 'code' in body ? (body as { code: string }).code : null
    const message =
      body && typeof body === 'object' && 'message' in body
        ? Array.isArray((body as { message: unknown }).message)
          ? ((body as { message: string[] }).message).join(', ')
          : String((body as { message: unknown }).message)
        : response.statusText
    const error = Object.assign(new Error(message), { errorCode })
    throw error
  }
  return body as T
}

export async function getTenantWhatsappPhone(): Promise<WhatsappPhoneResponse> {
  const response = await apiFetch('/api/tenants/me/whatsapp-phone')
  return parseResponse<WhatsappPhoneResponse>(response)
}

export async function updateTenantWhatsappPhone(
  payload: UpdateWhatsappPhonePayload
): Promise<void> {
  const response = await apiFetch('/api/tenants/me/whatsapp-phone', {
    body: JSON.stringify(payload),
    headers: { 'content-type': 'application/json' },
    method: 'PATCH'
  })
  return parseResponse<void>(response)
}
