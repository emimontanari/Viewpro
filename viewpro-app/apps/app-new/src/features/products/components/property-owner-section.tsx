'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { productKeys } from '../api/queries';
import { createProductOwnerInvitationLink, linkProductOwner } from '../api/service';
import type { LinkProductOwnerPayload, PropertyLinkedOwner } from '../api/types';
import { LinkPropertyOwnerDialog } from './link-property-owner-dialog';
import { PropertyOwnerCard } from './property-owner-card';

type ManualInvitationFallback = {
  ownerId: string;
  invitationUrl: string;
};

type PropertyOwnerSectionProps = {
  isArchived: boolean;
  ownerEmail: string | null;
  ownerName: string | null;
  owners: PropertyLinkedOwner[];
  productId: string;
};

export function PropertyOwnerSection({
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
  const linkOwnerMutation = useMutation({
    mutationFn: (payload: LinkProductOwnerPayload) => linkProductOwner(productId, payload),
    onSuccess: async () => {
      setOwnerDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success('Propietario vinculado');
    },
    onError: (error) => {
      toast.error(getOwnerLinkErrorMessage(error));
    }
  });

  function handleOpenOwnerDialog() {
    if (isArchived || linkOwnerMutation.isPending) {
      return;
    }

    setOwnerDialogOpen(true);
  }

  function handleLinkOwner(payload: LinkProductOwnerPayload) {
    if (isArchived || linkOwnerMutation.isPending) {
      return;
    }

    linkOwnerMutation.mutate(payload);
  }

  async function handleCopyInvitationLink(owner: PropertyLinkedOwner) {
    if (isArchived || copyingInvitationOwnerId) {
      return;
    }

    setCopyingInvitationOwnerId(owner.id);
    setManualInvitationFallback(null);

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
      toast.error(
        error instanceof Error ? error.message : 'No se pudo generar el link de invitación.'
      );
    } finally {
      setCopyingInvitationOwnerId(null);
    }
  }

  return (
    <>
      <PropertyOwnerCard
        copyingInvitationOwnerId={copyingInvitationOwnerId}
        isArchived={isArchived}
        isLinkDisabled={linkOwnerMutation.isPending}
        manualInvitationFallback={manualInvitationFallback}
        ownerEmail={ownerEmail}
        ownerName={ownerName}
        owners={owners}
        onCopyInvitationLink={handleCopyInvitationLink}
        onLinkOwner={handleOpenOwnerDialog}
      />
      <LinkPropertyOwnerDialog
        open={ownerDialogOpen}
        isSubmitting={linkOwnerMutation.isPending}
        onOpenChange={setOwnerDialogOpen}
        onSubmit={handleLinkOwner}
      />
    </>
  );
}

function getOwnerLinkErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return 'No se pudo vincular el propietario.';
  }

  if (error.message.includes('already linked')) {
    return 'Ese propietario ya está vinculado a esta propiedad.';
  }

  return error.message || 'No se pudo vincular el propietario.';
}
