import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getTenantWhatsappPhone, updateTenantWhatsappPhone } from './service'
import type { UpdateWhatsappPhonePayload } from './types'

export const tenantContactKeys = {
  all: ['tenant-contact'] as const,
  whatsappPhone: () => [...tenantContactKeys.all, 'whatsapp-phone'] as const
}

type UseTenantWhatsappPhoneOptions = {
  enabled?: boolean
}

export function useTenantWhatsappPhone(options: UseTenantWhatsappPhoneOptions = {}) {
  return useQuery({
    queryKey: tenantContactKeys.whatsappPhone(),
    queryFn: getTenantWhatsappPhone,
    enabled: options.enabled ?? true
  })
}

export function useUpdateTenantWhatsappPhone() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: UpdateWhatsappPhonePayload) => updateTenantWhatsappPhone(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantContactKeys.whatsappPhone() })
    }
  })
}
