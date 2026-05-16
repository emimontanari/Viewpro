import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { PageShell } from '@/components/ui/page-shell'

export default function HomePage() {
  return (
    <PageShell>
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero__copy">
          <Badge tone="brass">Pilot foundation</Badge>
          <p className="home-hero__eyebrow">ViewPro para inmobiliarias premium</p>
          <h1 id="home-title">No solo gestionás propiedades. Tus propietarios ven el avance.</h1>
          <p className="home-hero__lead">
            Un espacio claro para transformar seguimiento, documentos y movimientos comerciales en confianza visible para cada dueño.
          </p>
          <div className="home-hero__actions" aria-label="Acciones principales">
            <ButtonLink href="/login" size="lg">
              Ingresar
            </ButtonLink>
            <ButtonLink href="/register" size="lg" variant="secondary">
              Crear agencia
            </ButtonLink>
          </div>
        </div>

        <Card className="home-hero__panel" aria-label="Vista previa de estado de una propiedad">
          <CardHeader>
            <div className="home-panel__topline">
              <Badge tone="teal">Owner-visible</Badge>
              <span>Actualizado esta semana</span>
            </div>
            <h2>Seguimiento editorial, sin ruido operativo.</h2>
          </CardHeader>
          <CardContent>
            <div className="home-panel__property">
              <span className="home-panel__label">Propiedad</span>
              <strong>Casa Terrada · Palermo</strong>
            </div>
            <div className="home-panel__timeline" aria-label="Ejemplo de ritmo de seguimiento">
              <span />
              <div>
                <strong>Movimiento publicado</strong>
                <p>La visita del sábado dejó dos interesados calificados y una próxima acción definida.</p>
              </div>
            </div>
            <Input
              disabled
              hint="Los formularios reales llegan en el próximo slice."
              id="preview-owner-note"
              label="Nota interna futura"
              placeholder="Ej.: preparar actualización para propietario…"
            />
          </CardContent>
        </Card>
      </section>

      <section className="home-proof" aria-label="Fundación del producto">
        <Card tone="subtle">
          <CardContent>
            <span className="home-proof__number">01</span>
            <h2>Base visual</h2>
            <p>Tokens, tipografía editorial y estados accesibles listos para las pantallas operativas.</p>
          </CardContent>
        </Card>
        <Card tone="subtle">
          <CardContent>
            <span className="home-proof__number">02</span>
            <h2>Componentes locales</h2>
            <p>Botones, campos, tarjetas, badges, shell y empty states sin dependencias externas.</p>
          </CardContent>
        </Card>
        <EmptyState
          action={
            <ButtonLink href="/login" variant="ghost">
              Ir al futuro ingreso
            </ButtonLink>
          }
          description="Las rutas de autenticación, selección de tenant y workspace se implementan en slices posteriores. Esta pantalla deja preparada la dirección visual."
          title="La experiencia comienza acá"
        />
      </section>
    </PageShell>
  )
}
