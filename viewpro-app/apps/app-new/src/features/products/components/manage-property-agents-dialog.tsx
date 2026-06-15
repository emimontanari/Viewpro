'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Icons } from '@/components/icons';
import type { AssignableProductAgent, ProductAgent, TenantMemberRole } from '../api/types';
import { useMemo } from 'react';
import { EntityCard, getEntityInitials, getLinkedEntityCountCopy } from './entity-card';
import { SectionHeader } from './section-header';

type ManagePropertyAgentsDialogProps = {
  assignedAgents: ProductAgent[];
  assignableAgents: AssignableProductAgent[];
  assigningUserId: string | null;
  isAssignableAgentsError: boolean;
  isAssignableAgentsLoading: boolean;
  isAssigningAllAgents: boolean;
  onAssign: (agentUserId: string) => void;
  onAssignAll: (agentUserIds: string[]) => void;
  onOpenChange: (open: boolean) => void;
  onRemove: (agentId: string) => void;
  open: boolean;
  removingAgentId: string | null;
};

type PropertyAgentsPanelProps = {
  agents: ProductAgent[];
  canManageAgents?: boolean;
  isArchived: boolean;
  isManageDisabled: boolean;
  onManage: () => void;
};

const roleLabels: Record<TenantMemberRole, string> = {
  AGENT: 'Vendedor',
  MANAGER: 'Encargado',
  PRINCIPAL_MANAGER: 'Titular'
};

export function PropertyAgentsPanel({
  agents,
  canManageAgents = true,
  isArchived,
  isManageDisabled,
  onManage
}: PropertyAgentsPanelProps) {
  return (
    <section className='space-y-3 rounded-xl border bg-muted/20 p-3 sm:p-4'>
      <SectionHeader
        description={getAssignedAgentsDescription(agents.length)}
        icon={Icons.teams}
        label='Vendedores'
      />

      {agents.length > 0 ? (
        <ul className='space-y-2'>
          {agents.map((agent) => {
            const displayName = getAgentDisplayName(agent);

            return (
              <li key={agent.id}>
                <EntityCard
                  ariaLabel={`Ver detalle de ${displayName}`}
                  email={agent.email}
                  name={displayName}
                  // TODO: connect to team/contact detail navigation when a person route exists.
                  onClick={() => undefined}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <div className='rounded-lg border border-dashed bg-background/60 p-3 text-sm text-foreground/70'>
          Todavía no hay vendedores asignados.
        </div>
      )}

      {isArchived ? (
        <p className='text-xs leading-5 text-foreground/70'>
          Restaurá la propiedad para gestionar vendedores.
        </p>
      ) : canManageAgents ? (
        <Button
          type='button'
          size='sm'
          variant='outline'
          disabled={isManageDisabled}
          className='w-full whitespace-nowrap'
          onClick={onManage}
        >
          <Icons.teams className='size-4' />
          Gestionar vendedores
        </Button>
      ) : null}
    </section>
  );
}

export function ManagePropertyAgentsDialog({
  assignedAgents,
  assignableAgents,
  assigningUserId,
  isAssignableAgentsError,
  isAssignableAgentsLoading,
  isAssigningAllAgents,
  onAssign,
  onAssignAll,
  onOpenChange,
  onRemove,
  open,
  removingAgentId
}: ManagePropertyAgentsDialogProps) {
  const assignedUserIds = useMemo(
    () => new Set(assignedAgents.map((agent) => agent.userId)),
    [assignedAgents]
  );
  const availableAgents = useMemo(
    () => assignableAgents.filter((agent) => !assignedUserIds.has(agent.userId)),
    [assignableAgents, assignedUserIds]
  );
  const isMutating = Boolean(assigningUserId || removingAgentId || isAssigningAllAgents);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>Gestionar vendedores</DialogTitle>
          <DialogDescription>
            Asigná quién sigue esta propiedad y quitá accesos cuando ya no corresponda.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-6'>
          <section className='space-y-3'>
            <div>
              <h3 className='text-sm font-semibold'>Asignados actualmente</h3>
              <p className='text-sm text-muted-foreground'>
                Estos vendedores pueden operar la gestión según sus permisos.
              </p>
            </div>
            {assignedAgents.length > 0 ? (
              <ul className='space-y-2'>
                {assignedAgents.map((agent) => {
                  const isRemoving = removingAgentId === agent.id;

                  return (
                    <li
                      key={agent.id}
                      className='flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between'
                    >
                      <AgentIdentity agent={agent} />
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        disabled={isMutating}
                        isLoading={isRemoving}
                        onClick={() => onRemove(agent.id)}
                      >
                        <Icons.trash className='size-4' />
                        Quitar
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className='rounded-xl border border-dashed p-4 text-sm text-muted-foreground'>
                No hay vendedores asignados a esta propiedad.
              </div>
            )}
          </section>

          <section className='space-y-3'>
            <div>
              <h3 className='text-sm font-semibold'>Disponibles para asignar</h3>
              <p className='text-sm text-muted-foreground'>
                Elegí integrantes de la inmobiliaria para sumarlos a esta gestión.
              </p>
            </div>
            {renderAssignableAgentsState({
              availableAgents,
              assigningUserId,
              isAssignableAgentsError,
              isAssignableAgentsLoading,
              isMutating,
              isAssigningAllAgents,
              onAssign,
              onAssignAll
            })}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function renderAssignableAgentsState({
  availableAgents,
  assigningUserId,
  isAssignableAgentsError,
  isAssignableAgentsLoading,
  isMutating,
  isAssigningAllAgents,
  onAssign,
  onAssignAll
}: {
  availableAgents: AssignableProductAgent[];
  assigningUserId: string | null;
  isAssignableAgentsError: boolean;
  isAssignableAgentsLoading: boolean;
  isMutating: boolean;
  isAssigningAllAgents: boolean;
  onAssign: (agentUserId: string) => void;
  onAssignAll: (agentUserIds: string[]) => void;
}) {
  if (isAssignableAgentsLoading) {
    return (
      <div className='space-y-2' aria-label='Cargando vendedores disponibles'>
        {[0, 1, 2].map((item) => (
          <div key={item} className='rounded-xl border p-3'>
            <div className='h-4 w-44 animate-pulse rounded bg-muted' />
            <div className='mt-2 h-3 w-64 max-w-full animate-pulse rounded bg-muted' />
          </div>
        ))}
      </div>
    );
  }

  if (isAssignableAgentsError) {
    return (
      <div className='rounded-xl border border-dashed p-4 text-sm text-muted-foreground'>
        No se pudieron cargar los vendedores disponibles.
      </div>
    );
  }

  if (availableAgents.length === 0) {
    return (
      <div className='rounded-xl border border-dashed p-4 text-sm text-muted-foreground'>
        No hay más integrantes disponibles para asignar.
      </div>
    );
  }

  const availableAgentIds = availableAgents.map((agent) => agent.userId);

  return (
    <div className='space-y-3'>
      <div className='flex flex-col gap-2 rounded-xl border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between'>
        <p className='text-sm text-foreground/70'>
          {getAvailableAgentsDescription(availableAgents.length)}
        </p>
        <Button
          type='button'
          size='sm'
          variant='secondary'
          disabled={isMutating}
          isLoading={isAssigningAllAgents}
          onClick={() => onAssignAll(availableAgentIds)}
        >
          <Icons.add className='size-4' />
          {getAssignAllButtonLabel(availableAgents.length)}
        </Button>
      </div>

      <ul className='space-y-2'>
        {availableAgents.map((agent) => {
          const isAssigning = assigningUserId === agent.userId;

          return (
            <li
              key={agent.userId}
              className='flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between'
            >
              <div className='min-w-0 space-y-1'>
                <div className='flex flex-wrap items-center gap-2'>
                  <p className='break-words text-sm font-medium'>{getAgentDisplayName(agent)}</p>
                  <Badge variant='outline' className='rounded-full bg-muted/40'>
                    {roleLabels[agent.role]}
                  </Badge>
                </div>
                <p className='break-all text-sm text-foreground/70'>{agent.email}</p>
              </div>
              <Button
                type='button'
                size='sm'
                disabled={isMutating}
                isLoading={isAssigning}
                onClick={() => onAssign(agent.userId)}
              >
                <Icons.add className='size-4' />
                Asignar
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AgentIdentity({ agent }: { agent: ProductAgent }) {
  const displayName = getAgentDisplayName(agent);

  return (
    <div className='flex min-w-0 items-center gap-3'>
      <Avatar className='size-9 shrink-0 rounded-full border bg-muted'>
        <AvatarFallback className='text-xs font-semibold'>{getAgentInitials(agent)}</AvatarFallback>
      </Avatar>
      <div className='min-w-0 flex-1 space-y-0.5'>
        <p className='truncate text-sm font-medium' title={displayName}>
          {displayName}
        </p>
        <p className='truncate text-sm text-foreground/70' title={agent.email}>
          {agent.email}
        </p>
      </div>
    </div>
  );
}

function getAssignedAgentsDescription(count: number) {
  return getLinkedEntityCountCopy(count, 'vendedor asignado', 'vendedores asignados');
}

function getAvailableAgentsDescription(count: number) {
  if (count === 1) {
    return 'Hay 1 vendedor disponible para sumar.';
  }

  return `Hay ${count} vendedores disponibles para sumar.`;
}

function getAssignAllButtonLabel(count: number) {
  if (count === 1) {
    return 'Sumar 1 vendedor';
  }

  return `Sumar ${count} vendedores`;
}

function getAgentDisplayName(agent: { email: string; firstName: string | null }) {
  return agent.firstName?.trim() || agent.email;
}

function getAgentInitials(agent: { email: string; firstName: string | null }) {
  return getEntityInitials(getAgentDisplayName(agent), agent.email);
}
