import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export type EntityBadge = {
  className?: string;
  label: string;
};

type EntityCardProps = {
  actions?: ReactNode;
  ariaLabel?: string;
  badges?: EntityBadge[];
  children?: ReactNode;
  className?: string;
  email: string;
  name: string;
  onClick?: () => void;
};

export function EntityCard({
  actions,
  ariaLabel,
  badges = [],
  children,
  className,
  email,
  name,
  onClick
}: EntityCardProps) {
  const identity = (
    <>
      <Avatar className='size-9 shrink-0 rounded-full border bg-muted'>
        <AvatarFallback className='text-xs font-semibold'>
          {getEntityInitials(name, email)}
        </AvatarFallback>
      </Avatar>
      <div className='min-w-0 flex-1 space-y-2'>
        <div className='min-w-0 space-y-0.5'>
          <p className='truncate text-sm font-medium' title={name}>
            {name}
          </p>
          <p className='truncate text-sm text-foreground/70' title={email}>
            {email}
          </p>
        </div>
        {badges.length > 0 ? (
          <div className='flex flex-wrap items-center gap-1.5'>
            {badges.map((badge) => (
              <Badge
                key={`${badge.label}-${badge.className ?? 'default'}`}
                variant='outline'
                className={cn('rounded-md px-1.5 py-0 text-[11px]', badge.className)}
              >
                {badge.label}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );

  return (
    <div
      className={cn(
        'rounded-lg border border-border/60 bg-background/70 p-3 transition-colors',
        onClick ? 'hover:border-border/90' : null,
        className
      )}
    >
      {onClick ? (
        <button
          type='button'
          aria-label={ariaLabel ?? `Ver detalle de ${name}`}
          className='flex w-full min-w-0 items-start gap-3 rounded-md text-left transition-opacity focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:opacity-90'
          onClick={onClick}
        >
          {identity}
        </button>
      ) : (
        <div className='flex min-w-0 items-start gap-3'>{identity}</div>
      )}
      {children ? <div className='mt-3'>{children}</div> : null}
      {actions ? <div className='mt-3'>{actions}</div> : null}
    </div>
  );
}

export function getEntityInitials(name: string, fallbackEmail?: string | null) {
  const source = name.trim() || fallbackEmail?.trim() || '';
  const normalizedSource = source.includes('@') ? (source.split('@')[0] ?? source) : source;
  const parts = normalizedSource
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
  }

  return (parts[0]?.[0] ?? '').toUpperCase();
}

export function getLinkedEntityCountCopy(count: number, singular: string, plural: string) {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}
