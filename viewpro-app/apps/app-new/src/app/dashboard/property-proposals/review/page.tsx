'use client';

import PageContainer from '@/components/layout/page-container';
import { PropertyProposalReviewInbox } from '@/features/property-proposals/components/property-proposal-review-inbox';
import {
  reviewerPropertyProposalAccess,
  usePropertyProposalAccess
} from '@/lib/property-proposal-access';
import { useActiveTenant } from '@/lib/session-context';

export default function PropertyProposalReviewPage() {
  const { isTenantLoading } = useActiveTenant();
  const { activeTenantId, enabled } = usePropertyProposalAccess(reviewerPropertyProposalAccess);

  if (isTenantLoading) return <p aria-busy='true'>Cargando propuestas…</p>;
  if (!enabled || !activeTenantId) return <p>No tenés acceso a la revisión de propuestas.</p>;

  return (
    <PageContainer
      pageTitle='Revisión de propuestas'
      pageDescription='Revisá las propuestas pendientes de tu equipo.'
    >
      <PropertyProposalReviewInbox tenantId={activeTenantId} enabled={enabled} />
    </PageContainer>
  );
}
