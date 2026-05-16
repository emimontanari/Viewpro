import Link from 'next/link'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

type ButtonStyleProps = {
  variant?: ButtonVariant
  size?: ButtonSize
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & ButtonStyleProps

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> &
  ButtonStyleProps & {
    href: string
    children: ReactNode
  }

function buttonClassName({
  className,
  variant = 'primary',
  size = 'md',
}: ButtonStyleProps & { className?: string }) {
  return ['vp-button', `vp-button--${variant}`, `vp-button--${size}`, className]
    .filter(Boolean)
    .join(' ')
}

export function Button({ className, variant, size, type = 'button', ...props }: ButtonProps) {
  return <button className={buttonClassName({ className, variant, size })} type={type} {...props} />
}

export function ButtonLink({ className, variant, size, href, ...props }: ButtonLinkProps) {
  return <Link className={buttonClassName({ className, variant, size })} href={href} {...props} />
}
