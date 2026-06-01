import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { TeamInvitationRole, User } from '../api/types';

type TeamMembersListProps = {
  canManageTeam?: boolean;
  currentMembershipId?: string | null;
  members: User[];
  isUpdatingRoleMembershipId?: string | null;
  isDeactivatingMembershipId?: string | null;
  onUpdateRole?: (membershipId: string, role: TeamInvitationRole) => void;
  onDeactivate?: (membershipId: string) => void;
};

export function TeamMembersList({
  canManageTeam = false,
  currentMembershipId = null,
  members,
  isUpdatingRoleMembershipId = null,
  isDeactivatingMembershipId = null,
  onUpdateRole,
  onDeactivate
}: TeamMembersListProps) {
  if (members.length === 0) {
    return (
      <div className='text-muted-foreground rounded-lg border p-6 text-sm'>
        <h2 className='text-foreground mb-2 font-medium'>No hay miembros del equipo</h2>
        <p>No se encontraron miembros para el tenant seleccionado.</p>
      </div>
    );
  }

  return (
    <div className='overflow-hidden rounded-lg border'>
      <table className='w-full text-sm'>
        <thead className='bg-muted/50 text-muted-foreground'>
          <tr>
            <th className='px-4 py-3 text-left font-medium'>Nombre</th>
            <th className='px-4 py-3 text-left font-medium'>Email</th>
            <th className='px-4 py-3 text-left font-medium'>Rol</th>
            <th className='px-4 py-3 text-left font-medium'>Usuario</th>
            <th className='px-4 py-3 text-left font-medium'>Acceso</th>
            <th className='px-4 py-3 text-left font-medium'>Miembro desde</th>
            {canManageTeam ? <th className='px-4 py-3 text-right font-medium'>Acciones</th> : null}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const nextRole = getNextAssignableRole(member.role);
            const isActiveMembership = member.membershipStatus === 'ACTIVE';
            const isPrincipal = member.role === 'PRINCIPAL_MANAGER';
            const isSelf = member.membershipId === currentMembershipId;
            const canShowMutatingActions = canManageTeam && isActiveMembership && !isPrincipal;
            const isUpdatingRole = isUpdatingRoleMembershipId === member.membershipId;
            const isDeactivating = isDeactivatingMembershipId === member.membershipId;

            return (
              <tr key={member.membershipId} className='border-t'>
                <td className='px-4 py-3 font-medium'>{formatName(member)}</td>
                <td className='text-muted-foreground px-4 py-3'>{member.email}</td>
                <td className='px-4 py-3'>
                  <Badge variant='outline'>{formatRole(member.role)}</Badge>
                </td>
                <td className='px-4 py-3'>
                  <Badge variant={member.userStatus === 'ACTIVE' ? 'default' : 'secondary'}>
                    {formatUserStatus(member.userStatus)}
                  </Badge>
                </td>
                <td className='px-4 py-3'>
                  <Badge variant={isActiveMembership ? 'default' : 'secondary'}>
                    {formatMembershipStatus(member.membershipStatus)}
                  </Badge>
                </td>
                <td className='text-muted-foreground px-4 py-3'>{formatDate(member.createdAt)}</td>
                {canManageTeam ? (
                  <td className='px-4 py-3'>
                    {canShowMutatingActions ? (
                      <div className='flex flex-col justify-end gap-2 sm:flex-row'>
                        {nextRole ? (
                          <Button
                            type='button'
                            size='sm'
                            variant='outline'
                            disabled={isUpdatingRole || isDeactivating}
                            onClick={() => onUpdateRole?.(member.membershipId, nextRole)}
                          >
                            {isUpdatingRole ? 'Actualizando...' : formatRoleAction(nextRole)}
                          </Button>
                        ) : null}
                        {!isSelf ? (
                          <Button
                            type='button'
                            size='sm'
                            variant='destructive'
                            disabled={isUpdatingRole || isDeactivating}
                            onClick={() => onDeactivate?.(member.membershipId)}
                          >
                            {isDeactivating ? 'Desactivando...' : 'Desactivar acceso'}
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <span className='text-muted-foreground block text-right text-xs'>
                        Sin acciones disponibles
                      </span>
                    )}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatName(member: User) {
  return [member.firstName, member.lastName].filter(Boolean).join(' ');
}

function formatRole(role: User['role']) {
  if (role === 'PRINCIPAL_MANAGER') {
    return 'Principal manager';
  }

  if (role === 'MANAGER') {
    return 'Manager';
  }

  return 'Agente';
}

function formatRoleAction(role: TeamInvitationRole) {
  return role === 'MANAGER' ? 'Hacer manager' : 'Hacer agente';
}

function getNextAssignableRole(role: User['role']): TeamInvitationRole | null {
  if (role === 'MANAGER') {
    return 'AGENT';
  }

  if (role === 'AGENT') {
    return 'MANAGER';
  }

  return null;
}

function formatUserStatus(status: User['userStatus']) {
  return status === 'ACTIVE' ? 'Activo' : 'Suspendido';
}

function formatMembershipStatus(status: User['membershipStatus']) {
  return status === 'ACTIVE' ? 'Activo' : 'Desactivado';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(value)
  );
}
