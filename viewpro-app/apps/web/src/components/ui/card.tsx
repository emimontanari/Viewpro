import type { HTMLAttributes } from 'react'

type CardProps = HTMLAttributes<HTMLDivElement> & {
  tone?: 'default' | 'subtle'
}

function cardClassName(className?: string, tone: CardProps['tone'] = 'default') {
  return ['vp-card', tone === 'subtle' ? 'vp-card--subtle' : undefined, className].filter(Boolean).join(' ')
}

export function Card({ className, tone = 'default', ...props }: CardProps) {
  return <div className={cardClassName(className, tone)} {...props} />
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={['vp-card__header', className].filter(Boolean).join(' ')} {...props} />
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={['vp-card__content', className].filter(Boolean).join(' ')} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={['vp-card__footer', className].filter(Boolean).join(' ')} {...props} />
}
