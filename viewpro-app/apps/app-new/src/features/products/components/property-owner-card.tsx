import { Icons } from '@/components/icons';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PropertyLinkedOwner, PropertyOwnerAccessStatus } from '../api/types';
import { cn } from '@/lib/utils';

type PropertyOwnerCardProps = {
  isArchived: boolean;
  isLinkDisabled: boolean;
  onLinkOwner: () => void;
  ownerEmail: string | null;
  ownerName: string | null;
  owners: PropertyLinkedOwner[];
};

const ownerStatusLabels: Record<PropertyOwnerAccessStatus, string> = {
  ACTIVE: 'Activo',
  INVITED: 'Invitado',
  REVOKED: 'Revocado'
};

const ownerStatusTones: Record<PropertyOwnerAccessStatus, string> = {
  ACTIVE:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300',
  INVITED:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300',
  REVOKED:
    'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300'
};

export function PropertyOwnerCard({
  isArchived,
  isLinkDisabled,
  onLinkOwner,
  ownerEmail,
  ownerName,
  owners
}: PropertyOwnerCardProps) {
  const hasLinkedOwners = owners.length > 0;

  return (
    <section className='space-y-3 rounded-xl border bg-muted/20 p-3 sm:p-4'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div className='space-y-1'>
          <div className='flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground'>
            <Icons.user2 className='size-4' />
            Propietario
          </div>
          <p className='text-sm text-muted-foreground'>{getOwnerSummary(owners, ownerName)}</p>
        </div>
        {isArchived ? null : (
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={isLinkDisabled}
            className='shrink-0 whitespace-nowrap'
            onClick={onLinkOwner}
          >
            <Icons.userPen className='size-4' />
            Vincular propietario
          </Button>
        )}
      </div>

      {hasLinkedOwners ? (
        <ul className='space-y-2'>
          {owners.map((owner) => (
            <li key={owner.id} className='rounded-lg border bg-background/70 p-3'>
              <div className='flex min-w-0 items-start gap-3'>
                <Avatar className='size-9 shrink-0 rounded-full border bg-muted'>
                  <AvatarFallback className='text-xs font-semibold'>
                    {getOwnerInitials(owner)}
                  </AvatarFallback>
                </Avatar>
                <div className='min-w-0 flex-1 space-y-2'>
                  <div className='min-w-0 space-y-0.5'>
                    <p className='truncate text-sm font-medium' title={getOwnerDisplayName(owner)}>
                      {getOwnerDisplayName(owner)}
                    </p>
                    <p className='truncate text-sm text-muted-foreground' title={owner.email}>
                      {owner.email}
                    </p>
                  </div>
                  <div className='flex flex-wrap items-center gap-1.5'>
                    {owner.isPrimary ? (
                      <Badge
                        variant='outline'
                        className='rounded-md bg-background px-1.5 py-0 text-[11px]'
                      >
                        Principal
                      </Badge>
                    ) : null}
                    <Badge
                      variant='outline'
                      className={cn(
                        'rounded-md px-1.5 py-0 text-[11px]',
                        ownerStatusTones[owner.accessStatus]
                      )}
                    >
                      {ownerStatusLabels[owner.accessStatus]}
                    </Badge>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <OwnerReference ownerEmail={ownerEmail} ownerName={ownerName} />
      )}

      {isArchived ? (
        <p className='text-xs leading-5 text-muted-foreground'>
          Restaurá la propiedad para vincular propietarios.
        </p>
      ) : null}
    </section>
  );
}

function OwnerReference({
  ownerEmail,
  ownerName
}: {
  ownerEmail: string | null;
  ownerName: string | null;
}) {
  if (!ownerName && !ownerEmail) {
    return (
      <div className='rounded-lg border border-dashed bg-background/60 p-3 text-sm text-muted-foreground'>
        Todavía no hay propietario vinculado ni datos de referencia cargados.
      </div>
    );
  }

  return (
    <div className='space-y-2 rounded-lg border border-dashed bg-background/60 p-3'>
      <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
        Referencia cargada
      </p>
      <div className='space-y-1 text-sm'>
        <p className='break-words font-medium'>{ownerName ?? 'Sin nombre'}</p>
        <p className='break-all text-muted-foreground'>{ownerEmail ?? 'Sin email'}</p>
      </div>
    </div>
  );
}

function getOwnerDisplayName(owner: PropertyLinkedOwner) {
  const snapshotName = [owner.ownerFirstName, owner.ownerLastName]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(' ');
  const userName = [owner.firstName, owner.lastName]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' ');

  return snapshotName || userName || owner.email;
}

function getOwnerInitials(owner: PropertyLinkedOwner) {
  const name = getOwnerDisplayName(owner);
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
  }

  return (parts[0]?.slice(0, 2) || owner.email.slice(0, 2)).toUpperCase();
}

function getOwnerSummary(owners: PropertyLinkedOwner[], ownerName: string | null) {
  if (owners.length === 1) {
    return '1 propietario vinculado a la propiedad.';
  }

  if (owners.length > 1) {
    return `${owners.length} propietarios vinculados a la propiedad.`;
  }

  return ownerName
    ? 'Datos de propietario cargados como referencia.'
    : 'Sin propietario vinculado.';
}
