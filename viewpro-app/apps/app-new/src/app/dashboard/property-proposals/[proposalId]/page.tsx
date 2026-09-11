'use client';

import { useParams } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { PropertyProposalDetail } from '@/features/property-proposals/components/property-proposal-detail';
import {
  sellerPropertyProposalAccess,
  usePropertyProposalAccess
} from '@/lib/property-proposal-access';
import { useActiveTenant } from '@/lib/session-context';

export default function PropertyProposalPage() {
  const { proposalId } = useParams<{ proposalId?: string }>();
  const { isTenantLoading } = useActiveTenant();
  const { activeTenantId, enabled } = usePropertyProposalAccess(sellerPropertyProposalAccess);

  if (isTenantLoading) return <p aria-busy='true'>Cargando propuesta…</p>;
  if (!enabled || !activeTenantId) return <p>No tenés acceso a propuestas de propiedades.</p>;
  if (!proposalId) return <p>No encontramos esta propuesta.</p>;

  return (
    <PageContainer
      pageTitle='Propuesta de propiedad'
      pageDescription='Consultá los datos y el historial de revisión.'
    >
      <PropertyProposalDetail tenantId={activeTenantId} proposalId={proposalId} enabled={enabled} />
    </PageContainer>
  );
}
