'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { createTeamInvitation } from '../api/service';
import type { CreateTeamInvitationPayload, User } from '../api/types';
import { InviteTeamMemberDialog } from './invite-team-member-dialog';
import { TeamMembersList } from './team-members-list';

type TeamManagementSectionProps = {
  members: User[];
};

export function TeamManagementSection({ members }: TeamManagementSectionProps) {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [manualInvitationUrl, setManualInvitationUrl] = useState<string | null>(null);
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

  return (
    <>
      <Card>
        <CardHeader className='gap-4 sm:flex-row sm:items-start sm:justify-between'>
          <div className='space-y-1.5'>
            <CardTitle>Miembros del equipo</CardTitle>
            <CardDescription>
              Esta lista usa membresías reales del tenant. Creá una invitación para sumar un manager
              o agente.
            </CardDescription>
          </div>
          <Button type='button' onClick={handleOpenInviteDialog}>
            Invitar miembro
          </Button>
        </CardHeader>
        <CardContent>
          <TeamMembersList members={members} />
        </CardContent>
      </Card>
      <InviteTeamMemberDialog
        open={inviteDialogOpen}
        invitationUrl={manualInvitationUrl}
        isSubmitting={inviteMutation.isPending}
        onInviteAnother={handleInviteAnother}
        onOpenChange={setInviteDialogOpen}
        onSubmit={(payload) => inviteMutation.mutate(payload)}
      />
    </>
  );
}
