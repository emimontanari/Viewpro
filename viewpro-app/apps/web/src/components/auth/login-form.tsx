'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { FormEvent } from 'react'

import { getApiErrorMessage } from '@/lib/api-client'
import { getSingleMembership, login } from '@/lib/session'
import { clearSelectedTenantId, setSelectedTenantId } from '@/lib/tenant-selection'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function LoginForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)

    try {
      const session = await login({
        email: getStringValue(formData, 'email'),
        password: getStringValue(formData, 'password'),
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
      <Input autoComplete="email" id="login-email" label="Email" name="email" required type="email" />
      <Input
        autoComplete="current-password"
        id="login-password"
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
        {isSubmitting ? 'Ingresando…' : 'Ingresar'}
      </Button>
    </form>
  )
}

function getStringValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}
