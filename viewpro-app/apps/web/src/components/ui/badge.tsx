import type { HTMLAttributes } from 'react'

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'teal' | 'brass' | 'success' | 'danger'
}

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  const toneClassName = tone === 'neutral' ? undefined : `vp-badge--${tone}`

  return <span className={['vp-badge', toneClassName, className].filter(Boolean).join(' ')} {...props} />
}
