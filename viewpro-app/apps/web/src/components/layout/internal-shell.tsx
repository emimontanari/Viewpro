import Link from 'next/link'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'

type InternalShellProps = {
  children: ReactNode
  selectedTenantName?: string
  title: string
  description: string
}

const primaryNavigation = [
  { href: '/dashboard', label: 'Inicio' },
  { href: '/engagements', label: 'Gestiones' },
  { href: '/dashboard#propiedades', label: 'Propiedades' },
  { href: '/dashboard#propietarios', label: 'Propietarios' },
  { href: '/dashboard#documentos', label: 'Documentos' },
  { href: '/dashboard#equipo', label: 'Equipo' },
  { href: '/analytics', label: 'Métricas' },
  { href: '/select-tenant', label: 'Configuración' },
]

export function InternalShell({ children, selectedTenantName, title, description }: InternalShellProps) {
  return (
    <main className="internal-shell">
      <div className="internal-shell__frame">
        <header className="internal-shell__header">
          <Link className="internal-shell__brand" href="/dashboard" aria-label="ViewPro Inicio">
            ViewPro
          </Link>
          <nav className="internal-shell__nav" aria-label="Navegación de la inmobiliaria">
            {primaryNavigation.map((item) => (
              <Link key={item.label} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <section className="internal-shell__hero" aria-labelledby="internal-shell-title">
          <div>
            <Badge tone="teal">Panel de inmobiliaria</Badge>
            <h1 id="internal-shell-title">{title}</h1>
            <p>{description}</p>
          </div>
          {selectedTenantName ? <Badge tone="brass">{selectedTenantName}</Badge> : null}
        </section>
        {children}
      </div>
    </main>
  )
}
