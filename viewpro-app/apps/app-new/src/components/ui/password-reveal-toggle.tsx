'use client';

import { Icons } from '@/components/icons';

type PasswordRevealToggleProps = {
  /** id of the input this controls, so assistive tech can associate the two. */
  controls: string;
  revealed: boolean;
  onToggle: () => void;
  className?: string;
};

/**
 * The accessible half of a password reveal control.
 *
 * Shared because the accessibility is the part worth having one of: the state
 * lives in `aria-pressed` and the label changes with it, so a screen reader
 * hears "Mostrar contraseña, not pressed" rather than "eye". Layout is left to
 * the caller — the surfaces that use this position it differently.
 */
export function PasswordRevealToggle({
  controls,
  revealed,
  onToggle,
  className
}: PasswordRevealToggleProps) {
  return (
    <button
      type='button'
      aria-pressed={revealed}
      aria-controls={controls}
      aria-label={revealed ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      onClick={onToggle}
      className={`text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-3 -translate-y-1/2 rounded-sm focus-visible:ring-2 focus-visible:outline-none ${className ?? ''}`}
    >
      {revealed ? (
        <Icons.eyeOff aria-hidden className='h-4 w-4' />
      ) : (
        <Icons.eye aria-hidden className='h-4 w-4' />
      )}
    </button>
  );
}
