import Link from 'next/link'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'

type AdminShellProps = {
  children: ReactNode
  title: string
  description: string
}

export function AdminShell({ children, title, description }: AdminShellProps) {
  return (
    <main className="admin-shell">
      <div className="admin-shell__frame">
        <header className="admin-shell__header">
          <Link className="admin-shell__brand" href="/admin" aria-label="ViewPro Admin">
            ViewPro Admin
          </Link>
          <nav className="admin-shell__nav" aria-label="Navegación admin">
            <a href="#admin-summary">Salud global</a>
            <a href="#admin-tenants">Tenants</a>
            <a href="#admin-activity">Actividad</a>
          </nav>
        </header>
        <section className="admin-shell__hero" aria-labelledby="admin-shell-title">
          <div>
            <Badge tone="brass">Comando interno</Badge>
            <h1 id="admin-shell-title">{title}</h1>
            <p>{description}</p>
          </div>
          <Badge tone="teal">Read-only v1</Badge>
        </section>
        {children}
      </div>
    </main>
  )
}
