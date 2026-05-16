import type { InputHTMLAttributes, ReactNode } from 'react'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  hint?: ReactNode
  error?: ReactNode
}

export function Input({ className, id, label, hint, error, 'aria-describedby': ariaDescribedBy, ...props }: InputProps) {
  const hintId = hint && id ? `${id}-hint` : undefined
  const errorId = error && id ? `${id}-error` : undefined
  const describedBy = [ariaDescribedBy, hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="vp-input-wrap">
      {label ? (
        <label className="vp-label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <input
        aria-describedby={describedBy}
        aria-invalid={error ? true : props['aria-invalid']}
        className={['vp-input', className].filter(Boolean).join(' ')}
        id={id}
        {...props}
      />
      {hint ? (
        <p className="vp-field-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="vp-field-hint" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
