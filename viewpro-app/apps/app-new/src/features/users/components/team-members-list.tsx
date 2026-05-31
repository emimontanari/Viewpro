import { Badge } from '@/components/ui/badge';
import type { User } from '../api/types';

type TeamMembersListProps = {
  members: User[];
};

export function TeamMembersList({ members }: TeamMembersListProps) {
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
            <th className='px-4 py-3 text-left font-medium'>Estado</th>
            <th className='px-4 py-3 text-left font-medium'>Miembro desde</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.membershipId} className='border-t'>
              <td className='px-4 py-3 font-medium'>{formatName(member)}</td>
              <td className='text-muted-foreground px-4 py-3'>{member.email}</td>
              <td className='px-4 py-3'>
                <Badge variant='outline'>{formatRole(member.role)}</Badge>
              </td>
              <td className='px-4 py-3'>
                <Badge variant={member.userStatus === 'ACTIVE' ? 'default' : 'secondary'}>
                  {formatStatus(member.userStatus)}
                </Badge>
              </td>
              <td className='text-muted-foreground px-4 py-3'>{formatDate(member.createdAt)}</td>
            </tr>
          ))}
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

function formatStatus(status: User['userStatus']) {
  return status === 'ACTIVE' ? 'Activo' : 'Suspendido';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(value)
  );
}
