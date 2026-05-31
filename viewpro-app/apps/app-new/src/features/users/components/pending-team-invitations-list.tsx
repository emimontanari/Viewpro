import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PendingTeamInvitation } from '../api/types';

type PendingTeamInvitationsListProps = {
  copiedInvitationUrl: string | null;
  invitations: PendingTeamInvitation[];
  isRegeneratingInvitationId?: string | null;
  isRevokingInvitationId?: string | null;
  onRegenerateAndCopy: (invitationId: string) => void;
  onRevoke: (invitationId: string) => void;
};

export function PendingTeamInvitationsList({
  copiedInvitationUrl,
  invitations,
  isRegeneratingInvitationId = null,
  isRevokingInvitationId = null,
  onRegenerateAndCopy,
  onRevoke
}: PendingTeamInvitationsListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitaciones pendientes</CardTitle>
        <CardDescription>
          Links activos que todavía no fueron aceptados. Regenerar un link invalida el anterior.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        {copiedInvitationUrl ? (
          <div className='bg-muted/40 rounded-lg border p-4 text-sm'>
            <p className='text-muted-foreground mb-2 font-medium'>Copiá este link manualmente:</p>
            <a
              href={copiedInvitationUrl}
              className='text-primary break-all underline underline-offset-4'
            >
              {copiedInvitationUrl}
            </a>
          </div>
        ) : null}

        {invitations.length === 0 ? (
          <div className='text-muted-foreground rounded-lg border p-6 text-sm'>
            <h2 className='text-foreground mb-2 font-medium'>No hay invitaciones pendientes</h2>
            <p>Cuando generes invitaciones para managers o agentes, van a aparecer acá.</p>
          </div>
        ) : (
          <div className='overflow-hidden rounded-lg border'>
            <table className='w-full text-sm'>
              <thead className='bg-muted/50 text-muted-foreground'>
                <tr>
                  <th className='px-4 py-3 text-left font-medium'>Email</th>
                  <th className='px-4 py-3 text-left font-medium'>Rol</th>
                  <th className='px-4 py-3 text-left font-medium'>Vence</th>
                  <th className='px-4 py-3 text-right font-medium'>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((invitation) => {
                  const isRegenerating = isRegeneratingInvitationId === invitation.invitationId;
                  const isRevoking = isRevokingInvitationId === invitation.invitationId;

                  return (
                    <tr key={invitation.invitationId} className='border-t'>
                      <td className='px-4 py-3 font-medium'>{invitation.email}</td>
                      <td className='px-4 py-3'>
                        <Badge variant='outline'>{formatRole(invitation.role)}</Badge>
                      </td>
                      <td className='text-muted-foreground px-4 py-3'>
                        {formatDate(invitation.expiresAt)}
                      </td>
                      <td className='px-4 py-3'>
                        <div className='flex flex-col justify-end gap-2 sm:flex-row'>
                          <Button
                            type='button'
                            size='sm'
                            variant='outline'
                            disabled={isRegenerating || isRevoking}
                            onClick={() => onRegenerateAndCopy(invitation.invitationId)}
                          >
                            {isRegenerating ? 'Regenerando...' : 'Regenerar y copiar link'}
                          </Button>
                          <Button
                            type='button'
                            size='sm'
                            variant='destructive'
                            disabled={isRegenerating || isRevoking}
                            onClick={() => onRevoke(invitation.invitationId)}
                          >
                            {isRevoking ? 'Revocando...' : 'Revocar'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatRole(role: PendingTeamInvitation['role']) {
  return role === 'MANAGER' ? 'Manager' : 'Agente';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(value)
  );
}
