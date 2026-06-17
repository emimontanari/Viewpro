import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getTenantWhatsappPhone, updateTenantWhatsappPhone } from './service'
import type { UpdateWhatsappPhonePayload } from './types'

export const tenantContactKeys = {
  all: ['tenant-contact'] as const,
  whatsappPhone: () => [...tenantContactKeys.all, 'whatsapp-phone'] as const
}

export function useTenantWhatsappPhone() {
  return useQuery({
    queryKey: tenantContactKeys.whatsappPhone(),
    queryFn: getTenantWhatsappPhone
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
