'use client';

import { messageFor } from '@/lib/bff-client';
import { ownerLinkErrorMessage } from '../error-messages';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { productKeys } from '../api/queries';
import {
  createProductOwnerInvitationLink,
  linkProductOwner,
  revokeProductOwnerInvitationLink
} from '../api/service';
import type { LinkProductOwnerPayload, PropertyLinkedOwner } from '../api/types';
import { LinkPropertyOwnerDialog } from './link-property-owner-dialog';
import { PropertyOwnerCard } from './property-owner-card';

type ManualInvitationFallback = {
  ownerId: string;
  invitationUrl: string;
};

type PropertyOwnerSectionProps = {
  canManageOwners?: boolean;
  isArchived: boolean;
  ownerEmail: string | null;
  ownerName: string | null;
  owners: PropertyLinkedOwner[];
  productId: string;
};

export function PropertyOwnerSection({
  canManageOwners = true,
  isArchived,
  ownerEmail,
  ownerName,
  owners,
  productId
}: PropertyOwnerSectionProps) {
  const queryClient = useQueryClient();
  const [ownerDialogOpen, setOwnerDialogOpen] = useState(false);
  const [copyingInvitationOwnerId, setCopyingInvitationOwnerId] = useState<string | null>(null);
  const [manualInvitationFallback, setManualInvitationFallback] =
    useState<ManualInvitationFallback | null>(null);
  const [invitationManagementMessage, setInvitationManagementMessage] = useState<string | null>(
    null
  );
  const linkOwnerMutation = useMutation({
    mutationFn: (payload: LinkProductOwnerPayload) => linkProductOwner(productId, payload),
    onSuccess: async () => {
      setOwnerDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success('Propietario vinculado');
    },
    onError: (error) => {
      toast.error(ownerLinkErrorMessage(error));
    }
  });

  function handleOpenOwnerDialog() {
    if (isArchived || !canManageOwners || linkOwnerMutation.isPending) {
      return;
    }

    setOwnerDialogOpen(true);
  }

  function handleLinkOwner(payload: LinkProductOwnerPayload) {
    if (isArchived || !canManageOwners || linkOwnerMutation.isPending) {
      return;
    }

    linkOwnerMutation.mutate(payload);
  }

  async function handleCopyInvitationLink(owner: PropertyLinkedOwner) {
    if (isArchived || !canManageOwners || copyingInvitationOwnerId) {
      return;
    }

    setCopyingInvitationOwnerId(owner.id);
    setManualInvitationFallback(null);
    setInvitationManagementMessage(null);

    try {
      const response = await createProductOwnerInvitationLink(productId, owner.id);

      try {
        await navigator.clipboard.writeText(response.invitationUrl);
        toast.success('Link de invitación copiado. Los links anteriores ya no funcionan.');
      } catch {
        setManualInvitationFallback({ ownerId: owner.id, invitationUrl: response.invitationUrl });
        toast.warning('No pudimos copiar automáticamente. Copiá el link manualmente.');
      }
    } catch (error) {
      const message =
        messageFor(error, 'No se pudo generar el link de invitación.');
      setInvitationManagementMessage(message);
      toast.error(message);
    } finally {
      setCopyingInvitationOwnerId(null);
    }
  }

  async function handleRevokeInvitationLink(owner: PropertyLinkedOwner) {
    if (isArchived || !canManageOwners) {
      return;
    }

    const confirmed = window.confirm(
      '¿Querés revocar esta invitación? El link actual dejará de funcionar.'
    );
    if (!confirmed) {
      return;
    }

    setManualInvitationFallback(null);
    setInvitationManagementMessage(null);

    try {
      await revokeProductOwnerInvitationLink(productId, owner.id);
      const message = 'Invitación revocada. Podés regenerar un link nuevo cuando quieras.';
      setInvitationManagementMessage(message);
      toast.success(message);
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
    } catch (error) {
      const message = messageFor(error, 'No se pudo revocar la invitación.');
      setInvitationManagementMessage(message);
      toast.error(message);
    }
  }

  return (
    <>
      <PropertyOwnerCard
        canManageOwners={canManageOwners}
        copyingInvitationOwnerId={copyingInvitationOwnerId}
        isArchived={isArchived}
        isLinkDisabled={linkOwnerMutation.isPending}
        manualInvitationFallback={manualInvitationFallback}
        onDismissManualInvitation={() => setManualInvitationFallback(null)}
        ownerEmail={ownerEmail}
        ownerName={ownerName}
        owners={owners}
        onCopyInvitationLink={handleCopyInvitationLink}
        onRevokeInvitationLink={handleRevokeInvitationLink}
        onLinkOwner={handleOpenOwnerDialog}
      />
      {invitationManagementMessage ? (
        <p className='text-muted-foreground text-sm'>{invitationManagementMessage}</p>
      ) : null}
      <LinkPropertyOwnerDialog
        open={ownerDialogOpen}
        isSubmitting={linkOwnerMutation.isPending}
        onOpenChange={setOwnerDialogOpen}
        onSubmit={handleLinkOwner}
      />
    </>
  );
}

