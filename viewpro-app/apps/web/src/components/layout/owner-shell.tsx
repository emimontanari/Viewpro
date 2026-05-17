import Link from 'next/link'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'

type OwnerShellProps = {
  children: ReactNode
  title: string
  description: string
}

export function OwnerShell({ children, title, description }: OwnerShellProps) {
  return (
    <main className="owner-shell">
      <div className="owner-shell__frame">
        <header className="owner-shell__header">
          <Link className="owner-shell__brand" href="/owner/properties" aria-label="ViewPro propietarios">
            ViewPro
          </Link>
          <nav className="owner-shell__nav" aria-label="Navegación de propietarios">
            <Link href="/owner/properties">Mis propiedades</Link>
          </nav>
        </header>
        <section className="owner-shell__hero" aria-labelledby="owner-shell-title">
          <div>
            <Badge tone="brass">Portal propietario</Badge>
            <h1 id="owner-shell-title">{title}</h1>
            <p>{description}</p>
          </div>
        </section>
        {children}
      </div>
    </main>
  )
}
