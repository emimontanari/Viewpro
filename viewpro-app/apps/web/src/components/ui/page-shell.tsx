import type { HTMLAttributes } from 'react'

export function PageShell({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <main className={['vp-page-shell', className].filter(Boolean).join(' ')} {...props}>
      <div className="vp-page-shell__inner">{children}</div>
    </main>
  )
}
