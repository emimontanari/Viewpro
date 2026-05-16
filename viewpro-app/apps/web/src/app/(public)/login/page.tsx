import { LoginForm } from '@/components/auth/login-form'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { PageShell } from '@/components/ui/page-shell'

export default function LoginPage() {
  return (
    <PageShell className="auth-page">
      <section className="auth-layout" aria-labelledby="login-title">
        <div className="auth-layout__copy">
          <Badge tone="teal">Acceso seguro</Badge>
          <h1 id="login-title">Entrá al workspace donde la confianza del propietario queda visible.</h1>
          <p>
            Ingresá con tu cuenta de inmobiliaria. ViewPro mantiene la sesión en cookies seguras del backend y sólo te pide
            elegir tenant cuando tu cuenta pertenece a más de una inmobiliaria.
          </p>
        </div>
        <Card className="auth-layout__card">
          <CardHeader>
            <p className="auth-layout__eyebrow">Bienvenido de nuevo</p>
            <h2>Ingresar a ViewPro</h2>
          </CardHeader>
          <CardContent>
            <LoginForm />
            <p className="auth-layout__switch">
              ¿Arrancás una inmobiliaria nueva? <ButtonLink href="/register" variant="ghost">Creala acá</ButtonLink>
            </p>
          </CardContent>
        </Card>
      </section>
    </PageShell>
  )
}
