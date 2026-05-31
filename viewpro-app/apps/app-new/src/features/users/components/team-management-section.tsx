'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMutation } from '@tanstack/react-query';
import { IconUserPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  createTeamInvitation,
  getTeamInvitations,
  resendTeamInvitation,
  revokeTeamInvitation
} from '../api/service';
import type { CreateTeamInvitationPayload, PendingTeamInvitation, User } from '../api/types';
import { InviteTeamMemberDialog } from './invite-team-member-dialog';
import { PendingTeamInvitationsList } from './pending-team-invitations-list';
import { TeamMembersList } from './team-members-list';

type TeamManagementSectionProps = {
  members: User[];
  pendingInvitations: PendingTeamInvitation[];
};

export function TeamManagementSection({ members, pendingInvitations }: TeamManagementSectionProps) {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [manualInvitationUrl, setManualInvitationUrl] = useState<string | null>(null);
  const [copiedInvitationUrl, setCopiedInvitationUrl] = useState<string | null>(null);
  const [pendingInvitationsState, setPendingInvitationsState] =
    useState<PendingTeamInvitation[]>(pendingInvitations);
  const inviteMutation = useMutation({
    mutationFn: (payload: CreateTeamInvitationPayload) => createTeamInvitation(payload),
    onSuccess: async (response) => {
      setManualInvitationUrl(response.invitationUrl);

      try {
        await navigator.clipboard.writeText(response.invitationUrl);
        toast.success('Invitación creada y link copiado.');
      } catch {
        toast.warning('Invitación creada. Copiá el link manualmente.');
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear la invitación.');
    }
  });

  function handleOpenInviteDialog() {
    setManualInvitationUrl(null);
    setInviteDialogOpen(true);
  }

  function handleInviteAnother() {
    setManualInvitationUrl(null);
    inviteMutation.reset();
  }

  async function refreshPendingInvitations() {
    const response = await getTeamInvitations();
    setPendingInvitationsState(response.items);
  }

  const resendMutation = useMutation({
    mutationFn: (invitationId: string) => resendTeamInvitation(invitationId),
    onSuccess: async (response) => {
      setCopiedInvitationUrl(null);

      try {
        await navigator.clipboard.writeText(response.invitationUrl);
        toast.success('Link regenerado y copiado.');
      } catch {
        setCopiedInvitationUrl(response.invitationUrl);
        toast.warning('Link regenerado. Copialo manualmente.');
      }

      try {
        await refreshPendingInvitations();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'No se pudieron actualizar las invitaciones.'
        );
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'No se pudo regenerar la invitación.');
    }
  });

  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) => revokeTeamInvitation(invitationId),
    onSuccess: (_response, invitationId) => {
      setCopiedInvitationUrl(null);
      setPendingInvitationsState((current) =>
        current.filter((invitation) => invitation.invitationId !== invitationId)
      );
      toast.success('Invitación revocada.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'No se pudo revocar la invitación.');
    }
  });

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader className='gap-4 sm:flex-row sm:items-start sm:justify-between'>
          <div className='space-y-1.5'>
            <CardTitle>Miembros del equipo</CardTitle>
            <CardDescription>
              Esta lista usa membresías reales del tenant. Creá una invitación para sumar un manager
              o agente.
            </CardDescription>
          </div>
          <Button type='button' size='sm' onClick={handleOpenInviteDialog}>
            <IconUserPlus className='size-4' aria-hidden='true' />
            Invitar miembro
          </Button>
        </CardHeader>
        <CardContent>
          <TeamMembersList members={members} />
        </CardContent>
      </Card>
      <PendingTeamInvitationsList
        copiedInvitationUrl={copiedInvitationUrl}
        invitations={pendingInvitationsState}
        isRegeneratingInvitationId={resendMutation.isPending ? resendMutation.variables : null}
        isRevokingInvitationId={revokeMutation.isPending ? revokeMutation.variables : null}
        onRegenerateAndCopy={(invitationId) => resendMutation.mutate(invitationId)}
        onRevoke={(invitationId) => revokeMutation.mutate(invitationId)}
      />
      <InviteTeamMemberDialog
        open={inviteDialogOpen}
        invitationUrl={manualInvitationUrl}
        isSubmitting={inviteMutation.isPending}
        onInviteAnother={handleInviteAnother}
        onOpenChange={setInviteDialogOpen}
        onSubmit={(payload) => inviteMutation.mutate(payload)}
      />
    </div>
  );
}
