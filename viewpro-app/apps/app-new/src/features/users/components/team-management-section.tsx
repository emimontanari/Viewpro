'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMutation } from '@tanstack/react-query';
import { IconUserPlus } from '@tabler/icons-react';
import { useActiveTenant } from '@/lib/session-context';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  createTeamInvitation,
  deactivateTeamMember,
  getTeamInvitations,
  resendTeamInvitation,
  revokeTeamInvitation,
  updateTeamMemberRole
} from '../api/service';
import type {
  CreateTeamInvitationPayload,
  PendingTeamInvitation,
  TeamInvitationRole,
  User
} from '../api/types';
import { InviteTeamMemberDialog } from './invite-team-member-dialog';
import { PendingTeamInvitationsList } from './pending-team-invitations-list';
import { TeamMembersList } from './team-members-list';

type TeamManagementSectionProps = {
  members: User[];
  pendingInvitations: PendingTeamInvitation[];
};

export function TeamManagementSection({ members, pendingInvitations }: TeamManagementSectionProps) {
  const { activeMembership } = useActiveTenant();
  const canManageTeam = activeMembership?.permissions.includes('team.manage') ?? false;
  const currentMembershipId = activeMembership?.id ?? null;
  const [membersState, setMembersState] = useState<User[]>(members);
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
    onError: () => {
      toast.error('No se pudo crear la invitación.');
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

  function replaceMember(updatedMember: User) {
    setMembersState((current) =>
      current.map((member) =>
        member.membershipId === updatedMember.membershipId ? updatedMember : member
      )
    );
  }

  const updateRoleMutation = useMutation({
    mutationFn: ({ membershipId, role }: { membershipId: string; role: TeamInvitationRole }) =>
      updateTeamMemberRole(membershipId, { role }),
    onSuccess: (updatedMember) => {
      replaceMember(updatedMember);
      toast.success('Rol actualizado.');
    },
    onError: () => {
      toast.error('No se pudo actualizar el rol.');
    }
  });

  const deactivateMutation = useMutation({
    mutationFn: (membershipId: string) => deactivateTeamMember(membershipId),
    onSuccess: (updatedMember) => {
      replaceMember(updatedMember);
      toast.success('Acceso desactivado.');
    },
    onError: () => {
      toast.error('No se pudo desactivar el acceso.');
    }
  });

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
      } catch {
        toast.error('No se pudieron actualizar las invitaciones.');
      }
    },
    onError: () => {
      toast.error('No se pudo regenerar la invitación.');
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
    onError: () => {
      toast.error('No se pudo revocar la invitación.');
    }
  });

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader className='gap-4 sm:flex-row sm:items-start sm:justify-between'>
          <div className='space-y-1.5'>
            <CardTitle>Miembros del equipo</CardTitle>
            <CardDescription>
              Esta lista usa membresías reales del tenant. Creá una invitación para sumar un encargado
              o vendedor.
            </CardDescription>
          </div>
          {canManageTeam ? (
            <Button type='button' size='sm' onClick={handleOpenInviteDialog}>
              <IconUserPlus className='size-4' aria-hidden='true' />
              Invitar miembro
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          <TeamMembersList
            canManageTeam={canManageTeam}
            currentMembershipId={currentMembershipId}
            members={membersState}
            isUpdatingRoleMembershipId={
              updateRoleMutation.isPending ? updateRoleMutation.variables.membershipId : null
            }
            isDeactivatingMembershipId={
              deactivateMutation.isPending ? deactivateMutation.variables : null
            }
            onUpdateRole={(membershipId, role) => updateRoleMutation.mutate({ membershipId, role })}
            onDeactivate={(membershipId) => deactivateMutation.mutate(membershipId)}
          />
        </CardContent>
      </Card>
      {canManageTeam ? (
        <PendingTeamInvitationsList
          copiedInvitationUrl={copiedInvitationUrl}
          invitations={pendingInvitationsState}
          isRegeneratingInvitationId={resendMutation.isPending ? resendMutation.variables : null}
          isRevokingInvitationId={revokeMutation.isPending ? revokeMutation.variables : null}
          onRegenerateAndCopy={(invitationId) => resendMutation.mutate(invitationId)}
          onRevoke={(invitationId) => revokeMutation.mutate(invitationId)}
        />
      ) : null}
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
