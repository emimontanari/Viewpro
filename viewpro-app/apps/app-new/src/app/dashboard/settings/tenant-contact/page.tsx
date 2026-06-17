'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PageContainer from '@/components/layout/page-container'
import { useActiveTenant } from '@/lib/session-context'
import { canManageTenantSettings } from '@/lib/session'
import { useTenantWhatsappPhone } from '@/features/settings/tenant-contact/api/queries'
import { TenantContactForm } from '@/features/settings/tenant-contact/components/tenant-contact-form'

export default function TenantContactPage() {
  const router = useRouter()
  const { activeMembership, isTenantLoading } = useActiveTenant()
  const hasPermission = canManageTenantSettings(activeMembership)
  const { data, isLoading: isPhoneLoading } = useTenantWhatsappPhone({
    enabled: hasPermission
  })

  useEffect(() => {
    if (!isTenantLoading && !hasPermission) {
      router.push('/dashboard')
    }
  }, [isTenantLoading, hasPermission, router])

  const isLoading = isTenantLoading || isPhoneLoading

  if (!hasPermission) {
    return null
  }

  return (
    <PageContainer
      isLoading={isLoading}
      pageTitle='Contacto WhatsApp del workspace'
      pageDescription='Configurá el teléfono de WhatsApp que se mostrará en el portal de propietarios.'
    >
      <TenantContactForm defaultPhone={data?.whatsappPhone ?? null} />
    </PageContainer>
  )
}
