import Link from 'next/link'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'

type InternalShellProps = {
  children: ReactNode
  selectedTenantName?: string
  title: string
  description: string
}

export function InternalShell({ children, selectedTenantName, title, description }: InternalShellProps) {
  return (
    <main className="internal-shell">
      <div className="internal-shell__frame">
        <header className="internal-shell__header">
          <Link className="internal-shell__brand" href="/dashboard" aria-label="ViewPro dashboard">
            ViewPro
          </Link>
          <nav className="internal-shell__nav" aria-label="Navegación del workspace">
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/engagements">Gestiones</Link>
            <Link href="/select-tenant">Tenant</Link>
          </nav>
        </header>
        <section className="internal-shell__hero" aria-labelledby="internal-shell-title">
          <div>
            <Badge tone="teal">Workspace interno</Badge>
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
