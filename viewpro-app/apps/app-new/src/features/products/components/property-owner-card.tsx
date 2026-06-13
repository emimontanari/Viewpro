import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import type { PropertyLinkedOwner, PropertyOwnerAccessStatus } from '../api/types';
import { EntityCard, type EntityBadge, getLinkedEntityCountCopy } from './entity-card';
import { SectionHeader } from './section-header';
import { getProductStatusBadgeTone, ownerAccessToneByStatus } from './status-tones';

type ManualInvitationFallback = {
  ownerId: string;
  invitationUrl: string;
};

type PropertyOwnerCardProps = {
  canManageOwners?: boolean;
  copyingInvitationOwnerId?: string | null;
  isArchived: boolean;
  isLinkDisabled: boolean;
  manualInvitationFallback?: ManualInvitationFallback | null;
  onCopyInvitationLink?: (owner: PropertyLinkedOwner) => void;
  onRevokeInvitationLink?: (owner: PropertyLinkedOwner) => void;
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

export function PropertyOwnerCard({
  canManageOwners = true,
  copyingInvitationOwnerId = null,
  isArchived,
  isLinkDisabled,
  manualInvitationFallback = null,
  onCopyInvitationLink,
  onRevokeInvitationLink,
  onLinkOwner,
  ownerEmail,
  ownerName,
  owners
}: PropertyOwnerCardProps) {
  const hasLinkedOwners = owners.length > 0;

  return (
    <section className='space-y-3 rounded-xl border bg-muted/20 p-3 sm:p-4'>
      <SectionHeader
        description={getOwnerSummary(owners, ownerName)}
        icon={Icons.user2}
        label='Propietario'
      />

      {hasLinkedOwners ? (
        <ul className='space-y-2'>
          {owners.map((owner) => {
            const displayName = getOwnerDisplayName(owner);

            return (
              <li key={owner.id}>
                <EntityCard
                  ariaLabel={`Ver detalle de ${displayName}`}
                  badges={getOwnerBadges(owner)}
                  email={owner.email}
                  name={displayName}
                  // TODO: connect to contact detail navigation when a contact/person route exists.
                  onClick={() => undefined}
                >
                  {!isArchived &&
                  canManageOwners &&
                  owner.accessStatus === 'INVITED' &&
                  (onCopyInvitationLink || onRevokeInvitationLink) ? (
                    <div className='flex flex-wrap gap-2'>
                      {onCopyInvitationLink ? (
                        <Button
                          type='button'
                          size='sm'
                          variant='outline'
                          className='h-8 w-fit'
                          disabled={copyingInvitationOwnerId === owner.id}
                          onClick={() => onCopyInvitationLink(owner)}
                        >
                          Regenerar y copiar link
                        </Button>
                      ) : null}
                      {onRevokeInvitationLink ? (
                        <Button
                          type='button'
                          size='sm'
                          variant='destructive'
                          className='h-8 w-fit'
                          onClick={() => onRevokeInvitationLink(owner)}
                        >
                          Revocar invitación
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                  {manualInvitationFallback?.ownerId === owner.id ? (
                    <div className='mt-3 rounded-md border border-dashed bg-muted/40 p-2 text-xs'>
                      <p className='font-medium'>Copiá este link manualmente:</p>
                      <a
                        href={manualInvitationFallback.invitationUrl}
                        className='break-all underline underline-offset-4'
                      >
                        {manualInvitationFallback.invitationUrl}
                      </a>
                    </div>
                  ) : null}
                </EntityCard>
              </li>
            );
          })}
        </ul>
      ) : (
        <OwnerReference ownerEmail={ownerEmail} ownerName={ownerName} />
      )}

      {isArchived ? (
        <p className='text-xs leading-5 text-foreground/70'>
          Restaurá la propiedad para vincular propietarios.
        </p>
      ) : canManageOwners ? (
        <Button
          type='button'
          size='sm'
          variant='outline'
          disabled={isLinkDisabled}
          className='w-full whitespace-nowrap'
          onClick={onLinkOwner}
        >
          <Icons.userPen className='size-4' />
          Vincular propietario
        </Button>
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
      <div className='rounded-lg border border-dashed bg-background/60 p-3 text-sm text-foreground/70'>
        Todavía no hay propietario vinculado ni datos de referencia cargados.
      </div>
    );
  }

  return (
    <div className='space-y-2 rounded-lg border border-dashed bg-background/60 p-3'>
      <p className='text-xs font-medium tracking-wide text-muted-foreground uppercase'>
        Referencia cargada
      </p>
      <div className='space-y-1 text-sm'>
        <p className='break-words font-medium'>{ownerName ?? 'Sin nombre'}</p>
        <p className='break-all text-foreground/70'>{ownerEmail ?? 'Sin email'}</p>
      </div>
    </div>
  );
}

function getOwnerBadges(owner: PropertyLinkedOwner): EntityBadge[] {
  return [
    ...(owner.isPrimary ? [{ className: 'bg-background', label: 'Principal' }] : []),
    {
      className: getProductStatusBadgeTone(ownerAccessToneByStatus[owner.accessStatus]),
      label: ownerStatusLabels[owner.accessStatus]
    }
  ];
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

function getOwnerSummary(owners: PropertyLinkedOwner[], ownerName: string | null) {
  if (owners.length > 0) {
    return getLinkedEntityCountCopy(
      owners.length,
      'propietario vinculado',
      'propietarios vinculados'
    );
  }

  return ownerName
    ? '0 propietarios vinculados · datos cargados como referencia'
    : '0 propietarios vinculados';
}
