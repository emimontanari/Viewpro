'use client';

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

type ManagePropertyAgentsDialogProps = {
  assignedAgents: ProductAgent[];
  assignableAgents: AssignableProductAgent[];
  assigningUserId: string | null;
  isAssignableAgentsError: boolean;
  isAssignableAgentsLoading: boolean;
  onAssign: (agentUserId: string) => void;
  onOpenChange: (open: boolean) => void;
  onRemove: (agentId: string) => void;
  open: boolean;
  removingAgentId: string | null;
};

type PropertyAgentsPanelProps = {
  agents: ProductAgent[];
  isArchived: boolean;
  isManageDisabled: boolean;
  onManage: () => void;
};

const roleLabels: Record<TenantMemberRole, string> = {
  AGENT: 'Vendedor',
  MANAGER: 'Manager',
  PRINCIPAL_MANAGER: 'Titular'
};

export function PropertyAgentsPanel({
  agents,
  isArchived,
  isManageDisabled,
  onManage
}: PropertyAgentsPanelProps) {
  return (
    <section className='space-y-3 rounded-xl border bg-muted/20 p-4'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div className='space-y-1'>
          <div className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
            Vendedores
          </div>
          <p className='text-sm text-muted-foreground'>
            {getAssignedAgentsDescription(agents.length)}
          </p>
        </div>
        {isArchived ? null : (
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={isManageDisabled}
            onClick={onManage}
          >
            <Icons.teams className='size-4' />
            Gestionar vendedores
          </Button>
        )}
      </div>

      {agents.length > 0 ? (
        <ul className='space-y-2'>
          {agents.map((agent) => (
            <li key={agent.id} className='rounded-lg border bg-background/70 p-3'>
              <AgentIdentity agent={agent} />
            </li>
          ))}
        </ul>
      ) : (
        <div className='rounded-lg border border-dashed bg-background/60 p-3 text-sm text-muted-foreground'>
          Todavía no hay vendedores asignados.
        </div>
      )}

      {isArchived ? (
        <p className='text-xs leading-5 text-muted-foreground'>
          Restaurá la propiedad para gestionar vendedores.
        </p>
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
  onAssign,
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
  const isMutating = Boolean(assigningUserId || removingAgentId);

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
              onAssign
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
  onAssign
}: {
  availableAgents: AssignableProductAgent[];
  assigningUserId: string | null;
  isAssignableAgentsError: boolean;
  isAssignableAgentsLoading: boolean;
  isMutating: boolean;
  onAssign: (agentUserId: string) => void;
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

  return (
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
              <p className='break-all text-sm text-muted-foreground'>{agent.email}</p>
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
  );
}

function AgentIdentity({ agent }: { agent: ProductAgent }) {
  return (
    <div className='min-w-0 space-y-1'>
      <p className='break-words text-sm font-medium'>{getAgentDisplayName(agent)}</p>
      <p className='break-all text-sm text-muted-foreground'>{agent.email}</p>
    </div>
  );
}

function getAssignedAgentsDescription(count: number) {
  if (count === 0) {
    return 'Sin responsables asignados.';
  }

  if (count === 1) {
    return '1 vendedor asignado.';
  }

  return `${count} vendedores asignados.`;
}

function getAgentDisplayName(agent: { email: string; firstName: string | null }) {
  return agent.firstName?.trim() || agent.email;
}
