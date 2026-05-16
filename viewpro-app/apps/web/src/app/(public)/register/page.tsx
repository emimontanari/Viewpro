import { RegisterTenantForm } from '@/components/auth/register-tenant-form'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { PageShell } from '@/components/ui/page-shell'

export default function RegisterPage() {
  return (
    <PageShell className="auth-page">
      <section className="auth-layout auth-layout--reverse" aria-labelledby="register-title">
        <div className="auth-layout__copy">
          <Badge tone="brass">Alta de inmobiliaria</Badge>
          <h1 id="register-title">Creá el tenant que va a ordenar cada conversación sobre propiedades.</h1>
          <p>
            Registrá la inmobiliaria y tu cuenta de gerente principal. Después del alta, ViewPro selecciona la nueva agencia
            y abre el workspace interno cuando la membresía está disponible.
          </p>
        </div>
        <Card className="auth-layout__card">
          <CardHeader>
            <p className="auth-layout__eyebrow">Primer workspace</p>
            <h2>Crear inmobiliaria</h2>
          </CardHeader>
          <CardContent>
            <RegisterTenantForm />
            <p className="auth-layout__switch">
              ¿Ya tenés acceso? <ButtonLink href="/login" variant="ghost">Ingresá</ButtonLink>
            </p>
          </CardContent>
        </Card>
      </section>
    </PageShell>
  )
}
