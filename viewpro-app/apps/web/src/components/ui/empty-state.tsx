import type { ReactNode } from 'react'

type EmptyStateProps = {
  title: string
  description: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <section className={['vp-empty-state', className].filter(Boolean).join(' ')}>
      <svg aria-hidden="true" className="vp-empty-state__mark" fill="none" viewBox="0 0 48 48">
        <path d="M10 34V14l14-6 14 6v20l-14 6-14-6Z" stroke="currentColor" strokeWidth="2" />
        <path d="M16 20h16M16 27h11" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      </svg>
      <div>
        <h2 className="vp-empty-state__title">{title}</h2>
        <p className="vp-empty-state__description">{description}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </section>
  )
}
