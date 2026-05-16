'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { FormEvent } from 'react'

import { getApiErrorMessage } from '@/lib/api-client'
import { getSingleMembership, registerTenant } from '@/lib/session'
import { clearSelectedTenantId, setSelectedTenantId } from '@/lib/tenant-selection'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function RegisterTenantForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)

    try {
      const session = await registerTenant({
        email: getStringValue(formData, 'email'),
        firstName: getStringValue(formData, 'firstName'),
        lastName: getStringValue(formData, 'lastName'),
        password: getStringValue(formData, 'password'),
        tenantName: getStringValue(formData, 'tenantName'),
      })
      const membership = getSingleMembership(session)

      if (membership) {
        setSelectedTenantId(membership.tenant.id)
        router.push('/dashboard')
        return
      }

      clearSelectedTenantId()
      router.push('/select-tenant')
    } catch (caughtError) {
      setError(getApiErrorMessage(caughtError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <Input autoComplete="organization" id="register-tenant" label="Nombre de la inmobiliaria" name="tenantName" required />
      <div className="auth-form__grid">
        <Input autoComplete="given-name" id="register-first-name" label="Nombre" name="firstName" required />
        <Input autoComplete="family-name" id="register-last-name" label="Apellido" name="lastName" />
      </div>
      <Input autoComplete="email" id="register-email" label="Email laboral" name="email" required type="email" />
      <Input
        autoComplete="new-password"
        hint="Usá al menos 8 caracteres."
        id="register-password"
        label="Contraseña"
        minLength={8}
        name="password"
        required
        type="password"
      />
      {error ? (
        <p className="auth-form__error" role="alert">
          {error}
        </p>
      ) : null}
      <Button disabled={isSubmitting} size="lg" type="submit">
        {isSubmitting ? 'Creando inmobiliaria…' : 'Crear inmobiliaria'}
      </Button>
    </form>
  )
}

function getStringValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}
